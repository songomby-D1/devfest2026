# Team responsibilities

Use this page to identify owners and coordinate handoffs before implementation.

| Owner | Assignment |
|---|---|
| endy-rkt | [CONFIRMED] Define the MVP and system-wide architecture overview. Align cross-team work with those goals. |
| papangoo | [CONFIRMED] Content management, uploads, content and description verification |
| salandri-42 | [CONFIRMED] NFT |
| Sesedra | [CONFIRMED] UI/UX mockups and design, README contribution |
| shidoAdr | [CONFIRMED] LiDAR scanning and 3D |

## Task ownership

[CONFIRMED] Each owner can edit, add, split and reprioritize their own backlog items and set acceptance criteria within the agreed MVP. Owners make technical decisions within their area and record decisions that affect delivery in the task or linked documentation. When a change affects another owner, agree on the dependency or contract together. Bring changes to the MVP or system-wide architecture to endy-rkt.

[CONFIRMED] Each app or service owner writes and maintains its unit and integration tests, writes its Dockerfile, and adds or updates its own entry in root `docker-compose.yml`. Include the relevant tests and container changes in the owner's PR and coordinate concurrent Compose edits. All stateful services use Prisma and the shared PostgreSQL instance. Design-only work has no app tests or container deliverables. [Quality gates](../development/quality-gates.md#testing-and-service-definition-of-done) · [Docker convention](../architecture/services.md#dockerfile-placement) · [Data ownership](../architecture/data-storage.md#postgresql-isolation)

[DECISION REQUIRED: endy-rkt] **D02 Delivery owners.** Name the Auth, gateway, and frontend owners and agree who maintains shared local infrastructure. Sesedra owns design and the README design contribution. The frontend implementation and its container need an explicit owner.

| Timing | Handoff |
|---|---|
| Before protected flows | Auth and gateway owners agree on identity, claims and session behavior with affected service owners. |
| Before contract-dependent prototypes | papangoo gives salandri-42 and shidoAdr stable content identity and publication semantics. shidoAdr gives papangoo the 3D asset association and readiness semantics. |
| Before frontend integration | Gateway and frontend owners agree on the API contract, media behavior, status labels and errors, with input from Sesedra. |
| Before demo rehearsal | salandri-42 brings wallet and mint readiness, shidoAdr brings a tested asset and fallback, and papangoo brings reviewed demo content. Owners verify their handoffs against the MVP. |

[RECOMMENDED] Sesedra's mockups, papangoo's content planning, salandri-42's ecosystem comparison and shidoAdr's device and asset check can proceed in parallel within their agreed scope.
