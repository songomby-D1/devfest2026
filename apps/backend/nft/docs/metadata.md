# NFT metadata linked to published content (NFT-03)

- **Owner:** salandri-42
- **Date:** 2026-11-22
- **Status:** [PROPOSED] Implemented by rivon0507 with Claude for [#61](https://github.com/songomby-D1/devfest2026/issues/61). It applies settlements S21 and S22 of [ADR 0002](../../../../docs/decisions/0002-open-question-settlements.md), which are themselves proposed.

`MetadataModule` (`src/metadata/`) provides `METADATA_PUBLISHER`. The interface is in `src/metadata/metadata-publisher.port.ts`. `prepare(contentId, { requestId })` returns everything `safeMint` needs: `tokenUri`, `masterHash`, `title` and `category`, plus the CIDs. NFT-04 (mint) wires it in a follow-up.

## Steps

1. **Publication.** NFT calls `assertPublished` (NFT-02). A draft or unpublished item gets `409 CONTENT_NOT_PUBLISHED`.
2. **Snapshot.** NFT calls `GET /internal/v1/items/{id}` as the `nft` service with no user headers. Content treats that call as a guest, and a guest can only read published items. If the item has been unpublished since step 1, the result is still `CONTENT_NOT_PUBLISHED`.
3. **Master file.** The master is the first image in Content's media order, which is the display order, so it is also the item's thumbnail. With no image, the master is the first video. With no media at all, the item gets `422 CONTENT_NOT_MINTABLE`, because the contract refuses an empty `masterHash`. NFT streams the file from `GET /internal/v1/items/{id}/media/{mediaId}` and hashes it with sha256. It then compares the hash and the size with what Content recorded: the strong `ETag`, which content.yaml documents as the file's SHA-256, and `bytes`. A mismatch, or a missing `ETag`, gives `502 MEDIA_INTEGRITY_FAILED`. `masterHash` is `0x` followed by the 64 hex characters.
4. **Public preview.** The master image itself is pinned as is. The MVP does not resize it, because that would add an image library. An item with only videos has no preview: `imageCid` is `null` and the metadata has no `image`. The image is already public, since Content serves the media of published items to everyone, so pinning it publishes nothing private. Videos are never pinned.
5. **Metadata.** The JSON below is pinned as a file named `lova-<contentId>-metadata.json`. The preview is pinned as `lova-<contentId>-preview`. `tokenURI` is `ipfs://<metadata CID>`.

## Metadata format

The format follows ERC-721 metadata. It is built only from public fields:

```json
{
  "name": "<full title>",
  "description": "<public description>",
  "image": "ipfs://<preview CID>",
  "attributes": [
    { "trait_type": "Kind", "value": "textile" },
    { "trait_type": "Category", "value": "Craft" },
    { "trait_type": "Creator", "value": "<creator name>" },
    { "trait_type": "Community", "value": "<community>" },
    { "trait_type": "Technique", "value": "<technique>" },
    { "trait_type": "Origin", "value": "<origin>" },
    { "trait_type": "Period", "value": "<period>" },
    {
      "trait_type": "Item claim",
      "value": "verified | uncertain | unreviewed"
    },
    {
      "trait_type": "Description claim",
      "value": "verified | uncertain | unreviewed"
    }
  ],
  "properties": {
    "contentId": "<ContentId>",
    "category": "Craft",
    "kind": "textile",
    "master_sha256": "0x<64 hex>",
    "claims_note": "Claim statuses record the review by human community reviewers on LOVA ...",
    "files": [
      { "uri": "ipfs://<preview CID>", "type": "image/png", "role": "preview" }
    ]
  }
}
```

- Optional attributes are left out when they are empty. `external_url` is left out until the public site has a stable item URL.
- The metadata never includes owner or account IDs, emails, the rights statement, media captions or URLs, reviews, reviewer IDs, rationales, evidence, advisory signals or timestamps. Two allowlists enforce this. The zod schema of the snapshot drops every other field, and the builder copies named fields only. `metadata-builder.spec.ts` checks the complete set of keys.
- `claims_note` says that statuses come from human reviewers, and that a token neither certifies physical authenticity nor ownership (MVP section C). Nothing in the metadata implies verification by AI.

## Idempotency

The key order is fixed and the JSON holds nothing time-dependent. The same snapshot therefore always gives the same bytes. With `cidVersion: 1`, Pinata returns the same CID for the same bytes and reports it as a duplicate. Running `prepare()` again for an unchanged item returns the same `PreparedMetadata`. Content forbids edits while an item is published, so a snapshot only changes after an unpublish, an edit and a new publication. `tokenURI` never changes after mint (invariant I3).

## IPFS

The `Pinner` interface is in `src/ipfs/`. `IPFS_DRIVER` selects its implementation:

- `pinata`: `POST https://api.pinata.cloud/pinning/pinFileToIPFS` with `Authorization: Bearer $PINATA_JWT`. The JWT is never logged and never appears in an error. Each upload has a budget of `IPFS_TIMEOUT_MS`. A 429, 502, 503, 504 or connection failure gets one retry. A timeout or a 4xx gets none. Any failure gives `503 IPFS_UNAVAILABLE`.
- `fake`: pins stay in memory. The CID is the CIDv1 (`raw`, sha2-256) of the bytes, so it is deterministic. It is only equal to Pinata's CID for small files, because Pinata chunks larger ones. The configuration forbids this driver in production.

## Title and category

- **Title.** The contract accepts at most 256 UTF-8 bytes. NFT truncates the title on a grapheme boundary, so no character or emoji sequence is split. It does not refuse long titles. Content allows up to 160 characters, and refusing them would make some published items impossible to certify. The full title stays in the metadata `name`.
- **Category.** [PROPOSED] The mapping is `painting` → `Painting` and `sculpture` → `Sculpture`. Every other kind (`photograph`, `textile`, `object`, `other`, and any later kind) maps to `Craft`. [DECISION REQUIRED: salandri-42, papangoo]

## Public errors

All errors use the `{ code, message, requestId }` body.

| Code                     | Status | When                                                                                     |
| ------------------------ | ------ | ---------------------------------------------------------------------------------------- |
| `VALIDATION_FAILED`      | 400    | The ContentId is not a UUID                                                              |
| `CONTENT_NOT_FOUND`      | 404    | The item does not exist                                                                  |
| `CONTENT_NOT_PUBLISHED`  | 409    | The item is a draft or unpublished, including when it changes during the preparation     |
| `CONTENT_NOT_MINTABLE`   | 422    | The item has no media file or no title                                                   |
| `MEDIA_TOO_LARGE`        | 422    | The master file is larger than `MAX_IMAGE_BYTES` (images) or `MAX_MASTER_BYTES` (videos) |
| `MEDIA_INTEGRITY_FAILED` | 502    | The streamed file does not match Content's recorded sha256 or size                       |
| `CONTENT_UNAVAILABLE`    | 503    | Content cannot be reached, refuses the credentials, times out or answers an invalid body |
| `IPFS_UNAVAILABLE`       | 503    | A pin failed                                                                             |
