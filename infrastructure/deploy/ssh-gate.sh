#!/usr/bin/env bash
# Forced command of the GitHub Actions deploy key. Installed once outside the checkout, so
# a push cannot change it (README.md, "Server bootstrap"):
#   restrict,command="/home/debian/.local/bin/lova-ssh-gate" ssh-ed25519 AAAA... lova-github-actions-deploy
# Accepts only `deploy <40-hex commit>`, checks that commit out in ~/lova and runs
# deploy.sh with the GHCR token that the workflow sends on stdin.
set -euo pipefail

main() {
  local action sha extra
  read -r action sha extra <<<"${SSH_ORIGINAL_COMMAND:-}"
  if [[ $action != deploy || ! $sha =~ ^[0-9a-f]{40}$ || -n ${extra:-} ]]; then
    echo "usage: deploy <40-hex commit>" >&2
    exit 2
  fi

  cd "${LOVA_HOME:-$HOME/lova}"
  git fetch --quiet --depth 1 origin "$sha"
  # Runtime files (.env, apps/backend/nft/.env) are ignored by Git and stay untouched.
  git reset --quiet --hard FETCH_HEAD
  exec bash infrastructure/deploy/deploy.sh "$sha"
}

main "$@"
