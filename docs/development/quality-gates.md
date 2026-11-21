# Quality gates

This page describes the CI and test plan. The [shared code policy](code-policy.md) defines code conventions and root settings.

[NOT IMPLEMENTED] CI and scripts are planned. The tooling rollout approval point is [D17](workflow.md).

| Stack item | Recommendation and rationale |
|---|---|
| React + TypeScript and NestJS + TypeScript | [CONFIRMED] Keep. |
| PostgreSQL and S3-compatible storage | [CONFIRMED] Keep. [RECOMMENDED] Use the smallest local topology that exercises ownership and media flows. [Data and storage](../architecture/data-storage.md) |
| SeaweedFS | [RECOMMENDED] Evaluate as the leading local candidate under D05. Verify the operations the demo needs. |
| Dedicated gateway and Nginx | [CONFIRMED] Keep the gateway. [RECOMMENDED] Defer Nginx under D06 until edge deployment requirements justify a second layer. |
| Docker and Docker Compose | [CONFIRMED] Keep. [RECOMMENDED] Start with local Compose integration and build each application independently. |
| Taskfile | [RECOMMENDED] Keep it thin and delegate to workspace scripts. [Planned commands](workflow.md) |
| GitHub Actions | [RECOMMENDED] Use one PR workflow with a stable required result. |
| ESLint, formatting and TypeScript checks | [CONFIRMED] Required. See the [shared code policy](code-policy.md). |
| Gitleaks and dependency checks | [CONFIRMED] Required, with dependency checks where practical. [Gitleaks upstream](https://github.com/gitleaks/gitleaks) |

See the [code policy](code-policy.md#environment-and-secrets) for environment and secrets handling and the [media security policy](../architecture/data-storage.md#media-flow-and-security) for uploads and access.

## Planned CI

[CONFIRMED] Every PR to `develop` or `main` requires ESLint, formatting, TypeScript, unit tests, integration tests, builds, Gitleaks and a dependency vulnerability check where practical. The required result fails when any required check fails.

[NOT IMPLEMENTED] [RECOMMENDED] Install from the lockfile and cache npm downloads by lockfile. Select affected app checks inside the workflow and always report one required status. A change confined to one service should rebuild that service. A change to `packages/shared` must check every direct and transitive consumer. Check affected consumers for root inputs and contract changes. Run the full suite when the affected set is unclear. Run Gitleaks on the PR range with sufficient history. Use the package manager audit with an approved threshold, documented time-limited exceptions and visible outage handling under D17. Enable required status checks manually using the [contribution checklist](../../CONTRIBUTING.md#branch-protection-checklist).

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
