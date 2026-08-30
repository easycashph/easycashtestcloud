#!/bin/bash
# Mac/Linux counterpart of write-build-info.ps1 - see that file's comment for why this exists.
set -euo pipefail
cd "$(dirname "$0")/.."

commit=$(git rev-parse --short HEAD)
commit_date=$(git log -1 --format=%cI)
commit_message=$(git log -1 --format=%s)
built_at=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

json=$(printf '{"commit":"%s","commitDate":"%s","commitMessage":"%s","builtAt":"%s"}' \
  "$commit" "$commit_date" "${commit_message//\"/\\\"}" "$built_at")

echo "$json" > app/easycashbackend/build-info.json
echo "$json" > app/lmsfrontend/public/build-info.json

echo "build-info.json written: $commit ($commit_date)"
