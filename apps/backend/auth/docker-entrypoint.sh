#!/bin/sh
# Applies pending migrations with the migration role (D04), then starts the service with the
# runtime role only: the migration URL is removed from the service environment.
set -eu

: "${MIGRATION_DATABASE_URL:?MIGRATION_DATABASE_URL is required to apply migrations}"

PATH="$PWD/node_modules/.bin:/repo/node_modules/.bin:$PATH" prisma migrate deploy
exec env -u MIGRATION_DATABASE_URL node dist/main.js
