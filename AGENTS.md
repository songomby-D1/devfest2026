# Agent instructions

Use this file as the shared entry point for Claude and Codex working on the Malagasy cultural heritage platform.

- [CONFIRMED] Use the [MVP specification](docs/product/MVP.md) and [architecture](docs/architecture/overview.md). Microservices are mandatory. The React/TypeScript frontend uses the dedicated gateway. Independently deployable NestJS services own Auth, Content & Verification, NFT and LiDAR. Respect each [service boundary](docs/architecture/services.md) and its data ownership.
- [CONFIRMED] endy-rkt defines the MVP and system overview. Follow the [team ownership rules](docs/team/responsibilities.md#task-ownership), [agent workflow](docs/agents/workflow.md) and [Git rules](CONTRIBUTING.md). The task owner sets the task scope and acceptance criteria, directs the agent and reviews the result.
- [CONFIRMED] Coordinate overlapping changes and shared service contracts with the affected owners. Escalate changes to the MVP or system-wide architecture to endy-rkt. Preserve existing work and keep secrets out of code, commits and reports.
- [CONFIRMED] During authorized implementation, write and maintain your app or service's tests, Dockerfile, local Docker ignore rules and entry in root `docker-compose.yml`. Use [Prisma and the shared PostgreSQL instance](docs/architecture/data-storage.md#postgresql-isolation) for stateful services. Coordinate shared Compose changes with their owners. Taskfile and deployment changes require explicit approval from endy-rkt.
- [CONFIRMED] Stop at the task boundary after reporting, and take further work from the relevant task owner.
- [CONFIRMED] Report changed files, acceptance criteria verified, checks actually run and their outcomes, assumptions and unresolved issues using the [report template](docs/agents/workflow.md#agent-report-template).
- [CONFIRMED] When editing architecture or deployment docs, check that every description of Dockerfile placement agrees with the [service convention](docs/architecture/services.md#dockerfile-placement).

## Code quality

- [CONFIRMED] Follow the [shared code policy](docs/development/code-policy.md) and its root configs `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `.editorconfig` and `tsconfig.base.json`.
- [CONFIRMED] Use English for repository documentation and variable names. Keep the README subtitle as the only French exception. See the [language rule](docs/development/code-policy.md#code-conventions).
- [CONFIRMED] Obtain approval from endy-rkt before changing those configs or adding dependencies. Keep rules enabled and avoid suppressions as a way to make checks pass. Coordinate before editing another service's directory.
- [CONFIRMED] Run the checks when available. Use the [agent report template](docs/agents/workflow.md#agent-report-template) for changed files, exact commands and results, tests and assumptions. Report unavailable checks as “not runnable yet”.

## CI

- [CONFIRMED] Follow the [CI guide](docs/development/ci.md). Obtain approval from endy-rkt before editing `.github/workflows/**` or `.github/dependabot.yml`. Never weaken or skip a required check.
- [CONFIRMED] Before opening a PR, run the local checks that exist and report exact commands and results. Use “not runnable yet” for unavailable checks. `ci-ok` is the required status, and red CI blocks the merge.

## Session protocol

- [CONFIRMED] Start by reading this file, then the [current handoff](docs/agents/handoff.md), then the relevant [backlog items](docs/product/task.md).
- [CONFIRMED] End by appending to the [session log](docs/agents/log.md) and updating the handoff before reporting. Never rewrite past log lines.
- [CONFIRMED] Treat the repository as the record of project state. If it is not recorded in the repository, it does not exist for project purposes.
