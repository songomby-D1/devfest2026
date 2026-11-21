# Team responsibilities

Use this page to identify owners and coordinate handoffs before implementation.

| Person | Assignment |
|---|---|
| CTO | [CONFIRMED] Architecture, repository structure, technical decisions, quality, security, integration, development directives and inter-service contracts |
| Mika | [CONFIRMED] Content management, uploads, content and description verification |
| Salohy | [CONFIRMED] NFT |
| Sedra | [CONFIRMED] UI/UX mockups and design, README contribution |
| Shido | [CONFIRMED] LiDAR scanning and 3D |

[CTO DECISION REQUIRED] **D02 Auth delivery owner.** [RECOMMENDED] Assign one agent under CTO supervision if capacity allows so the CTO can review security and keep integration moving. The CTO can own delivery directly for tighter control at the cost of integration time, or assign a member with capacity at the cost of time on that person's existing work. Assign the Auth owner before work relying on identity begins.

[RECOMMENDED] Use the CTO as gateway acceptance owner because the gateway joins all contracts. Confirm an implementation assignee for the gateway and frontend under **D02**. Sedra's confirmed design assignment alone does not assign frontend coding.

| Timing | Handoff |
|---|---|
| Before protected flows | Auth owner gives the CTO and service owners the agreed identity, claims and session behavior. |
| Before contract-dependent prototypes | Mika gives Salohy and Shido stable content identity and publication semantics. Shido gives Mika the 3D asset association and readiness semantics. |
| Before frontend integration | CTO gives frontend delivery and Sedra the gateway contract, media behavior, status labels and error states. |
| Before demo rehearsal | Salohy reports wallet, test funds, confirmation behavior and metadata reachability. Shido supplies a tested 3D asset and device fallback. Mika supplies reviewed, permitted demo content. CTO checks the full flow. |

[RECOMMENDED] Sedra's mockups, Mika's content planning, Salohy's ecosystem comparison and Shido's device/asset check can proceed in parallel after task approval. Use one owner per integration seam to limit rework.
