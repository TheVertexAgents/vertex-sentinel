terraform {
  required_version = ">= 1.0.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

module "registry" {
  source     = "./modules/registry"
  project_id = var.project_id
  region     = var.region
  repo_name  = "vertex-sentinel-repo"
}

module "cloud_run" {
  source     = "./modules/cloud_run"
  project_id = var.project_id
  region     = var.region
  image_url  = "${module.registry.repository_url}/vertex-sentinel:latest"
  service_name = "vertex-sentinel"
  env_vars   = var.env_vars
}
