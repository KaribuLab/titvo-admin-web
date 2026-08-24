# SPA public entry point (design.md CloudFront section, tasks 4.1/4.2):
# a single CloudFront distribution with two behaviors so the browser sees
# ONE origin — no CORS needed, and SameSite=Strict cookies work.
#   - "/api/*"  -> the BFF's `account` API Gateway (origin_path = stage),
#                  CachingDisabled, AllViewerExceptHostHeader (forwards Cookie).
#   - default   -> S3 via Origin Access Control (bucket stays private),
#                  CachingOptimized, 403/404 -> /index.html for SPA deep links.
#
# NOTE: this is a NEW local module, not `titvo-security-scan-infra-aws`'s
# existing `module/s3-static` — that module makes the bucket public via S3
# static website hosting, which is incompatible with design's explicit
# "S3 origin via OAC (bucket stays private)" requirement. Deviation is
# documented in apply-progress.

locals {
  s3_origin_id  = "s3-${var.bucket_name}"
  api_origin_id = "account-api-gateway"
}

resource "aws_cloudfront_origin_access_control" "spa" {
  name                              = "${var.bucket_name}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_s3_bucket" "spa" {
  bucket = var.bucket_name
  tags   = var.common_tags
}

resource "aws_s3_bucket_public_access_block" "spa" {
  bucket                  = aws_s3_bucket.spa.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer_except_host_header" {
  name = "Managed-AllViewerExceptHostHeader"
}

resource "aws_cloudfront_distribution" "spa" {
  enabled              = true
  default_root_object = "index.html"
  comment              = "Titvo admin console SPA"
  tags                 = var.common_tags

  origin {
    domain_name              = aws_s3_bucket.spa.bucket_regional_domain_name
    origin_id                = local.s3_origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.spa.id
  }

  origin {
    domain_name = var.api_gateway_domain_name
    origin_id   = local.api_origin_id
    origin_path = "/v1"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods       = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = local.s3_origin_id
    viewer_protocol_policy = "redirect-to-https"
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_optimized.id
    compress               = true
  }

  # `/api/*` — same-origin path to the BFF (design D-series, resolved
  # further in bff-auth-routing-decision: the BFF proxies auth too, so no
  # second behavior is needed for login/logout/me).
  ordered_cache_behavior {
    path_pattern              = "/api/*"
    allowed_methods           = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods            = ["GET", "HEAD"]
    target_origin_id          = local.api_origin_id
    viewer_protocol_policy    = "redirect-to-https"
    cache_policy_id           = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id  = data.aws_cloudfront_origin_request_policy.all_viewer_except_host_header.id
    compress                  = false
  }

  custom_error_response {
    error_code        = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code        = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

resource "aws_s3_bucket_policy" "spa" {
  bucket = aws_s3_bucket.spa.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipalReadOnly"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.spa.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.spa.arn
          }
        }
      }
    ]
  })
}
