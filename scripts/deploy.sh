#!/usr/bin/env bash
# Manual fallback for when GitHub Actions can't deploy. Builds the committed
# HEAD with Cloud Build (remote amd64 build), then runs scripts/release.sh.
#   CORS_ORIGINS=https://keikkone.fi scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/gcp-common.sh

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree has uncommitted changes; commit first so the image matches a sha." >&2
  exit 1
fi
IMAGE="$IMAGE_BASE:$(git rev-parse HEAD)"

echo "→ Building $IMAGE with Cloud Build"
gcloud builds submit --tag "$IMAGE" .
scripts/release.sh "$IMAGE"
