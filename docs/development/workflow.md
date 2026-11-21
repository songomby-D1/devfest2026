# Development workflow

This page proposes local commands and runtime onboarding. See [Contributing](../../CONTRIBUTING.md) for Git and review rules.

[NOT IMPLEMENTED] No commands below exist yet. [CTO DECISION REQUIRED] **D17 Tooling and quality baseline.** [RECOMMENDED] Keep Taskfile as a thin root interface around future npm workspace scripts and Docker Compose. Define commands once and delegate to their owning workspace. Support an optional `SERVICE` selector where meaningful, defaulting to all applicable targets. Reuse the underlying commands in CI so contributors and CI check the same behavior. [Task templating reference](https://taskfile.dev/docs/reference/templating)

| Proposed command | Intended behavior and scope |
|---|---|
| `task setup` | Check prerequisites, install from the root lockfile, and create missing local environment files from examples without replacing existing values. Entire repository. |
| `task dev` | Start development watchers for all applications or one selected application. Use dependencies already started with `up`. |
| `task up` | Start the local Compose stack, or selected components and their declared dependencies. |
| `task down` | Stop the whole local stack and retain its persistent volumes. |
| `task logs` | Follow Compose logs for the stack or one service. |
| `task test` | Run required unit and integration suites for all workspaces or a selected service. |
| `task test:unit` | Run isolated unit tests across the workspace or one service. |
| `task test:integration` | Run integration suites against isolated disposable dependencies for all applicable workspaces or one service. |
| `task lint` | Check source lint rules across the workspace or a selected service. |
| `task format` | Format workspace files or a selected service. CI uses the corresponding non-writing check. |
| `task build` | Build all workspaces or a selected service with its workspace dependencies. |
| `task clean` | Remove only generated local outputs at workspace or selected service scope. Retain data volumes and local environment files. |

[CTO DECISION REQUIRED] **D15 Runtime version management.** [RECOMMENDED] **Use a simpler alternative to mise.** Record one approved Node.js LTS version in `.nvmrc`, declare compatibility in package `engines`, and have CI read the same version file. Taskfile orchestrates commands and can check prerequisites. A version-manager layer would add another installation for contributors on a single-runtime project.
