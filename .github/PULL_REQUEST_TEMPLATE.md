## What this PR does

Summarize the change and link the task. Follow the [shared code policy](../docs/development/code-policy.md).

## What was verified

- [ ] Unit and integration tests pass.
- [ ] ESLint reports zero warnings and errors.
- [ ] Formatting check passes.
- [ ] TypeScript check passes.
- [ ] Build passes.
- [ ] The required `ci-ok` check is green.
- [ ] The change contains no secrets.

List the commands and results. Mark unavailable checks “not runnable yet”.

## Scope and guardrails

- [ ] Covers one logical task and stays within the owner's service or the agreed cross-service scope.
- [ ] App or service changes include owner-written or updated tests where applicable. A new app or service includes its Dockerfile and root Compose entry.
- [ ] New workspace dependencies are justified and approved by the app or service owner. Shared tooling or quality config changes have approval from endy-rkt.
- [ ] Database changes stay within the owning service's PostgreSQL boundary and include its Prisma migrations where needed.
- [ ] Any lint suppression includes a reason.

## Contract changes

State whether the API or contract changed. Link to the affected contract if it did.

## What remains open

List assumptions, unverified checks or follow-up work.

## Visual

Attach a screenshot or mockup for UI changes.
