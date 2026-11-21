# Parallel workflow for the three workstreams

This note describes how to run the three [task allocation](../agents/task-allocation.md) workstreams at the same time without stepping on each other. Nothing here launches an agent: it is the operating agreement we would give them.

## Setup

Start from `develop` and create three isolated worktrees, one per agent:

| Agent                    | Branch               | Worktree            |
| ------------------------ | -------------------- | ------------------- |
| Agent 1 — Foundations    | `agent1-foundation`  | `.worktrees/agent1` |
| Agent 2 — Content/NFT    | `agent2-content-nft` | `.worktrees/agent2` |
| Agent 3 — UX/Frontend/3D | `agent3-ux-fe-3d`    | `.worktrees/agent3` |

**Absolute rule: nobody pushes directly to `develop` or `main`.** Each agent works in its own worktree, commits on its own branch, opens a pull request to `develop`, and rebases on `develop` at least once a day.

## Sequence

1. **Gate 0 (short) — Agent 1 alone.** Publish the small pull request that freezes the contracts described below. Once merged, all three agents really start in parallel.
2. **Parallel phase.** Agents 2 and 3 code against the frozen contract and mocks; they do not wait for the real services.
3. **Integration.** PR Agent 1 → PR Agent 2 → PR Agent 3 → final demo PR by Agent 3.
4. **Cross-review.** Every agent reviews at least one other agent's pull request, in addition to its own perimeter.

## File ownership

This matrix is the key to avoiding conflicts.

| Area                                                                                                                                                                     |  Agent 1  |       Agent 2       |       Agent 3       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :-------: | :-----------------: | :-----------------: |
| Root: `package.json`, lockfile, `Taskfile.yml`, `tsconfig.base.json`, `eslint.config.mjs`, `.github/workflows/`, `.env.example`, `docker-compose.yml`, `infrastructure/` | **Owner** | Proposes a fragment | Proposes a fragment |
| `docs/product/`, `docs/decisions/`, `docs/development/`, `docs/api/gateway.*`                                                                                            | **Owner** |      Read only      |      Read only      |
| `apps/backend/gateway/`, `apps/backend/auth/`                                                                                                                            | **Owner** |          —          |          —          |
| `apps/backend/content/`, `apps/backend/nft/`, `docs/api/content.*`, `docs/api/nft.*`                                                                                     |     —     |      **Owner**      |          —          |
| `apps/backend/lidar/`, `docs/api/lidar.*`                                                                                                                                |     —     |          —          |      **Owner**      |
| `apps/frontend/**`                                                                                                                                                       |     —     |          —          |      **Owner**      |
| `docs/agents/task-allocation.md`, `docs/agents/parallel-workflow.md`                                                                                                     | **Owner** |      Read only      |      Read only      |

For `docker-compose.yml` and the root lockfile: Agents 2 and 3 do not edit them. They deliver, for example, `apps/backend/content/compose.fragment.yml` or `apps/frontend/compose.fragment.yml`, and Agent 1 integrates those fragments at merge time. For npm dependencies, they add the line to their own app `package.json` and ask Agent 1 to regenerate the root lockfile.

## Contract frozen at Gate 0

Agent 1 publishes this before the other agents start:

- `ContentId`: opaque UUID string, never interpreted by another service.
- `PublicationStatus`: `draft | published | unpublished`.
- `ClaimStatus`: `unreviewed | verified | uncertain`, tracked separately for the item and for the description.
- `CallerContext`: `userId`, `permissions[]`, `requestId`, propagated by the gateway only.
- Gateway routes: `GET /api/items`, `GET /api/items/:id`, `POST /api/items`, `POST /api/items/:id/media`, `POST /api/items/:id/review`, `POST /api/items/:id/mint`, `GET /api/items/:id/provenance`, `GET /api/items/:id/model3d`.
- Public errors: `{ code, message, requestId }`, with no internal details.
- 3D: `{ contentId, status: ready|processing|missing, variants: { poster, glb1k, glb2k } }`.
- Mint: `pending | confirmed | failed`, with a mandatory idempotency key.

[CONFIRMED] Published in the [platform contract](../specs/platform-contract.md), the [gateway OpenAPI document](../api/gateway.openapi.yaml) and the type-only declarations in [`packages/shared`](../../packages/shared/src/index.ts). They add the auth and operator routes, `SubmissionStatus`, the media and review decision routes and the internal route mapping.

Any change to this contract goes through a pull request titled `[CONTRACT CHANGE]` agreed by all three agents.

## Rhythm and communication

