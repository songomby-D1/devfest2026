# AI-assisted analysis spike

This report gathers the findings of the AI-assisted analysis exploration, CONTENT-05 ([#57](https://github.com/songomby-D1/devfest2026/issues/57)). It is an exploration only: the production integration is CONTENT-06 ([#58](https://github.com/songomby-D1/devfest2026/issues/58)) and content moderation is CONTENT-08 ([#87](https://github.com/songomby-D1/devfest2026/issues/87)).

- **Owner:** papangoo
- **Date:** 2026-11-22
- **Status:** [PROPOSED] The advisory-signal contract (CONTENT-05c) below is a proposal drafted by rivon0507 with Claude for papangoo to confirm. [NOT IMPLEMENTED] The findings of CONTENT-05a and CONTENT-05b are not written yet.

## Rules that apply

These rules are already settled. This report does not change them.

- [CONFIRMED] A claim is `unreviewed`, `verified` or `uncertain`, tracked separately for the item claims and for the description claims. An automated suggestion leaves the verification status unchanged. AI cannot establish the authenticity of a cultural artifact or grant verified status. [MVP section B](../product/MVP.md#b-content-and-verification)
- [CONFIRMED] D18 requires separate human review of item and description claims and rights clearance before publication, and re-review of materially changed claims. [D18](../decisions/project-decisions.md#d18-editorial-policy-and-demo-content)
- [CONFIRMED] The Gate 0 contract on branch `agent1-foundation` already declares the read shape of a signal: `AdvisorySignal { kind: 'ai_generated' | 'description_mismatch', score, source, note, createdAt }`, with a score between 0 and 1 where higher means a stronger signal. `ItemDetail.advisorySignals` is present only for reviewers and the owner, and `ClaimStatus` says "automated signals never change it". See [`packages/shared/src/content.ts`](https://github.com/songomby-D1/devfest2026/blob/agent1-foundation/packages/shared/src/content.ts) and [the platform contract](https://github.com/songomby-D1/devfest2026/blob/agent1-foundation/docs/specs/platform-contract.md).
- [CONFIRMED] papangoo chose Sightengine for AI-generated detection (05a), on one image or on three frames of a video taken at 30%, 50% and 70% of its duration, and the Anthropic API with `claude-sonnet-5-5` for the description-to-media check (05b). Descriptions can be in English, French or Malagasy, with no special handling for Malagasy. papangoo holds the API keys, which stay in `.env`. [Handoff](../agents/handoff.md)
- [DECISION REQUIRED: endy-rkt] Explicit clearance before cultural media is sent to an external AI API is still pending. papangoo's position is recorded on [#57](https://github.com/songomby-D1/devfest2026/issues/57), and [ADR 0002](../decisions/0002-open-question-settlements.md) proposes a settlement (S17) that endy-rkt has not confirmed.

## AI-generated detection (CONTENT-05a)

[NOT IMPLEMENTED] CONTENT-05a ([#84](https://github.com/songomby-D1/devfest2026/issues/84)) adds the sample results, the cost per image and per video, the daily and monthly capacity, the recommended threshold and the uncertainty of the signal here.

## Description-to-media coherence (CONTENT-05b)

[NOT IMPLEMENTED] CONTENT-05b ([#85](https://github.com/songomby-D1/devfest2026/issues/85)) adds the measured cost and latency, the data-retention and training terms of the Anthropic API, the results per sample, the failure cases and the 3D approach here.

## Advisory-signal contract (CONTENT-05c)

This section answers CONTENT-05c ([#86](https://github.com/songomby-D1/devfest2026/issues/86)). It proposes how a signal from 05a or 05b is stored next to the claim statuses of CONTENT-04 ([#56](https://github.com/songomby-D1/devfest2026/issues/56)) and shown to reviewers, so that a signal never changes a verification status. The storage and endpoints are implemented in CONTENT-06, not here. The OpenAPI draft in `docs/api/` follows once this contract is agreed.

### Fit with the claim statuses

[PROPOSED] Signals live in their own table, `advisory_signals`, in the Content database. Nothing in the signal flow writes `items.claimStatus`, `descriptions.claimStatus`, `publicationStatus` or `submissionStatus`. Each signal names the claim it informs:

| Signal kind            | Source             | Target        | Informs, without changing                                         |
| ---------------------- | ------------------ | ------------- | ----------------------------------------------------------------- |
| `ai_generated`         | 05a, Sightengine   | `item`        | `items.claimStatus`, the identity or source claims about the item |
| `description_mismatch` | 05b, Anthropic API | `description` | `descriptions.claimStatus`, the claims made in the description    |

The reviewer reads the signal, then records the outcome through the CONTENT-04 review route (`POST /api/items/{id}/review`) on their own judgment. A signal never pre-fills, suggests or blocks an outcome. Under the proposed publication rule S3 in [ADR 0002](../decisions/0002-open-question-settlements.md), publication depends on the two claim outcomes and the rights clearance only, so a missing, failed or stale signal never blocks review or publication.

### Signal fields

[PROPOSED] One row per analysis run. Rows are append-only: a new run adds a row, and the newest row for the same item, target, kind and media is the current one. Older rows stay for the audit trail.

| Field              | Type                                     | Meaning                                                                                                                                                                                                        |
| ------------------ | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`               | UUID                                     | Signal ID.                                                                                                                                                                                                     |
| `itemId`           | UUID                                     | The ContentId (`items.id`). A foreign key inside the Content database, deleted with the item.                                                                                                                  |
| `target`           | `item` \| `description`                  | The claim the signal informs. Fixed by the kind, stored for clarity and indexing.                                                                                                                              |
| `kind`             | `ai_generated` \| `description_mismatch` | The frozen `AdvisorySignalKind`.                                                                                                                                                                               |
| `mediaId`          | UUID or `null`                           | The analyzed media file once CONTENT-03 adds media. Required for `ai_generated`, `null` for `description_mismatch`, which covers the whole item.                                                               |
| `state`            | `completed` \| `failed` \| `unsupported` | Whether the run produced a result. See [failure modes](#failure-modes).                                                                                                                                        |
| `verdict`          | see below, or `null`                     | `ai_generated`: `likely_ai`, `likely_not_ai` or `uncertain`. `description_mismatch`: `coherent`, `not_coherent` or `uncertain`, as #85 defines. `null` unless `state` is `completed`.                          |
| `score`            | number from 0 to 1, or `null`            | Higher means a stronger signal, as in the frozen contract: the probability of AI generation for `ai_generated`, the strength of the mismatch for `description_mismatch`. `null` unless `state` is `completed`. |
| `reason`           | text, at most 280 characters, or `null`  | A short reason a reviewer can read. For a failure, a safe failure reason without provider internals. Exposed as the frozen `note`.                                                                             |
| `provider`         | text                                     | `sightengine` or `anthropic`. Exposed in the frozen `source` together with the model.                                                                                                                          |
| `model`            | text                                     | The model or model set used, for example Sightengine's `genai` model or `claude-sonnet-5-5`.                                                                                                                   |
| `modelVersion`     | text or `null`                           | The version the provider reports, when it reports one.                                                                                                                                                         |
| `inputFingerprint` | text                                     | A SHA-256 over the exact inputs, used to detect staleness. See [staleness](#staleness).                                                                                                                        |
| `operationsUsed`   | integer or `null`                        | Provider operations consumed, for the Sightengine quota.                                                                                                                                                       |
| `requestedAt`      | timestamp                                | When the run started.                                                                                                                                                                                          |
| `completedAt`      | timestamp or `null`                      | When the result or the failure was recorded. Exposed as the frozen `createdAt`.                                                                                                                                |
| `staleAt`          | timestamp or `null`                      | When a material change made the signal stale. `null` while it is current.                                                                                                                                      |

[PROPOSED] The raw provider response, the media and the description text are not copied into the row. The row keeps only the extracted fields above.

[PROPOSED] The verdict vocabulary never uses `verified`, `authentic`, `fake` or `genuine`, so a signal cannot be read as a claim outcome.

A Prisma sketch for CONTENT-06, not applied by this report:

```prisma
enum SignalTarget {
  item
  description
}

enum SignalKind {
  ai_generated
  description_mismatch
}

enum SignalState {
  completed
  failed
  unsupported
}

/// Advisory only (MVP section B). Never written into a claim status.
model AdvisorySignal {
  id               String       @id @default(uuid()) @db.Uuid
  itemId           String       @db.Uuid
  item             Item         @relation(fields: [itemId], references: [id], onDelete: Cascade)
  target           SignalTarget
  kind             SignalKind
  mediaId          String?      @db.Uuid
  state            SignalState
  verdict          String?
  score            Decimal?     @db.Decimal(4, 3)
  reason           String?      @db.VarChar(280)
  provider         String
  model            String
  modelVersion     String?
  inputFingerprint String
  operationsUsed   Int?
  requestedAt      DateTime     @db.Timestamptz(3)
  completedAt      DateTime?    @db.Timestamptz(3)
  staleAt          DateTime?    @db.Timestamptz(3)

  @@index([itemId, target, kind])
  @@map("advisory_signals")
}
```

### Invariants

[PROPOSED] CONTENT-06 enforces and tests each of these.

1. **A signal never changes a verification status.** The signal module has no code path that writes a claim status, a publication status or a submission status. A test records a signal of each kind and verdict and checks that the item and description claim statuses are unchanged.
2. **A signal is never a gate.** Review and publication proceed without a signal, with a failed one or with a stale one.
3. **A reviewer can see it.** `GET /api/items/{id}` returns the signals, current and stale, to reviewers and to the owner, as the frozen contract says. Guests, `ItemSummary`, public listings, NFT metadata and provenance never carry them (S22 in [ADR 0002](../decisions/0002-open-question-settlements.md) keeps public metadata to an approved snapshot).
4. **A material change makes a signal stale.** See [staleness](#staleness). A stale signal stays visible with a stale label. It is never deleted or hidden silently.
5. **Uncertainty stays visible.** `uncertain`, `failed` and `unsupported` results are shown as such. They are never dropped or shown as a negative result.

### Staleness

[PROPOSED] CONTENT-01 already resets a claim status to `unreviewed` on a material edit (D18): any change to the description text resets the description claim, and a change to the item metadata or author information resets the item claim. Signals follow the same transaction but only for the inputs they analyzed:

| Change                                        | Claim reset (CONTENT-01, CONTENT-03)   | Signals marked stale                                                   |
| --------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------- |
| Description text changed                      | Description claim                      | Every `description_mismatch` signal of the item                        |
| Media file added, replaced or removed         | Item claim, once CONTENT-03 defines it | `ai_generated` for that media, and every `description_mismatch` signal |
| 3D angle pictures replaced                    | Defined by CONTENT-03 and LiDAR        | Every `description_mismatch` signal that used them                     |
| Title, kind, origin, period or author changed | Item claim                             | None: no signal analyzes these fields                                  |
| Rights statement or confirmation changed      | None                                   | None                                                                   |

The `inputFingerprint` is a SHA-256 over the media file bytes for `ai_generated`, and over the normalized description text plus the SHA-256 of each media file or angle picture sent for `description_mismatch`. The service sets `staleAt` in the same transaction as the edit. As a second guard, a signal whose fingerprint no longer matches the current inputs is shown as stale even if `staleAt` was missed, and a run that completes after its inputs changed is recorded as stale at once.

Re-running a stale signal is not automatic in this proposal: see the open questions.

### Retention and privacy

- **What is sent.** [PROPOSED] To Sightengine: the image, or the three extracted frames of a video. To the Anthropic API: the description text and the image, the video frames or the 3D angle pictures. Nothing else: no ContentId, owner ID, email, author name, community, rights statement or file name. A random per-run request ID is used if the provider needs one.
- **Metadata stripped.** [PROPOSED] EXIF and other embedded metadata, which can hold a location or a device owner, are stripped from images and frames before they leave the service.
- **Nothing kept at the providers on our side.** [PROPOSED] The service uploads the bytes in the request and stores no media at a provider (no provider-side galleries, files or URLs to private media). What a provider keeps afterwards depends on its terms: 05a and 05b record each provider's data-retention and training terms in this report (S17), and a provider whose terms do not fit the clearance is not used.
- **Nothing private stored locally.** [PROPOSED] The signal row keeps no raw provider response. Logs carry the signal ID, item ID, provider, state and fingerprint, never the description text, the media or the API key.
- **Clearance.** [DECISION REQUIRED: endy-rkt] Until endy-rkt confirms the clearance, only rights-cleared samples with no personal data are sent, as papangoo's position on #57 and S17 propose. For production (CONTENT-06), [PROPOSED] a media item is sent only after its rights are confirmed, and the open questions ask whether the uploader must also consent to external analysis.
- **Keys.** [CONFIRMED] papangoo holds the Sightengine and Anthropic keys. They stay in `.env` and never in Git.

### Failure modes

[PROPOSED] A failure is recorded as a signal row so that the reviewer sees that the analysis did not happen. It never blocks review.

| Case                                                                                              | Recorded as                                                    | Reviewer sees                             |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------- |
| Provider down, timeout or 5xx                                                                     | `failed`, reason "provider unavailable", after a bounded retry | Analysis unavailable                      |
| Quota or rate limit reached (Sightengine 500 a day, 1/s)                                          | `failed`, reason "quota reached"                               | Analysis unavailable, may be re-run later |
| Malformed or unparseable provider answer                                                          | `failed`, reason "invalid provider answer"                     | Analysis unavailable                      |
| Unsupported input (no media, file over 12 MB, frame extraction failed, 3D without angle pictures) | `unsupported`, with the reason                                 | Not analyzed, with the reason             |
| Low confidence (score inside the uncertainty band)                                                | `completed`, verdict `uncertain`                               | Uncertain, with the score and reason      |
| Language the model cannot judge                                                                   | `completed`, verdict `uncertain`, reason says so               | Uncertain                                 |
| Inputs changed while the run was in flight                                                        | Recorded, then stale at once                                   | Stale                                     |

[PROPOSED] The uncertainty band for `ai_generated` comes from the threshold 05a recommends. For `description_mismatch`, the model returns a verdict with a reason, and it is instructed to answer `uncertain` rather than guess, including for a description in a language it cannot judge well. No language detection is added (Malagasy has no special handling).

[PROPOSED] The description text is untrusted input to the model. The prompt treats it as data, and the answer is parsed against a strict schema (verdict, score, reason). Anything else is `failed`, so a description cannot steer the signal through injected instructions.

### What the reviewer interface shows

[PROPOSED] To agree with Sesedra, who owns the design:

- Signals sit in their own panel, labeled as automated and advisory, apart from the claim status labels. They never use the styling of `verified` (no check mark, no success color).
- A fixed notice in the panel says that the signals are advisory, do not change the verification status and cannot establish authenticity.
- Each signal shows its kind and target in words, the verdict, the score with what it means, the reason, the provider and model, and the date.
- `uncertain`, `failed`, `unsupported` and stale signals are shown with their state, never hidden. A stale signal says which change made it stale.
- The score is presented as a model output, not as a certainty. For `description_mismatch` it is a model-reported strength, not a calibrated probability.
- The owner's view and the guest view follow the visibility invariant: the owner sees the signals on their own item, guests never see them.

### API shape (sketch)

[PROPOSED] This is a sketch for discussion, not a contract. The OpenAPI draft in `docs/api/content.yaml` comes after the agreement.

- **Read.** The signals come through the frozen `ItemDetail.advisorySignals` of `GET /api/items/{id}`, for reviewers and the owner. The frozen fields map from the row: `kind`, `score`, `source` (`provider/model`), `note` (`reason`) and `createdAt` (`completedAt`). The frozen `score` is a required number, so `failed` and `unsupported` rows cannot be expressed in the frozen shape alone.
- **[CONTRACT CHANGE] Additive fields.** To show the invariants, the proposal adds optional fields to `AdvisorySignal`: `id`, `target`, `mediaId`, `state`, `verdict`, `stale` and `score: number | null`. Consumers that ignore them keep working, except that `score` becomes nullable. Until the change is agreed, a local adapter returns only `completed` signals in the frozen shape and the reviewer panel shows nothing for failed runs.
- **Write.** No public write route. In CONTENT-06 the analysis runs inside the Content service after a media upload or a description change, and records rows directly.
- **Re-run.** An optional reviewer route, `POST /api/items/{id}/advisory-signals/runs`, would request a new run of the stale or failed signals of an item. It is a later `[CONTRACT CHANGE]` and depends on the open questions.

Example of a completed `ai_generated` signal, with the additive fields:

```json
{
  "id": "6f1c2a9e-3b7d-4c41-9a52-0d8e7f3b1c24",
  "kind": "ai_generated",
  "target": "item",
  "mediaId": "a3e9b0c1-58f2-4d6a-8e17-2c4b9d0f6a13",
  "state": "completed",
  "verdict": "uncertain",
  "score": 0.48,
  "source": "sightengine/genai",
  "note": "Mean score of 3 video frames; frames disagree (0.21, 0.47, 0.76).",
  "stale": false,
  "createdAt": "2026-11-22T10:15:30.000Z"
}
```

Example of a completed `description_mismatch` signal, stale after a description edit:

```json
{
  "id": "0b7d4e2f-91a6-4c3e-b5d8-7f2a1c9e6b40",
  "kind": "description_mismatch",
  "target": "description",
  "mediaId": null,
  "state": "completed",
  "verdict": "not_coherent",
  "score": 0.82,
  "source": "anthropic/claude-sonnet-5-5",
  "note": "The description mentions a woven raffia basket; the images show a carved wooden figure.",
  "stale": true,
  "createdAt": "2026-11-22T10:16:02.000Z"
}
```

Example of a failed run, only expressible with the additive fields:

```json
{
  "id": "c52e8a17-4f0b-4d93-a6e1-3b9f2d7c0e85",
  "kind": "ai_generated",
  "target": "item",
  "mediaId": "a3e9b0c1-58f2-4d6a-8e17-2c4b9d0f6a13",
  "state": "failed",
  "verdict": null,
  "score": null,
  "source": "sightengine/genai",
  "note": "Quota reached. The analysis can be run again later.",
  "stale": false,
  "createdAt": "2026-11-22T10:15:31.000Z"
}
```

The values in these examples are illustrative, not measured.

### Open questions

**For papangoo (content owner):**

1. Confirm or amend this contract: the separate `advisory_signals` table, the fields, the verdict vocabulary and the append-only rows.
2. Should the owner see the signals on their own submission, as the frozen contract allows, or only reviewers? A `likely_ai` signal on a genuine item could discourage or mislead an uploader.
3. Which changes make a signal stale? The proposal ignores title, kind, origin, period and author changes because no signal analyzes them. Does the coherence check use the title too?
4. Are stale or failed signals re-run automatically when the quota allows, or only when a reviewer asks?
5. For production, must the uploader consent to external AI analysis at submission, beyond the rights confirmation? That would add a field to `CreateItemRequest`.
6. In which language is the `reason` written: English, or the language of the description?

**For endy-rkt (CTO, contract and clearance):**

1. Confirm the clearance to send cultural media to Sightengine and the Anthropic API, and under which conditions (S17, #57).
2. Accept the additive `[CONTRACT CHANGE]` on `AdvisorySignal`, including the nullable `score`, or keep the frozen shape and drop failed runs from the response.
3. Agree that no public write route is needed and that a re-run route, if any, is a later change.

**For Sesedra (design owner):**

1. Agree the reviewer panel: its placement apart from the claim labels, the fixed notice, the wording of each verdict and state, and how the score is presented.
2. Agree how stale, failed and unsupported signals look, so that uncertainty stays visible.
3. Agree the French labels for the panel, in line with the French paths and labels proposed in S8.
