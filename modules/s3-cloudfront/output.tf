output "bucket_name" {
  value = aws_s3_bucket.spa.id
}

output "bucket_arn" {
  value = aws_s3_bucket.spa.arn
}

output "distribution_id" {
  value = aws_cloudfront_distribution.spa.id
}

output "distribution_domain_name" {
  value = aws_cloudfront_distribution.spa.domain_name
}
