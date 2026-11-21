# Platform contract (Gate 0)

[CONFIRMED] Frozen by Agent 1 at Gate 0 of the [parallel workflow](../agents/parallel-workflow.md#contract-frozen-at-gate-0). Agents 2 and 3 build against this page, the [gateway OpenAPI document](../api/gateway.openapi.yaml) and the type-only declarations in [`packages/shared`](../../packages/shared/src/index.ts). Any change goes through a pull request titled `[CONTRACT CHANGE]` agreed by the three agents.

The contract applies the approved decisions: gateway as the sole entry point (D06), revocable opaque sessions and caller context (D07), guest browsing with a scoped reviewer permission (D13), producer-owned OpenAPI and type-only shared declarations (D14), synchronous HTTP with polling (D16) and separate human review of item and description claims (D18).

## Shared vocabulary

| Name                | Definition                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ContentId`         | Opaque UUID string created by Content. Other services store and forward it and never parse it.                                                             |
| `PublicationStatus` | `draft \| published \| unpublished`. Only `published` items are visible to guests.                                                                         |
| `SubmissionStatus`  | `in_review \| returned \| rejected \| accepted`. Tells the contributor what happened to the submission. `accepted` goes with `published` or `unpublished`. |
| `ClaimStatus`       | `unreviewed \| verified \| uncertain`, tracked separately for the item claims and for the description claims. Automated signals never change it.           |
| `Permission`        | `reviewer` is the only MVP permission. Ownership is checked by the owning service.                                                                         |
| `CallerContext`     | `{ userId, permissions[], requestId }`. `userId` is the Auth account ID, or `null` for a guest. Only the gateway creates it.                               |
| `Model3dStatus`     | `ready \| processing \| missing`.                                                                                                                          |
| `MintStatus`        | `pending \| confirmed \| failed`. A mint request needs an `Idempotency-Key`.                                                                               |

## Public gateway routes

Every application request from the frontend goes to the gateway under `/api`. The gateway authenticates the session, builds the caller context and forwards the request. The owning service enforces ownership, reviewer rights and business rules.

| Method and path                       | Session  | Owner   | Purpose                                                               |
| ------------------------------------- | -------- | ------- | --------------------------------------------------------------------- |
| `POST /api/auth/register`             | none     | Auth    | Create an account. Does not open a session.                           |
| `POST /api/auth/login`                | none     | Auth    | Open a session and set the session cookie.                            |
| `POST /api/auth/logout`               | optional | Auth    | Revoke the session and clear the cookie. Idempotent.                  |
| `GET /api/auth/me`                    | required | Auth    | Read the signed-in account.                                           |
| `GET /api/items`                      | optional | Content | List items. `scope=public` (default), `mine` or `review`.             |
| `GET /api/items/{id}`                 | optional | Content | Read one item. Guests only see published items.                       |
| `POST /api/items`                     | required | Content | Submit a new item record.                                             |
| `POST /api/items/{id}/media`          | required | Content | Upload one image or video (`multipart/form-data`, field `file`).      |
| `GET /api/items/{id}/media/{mediaId}` | optional | Content | Stream a media file. Supports `Range`.                                |
| `POST /api/items/{id}/review`         | required | Content | Record a claim review. Reviewer only, never on one's own submission.  |
| `POST /api/items/{id}/decision`       | required | Content | Publish, return or reject a submission. Reviewer only.                |
| `POST /api/items/{id}/mint`           | required | NFT     | Request a mint for a published item. Needs `Idempotency-Key`.         |
| `GET /api/items/{id}/provenance`      | optional | NFT     | Read the mint status and provenance references. Poll while `pending`. |
| `GET /api/items/{id}/model3d`         | optional | LiDAR   | Read the 3D descriptor.                                               |
| `GET /api/lidar/files/{path}`         | optional | LiDAR   | Stream a 3D variant or poster referenced by the descriptor.           |
| `GET /api/nft/{path}`                 | optional | NFT     | Read-only NFT records (NFT spec §10.4).                               |
| `GET /api/health`                     | none     | Gateway | Gateway liveness and upstream reachability.                           |

Operator routes use the `x-admin-token` header instead of a session and are not called by the frontend.

| Method and path                 | Owner | Purpose                                     |
| ------------------------------- | ----- | ------------------------------------------- |
| `PUT /api/admin/permissions`    | Auth  | Grant `reviewer` to an account by email.    |
| `DELETE /api/admin/permissions` | Auth  | Revoke `reviewer` from an account by email. |

## Payloads

The [`packages/shared`](../../packages/shared/src/index.ts) declarations are the reference for every body. In summary:

- **Item.** `ItemSummary` carries the ID, title, kind, creator name, origin, period, thumbnail URL, `publicationStatus`, `submissionStatus` and `claims: { item, description }`. `ItemDetail` adds the description, creator details, rights statement, media list, latest claim reviews and, for reviewers and the owner only, advisory signals.
- **Review.** `{ target: 'item' | 'description', outcome: 'verified' | 'uncertain', rationale, evidence[] }`.
- **Decision.** `{ decision: 'publish' | 'return' | 'reject', note }`. Publishing requires both claims to be reviewed and the rights to be confirmed.
- **3D.** `{ contentId, status, variants: { poster, glb1k, glb2k } | null }`. Variants are gateway-relative URLs and `null` unless `status` is `ready`.
- **Mint.** `{ mintId, contentId, status, network, tokenId, transactionHash, explorerUrl, failureReason, requestedAt, confirmedAt }`. Chain fields are `null` until known. Repeating a request with the same key returns the same mint.
- **Provenance.** `{ contentId, mint, scope }`. `scope` is a safe sentence that says what the record establishes and what it does not.

## Public errors

Every gateway error body is `{ code, message, requestId }`, plus `details: [{ field, reason }]` for `VALIDATION_FAILED`. `message` is safe to display. Stack traces, upstream bodies, credentials, emails, tokens and object keys never appear.

| Status | Codes                                                                             |
| ------ | --------------------------------------------------------------------------------- |
| 400    | `VALIDATION_FAILED`, `IDEMPOTENCY_KEY_REQUIRED`                                   |
| 401    | `UNAUTHENTICATED`, `INVALID_CREDENTIALS`                                          |
| 403    | `FORBIDDEN`, `FORBIDDEN_ORIGIN`                                                   |
| 404    | `NOT_FOUND`                                                                       |
| 409    | `EMAIL_ALREADY_REGISTERED`, `CONFLICT` and service-specific conflict codes        |
| 413    | `PAYLOAD_TOO_LARGE`                                                               |
| 415    | `UNSUPPORTED_MEDIA_TYPE`                                                          |
| 422    | `UNPROCESSABLE` and service-specific rule codes                                   |
| 429    | `RATE_LIMITED`, with `Retry-After`                                                |
| 502    | `UPSTREAM_ERROR`                                                                  |
| 503    | `AUTH_UNAVAILABLE`, `CONTENT_UNAVAILABLE`, `NFT_UNAVAILABLE`, `LIDAR_UNAVAILABLE` |
| 500    | `INTERNAL_ERROR`                                                                  |

The gateway forwards a service's `code` and `message` for 4xx responses that already use this shape. It replaces any other 4xx body with the generic code for its status. A timeout, a refused connection or an upstream `503` becomes `503 <SERVICE>_UNAVAILABLE`, any other upstream 5xx becomes `502 UPSTREAM_ERROR`, and the request is not retried. An upstream `SERVICE_UNAUTHENTICATED` is a gateway configuration fault and also becomes `502 UPSTREAM_ERROR`.

## Sessions and browser security

- Login sets an `HttpOnly`, `SameSite=Lax`, `Path=/` cookie named `lova_session`. Deployed HTTPS environments set `Secure` and use the `__Host-lova_session` name. Logout clears it.
- Sessions expire after 2 hours without use and 7 days after creation, as in the [Auth contract](auth-contract.md).
- State-changing requests from a browser must carry an `Origin` that is in `GATEWAY_ALLOWED_ORIGINS`. A request that carries the session cookie but no `Origin` or `Referer` is rejected with `403 FORBIDDEN_ORIGIN`.
- Login and registration are rate limited per client address. Exceeding the limit returns `429 RATE_LIMITED`.
- The frontend calls the gateway on the same origin through its development proxy, or from an origin listed in `GATEWAY_ALLOWED_ORIGINS` with credentials.

## Service-to-service rules

The gateway forwards Content routes to `/internal/v1/items...` on Content with the same method, remaining path, query and body. NFT receives `POST /internal/v1/mints` with `{ contentId }` and the `Idempotency-Key` header, and `GET /internal/v1/provenance/{contentId}`. LiDAR receives `GET /assets/by-content/{contentId}` and `GET /files/{path}`, and the gateway maps its answer to the 3D descriptor above.

Each internal request carries these headers. The gateway removes any client-supplied copy first.

| Header                 | Value                                                 |
| ---------------------- | ----------------------------------------------------- |
| `x-service-name`       | Calling service: `gateway`, `nft` or `lidar`.         |
| `x-service-token`      | Secret for this caller and receiver pair.             |
| `x-caller-user-id`     | Account ID of the signed-in user. Absent for a guest. |
| `x-caller-permissions` | Comma-separated permissions, empty when none.         |
| `x-request-id`         | Correlation ID, created by the gateway when missing.  |

A receiver authenticates the pair (`x-service-name`, `x-service-token`) and answers `401 SERVICE_UNAUTHENTICATED` otherwise. It trusts `x-caller-*` headers only from `gateway`. A service that calls another one for a user relays the caller headers unchanged. Root `.env.example` lists one secret per pair, such as `SERVICE_TOKEN_GATEWAY_TO_CONTENT`.

NFT and LiDAR confirm an item's publication with `GET /internal/v1/items/{id}/publication` on Content, which returns `{ contentId, publicationStatus }` or `404`.

## Ownership and change process

| Artefact                                                                            | Owner   |
| ----------------------------------------------------------------------------------- | ------- |
| This page, [`gateway.openapi.yaml`](../api/gateway.openapi.yaml), `packages/shared` | Agent 1 |
| Content and NFT internal OpenAPI documents                                          | Agent 2 |
| LiDAR internal OpenAPI document and frontend usage                                  | Agent 3 |

Producers may add optional response fields without a contract change. Removing or renaming a field, changing a status or adding a required request field requires a `[CONTRACT CHANGE]` pull request. Until it merges, keep working with an adapter or a mock.
