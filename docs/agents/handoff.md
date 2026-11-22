# Current handoff

[CONFIRMED] The backend layout is `apps/backend/<service>/`. The gateway, auth, content, nft and lidar directories are placeholders. See the [backlog](../product/task.md) for owners and dependencies.

## Latest session: CONTENT-02 publication and browsing (rivon0507, Agent 2)

- [PROPOSED] CONTENT-02 ([#53](https://github.com/songomby-D1/devfest2026/issues/53)) on the Content service: `POST /internal/v1/items/{id}/decision` (`publish` only; reviewer other than the submitter; needs both claims reviewed and `rightsConfirmed`, else `422` rule codes), `POST /internal/v1/items/{id}/unpublish` (reviewer), republish of an unpublished item, `GET /internal/v1/items?scope=public|mine|review&kind&q&cursor&limit` with keyset pagination on (`createdAt`, `id`), and `GET /internal/v1/items/{id}/publication` for NFT and LiDAR only. Migration `20261122120000_publication` adds `publication_events` (reviewer, action, note) and listing indexes. Contract: [content.yaml](../api/content.yaml).
- [DECISION REQUIRED: papangoo, endy-rkt] Publication trigger: implemented through the Gate 0 `/decision` route; S3 (automatic publication after the last review) would reuse `ItemsService.publish` from CONTENT-04. Listing follows the Gate 0 `scope` parameter rather than S4's `?owner=me&status=pending_review`. Unpublish has no gateway route yet. NFT ownership checks (S1) need the owner in the lookup or a relayed caller check.
- [NOT IMPLEMENTED] `return` and `reject` decisions and moving an edited `accepted` item back into the review queue (CONTENT-04), thumbnails (CONTENT-03).

## Earlier session: CONTENT-05c advisory-signal contract (rivon0507, Agent 2)

- [PROPOSED] CONTENT-05c ([#86](https://github.com/songomby-D1/devfest2026/issues/86)): the [AI-assisted analysis spike](../architecture/ai-assisted-analysis-spike.md#advisory-signal-contract-content-05c) proposes an append-only `advisory_signals` table keyed by ContentId and target (`item` or `description`), its fields, invariants (never changes a claim status, never a gate, stale on material change), privacy, failure modes, the reviewer panel and a sketched API. The 05a and 05b sections are placeholders.
- [DECISION REQUIRED: papangoo, endy-rkt, Sesedra] Confirm the contract (papangoo), the clearance and the additive `[CONTRACT CHANGE]` on `AdvisorySignal` with a nullable `score` (endy-rkt), and the reviewer panel (Sesedra). Questions are listed in the report.

## Earlier session: CONTENT-01 items, authors and descriptions (rivon0507, Agent 2)

- [PROPOSED] CONTENT-01 ([#52](https://github.com/songomby-D1/devfest2026/issues/52)): `apps/backend/content/` is a standalone NestJS 11 service on Node 22 with Prisma 7.10.1 and its first migration (`authors`, `items`, `descriptions`). The item ID is the ContentId, `publicationStatus` defaults to `draft`, and claim status is stored separately on the item and on its description. Internal routes: `POST /internal/v1/items`, `GET /internal/v1/items/{id}` and `PATCH /internal/v1/items/{id}`, behind a per-caller service-token guard, with the `{ code, message, requestId }` error shape. Bodies follow the Gate 0 contract on `agent1-foundation` (`CreateItemRequest`, `ItemDetail`). Contract: [content.yaml](../api/content.yaml). Compose: `apps/backend/content/compose.fragment.yml` for Agent 1.
- [DECISION REQUIRED: papangoo] Confirm the proposed acceptance criteria in the PR, the 1:1 author-per-item model, the claim reset on material edits (D18) and the edit rule (owner only, not while published).
- [DECISION REQUIRED: endy-rkt] Contract needs: a gateway route for `PATCH /api/items/{id}`, and the caller header name (`x-caller-user-id` in the platform contract, `x-caller-account-id` in the Auth contract; Content accepts both).
- [NOT IMPLEMENTED] Media (CONTENT-03), reviews and rights clearance (CONTENT-04); listing and publication landed with CONTENT-02. Switch to the root workspace and lockfile when endy-rkt-19 lands.

## Earlier session: 3D-04c file storage and delivery (Agent 3, for rivon0507)

- [PROPOSED] 3D-04c ([#13](https://github.com/songomby-D1/devfest2026/issues/13)), stacked on PR #101: the LiDAR service stores the 3D-04a outputs in an S3-compatible bucket and streams them at `GET /files/{assetId}/{variant}` with Range (206/416), HEAD, immutable caching and the `{ code, message, requestId }` error shape. Uploads go through `PUT /assets/{assetId}/files/{variant}` behind the interim admin token. See [the OpenAPI contract](../api/lidar.yaml).
- [NOT IMPLEMENTED] The gateway route `/api/lidar/files/*` (Agent 1), the SeaweedFS service and the LiDAR bucket and credentials (Agent 1, D05), and the merge of `apps/backend/lidar/compose.fragment.yml`.
- [DECISION REQUIRED: Agent 1] The display response of #101 does not yet match the frozen 3D contract (`missing` and `glb1k`/`glb2k`). The gateway adapts it, or a follow-up aligns it.

## Earlier session: open-question settlements (rivon0507)

- [PROPOSED] [ADR 0002](../decisions/0002-open-question-settlements.md) gathers every open question from the Auth contract, the UX-01 journey, the 3D spike and the pending decisions into 22 proposed settlements (S1–S22) chosen by rivon0507, each with the owner who confirms it. Source documents are unchanged.
- [DECISION REQUIRED: endy-rkt, papangoo, salandri-42, shidoAdr, Sesedra] Confirm or amend your rows. Key items: owner-only mint with a custodial wallet (S1, S2), automatic publication after review (S3), the `GET /api/items` filters that need a `[CONTRACT CHANGE]` (S4), and the decision register winning over the NFT spec (S20).

## Earlier session: UX-01 primary user journey (rivon0507, Agent 3)

- [PROPOSED] UX-01 ([#65](https://github.com/songomby-D1/devfest2026/issues/65)): drafted the [primary user journey](../../apps/frontend/docs/user-journey.md) with personas, the eight journey steps, screens, the gateway route behind each step, states (loading, empty, error, 3D processing and missing, mint pending, confirmed and failed), desktop and mobile notes and proposed acceptance criteria.
- [DECISION REQUIRED: Sesedra] Confirm or amend the journey before UX-02. Open questions Q1 to Q6 in the document go to papangoo, endy-rkt and salandri-42, notably the missing publish route (Q1) and caller-scoped item lists (Q2). The frozen contract is unchanged.

## Earlier session: NFT lot L0 (salandri-42)

- [IMPLEMENTED] NFT-07, lot L0 of the [NFT spec](../../apps/backend/nft/nft_context.md), merged into `develop` through [#100](https://github.com/songomby-D1/devfest2026/pull/100) with endy-rkt's approval. `apps/backend/nft/` is a standalone npm project with its own lockfile until endy-rkt-19 delivers the root workspace. It contains a NestJS 11 skeleton on Node 22 (D15) and TypeScript 5.9.3, the validated environment of spec §9.8 without Redis, a minimal `GET /health`, a Dockerfile with `development` and `runtime` targets built from the repository root, and the `nft-service` entry in the root Compose file without published ports.
- Checks run: `npm run typecheck`, 32 Jest tests, `nest build` and a Prettier check passed. The shared ESLint config from #99, run with the root tool versions in a scratch install, reports no errors or warnings. The runtime image runs as `node` without dev tools and reports healthy. `docker compose up --wait nft-service` reported healthy. A missing variable stops the service with exit code 1 and names the variable without its value.
- [NOT IMPLEMENTED] When endy-rkt-19 lands the root workspace and lockfile, delete `apps/backend/nft/package-lock.json` and `.npmrc`, run `npm install` at the root and switch the Dockerfile to the root `npm ci`. Align the Docker image and engines to the exact Node patch from endy-rkt-18.
- [DECISION REQUIRED: salandri-42] The [decision register](../decisions/project-decisions.md) resolves gaps E3 to E6 of spec §4.0.4 against the spec's assumptions: synchronous HTTP with gateway polling instead of a shared Redis queue (D16), an NFT database with Prisma (D04), SeaweedFS media instead of a shared volume (D05) and a mint started by an eligible user (D01, D13). Reconcile spec §3 and lots L2, L3, L6 and L7 under NFT-01 and endy-rkt-06 before L2. Runtime validators stay in the NFT service rather than a shared package (D14). Prisma is not set up yet. Lot L1, the smart contract, is unaffected.
- [HUMAN] salandri-42 creates a dedicated testnet wallet, gets Fuji test AVAX, creates a Pinata account and JWT, and fills `apps/backend/nft/.env` from `.env.example`.
- Next: lot L1, the smart contract.

## Earlier session: Auth contract (shidoAdr)

- [PROPOSED] AUTH-01 to AUTH-07 ([#46](https://github.com/songomby-D1/devfest2026/issues/46)–[#51](https://github.com/songomby-D1/devfest2026/issues/51), [#97](https://github.com/songomby-D1/devfest2026/issues/97)): drafted the [Auth contract specification](../specs/auth-contract.md) for endy-rkt-05 and endy-rkt-08. It covers the internal Auth API, opaque sessions with a 2 h idle and 7-day absolute limit, the caller-context headers, per-pair service secrets, the D13 permission matrix and the error shape, with 16 acceptance criteria.
- [DECISION REQUIRED: endy-rkt] Confirm the header names, service secrets, public routes, CSRF safeguard and rate limits. Open questions for papangoo and salandri-42 are listed in the spec.
- [NOT IMPLEMENTED] No Auth code exists. AUTH-07 waits on endy-rkt-07 and INFRA-01.

## NestJS lint compatibility

- On `fix/nestjs-eslint-rules`, [the ESLint override](../../eslint.config.mjs) allows decorated empty classes and disables class-instance assignment linting for backend TypeScript. Undecorated empty classes still fail. Frontend TypeScript and backend JavaScript retain their existing rules.
- Temporary NestJS fixtures passed in all five backend paths using ESLint 9.39.5 and TypeScript 6.0.3. The root workspace checks still depend on the root tooling rollout.

## Earlier session: CONTENT-05 status (papangoo)

- [CONFIRMED] CONTENT-05 ([#57](https://github.com/songomby-D1/devfest2026/issues/57)) and CONTENT-05a ([#84](https://github.com/songomby-D1/devfest2026/issues/84)) move to In progress. CONTENT-05b ([#85](https://github.com/songomby-D1/devfest2026/issues/85)) stays Groomed and CONTENT-05c ([#86](https://github.com/songomby-D1/devfest2026/issues/86)) stays Backlog.
- [CONFIRMED] D18 is confirmed in the [decision register](../decisions/project-decisions.md#d18-editorial-policy-and-demo-content), so these rows no longer wait on it. [DECISION REQUIRED: endy-rkt] Explicit clearance is still required before cultural media is sent to an external AI API. papangoo's position is recorded on [#57](https://github.com/songomby-D1/devfest2026/issues/57): the sample media may be sent, papangoo holds the API keys, and one vision API is enough.
- [CONFIRMED] papangoo chose the Anthropic API with `claude-sonnet-5-5` for the description-to-media check (05b). Descriptions can be in English, French or Malagasy, with no special handling for Malagasy. The result is an advisory signal only.
- [NOT IMPLEMENTED] The 05a prototype is a NestJS service outside this repository. It checks images, and videos through 3 extracted frames, with Sightengine, and it is in final review. It has not been called against the real Sightengine API yet. The 05b code is not written. These tickets add nothing to this repository yet.

## Earlier session: 3D asset procedure (shidoAdr)

- [CONFIRMED] 3D-03 ([#10](https://github.com/songomby-D1/devfest2026/issues/10)): drafted the [3D asset procedure](../architecture/3d-asset-procedure.md) for D12 option A, with `prepare.sh` and `poster.mjs`. The USDZ is withheld until 3D-04a strips its device metadata and checks its references. Two successive runs of the documented commands from clean directories gave identical outputs.
- [NOT IMPLEMENTED] Another team member must follow the procedure alone, and shidoAdr must confirm the Reality Composer menu steps.

## Earlier session: CONTENT-05 grooming (papangoo)

- [CONFIRMED] CONTENT-05 ([#57](https://github.com/songomby-D1/devfest2026/issues/57)) is groomed as an exploration only, split into CONTENT-05a ([#84](https://github.com/songomby-D1/devfest2026/issues/84)), CONTENT-05b ([#85](https://github.com/songomby-D1/devfest2026/issues/85)) and CONTENT-05c ([#86](https://github.com/songomby-D1/devfest2026/issues/86)). The sub-issues are linked to the Content & Verification umbrella ([#18](https://github.com/songomby-D1/devfest2026/issues/18)). CONTENT-08 ([#87](https://github.com/songomby-D1/devfest2026/issues/87)) records content moderation as a post-MVP idea.
- [CONFIRMED] The signals are advisory. They never grant or remove a verified status ([MVP section B](../product/MVP.md#b-content-and-verification)). The two signals explored are AI-generated detection (05a) and the coherence of a description with its media, with angle pictures for 3D models (05b). Findings go in `docs/architecture/ai-assisted-analysis-spike.md`, which does not exist yet.
- [NOT IMPLEMENTED] No exploration has run in this repository. A local NestJS prototype for 05a exists outside the repository. Sample media stays outside Git.
- [DECISION REQUIRED: endy-rkt] Confirm the scope and timebox of AI exploration and obtain explicit clearance before sending cultural media to any external AI API. The questions are listed in [#57](https://github.com/songomby-D1/devfest2026/issues/57). CONTENT-05 remains subject to those approvals.

## Earlier session: D12 proposal (shidoAdr)

- [CONFIRMED] 3D-02 ([#9](https://github.com/songomby-D1/devfest2026/issues/9)): proposed [ADR 0001](../decisions/0001-d12-3d-demo-experience.md) for D12, with options A to E. The recommendation is offline-prepared GLB at 1K by default and 2K on demand, a poster, a still-image fallback and optional AR.
- [CONFIRMED] shidoAdr chose option A for D12, and endy-rkt approved ADR 0001 in [PR #83](https://github.com/songomby-D1/devfest2026/pull/83).

## Earlier session: 3D real scan (shidoAdr)

- [CONFIRMED] 3D-01b ([#8](https://github.com/songomby-D1/devfest2026/issues/8)): added the [real scan](../architecture/3d-feasibility-spike.md#real-scan-3d-01b) results to the spike report. A Reality Composer scan of about 1 min 30 s gave a 4.9 MB USDZ and a 148 KB optimized 2K GLB. Display on demo devices moved to 3D-05b ([#15](https://github.com/songomby-D1/devfest2026/issues/15)).
- [NOT IMPLEMENTED] Next: 3D-02 ([#9](https://github.com/songomby-D1/devfest2026/issues/9)), the D12 proposal. 3D-07 (LiDAR service and Dockerfile) waits on endy-rkt-07 and INFRA-01.

## Earlier session: 3D feasibility (shidoAdr)

- [CONFIRMED] 3D-01, groomed as 3D-01a ([#7](https://github.com/songomby-D1/devfest2026/issues/7)): added the [3D feasibility spike](../architecture/3d-feasibility-spike.md) and linked it from [MVP section E](../product/MVP.md#e-lidar-and-3d). The groomed 3D tickets are sub-issues of [#6](https://github.com/songomby-D1/devfest2026/issues/6).
- Next: 3D-01b ([#8](https://github.com/songomby-D1/devfest2026/issues/8)) tests a real Reality Composer scan. 3D-02 ([#9](https://github.com/songomby-D1/devfest2026/issues/9)) depends only on 3D-01 in the [backlog](../product/task.md), which still shows 3D-01 as Backlog until this work is approved. 3D-03 waits on endy-rkt-06 (D12). 3D-04 and 3D-05 follow 3D-03 and the content, UX and frontend foundation tasks.

## Previous session: CI

- [CREATED, NOT EXECUTED] Added [CI](../../.github/workflows/ci.yml), [Dependabot](../../.github/dependabot.yml) and the [CI guide](../development/ci.md). Contributor and agent docs point to the guide and the required `ci-ok` status.
- PyYAML 6.0.3 parsed both YAML files. `actionlint` was unavailable. No hosted jobs, scans, builds or tests ran.
- [NOT IMPLEMENTED] Root npm manifests, installs, app projects and workspace scripts are still pending in this decision-only baseline. Without the root manifest, CI warns and skips JS jobs. Local quality tooling and CI rollout are tracked in endy-rkt-13–endy-rkt-24.
- The [shared quality configs](../development/code-policy.md) are unchanged. CI explicitly selects `.prettierrc.json`. GitHub settings remain a [manual checklist for endy-rkt](../development/ci.md#repository-settings-checklist).

- endy-rkt defines the MVP and system overview. Each app and service owner writes their own tests, Dockerfile and root Compose entry when implementation starts. [Task ownership](../team/responsibilities.md#task-ownership)
- [CONFIRMED] Stateful services use Prisma with one shared PostgreSQL instance per environment. D04 approves separate databases and scoped migration and runtime roles. [Data ownership](../architecture/data-storage.md#postgresql-isolation)
- The [README](../../README.md) presents the LOVA museum vision in English and retains its French subtitle. The [language rule](../development/code-policy.md#code-conventions) requires English for repository documentation and variable names.
- [CONFIRMED] endy-rkt uses Codex only. The other team members use Claude. [Team responsibilities](../team/responsibilities.md)
- [CONFIRMED] App and service owners take work from initialization through integration, including their API, tests, service-local dependencies, container setup and any service-specific PostgreSQL and Prisma work.
- [CONFIRMED] D02 is resolved. endy-rkt owns the gateway and [shared PostgreSQL and SeaweedFS setup](../team/responsibilities.md#shared-local-infrastructure), shidoAdr owns Auth and LiDAR, and Sesedra owns frontend and design. Service owners maintain their own Prisma schemas and migrations. MVP planning proceeds without a deadline.

## Decision handoff

- D01 is committed. D04, D06, D07, D13, D14, D15, D16, D17, D18, the demo host plan and GitHub rollout defaults are recorded. D05 is conditional on the SeaweedFS spike. [Decision register](../decisions/project-decisions.md)
- Sesedra can start UX-01. shidoAdr's D12 choice is accepted in [ADR 0001](../decisions/0001-d12-3d-demo-experience.md). The preparation procedure and feasibility evidence are on develop. Real-device and service integration checks remain open. papangoo can propose rights-cleared fixtures and reviewer coverage.
- Finish endy-rkt-18 and endy-rkt-19 for root tooling. Run endy-rkt-03 for storage evidence. Confirm service and authorization contracts in endy-rkt-05 and endy-rkt-08. Record demo and hosted CI evidence before sign-off or protection rollout.
- The [NFT service proposal](../../apps/backend/nft/nft_context.md) gives salandri-42 a starting point for NFT-01. Resolve its divergence from the approved mint trigger, service data ownership and HTTP baseline before integration.
- CODEOWNERS awaits reviewer coverage. The [backlog](../product/task.md) tracks owner handoffs and remaining verification.

Take implementation work from the relevant task owner.
