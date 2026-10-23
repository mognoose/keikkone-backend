# Shared settings for the GCP scripts. Sourced, not executed.

# All gcloud calls use a dedicated named configuration instead of whatever is
# active, so a personal deploy can never hit a work/client account by accident.
# One-time setup:
#   gcloud config configurations create keikkone
#   gcloud auth login                 # personal Google account
#   gcloud config set project <your-project-id>
export CLOUDSDK_ACTIVE_CONFIG_NAME=keikkone

# Same region as the Neon database (aws-eu-central-1, Frankfurt): every request
# makes several DB round trips, so the app should sit next to the database.
REGION=europe-west3
SERVICE=keikkone-api
MIGRATE_JOB=keikkone-migrate
REPOSITORY=keikkone
RUNTIME_SA_NAME=keikkone-run

SECRET_DATABASE_URL=keikkone-database-url   # Neon pooled URL (app)
SECRET_DIRECT_URL=keikkone-direct-url       # Neon direct URL (migrations)
SECRET_JWT=keikkone-jwt-access-secret

if ! gcloud config configurations describe "$CLOUDSDK_ACTIVE_CONFIG_NAME" >/dev/null 2>&1; then
  echo "gcloud configuration '$CLOUDSDK_ACTIVE_CONFIG_NAME' not found. See scripts/gcp-common.sh." >&2
  exit 1
fi
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
ACCOUNT=$(gcloud config get-value account 2>/dev/null)
if [[ -z "$PROJECT_ID" || -z "$ACCOUNT" ]]; then
  echo "Configuration '$CLOUDSDK_ACTIVE_CONFIG_NAME' needs both an account and a project." >&2
  exit 1
fi
RUNTIME_SA="$RUNTIME_SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"
IMAGE_BASE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/$SERVICE"

echo "gcloud config: $CLOUDSDK_ACTIVE_CONFIG_NAME  account: $ACCOUNT  project: $PROJECT_ID  region: $REGION"
