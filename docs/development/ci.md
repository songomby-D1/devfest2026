# Continuous integration

This page is the reference for CI, Dependabot and manual GitHub settings. CI validates PRs and pushes to `develop` and `main`, and supports manual dispatch. Stale PR runs are cancelled. The workflow uses read-only repository access, standard GitHub-hosted Ubuntu runners and no repository secrets. [CONFIRMED] Standard runner usage is free for public repositories. Billable-job minute rounding does not apply to these jobs. [GitHub Actions billing](https://docs.github.com/en/actions/concepts/billing-and-usage) · [Job execution time](https://docs.github.com/en/actions/how-tos/monitor-workflows/view-job-execution-time)

## Jobs

| Job | What it does | Gate | Status |
|---|---|---|---|
| `branch-guard` | Rejects PRs into `main` unless the head is this repository's `develop` branch. | Blocking | [CREATED, NOT EXECUTED] |
| `secrets` | Downloads the checksum-pinned Gitleaks binary. Scans PR commits from base SHA to head SHA. Pushes and dispatches scan all fetched refs. Findings are fully redacted. | Blocking | [CREATED, NOT EXECUTED] |
| `detect` | Finds the root manifest and discovers initialized workspaces for the matrix. | Blocking | [CREATED, NOT EXECUTED] |
| `lint` | Installs from the root lockfile and runs root Prettier and ESLint with zero warnings. Selects `.prettierrc.json` explicitly. | Blocking when the root manifest exists | [CREATED, NOT EXECUTED] |
| `service` | Runs `typecheck`, `test` and `build` for every detected workspace. Reports missing scripts and fails incomplete workspaces. | Scripts block. Runtime audit uses a high failure threshold and is advisory. | [CREATED, NOT EXECUTED] |
| `ci-ok` | Fails if any dependency fails or is cancelled. Accepts intentional skips. | Only required status check in GitHub | [CREATED, NOT EXECUTED] |

[CREATED, NOT EXECUTED] Releases checked upstream are `actions/checkout@v7` (v7.0.1), `actions/setup-node@v7` (v7.1.0), and Gitleaks v8.30.1. The Gitleaks docs confirm `--log-opts` for commit ranges and `--redact=100` for complete secret redaction. [UNVERIFIED] Hosted checkout availability for the event SHAs and the actual scan results await the first run. Update the archive version and checksum together. [Checkout releases](https://github.com/actions/checkout/releases) · [Setup Node releases](https://github.com/actions/setup-node/releases) · [Gitleaks archive and digest](https://github.com/gitleaks/gitleaks/releases/expanded_assets/v8.30.1) · [Gitleaks scan options](https://github.com/gitleaks/gitleaks#usage)

## Partial workspaces and prerequisites

Detection checks `apps/frontend`, each immediate child under `apps/backend/`, and each immediate child under `packages/`. A directory without a `package.json` is a placeholder and generates a warning. Without a root manifest, detection warns and skips both JS jobs. With a root manifest and zero workspaces, root lint and formatting still run and the matrix skips with a warning. Once a workspace has a manifest and a root exists, its matrix entry runs regardless of which files changed.

For full checks, commit the root npm workspace manifest and lockfile, install the [quality dev dependencies](code-policy.md#eslint), and give each initialized workspace the [required scripts](code-policy.md#ci-script-contract) and TypeScript project configuration extending the shared base. The `test` script must run unit and integration coverage as those suites land. The current default is Node 22, pending alignment under D15.

[CREATED, NOT EXECUTED] Dependabot groups weekly GitHub Actions and npm version updates into at most two open version PRs per ecosystem, targeting `develop`. npm version updates become useful after the root manifest exists. Security updates still target GitHub's default branch. If a security PR targets `main`, send the fix through a PR into `develop` and promote it normally. [Dependabot targeting and grouping](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#target-branch)

## Review and failure handling

Open the failed Actions job and use its annotation or first failing command to fix the underlying check. Inspect `detect` for expected skips, a workspace row for missing or failed scripts, and `lint` for lockfile or root policy failures. Triage advisory audit findings even when `ci-ok` is green. Run the available local checks and report exact commands and results in the PR. Use “not runnable yet” where prerequisites are missing. Never weaken or skip a required check to get a green result. CI workflow and Dependabot changes require approval from endy-rkt. See the [PR checklist](../../.github/PULL_REQUEST_TEMPLATE.md).

## Public repository security

Keep secrets and real `.env` files out of Git and keep real credentials out of docs, tests and logs. Commit only safe placeholders in examples. Use seed data without personal information. Rotate or revoke an exposed credential immediately and notify endy-rkt. Deleting a commit cannot recall copies of a public secret. [GitHub guidance on sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)

[DECISION REQUIRED: endy-rkt] D18 cultural-media licensing and consent. Keep cultural media out of Git until endy-rkt approves the rights, consent and attribution requirements for public redistribution, including any community restrictions. Use synthetic data or approved fixtures in the meantime.

## Repository settings checklist

[NOT IMPLEMENTED] endy-rkt applies these settings manually on GitHub. Select the actual `ci-ok` check from GitHub Actions after it first reports.

- [ ] Protect `develop` and `main` with a ruleset or branch protection. Require a PR, **`ci-ok` only**, one approval, dismissal of stale approvals and resolution of review conversations. Block direct pushes, force pushes and deletion. Confirm `main` receives only same-repo `develop` PRs through the branch guard.
- [ ] [DECISION REQUIRED: endy-rkt] Include admins and use no routine bypass. Decide whether emergencies need an explicit exception with an audit trail.
- [ ] [DECISION REQUIRED: endy-rkt] Require branches to be up to date on `main`. Start with the looser setting on `develop` if repeated updates and reruns slow the team. Strict `main` can require syncing the promotion merge back through a PR to `develop`.
- [ ] Enable secret scanning, push protection, Dependabot alerts and security updates. [DECISION REQUIRED: endy-rkt] Defer CodeQL until there is application code and capacity to review findings. Public repositories support these controls.
- [ ] Use read-only default Actions workflow permissions and require approval for first-time fork contributors. Consider an allowlist for actions.
- [ ] [DECISION REQUIRED: endy-rkt] Prefer squash merges for short-lived PRs into `develop` and merge commits for `develop` promotions to preserve ancestry. Enable automatic deletion of merged topic branches and keep `develop` protected.
- [ ] [DECISION REQUIRED: endy-rkt] Decide on CODEOWNERS. Prefer a small file for CI and shared contracts once owner handles and coverage are confirmed. Public repositories can require code-owner review.
- [ ] Consider a README CI badge after the first successful run.

[Branch protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) · [Security features](https://docs.github.com/en/code-security/getting-started/github-security-features) · [Actions settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository) · [Merge methods](https://docs.github.com/en/pull-requests/reference/pull-request-merges) · [Code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)

## Deferred checks and open rollout choices

- [NOT IMPLEMENTED] When the first database-backed integration test lands, provision one disposable PostgreSQL instance for the CI integration environment. Prisma-backed suites share that instance with isolated test data and apply only their own service's migrations. See the [test plan](quality-gates.md#testing-and-service-definition-of-done) and [data ownership](../architecture/data-storage.md#postgresql-isolation).
- [NOT IMPLEMENTED] Add changed-service Docker builds on PRs into `main` after the service Dockerfiles exist. E2E smoke tests and CD are future work.
- [DECISION REQUIRED: endy-rkt] D15: approve Node 22 or another supported LTS and align CI, `.nvmrc` and package `engines`.
- [DECISION REQUIRED: endy-rkt] Keep the full-history push scan initially or switch to incremental `before..after` once there is a trusted baseline. Keep full history for now to detect pre-existing leaks.
