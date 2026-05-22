resource "google_cloud_run_v2_service" "service" {
  name     = var.service_name
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      image = var.image_url

      ports {
        container_port = 3006
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "1024Mi"
        }
      }

      dynamic "env" {
        for_each = var.env_vars
        content {
          name  = env.key
          value = env.value
        }
      }
    }
  }
}

resource "google_cloud_run_v2_service_iam_member" "noauth" {
  location = google_cloud_run_v2_service.service.location
  name     = google_cloud_run_v2_service.service.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

output "service_url" {
  value = google_cloud_run_v2_service.service.uri
}

variable "project_id"   { type = string }
variable "region"       { type = string }
variable "image_url"    { type = string }
variable "service_name" { type = string }
variable "env_vars"     { type = map(string) }
