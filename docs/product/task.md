# Project backlog

## Purpose

This high-level backlog tracks decisions, foundation work, MVP features and demo preparation.

Each owner grooms their own items before starting.

References: [MVP](MVP.md), [architecture](../architecture/overview.md), [service contracts](../architecture/services.md), [data and storage](../architecture/data-storage.md), [owners](../team/responsibilities.md), [agent workflow](../agents/workflow.md), [development](../development/workflow.md), and [quality gates](../development/quality-gates.md).

## Legend

- Priority: `P0` blocks the demo or other tasks, `P1` is MVP required, `P2` is nice to have or deferred.
- Status: `Backlog` · `Groomed` · `In progress` · `Review` · `Done`.
- `[CTO DECISION REQUIRED]` marks work blocked by the referenced decision. `D` numbers refer to the CTO decision list. A blank dependency cell means no prerequisite is listed.

## Definition of Ready

The owner completes this checklist and then moves the item to `Groomed`.

- [ ] Write acceptance criteria.
- [ ] Identify the services and files touched.
- [ ] Agree the API contract with the CTO for cross-service work.
- [ ] Confirm dependencies.
- [ ] Keep the scope to one small task, splitting it if needed.

## CTO: Decisions and Spikes

| ID | Task (one line) | Priority | Depends on | Status |
|---|---|---|---|---|
| CTO-01 | Confirm the hackathon deadline and scope and assign delivery owners (D01, D02). | P0 | | Backlog |
| CTO-02 | Approve the shared package and Docker build context, runtime, and tooling under D14, D15 and D17. | P0 | CTO-01 | Backlog |
| CTO-03 | Evaluate object storage in a spike for D05. | P0 | CTO-01 | Backlog |
| CTO-04 | Decide database isolation, object storage and the gateway approach (D04–D06). | P0 | CTO-03 | Backlog |
| CTO-05 | Decide identity propagation, roles and review policy (D07, D13, D18). | P0 | CTO-01 | Backlog |
| CTO-06 | Resolve D08–D12 and D16 using the NFT and 3D investigations. | P0 | NFT-01, 3D-02 | Backlog |

## CTO: Foundation

The backend service directories are reserved with `.gitkeep` only. Service initialization remains in the backlog.

| ID | Task (one line) | Priority | Depends on | Status |
|---|---|---|---|---|
| CTO-07 | Set up the workspace and initialize NestJS in each backend service directory. [CTO DECISION REQUIRED] D14, D15, D17 | P0 | CTO-02 | Backlog |
| CTO-08 | Agree gateway and service contracts, including caller identity and the Content publication and metadata contract. [CTO DECISION REQUIRED] D06, D07, D13, D14, D18 | P0 | CTO-02, CTO-04, CTO-05 | Backlog |
| CTO-09 | Establish the gateway baseline. [CTO DECISION REQUIRED] D02, D06 | P0 | CTO-07, CTO-08 | Backlog |
| CTO-10 | Set up local infrastructure and add each Dockerfile in its own service directory. [CTO DECISION REQUIRED] D04, D05, D14 | P0 | CTO-07, CTO-04 | Backlog |
| CTO-11 | Set up CI and local quality gates. [CTO DECISION REQUIRED] D17 | P0 | CTO-07 | Backlog |
| CTO-12 | Configure branch protection for `develop` and `main`. | P1 | CTO-11 | Backlog |

## Auth, OWNER TBD [CTO DECISION REQUIRED]

All Auth items await D02.

| ID | Task (one line) | Priority | Depends on | Status |
|---|---|---|---|---|
| AUTH-01 | Provide account registration. | P0 | CTO-01, CTO-07, CTO-08, CTO-10 | Backlog |
| AUTH-02 | Provide account login. | P0 | AUTH-01 | Backlog |
| AUTH-03 | Provide logout and session invalidation. | P1 | AUTH-02, AUTH-06 | Backlog |
| AUTH-04 | Enable guest access to public content. | P0 | CTO-01, CTO-09, CONTENT-02 | Backlog |
| AUTH-05 | Enforce the agreed role and permission model. [CTO DECISION REQUIRED] D13 | P0 | AUTH-02, CTO-05 | Backlog |
| AUTH-06 | Integrate session or token handling with the gateway. [CTO DECISION REQUIRED] D07 | P0 | AUTH-02, CTO-05, CTO-09 | Backlog |

## Mika: Content & Verification

| ID | Task (one line) | Priority | Depends on | Status |
|---|---|---|---|---|
| CONTENT-01 | Manage author information, item metadata and descriptions. | P0 | CTO-07, CTO-08, CTO-10 | Backlog |
| CONTENT-02 | Publish content and expose published items for browsing. [CTO DECISION REQUIRED] D18 | P0 | CONTENT-01, CTO-05 | Backlog |
| CONTENT-03 | Support authenticated image and video uploads. [CTO DECISION REQUIRED] D05, D18 | P1 | CONTENT-01, CTO-04, CTO-05, AUTH-06 | Backlog |
| CONTENT-04 | Support human verification of items and descriptions separately from automated analysis. [CTO DECISION REQUIRED] D13, D18 | P1 | CONTENT-01, CTO-05, AUTH-05, AUTH-06 | Backlog |
| CONTENT-05 | Explore AI-assisted analysis. [CTO DECISION REQUIRED] D18 | P1 | CTO-05 | Backlog |
| CONTENT-06 | Defer production integration of AI-assisted analysis. | P2 | CONTENT-05 | Backlog |

