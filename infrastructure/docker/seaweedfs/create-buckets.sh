#!/bin/sh
# Creates the private buckets once SeaweedFS is healthy. Safe to run again: existing buckets
# are left untouched.
set -eu

: "${S3_MEDIA_BUCKET:?}" "${S3_MODELS_BUCKET:?}"
master="${SEAWEEDFS_MASTER:-seaweedfs:9333}"

existing="$(echo 's3.bucket.list' | weed shell -master="$master" 2>/dev/null || true)"
for bucket in "$S3_MEDIA_BUCKET" "$S3_MODELS_BUCKET"; do
  if printf '%s\n' "$existing" | grep -Eq "(^|[[:space:]])${bucket}([[:space:]]|$)"; then
    echo "Bucket ${bucket} already exists"
  else
    echo "s3.bucket.create -name ${bucket}" | weed shell -master="$master"
    echo "Created bucket ${bucket}"
  fi
done
