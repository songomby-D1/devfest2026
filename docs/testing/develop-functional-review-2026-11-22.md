# Functional review of `develop` (2026-11-22)

[CONFIRMED] Claude reviewed `develop` at `3d24c29` for functional correctness by reading the code, at rivon0507's request. The affected owners approved recording these findings. Fixes are follow-up work for each owner.

[NOT IMPLEMENTED] No checks were run: `npm ci` failed because the machine had no network access. Each finding comes from reading the code and should be confirmed with a test when it is fixed.

## Findings

Findings are ordered from most to least serious.

### F1. LiDAR's publication check calls a route Content does not have

- **Owner:** shidoAdr (LiDAR). **Affects:** 3D-04b ([#12](https://github.com/songomby-D1/devfest2026/issues/12)), the D01 interactive 3D gate.
- **Where:** `apps/backend/lidar/src/assets/http-content-directory.ts:41-49`.
- **Defect:** `HttpContentDirectory.isPublished` calls `GET {CONTENT_SERVICE_URL}/contents/:id` without `x-service-name` and `x-service-token`. Content serves the lookup at `GET /internal/v1/items/:id/publication`, behind `ServiceTokenGuard`, and answers `{ contentId, publicationStatus }` (`apps/backend/content/src/items/items.controller.ts:118`). `apps/backend/lidar/src/config/app-config.ts` has no setting for the outbound token.
- **Effect:** Content answers `404` for the unknown route, which LiDAR reads as "not published":
  - `POST /assets` always answers `422`, so no asset can be registered against the real Content.
  - `GET /files/:assetId/:variant` always answers `404`, so the gateway's `/api/lidar/files/...` never serves a model.
- **Why the tests pass:** the LiDAR tests use a fake `ContentDirectory`.
- **Fix direction:** call `/internal/v1/items/:id/publication` with `x-service-name: lidar` and a token from `SERVICE_TOKEN_LIDAR_TO_CONTENT`. Parse `publicationStatus`, and add the token to LiDAR's config and root Compose.

### F2. Root Compose cannot start Content or NFT

- **Owner:** endy-rkt (root `docker-compose.yml`), with papangoo and salandri-42 for the fragments.
- **Where:** `docker-compose.yml`, the `content` and `nft-service` entries. The missing settings are in `apps/backend/content/compose.fragment.yml` and `apps/backend/nft/compose.fragment.yml`.
- **Defect and effect:**
  - Content requires `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID` and `STORAGE_SECRET_ACCESS_KEY` (`apps/backend/content/src/config/app-config.ts:128-149`). The root entry sets none of them, so Content fails its config check at boot.
  - NFT's `docker-entrypoint.sh` exits when `MIGRATION_DATABASE_URL` is unset. The root entry does not set it, and `apps/backend/nft/.env` is copied from the example without generated values. `DATABASE_URL`, `NFT_INBOUND_TOKEN_GATEWAY` and `CONTENT_SERVICE_TOKEN` are therefore empty, so NFT cannot reach its database and the gateway and Content calls are refused.
  - The root entry builds the NFT `development` stage, not `runtime`.
- **Fix direction:** merge both fragments into the root file, as the handoff already requests.

### F3. The gateway has no routes for item edits, unpublish and media changes

- **Owner:** endy-rkt (gateway contract), with papangoo.
- **Where:** `apps/backend/gateway/src/http/items.controller.ts`.
- **Defect:** Content serves `PATCH /internal/v1/items/:id`, `POST /internal/v1/items/:id/unpublish`, and `PUT` and `DELETE /internal/v1/items/:id/media/:mediaId`. The gateway exposes none of them.
- **Effect:** an owner whose submission is returned cannot fix it, so `return` is a dead end. A reviewer cannot unpublish, and an owner cannot replace or remove media.
- **Fix direction:** decide the `[CONTRACT CHANGE]` already listed in the handoff, then add the routes.

### F4. `GET /api/nft/*` forwards to routes NFT does not have

- **Owner:** endy-rkt (gateway).
- **Where:** `apps/backend/gateway/src/http/items.controller.ts:213-222`.
- **Defect:** the route forwards to `/nft/...`. The NFT service only serves `/internal/v1/...` and `/health`, so the route always answers `404`.
- **Fix direction:** remove the route, or point it at an agreed NFT route, such as the requester's `GET /internal/v1/mints/:mintId`.

### F5. LiDAR reports `ready` for items that are no longer published

- **Owner:** shidoAdr (LiDAR).
- **Where:** `apps/backend/lidar/src/assets/assets.service.ts:29-33`.
- **Defect:** `findDisplayByContentId` does not check publication, while file delivery does.
- **Effect:** after an item is unpublished, `GET /api/items/:id/model3d` still answers `ready` with URLs that all return `404`. It also tells guests that a 3D model exists for a non-public item.
- **Fix direction:** check publication in the lookup and answer `none` when the item is not published. This depends on F1.

### F6. The frontend API client diverges from the frozen contract

- **Owner:** Sesedra (frontend). **Affects:** FE-03 ([#70](https://github.com/songomby-D1/devfest2026/issues/70)), FE-04 ([#71](https://github.com/songomby-D1/devfest2026/issues/71)).
- **Where:** `apps/frontend/src/lib/api/contract.ts` and `http-client.ts`, compared with `packages/shared/src/content.ts` and `provenance.ts`.
- **Defect:**
  - `createItem` sends `{ title, description }`, but Content requires `kind`, `rightsStatement` and `rightsConfirmed`, so it answers `400`.
  - `reviewItem` sends `{ item, description }`, but the contract is `{ target, outcome, rationale, evidence }`.
  - `listItems` expects `Item` with `description` and `imageUrl`, but the gateway returns `ItemSummary` with `thumbnailUrl`.
  - `Provenance.mint` is typed as a status string, but it is a `MintRecord` object.
  - `Model3d.variants` is optional, but the gateway sends `null`.
  - There are no calls for the publish decision or for `/api/auth/*`.
- **Effect:** none today, because no screen uses the client yet. It fails as soon as FE-03 or FE-04 wires it in.
- **Fix direction:** import the types from `@devfest2026/shared` instead of keeping a separate copy.

## Reviewed with no finding

- **Auth:** registration, login timing, session idle and absolute expiry, revocation, permission grants.
- **Gateway:**
  - session resolution, which falls back to guest on optional routes and fails closed on required ones
  - header rebuilding and Origin check
  - upload size limits, wildcard path sanitizing, error mapping
- **Content:**
  - visibility rules, owner-only edits, claim resets on material changes
  - review, return, reject and publish rules under the item row lock
  - cursor pagination, media authorization and range delivery
- **NFT:**
  - idempotent mint start, publication and ownership checks
  - the serial worker with restart-safe reconciliation
  - provenance, which answers `404` for unpublished items and gives up on chain reads at the timeout
- **Frontend:** the 3D viewer state machine and retry cache key.
