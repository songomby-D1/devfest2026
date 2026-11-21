# Current handoff

[CONFIRMED] The backend layout is `apps/backend/<service>/`. The gateway, auth, content, nft and lidar directories are placeholders. See the [backlog](../product/task.md) for owners and dependencies.

## Latest session: 3D asset procedure (shidoAdr)

- [CONFIRMED] 3D-03 ([#10](https://github.com/songomby-D1/devfest2026/issues/10)): drafted the [3D asset procedure](../architecture/3d-asset-procedure.md) for D12 option A, with `prepare.sh` and `poster.mjs`. The USDZ is withheld until 3D-04a strips its device metadata and checks its references. Two successive runs of the documented commands from clean directories gave identical outputs.
- [NOT IMPLEMENTED] Another team member must follow the procedure alone, and shidoAdr must confirm the Reality Composer menu steps.

## Session: CONTENT-05 grooming (papangoo)

- [CONFIRMED] CONTENT-05 ([#57](https://github.com/songomby-D1/devfest2026/issues/57)) is groomed as an exploration only, split into CONTENT-05a ([#84](https://github.com/songomby-D1/devfest2026/issues/84)), CONTENT-05b ([#85](https://github.com/songomby-D1/devfest2026/issues/85)) and CONTENT-05c ([#86](https://github.com/songomby-D1/devfest2026/issues/86)). The sub-issues are linked to the Content & Verification umbrella ([#18](https://github.com/songomby-D1/devfest2026/issues/18)). CONTENT-08 ([#87](https://github.com/songomby-D1/devfest2026/issues/87)) records content moderation as a post-MVP idea.
- [CONFIRMED] The signals are advisory. They never grant or remove a verified status ([MVP section B](../product/MVP.md#b-content-and-verification)). The two signals explored are AI-generated detection (05a) and the coherence of a description with its media, with angle pictures for 3D models (05b). Findings go in `docs/architecture/ai-assisted-analysis-spike.md`, which does not exist yet.
- [NOT IMPLEMENTED] No exploration has run in this repository. A local NestJS prototype for 05a exists outside the repository. Sample media stays outside Git.
- [DECISION REQUIRED: endy-rkt] D18 still blocks the start: does an AI exploration fit the deadline, and may cultural media be sent to an external AI API. The questions are listed in [#57](https://github.com/songomby-D1/devfest2026/issues/57). CONTENT-05 moves to In progress when D18 is decided.

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
- [NOT IMPLEMENTED] Root npm manifests, installs, app projects and workspace scripts are still pending. Without the root manifest, CI warns and skips JS jobs. Local quality tooling and CI rollout are tracked in endy-rkt-13–endy-rkt-24.
- The [shared quality configs](../development/code-policy.md) are unchanged. CI explicitly selects `.prettierrc.json`. GitHub settings remain a [manual checklist for endy-rkt](../development/ci.md#repository-settings-checklist).

- endy-rkt defines the MVP and system overview. Each app and service owner writes their own tests, Dockerfile and root Compose entry when implementation starts. [Task ownership](../team/responsibilities.md#task-ownership)
- [CONFIRMED] Stateful services use Prisma with one shared PostgreSQL instance per environment. D04 still covers isolation within that instance. [Data ownership](../architecture/data-storage.md#postgresql-isolation)
- The [README](../../README.md) presents the LOVA museum vision in English and retains its French subtitle. The [language rule](../development/code-policy.md#code-conventions) requires English for repository documentation and variable names.
- [CONFIRMED] endy-rkt uses Codex only. The other team members use Claude. [Team responsibilities](../team/responsibilities.md)

## Open decisions for endy-rkt

- [DECISION REQUIRED: endy-rkt] D14 shared contracts, import aliases and Docker build context. D15 runtime version management. D17 tooling rollout, audit policy and whether to defer hooks.
- [DECISION REQUIRED: endy-rkt] D01 deadline and demo scope. D02 Auth, gateway, frontend and shared local infrastructure owners. D04 database isolation. D05 object storage and delivery. D06 gateway and Nginx. D07 identity propagation and logout.
- [DECISION REQUIRED: salandri-42] D08–D11 NFT implementation choices. [CONFIRMED] D12: option A, ADR 0001 accepted.
- [DECISION REQUIRED: endy-rkt] D13 role model. D16 system-wide async processing. D18 review and media policy. DEMO-01 demo host.
- [DECISION REQUIRED: endy-rkt] CI settings: admin bypass, approval count, strict up-to-date policy, merge method, CodeQL, CODEOWNERS and push scan scope. D18 also covers cultural-media licensing and consent for public Git history. See the [CI guide](../development/ci.md).

## Next approved work

Take work from the relevant task owner. Use the [session protocol](../../AGENTS.md#session-protocol) and [session log](log.md) to resume from repository evidence.
