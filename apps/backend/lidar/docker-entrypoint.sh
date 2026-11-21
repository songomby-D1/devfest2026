#!/bin/sh
set -eu

: "${MIGRATION_DATABASE_URL:?MIGRATION_DATABASE_URL is required to apply migrations}"

./node_modules/.bin/prisma migrate deploy
exec env -u MIGRATION_DATABASE_URL node dist/main.js
