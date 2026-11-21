# Project backlog

## Purpose

This high-level backlog tracks decisions, foundation work, MVP features and demo preparation.

Each owner can edit, add, split and reprioritize their own tasks within the agreed MVP. See the [ownership rules](../team/responsibilities.md#task-ownership).

References: [MVP](MVP.md), [architecture](../architecture/overview.md), [service contracts](../architecture/services.md), [data and storage](../architecture/data-storage.md), [owners](../team/responsibilities.md), [agent workflow](../agents/workflow.md), [development](../development/workflow.md), and [quality gates](../development/quality-gates.md).

## Legend

- Priority: `P0` blocks the demo or other tasks, `P1` is MVP required, `P2` is nice to have or deferred.
- Status: `Backlog` · `Groomed` · `In progress` · `Review` · `Done`.
- `[DECISION REQUIRED: owner]` marks work blocked by the named owner's decision. `D` numbers identify decisions across the planning docs. A blank dependency cell means no prerequisite is listed.

## Definition of Ready

The owner completes this checklist and then moves the item to `Groomed`.

- [ ] Write acceptance criteria.
- [ ] Identify the services and files touched.
- [ ] Agree the API contract with affected owners for cross-service work.
- [ ] Confirm dependencies.
- [ ] Keep the scope to one small task, splitting it if needed.

## endy-rkt: Decisions and Spikes

| ID | Task (one line) | Priority | Depends on | Status |
|---|---|---|---|---|
| endy-rkt-01 | Confirm the hackathon deadline and scope and assign delivery owners (D01, D02). | P0 | | Backlog |
| endy-rkt-02 | Approve the shared package and Docker build context, runtime, and tooling under D14, D15 and D17. | P0 | endy-rkt-01 | Backlog |
| endy-rkt-03 | Evaluate object storage in a spike for D05. | P0 | endy-rkt-01 | Backlog |
| endy-rkt-04 | Decide service data isolation within one PostgreSQL instance, object storage and the gateway approach (D04–D06). | P0 | endy-rkt-03 | Backlog |
| endy-rkt-05 | Decide identity propagation, roles and review policy (D07, D13, D18). | P0 | endy-rkt-01 | Backlog |
| endy-rkt-06 | Align the NFT and 3D proposals with MVP goals and coordinate any system-wide async decision under D16. | P0 | NFT-01, 3D-02 | Backlog |

## endy-rkt: Foundation

The backend service directories are placeholders. Each app or service owner writes its tests, Dockerfile and root Compose entry. Stateful owners use Prisma with the shared PostgreSQL instance.

| ID | Task (one line) | Priority | Depends on | Status |
|---|---|---|---|---|
| endy-rkt-07 | Set up the root workspace for the app and service owners. [DECISION REQUIRED: endy-rkt] D14, D15, D17 | P0 | endy-rkt-02 | Backlog |
| endy-rkt-08 | Coordinate system-wide constraints for gateway and service contracts with the owners. [DECISION REQUIRED: endy-rkt] D06, D07, D13, D14, D18 | P0 | endy-rkt-02, endy-rkt-04, endy-rkt-05 | Backlog |
| endy-rkt-11 | Set up CI and local quality gates. [DECISION REQUIRED: endy-rkt] D17 | P0 | endy-rkt-07 | Backlog |
| endy-rkt-12 | Configure branch protection for `develop` and `main`. | P1 | endy-rkt-11 | Backlog |

## endy-rkt: Code quality follow-up

| ID | Task (one line) | Priority | Depends on | Status |
|---|---|---|---|---|
| endy-rkt-13 | Install and pin root quality tooling and add package scripts. | P0 | endy-rkt-07 | Backlog |
| endy-rkt-14 | Coordinate adoption of the shared TypeScript base by the app owners. | P0 | endy-rkt-07, FE-01 | Backlog |
| endy-rkt-15 | Wire the lint, format and type-check jobs into required CI. | P0 | endy-rkt-11, endy-rkt-17 | Backlog |
| endy-rkt-16 | Add pre-commit hooks if approved. [DECISION REQUIRED: endy-rkt] D17 | P2 | endy-rkt-13, endy-rkt-15 | Backlog |
| endy-rkt-17 | Run the first lint across all apps, verify import boundaries and fix violations. | P0 | endy-rkt-13, endy-rkt-14 | Backlog |

## endy-rkt: CI follow-up

| ID | Task (one line) | Priority | Depends on | Status |
|---|---|---|---|---|
| endy-rkt-18 | Decide the Node version and align CI, `.nvmrc` and package engines. [DECISION REQUIRED: endy-rkt] D15 | P0 | endy-rkt-01 | Backlog |
| endy-rkt-19 | Install pinned dev tooling and commit the root npm workspaces manifest and lockfile. | P0 | endy-rkt-02, endy-rkt-18 | Backlog |
| endy-rkt-20 | Coordinate app-owner adoption of the workspace scripts and shared TypeScript base. | P0 | endy-rkt-19 | Backlog |
| endy-rkt-21 | Run the first hosted CI and fix failures, including the first initialized-workspace checks. | P0 | endy-rkt-20 | Backlog |
| endy-rkt-22 | Apply the manual repository settings and verify the required check on both branches. | P0 | endy-rkt-21 | Backlog |
| endy-rkt-23 | Provide one disposable PostgreSQL instance in CI for the Prisma-backed integration suites. | P1 | endy-rkt-04, endy-rkt-20 | Backlog |
| endy-rkt-24 | Decide CODEOWNERS scope and confirm available reviewers. [DECISION REQUIRED: endy-rkt] CODEOWNERS | P2 | endy-rkt-01 | Backlog |

## Shared local infrastructure, owner TBD

| ID | Task (one line) | Priority | Depends on | Status |
|---|---|---|---|---|
| INFRA-01 | Set up one shared PostgreSQL instance and object storage in root Compose. [DECISION REQUIRED: endy-rkt] D02, D04, D05 | P0 | endy-rkt-07, endy-rkt-04 | Backlog |

## Gateway, owner TBD

| ID | Task (one line) | Priority | Depends on | Status |
|---|---|---|---|---|
| GATEWAY-01 | Initialize the gateway, write its initial tests and Dockerfile, and register it in root Compose. [DECISION REQUIRED: endy-rkt] D02, D06 | P0 | endy-rkt-07, endy-rkt-08 | Backlog |

## Auth, OWNER TBD [DECISION REQUIRED: endy-rkt]

All Auth items await D02.

| ID | Task (one line) | Priority | Depends on | Status |
|---|---|---|---|---|
| AUTH-07 | Initialize Auth with Prisma, write its initial tests and Dockerfile, and register it in root Compose. | P0 | endy-rkt-07, INFRA-01 | Backlog |
| AUTH-01 | Provide account registration. | P0 | AUTH-07, endy-rkt-08 | Backlog |
| AUTH-02 | Provide account login. | P0 | AUTH-01 | Backlog |
| AUTH-03 | Provide logout and session invalidation. | P1 | AUTH-02, AUTH-06 | Backlog |
| AUTH-04 | Enable guest access to public content. | P0 | GATEWAY-01, CONTENT-02 | Backlog |
| AUTH-05 | Enforce the agreed role and permission model. [DECISION REQUIRED: endy-rkt] D13 | P0 | AUTH-02, endy-rkt-05 | Backlog |
| AUTH-06 | Integrate session or token handling with the gateway. [DECISION REQUIRED: endy-rkt] D07 | P0 | AUTH-02, endy-rkt-05, GATEWAY-01 | Backlog |

## papangoo: Content & Verification

| ID | Task (one line) | Priority | Depends on | Status |
|---|---|---|---|---|
| CONTENT-07 | Initialize Content with Prisma, write its initial tests and Dockerfile, and register it in root Compose. | P0 | endy-rkt-07, INFRA-01 | Backlog |
| CONTENT-01 | Manage author information, item metadata and descriptions. | P0 | CONTENT-07, endy-rkt-08 | Backlog |
| CONTENT-02 | Publish content and expose published items for browsing. [DECISION REQUIRED: endy-rkt] D18 | P0 | CONTENT-01, endy-rkt-05 | Backlog |
| CONTENT-03 | Support authenticated image and video uploads. [DECISION REQUIRED: endy-rkt] D05, D18 | P1 | CONTENT-01, endy-rkt-04, endy-rkt-05, AUTH-06 | Backlog |
| CONTENT-04 | Support human verification of items and descriptions separately from automated analysis. [DECISION REQUIRED: endy-rkt] D13, D18 | P1 | CONTENT-01, endy-rkt-05, AUTH-05, AUTH-06 | Backlog |
| CONTENT-05 | Explore AI-assisted analysis. [DECISION REQUIRED: endy-rkt] D18 | P1 | endy-rkt-05 | Backlog |
| CONTENT-06 | Defer production integration of AI-assisted analysis. | P2 | CONTENT-05 | Backlog |

## salandri-42: NFT

| ID | Task (one line) | Priority | Depends on | Status |
|---|---|---|---|---|
| NFT-07 | Initialize NFT with Prisma, write its initial tests and Dockerfile, and register it in root Compose. | P0 | endy-rkt-07, INFRA-01 | Backlog |
| NFT-01 | Evaluate and choose the chain, standard, wallet and contract approach for D08–D11. | P0 | endy-rkt-01 | Backlog |
| NFT-02 | Integrate with Content for published item references. | P0 | NFT-07, endy-rkt-08, CONTENT-02 | Backlog |
| NFT-03 | Link NFT metadata to its published content. [DECISION REQUIRED: salandri-42] D09, D11 | P0 | NFT-01, NFT-02 | Backlog |
| NFT-04 | Support the user minting journey and transaction status. [DECISION REQUIRED: endy-rkt] D13, D16 | P0 | endy-rkt-06, NFT-03, AUTH-05, AUTH-06 | Backlog |
| NFT-05 | Expose provenance display data. | P1 | NFT-04 | Backlog |
| NFT-06 | Defer marketplace functionality. | P2 | | Backlog |

## Sesedra: UI/UX

| ID | Task (one line) | Priority | Depends on | Status |
|---|---|---|---|---|
| UX-01 | Define the primary user journey. | P0 | endy-rkt-01 | Backlog |
| UX-02 | Produce desktop and mobile mockups for the main screens. | P0 | UX-01 | Backlog |
| UX-03 | Contribute the design summary and mockup links to the README. | P1 | UX-02 | Backlog |

## shidoAdr: LiDAR & 3D

| ID | Task (one line) | Priority | Depends on | Status |
|---|---|---|---|---|
| 3D-07 | Initialize LiDAR with Prisma, write its initial tests and Dockerfile, and register it in root Compose. | P0 | endy-rkt-07, INFRA-01 | Backlog |
| 3D-01 | Investigate LiDAR and viewing feasibility. | P0 | endy-rkt-01 | Backlog |
| 3D-02 | Choose the 3D delivery approach within the agreed MVP for D12. | P0 | 3D-01 | Backlog |
| 3D-03 | Document the scanning and asset preparation workflow. [DECISION REQUIRED: shidoAdr] D12 | P1 | 3D-02 | Backlog |
| 3D-04 | Process, store and associate the demo 3D asset. [DECISION REQUIRED: endy-rkt] D05 | P0 | 3D-03, 3D-07, CONTENT-02 | Backlog |
| 3D-05 | Provide the frontend 3D display and fallback. | P1 | 3D-04, UX-02, FE-01 | Backlog |
| 3D-06 | Defer automated 3D reconstruction. | P2 | | Backlog |

## Frontend integration, owner TBD

Frontend implementation and containerization await an owner under D02. Sesedra owns design. [IN PROGRESS] Sesedra is preparing FE-01 and FE-02 on feature branches for review. endy-rkt confirms the D02 frontend owner and the new dependencies at PR review.

| ID | Task (one line) | Priority | Depends on | Status |
|---|---|---|---|---|
| FE-01 | Scaffold the React app shell. [DECISION REQUIRED: endy-rkt] D02, D15 | P0 | endy-rkt-01, endy-rkt-02 | Review |
| FE-05 | Write the frontend's initial tests and Dockerfile, and register it in root Compose. | P0 | FE-01 | Backlog |
| FE-02 | Implement the main screens from Sesedra's mockups. | P0 | FE-01, UX-02 | In progress |
| FE-03 | Connect discovery, account, upload and verification flows through the gateway. | P0 | FE-02, GATEWAY-01, AUTH-03, AUTH-04, CONTENT-03, CONTENT-04 | Backlog |
| FE-04 | Integrate NFT and 3D experiences through the gateway. | P0 | FE-02, GATEWAY-01, NFT-05, 3D-05 | Backlog |

## Integration & Demo (endy-rkt)

| ID | Task (one line) | Priority | Depends on | Status |
|---|---|---|---|---|
| DEMO-01 | Choose the demo host. | P0 | endy-rkt-01 | Backlog |
| DEMO-02 | Seed the reviewed demo content with papangoo. [DECISION REQUIRED: endy-rkt] D18 | P0 | endy-rkt-05, CONTENT-02, CONTENT-03, CONTENT-04 | Backlog |
| DEMO-03 | Coordinate end-to-end MVP validation with the app and service owners. [DECISION REQUIRED: endy-rkt] DEMO-01 | P0 | DEMO-01, DEMO-02, FE-03, FE-04, FE-05 | Backlog |
| DEMO-04 | Write and rehearse the demo script. | P0 | DEMO-03 | Backlog |
| DEMO-05 | Tag the validated demo release on `main`. | P0 | DEMO-04, endy-rkt-12 | Backlog |

## Phases

- Phase 0 Decisions/Spikes — endy-rkt-01, endy-rkt-02, endy-rkt-03, endy-rkt-04, endy-rkt-05, endy-rkt-06, NFT-01, 3D-01, 3D-02, DEMO-01
- Phase 1 Foundation and contracts — endy-rkt-07, endy-rkt-08, INFRA-01, GATEWAY-01, AUTH-07, CONTENT-07, NFT-07, 3D-07, endy-rkt-11, endy-rkt-12, FE-01, FE-05, endy-rkt-13, endy-rkt-14, endy-rkt-17, endy-rkt-15
- Phase 2 Feature work in parallel — AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, CONTENT-01, CONTENT-02, CONTENT-03, CONTENT-04, CONTENT-05, NFT-02, NFT-03, NFT-04, NFT-05, UX-01, UX-02, UX-03, 3D-03, 3D-04, 3D-05, FE-02, FE-03, FE-04
- Phase 3 Integration and demo — DEMO-02, DEMO-03, DEMO-04, DEMO-05
