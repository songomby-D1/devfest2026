# Quality gates

This page describes quality and test expectations. The [shared code policy](code-policy.md) defines code conventions, and the [CI guide](ci.md) describes execution and GitHub settings.

[CREATED, NOT EXECUTED] The workflow is present. [NOT IMPLEMENTED] Local scripts and app test suites still need to land. The tooling rollout approval point is [D17](workflow.md).

| Stack item | Recommendation and rationale |
|---|---|
| React + TypeScript and NestJS + TypeScript | [CONFIRMED] Keep. |
| PostgreSQL and S3-compatible storage | [CONFIRMED] Keep. [RECOMMENDED] Use the smallest local topology that exercises ownership and media flows. [Data and storage](../architecture/data-storage.md) |
| SeaweedFS | [RECOMMENDED] Evaluate as the leading local candidate under D05. Verify the operations the demo needs. |
| Dedicated gateway and Nginx | [CONFIRMED] Keep the gateway. [RECOMMENDED] Defer Nginx under D06 until edge deployment requirements justify a second layer. |
| Docker and Docker Compose | [CONFIRMED] Keep. [RECOMMENDED] Start with local Compose integration and build each application independently. |
| Taskfile | [RECOMMENDED] Keep it thin and delegate to workspace scripts. [Planned commands](workflow.md) |
| GitHub Actions | [CREATED, NOT EXECUTED] See the [CI guide](ci.md). |
| ESLint, formatting and TypeScript checks | [CONFIRMED] Required. See the [shared code policy](code-policy.md). |
| Gitleaks and dependency checks | [CONFIRMED] Required, with dependency checks where practical. [Gitleaks upstream](https://github.com/gitleaks/gitleaks) |

See the [code policy](code-policy.md#environment-and-secrets) for environment and secrets handling and the [media security policy](../architecture/data-storage.md#media-flow-and-security) for uploads and access.

## CI enforcement

[CONFIRMED] The [CI guide](ci.md#jobs) defines the PR and push gates, workspace coverage and audit behavior. The [script contract](code-policy.md#ci-script-contract) defines what every workspace provides.

## Testing and service definition of done

[CONFIRMED] Each frontend or backend owner writes and maintains the unit and integration tests for their app or service. A new app or service also needs an owner-written Dockerfile and an entry in the root Compose file. Test the app's actual boundaries, including Prisma-backed behavior for services that persist data. [Task ownership](../team/responsibilities.md#task-ownership)

- [RECOMMENDED] Unit-test business rules and edge cases with deterministic inputs.
- [RECOMMENDED] Integration-test real HTTP and local PostgreSQL behavior for each stateful service. Exercise storage operations against the chosen S3-compatible service. Use deterministic fixtures or a controlled upstream for blockchain behavior and rehearse the live test environment separately.
- [RECOMMENDED] Keep end-to-end coverage to critical smoke flows through the gateway. Check guest discovery and a protected action, plus the integrated media, provenance and 3D demo where practical. Prioritize behaviors from the [MVP acceptance criteria](../product/MVP.md) over coverage targets.

| Service | Proposed completion check |
|---|---|
| Frontend | Cover the main user flows and failed gateway responses with component and integration tests. |
| Auth | Account lifecycle and access denial pass HTTP/database integration, including ended-session rejection. |
| Content & Verification | Upload, permission and review semantics match the approved contract and survive storage and validation failures. |
| NFT | Test pending, confirmed, duplicate and failed outcomes. Rehearse one real mint on the approved demo network. |
| LiDAR | A valid asset and association resolve through the gateway. Unavailable assets have an observable fallback. |
| Gateway | Verify public contract and error shape, auth propagation and an end-to-end smoke path across service boundaries. |

[RECOMMENDED] For each service, require its build and checks to pass, the agreed contract and environment variables to be documented, and an independent startup check with declared dependencies before review by endy-rkt.
