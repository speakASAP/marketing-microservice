#!/bin/bash
set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
K8S_DIR="$PROJECT_ROOT/k8s"
NAMESPACE="${NAMESPACE:-statex-apps}"
SERVICE_NAME="marketing-microservice"
REGISTRY="localhost:5000"
DEFAULT_TAG="$(cd "$PROJECT_ROOT" && git rev-parse --short HEAD 2>/dev/null || echo "build-$(date -u +%Y%m%d%H%M%S)")"
IMAGE_TAG="${1:-$DEFAULT_TAG}"
IMAGE="${REGISTRY}/${SERVICE_NAME}:${IMAGE_TAG}"
IMAGE_LATEST="${REGISTRY}/${SERVICE_NAME}:latest"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║             Deploy: Marketing Microservice             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"

if [ ! -d "$K8S_DIR" ]; then
  echo "Missing k8s directory: $K8S_DIR"
  exit 1
fi

if [ ! -f "$PROJECT_ROOT/Dockerfile" ]; then
  echo "Missing Dockerfile in $PROJECT_ROOT"
  exit 1
fi

echo "[$(date -Iseconds)] Building image: $IMAGE"
docker build -t "$IMAGE" -t "$IMAGE_LATEST" "$PROJECT_ROOT"
echo "[$(date -Iseconds)] Pushing image: $IMAGE"
docker push "$IMAGE"
docker push "$IMAGE_LATEST"

for manifest in configmap.yaml external-secret.yaml deployment.yaml service.yaml ingress.yaml; do
  if [ -f "$K8S_DIR/$manifest" ]; then
    kubectl apply -f "$K8S_DIR/$manifest" -n "$NAMESPACE"
  fi
done

echo "[$(date -Iseconds)] Updating K8s deployment: $SERVICE_NAME"
kubectl set image deployment/"$SERVICE_NAME" app="$IMAGE_LATEST" -n "$NAMESPACE"
echo "[$(date -Iseconds)] Waiting for rollout: $SERVICE_NAME"
if ! kubectl rollout status deployment/"$SERVICE_NAME" -n "$NAMESPACE" --timeout=120s; then
  echo "[$(date -Iseconds)] Rollout timeout. Checking terminating pods for $SERVICE_NAME"
  kubectl get pods -n "$NAMESPACE" -l app="$SERVICE_NAME" -o wide || true
  TERMINATING_PODS="$(kubectl get pods -n "$NAMESPACE" -l app="$SERVICE_NAME" --no-headers 2>/dev/null | awk '$3=="Terminating"{print $1}')"
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
echo "[$(date -Iseconds)] Verifying no old pods are stuck in Terminating"
MAX_TERMINATING_WAIT_SECONDS=45
CHECK_INTERVAL_SECONDS=5
elapsed=0
while true; do
  TERMINATING_PODS="$(kubectl get pods -n "$NAMESPACE" -l app="$SERVICE_NAME" --no-headers 2>/dev/null | awk '$3=="Terminating"{print $1}')"
  if [ -z "$TERMINATING_PODS" ]; then
    break
  fi

  if [ "$elapsed" -ge "$MAX_TERMINATING_WAIT_SECONDS" ]; then
    echo "[$(date -Iseconds)] Terminating pods exceeded ${MAX_TERMINATING_WAIT_SECONDS}s, forcing deletion"
    kubectl get pods -n "$NAMESPACE" -l app="$SERVICE_NAME" -o wide || true
    for pod in $TERMINATING_PODS; do
      echo "[$(date -Iseconds)] Force delete after wait: $pod"
      kubectl delete pod -n "$NAMESPACE" "$pod" --grace-period=0 --force || true
    done
    break
  fi

  echo "[$(date -Iseconds)] Waiting for terminating pods to exit (${elapsed}s/${MAX_TERMINATING_WAIT_SECONDS}s)"
  sleep "$CHECK_INTERVAL_SECONDS"
  elapsed=$((elapsed + CHECK_INTERVAL_SECONDS))
done

echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════════╗"
echo "║    ✅ Marketing Microservice Deployment successful!    ║"
echo "╚════════════════════════════════════════════════════════╝"
echo "Image:    ${IMAGE}"
echo "Namespace: ${NAMESPACE}"
echo "Pods:     $(kubectl get pods -n ${NAMESPACE} -l app=${SERVICE_NAME} --no-headers | wc -l) running"
echo -e "${NC}"
