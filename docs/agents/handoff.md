# Current handoff

[CONFIRMED] The backend layout is `apps/backend/<service>/`. The gateway, auth, content, nft and lidar directories are placeholders. See the [backlog](../product/task.md) for owners and dependencies.

## NestJS lint compatibility

- On `fix/nestjs-eslint-rules`, [the ESLint override](../../eslint.config.mjs) allows decorated empty classes and disables class-instance assignment linting for backend TypeScript. Undecorated empty classes still fail. Frontend TypeScript and backend JavaScript retain their existing rules.
- Temporary NestJS fixtures passed in all five backend paths using ESLint 9.39.5 and TypeScript 6.0.3. The root workspace checks still depend on the root tooling rollout.

## Latest session: CONTENT-05 status (papangoo)

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
