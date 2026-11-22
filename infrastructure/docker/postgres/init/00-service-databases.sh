#!/bin/sh
# INFRA-01 (D04): one database per stateful service in the shared instance, owned by a
# migration role, with a runtime role limited to data access. Runs once, on an empty volume.
# A service whose <PREFIX>_DB_NAME is unset is skipped, so owners can add theirs later.
# The postgres entrypoint sources scripts that are not executable, so the work runs in a
# subshell to keep its shell options away from the entrypoint.
(
set -eu

provision() {
  prefix="$1"
  eval "db=\${${prefix}_DB_NAME:-}"
  if [ -z "$db" ]; then
    echo "Skipping ${prefix}: ${prefix}_DB_NAME is not set"
    return 0
  fi
  eval "migrator=\${${prefix}_MIGRATION_DB_USER:?${prefix}_MIGRATION_DB_USER is required}"
  eval "migrator_password=\${${prefix}_MIGRATION_DB_PASSWORD:?${prefix}_MIGRATION_DB_PASSWORD is required}"
  eval "runtime=\${${prefix}_RUNTIME_DB_USER:?${prefix}_RUNTIME_DB_USER is required}"
  eval "runtime_password=\${${prefix}_RUNTIME_DB_PASSWORD:?${prefix}_RUNTIME_DB_PASSWORD is required}"

  echo "Provisioning database ${db} for ${prefix}"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
    -v db="$db" \
    -v migrator="$migrator" -v migrator_password="$migrator_password" \
    -v runtime="$runtime" -v runtime_password="$runtime_password" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'migrator', :'migrator_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'migrator') \gexec
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'runtime', :'runtime_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'runtime') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'db', :'migrator')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db') \gexec
REVOKE ALL ON DATABASE :"db" FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE :"db" TO :"runtime";
\connect :"db"
GRANT USAGE ON SCHEMA public TO :"runtime";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"runtime";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator" IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO :"runtime";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migrator" IN SCHEMA public
  GRANT USAGE ON TYPES TO :"runtime";
SQL
}

for service in AUTH CONTENT NFT LIDAR; do
  provision "$service"
done
)
