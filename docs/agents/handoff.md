# Current handoff

[CONFIRMED] The backend layout is `apps/backend/<service>/`. The gateway, auth, content, nft and lidar directories are placeholders. See the [backlog](../product/task.md) for owners and dependencies.

## Latest session: WebGL museum room (Sesedra)

- [CREATED, NOT MERGED] Branch `feature/gallery-3d`, built in a separate worktree from the FE-01 base commit while FE-02 continued in the main checkout. It adds `apps/frontend/src/features/gallery-3d/`, a self-contained React Three Fiber room: entrance screen, camera travelling, damped lateral rail (wheel, drag, keyboard), one spot per work whose intensity follows the visitor, gilded frames built from geometry, procedural clay pots on pedestals with drag rotation in inspection mode, focus camera with zoom levels, HTML wall label and notice, a CSS fallback without WebGL and reduced-motion handling. `main.tsx` mounts it directly; `App.tsx` and its test are untouched.
- Dependencies added on the oral go reported by Sesedra, to confirm at PR review: `three` 0.187.0, `@react-three/fiber` 9.8.2, `@react-three/drei` 10.7.9, `@types/three` 0.187.0. Three 0.187 was chosen because drei's dependencies pin `@types/three` 0.187 and a second typings copy broke the typecheck.
- Demo media stay out of Git: six Wikimedia Commons portraits (public domain, credits shown in the notice) and a CC0 parquet texture live in the ignored `apps/frontend/public/media/`; a missing file shows a missing-media state. The sculptures are procedural and labelled as demonstration content.
- Reconnection with FE-02: the module uses scoped `--g-*` custom properties that mirror the Figma variables and system font fallbacks; switch them to `tokens.css` and `fonts.css` once FE-02 lands, route `/galerie` to `GalleryExperience`, and wire the sound toggle to `lib/audio/ambience`. Deep links already exist: `?salle`, `?oeuvre=<id>`, `&zoom=<n>`, `&inspect`, `?rendu=css`.
- [NOT IMPLEMENTED] GPU frame rate was not measured: checks ran in headless Chrome on SwiftShader. Measure on the demo laptop and a phone before rehearsal. The 1.2 MB bundle should be code-split so the room loads lazily.

## Previous session: 3D feasibility (shidoAdr)

- [CONFIRMED] 3D-01, groomed as 3D-01a ([#7](https://github.com/songomby-D1/devfest2026/issues/7)): added the [3D feasibility spike](../architecture/3d-feasibility-spike.md) and linked it from [MVP section E](../product/MVP.md#e-lidar-and-3d). The groomed 3D tickets are sub-issues of [#6](https://github.com/songomby-D1/devfest2026/issues/6).
- Next: 3D-01b ([#8](https://github.com/songomby-D1/devfest2026/issues/8)) tests a real Reality Composer scan. 3D-02 ([#9](https://github.com/songomby-D1/devfest2026/issues/9)) depends only on 3D-01 in the [backlog](../product/task.md), which still shows 3D-01 as Backlog until this work is approved. 3D-03 waits on endy-rkt-06 (D12). 3D-04 and 3D-05 follow 3D-03 and the content, UX and frontend foundation tasks.

## Previous session: CI

- [CREATED, NOT MERGED] Branch `feature/frontend-init`, proposed by Sesedra. It contains the FE-01 React shell in `apps/frontend/`, the root npm workspace, pinned quality tooling, the lockfile, `.nvmrc`, `.npmrc` and a filled `.gitignore`. It also adds the [frontend rules](../../apps/frontend/rules.md) and [ADR 0001](../decisions/0001-frontend-toolchain.md).
- [DECISION REQUIRED: endy-rkt] Before merge: name the frontend owner under D02, approve the dependencies and Node 24 in ADR 0001, and approve Prettier formatting of `.github/workflows/ci.yml`, `.github/dependabot.yml`, `eslint.config.mjs` and the docs (endy-rkt-17). Without that formatting, the CI `lint` job fails once the root manifest lands.
- [IN PROGRESS] Sesedra is implementing FE-02, the home and gallery screens from her Figma frames (nodes 12:88 and 114:3877), on `feature/home-gallery`, stacked on `feature/frontend-init`. Sesedra reports a go from endy-rkt that is not recorded in the repository yet. `gsap` and `@gsap/react` are added pending endy-rkt's approval at PR review. Licensed fonts and demo media stay in ignored local folders until D18.

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
- [DECISION REQUIRED: salandri-42] D08–D11 NFT implementation choices. [DECISION REQUIRED: shidoAdr] D12 3D delivery approach within the agreed MVP.
- [DECISION REQUIRED: endy-rkt] D13 role model. D16 system-wide async processing. D18 review and media policy. DEMO-01 demo host.
- [DECISION REQUIRED: endy-rkt] CI settings: admin bypass, approval count, strict up-to-date policy, merge method, CodeQL, CODEOWNERS and push scan scope. D18 also covers cultural-media licensing and consent for public Git history. See the [CI guide](../development/ci.md).

## Next approved work

Take work from the relevant task owner. Use the [session protocol](../../AGENTS.md#session-protocol) and [session log](log.md) to resume from repository evidence.
