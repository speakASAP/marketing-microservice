#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
K8S_DIR="$PROJECT_ROOT/k8s"
NAMESPACE="${NAMESPACE:-statex-apps}"
SERVICE_NAME="marketing-microservice"
IMAGE_NAME="${IMAGE_NAME:-localhost:5000/marketing-microservice:latest}"

if [ ! -d "$K8S_DIR" ]; then
  echo "Missing k8s directory: $K8S_DIR"
  exit 1
fi

if [ ! -f "$PROJECT_ROOT/Dockerfile" ]; then
  echo "Missing Dockerfile in $PROJECT_ROOT"
  exit 1
fi

echo "[$(date -Iseconds)] Building image: $IMAGE_NAME"
docker build -t "$IMAGE_NAME" "$PROJECT_ROOT"
echo "[$(date -Iseconds)] Pushing image: $IMAGE_NAME"
docker push "$IMAGE_NAME"

for manifest in configmap.yaml external-secret.yaml deployment.yaml service.yaml ingress.yaml; do
  if [ -f "$K8S_DIR/$manifest" ]; then
    kubectl apply -f "$K8S_DIR/$manifest" -n "$NAMESPACE"
  fi
done

echo "[$(date -Iseconds)] Restarting deployment: $SERVICE_NAME"
kubectl rollout restart deployment/"$SERVICE_NAME" -n "$NAMESPACE"
echo "[$(date -Iseconds)] Waiting for rollout: $SERVICE_NAME"
if ! kubectl rollout status deployment/"$SERVICE_NAME" -n "$NAMESPACE" --timeout=120s; then
  echo "[$(date -Iseconds)] Rollout timeout. Checking terminating pods for $SERVICE_NAME"
  kubectl get pods -n "$NAMESPACE" -l app="$SERVICE_NAME" -o wide || true
  TERMINATING_PODS="$(kubectl get pods -n "$NAMESPACE" -l app="$SERVICE_NAME" --no-headers 2>/dev/null | awk '$3==\"Terminating\"{print $1}')"
  if [ -n "$TERMINATING_PODS" ]; then
    echo "[$(date -Iseconds)] Force deleting stuck terminating pods"
    for pod in $TERMINATING_PODS; do
      echo "[$(date -Iseconds)] Force delete: $pod"
      kubectl delete pod -n "$NAMESPACE" "$pod" --grace-period=0 --force || true
    done
  fi
  echo "[$(date -Iseconds)] Re-checking rollout after cleanup"
  kubectl rollout status deployment/"$SERVICE_NAME" -n "$NAMESPACE" --timeout=120s
fi
echo "[$(date -Iseconds)] Pod status:"
kubectl get pods -n "$NAMESPACE" -l app="$SERVICE_NAME"
