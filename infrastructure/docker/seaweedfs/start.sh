#!/bin/sh
# INFRA-01 (D05): single-node SeaweedFS with a private S3 gateway. Each service gets an
# identity scoped to its own bucket; there is no anonymous identity, so nothing is public.
# The identity file is rendered from the environment so that no secret is committed.
set -eu

: "${S3_MEDIA_BUCKET:?}" "${S3_MODELS_BUCKET:?}"
: "${SEAWEEDFS_ADMIN_ACCESS_KEY:?}" "${SEAWEEDFS_ADMIN_SECRET_KEY:?}"
: "${SEAWEEDFS_CONTENT_ACCESS_KEY:?}" "${SEAWEEDFS_CONTENT_SECRET_KEY:?}"
: "${SEAWEEDFS_LIDAR_ACCESS_KEY:?}" "${SEAWEEDFS_LIDAR_SECRET_KEY:?}"

config=/tmp/lova-s3.json
umask 077
cat > "$config" <<JSON
{
  "identities": [
    {
      "name": "operator",
      "credentials": [{ "accessKey": "${SEAWEEDFS_ADMIN_ACCESS_KEY}", "secretKey": "${SEAWEEDFS_ADMIN_SECRET_KEY}" }],
      "actions": ["Admin", "Read", "List", "Tagging", "Write"]
    },
    {
      "name": "content",
      "credentials": [{ "accessKey": "${SEAWEEDFS_CONTENT_ACCESS_KEY}", "secretKey": "${SEAWEEDFS_CONTENT_SECRET_KEY}" }],
      "actions": ["Read:${S3_MEDIA_BUCKET}", "Write:${S3_MEDIA_BUCKET}", "List:${S3_MEDIA_BUCKET}"]
    },
    {
      "name": "lidar",
      "credentials": [{ "accessKey": "${SEAWEEDFS_LIDAR_ACCESS_KEY}", "secretKey": "${SEAWEEDFS_LIDAR_SECRET_KEY}" }],
      "actions": ["Read:${S3_MODELS_BUCKET}", "Write:${S3_MODELS_BUCKET}", "List:${S3_MODELS_BUCKET}"]
    }
  ]
}
JSON
# The image entrypoint drops root privileges, so the seaweed user must be able to read the file.
chown seaweed:seaweed "$config" 2>/dev/null || true

exec /entrypoint.sh server -ip=seaweedfs -ip.bind=0.0.0.0 -s3 -s3.config="$config"
