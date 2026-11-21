# Continuous integration

This page is the reference for CI, Dependabot and manual GitHub settings. CI validates PRs and pushes to `develop` and `main`, and supports manual dispatch. Stale PR runs are cancelled. The workflow uses read-only repository access, standard GitHub-hosted Ubuntu runners and no repository secrets. [CONFIRMED] Standard runner usage is free for public repositories. Billable-job minute rounding does not apply to these jobs. [GitHub Actions billing](https://docs.github.com/en/actions/concepts/billing-and-usage) · [Job execution time](https://docs.github.com/en/actions/how-tos/monitor-workflows/view-job-execution-time)

## Jobs

| Job            | What it does                                                                                                                                                         | Gate                                                                        | Status                  |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------- |
| `branch-guard` | Rejects PRs into `main` unless the head is this repository's `develop` branch.                                                                                       | Blocking                                                                    | [CREATED, NOT EXECUTED] |
| `secrets`      | Downloads the checksum-pinned Gitleaks binary. Scans PR commits from base SHA to head SHA. Pushes and dispatches scan all fetched refs. Findings are fully redacted. | Blocking                                                                    | [CREATED, NOT EXECUTED] |
| `detect`       | Finds the root manifest and discovers initialized workspaces for the matrix.                                                                                         | Blocking                                                                    | [CREATED, NOT EXECUTED] |
| `lint`         | Installs from the root lockfile and runs `npm run format:check` and `npm run lint` with zero warnings. Prettier uses `.prettierrc.json` explicitly.                  | Blocking when the root manifest exists                                      | [CREATED, NOT EXECUTED] |
| `service`      | Runs `typecheck`, `test` and `build` for every detected workspace with a disposable PostgreSQL service. Reports missing scripts and fails incomplete workspaces.     | Scripts block. Runtime audit uses a high failure threshold and is advisory. | [CREATED, NOT EXECUTED] |
| `compose`      | Generates throwaway secrets with `npm run setup:env` and validates `docker compose config`.                                                                          | Blocking when the root manifest exists                                      | [CREATED, NOT EXECUTED] |
| `ci-ok`        | Fails if any dependency fails or is cancelled. Accepts intentional skips.                                                                                            | Only required status check in GitHub                                        | [CREATED, NOT EXECUTED] |

[CREATED, NOT EXECUTED] Releases checked upstream are `actions/checkout@v7` (v7.0.1), `actions/setup-node@v7` (v7.1.0), and Gitleaks v8.30.1. The Gitleaks docs confirm `--log-opts` for commit ranges and `--redact=100` for complete secret redaction. [UNVERIFIED] Hosted checkout availability for the event SHAs and the actual scan results await the first run. Update the archive version and checksum together. [Checkout releases](https://github.com/actions/checkout/releases) · [Setup Node releases](https://github.com/actions/setup-node/releases) · [Gitleaks archive and digest](https://github.com/gitleaks/gitleaks/releases/expanded_assets/v8.30.1) · [Gitleaks scan options](https://github.com/gitleaks/gitleaks#usage)

## Closing issues from develop merges

[CREATED, NOT EXECUTED] GitHub honours closing keywords such as `Closes #12` only when a PR merges into the default branch, `main`. Work merges into `develop` first, so the separate [close-linked-issues](../../.github/workflows/close-linked-issues.yml) workflow runs when a PR into `develop` is merged. It reads the PR title and body, finds same-repository references after `close`, `fix` or `resolve` and their variants, and closes each referenced open issue with a comment naming the PR. Pull requests, closed issues and plain `#12` mentions are skipped. The job alone gets `issues: write`; the PR text is passed through environment variables and never interpolated into the script. PRs from forks receive a read-only token on `pull_request` events, so their issues must be closed by hand.

## Partial workspaces and prerequisites

Detection checks `apps/frontend`, each immediate child under `apps/backend/`, and each immediate child under `packages/`. A directory without a `package.json` is a placeholder and generates a warning. Without a root manifest, detection warns and skips both JS jobs. With a root manifest and zero workspaces, root lint and formatting still run and the matrix skips with a warning. Once a workspace has a manifest and a root exists, its matrix entry runs regardless of which files changed.

For full checks, endy-rkt-19 supplies the root npm workspace manifest, lockfile and [pinned quality dependencies](code-policy.md#eslint). Every initialized workspace provides the [required scripts](code-policy.md#ci-script-contract) and a TypeScript project extending the shared base. The `test` script must run unit and integration coverage as those suites land. The workflow currently selects Node 22 by major and invokes Prettier and ESLint directly. [D15](../decisions/project-decisions.md#d15-node-and-npm-workspace-runtime) rollout under endy-rkt-18 makes CI read the exact `.nvmrc` patch and use the pinned npm version for `npm ci`. After endy-rkt-13 adds the root scripts, CI uses `npm run format:check` and `npm run lint` with the same enforcement. Root JS checks are blocking from the first root manifest, including before the scripts land.

A green `ci-ok` before workspace initialization can reflect intentional skips. [endy-rkt-21](../product/task.md#endy-rkt-ci-follow-up) verifies the first hosted `ci-ok` and records evidence from root checks and each initialized workspace. Hosted execution and repository settings are unverified.

[CREATED, NOT EXECUTED] Dependabot groups weekly GitHub Actions and npm version updates into at most two open version PRs per ecosystem, targeting `develop`. npm version updates become useful after the root manifest exists. Security updates still target GitHub's default branch. If a security PR targets `main`, send the fix through a PR into `develop` and promote it normally. [Dependabot targeting and grouping](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#target-branch)

## CI rollout regression checks

Use these cases during endy-rkt-21 and verify the required check on both protected branches during endy-rkt-22.

| Case                                                                                  | Expected result                                                                                                             |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Checkout has no root manifest                                                         | Detection warns and both JavaScript jobs skip. Branch guard and secret scan remain blocking.                                |
| Root manifest exists with no initialized workspaces                                   | Root install, format and lint run and block on failure. The matrix skips with a warning.                                    |
| Root manifest and initialized workspaces exist                                        | Root checks run and each workspace runs `typecheck`, `test` and `build`. A missing, invalid or failed script fails `ci-ok`. |
| Runtime audit flags a high-severity finding                                           | Triage the finding. The audit is advisory and a finding alone does not fail `ci-ok`.                                        |
| PR into `main` comes from another branch or repository, or Gitleaks reports a finding | The corresponding gate fails `ci-ok`. Verify secret scan output is redacted.                                                |

## Review and failure handling

Open the failed Actions job and use its annotation or first failing command to fix the underlying check. Inspect `detect` for expected skips, a workspace row for missing or failed scripts, and `lint` for lockfile or root policy failures. Triage advisory audit findings even when `ci-ok` is green. Run the available local checks and report exact commands and results in the PR. Use “not runnable yet” where prerequisites are missing. Never weaken or skip a required check to get a green result. CI workflow and Dependabot changes require approval from endy-rkt. See the [PR checklist](../../.github/PULL_REQUEST_TEMPLATE.md).

## Public repository security

Keep secrets and real `.env` files out of Git and keep real credentials out of docs, tests and logs. Commit only safe placeholders in examples. Use seed data without personal information. Rotate or revoke an exposed credential immediately and notify endy-rkt. Deleting a commit cannot recall copies of a public secret. [GitHub guidance on sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)

[CONFIRMED] D18 requires rights clearance and separate human review before publication. Keep cultural media out of Git until endy-rkt approves the rights, consent and attribution requirements for public redistribution, including any community restrictions. Use synthetic data or approved fixtures in the meantime.

## Repository settings checklist

[NOT IMPLEMENTED] endy-rkt applies and verifies branch protection for `develop` and `main` in endy-rkt-12 and endy-rkt-22 after endy-rkt-21 produces the hosted `ci-ok` check. Select the actual check from GitHub Actions. Apply the approved [rollout settings](../decisions/project-decisions.md#github-rollout-settings) during that rollout.

- [ ] Protect `develop` and `main` with a ruleset or branch protection. Require a PR, **`ci-ok` only**, one approval, dismissal of stale approvals and resolution of review conversations. Block direct pushes, force pushes and deletion. Confirm `main` receives only same-repo `develop` PRs through the branch guard.
- [ ] Include admins. Use no routine bypass.
- [ ] Require strict branch updates on `main` and looser updates on `develop`.
- [ ] Enable secret scanning, push protection, Dependabot alerts and security updates. Defer CodeQL until there is application code and capacity to review findings. Public repositories support these controls.
- [ ] Use read-only default Actions workflow permissions and require approval for first-time fork contributors. Consider an allowlist for actions.
- [ ] Squash topic PRs into `develop`, use merge commits for promotion, delete merged topic branches and keep `develop` protected.
- [ ] Defer CODEOWNERS to endy-rkt-24 once owner handles and reviewer coverage are confirmed. Prefer a small file for CI and shared contracts. Public repositories can require code-owner review.
- [ ] Consider a README CI badge after the first successful run.

[Branch protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) · [Security features](https://docs.github.com/en/code-security/getting-started/github-security-features) · [Actions settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository) · [Merge methods](https://docs.github.com/en/pull-requests/reference/pull-request-merges) · [Code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)

## Deferred checks and open rollout choices

- [CREATED, NOT EXECUTED] endy-rkt-23: the `service` job starts one disposable PostgreSQL 18.6 service. Auth's suite creates, migrates and drops its own database, and `REQUIRE_DB_TESTS` makes it fail instead of skipping. The same suite passed locally against PostgreSQL 18.1. Earlier wording: provision one disposable PostgreSQL instance when the first database-backed integration test lands. Prisma-backed suites share that instance with isolated test data and apply only their own service's migrations. [Test plan](quality-gates.md#testing-and-service-definition-of-done) · [Data ownership](../architecture/data-storage.md#postgresql-isolation)
- [NOT IMPLEMENTED] Add changed-service Docker builds on PRs into `main` after the service Dockerfiles exist. Changes to shared build inputs must trigger rebuild coverage for every dependent image. E2E smoke tests and CD are future work. [Build context policy](../architecture/services.md#dockerfile-placement)
- [CONFIRMED] Keep full-history Gitleaks scans on pushes and manual dispatches initially, and retain base-to-head scans on PRs. Revisit incremental push scans after a trusted baseline exists.
- [CONFIRMED] Keep the runtime audit advisory with `npm audit --audit-level=high --omit=dev -w <workspace>` and triage findings. Revisit blocking severity after findings and triage capacity are known.
