# Project decisions

Use this register to see which decisions need endy-rkt, which belong to app or service owners, and when each decision matters. Implementation and evidence gates are tracked in the linked backlog.

## Confirmed

- App and service owners own initialization, implementation, APIs or client integration, tests, Dockerfiles and their root Compose entries. Stateful service owners also own their PostgreSQL data design, Prisma schema and migrations within one shared PostgreSQL instance per environment. [Ownership rules](../team/responsibilities.md#task-ownership)
- Owners choose their internal design, service-local dependencies and testing approach within the shared quality rules. Owners agree cross-service contracts, changes to shared Compose resources and integration timing with the affected owners.
- endy-rkt defines the MVP and system overview. Escalate scope changes, system-wide architecture and security rules, and repository-wide tooling or policy changes to endy-rkt. Agents take direction from the relevant owner.
- **D02 is resolved.** endy-rkt owns the gateway and shared local infrastructure, shidoAdr owns Auth and LiDAR, and Sesedra owns frontend implementation and design. MVP planning proceeds without a deadline. [Team responsibilities](../team/responsibilities.md)
- **D05 storage provider.** SeaweedFS is the local S3-compatible object store, and endy-rkt owns setup. Gateway-mediated media delivery is confirmed; the [storage spike](../architecture/storage-spike.md) records the evidence and two operational conditions. [Data and storage](../architecture/data-storage.md#s3-compatible-option)

## D01 First integrated MVP demo

[CONFIRMED] endy-rkt approved a single-item journey for the first integrated MVP demo. Use the same Content item ID from authenticated submission through human review, publication, guest browsing, interactive 3D and confirmed NFT minting. Frontend application requests go through the dedicated gateway. Auth owns identity and assigned permissions, Content owns review and publication, LiDAR owns 3D asset readiness, and NFT owns token association and confirmation. The item ID and publication status are the handoffs from Content. [Service boundaries](../architecture/services.md)

### Demo script and evidence checklist

Record the evidence against the same item ID under DEMO-03. [Demo backlog](../product/task.md#integration--demo-endy-rkt)

1. [ ] A signed-in contributor submits one item with rights-cleared media, author information and a description. Record the item ID and fixture rights clearance.
2. [ ] As a guest, check that the draft is absent from public browsing and direct access to its detail is denied. An authorized human then records separate outcomes for item claims and description claims before the item is published under the agreed policy. Record both outcomes and the publication status. [D18](#d18-editorial-policy-and-demo-content)
3. [ ] As a guest, find and open the same published item and verify that the applicable item and description review labels match the recorded outcomes.
4. [ ] On each agreed demo device, open the published item detail as a visitor and verify that the associated 3D model loads and rotates in response to input. Record the device and result. A rights-cleared pre-produced model can satisfy this gate. Live phone capture is optional.
5. [ ] An eligible user starts a mint from the same published item and reaches confirmed status on the chosen demo network. Verify that the user can inspect the chain, token and transaction references, and record those references with the item ID. Check that the displayed provenance explains the digital mint event and the scope of its claims. Verify that public token metadata is approved and that it and the on-chain data contain no private media, credentials or personal data.

**Integrated sign-off** requires the full journey with both a working interactive model and a confirmed mint in the same run. Record both results under DEMO-03.

If either gate is unavailable, label the run **Rehearsal** and record each missing gate. A still image can support a rehearsal. During DEMO-03, check the outcome for each gate independently. A still image in place of the model or a pending or failed mint in place of confirmation requires the rehearsal label and the corresponding missing gate, even when the other gate passes.

## D14 Shared contracts and build context

[CONFIRMED] Decision owner endy-rkt approved D14 for endy-rkt-02. Affected owners are endy-rkt (gateway), Sesedra (frontend), shidoAdr (Auth and LiDAR), papangoo (Content & Verification) and salandri-42 (NFT). Affected-owner feedback is pending and tracked under [endy-rkt-08](../product/task.md#endy-rkt-foundation) for shared contracts and build inputs. endy-rkt approved recording the decision while that feedback is pending.

API producers own their OpenAPI contracts in `docs/api/` and agree changes with affected consumers. endy-rkt owns the public gateway contract and shared conventions. Favor backward-compatible changes and keep public gateway errors safe. Add `packages/shared` only for transport declarations needed by multiple consumers, using type-only imports including any common error type. Keep runtime validators, clients, business rules and persistence models with their owners. This limits release coupling and keeps the gateway as the frontend's sole application entry point. [Contracts and public errors](../architecture/services.md#contracts-and-shared-package)

Use the repository root as context for builds that need the shared package, the root npm lockfile or any other root input. Allow app-local context when all required inputs are app-local. Keep Dockerfiles in their owning app or service directories and use context-appropriate ignore files. Exclude credentials and local artifacts, test shared-input changes in each dependent workspace and include each affected image in the Docker CI rebuild scope. This gives each image its declared inputs and keeps runtime packaging independent. [Dockerfile and Compose conventions](../architecture/services.md#dockerfile-placement) · [System overview](../architecture/overview.md#future-deployment)

## D15 Node and npm workspace runtime

[CONFIRMED] Decision owner endy-rkt approved D15 for endy-rkt-02. Affected owners are endy-rkt for the foundation, gateway and CI, and Sesedra, shidoAdr, papangoo and salandri-42 for their workspaces and Docker builds. Their adoption feedback is pending under [endy-rkt-20](../product/task.md#endy-rkt-ci-follow-up).

Keep Node 22, matching the current CI major. Pin one exact patch in `.nvmrc`, have CI read it, align Node-based Docker stages to it and declare `engines.node` as `>=22 <23`. Use the npm version bundled with the selected patch by default, pin its exact version in the root `packageManager` field and use that version for local, CI and container installs. Use root `npm ci` with one committed root `package-lock.json` and a private npm workspace covering `apps/frontend`, `apps/backend/*` and `packages/*`. Defer mise. A single Node/npm pair and lockfile keep installs reproducible with one runtime selection file. [Runtime and workspace workflow](../development/workflow.md#runtime-and-workspaces)

[endy-rkt-07](../product/task.md#endy-rkt-foundation) owns the usable foundation and coordinates scaffolding using the runtime and manifest delivered below. [endy-rkt-18](../product/task.md#endy-rkt-ci-follow-up) selects and validates the exact Node/npm pair against the scaffold toolchain, owns `.nvmrc` and CI alignment, and supplies the engine and package manager values. [endy-rkt-19](../product/task.md#endy-rkt-ci-follow-up) owns the initial root manifest and lockfile and incorporates those values in one coordinated root manifest change. Workspace owners align their engines and Docker stages as they adopt the foundation.

## D17 Quality tooling and CI rollout

[CONFIRMED] Decision owner endy-rkt approved D17 for endy-rkt-02. Affected owners are endy-rkt for root tooling, CI and the gateway, and Sesedra, shidoAdr, papangoo and salandri-42 for workspace checks. Their adoption feedback is pending under [endy-rkt-20](../product/task.md#endy-rkt-ci-follow-up). endy-rkt approved recording D15 and D17 while that feedback is pending.

Keep the existing root configs and pin the documented quality dependencies. Share `npm run lint` and `npm run format:check` between local use and CI after the scripts land. Require zero ESLint warnings and explicitly select `.prettierrc.json`. Every initialized workspace, including a future shared package, provides `typecheck`, `test` and `build` and extends the shared TypeScript base in a project that covers linted files. Missing or failing scripts block CI. Using the same scripts keeps local and hosted checks consistent. [Tooling workflow](../development/workflow.md#quality-checks) · [CI script contract](../development/code-policy.md#ci-script-contract)

endy-rkt-19 alone installs and pins the initial root dependencies and owns the initial manifest and lockfile. [endy-rkt-13](../product/task.md#endy-rkt-code-quality-follow-up) consumes those pins and adds only root scripts. It does not repeat dependency installation. Reconcile the older endy-rkt-13 backlog wording in separate backlog work. Use npm scripts first, defer Husky and lint-staged to endy-rkt-16 if approved, and require separate endy-rkt approval for thin Taskfile wrappers.

Keep the same-repository `develop`-to-`main` guard and Gitleaks blocking. Keep full-history push and manual scans until there is a trusted baseline. Use a high-threshold advisory runtime audit and triage its findings before revisiting severity. Placeholder skips give no workspace evidence. endy-rkt-21 verifies the hosted checks with initialized workspaces. Then endy-rkt-12 and endy-rkt-22 apply and verify protections with `ci-ok` as the sole required check and one approval. Use the approved [GitHub rollout settings](#github-rollout-settings). Defer CODEOWNERS to endy-rkt-24, CodeQL until app code and triage capacity exist, PostgreSQL CI to endy-rkt-23 and Docker CI until Dockerfiles exist. [CI baseline and rollout](../development/ci.md)

## D04 PostgreSQL isolation

[CONFIRMED] Use one shared PostgreSQL instance with a separate database and service-scoped migration and runtime roles for Auth, Content, NFT and LiDAR. Runtime roles receive only their service's required grants. Each owner maintains its Prisma schema and migrations. Agree provisioning and verify isolation in INFRA-01. [Data ownership](../architecture/data-storage.md#postgresql-isolation)

## D05 Media delivery

[CONFIRMED] Use gateway-mediated media delivery for the MVP. endy-rkt-03 validated SeaweedFS with representative video and 3D assets: scoped bucket access, private reads, ranged reads, deletion and restart persistence all passed, and the [storage spike](../architecture/storage-spike.md) records the method and limits. Keep object storage private and authorize against current item or asset visibility. Two operational conditions remain, neither of which reopens the delivery decision: the filer and STS signing key for `security.toml`, and free disk headroom on the host. [Storage and delivery](../architecture/data-storage.md#s3-compatible-option)

## D06 Gateway deployment boundary

[CONFIRMED] Use the dedicated NestJS gateway as the public application API and defer Nginx. The gateway owns routing, edge validation and public error mapping. Service owners retain resource authorization. Coordinate the contracts in endy-rkt-08 before gateway integration. [Gateway design](../architecture/overview.md#gateway-and-networking)

## D07 Identity propagation and logout

[CONFIRMED] Auth owns revocable opaque sessions. The gateway verifies the session on protected requests. Auth and Gateway still need to agree on caller context, service authentication, expiry, logout and error semantics under endy-rkt-08. Owning services enforce resource authorization. [Gateway design](../architecture/overview.md#gateway-and-networking)

## D13 Permissions

[CONFIRMED] Guests can read published items. Use one signed-in account model, a scoped reviewer permission and resource ownership checks. Confirm the action-level permission matrix with Auth, Content, NFT and Gateway under endy-rkt-05 and verify it in service tests. [MVP authentication](../product/MVP.md#a-authentication)

## D16 System-wide async infrastructure

[CONFIRMED] Start with synchronous HTTP and gateway status polling. endy-rkt-06 validated the baseline against salandri-42's NFT and shidoAdr's 3D proposals: no queue, broker or Redis is deployed; the NFT mint runs as an in-process, restart-safe worker whose status is read over HTTP; and 3D preparation stays offline with the asset status served by LiDAR. Revisit shared async infrastructure only if a cross-service need is measured. [Communication](../architecture/overview.md#communication-and-long-running-work)

## D18 Editorial policy and demo content

[CONFIRMED] Before publication, require rights clearance and separate human review of item and description claims. The Content owner proposes permitted formats, size limits and reviewer coverage and confirms demo fixtures. See endy-rkt-05 and DEMO-02. [MVP verification](../product/MVP.md#b-content-and-verification)

## DEMO-01 Demo host

[CONFIRMED] The demo host is the staging VPS at <https://lova.forastech.duckdns.org>, verified on 2026-11-22: `/api/health` reports Auth, Content, NFT and LiDAR up, `/api/items` lists the five reviewed demo works, `/api/auth/me` rejects guests with 401, and TLS uses a Let's Encrypt certificate behind Caddy in front of nginx. The presenter-laptop Compose setup stays as the offline fallback and follows the D01 rehearsal policy if either environment is unavailable. Confirm reachability from a second mobile device and public metadata resolution before integrated sign-off. [Demo evidence](#demo-script-and-evidence-checklist)

## GitHub rollout settings

[CONFIRMED] Apply protection after hosted `ci-ok` exercises initialized workspaces. Use one review, no routine admin bypass, strict branch updates on `main` and looser updates on `develop`. Squash topic PRs into `develop` and use merge commits for promotions to `main`. Reviewer coverage and CODEOWNERS remain open under endy-rkt-24. [CI rollout](../development/ci.md#repository-settings-checklist)

## Decisions already delegated

- **D08–D11:** resolved in [ADR 0003](0003-d08-d11-nft-choices.md) under NFT-01 ([#59](https://github.com/songomby-D1/devfest2026/issues/59)) and endy-rkt-06 ([#27](https://github.com/songomby-D1/devfest2026/issues/27)): Avalanche Fuji C-Chain, ERC-721 with one token per item, a custodial gallery wallet, and the minimal `PreservingArt` contract with content-addressed metadata. Two gates stay recorded before the choice counts as demonstrated: salandri-42's confirmation and the Fuji signing, confirmation and metadata run. Reconcile the [service proposal](../../apps/backend/nft/nft_context.md) with D01, D05, D13 and D16.
- **D12:** resolved in [ADR 0001](0001-d12-3d-demo-experience.md), accepted. Use an offline-prepared GLB at 1K by default and 2K on demand with a poster and still-image fallback. Viewer and asset contracts and real-device verification remain with the affected owners.
- **Service-local work:** Owners can proceed with approved work on their own API, schema, tests and packaging while the team resolves unrelated shared decisions. A shared dependency only blocks work that needs it.
