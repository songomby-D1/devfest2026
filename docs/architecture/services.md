# Service boundaries and contracts

Use this page to agree on service responsibilities, boundaries, per-service Dockerfile placement and integration handoffs before writing API contracts.

[NOT IMPLEMENTED] The capabilities below are **proposed, not a contract**. Service ownership of credentials, resource authorization and file metadata is independent of the public gateway.

| Boundary and owner | Responsibility and owned data | Dependencies and proposed capabilities | Exclusions, async needs and tests |
|---|---|---|---|
| Auth · shidoAdr | Accounts, credentials, sessions and assigned permissions | PostgreSQL. Register, sign in, end sessions and resolve identity for gateway calls | Leaves content and NFT rules with their owners. No async need foreseen. Test credential handling, session invalidation and denied access. |
| Content & Verification · papangoo | Items, authorship assertions, descriptions, publication state, media references and review evidence | Auth context and storage. Browse published items, submit media, manage owned content and record human reviews | Leaves identity, minting and 3D processing with their owners. Media analysis may need async if approved. Test uploads, ownership, independent verification and publication. |
| NFT · salandri-42 | Content-to-token association, approved token metadata snapshot/reference, mint state and chain references | Auth context, Content publication and an approved blockchain/wallet path. Initiate minting and read confirmation/provenance status | Leaves cultural validation with Content. External confirmation may outlast a request. Test duplicate prevention, failure handling and reconciliation. |
| LiDAR · shidoAdr | 3D asset records, object keys, item references, readiness and processing state | Auth context, Content association and storage. Associate and expose display metadata for an approved asset | Leaves the cultural item and provenance with their owners. Offline processing first. Test invalid associations, access policy and missing assets. |
| Gateway · endy-rkt | Routing and edge policy. Owns no canonical product data | Auth and the four service capabilities depicted in the [diagram](overview.md). Expose the frontend-facing API and approved media access | Leaves business logic and data persistence with services. No long-running jobs. Test claim propagation, error mapping and upstream failure behavior. |

[RECOMMENDED] **NFT and Content handoff.** Agree on an opaque content ID, publication eligibility, the attribution and evidence fields NFT may copy into its public snapshot, and the behavior when an item is edited or unpublished. Existing token metadata should describe the approved snapshot and the scope of the recorded event.

[RECOMMENDED] **LiDAR and Content handoff.** Confirm the content ID with Content before association. LiDAR owns asset status. The gateway can look up a published item's 3D association through LiDAR using its content ID. Keep credentials and object keys internal and return only approved delivery references.

## Dockerfile placement

[CONFIRMED] Each app or service owner writes its Dockerfile in its own directory and adds its entry to root `docker-compose.yml`. Use `apps/frontend/Dockerfile` and one `apps/backend/<service>/Dockerfile` each for gateway, Auth, Content & Verification, NFT and LiDAR. Coordinate Compose edits and verify the service starts with its declared dependencies once Docker setup is available. Reserve `infrastructure/docker/` for non-service configuration. [Ownership rules](../team/responsibilities.md#task-ownership)

## Contracts and shared package

[DECISION REQUIRED: endy-rkt] **D14 Contract and shared-code policy.** [CONFIRMED] Service owners write their contracts and agree changes with affected consumers. endy-rkt sets system-wide constraints in the overview. [RECOMMENDED] Keep per-service and gateway OpenAPI documents in [docs/api](../api/) once agreed. Use versioned, backward-compatible changes where possible and contract checks at integration boundaries. Allow transport types or generated contract types and a stable error shape in `packages/shared` only when consumers actually use them. Keep business rules, persistence models, NestJS modules and service clients with service owners. A shared package that forces coordinated releases would undermine independent deployability.

[CONFIRMED] If an application or service imports `packages/shared` from the repository, its Docker build context must be the repository root. Its Dockerfile stays in its own directory. A future root Compose entry could use `build: { context: ., dockerfile: apps/backend/<service>/Dockerfile }`. Under D14, weigh reuse against the larger source context and the CI rebuilds required for every dependent application. An application that needs no files outside its directory can use that directory as its build context. [Compose build path resolution](https://docs.docker.com/reference/compose-file/build/)

[RECOMMENDED] Agree on stable error codes, a safe message and a request ID across the gateway API. Use status codes consistent with the failure and map upstream timeouts and unavailable services explicitly. Avoid leaking internal exception details.
