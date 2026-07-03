#!/bin/bash
set -euo pipefail

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

# shellcheck disable=SC1091
source "$(dirname "$PROJECT_ROOT")/shared/scripts/load-deploy-phase-timing.sh" "$PROJECT_ROOT" 2>/dev/null \
  || source "$HOME/Documents/Github/shared/scripts/load-deploy-phase-timing.sh" "$PROJECT_ROOT" \
  || { echo "Error: deploy timing library not found" >&2; exit 1; }
deploy_timing_init "$SERVICE_NAME"

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

deploy_timing_phase_start "Build image"
docker build -t "$IMAGE" -t "$IMAGE_LATEST" "$PROJECT_ROOT"
deploy_timing_phase_end "Build image"

deploy_timing_phase_start "Push image"
docker push "$IMAGE"
docker push "$IMAGE_LATEST"
deploy_timing_phase_end "Push image"

deploy_timing_phase_start "Apply Kubernetes manifests"
for manifest in configmap.yaml external-secret.yaml deployment.yaml service.yaml ingress.yaml order-affinity-backfill-cronjob.yaml order-affinity-cronjob.yaml; do
  if [ -f "$K8S_DIR/$manifest" ]; then
    kubectl apply -f "$K8S_DIR/$manifest" -n "$NAMESPACE"
  fi
done
deploy_timing_phase_end "Apply Kubernetes manifests"

deploy_timing_phase_start "Set deployment image"
kubectl set image deployment/"$SERVICE_NAME" app="$IMAGE_LATEST" -n "$NAMESPACE"
deploy_timing_phase_end "Set deployment image"

deploy_timing_phase_start "Wait for rollout"
deploy_timing_k8s_rollout_wait kubectl "$SERVICE_NAME" "$NAMESPACE"
deploy_timing_phase_end "Wait for rollout"

deploy_timing_phase_start "Wait for terminating pods"
MAX_TERMINATING_WAIT_SECONDS=45
CHECK_INTERVAL_SECONDS=5
elapsed=0
while true; do
  TERMINATING_PODS="$(kubectl get pods -n "$NAMESPACE" -l app="$SERVICE_NAME" --no-headers 2>/dev/null | awk '$3=="Terminating"{print $1}')"
  if [ -z "$TERMINATING_PODS" ]; then
    break
  fi
  if [ "$elapsed" -ge "$MAX_TERMINATING_WAIT_SECONDS" ]; then
    for pod in $TERMINATING_PODS; do
      kubectl delete pod -n "$NAMESPACE" "$pod" --grace-period=0 --force || true
    done
    break
  fi
  sleep "$CHECK_INTERVAL_SECONDS"
  elapsed=$((elapsed + CHECK_INTERVAL_SECONDS))
done
deploy_timing_phase_end "Wait for terminating pods"

deploy_timing_finish_success "Marketing Microservice"
echo "Image:    ${IMAGE}"
DEPLOY_TIMING_FINISHED=1
exit 0
