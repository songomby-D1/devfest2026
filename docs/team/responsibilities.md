# Team responsibilities

Use this page to identify owners and coordinate handoffs before implementation.

| Owner | Assignment | AI tool |
|---|---|---|
| endy-rkt | [CONFIRMED] Gateway, MVP, system-wide architecture overview and shared local infrastructure, including SeaweedFS setup | Codex only |
| papangoo | [CONFIRMED] Content management, uploads, content and description verification | Claude |
| salandri-42 | [CONFIRMED] NFT | Claude |
| Sesedra | [CONFIRMED] Frontend implementation, UI/UX design and README design contribution | Claude |
| shidoAdr | [CONFIRMED] Auth, LiDAR scanning and 3D | Claude |

## Task ownership

[CONFIRMED] Each owner can edit, add, split and reprioritize their own backlog items and set acceptance criteria within the agreed MVP. Owners make technical decisions within their area and record decisions that affect delivery in the task or linked documentation. When a change affects another owner, agree on the dependency or contract together. Bring changes to the MVP or system-wide architecture to endy-rkt.

[CONFIRMED] Each app or service owner takes it from initialization through local integration. The owner chooses the internal design and service-local dependencies, writes its unit and integration tests, maintains its Dockerfile and updates its own entry in root `docker-compose.yml`. The owner documents its API or client integration and coordinates contract changes with affected owners. Design-only work has no app tests or container deliverables.

[CONFIRMED] Owners of stateful services also own their PostgreSQL database or schema within the shared instance, its access requirements, Prisma models, migrations and test fixtures. Agree on provisioning and grants with the shared infrastructure owner. Scope migrations to the owning service. [Data ownership](../architecture/data-storage.md#postgresql-isolation)

[CONFIRMED] Owners can deliver work inside these boundaries without individual approval from endy-rkt. Coordinate shared Compose edits and cross-service changes with affected owners. Escalate changes to the MVP, shared architecture or repository-wide rules using the [decision register](../decisions/project-decisions.md).

| Timing | Handoff |
|---|---|
| Before protected flows | shidoAdr and endy-rkt agree on identity, claims and session behavior with affected service owners. |
| Before contract-dependent prototypes | papangoo gives salandri-42 and shidoAdr stable content identity and publication semantics. shidoAdr gives papangoo the 3D asset association and readiness semantics. |
| Before frontend integration | endy-rkt and Sesedra agree on the gateway contract, media behavior, status labels and errors. |
| Before demo rehearsal | salandri-42 brings wallet and mint readiness, shidoAdr brings a tested asset and fallback, and papangoo brings reviewed demo content. Owners verify their handoffs against the MVP. |

[RECOMMENDED] Sesedra's mockups, papangoo's content planning, salandri-42's ecosystem comparison and shidoAdr's device and asset check can proceed in parallel within their agreed scope.

## Shared local infrastructure

[CONFIRMED] **D02.** endy-rkt owns [INFRA-01](../product/task.md#endy-rkt-shared-local-infrastructure), the shared PostgreSQL and SeaweedFS setup that service owners connect to during development.

| Shared infrastructure owner | App and service owners |
|---|---|
| Maintain one shared PostgreSQL service and SeaweedFS in root Compose. Provide persistent volumes, health checks and agreed local networking. | Maintain their Dockerfile, their own Compose entry, application configuration and startup checks. |
| Provision service-scoped PostgreSQL databases or schemas, roles and grants under D04. Provision agreed SeaweedFS buckets or access scopes. | Own their PostgreSQL objects, Prisma schema and migrations. Specify access needs and maintain test data and integration tests. |
| Document local startup, safe environment-variable examples and how to verify the shared dependencies from a clean checkout. | Supply their environment-variable requirements and verify their service against the shared dependencies. |

[RECOMMENDED] Start with PostgreSQL and object storage. Keep provisioning repeatable so a teammate can start both with Compose and run only the apps they need. [Data and storage](../architecture/data-storage.md)
