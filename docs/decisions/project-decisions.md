# Project decisions

Use this register to see which decisions need endy-rkt, which belong to app or service owners, and when each decision matters. The current documentation work is on the `docs/decision` branch.

## Confirmed

- App and service owners own initialization, implementation, APIs or client integration, tests, Dockerfiles and their root Compose entries. Stateful service owners also own their PostgreSQL data design, Prisma schema and migrations within one shared PostgreSQL instance per environment. [Ownership rules](../team/responsibilities.md#task-ownership)
- Owners choose their internal design, service-local dependencies and testing approach within the shared quality rules. Owners agree cross-service contracts, changes to shared Compose resources and integration timing with the affected owners.
- endy-rkt defines the MVP and system overview. Escalate scope changes, system-wide architecture and security rules, and repository-wide tooling or policy changes to endy-rkt. Agents take direction from the relevant owner.
- **D02 is resolved.** endy-rkt owns the gateway and shared local infrastructure, shidoAdr owns Auth and LiDAR, and Sesedra owns frontend implementation and design. MVP planning proceeds without a deadline. [Team responsibilities](../team/responsibilities.md)
- **D05 storage provider.** SeaweedFS is the local S3-compatible object store, and endy-rkt owns setup. Media delivery is still open. [Data and storage](../architecture/data-storage.md#s3-compatible-option)

## Decisions for endy-rkt

The options below are recommendations for review. Each remains open until endy-rkt records a decision.

| Decision | Recommended choice | Decide before |
|---|---|---|
| D01 Demo scope | Prioritize one complete visitor and contributor path with human review, interactive 3D and a working NFT integration. Keep live phone capture conditional on feasibility. [MVP](../product/MVP.md) | Agreeing the first integrated demo |
| D04 PostgreSQL isolation | Use a separate database and service role per stateful service within the single PostgreSQL instance. The shared infrastructure owner coordinates provisioning. Service owners control their own schemas and migrations. [Data isolation](../architecture/data-storage.md#postgresql-isolation) | Shared PostgreSQL provisioning |
| D05 Media delivery | Validate SeaweedFS with Content and LiDAR. Start with gateway-mediated access and review a change to that boundary if measurements justify it. [Storage and delivery](../architecture/data-storage.md#s3-compatible-option) | Connecting upload and 3D storage |
| D06 Gateway deployment boundary | Use the dedicated NestJS gateway. Defer Nginx until a concrete edge requirement appears. [Gateway design](../architecture/overview.md#gateway-and-networking) | Initializing the gateway |
| D07 and D13 Identity and permissions | Ask the Auth and gateway owners to agree an Auth-owned revocable session and caller contract. Use one account model with a scoped reviewer permission and resource ownership checks. Review the trust boundary and who can perform protected actions. [Auth scope](../product/MVP.md#a-authentication) | Wiring protected flows |
| D14 Shared contracts and build context | Keep OpenAPI contracts with their services and share transport types only when needed. Keep the repository-root build context for applications importing `packages/shared`. [Shared package policy](../architecture/services.md#contracts-and-shared-package) | Adding shared aliases or builds that consume the package |
| D15 and D17 Runtime and repository tooling | Keep the current Node 22 CI baseline pending alignment with the workspace. Use CI and local scripts before hooks. Apply the manual protection checklist with one required check and one review. Confirm the audit policy, admin bypass, merge rules, push scan scope, CodeQL timing and CODEOWNERS coverage as part of rollout. [CI settings](../development/ci.md#repository-settings-checklist) | Initializing the root workspace and enabling required checks |
| D16 System-wide async infrastructure | Start with synchronous HTTP and status polling where needed. Owners can handle service-local retries or jobs within their data boundaries. Review a broker only if a cross-service requirement warrants one. [Communication](../architecture/overview.md#communication-and-long-running-work) | Introducing shared async infrastructure |
| D18 Editorial policy and demo content | Require human review and rights-cleared fixtures. Have the Content owner propose reviewer coverage, publication criteria and permitted media with input from affected owners. [Verification](../product/MVP.md#b-content-and-verification) | Accepting demo submissions or committing real cultural media |
| DEMO-01 Demo host | Use the local Compose stack for rehearsal. Confirm the venue's device and network conditions and a host that can reach the chosen testnet. [Demo backlog](../product/task.md#integration--demo-endy-rkt) | Booking the final rehearsal |

## Decisions already delegated

- **D08–D11:** salandri-42 chooses the NFT ecosystem, wallet, standard and minting approach within the MVP, with affected owners agreeing on API and metadata contracts.
- **D12:** shidoAdr chooses the 3D delivery approach within the MVP and coordinates viewer and asset contracts with the frontend and Content owners.
- **Service-local work:** Owners can proceed with approved work on their own API, schema, tests and packaging while the team resolves unrelated shared decisions. A shared dependency only blocks work that needs it.
