#!/usr/bin/env bash
# One-time (idempotent) GCP setup: APIs, image registry, runtime service
# account and secrets. Re-running it is safe; existing secrets are kept.
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/gcp-common.sh

read -rp "Set up project '$PROJECT_ID' as $ACCOUNT? [y/N] " answer
[[ "$answer" == [yY] ]] || exit 1

echo "→ Enabling APIs (takes a minute the first time)"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com

echo "→ Artifact Registry repository"
gcloud artifacts repositories describe "$REPOSITORY" --location "$REGION" >/dev/null 2>&1 ||
  gcloud artifacts repositories create "$REPOSITORY" --location "$REGION" \
    --repository-format docker --description "Keikkone images"

echo "→ Runtime service account (the identity the API and migration job run as)"
gcloud iam service-accounts describe "$RUNTIME_SA" >/dev/null 2>&1 ||
  gcloud iam service-accounts create "$RUNTIME_SA_NAME" --display-name "Keikkone runtime"

# Creates a secret from stdin unless it already exists, then lets the runtime
# service account read it. Least privilege: access per secret, not project-wide.
ensure_secret() {
  local name=$1 value=$2
  if gcloud secrets describe "$name" >/dev/null 2>&1; then
    echo "  $name exists, keeping it (add a version to rotate: gcloud secrets versions add $name --data-file=-)"
  else
    printf '%s' "$value" | gcloud secrets create "$name" --replication-policy automatic --data-file=-
  fi
  gcloud secrets add-iam-policy-binding "$name" --member "serviceAccount:$RUNTIME_SA" \
    --role roles/secretmanager.secretAccessor --condition None >/dev/null
}

echo "→ Secrets"
prompt_secret() {
  local name=$1 label=$2 value=""
  if ! gcloud secrets describe "$name" >/dev/null 2>&1; then
    read -rsp "$label: " value
    echo
  fi
  ensure_secret "$name" "$value"
}
prompt_secret "$SECRET_DATABASE_URL" "Neon POOLED connection string (host contains -pooler)"
prompt_secret "$SECRET_DIRECT_URL" "Neon DIRECT connection string (host without -pooler)"
ensure_secret "$SECRET_JWT" "$(openssl rand -base64 48)"

echo "✓ Setup done. Next: scripts/deploy.sh"
