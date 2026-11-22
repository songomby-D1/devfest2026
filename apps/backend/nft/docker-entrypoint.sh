#!/bin/sh
# Applies pending migrations with the migration role (D04), then starts the
# service without that role's credentials in its environment.
set -eu

: "${MIGRATION_DATABASE_URL:?MIGRATION_DATABASE_URL is required to apply migrations}"

./node_modules/.bin/prisma migrate deploy
exec env -u MIGRATION_DATABASE_URL "$@"
