# Data and storage

This page compares PostgreSQL ownership and S3-compatible options, and defines proposed media handling and backup expectations.

[CONFIRMED] Use one shared PostgreSQL instance per environment, Prisma as the ORM for services that persist data, and S3-compatible object storage. [NOT IMPLEMENTED] No databases, Prisma setup, buckets, migration flow or storage policies exist yet.

## PostgreSQL isolation

[CONFIRMED] All stateful services connect to the same PostgreSQL instance. Each service owner defines and maintains its own database objects, Prisma schema and migrations. The owner specifies access needs and coordinates provisioning with endy-rkt, who maintains the shared instance. Services without persistence, including the proposed gateway and the frontend, need no database or Prisma client.

[CONFIRMED] **D04 Isolation within the shared instance.** Use a separate database and separate migration and runtime roles scoped to each stateful service. Scope runtime grants to what the service needs. Owners agree provisioning and verify isolation in INFRA-01. [D04 decision](../decisions/project-decisions.md#d04-postgresql-isolation)

[RECOMMENDED] Enforce ownership with database grants. Services access other services' data through contracted APIs and hold cross-service references as opaque IDs. Use no cross-service foreign keys or direct table access. Transactions end at a service boundary. For an external call that can outlive a local write, persist enough state to retry safely and reconcile later. Define behavior for a missing or unpublished referenced item.

## S3-compatible option

[CONFIRMED] Use SeaweedFS for local S3-compatible object storage. endy-rkt owns its setup in shared Compose. [NOT IMPLEMENTED] Validate put/get, private access, ranged reads, restart persistence and deletion with representative video and 3D assets.

[CONDITIONAL] **D05 Media delivery.** Start with gateway-mediated access once representative video and 3D assets pass the SeaweedFS access, range and persistence checks in endy-rkt-03. [D05 decision](../decisions/project-decisions.md#d05-media-delivery)

| Option | MVP assessment |
|---|---|
| SeaweedFS | Correct product spelling, S3 support, Apache licensing and single-node quick start verified from upstream with high confidence. Project-specific compatibility still needs the spike. [SeaweedFS upstream](https://github.com/seaweedfs/seaweedfs) |
| MinIO Community Edition | Upstream is archived and describes source-only distribution under AGPLv3. That adds maintenance and distribution considerations for a new demo dependency. [MinIO upstream](https://github.com/minio/minio) |
| Garage | Alternative for local self-hosting. Upstream documents single-node setup and operation-specific S3 compatibility. [Garage quick start](https://github.com/deuxfleurs-org/garage/blob/main-v2/doc/book/quick-start/_index.md) · [Garage S3 compatibility](https://github.com/deuxfleurs-org/garage/blob/main-v2/doc/book/reference-manual/s3-compatibility.md) |
| Managed Amazon S3 | Future migration target or explicit alternative if an account, budget and reliable network are available. Requires credentials, network access and environment-specific endpoint settings. [Amazon S3 documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html) |

## Media flow and security

[RECOMMENDED] Keep bytes in object storage. Store object keys, provenance references, ownership, visibility, type, size, review status and asset readiness in the owning PostgreSQL database. Content writes image/video objects and LiDAR writes 3D objects under separately scoped credentials. The browser uploads and downloads through gateway-mediated, streamed requests for the MVP. Keep storage private and authorize reads according to the current item or asset visibility.

[RECOMMENDED] Apply upload size limits and format allowlists, inspect file signatures, generate storage names and treat user filenames as display metadata. Enforce authorization before streaming or publishing content. Keep uploads private until they pass the approved review and validation policies. Evaluate malware scanning before permitting broadly untrusted uploads and assess malicious 3D payloads and external asset references. Use small, rights-cleared demo videos and optimized, self-contained 3D files. Validate video range requests and failure behavior without buffering entire objects.

[RECOMMENDED] Consider direct, short-lived signed uploads or reads and multipart transfers only if measured asset sizes justify it and endy-rkt confirms how that delivery fits the gateway-only rule. A separately published NFT metadata snapshot must resolve from the relevant demo clients and exclude private content. [Amazon S3 presigned uploads](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)

## Backup and migration

[NOT IMPLEMENTED] [RECOMMENDED] Start with persistent volumes, a reproducible demo dataset, and a matched local PostgreSQL dump plus an object copy or manifest. Verify one restore before rehearsal. Later, copy objects while preserving keys and integrity, restore the service databases, switch the S3 endpoint and retest access. Define schedules, retention, encryption and restore drills before cloud operation.
