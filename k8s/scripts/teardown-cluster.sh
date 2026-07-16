#!/usr/bin/env bash
set -euo pipefail

echo "============================================"
echo " MarathonRunner - Cluster Teardown"
echo "============================================"

echo ""
echo "This will delete the minikube cluster and all resources."
read -p "Are you sure? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "[1/2] Deleting minikube cluster..."
minikube delete --all --purge 2>/dev/null || true

echo ""
echo "[2/2] Cleaning up local Docker images..."
docker rmi speedrunner-backend:latest 2>/dev/null || true
docker rmi speedrunner/jmeter:latest 2>/dev/null || true

echo ""
echo "============================================"
echo " Teardown Complete"
echo "============================================"
