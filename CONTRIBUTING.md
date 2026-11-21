# Contributing

This guide defines the Git workflow and review requirements.

## Branches and review

[CONFIRMED] `main` stays demo-ready and receives no direct commits. `develop` is the integration branch. Start each logical task from `develop` using `feature/<name>`, `fix/<name>`, `docs/<name>` or `chore/<name>`.

[CONFIRMED] Run applicable local checks, push the task branch, and open a PR into `develop`. Wait for green `ci-ok` and required review before merging. Validate integration before promoting stable work to `main` by PR from this repository's `develop` branch. Tag demo and release milestones from the validated commit. See the [CI guide](docs/development/ci.md).

[RECOMMENDED] Use commits in the form `type(scope): summary`, with types aligned to task branches. This makes changes easy to scan. Use `demo-v0.1.0` for demo tags and `v0.1.0` for release tags to distinguish milestones.

[CONFIRMED] Follow the [shared code policy](docs/development/code-policy.md) and complete the [PR checklist](.github/PULL_REQUEST_TEMPLATE.md). Changes to lint, formatting and TypeScript configs require approval from endy-rkt.

[CONFIRMED] Owners may revise their [own tasks](docs/team/responsibilities.md#task-ownership). Link the task in the PR and coordinate changes to contracts, shared security policy or Compose resources with the affected owners. Bring MVP or system-wide architecture changes to endy-rkt.

[CONFIRMED] App and service owners include and verify their own tests. When introducing a service, include its Dockerfile and its entry in the root Compose file. Stateful changes include the service's Prisma migrations when its schema changes. See the [service definition of done](docs/development/quality-gates.md#testing-and-service-definition-of-done) and [decision register](docs/decisions/project-decisions.md).

[RECOMMENDED] Record why the change is needed, along with assumptions and unresolved risks.

## Public repository

[CONFIRMED] Keep real credentials, local `.env` files and personal data out of commits. If a secret is exposed, rotate it immediately and notify endy-rkt. Follow the [public-repository security rules](docs/development/ci.md#public-repository-security).

## Branch protection checklist

endy-rkt applies the [GitHub settings checklist](docs/development/ci.md#repository-settings-checklist) manually.
