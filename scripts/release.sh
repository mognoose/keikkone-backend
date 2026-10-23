#!/usr/bin/env bash
# Migrate + deploy an image that is already in Artifact Registry. Shared by the
# GitHub Actions workflow and scripts/deploy.sh so both deploy identically.
#   scripts/release.sh <image>
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/gcp-common.sh
IMAGE=${1:?usage: scripts/release.sh <image>}

# Migrations run as a one-off Cloud Run Job from the same image, before the new
# code goes live. If they fail, this script stops and the old revision keeps serving.
echo "→ Applying migrations with $IMAGE"
gcloud run jobs deploy "$MIGRATE_JOB" \
  --project "$PROJECT_ID" \
  --image "$IMAGE" \
  --region "$REGION" \
  --service-account "$RUNTIME_SA" \
  --command npx --args prisma,migrate,deploy \
  --set-secrets "DATABASE_URL=$SECRET_DATABASE_URL:latest,DIRECT_URL=$SECRET_DIRECT_URL:latest" \
  --max-retries 0 \
  --task-timeout 300 \
  --execute-now --wait

echo "→ Deploying $SERVICE"
gcloud run deploy "$SERVICE" \
  --project "$PROJECT_ID" \
  --image "$IMAGE" \
  --region "$REGION" \
  --service-account "$RUNTIME_SA" \
  --allow-unauthenticated \
  --set-secrets "DATABASE_URL=$SECRET_DATABASE_URL:latest,JWT_ACCESS_SECRET=$SECRET_JWT:latest" \
  --set-env-vars "^|^TRUST_PROXY_HOPS=1|SWAGGER_ENABLED=${SWAGGER_ENABLED:-true}|CORS_ORIGINS=${CORS_ORIGINS:-*}" \
  --min-instances 0 \
  --max-instances 3 \
  --cpu 1 --memory 512Mi \
  --cpu-boost

URL=$(gcloud run services describe "$SERVICE" --project "$PROJECT_ID" --region "$REGION" --format 'value(status.url)')
echo "→ Health check"
curl -fsS --retry 3 --retry-delay 5 "$URL/health" && echo
echo "✓ Live at $URL  (docs: $URL/docs)"
