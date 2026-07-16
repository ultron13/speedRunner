#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
NAMESPACE="marathonrunner-system"

echo "============================================"
echo " MarathonRunner - Platform Deployment"
echo "============================================"

# Check minikube is running
if ! minikube status | grep -q "Running"; then
    echo "ERROR: minikube is not running. Run: make k8s-setup"
    exit 1
fi

# 1. Build images
echo ""
echo "[1/3] Building container images..."
eval $(minikube docker-env)

echo "  Building Go backend..."
cd "$PROJECT_ROOT"
docker build -t speedrunner-backend:latest -f backend/Dockerfile backend/ || {
    echo "  WARNING: Backend build failed, using existing image"
}

echo "  Building JMeter image..."
docker build -t speedrunner/jmeter:latest -f k8s/jmeter/jmeter-image/Dockerfile k8s/jmeter/jmeter-image/ || {
    echo "  WARNING: JMeter build failed, using existing image"
}

# 2. Install/upgrade Helm chart
echo ""
echo "[2/3] Deploying Helm chart..."
helm upgrade --install speedrunner "$PROJECT_ROOT/helm/speedrunner" \
    -n "$NAMESPACE" \
    -f "$PROJECT_ROOT/k8s/local-values.yaml" \
    --set image.repository=speedrunner-frontend \
    --set image.tag=latest \
    --wait --timeout 5m || {
    echo "  WARNING: Helm install had issues, checking pods..."
}

# 3. Verify
echo ""
echo "[3/3] Verifying deployment..."
echo ""
echo "Pods in $NAMESPACE:"
kubectl get pods -n "$NAMESPACE" 2>/dev/null || true

echo ""
echo "Services:"
kubectl get svc -n "$NAMESPACE" 2>/dev/null || true

echo ""
echo "Ingress:"
kubectl get ingress -n "$NAMESPACE" 2>/dev/null || true

# Get URLs
FRONTEND_URL=$(minikube service speedrunner -n "$NAMESPACE" --url 2>/dev/null || echo "pending")
BACKEND_URL="http://$(minikube ip):8080"

echo ""
echo "============================================"
echo " Platform Deployed!"
echo "============================================"
echo ""
echo "Access:"
echo "  Frontend:   $FRONTEND_URL"
echo "  Backend:    $BACKEND_URL"
echo "  Dashboard:  minikube dashboard"
echo ""
echo "Commands:"
echo "  make k8s-status       # Check status"
echo "  make k8s-logs         # View logs"
echo "  make k8s-port-forward # Port forward locally"
echo ""
