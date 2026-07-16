#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "============================================"
echo " MarathonRunner - Local K8s Cluster Setup"
echo "============================================"

# Check dependencies
for cmd in minikube kubectl docker; do
    if ! command -v $cmd &>/dev/null; then
        echo "ERROR: $cmd is not installed"
        exit 1
    fi
done

# 1. Start minikube
echo ""
echo "[1/6] Starting minikube..."
if minikube status | grep -q "Running"; then
    echo "  minikube is already running"
else
    minikube start \
        --cpus=4 \
        --memory=8192 \
        --disk-size=40g \
        --driver=docker \
        --extra-config=apiserver.enable-admission-plugins="LimitRanger,NamespaceExists,NamespaceLifecycle,ResourceQuota,ServiceAccount,DefaultStorageClass,MutatingAdmissionWebhook"
    echo "  minikube started"
fi

# 2. Enable addons
echo ""
echo "[2/6] Enabling addons..."
minikube addons enable ingress 2>/dev/null || true
minikube addons enable metrics-server 2>/dev/null || true
minikube addons enable storage-provisioner 2>/dev/null || true
echo "  addons enabled"

# 3. Install Helm if missing
echo ""
echo "[3/6] Checking Helm..."
if ! command -v helm &>/dev/null; then
    echo "  Installing Helm..."
    curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
else
    echo "  Helm already installed"
fi

# 4. Create namespaces
echo ""
echo "[4/6] Creating namespaces..."
kubectl create namespace marathonrunner-system --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace marathonrunner-execution --dry-run=client -o yaml | kubectl apply -f -
kubectl create namespace marathonrunner-observability --dry-run=client -o yaml | kubectl apply -f -
echo "  namespaces created"

# 5. Build images into minikube Docker
echo ""
echo "[5/6] Building images into minikube Docker..."
eval $(minikube docker-env)

echo "  Building Go backend..."
cd "$PROJECT_ROOT"
docker build -t speedrunner-backend:latest -f backend/Dockerfile backend/ 2>/dev/null || \
    echo "  WARNING: backend build skipped (Go not available in minikube env)"

echo "  Building JMeter image..."
docker build -t speedrunner/jmeter:latest -f k8s/jmeter/jmeter-image/Dockerfile k8s/jmeter/jmeter-image/ 2>/dev/null || \
    echo "  WARNING: JMeter build skipped"

# 6. Apply namespaces
echo ""
echo "[6/6] Applying namespace definitions..."
kubectl apply -f "$PROJECT_ROOT/k8s/namespaces.yaml"

echo ""
echo "============================================"
echo " Local K8s Cluster Ready!"
echo "============================================"
echo ""
echo "Cluster info:"
minikube status
echo ""
echo "Namespaces:"
kubectl get namespaces -l app.kubernetes.io/part-of=speedrunner 2>/dev/null || true
echo ""
echo "Next steps:"
echo "  1. Deploy platform:  make k8s-deploy"
echo "  2. Check status:     make k8s-status"
echo "  3. Port forward:     make k8s-port-forward"
echo ""
