# Contributing

This guide defines the Git workflow and review requirements.

## Branches and review

[CONFIRMED] `main` stays demo-ready and receives no direct commits. `develop` is the integration branch. Start each logical task from `develop` using `feature/<name>`, `fix/<name>`, `docs/<name>` or `chore/<name>`.

[CONFIRMED] Run applicable local checks, push the task branch, open a PR into `develop`, wait for required CI and review, and then merge. Validate integration on `develop` before promoting stable work to `main` by PR. Tag demo and release milestones from the validated commit.

[RECOMMENDED] Use commits in the form `type(scope): summary`, with types aligned to task branches. This makes changes easy to scan. Use `demo-v0.1.0` for demo tags and `v0.1.0` for release tags to distinguish milestones.

[CONFIRMED] Follow the [shared code policy](docs/development/code-policy.md) and complete the [PR checklist](.github/PULL_REQUEST_TEMPLATE.md). Changes to lint, formatting and TypeScript configs require CTO approval.

[RECOMMENDED] Link the approved task and record why the change is needed, assumptions and unresolved risks. Use at least one approval and request CTO review for architecture, security and service contract changes. New substantive commits should receive fresh review.

## Branch protection checklist

[NOT IMPLEMENTED] Configure both `develop` and `main` manually on GitHub. Verify the settings against a test PR once required checks report.

- [ ] Require PRs before merging and restrict direct pushes, including bypasses where repository permissions allow.
- [ ] Require review approval and resolution of review conversations.
- [ ] Require the CI status described in [quality gates](docs/development/quality-gates.md) once the workflow exists.
- [ ] Disable force pushes and branch deletion on both branches.
- [ ] Promote only validated integration work from `develop` into `main`.

[GitHub branch protection documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
