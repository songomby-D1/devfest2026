# 0002 Proposed settlements for open questions

- **Status:** Proposed. rivon0507 chose each answer below on 2026-11-22. None of them is binding until the named owner confirms it. Until then, the source documents keep their open questions unchanged.
- **Proposed by:** rivon0507, with Claude
- **Date:** 2026-11-22
- **Sources:** [Auth contract open questions](../specs/auth-contract.md#open-questions), [user journey open questions](../../apps/frontend/docs/user-journey.md#open-questions-and-contract-gaps), [3D spike limits and open questions](../architecture/3d-feasibility-spike.md#limits-and-open-questions), the `[DECISION REQUIRED]` items in the [handoff](../agents/handoff.md) and the [backlog](../product/task.md)

## Context

The open questions were spread across several documents, and some repeated each other: mint eligibility appeared in the Auth spec, the user journey and the NFT handoff. This proposal gives one answer for each question, with its rationale and the owner who confirms it. Each owner confirms or amends their rows. A row that needs a route or field goes through a `[CONTRACT CHANGE]` pull request before implementation.

## Product and contract gaps

| #   | Question                                       | Source              | [PROPOSED] Settlement                                                                                                                                                                               | Confirms                        |
| --- | ---------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| S1  | Who may request a mint?                        | Auth Q3, Journey Q3 | The item owner only, for a published item. NFT checks that the caller is the item's owner with Content. This fits the D13 ownership checks.                                                         | salandri-42, shidoAdr, papangoo |
| S2  | User wallet or platform signing?               | Journey Q4, D10     | Custodial gallery wallet. The NFT service signs and pays the gas, and users have no wallet step. This matches NFT spec D2, D3 and D14 and works on mobile.                                          | salandri-42                     |
| S3  | What triggers publication?                     | Journey Q1          | Content publishes automatically once `POST /api/items/:id/review` has recorded both claim outcomes and rights clearance is set (D18). No new route.                                                 | papangoo, endy-rkt              |
| S4  | How are own items and the review queue listed? | Journey Q2          | Add filters to `GET /api/items`: `?owner=me` and `?status=pending_review`. Content enforces them from `x-caller-account-id` and the `reviewer` permission. This is an additive `[CONTRACT CHANGE]`. | papangoo, endy-rkt              |
| S5  | What does the item detail response carry?      | Journey Q5          | `GET /api/items/:id` returns the publication status and claim statuses to every caller. The reviewer rationale goes only to the owner and reviewers, or to everyone once the item is published.     | papangoo                        |
| S6  | Who may associate a 3D asset with an item?     | Auth Q4             | The item owner. LiDAR checks ownership with Content through the LiDAR → Content call.                                                                                                               | papangoo, shidoAdr              |
| S7  | Does Content need a public author name?        | Auth Q5             | Content stores a free-text author field on each item, entered at upload. It covers traditional or late artisans without an account. Auth stays email-only, and the email is never public.           | papangoo                        |
| S8  | What are the frontend paths and labels?        | Journey Q6          | French paths and labels: `/`, `/galerie`, `/oeuvre/:id`, `/musee/:room/:nn` and `/contribuer`, as already proposed in #96 and #102.                                                                 | Sesedra                         |

## Auth and gateway

| #   | Question                          | Source  | [PROPOSED] Settlement                                                                                                                                                                          | Confirms           |
| --- | --------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| S9  | Caller-context header names       | Auth Q1 | Keep `x-service-name`, `x-service-token`, `x-caller-account-id`, `x-caller-permissions` and `x-request-id` as proposed.                                                                        | endy-rkt           |
| S10 | Service-to-service authentication | Auth Q1 | Per-pair secrets. Each receiver holds one inbound token per allowed caller, including NFT → Content and LiDAR → Content.                                                                       | endy-rkt, shidoAdr |
| S11 | CSRF safeguard                    | Auth Q2 | `SameSite=Lax` plus a gateway check of `Origin` against the configured frontend origins on state-changing requests.                                                                            | endy-rkt           |
| S12 | Rate limits                       | Auth Q2 | Per IP at the gateway: 10 requests per minute on `/auth/login` and 5 per minute on `/auth/register`, answering `429` with `Retry-After`. AUTH-02 retunes them after measuring the scrypt cost. | endy-rkt           |

## 3D (D12 follow-ups)

| #   | Question                    | Source     | [PROPOSED] Settlement                                                                                                                                                                              | Confirms           |
| --- | --------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| S13 | Delivered variants          | 3D-02      | 1K GLB by default, 2K on demand, as in [ADR 0001](0001-d12-3d-demo-experience.md).                                                                                                                 | shidoAdr           |
| S14 | USDZ source for AR          | 3D-02      | model-viewer generates the USDZ. No uploaded USDZ reaches visitors.                                                                                                                                | shidoAdr           |
| S15 | Live conversion (3D-06)     | 3D-02      | Offline preparation only for the MVP. Revisit 3D-06 after the MVP, and only under the full [media security policy](../architecture/data-storage.md).                                               | shidoAdr, endy-rkt |
| S16 | Storage footprint per asset | 3D-02, D05 | At most 50 MB per asset, enforced as an upload limit in LiDAR. This leaves room for a source USDZ: the spike saw 4.9 MB to 31.9 MB. Confirm the figure against the endy-rkt-03 SeaweedFS evidence. | shidoAdr, endy-rkt |

## Governance and NFT

| #   | Question                        | Source                   | [PROPOSED] Settlement                                                                                                                                                                                                                                      | Confirms              |
| --- | ------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| S17 | External AI APIs for CONTENT-05 | #57, handoff             | Allowed for rights-cleared fixtures that contain no personal data, with a one-week timebox. Signals stay advisory and papangoo holds the keys. Record each provider's data-retention terms in the spike report.                                            | endy-rkt              |
| S18 | Pre-commit hooks                | endy-rkt-16, D17         | A light hook: Husky and lint-staged run Prettier and ESLint on staged files only. Typecheck and tests stay in CI under `ci-ok`.                                                                                                                            | endy-rkt              |
| S19 | CODEOWNERS scope                | endy-rkt-24              | One owner per directory, mirroring [responsibilities](../team/responsibilities.md): frontend to Sesedra, auth and lidar to shidoAdr, content to papangoo, nft to salandri-42, and the gateway, root configs, `.github/` and architecture docs to endy-rkt. | endy-rkt              |
| S20 | NFT spec vs decision register   | handoff, NFT spec §4.0.4 | The decision register wins: synchronous HTTP with polling (D16), an NFT database with Prisma (D04), SeaweedFS media (D05) and a mint started by the owner (S1). salandri-42 updates spec §3 and lots L2, L3, L6 and L7 before L2.                          | salandri-42, endy-rkt |
| S21 | Blockchain stack                | MVP.md, D08              | Avalanche Fuji C-Chain, ERC-721 with one token per item, and IPFS through Pinata, as in the NFT spec. Final selection still needs the signing, confirmation and metadata-resolution demo required by the MVP.                                              | salandri-42           |
| S22 | Link from metadata to content   | NFT-03, D09, D11         | At mint, NFT pins an approved public snapshot of the item and a public preview on IPFS and writes the master file's sha256 on-chain. `tokenURI` points to IPFS. Private media and personal data never go on-chain or into public metadata.                 | salandri-42, papangoo |

## Consequences

- S3 and S5 keep the frozen routes, but they change Content behaviour and response fields, so papangoo records them in the Content contract. S4 needs a `[CONTRACT CHANGE]` pull request.
- S1 and S6 fill the two open cells of the [Auth permission matrix](../specs/auth-contract.md#permission-matrix-d13-to-confirm-under-endy-rkt-05) once confirmed.
- S1, S2, S20, S21 and S22 together answer the NFT divergences listed in the [decision register](project-decisions.md#decisions-already-delegated).
- D05 stays conditional on endy-rkt-03, and this proposal does not settle it.
- When an owner confirms a row, update the source document and mark the row `[CONFIRMED]` here.
