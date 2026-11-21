#!/bin/sh
# Provisional LiDAR provisioning until INFRA-01 owns the shared instance (D04):
# a dedicated database owned by a migration role, and a runtime role limited to data access.
set -eu

: "${LIDAR_DB_NAME:?}" "${LIDAR_MIGRATION_DB_USER:?}" "${LIDAR_MIGRATION_DB_PASSWORD:?}"
: "${LIDAR_RUNTIME_DB_USER:?}" "${LIDAR_RUNTIME_DB_PASSWORD:?}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v db="$LIDAR_DB_NAME" \
  -v migrator="$LIDAR_MIGRATION_DB_USER" -v migrator_password="$LIDAR_MIGRATION_DB_PASSWORD" \
  -v runtime="$LIDAR_RUNTIME_DB_USER" -v runtime_password="$LIDAR_RUNTIME_DB_PASSWORD" <<'SQL'
CREATE ROLE :"migrator" LOGIN PASSWORD :'migrator_password';
CREATE ROLE :"runtime" LOGIN PASSWORD :'runtime_password';
CREATE DATABASE :"db" OWNER :"migrator";
REVOKE ALL ON DATABASE :"db" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"db" TO :"runtime";
\connect :"db"
GRANT USAGE ON SCHEMA public TO :"runtime";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"runtime";
SQL
