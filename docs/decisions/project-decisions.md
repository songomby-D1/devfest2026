# Project decisions

Use this register to see which decisions need endy-rkt, which belong to app or service owners, and when each decision matters. The current documentation work is on the `docs/decision` branch.

## Confirmed

- App and service owners own initialization, implementation, APIs or client integration, tests, Dockerfiles and their root Compose entries. Stateful service owners also own their PostgreSQL data design, Prisma schema and migrations within one shared PostgreSQL instance per environment. [Ownership rules](../team/responsibilities.md#task-ownership)
- Owners choose their internal design, service-local dependencies and testing approach within the shared quality rules. Owners agree cross-service contracts, changes to shared Compose resources and integration timing with the affected owners.
- endy-rkt defines the MVP and system overview. Escalate scope changes, system-wide architecture and security rules, and repository-wide tooling or policy changes to endy-rkt. Agents take direction from the relevant owner.
- **D02 is resolved.** endy-rkt owns the gateway and shared local infrastructure, shidoAdr owns Auth and LiDAR, and Sesedra owns frontend implementation and design. MVP planning proceeds without a deadline. [Team responsibilities](../team/responsibilities.md)
- **D05 storage provider.** SeaweedFS is the local S3-compatible object store, and endy-rkt owns setup. Media delivery is still open. [Data and storage](../architecture/data-storage.md#s3-compatible-option)

## D01 First integrated MVP demo

[CONFIRMED] endy-rkt approved a single-item journey for the first integrated MVP demo. Use the same Content item ID from authenticated submission through human review, publication, guest browsing, interactive 3D and confirmed NFT minting. Frontend application requests go through the dedicated gateway. Auth owns identity and assigned permissions, Content owns review and publication, LiDAR owns 3D asset readiness, and NFT owns token association and confirmation. The item ID and publication status are the handoffs from Content. [Service boundaries](../architecture/services.md)

### Demo script and evidence checklist

Record the evidence against the same item ID under DEMO-03. [Demo backlog](../product/task.md#integration--demo-endy-rkt)

1. [ ] A signed-in contributor submits one item with rights-cleared media, author information and a description. Record the item ID and fixture rights clearance.
2. [ ] As a guest, check that the draft is absent from public browsing and direct access to its detail is denied. An authorized human then records separate outcomes for item claims and description claims before the item is published under the agreed policy. Record both outcomes and the publication status. [D18](#decisions-for-endy-rkt)
3. [ ] As a guest, find and open the same published item and verify that the applicable item and description review labels match the recorded outcomes.
4. [ ] On each agreed demo device, open the published item detail as a visitor and verify that the associated 3D model loads and rotates in response to input. Record the device and result. A rights-cleared pre-produced model can satisfy this gate. Live phone capture is optional.
5. [ ] An eligible user starts a mint from the same published item and reaches confirmed status on the chosen demo network. Verify that the user can inspect the chain, token and transaction references, and record those references with the item ID. Check that the displayed provenance explains the digital mint event and the scope of its claims. Verify that public token metadata is approved and that it and the on-chain data contain no private media, credentials or personal data.

**Integrated sign-off** requires the full journey with both a working interactive model and a confirmed mint in the same run. Record both results under DEMO-03.

If either gate is unavailable, label the run **Rehearsal** and record each missing gate. A still image can support a rehearsal. During DEMO-03, check the outcome for each gate independently. A still image in place of the model or a pending or failed mint in place of confirmation requires the rehearsal label and the corresponding missing gate, even when the other gate passes.

## Decisions for endy-rkt

The options below are recommendations for review. Each remains open until endy-rkt records a decision.

| Decision | Recommended choice | Decide before |
|---|---|---|
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
