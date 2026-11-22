# Project backlog

## Purpose

This high-level backlog tracks decisions, foundation work, MVP features and demo preparation.

Each owner can edit, add, split and reprioritize their own tasks within the agreed MVP. Owners deliver their apps and services end to end. See the [ownership rules](../team/responsibilities.md#task-ownership) and [project decisions](../decisions/project-decisions.md).

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

| ID          | Task (one line)                                                                                                                                                                                                                                                                                                            | Priority | Depends on    | Status  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------- | ------- |
| endy-rkt-01 | Record the approved [D01 demo scope](../decisions/project-decisions.md#d01-first-integrated-mvp-demo) for one item. Sign-off requires interactive 3D and a confirmed NFT mint in the same run. Live phone capture is optional. Label runs with an unavailable gate **Rehearsal** and record each missing gate.             | P0       |               | Done    |
| endy-rkt-02 | Record approved [D14](../decisions/project-decisions.md#d14-shared-contracts-and-build-context), [D15](../decisions/project-decisions.md#d15-node-and-npm-workspace-runtime) and [D17](../decisions/project-decisions.md#d17-quality-tooling-and-ci-rollout). Owner feedback is pending under endy-rkt-08 and endy-rkt-20. | P0       | endy-rkt-01   | Done    |
| endy-rkt-03 | Validate SeaweedFS for local storage with representative assets.                                                                                                                                                                                                                                                           | P0       | endy-rkt-01   | Review  |
| endy-rkt-04 | Record approved D04 database isolation and D06 gateway boundary and close D05 after the storage spike.                                                                                                                                                                                                                     | P0       | endy-rkt-03   | Review  |
| endy-rkt-05 | Agree the session, permission and editorial handoffs under approved D07, D13 and D18.                                                                                                                                                                                                                                      | P0       | endy-rkt-01   | Review  |
| endy-rkt-06 | Validate the approved D16 HTTP and polling baseline against the NFT and 3D proposals.                                                                                                                                                                                                                                      | P0       | NFT-01, 3D-02 | Backlog |

## endy-rkt: Foundation

The backend service directories are placeholders. Each owner initializes their app or service and owns its API, tests, Dockerfile and root Compose entry. Stateful service owners own their data, Prisma schema and migrations within the shared PostgreSQL instance.

| ID          | Task (one line)                                                                                               | Priority | Depends on                            | Status  |
| ----------- | ------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------- | ------- |
| endy-rkt-07 | Coordinate usable workspace setup using approved D14, D15 and D17 and the root files from endy-rkt-19.        | P0       | endy-rkt-02, endy-rkt-19              | Review  |
| endy-rkt-08 | Coordinate system-wide constraints for gateway and service contracts with the owners. D06, D07, D13, D14, D18 | P0       | endy-rkt-02, endy-rkt-04, endy-rkt-05 | Review  |
| endy-rkt-11 | Set up CI and local quality gates under approved D17.                                                         | P0       | endy-rkt-07                           | Review  |
| endy-rkt-12 | Configure branch protection for `develop` and `main`.                                                         | P1       | endy-rkt-11                           | Backlog |

## endy-rkt: Code quality follow-up

| ID          | Task (one line)                                                                  | Priority | Depends on               | Status      |
| ----------- | -------------------------------------------------------------------------------- | -------- | ------------------------ | ----------- |
| endy-rkt-13 | Add root quality scripts using the pins installed by endy-rkt-19.                | P0       | endy-rkt-07, endy-rkt-19 | Review      |
| endy-rkt-14 | Coordinate adoption of the shared TypeScript base by the app owners.             | P0       | endy-rkt-07, FE-01       | In progress |
| endy-rkt-15 | Wire the lint, format and type-check jobs into required CI.                      | P0       | endy-rkt-11, endy-rkt-17 | Review      |
| endy-rkt-16 | Add pre-commit hooks if approved. [DECISION REQUIRED: endy-rkt] D17              | P2       | endy-rkt-13, endy-rkt-15 | Backlog     |
| endy-rkt-17 | Run the first lint across all apps, verify import boundaries and fix violations. | P0       | endy-rkt-13, endy-rkt-14 | Review      |

## endy-rkt: CI follow-up

| ID          | Task (one line)                                                                                     | Priority | Depends on               | Status      |
| ----------- | --------------------------------------------------------------------------------------------------- | -------- | ------------------------ | ----------- |
| endy-rkt-18 | Validate the exact Node and npm pins and align CI, .nvmrc and the package engines policy under D15. | P0       | endy-rkt-01              | Review      |
| endy-rkt-19 | Install pinned dev tooling and commit the root npm workspaces manifest and lockfile.                | P0       | endy-rkt-02, endy-rkt-18 | Review      |
| endy-rkt-20 | Coordinate app-owner adoption of the workspace scripts and shared TypeScript base.                  | P0       | endy-rkt-19              | In progress |
| endy-rkt-21 | Run the first hosted CI and fix failures, including the first initialized-workspace checks.         | P0       | endy-rkt-20              | Backlog     |
| endy-rkt-22 | Apply the manual repository settings and verify the required check on both branches.                | P0       | endy-rkt-21              | Backlog     |
| endy-rkt-23 | Provide one disposable PostgreSQL instance in CI for the Prisma-backed integration suites.          | P1       | endy-rkt-04, endy-rkt-20 | Review      |
| endy-rkt-24 | Decide CODEOWNERS scope and confirm available reviewers. [DECISION REQUIRED: endy-rkt] CODEOWNERS   | P2       | endy-rkt-01              | Backlog     |

## endy-rkt: Shared local infrastructure

endy-rkt owns the [shared PostgreSQL and SeaweedFS setup](../team/responsibilities.md#shared-local-infrastructure). Each service owner owns their Prisma schema and migrations.

| ID       | Task (one line)                                                                                     | Priority | Depends on               | Status |
| -------- | --------------------------------------------------------------------------------------------------- | -------- | ------------------------ | ------ |
| INFRA-01 | Set up shared PostgreSQL and SeaweedFS with volumes, health checks and service isolation under D04. | P0       | endy-rkt-07, endy-rkt-04 | Review |

## endy-rkt: Gateway

| ID         | Task (one line)                                                                                     | Priority | Depends on               | Status |
| ---------- | --------------------------------------------------------------------------------------------------- | -------- | ------------------------ | ------ |
| GATEWAY-01 | Initialize the dedicated NestJS gateway, add tests and Dockerfile, and register it in root Compose. | P0       | endy-rkt-07, endy-rkt-08 | Review |

## shidoAdr: Auth

| ID      | Task (one line)                                                                                       | Priority | Depends on                       | Status |
| ------- | ----------------------------------------------------------------------------------------------------- | -------- | -------------------------------- | ------ |
| AUTH-07 | Initialize Auth with Prisma, write its initial tests and Dockerfile, and register it in root Compose. | P0       | endy-rkt-07, INFRA-01            | Review |
| AUTH-01 | Provide account registration.                                                                         | P0       | AUTH-07, endy-rkt-08             | Review |
| AUTH-02 | Provide account login.                                                                                | P0       | AUTH-01                          | Review |
| AUTH-03 | Provide logout and session invalidation.                                                              | P1       | AUTH-02, AUTH-06                 | Review |
| AUTH-04 | Enable guest access to public content.                                                                | P0       | GATEWAY-01, CONTENT-02           | Review |
| AUTH-05 | Enforce the agreed role and permission model. D13                                                     | P0       | AUTH-02, endy-rkt-05             | Review |
| AUTH-06 | Integrate session or token handling with the gateway. D07                                             | P0       | AUTH-02, endy-rkt-05, GATEWAY-01 | Review |

## papangoo: Content & Verification

| ID          | Task (one line)                                                                                                                                                                                                                                                                                  | Priority | Depends on                                    | Status      |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | --------------------------------------------- | ----------- |
| CONTENT-07  | Initialize Content with Prisma, write its initial tests and Dockerfile, and register it in root Compose.                                                                                                                                                                                         | P0       | endy-rkt-07, INFRA-01                         | Backlog     |
| CONTENT-01  | Manage author information, item metadata and descriptions.                                                                                                                                                                                                                                       | P0       | CONTENT-07, endy-rkt-08                       | Backlog     |
| CONTENT-02  | Publish content and expose published items for browsing. D18                                                                                                                                                                                                                                     | P0       | CONTENT-01, endy-rkt-05                       | Backlog     |
| CONTENT-03  | Support authenticated image and video uploads. D05, D18                                                                                                                                                                                                                                          | P1       | CONTENT-01, endy-rkt-04, endy-rkt-05, AUTH-06 | Backlog     |
| CONTENT-04  | Support human verification of items and descriptions separately from automated analysis. D13, D18                                                                                                                                                                                                | P1       | CONTENT-01, endy-rkt-05, AUTH-05, AUTH-06     | Backlog     |
| CONTENT-05  | Explore AI-assisted analysis as advisory signals only, groomed as CONTENT-05a to CONTENT-05c ([#57](https://github.com/songomby-D1/devfest2026/issues/57)). D18 is confirmed; explicit clearance is still required before cultural media is sent to an external AI API                           | P1       | endy-rkt-05                                   | In progress |
| CONTENT-05a | Explore AI-generated media detection with Sightengine for images and videos, with costs, limits and an accuracy test ([#84](https://github.com/songomby-D1/devfest2026/issues/84)). D18 is confirmed; explicit clearance is still required before cultural media is sent to an external AI API   | P1       | endy-rkt-05                                   | In progress |
| CONTENT-05b | Explore a description-to-media coherence check with an AI vision API, using pictures from several angles for 3D models ([#85](https://github.com/songomby-D1/devfest2026/issues/85)). D18 is confirmed; explicit clearance is still required before cultural media is sent to an external AI API | P1       | endy-rkt-05                                   | Groomed     |
| CONTENT-05c | Propose the advisory-signal contract that leaves the CONTENT-04 verification status unchanged ([#86](https://github.com/songomby-D1/devfest2026/issues/86)).                                                                                                                                     | P1       | CONTENT-05a, CONTENT-05b, CONTENT-04          | Backlog     |
| CONTENT-06  | Defer production integration of AI-assisted analysis into Content & Verification ([#58](https://github.com/songomby-D1/devfest2026/issues/58)).                                                                                                                                                  | P2       | CONTENT-05                                    | Backlog     |
| CONTENT-08  | Defer content moderation until after the MVP ([#87](https://github.com/songomby-D1/devfest2026/issues/87)).                                                                                                                                                                                      | P2       | CONTENT-06                                    | Backlog     |

## salandri-42: NFT

| ID     | Task (one line)                                                                                      | Priority | Depends on                            | Status      |
| ------ | ---------------------------------------------------------------------------------------------------- | -------- | ------------------------------------- | ----------- |
| NFT-07 | Initialize NFT with Prisma, write its initial tests and Dockerfile, and register it in root Compose. | P0       | endy-rkt-07, INFRA-01                 | In progress |
| NFT-01 | Evaluate and choose the chain, standard, wallet and contract approach for D08–D11.                   | P0       | endy-rkt-01                           | Review      |
| NFT-02 | Integrate with Content for published item references.                                                | P0       | NFT-07, endy-rkt-08, CONTENT-02       | Backlog     |
| NFT-03 | Link NFT metadata to its published content. [DECISION REQUIRED: salandri-42] D09, D11                | P0       | NFT-01, NFT-02                        | Backlog     |
| NFT-04 | Support the user minting journey and transaction status. D13, D16                                    | P0       | endy-rkt-06, NFT-03, AUTH-05, AUTH-06 | Backlog     |
| NFT-05 | Expose provenance display data.                                                                      | P1       | NFT-04                                | Backlog     |
| NFT-06 | Defer marketplace functionality.                                                                     | P2       |                                       | Backlog     |

## Sesedra: UI/UX

| ID    | Task (one line)                                               | Priority | Depends on  | Status  |
| ----- | ------------------------------------------------------------- | -------- | ----------- | ------- |
| UX-01 | Define the primary user journey.                              | P0       | endy-rkt-01 | Backlog |
| UX-02 | Produce desktop and mobile mockups for the main screens.      | P0       | UX-01       | Backlog |
| UX-03 | Contribute the design summary and mockup links to the README. | P1       | UX-02       | Backlog |

## shidoAdr: LiDAR & 3D

| ID    | Task (one line)                                                                                        | Priority | Depends on               | Status  |
| ----- | ------------------------------------------------------------------------------------------------------ | -------- | ------------------------ | ------- |
| 3D-07 | Initialize LiDAR with Prisma, write its initial tests and Dockerfile, and register it in root Compose. | P0       | endy-rkt-07, INFRA-01    | Backlog |
| 3D-01 | Investigate LiDAR and viewing feasibility.                                                             | P0       | endy-rkt-01              | Backlog |
| 3D-02 | Choose the 3D delivery approach within the agreed MVP for D12.                                         | P0       | 3D-01                    | Backlog |
| 3D-03 | Document the scanning and asset preparation workflow. D12: option A, ADR 0001 accepted                 | P1       | 3D-02                    | Backlog |
| 3D-04 | Process, store and associate the demo 3D asset. D05                                                    | P0       | 3D-03, 3D-07, CONTENT-02 | Backlog |
| 3D-05 | Provide the frontend 3D display and fallback.                                                          | P1       | 3D-04, UX-02, FE-01      | Backlog |
| 3D-06 | Defer automated 3D reconstruction.                                                                     | P2       |                          | Backlog |

## Sesedra: Frontend integration

| ID    | Task (one line)                                                                     | Priority | Depends on                                                  | Status  |
| ----- | ----------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------- | ------- |
| FE-01 | Scaffold the React app shell using the approved D15 runtime.                        | P0       | endy-rkt-01, endy-rkt-02, endy-rkt-07                       | Review  |
| FE-05 | Write the frontend's initial tests and Dockerfile, and register it in root Compose. | P0       | FE-01                                                       | Backlog |
| FE-02 | Implement the main screens from Sesedra's mockups.                                  | P0       | FE-01, UX-02                                                | Review  |
| FE-03 | Connect discovery, account, upload and verification flows through the gateway.      | P0       | FE-02, GATEWAY-01, AUTH-03, AUTH-04, CONTENT-03, CONTENT-04 | Backlog |
| FE-04 | Integrate NFT and 3D experiences through the gateway.                               | P0       | FE-02, GATEWAY-01, NFT-05, 3D-05                            | Backlog |

## Integration & Demo (endy-rkt)

| ID      | Task (one line)                                                                                          | Priority | Depends on                                      | Status  |
| ------- | -------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------- | ------- |
| DEMO-01 | Validate the approved presenter-laptop Compose setup and second mobile device against demo requirements. | P0       | endy-rkt-01                                     | Backlog |
| DEMO-02 | Seed the reviewed demo content with papangoo. D18                                                        | P0       | endy-rkt-05, CONTENT-02, CONTENT-03, CONTENT-04 | Backlog |
| DEMO-03 | Coordinate end-to-end MVP validation with the app and service owners. DEMO-01                            | P0       | DEMO-01, DEMO-02, FE-03, FE-04, FE-05           | Backlog |
| DEMO-04 | Write and rehearse the demo script.                                                                      | P0       | DEMO-03                                         | Backlog |
| DEMO-05 | Tag the validated demo release on `main`.                                                                | P0       | DEMO-04, endy-rkt-12                            | Backlog |

## Phases

- Phase 0 Decisions/Spikes — endy-rkt-01, endy-rkt-02, endy-rkt-03, endy-rkt-04, endy-rkt-05, endy-rkt-06, NFT-01, 3D-01, 3D-02, DEMO-01
- Phase 1 Foundation and contracts — endy-rkt-07, endy-rkt-08, INFRA-01, GATEWAY-01, AUTH-07, CONTENT-07, NFT-07, 3D-07, endy-rkt-11, endy-rkt-12, FE-01, FE-05, endy-rkt-13, endy-rkt-14, endy-rkt-17, endy-rkt-15
- Phase 2 Feature work in parallel — AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, CONTENT-01, CONTENT-02, CONTENT-03, CONTENT-04, CONTENT-05, NFT-02, NFT-03, NFT-04, NFT-05, UX-01, UX-02, UX-03, 3D-03, 3D-04, 3D-05, FE-02, FE-03, FE-04
- Phase 3 Integration and demo — DEMO-02, DEMO-03, DEMO-04, DEMO-05
