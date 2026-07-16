.PHONY: help dev build start stop restart logs clean test lint typecheck
.PHONY: docker-build docker-push docker-tag
.PHONY: helm-lint helm-template helm-install helm-upgrade helm-uninstall helm-status
.PHONY: k8s-status k8s-logs k8s-port-forward
.PHONY: ci cd deploy-staging deploy-production release

# Configuration
REGISTRY ?= ghcr.io/belo
IMAGE_NAME ?= speedrunner
IMAGE_TAG ?= latest
NAMESPACE ?= speedrunner
RELEASE_NAME ?= speedrunner

# Default target
help: ## Show this help message
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  dev              - Start development environment"
	@echo "  build            - Build production Docker image"
	@echo "  start            - Start production environment"
	@echo "  stop             - Stop all containers"
	@echo "  restart          - Restart all containers"
	@echo "  logs             - View container logs"
	@echo "  clean            - Remove containers and volumes"
	@echo "  test             - Run all tests"
	@echo "  lint             - Run linter"
	@echo "  typecheck        - Run type checking"
	@echo ""
	@echo "Docker targets:"
	@echo "  docker-build     - Build Docker image"
	@echo "  docker-push      - Push image to GHCR"
	@echo "  docker-tag       - Tag image for registry"
	@echo ""
	@echo "Helm targets:"
	@echo "  helm-lint        - Lint Helm chart"
	@echo "  helm-template    - Render templates locally"
	@echo "  helm-install     - Install to cluster"
	@echo "  helm-upgrade     - Upgrade existing release"
	@echo "  helm-uninstall   - Remove release"
	@echo "  helm-status      - Check release status"
	@echo ""
	@echo "Kubernetes targets:"
	@echo "  k8s-status       - Get pod/service status"
	@echo "  k8s-logs         - Tail app logs"
	@echo "  k8s-port-forward - Forward ports for local access"
	@echo ""
	@echo "CI/CD targets:"
	@echo "  ci               - Run full CI pipeline locally"
	@echo "  cd               - Run full CD pipeline locally"
	@echo "  deploy-staging   - Deploy to staging environment"
	@echo "  deploy-production - Deploy to production environment"
	@echo "  release          - Create a release"

# Development
dev: ## Start development environment
	docker-compose -f docker-compose.dev.yml up --build

# Production
build: ## Build production Docker image
	docker-compose build

start: ## Start production environment
	docker-compose up -d

stop: ## Stop all containers
	docker-compose down

restart: ## Restart all containers
	docker-compose restart

logs: ## View container logs
	docker-compose logs -f

clean: ## Remove containers and volumes
	docker-compose down -v --rmi all

# Testing
test: ## Run all tests
	cd frontend && npm run test:run

test:e2e: ## Run E2E tests
	cd frontend && npm run test:e2e

lint: ## Run linter
	cd frontend && npm run lint

typecheck: ## Run type checking
	cd frontend && npm run typecheck

# Docker
docker-build: ## Build Docker image
	docker build -t $(REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG) .

docker-push: ## Push image to GHCR
	docker push $(REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG)

docker-tag: ## Tag image for registry
	docker tag $(REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG) $(REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG)

# Helm
helm-lint: ## Lint Helm chart
	helm lint helm/speedrunner

helm-template: ## Render templates locally
	helm template $(RELEASE_NAME) helm/speedrunner -n $(NAMESPACE)

helm-install: ## Install to cluster
	helm install $(RELEASE_NAME) helm/speedrunner -n $(NAMESPACE) --create-namespace

helm-upgrade: ## Upgrade existing release
	helm upgrade $(RELEASE_NAME) helm/speedrunner -n $(NAMESPACE)

helm-uninstall: ## Remove release
	helm uninstall $(RELEASE_NAME) -n $(NAMESPACE)

helm-status: ## Check release status
	helm status $(RELEASE_NAME) -n $(NAMESPACE)

helm-install-dev: ## Install dev environment
	helm install $(RELEASE_NAME) helm/speedrunner -n $(NAMESPACE) --create-namespace -f helm/speedrunner/values-dev.yaml

helm-install-staging: ## Install staging environment
	helm install $(RELEASE_NAME) helm/speedrunner -n $(NAMESPACE) --create-namespace -f helm/speedrunner/values-staging.yaml

helm-install-prod: ## Install production environment
	helm install $(RELEASE_NAME) helm/speedrunner -n $(NAMESPACE) --create-namespace -f helm/speedrunner/values-prod.yaml

# Kubernetes
k8s-status: ## Get pod/service status
	@echo "=== Pods ==="
	@kubectl get pods -n $(NAMESPACE) -l app.kubernetes.io/instance=$(RELEASE_NAME)
	@echo ""
	@echo "=== Services ==="
	@kubectl get svc -n $(NAMESPACE) -l app.kubernetes.io/instance=$(RELEASE_NAME)
	@echo ""
	@echo "=== Ingress ==="
	@kubectl get ingress -n $(NAMESPACE) -l app.kubernetes.io/instance=$(RELEASE_NAME)
	@echo ""
	@echo "=== HPA ==="
	@kubectl get hpa -n $(NAMESPACE) -l app.kubernetes.io/instance=$(RELEASE_NAME)

k8s-logs: ## Tail app logs
	kubectl logs -l app.kubernetes.io/instance=$(RELEASE_NAME),app.kubernetes.io/component=app -n $(NAMESPACE) -f --tail=100

k8s-port-forward: ## Forward ports for local access
	@echo "Forwarding ports..."
	@echo "  HTTP:    http://localhost:8787"
	@echo "  WebSocket: ws://localhost:8788"
	@echo "  Health:  http://localhost:9090/health"
	@kubectl port-forward svc/$(RELEASE_NAME) 8787:8787 8788:8788 9090:9090 -n $(NAMESPACE)

# CI/CD
ci: lint typecheck test test:e2e helm-lint ## Run full CI pipeline locally
	@echo "✅ CI pipeline passed"

cd: docker-build ## Run full CD pipeline locally
	@echo "✅ CD pipeline passed"

deploy-staging: ## Deploy to staging environment
	@echo "Deploying to staging..."
	@helm upgrade --install $(RELEASE_NAME) helm/speedrunner \
		-n $(NAMESPACE) --create-namespace \
		-f helm/speedrunner/values-staging.yaml \
		--set image.repository=$(REGISTRY)/$(IMAGE_NAME) \
		--set image.tag=$(IMAGE_TAG) \
		--wait --timeout 5m
	@echo "✅ Staging deployment complete"

deploy-production: ## Deploy to production environment
	@echo "Deploying to production..."
	@helm upgrade --install $(RELEASE_NAME) helm/speedrunner \
		-n $(NAMESPACE) --create-namespace \
		-f helm/speedrunner/values-prod.yaml \
		--set image.repository=$(REGISTRY)/$(IMAGE_NAME) \
		--set image.tag=$(IMAGE_TAG) \
		--wait --timeout 10m
	@echo "✅ Production deployment complete"

release: ## Create a release (use: make release VERSION=v1.0.0)
	@if [ -z "$(VERSION)" ]; then echo "Usage: make release VERSION=v1.0.0"; exit 1; fi
	@echo "Creating release $(VERSION)..."
	@git tag -a $(VERSION) -m "Release $(VERSION)"
	@git push origin $(VERSION)
	@echo "✅ Release $(VERSION) created"

# Utilities
shell: ## Open shell in app container
	docker-compose exec app sh

db-shell: ## Open PostgreSQL shell
	docker-compose exec postgres psql -U speedrunner -d speedrunner

redis-shell: ## Open Redis CLI
	docker-compose exec redis redis-cli
