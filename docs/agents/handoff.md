# Current handoff

[CONFIRMED] The backend layout is `apps/backend/<service>/`. The gateway, auth, content, nft and lidar directories are placeholders. See the [backlog](../product/task.md) for owners and dependencies.

## Latest session

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
- Sesedra can start UX-01, salandri-42 can start NFT-01 and shidoAdr can start 3D-01. papangoo can propose rights-cleared fixtures and reviewer coverage. Exact NFT and 3D choices remain with their owners.
- Finish endy-rkt-18 and endy-rkt-19 for root tooling. Run endy-rkt-03 for storage evidence. Confirm service and authorization contracts in endy-rkt-05 and endy-rkt-08. Record demo and hosted CI evidence before sign-off or protection rollout.
- CODEOWNERS awaits reviewer coverage. The [backlog](../product/task.md) tracks owner handoffs and remaining verification.

Take implementation work from the relevant task owner.
