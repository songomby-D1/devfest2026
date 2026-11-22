# Development workflow

This page records the approved runtime and local check conventions. See [Contributing](../../CONTRIBUTING.md) for Git and review rules, the [code quality policy](code-policy.md) for shared checks, and the [CI guide](ci.md) for hosted runs and troubleshooting.

## Runtime and workspaces

[CONFIRMED] [D15](../decisions/project-decisions.md#d15-node-and-npm-workspace-runtime) keeps Node 22. Select the exact patch in `.nvmrc` locally and in CI, and use that patch for Node-based Docker stages. Declare `engines.node` as `>=22 <23`. Use the bundled npm version by default and pin the exact version as `npm@<version>` in the root `packageManager` field. Use that npm version for local, CI and container installs. Runtime selection uses `.nvmrc`. Mise is deferred.

Use a private root npm workspace for `apps/frontend`, `apps/backend/*` and `packages/*` with one committed root `package-lock.json`. Run `npm ci` at the repository root for reproducible installs.

[IMPLEMENTED] `.nvmrc` pins Node 22.23.5, the latest 22.x LTS patch on 2026-11-11, and the root `packageManager` pins its bundled `npm@10.9.9`. Every workspace declares `engines.node` as `>=22 <23` and the root `.npmrc` sets `engine-strict`. CI reads `.nvmrc`. The root `package.json` and `package-lock.json` declare the private workspace for `apps/frontend`, `apps/backend/*` and `packages/*`. A workspace with its own lockfile, such as NFT before its migration, keeps it for its own Docker build.

History: [endy-rkt-18](../product/task.md#endy-rkt-ci-follow-up) validates the exact Node/npm pair with the scaffold toolchain and aligns `.nvmrc` and CI. It supplies the values for `engines.node` and `packageManager` to endy-rkt-19 for a single coordinated root manifest change. endy-rkt-19 alone installs and pins the initial dependencies and owns the initial manifest and lockfile. [endy-rkt-07](../product/task.md#endy-rkt-foundation) uses that foundation to coordinate scaffolding with workspace owners.

## Quality checks

[CONFIRMED] [D17](../decisions/project-decisions.md#d17-quality-tooling-and-ci-rollout) uses npm scripts for local and CI checks. [endy-rkt-13](../product/task.md#endy-rkt-code-quality-follow-up) consumes the pins from endy-rkt-19 and adds only root scripts. It does not repeat dependency installation. The older install-and-pin wording in the endy-rkt-13 backlog row is pending separate reconciliation. Affected-owner feedback is pending under [endy-rkt-08](../product/task.md#endy-rkt-foundation) for shared contracts and [endy-rkt-20](../product/task.md#endy-rkt-ci-follow-up) for workspace adoption.

[IMPLEMENTED] Run `npm run lint` and `npm run format:check` from the root. Run `npm run typecheck -w <workspace>`, `npm run test -w <workspace>` and `npm run build -w <workspace>` for each initialized workspace, including a future shared package. `npm run typecheck`, `npm run test` and `npm run build` run every workspace. CI uses the same scripts.

Local stack: `npm ci`, then `npm run setup:env` to create `.env` with random secrets, then `docker compose up --build`. `npm run smoke:auth` checks guest access, registration, login, a protected call and logout through the gateway. [CI script contract](code-policy.md#ci-script-contract)

## Deferred Taskfile wrappers

[NOT IMPLEMENTED] Taskfile wrappers require separate approval from endy-rkt. If approved, keep them thin and delegate to npm workspace scripts and Docker Compose. Support an optional `SERVICE` selector where meaningful, defaulting to all applicable targets. [Task templating reference](https://taskfile.dev/docs/reference/templating)

| Proposed command        | Intended behavior and scope                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `task setup`            | Check prerequisites, install from the root lockfile, and create missing local environment files from examples without replacing existing values. Entire repository. |
| `task dev`              | Start development watchers for all applications or one selected application. Use dependencies already started with `up`.                                            |
| `task up`               | Start the local Compose stack, or selected components and their declared dependencies.                                                                              |
| `task down`             | Stop the whole local stack and retain its persistent volumes.                                                                                                       |
| `task logs`             | Follow Compose logs for the stack or one service.                                                                                                                   |
| `task test`             | Run required unit and integration suites for all workspaces or a selected service.                                                                                  |
| `task test:unit`        | Run isolated unit tests across the workspace or one service.                                                                                                        |
| `task test:integration` | Run integration suites against isolated disposable dependencies for all applicable workspaces or one service.                                                       |
| `task lint`             | Run the shared lint check across the workspace or a selected service.                                                                                               |
| `task format`           | Run the shared formatter across the workspace or a selected service.                                                                                                |
| `task build`            | Build all workspaces or a selected service with its workspace dependencies.                                                                                         |
| `task clean`            | Remove only generated local outputs at workspace or selected service scope. Retain data volumes and local environment files.                                        |
