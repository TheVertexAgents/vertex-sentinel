resource "google_artifact_registry_repository" "repo" {
  location      = var.region
  repository_id = var.repo_name
  description   = "Docker repository for Vertex Sentinel"
  format        = "DOCKER"
}

output "repository_url" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${resource.google_artifact_registry_repository.repo.repository_id}"
}

variable "project_id" { type = string }
variable "region"     { type = string }
variable "repo_name"  { type = string }
