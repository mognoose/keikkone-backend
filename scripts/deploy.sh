#!/usr/bin/env bash
# Build → migrate → deploy. Deploys the committed HEAD, tagged with its sha.
#   CORS_ORIGINS=https://keikkone.fi scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/gcp-common.sh

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree has uncommitted changes; commit first so the image matches a sha." >&2
  exit 1
fi
IMAGE="$IMAGE_BASE:$(git rev-parse --short HEAD)"

echo "→ Building $IMAGE with Cloud Build (remote amd64 build, no local Docker needed)"
gcloud builds submit --tag "$IMAGE" .

# Migrations run as a one-off Cloud Run Job from the same image, before the new
# code goes live. If they fail, the deploy stops and the old revision keeps serving.
echo "→ Applying migrations"
gcloud run jobs deploy "$MIGRATE_JOB" \
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

URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --format 'value(status.url)')
echo "→ Health check"
curl -fsS "$URL/health" && echo
echo "✓ Live at $URL  (docs: $URL/docs)"
