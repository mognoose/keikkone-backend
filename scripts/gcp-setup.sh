#!/usr/bin/env bash
# One-time (idempotent) GCP setup: APIs, image registry, service accounts,
# secrets and keyless GitHub Actions access. Safe to re-run.
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/gcp-common.sh

read -rp "Set up project '$PROJECT_ID' as $ACCOUNT? [y/N] " answer
[[ "$answer" == [yY] ]] || exit 1
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format 'value(projectNumber)')

echo "→ Enabling APIs (takes a minute the first time)"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com iamcredentials.googleapis.com \
  cloudbuild.googleapis.com # Cloud Build is only used by the manual scripts/deploy.sh

echo "→ Artifact Registry repository"
gcloud artifacts repositories describe "$REPOSITORY" --location "$REGION" >/dev/null 2>&1 ||
  gcloud artifacts repositories create "$REPOSITORY" --location "$REGION" \
    --repository-format docker --description "Keikkone images"

echo "→ Service accounts"
gcloud iam service-accounts describe "$RUNTIME_SA" >/dev/null 2>&1 ||
  gcloud iam service-accounts create "$RUNTIME_SA_NAME" --display-name "Keikkone runtime"
gcloud iam service-accounts describe "$DEPLOYER_SA" >/dev/null 2>&1 ||
  gcloud iam service-accounts create "$DEPLOYER_SA_NAME" --display-name "Keikkone deployer (GitHub Actions)"

# Creates a secret from stdin unless it already exists, then lets the runtime
# service account (only) read it.
ensure_secret() {
  local name=$1 value=$2
  if gcloud secrets describe "$name" >/dev/null 2>&1; then
    echo "  $name exists, keeping it"
  else
    printf '%s' "$value" | gcloud secrets create "$name" --replication-policy automatic --data-file=-
  fi
  gcloud secrets add-iam-policy-binding "$name" --member "serviceAccount:$RUNTIME_SA" \
    --role roles/secretmanager.secretAccessor --condition None >/dev/null
}
prompt_secret() {
  local name=$1 label=$2 value=""
  if ! gcloud secrets describe "$name" >/dev/null 2>&1; then
    read -rsp "$label: " value
    echo
  fi
  ensure_secret "$name" "$value"
}

echo "→ Secrets"
prompt_secret "$SECRET_DATABASE_URL" "Neon POOLED connection string (host contains -pooler)"
prompt_secret "$SECRET_DIRECT_URL" "Neon DIRECT connection string (host without -pooler)"
ensure_secret "$SECRET_JWT" "$(openssl rand -base64 48)"

echo "→ Deployer permissions (no secret access: Cloud Run reads secrets as the runtime account)"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:$DEPLOYER_SA" \
  --role roles/run.admin --condition None >/dev/null
gcloud artifacts repositories add-iam-policy-binding "$REPOSITORY" --location "$REGION" \
  --member "serviceAccount:$DEPLOYER_SA" --role roles/artifactregistry.writer >/dev/null
# "Act as" the runtime account, which deploying a service that runs as it requires.
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member "serviceAccount:$DEPLOYER_SA" --role roles/iam.serviceAccountUser >/dev/null

echo "→ Workload Identity Federation: let GitHub Actions log in without a key"
gcloud iam workload-identity-pools describe "$WIF_POOL" --location global >/dev/null 2>&1 ||
  gcloud iam workload-identity-pools create "$WIF_POOL" --location global \
    --display-name "GitHub Actions"
# Only tokens from this repository's main branch are accepted, so workflows
# on pull requests or forks can never obtain deploy credentials.
gcloud iam workload-identity-pools providers describe "$WIF_PROVIDER" --location global \
  --workload-identity-pool "$WIF_POOL" >/dev/null 2>&1 ||
  gcloud iam workload-identity-pools providers create-oidc "$WIF_PROVIDER" --location global \
    --workload-identity-pool "$WIF_POOL" \
    --display-name "$GITHUB_REPO" \
    --issuer-uri "https://token.actions.githubusercontent.com" \
    --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
    --attribute-condition "assertion.repository == '$GITHUB_REPO' && assertion.ref == 'refs/heads/main'"
gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER_SA" \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$WIF_POOL/attribute.repository/$GITHUB_REPO" \
  >/dev/null

cat <<OUT

✓ Setup done. Add these as GitHub repository VARIABLES (not secrets, none of them is sensitive):
  https://github.com/$GITHUB_REPO/settings/variables/actions

  GCP_PROJECT_ID       $PROJECT_ID
  GCP_WIF_PROVIDER     projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$WIF_POOL/providers/$WIF_PROVIDER
  GCP_DEPLOYER_SA      $DEPLOYER_SA

Optional: CORS_ORIGINS (default *), SWAGGER_ENABLED (default true).
Deploys then start on every push to main once tests pass.
OUT
