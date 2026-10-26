#!/usr/bin/env bash
# Run from the repository root. No AWS command is used by preflight.
set -euo pipefail
fail() { printf 'Error: %s\n' "$1" >&2; exit 1; }
case "${1:-}" in
  preflight|deploy) mode="$1" ;;
  *) fail 'usage: bash scripts/deploy-aws.sh preflight|deploy' ;;
esac
[[ ${AWS_REGION:-} =~ ^[a-z]{2}-[a-z]+-[0-9]+$ ]] || fail 'invalid AWS_REGION'
[[ ${AWS_STAGE:-} =~ ^(test|prod)$ ]] || fail 'invalid AWS_STAGE'
[[ ${AWS_ACCOUNT_ID:-} =~ ^[0-9]{12}$ ]] || fail 'invalid AWS_ACCOUNT_ID'
[[ ${AWS_ROLE_ARN:-} =~ ^arn:aws:iam::${AWS_ACCOUNT_ID}:role/[A-Za-z0-9_+=,.@/-]+$ ]] || fail 'invalid AWS_ROLE_ARN'
[[ $mode == preflight ]] && exit 0

build_dir="${BUILD_DIR:-dist}"
# Reject partial builds and symlinks before any infrastructure mutation.
node --input-type=module - "$build_dir" <<'JS' || fail 'build requires nonempty index.html and assets'
import { lstatSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
try {
  const root = process.argv[2]
  function safe(path) {
    const stat = lstatSync(path)
    if (stat.isSymbolicLink()) throw Error()
    if (stat.isDirectory()) for (const name of readdirSync(path)) safe(join(path, name))
  }
  safe(root)
  const index = lstatSync(join(root, 'index.html'))
  if (!index.isFile() || !index.size || !readdirSync(join(root, 'assets')).length) throw Error()
  const refs = [...readFileSync(join(root, 'index.html'), 'utf8').matchAll(/(?:src|href)=["']\/?(assets\/[^"']+)["']/g)]
  if (!refs.length) throw Error()
  for (const [, ref] of refs) {
    if (ref.split('/').includes('..')) throw Error()
    const asset = lstatSync(join(root, ref))
    if (!asset.isFile() || !asset.size) throw Error()
  }
} catch { process.exit(1) }
JS

terragrunt run-all apply --terragrunt-non-interactive -auto-approve --terragrunt-working-dir aws
outputs="$(terragrunt output -json --terragrunt-working-dir aws/s3-cloudfront)"
targets="$(printf '%s' "$outputs" | node --input-type=module -e '
  import { readFileSync } from "node:fs";
  try {
    const output = JSON.parse(readFileSync(0, "utf8"));
    const rules = {
      bucket_name: /^(?!.*\.\.)[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/,
      distribution_id: /^[A-Z0-9]{1,64}$/,
      distribution_domain_name: /^d[a-z0-9]+\.cloudfront\.net$/
    };
    const values = Object.entries(rules).map(([name, rule]) => {
      const value = output[name]?.value;
      if (typeof value !== "string" || !rule.test(value)) throw Error();
      return value;
    });
    console.log(values.join(" "));
  } catch { process.exit(1); }
')" || fail 'invalid Terraform deployment outputs'
read -r bucket distribution domain <<< "$targets"

# Keep old hashed assets: open tabs and rollback indexes still reference them.
aws s3 cp "$build_dir/" "s3://$bucket/" --recursive --exclude index.html \
  --cache-control 'public,max-age=300' --region "$AWS_REGION"
aws s3 cp "$build_dir/index.html" "s3://$bucket/index.html" \
  --cache-control 'no-cache,no-store,must-revalidate' --content-type text/html --region "$AWS_REGION"
aws cloudfront create-invalidation --distribution-id "$distribution" --paths '/*' --region "$AWS_REGION"
printf 'https://%s\n' "$domain"
if [[ -n ${GITHUB_STEP_SUMMARY:-} ]]; then
  printf '### Admin web deployment\n\nURL: https://%s\n\nStage: `%s` | Account: `%s` | Region: `%s`\n\nInvalidation requested; propagation is asynchronous.\n' \
    "$domain" "$AWS_STAGE" "$AWS_ACCOUNT_ID" "$AWS_REGION" >> "$GITHUB_STEP_SUMMARY"
fi
