# Task allocation for the open issues

This note distributes the open GitHub issues into three parallel workstreams. It is a planning aid only: the [backlog](../product/task.md) and the [MVP scope](../product/MVP.md) remain the source of truth.

**Order:** Agent 1 unblocks the contracts and shared infrastructure first. Agents 2 and 3 then work in parallel. Agent 3 orchestrates the final validation with the deliverables of the other two agents.

Issues already implemented in open branches (`3D-01/02`, `FE-01`, `NFT-07`, `AUTH-07`, and similar) should be **integrated and merged** rather than redone.

## Agent 1 — Foundations, infrastructure, gateway and Auth

**Features:** global decisions, workspace/CI, PostgreSQL and SeaweedFS, gateway, accounts and sessions.

- Decisions and scoping: `#1`, `#22`–`#27` (CTO-01 to CTO-06), D04–D07, D13, D16–D18
- Workspace, tooling, quality and CI: `#23`, `#28`–`#45` (CTO-07 to CTO-24)
- Infrastructure and gateway: `#31` (CTO-10), `#30` (CTO-09), `#29` (CTO-08)
- Auth: `#97` (AUTH-07), `#46`–`#51` (AUTH-01 to AUTH-06), `#17`

**Deliverable:** services start through Compose, gateway/service contracts are agreed, and register → login → logout → guest browsing work end to end.

## Agent 2 — Content, verification and NFT

**Features:** item records, uploads, human review, advisory AI signals, minting and provenance.

- Content: `#52`–`#56` (CONTENT-01 to CONTENT-04), `#57`, `#84`–`#86` (CONTENT-05a/b/c), `#18`
- Deferred items to document: `#58` (CONTENT-06), `#87` (CONTENT-08)
- NFT: `#2`, `#59`–`#64` (NFT-01 to NFT-06)
- Demo data: `#73` (DEMO-02, together with Agent 3)

**Deliverable:** one reviewed item can be published, claim verification is shown separately from publication status, and a minted token carries provenance data linked to the published content.

## Agent 3 — UX, frontend, 3D and demo

**Features:** user journey, screens, 3D gallery, gateway integration and demo rehearsal.

- UX/frontend: `#19`, `#65`–`#71` (UX-01 to UX-03, FE-01 to FE-05), `#20`
- LiDAR and 3D: `#6`, `#8`–`#16` (3D-01 to 3D-06)
- Demo: `#21`, `#72`–`#76` (DEMO-01 to DEMO-05)

**Deliverable:** an immersive gallery with an interactive 3D model and a still-image fallback, the full journey connected through the gateway, and a validated, tagged demo release.
