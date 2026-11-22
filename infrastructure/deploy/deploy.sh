#!/usr/bin/env bash
# Deploys one commit's images on the VPS. Runs from the server checkout, called by
# ssh-gate.sh with the GHCR token on stdin:  deploy.sh <40-hex commit>
# Pulls lova-*:<commit>, restarts the stack, waits for gateway and web to be healthy,
# and rolls back to the previous tag when they are not. See README.md here.
set -euo pipefail

main() {
  local tag=$1
  [[ $tag =~ ^[0-9a-f]{40}$ ]] || fail "invalid image tag: $tag"

  cd "$(dirname "$0")/../.."
  [[ -f .env ]] || fail "missing .env, see infrastructure/deploy/README.md"

  # One deploy at a time, including manual runs on the server.
  exec 9>"${TMPDIR:-/tmp}/lova-deploy.lock"
  flock -n 9 || fail "another deploy is running"

  local registry previous
  registry=$(env_value LOVA_REGISTRY)
  previous=$(env_value LOVA_IMAGE_TAG)
  [[ -n $registry ]] || fail "LOVA_REGISTRY is not set in .env"

  # The token is read from stdin, never from the command line.
  docker login ghcr.io -u "${registry#ghcr.io/}" --password-stdin >/dev/null
  trap 'docker logout ghcr.io >/dev/null 2>&1 || true' EXIT

  log "pulling $tag"
  LOVA_IMAGE_TAG=$tag docker compose pull --quiet

  set_env LOVA_PREVIOUS_IMAGE_TAG "$previous"
  set_env LOVA_IMAGE_TAG "$tag"

  if start && healthy gateway && healthy web; then
    log "deployed $tag"
    prune_images "$registry" "$tag" "$previous"
    return 0
  fi

  if [[ -n $previous && $previous != "$tag" ]]; then
    log "rolling back to $previous"
    set_env LOVA_IMAGE_TAG "$previous"
    set_env LOVA_PREVIOUS_IMAGE_TAG ""
    start || true
  fi
  docker compose ps
  fail "deploy of $tag failed"
}

start() {
  docker compose up -d --no-build --remove-orphans
}

# Waits up to five minutes for a service's container to report healthy.
healthy() {
  local service=$1 id status
  for _ in $(seq 1 60); do
    id=$(docker compose ps -q "$service")
    status=$(docker inspect --format '{{.State.Health.Status}}' "$id" 2>/dev/null || echo starting)
    case $status in
      healthy) log "$service healthy"; return 0 ;;
      unhealthy) log "$service unhealthy"; docker compose logs --tail 50 "$service"; return 1 ;;
    esac
    sleep 5
  done
  log "$service not healthy after 5 minutes"
  docker compose logs --tail 50 "$service"
  return 1
}

# Keeps only the current and previous LOVA images on disk.
prune_images() {
  local registry=$1 keep1=$2 keep2=$3 ref
  docker image ls --format '{{.Repository}}:{{.Tag}}' | while read -r ref; do
    [[ $ref == "$registry"/lova-*:* ]] || continue
    [[ ${ref##*:} == "$keep1" || ${ref##*:} == "$keep2" ]] && continue
    docker image rm "$ref" >/dev/null 2>&1 || true
  done
}

env_value() {
  grep -E "^$1=" .env | tail -n 1 | cut -d= -f2- || true
}

# Edits .env in place (same file), adding the key when it is missing.
set_env() {
  if grep -qE "^$1=" .env; then
    sed -i "s|^$1=.*|$1=$2|" .env
  else
    printf '%s=%s\n' "$1" "$2" >>.env
  fi
}

log() { printf '[deploy] %s\n' "$*"; }
fail() { printf '[deploy] error: %s\n' "$*" >&2; exit 1; }

main "$@"
