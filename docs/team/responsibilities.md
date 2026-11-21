# Team responsibilities

Use this page to identify owners and coordinate handoffs before implementation.

| Person | Assignment |
|---|---|
| endy-rkt | [CONFIRMED] Architecture, repository structure, technical decisions, quality, security, integration, development directives and inter-service contracts |
| papangoo | [CONFIRMED] Content management, uploads, content and description verification |
| salandri-42 | [CONFIRMED] NFT |
| Sesedra | [CONFIRMED] UI/UX mockups and design, README contribution |
| shidoAdr | [CONFIRMED] LiDAR scanning and 3D |

[DECISION REQUIRED: endy-rkt] **D02 Auth delivery owner.** [RECOMMENDED] Assign one agent under endy-rkt's supervision if capacity allows so endy-rkt can review security and keep integration moving. endy-rkt can own delivery directly for tighter control at the cost of integration time, or assign a member with capacity at the cost of time on that person's existing work. Assign the Auth owner before work relying on identity begins.

[RECOMMENDED] Use endy-rkt as gateway acceptance owner because the gateway joins all contracts. Confirm an implementation assignee for the gateway and frontend under **D02**. Sesedra's confirmed design assignment alone does not assign frontend coding.

| Timing | Handoff |
|---|---|
| Before protected flows | Auth owner gives endy-rkt and service owners the agreed identity, claims and session behavior. |
| Before contract-dependent prototypes | papangoo gives salandri-42 and shidoAdr stable content identity and publication semantics. shidoAdr gives papangoo the 3D asset association and readiness semantics. |
| Before frontend integration | endy-rkt gives frontend delivery and Sesedra the gateway contract, media behavior, status labels and error states. |
| Before demo rehearsal | salandri-42 reports wallet, test funds, confirmation behavior and metadata reachability. shidoAdr supplies a tested 3D asset and device fallback. papangoo supplies reviewed, permitted demo content. endy-rkt checks the full flow. |

[RECOMMENDED] Sesedra's mockups, papangoo's content planning, salandri-42's ecosystem comparison and shidoAdr's device/asset check can proceed in parallel after task approval. Use one owner per integration seam to limit rework.