- Every agent comments on its issues with the prefix `[A1]`, `[A2]` or `[A3]`: **Status / Blocker / Contract need**.
- Short 15-minute checkpoints only at Gate 0 and before each integration pull request.
- If an agent is blocked by another one, it neutralizes the blocker with a mock or an adapter and keeps going; it does not stop.
- Every pull request must be green on `lint`, `typecheck`, `test` and `build` before merge.

## Instructions given to each agent

### Agent 1

> You are Agent 1 — Foundations, infrastructure, gateway and Auth.
> Start from `develop`, worktree `.worktrees/agent1`, branch `agent1-foundation`. Never push to `develop` or `main`.
>
> **Your first mission:** publish the small "contract freeze" pull request described above. It is the start condition for Agents 2 and 3. Only then handle `#22`–`#45`, `#29`–`#31`, `#97`, `#46`–`#51`, `#17`.
>
> **You own:** the repository root, `docs/product/`, `docs/decisions/`, `docs/development/`, `docs/api/gateway.*`, `apps/backend/gateway/`, `apps/backend/auth/`, `infrastructure/`.
>
> **You do not modify:** `apps/backend/content/`, `apps/backend/nft/`, `apps/backend/lidar/`, `apps/frontend/`. You integrate their Compose fragments and their dependencies at merge time.
>
> **Expected deliverable:** valid `docker compose config`, a gateway that routes and maps errors, admin token guard, Auth with register/login/logout/guest browsing, and mandatory CI green on `develop`.
>
> **Validation:** `npm run lint`, `npm run typecheck`, `npm test`, `docker compose config`.
>
> **Reporting:** comment on the relevant issues with `[A1] ...`. If a contract must change, open `[CONTRACT CHANGE]` and warn Agents 2 and 3 before changing anything.

### Agent 2

> You are Agent 2 — Content, verification and NFT.
> Start from `develop`, worktree `.worktrees/agent2`, branch `agent2-content-nft`. Never push to `develop` or `main`.
>
> **You consume the contract frozen by Agent 1.** You do not change it. If you need an extra field or route, comment `[CONTRACT CHANGE]` and continue with a local adapter while waiting.
>
> **You handle:** `#52`–`#57`, `#84`–`#87`, `#18`, `#59`–`#64`, `#2`, and `#73` together with Agent 3. Issues `#58`, `#64`, `#87` are documented as deferred, not implemented.
>
> **You own:** `apps/backend/content/`, `apps/backend/nft/`, `docs/api/content.*`, `docs/api/nft.*`. Provide `apps/backend/<service>/compose.fragment.yml` and any dependencies in the service `package.json`, without touching the root lockfile.
>
> **Expected deliverable:** a submitted item, reviewed separately for the item and the description, published, then an idempotent mint linked to its `ContentId` with status and provenance data. No private data on-chain.
>
> **Validation:** unit tests + Prisma integration tests, service OpenAPI contract, Docker build of the service.
>
> **Reporting:** comment with `[A2] ...`. Tell Agent 3 as soon as the verification status and mint status are available for the frontend.

### Agent 3

> You are Agent 3 — UX, frontend, 3D and demo.
> Start from `develop`, worktree `.worktrees/agent3`, branch `agent3-ux-fe-3d`. Never push to `develop` or `main`.
>
> **Build first against the frozen contract mocks.** Do not wait for Agent 2's APIs or Agent 1's gateway: use `VITE_API_MODE=mock` with fixtures matching the contract.
>
> **You handle:** `#65`–`#71`, `#19`, `#20`, `#8`–`#16`, `#6`, `#72`–`#76`, `#21`. Issues already produced in branches such as `3D-01/02` are integrated, not redone.
>
> **You own:** `apps/frontend/`, `apps/backend/lidar/`, `docs/api/lidar.*`, `apps/frontend/docs/`. Provide `apps/frontend/compose.fragment.yml` and `apps/backend/lidar/compose.fragment.yml`, without touching the root lockfile.
>
> **Expected deliverable:** a gallery with lateral movement, item detail, interactive 1K/2K GLB model with poster and still-image fallback, the full journey connected through the gateway, then a validated and tagged demo on `main` through Agent 1.
>
> **Validation:** frontend tests, Vite build, GLB size check, fallback test, desktop and mobile check.
>
> **Reporting:** comment with `[A3] ...`. You orchestrate the final demo pull request once Agent 1 and Agent 2 deliverables are merged.

## Summary

One frozen contract up front, strict file ownership, mocks instead of waiting, fragments instead of root-file conflicts, and a single entry point into `develop`: the pull request.
