#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
K8S_DIR="$PROJECT_ROOT/k8s"
NAMESPACE="${NAMESPACE:-statex-apps}"
SERVICE_NAME="marketing-microservice"

if [ ! -d "$K8S_DIR" ]; then
  echo "Missing k8s directory: $K8S_DIR"
  exit 1
fi

for manifest in configmap.yaml external-secret.yaml deployment.yaml service.yaml ingress.yaml; do
  if [ -f "$K8S_DIR/$manifest" ]; then
    kubectl apply -f "$K8S_DIR/$manifest" -n "$NAMESPACE"
  fi
done

kubectl rollout restart deployment/"$SERVICE_NAME" -n "$NAMESPACE"
kubectl rollout status deployment/"$SERVICE_NAME" -n "$NAMESPACE" --timeout=120s
kubectl get pods -n "$NAMESPACE" -l app="$SERVICE_NAME"
