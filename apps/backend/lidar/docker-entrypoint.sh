#!/bin/sh
set -eu

: "${MIGRATION_DATABASE_URL:?MIGRATION_DATABASE_URL is required to apply migrations}"

./node_modules/.bin/prisma migrate deploy
exec node dist/main.js
