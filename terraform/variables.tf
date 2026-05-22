variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "region" {
  description = "The GCP region"
  type        = string
  default     = "us-central1"
}

variable "env_vars" {
  description = "Environment variables for Cloud Run"
  type        = map(string)
  default     = {}
}
