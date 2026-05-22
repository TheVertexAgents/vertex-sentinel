# Vertex Sentinel - Deployment Makefile

PROJECT_ID ?= $(shell gcloud config get-value project)
REGION ?= us-central1
REPO_NAME = vertex-sentinel-repo
IMAGE_NAME = vertex-sentinel
TAG = latest
IMAGE_URL = $(REGION)-docker.pkg.dev/$(PROJECT_ID)/$(REPO_NAME)/$(IMAGE_NAME):$(TAG)

.PHONY: build push deploy-infra deploy-app all help

help:
	@echo "Usage:"
	@echo "  make build        - Build the Docker image locally"
	@echo "  make push         - Push the Docker image to GCP Artifact Registry"
	@echo "  make deploy-infra - Initialize and apply Terraform (GCP resources)"
	@echo "  make deploy-app   - Update Cloud Run service with the latest image"
	@echo "  make all          - Build, push, and deploy everything"

build:
	docker build -t $(IMAGE_NAME) .

push:
	docker tag $(IMAGE_NAME) $(IMAGE_URL)
	docker push $(IMAGE_URL)

deploy-infra:
	cd terraform && terraform init && terraform apply -var="project_id=$(PROJECT_ID)" -var="region=$(REGION)" -auto-approve

deploy-app:
	gcloud run services update vertex-sentinel \
		--image $(IMAGE_URL) \
		--platform managed \
		--region $(REGION) \
		--project $(PROJECT_ID)

all: build push deploy-infra deploy-app
