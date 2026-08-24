variable "bucket_name" {
  type        = string
  description = "Name of the private S3 bucket serving the SPA static assets"
}

variable "api_gateway_domain_name" {
  type        = string
  description = "execute-api domain name of the account API Gateway (no protocol prefix, no stage path — origin_path carries the stage)"
}

variable "common_tags" {
  type        = map(string)
  description = "Common resource tags"
}