## Salohy: NFT

| ID | Task (one line) | Priority | Depends on | Status |
|---|---|---|---|---|
| NFT-01 | Investigate chain, standard, wallet and contract options for D08–D11. | P0 | CTO-01 | Backlog |
| NFT-02 | Integrate with Content for published item references. | P0 | CTO-08, CONTENT-02 | Backlog |
| NFT-03 | Link NFT metadata to its published content. [CTO DECISION REQUIRED] D09, D11 | P0 | CTO-06, NFT-02 | Backlog |
| NFT-04 | Support the user minting journey and transaction status. [CTO DECISION REQUIRED] D08–D11, D13, D16 | P0 | CTO-06, NFT-03, AUTH-05, AUTH-06 | Backlog |
| NFT-05 | Expose provenance display data. | P1 | NFT-04 | Backlog |
| NFT-06 | Defer marketplace functionality. | P2 | | Backlog |

## Sedra: UI/UX

| ID | Task (one line) | Priority | Depends on | Status |
|---|---|---|---|---|
| UX-01 | Define the primary user journey. | P0 | CTO-01 | Backlog |
| UX-02 | Produce desktop and mobile mockups for the main screens. | P0 | UX-01 | Backlog |
| UX-03 | Contribute the design summary and mockup links to the README. | P1 | UX-02 | Backlog |

## Shido: LiDAR & 3D

| ID | Task (one line) | Priority | Depends on | Status |
|---|---|---|---|---|
| 3D-01 | Investigate LiDAR and viewing feasibility. | P0 | CTO-01 | Backlog |
| 3D-02 | Propose the MVP 3D scope for D12. | P0 | 3D-01 | Backlog |
| 3D-03 | Document the scanning and asset preparation workflow. [CTO DECISION REQUIRED] D12 | P1 | CTO-06 | Backlog |
| 3D-04 | Process, store and associate the demo 3D asset. [CTO DECISION REQUIRED] D05, D12 | P0 | 3D-03, CTO-10, CONTENT-02 | Backlog |
| 3D-05 | Provide the frontend 3D display and fallback. | P1 | 3D-04, UX-02, FE-01 | Backlog |
| 3D-06 | Defer automated 3D reconstruction. | P2 | | Backlog |

## Frontend integration (CTO)

The CTO is the provisional owner pending D02.

| ID | Task (one line) | Priority | Depends on | Status |
|---|---|---|---|---|
| FE-01 | Scaffold the React app shell. [CTO DECISION REQUIRED] D02, D15 | P0 | CTO-01, CTO-02 | Backlog |
| FE-02 | Implement the main screens from Sedra's mockups. | P0 | FE-01, UX-02 | Backlog |
| FE-03 | Connect discovery, account, upload and verification flows through the gateway. | P0 | FE-02, CTO-09, AUTH-03, AUTH-04, CONTENT-03, CONTENT-04 | Backlog |
| FE-04 | Integrate NFT and 3D experiences through the gateway. | P0 | FE-02, CTO-09, NFT-05, 3D-05 | Backlog |

## Integration & Demo (CTO)

| ID | Task (one line) | Priority | Depends on | Status |
|---|---|---|---|---|
| DEMO-01 | Choose the demo host. | P0 | CTO-01 | Backlog |
| DEMO-02 | Seed the reviewed demo content with Mika. [CTO DECISION REQUIRED] D18 | P0 | CTO-05, CONTENT-02, CONTENT-03, CONTENT-04 | Backlog |
| DEMO-03 | Validate the MVP end to end on the demo host. [CTO DECISION REQUIRED] DEMO-01 | P0 | DEMO-01, DEMO-02, FE-03, FE-04 | Backlog |
| DEMO-04 | Write and rehearse the demo script. | P0 | DEMO-03 | Backlog |
| DEMO-05 | Tag the validated demo release on `main`. | P0 | DEMO-04, CTO-12 | Backlog |

## Phases

- Phase 0 Decisions/Spikes — CTO-01, CTO-02, CTO-03, CTO-04, CTO-05, CTO-06, NFT-01, 3D-01, 3D-02, DEMO-01
- Phase 1 Foundation and contracts — CTO-07, CTO-08, CTO-09, CTO-10, CTO-11, CTO-12, FE-01
- Phase 2 Feature work in parallel — AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, CONTENT-01, CONTENT-02, CONTENT-03, CONTENT-04, CONTENT-05, NFT-02, NFT-03, NFT-04, NFT-05, UX-01, UX-02, UX-03, 3D-03, 3D-04, 3D-05, FE-02, FE-03, FE-04
- Phase 3 Integration and demo — DEMO-02, DEMO-03, DEMO-04, DEMO-05
