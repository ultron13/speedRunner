# GitHub Secrets Configuration

This document describes the required GitHub secrets for CI/CD pipelines.

## Required Secrets

### Container Registry

| Secret | Description | Example |
|--------|-------------|---------|
| `GITHUB_TOKEN` | Auto-provided by GitHub Actions | (automatic) |

### Kubernetes - Staging

| Secret | Description | Example |
|--------|-------------|---------|
| `KUBE_CONFIG_STAGING` | Base64-encoded kubeconfig for staging cluster | `apiVersion: v1...` |
| `POSTGRES_PASSWORD_STAGING` | PostgreSQL password for staging | `staging-secret-pw` |

### Kubernetes - Production

| Secret | Description | Example |
|--------|-------------|---------|
| `KUBE_CONFIG_PRODUCTION` | Base64-encoded kubeconfig for production cluster | `apiVersion: v1...` |
| `POSTGRES_PASSWORD_PRODUCTION` | PostgreSQL password for production | `prod-secret-pw` |

## Setting Up Secrets

### 1. Generate kubeconfig

```bash
# For staging cluster
kubectl config view --flatten --minify | base64 -w 0

# For production cluster
kubectl config view --flatten --minify --context=production | base64 -w 0
```

### 2. Add secrets via GitHub CLI

```bash
# Staging
gh secret set KUBE_CONFIG_STAGING < staging-kubeconfig.txt
gh secret set POSTGRES_PASSWORD_STAGING -a staging

# Production
gh secret set KUBE_CONFIG_PRODUCTION < production-kubeconfig.txt
gh secret set POSTGRES_PASSWORD_PRODUCTION -a production
```

### 3. Add secrets via GitHub UI

1. Go to repository Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add each secret with the appropriate environment

## Environment Protection Rules

### Staging
- No protection rules (auto-deploy on merge to main)

### Production
- Required reviewers: Add team leads
- Wait timer: 5 minutes (optional)
- Deployment branches: Only `main`

## Setting Up Environments

1. Go to repository Settings → Environments
2. Create "staging" environment
3. Create "production" environment with protection rules
4. Add required reviewers for production deployments
