import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const valid = {
  AWS_REGION: 'us-east-2', AWS_STAGE: 'prod', AWS_ACCOUNT_ID: '123456789012',
  AWS_ROLE_ARN: 'arn:aws:iam::123456789012:role/web-deploy',
  BUILD_DIR: 'test/deployment/fixture', FAIL_AT: '',
  OUTPUTS: JSON.stringify({
    bucket_name: { value: 'web-spa' }, distribution_id: { value: 'E123ABC' },
    distribution_domain_name: { value: 'd123abc.cloudfront.net' }
  })
}
function run(overrides = {}, mode = 'deploy') {
  return spawnSync('bash', ['-c', `
    aws() {
      printf 'aws %s\\n' "$*"
      if [[ "$*" == *"$FAIL_AT"* && -n "$FAIL_AT" ]]; then return 7; fi
    }
    terragrunt() {
      printf 'terragrunt %s\\n' "$*" >&2
      if [[ "$*" == *"$FAIL_AT"* && -n "$FAIL_AT" ]]; then return 7; fi
      if [[ "$*" == *'output -json'* ]]; then printf '%s' "$OUTPUTS"; fi
    }
    export -f aws terragrunt
    bash scripts/deploy-aws.sh "$1"
  `, 'offline', mode], {
    encoding: 'utf8', env: { PATH: process.env.PATH, ...valid, ...overrides }
  })
}
function rejected(env, message) {
  const result = run(env)
  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, `Error: ${message}\n`)
}
for (const key of ['AWS_REGION', 'AWS_STAGE', 'AWS_ACCOUNT_ID', 'AWS_ROLE_ARN']) {
  test(`missing ${key} rejects before CLIs`, () => rejected({ [key]: '' }, `invalid ${key}`))
}
for (const [key, value] of Object.entries({ AWS_REGION: 'not a region', AWS_STAGE: 'dev', AWS_ACCOUNT_ID: '123', AWS_ROLE_ARN: 'arn:aws:iam::999999999999:role/web' })) {
  test(`malformed ${key} rejects before CLIs`, () => rejected({ [key]: value }, `invalid ${key}`))
}
test('preflight works before build/auth without CLIs', () => {
  const result = run({ BUILD_DIR: 'missing' }, 'preflight')
  assert.equal(result.status, 0)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, '')
})
test('missing build rejects before apply', () => rejected({ BUILD_DIR: 'test/deployment/missing' }, 'build requires nonempty index.html and assets'))
test('malformed build rejects before apply', () => rejected({ BUILD_DIR: 'test/deployment/fixture/assets' }, 'build requires nonempty index.html and assets'))
test('incomplete referenced bundle rejects before apply', () => rejected({ BUILD_DIR: 'test/deployment/incomplete' }, 'build requires nonempty index.html and assets'))
for (const outputs of ['{}', 'not json', ...['bucket_name', 'distribution_id', 'distribution_domain_name'].map(key => {
  const obj = JSON.parse(valid.OUTPUTS)
  obj[key].value = key === 'bucket_name' ? 'bad/bucket' : key === 'distribution_id' ? '../bad' : 'evil.example.com'
  return JSON.stringify(obj)
})]) {
  test(`invalid outputs reject without publishing: ${outputs}`, () => {
    const result = run({ OUTPUTS: outputs })
    assert.equal(result.status, 1)
    assert.equal(result.stdout, '')
    assert.match(result.stderr, /Error: invalid Terraform deployment outputs\n$/)
  })
}
test('successful rollout applies then uploads assets, index, invalidation', () => {
  const result = run()
  assert.equal(result.status, 0)
  assert.equal(result.stderr, 'terragrunt run-all apply --terragrunt-non-interactive -auto-approve --terragrunt-working-dir aws\nterragrunt output -json --terragrunt-working-dir aws/s3-cloudfront\n')
  assert.equal(result.stdout, [
    'aws s3 cp test/deployment/fixture/ s3://web-spa/ --recursive --exclude index.html --cache-control public,max-age=300 --region us-east-2',
    'aws s3 cp test/deployment/fixture/index.html s3://web-spa/index.html --cache-control no-cache,no-store,must-revalidate --content-type text/html --region us-east-2',
    'aws cloudfront create-invalidation --distribution-id E123ABC --paths /* --region us-east-2',
    'https://d123abc.cloudfront.net', ''
  ].join('\n'))
})
for (const fail of ['run-all', 'output -json', '--recursive', '--content-type', 'create-invalidation']) {
  test(`failure at ${fail} stops subsequent commands`, () => {
    const result = run({ FAIL_AT: fail })
    assert.equal(result.status, 7)
    const calls = result.stdout.split('\n').filter(line => line.startsWith('aws '))
    assert.equal(calls.length, { 'run-all': 0, 'output -json': 0, '--recursive': 1, '--content-type': 2, 'create-invalidation': 3 }[fail])
    assert.doesNotMatch(result.stdout, /https:/)
    if (fail === 'run-all') assert.doesNotMatch(result.stderr, /output -json/)
  })
}
test('supported v5 account guard runs before deployment', () => {
  const yaml = readFileSync('.github/workflows/deploy-to-aws.yml', 'utf8')
  assert.doesNotMatch(yaml, /uses: aws-actions\/configure-aws-credentials@v4\b/)
  const credentials = yaml.match(/uses: aws-actions\/configure-aws-credentials@v5\n([\s\S]*?)(?=\n      - name:)/)
  assert.ok(credentials, 'credential setup must use the verified v5 contract')
  assert.match(credentials[1], /allowed-account-ids: \$\{\{ env.AWS_ACCOUNT_ID \}\}/)
  const deploy = yaml.indexOf('run: bash scripts/deploy-aws.sh deploy')
  assert.ok(deploy > credentials.index + credentials[0].length, 'account guard must precede deployment')
})
test('workflow manual-only and protected OIDC job with pre-auth validation', () => {
  const yaml = readFileSync('.github/workflows/deploy-to-aws.yml', 'utf8')
  assert.match(yaml, /on:\n  workflow_dispatch:/)
  assert.doesNotMatch(yaml, /\n  (push|pull_request|schedule|workflow_call):/)
  assert.match(yaml, /environment: \$\{\{ inputs.environment \}\}/)
  assert.match(yaml, /permissions:\n      contents: read\n      id-token: write/)
  for (const key of ['AWS_REGION', 'AWS_STAGE', 'AWS_ACCOUNT_ID', 'AWS_ROLE_ARN']) assert.match(yaml, new RegExp(`${key}: \\$\\{\\{ vars\\.${key} \\}\\}`))
  assert.ok(yaml.indexOf('bash scripts/deploy-aws.sh preflight') < yaml.indexOf('uses: aws-actions/configure-aws-credentials@'))
  assert.match(yaml, /allowed-account-ids: \$\{\{ env.AWS_ACCOUNT_ID \}\}/)
  for (const command of ['npm ci', 'node --test test/deployment/offline.mjs', 'npm test', 'npm run build', 'bash scripts/deploy-aws.sh deploy']) assert.ok(yaml.includes(command))
  assert.match(yaml, /GITHUB_STEP_SUMMARY|Deployment summary/)
})
