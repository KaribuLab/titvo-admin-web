# Deploy the admin web manually

Use **Actions → Deploy admin web to AWS → Run workflow**, select a reviewed
ref and a configured GitHub environment. Preparing or merging this workflow does
not deploy anything: `workflow_dispatch` is its only trigger.

## Before the first rollout

An infrastructure owner must provision/confirm the target; this workflow does not
bootstrap the shared platform or repair IAM/application behavior.

| Prerequisite | Contract |
| --- | --- |
| Base infrastructure | Existing S3 Terraform state bucket and DynamoDB lock table, with deploy-role access. |
| Account API/BFF | Conventional Lambda BFF and account API Gateway already deployed; the parameter lookup must return `/tvo/security-scan/<stage>/infra/apigateway/account/api_gateway_id`. |
| API origin | CloudFront forwards `/api/*` unchanged to the account gateway with origin path `/v1`. The gateway must serve `/v1/api/*`, including auth, and forward cookies correctly. The UI remains same-origin `/api`; no alternate API URL is injected. |
| Deployment role | GitHub OIDC trust for this repository and the selected environment; authorized to manage the existing S3/CloudFront stack, read SSM parameters, access Terraform state/locks, publish objects, and invalidate this distribution. Do not grant permissions from this workflow. |

Configure these **GitHub environment variables** (no guessed target defaults):

| Variable | Required value |
| --- | --- |
| `AWS_REGION` | Explicit commercial AWS region, for example a region shaped `us-east-2`; choose the actual target, not this example. |
| `AWS_STAGE` | `test` or `prod`, matching the existing stage configuration and SSM prerequisite. LocalStack is not an AWS deployment target. |
| `AWS_ACCOUNT_ID` | Target's 12-digit account ID. |
| `AWS_ROLE_ARN` | `arn:aws:iam::<same-account>:role/<deployment-role>`; role paths supported. |

Set required reviewers and deployment branch restrictions on that environment.
OIDC trust should bind `aud` to `sts.amazonaws.com` and `sub` to
`repo:<owner>/<repository>:environment:<environment>` (substitute the real names).
The job alone receives `contents: read` and `id-token: write`. Credential setup
uses `aws-actions/configure-aws-credentials@v5`, whose supported
`allowed-account-ids` input accepts comma-delimited expected account IDs. This
workflow supplies the single configured `AWS_ACCOUNT_ID`, rejecting mismatched
credentials before the deploy step. Do not downgrade to v4: it lacks this input.
No long-lived access keys are configured.
A protected environment is a capability, not an approval rule created by YAML.

### State is unchanged

The existing backend uses `tvo-admin-web-<region>-<account>` for the state bucket,
`<same-name>-tfstate-lock` for locks, and `aws/<module>/terraform.tfstate` keys.
The SPA bucket is `<same-name>-spa`. **Stage is not part of these names.** Two
stages in the same account/region share this state and distribution; do not treat
GitHub environments as isolated stacks. Workflow concurrency serializes all web
deployments and does not cancel an in-flight apply.

## What a manual run does

1. Check out the selected ref and reject missing/malformed configuration before
   credentials or apply. Install locked npm dependencies, run offline contracts,
   `npm test`, and `npm run build`.
2. Set up Terraform 1.9.8 and Terragrunt 0.69.1 (the sibling workflow versions),
   authenticate through OIDC, and check the build again before mutation.
3. Run `terragrunt run-all apply --terragrunt-non-interactive -auto-approve
   --terragrunt-working-dir aws`, preserving dependency ordering and backend
   conventions. This is an approved manual apply, not a saved-plan promotion.
4. Read `bucket_name`, `distribution_id`, and `distribution_domain_name` directly
   from `terragrunt output -json --terragrunt-working-dir aws/s3-cloudfront`.
   Missing/malformed outputs stop publishing; no installer SSM output is assumed.
5. Upload everything except `index.html`, then upload `index.html`, then request
   CloudFront `/*` invalidation. Any failure stops subsequent commands. The URL
   is printed and added to the workflow summary only after successful submission.

CI uses Node 24.21.0 because the existing `npm test` command sets
`NODE_OPTIONS=--no-experimental-webstorage`; older Node versions, including the
existing `.nvmrc`, may reject that flag. No package, lockfile, or application
runtime configuration is changed. Actions use major release tags, not verified
immutable SHAs; SHA verification and live tool installation were not performed
by the offline implementation tests.

## Caching, failure recovery, and rollback

- All non-index files get `public,max-age=300` (five minutes), including Vite's
  hashed assets and the unversioned favicon; index gets
  `no-cache,no-store,must-revalidate`. Avoid immutable caching for unversioned
  files. No objects are deleted (`--delete` is never used), so old tabs and
  rollback indexes retain their assets.
- The existing Managed-CachingOptimized CloudFront policy has a minimum TTL;
  origin cache headers alone do not guarantee immediate index refresh. The
  post-upload invalidation handles this, asynchronously. Wait for propagation
  and check the summary URL, sign-in, deep links, and `/api/*` after deployment.
- If asset upload fails, the old index stays in place. If index upload or
  invalidation fails, inspect the run before retrying: publication is not atomic
  and the helper does not automatically undo infrastructure or uploaded files.
- For application rollback, select a known-good reviewed ref and run the manual
  workflow against the **same target**, after reviewing its infrastructure diff.
  It rebuilds and republishes the old index/assets and invalidates caches. This
  also reapplies that ref's infrastructure; it is not an infrastructure rollback
  guarantee. For index-only recovery, an operator must use a previously retained
  artifact under a separately approved procedure. Retain release refs/artifacts;
  old S3 assets alone do not preserve a release's index.

## Offline verification

Run from the repository root with the existing dependencies available:

```sh
node --test test/deployment/offline.mjs
npm test
npm run build
git diff --check
```

The shell interface is `bash scripts/deploy-aws.sh preflight|deploy`, run from
repository root. `BUILD_DIR` defaults to `dist` and exists for alternate built
artifacts/offline fixtures; it is not a workflow input. `preflight` uses no AWS
calls. `deploy` is a real mutating operation outside tests: do not run it locally
without separate authorization. The tests export stub CLIs and assert rejection,
command order, failures, and workflow contracts. They do not validate live AWS
permissions, API availability, Terraform plans, action execution, or readiness.
