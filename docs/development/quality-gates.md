# Quality gates

This page proposes the checks that support review, independent deployment and demo reliability.

[NOT IMPLEMENTED] These checks and settings are planned. The approval point is [D17](workflow.md).

| Stack item | Recommendation and rationale |
|---|---|
| React + TypeScript and NestJS + TypeScript | [CONFIRMED] Keep. [RECOMMENDED] Use strict TypeScript in each application and reuse compiler policy where it reduces drift. |
| PostgreSQL and S3-compatible storage | [CONFIRMED] Keep. [RECOMMENDED] Use the smallest local topology that exercises ownership and media flows. [Data and storage](../architecture/data-storage.md) |
| SeaweedFS | [RECOMMENDED] Evaluate as the leading local candidate under D05. Verify the operations the demo needs. |
| Dedicated gateway and Nginx | [CONFIRMED] Keep the gateway. [RECOMMENDED] Defer Nginx under D06 until edge deployment requirements justify a second layer. |
| Docker and Docker Compose | [CONFIRMED] Keep. [RECOMMENDED] Start with local Compose integration and build each application independently. |
| Taskfile | [RECOMMENDED] Keep it thin and delegate to workspace scripts. [Planned commands](workflow.md) |
| GitHub Actions | [RECOMMENDED] Use one PR workflow with a stable required result. |
| ESLint, formatting and TypeScript checks | [RECOMMENDED] Use ESLint for lint rules, Prettier for formatting and the TypeScript compiler for strict type checks. Give each tool one role and prefer shared defaults. |
| Gitleaks and dependency checks | [RECOMMENDED] Scan the PR commit range and check runtime dependencies using the package manager's audit capability. This provides coverage without a second dependency scanner. [Gitleaks upstream](https://github.com/gitleaks/gitleaks) |

[RECOMMENDED] Use `.env.example` to document variable names and safe placeholders. Keep real environment files and credentials out of Git and CI logs. Validate required variables at startup, scope database and S3 credentials per service, and redact credentials and personal data in errors and logs. Use the [gateway error conventions](../architecture/services.md#contracts-and-shared-package) and the [media security policy](../architecture/data-storage.md#media-flow-and-security).

## Planned CI

[NOT IMPLEMENTED] [RECOMMENDED] Run `ci.yml` on pull requests to `develop` and `main`. Install from the lockfile using npm, cache the npm download cache by lockfile, and run lint, format checks, strict type checks, tests and builds. Prefer path filters per service directory within the workflow so a change confined to one service rebuilds only that service. A change to `packages/shared` must trigger every dependent application or service, including transitive consumers. Changes to root inputs or contracts should check affected consumers. Run the full suite when the affected set is unclear. Keep one always-reported required status that fails on any required job failure. Run Gitleaks on the PR range with sufficient history. Run dependency checks with an approved severity threshold and documented time-limited exceptions. Audit service outages should be visible and follow the CTO's policy. Enable required status checks manually using the [contribution checklist](../../CONTRIBUTING.md#branch-protection-checklist).

## Testing and service definition of done

- [RECOMMENDED] Unit-test business rules and edge cases with deterministic inputs.
- [RECOMMENDED] Integration-test real HTTP and local PostgreSQL behavior for each stateful service. Exercise storage operations against the chosen S3-compatible service. Use deterministic fixtures or a controlled upstream for blockchain behavior and rehearse the live test environment separately.
- [RECOMMENDED] Keep end-to-end coverage to critical smoke flows through the gateway. Check guest discovery and a protected action, plus the integrated media, provenance and 3D demo where practical. Prioritize behaviors from the [MVP acceptance criteria](../product/MVP.md) over coverage targets.

| Service | Proposed completion check |
|---|---|
| Auth | Account lifecycle and access denial pass HTTP/database integration, including ended-session rejection. |
| Content & Verification | Upload, permission and review semantics match the approved contract and survive storage and validation failures. |
| NFT | Test pending, confirmed, duplicate and failed outcomes. Rehearse one real mint on the approved demo network. |
| LiDAR | A valid asset and association resolve through the gateway. Unavailable assets have an observable fallback. |
| Gateway | Verify public contract and error shape, auth propagation and an end-to-end smoke path across service boundaries. |

[RECOMMENDED] For each service, require its build and checks to pass, the agreed contract and environment variables to be documented, and an independent startup check with declared dependencies before CTO review.
