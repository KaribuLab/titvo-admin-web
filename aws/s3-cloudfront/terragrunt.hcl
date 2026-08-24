# Task 4.1 (S3+CloudFront infra half) / 4.2 (CloudFront `/api/*` routing).
# Attaches the SPA's CloudFront distribution to the same `account` API
# Gateway titvo-admin-bff-aws already routes to (design D1) — reads its
# gateway id from SSM via the same `dependency parameters` pattern used
# across this ecosystem (see titvo-admin-bff-aws/aws/apigateway/terragrunt.hcl).
terraform {
  source = "${get_parent_terragrunt_dir()}/modules/s3-cloudfront"
}

locals {
  serverless  = read_terragrunt_config(find_in_parent_folders("serverless.hcl"))
  common_tags = local.serverless.locals.common_tags
  base_path   = "${local.serverless.locals.parameter_path}/${local.serverless.locals.stage}"
  bucket_name = "${local.serverless.locals.service_bucket}-spa"
}

include {
  path = find_in_parent_folders()
}

dependency parameters {
  config_path = "${get_parent_terragrunt_dir()}/aws/parameter"
  mock_outputs = {
    parameters = {
      "${local.base_path}/infra/apigateway/account/api_gateway_id" = "api-gateway-account-id"
    }
  }
}

inputs = {
  bucket_name             = local.bucket_name
  api_gateway_domain_name = "${dependency.parameters.outputs.parameters["${local.base_path}/infra/apigateway/account/api_gateway_id"]}.execute-api.${local.serverless.locals.region}.amazonaws.com"
  common_tags             = local.common_tags
}
