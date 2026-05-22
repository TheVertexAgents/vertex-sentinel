output "service_url" {
  description = "The URL of the Cloud Run service"
  value       = module.cloud_run.service_url
}

output "repository_url" {
  description = "The URL of the Artifact Registry repository"
  value       = module.registry.repository_url
}
