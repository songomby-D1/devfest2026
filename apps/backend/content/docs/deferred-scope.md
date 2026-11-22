# Deferred scope: Content & Verification

This page records the Content & Verification work that is deferred until after the MVP. Each item is documented here and not implemented, as the [parallel workflow](../../../../docs/agents/parallel-workflow.md#agent-2) asks for `#58` and `#87`.

- **Owner:** papangoo
- **Date:** 2026-11-22
- **Status:** [PROPOSED] Drafted by rivon0507 with Claude for papangoo to confirm. Items marked [CONFIRMED] quote existing project decisions. Items marked [PROPOSED] are suggestions that nobody has agreed to yet.

## CONTENT-06: production integration of AI-assisted analysis ([#58](https://github.com/songomby-D1/devfest2026/issues/58))

**What is deferred.** The production module in `apps/backend/content` that would call Sightengine for AI-generated detection (CONTENT-05a) and the Anthropic API for the description-to-media check (CONTENT-05b). It would also store the results in an `advisory_signals` table and expose them to reviewers. The deferral covers the Prisma model, the provider calls, the reviewer read fields, the optional re-run route and their OpenAPI entries, all sketched in the [advisory-signal contract](../../../../docs/architecture/ai-assisted-analysis-spike.md#advisory-signal-contract-content-05c).

**Why.**

- [CONFIRMED] MVP section B: "Defer automated analysis integration". AI may flag issues or suggest metadata, but "an automated suggestion leaves the verification status unchanged" and AI cannot grant verified status. [MVP section B](../../../../docs/product/MVP.md#b-content-and-verification)
- [CONFIRMED] D18 makes publication depend on human review of item and description claims and on rights clearance, not on automated analysis. [D18](../../../../docs/decisions/project-decisions.md#d18-editorial-policy-and-demo-content)
- [DECISION REQUIRED: endy-rkt] Clearance to send cultural media to an external AI API is still pending. S17 in [ADR 0002](../../../../docs/decisions/0002-open-question-settlements.md) proposes a settlement that endy-rkt has not confirmed.
- [NOT IMPLEMENTED] The CONTENT-05a and CONTENT-05b findings (accuracy, cost, threshold, retention terms) are not written yet, and the CONTENT-05c contract is only proposed.

**What the MVP does instead.**

- CONTENT-05 stays a timeboxed exploration on permitted samples. Its findings go in the [spike report](../../../../docs/architecture/ai-assisted-analysis-spike.md).
- An authorized human records the item and description outcomes through CONTENT-04, with evidence and rationale (D18).
- [PROPOSED] Content returns no advisory signals in the MVP. The frozen `ItemDetail.advisorySignals` field is optional, so the service omits it.

**Guardrails the current code keeps.** These keep CONTENT-06 additive, so it needs no rework:

1. Only the CONTENT-04 review route sets a claim status to `verified` or `uncertain`. A material edit only resets it to `unreviewed` (CONTENT-01). `src/items/claim-status-writes.spec.ts` fails if any other code writes a claim status. Outside reviews, decisions and owner edits (CONTENT-04 puts an edited `returned` or `accepted` submission back `in_review`), no code path writes `claimStatus`, `publicationStatus` or `submissionStatus`.
2. Publication depends on the two claim outcomes and rights clearance only (S3, proposed). Nothing in review or publication waits for, reads or requires a signal.
3. Item and description claims stay separate, keyed by the stable ContentId (`items.id`), because each future signal names the claim it informs (`item` or `description`).
4. Material edits keep resetting claims in the same transaction as the edit. CONTENT-06 marks signals stale in that same place.
5. `advisorySignals` stays reviewer-only and owner-only in `ItemDetail`. It never appears in `ItemSummary`, public listings, NFT metadata or provenance data.
6. The MVP Content service has no AI provider SDK, no outbound provider calls and no provider key in `.env.example` or code.
7. [PROPOSED] CONTENT-03 records the SHA-256 of each stored media file. CONTENT-06 needs it for the `inputFingerprint`, and S22 needs it for the on-chain master hash.

**Dependencies.** CONTENT-05a ([#84](https://github.com/songomby-D1/devfest2026/issues/84)) and CONTENT-05b ([#85](https://github.com/songomby-D1/devfest2026/issues/85)) findings. The CONTENT-05c contract ([#86](https://github.com/songomby-D1/devfest2026/issues/86)), confirmed. CONTENT-03 media, which supplies `mediaId`. CONTENT-04 review ([#56](https://github.com/songomby-D1/devfest2026/issues/56)). The external AI clearance (endy-rkt). The additive `[CONTRACT CHANGE]` on `AdvisorySignal` (endy-rkt). The reviewer panel design (Sesedra).

**When to revisit.** [PROPOSED] After the MVP demo is signed off under D01, and only once all three hold: endy-rkt has confirmed the clearance, 05a and 05b have reported results with a cost and a threshold, and papangoo has confirmed the 05c contract.

**Who decides.** papangoo decides scope and timing. endy-rkt decides the clearance and the contract change.

**Open questions.**

1. Does the analysis run inline at upload, or as background work? D16 starts with synchronous HTTP, and the provider latency is not measured yet.
2. Who holds the provider budget and quota after the timebox (Sightengine allows 500 operations a day)?
3. The questions listed in the [spike report](../../../../docs/architecture/ai-assisted-analysis-spike.md#open-questions) still apply.

## CONTENT-08: content moderation ([#87](https://github.com/songomby-D1/devfest2026/issues/87))

**What is deferred.** Automated moderation of uploaded media and descriptions, such as nudity, violence or offensive text, through an AI API or Sightengine's moderation models. Those are a separate set of models from the AI-generated detection in CONTENT-05a. Visitor reports and takedown tooling are also outside the MVP, because MVP section B defers advanced editorial tooling and MVP section D excludes administrative interfaces.

**Why.**

- [CONFIRMED] The issue records the idea and its dependencies only. It adds no work to the MVP.
- [CONFIRMED] D18 already requires human review and rights clearance before publication. The first integrated demo uses one approved item (D01), seeded and reviewed with papangoo (DEMO-02). [D01](../../../../docs/decisions/project-decisions.md#d01-first-integrated-mvp-demo)

**What the MVP does instead.** Human review is the gate. A submission stays out of public browsing until a reviewer records both claim outcomes and rights clearance is set (D18, CONTENT-04). Guests see published items only (MVP section A).

**Guardrails the current code keeps.**

1. Drafts and unpublished items never appear in public listings, and guests cannot open their detail (CONTENT-02).
2. Publication stays one decision point inside Content, so a moderation check can be added in front of it later.
3. [PROPOSED] A moderation result, if added later, is its own record or signal kind. Moderation is not verification, so it never writes a claim status.
4. [PROPOSED] The publication state model does not treat `published` as terminal, so a takedown transition can be added later without a migration rewrite.
5. No moderation provider SDK or key is added during the MVP.

**Dependencies.** CONTENT-06 ([#58](https://github.com/songomby-D1/devfest2026/issues/58)) for the provider integration. A clearance like S17 to send media to a moderation provider. A provider choice and its cost.

**When to revisit.** [PROPOSED] After the MVP, if uploads open beyond the team's reviewed content, or if reviewers can no longer screen every submission by hand. The issue's acceptance criterion then applies: decide whether moderation is needed, which provider fits and what it costs.

**Who decides.** papangoo decides. endy-rkt decides any change to the product scope or budget.

**Open questions.**

1. D18 has no reject outcome. How does a reviewer stop an inappropriate submission from being published, given that S3 proposes publishing automatically once both outcomes and rights clearance are recorded?
2. Should moderation screen a submission before review, or appear to the reviewer as another advisory signal?
3. Do visitors need a way to report a published item?
