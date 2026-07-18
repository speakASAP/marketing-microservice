# deploy.config.sh — declaration consumed by shared/scripts/deploy.sh.
# See shared/docs/DEPLOY_STANDARDIZATION_REPORT.md section 6/7 (Phase C) for the design.
# scripts/deploy.sh is still the live, authoritative deploy path.

SERVICE_NAME="marketing-microservice"
PORT="4600"

IMAGES=(
  "marketing-microservice|.||"
)

DEPLOYMENTS=(
  "marketing-microservice|app|marketing-microservice"
)

MANIFESTS=(configmap.yaml external-secret.yaml deployment.yaml service.yaml ingress.yaml order-affinity-backfill-cronjob.yaml order-affinity-cronjob.yaml)
