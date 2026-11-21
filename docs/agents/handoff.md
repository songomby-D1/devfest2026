# Current handoff

[CONFIRMED] The backend layout is `apps/backend/<service>/`. The gateway, auth, content, nft and lidar directories are placeholders. See the [backlog](../product/task.md) for owners and dependencies.

## Latest session

- [CREATED, NOT EXECUTED] Added [CI](../../.github/workflows/ci.yml), [Dependabot](../../.github/dependabot.yml) and the [CI guide](../development/ci.md). Contributor and agent docs point to the guide and the required `ci-ok` status.
- PyYAML 6.0.3 parsed both YAML files. `actionlint` was unavailable. No hosted jobs, scans, builds or tests ran.
- [NOT IMPLEMENTED] Root npm manifests, installs, app projects and workspace scripts are still pending. Without the root manifest, CI warns and skips JS jobs. Local quality tooling and CI rollout are tracked in endy-rkt-13–endy-rkt-24.
- The [shared quality configs](../development/code-policy.md) are unchanged. CI explicitly selects `.prettierrc.json`. GitHub settings remain a [manual checklist for endy-rkt](../development/ci.md#repository-settings-checklist).

- endy-rkt defines the MVP and system overview. Each app and service owner writes their own tests, Dockerfile and root Compose entry when implementation starts. [Task ownership](../team/responsibilities.md#task-ownership)
- [CONFIRMED] Stateful services use Prisma with one shared PostgreSQL instance per environment. D04 still covers isolation within that instance. [Data ownership](../architecture/data-storage.md#postgresql-isolation)
- The [README](../../README.md) presents the LOVA museum vision in English and retains its French subtitle. The [language rule](../development/code-policy.md#code-conventions) requires English for repository documentation and variable names.
- [CONFIRMED] endy-rkt uses Codex only. The other team members use Claude. [Team responsibilities](../team/responsibilities.md)
- [CONFIRMED] App and service owners take work from initialization through integration, including their API, tests, service-local dependencies, container setup and any service-specific PostgreSQL and Prisma work.
- [CONFIRMED] D02 is resolved. endy-rkt owns the gateway and [shared PostgreSQL and SeaweedFS setup](../team/responsibilities.md#shared-local-infrastructure), shidoAdr owns Auth and LiDAR, and Sesedra owns frontend and design. Service owners maintain their own Prisma schemas and migrations. MVP planning proceeds without a deadline.

## Open decisions for endy-rkt

See the [decision register](../decisions/project-decisions.md#decisions-for-endy-rkt) for shared choices and recommendations on `docs/decision`. NFT and 3D delivery choices remain delegated to their owners.

## Next approved work

The backlog review on `docs/decision` identifies `endy-rkt-01` (D01 demo scope) as the first P0 item with no listed prerequisite. The backlog still lists it as `Backlog`. Once the scope is recorded, groom `endy-rkt-02` and `endy-rkt-18` for workspace setup, with `endy-rkt-03` and `endy-rkt-05` available in parallel. The owners of UX, NFT and LiDAR can then groom `UX-01`, `NFT-01` and `3D-01` respectively.

Take work from the relevant task owner. Use the [session protocol](../../AGENTS.md#session-protocol) and [session log](log.md) to resume from repository evidence.
