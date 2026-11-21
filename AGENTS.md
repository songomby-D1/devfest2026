# Agent instructions

Use this file as the shared entry point for Claude and Codex working on the Malagasy cultural heritage platform.

- [CONFIRMED] Use the [MVP specification](docs/product/MVP.md) and [architecture](docs/architecture/overview.md). Microservices are mandatory. The React/TypeScript frontend uses the dedicated gateway. Independently deployable NestJS services own Auth, Content & Verification, NFT and LiDAR. Respect each [service boundary](docs/architecture/services.md) and its data ownership.
- [CONFIRMED] The CTO controls four Claude agents and one Codex instance. Follow the [agent workflow](docs/agents/workflow.md) and [Git rules](CONTRIBUTING.md). Use one primary owner and explicit acceptance criteria per task. Inspect existing work, propose a plan, get CTO approval where required, implement only approved scope, verify, then report for CTO review.
- [CONFIRMED] Coordinate overlapping changes with the primary owner before editing. Avoid redundant agent runs and independent architectural decisions. Preserve existing work. Keep secrets out of code, commits and reports.
- [CONFIRMED] The current approval covers documentation only. Application and service scaffolding, dependency installation, schemas, migrations and deployments require separate CTO approval. Leave Dockerfiles, `.dockerignore` files, `docker-compose.yml`, Taskfile and GitHub Actions workflows untouched, along with other configuration.
- [CONFIRMED] After delivering the report, stop and wait for explicit CTO approval and instructions.
- [CONFIRMED] Report changed files, acceptance criteria verified, checks actually run and their outcomes, assumptions and unresolved issues using the [report template](docs/agents/workflow.md#agent-report-template).
- [CONFIRMED] When editing architecture or deployment docs, check that every description of Dockerfile placement agrees with the [service convention](docs/architecture/services.md#dockerfile-placement).
