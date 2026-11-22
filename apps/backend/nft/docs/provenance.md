# Provenance display data (NFT-05)

- **Owner:** salandri-42
- **Date:** 2026-11-22
- **Status:** [PROPOSED] Implemented by rivon0507 with Claude for [#63](https://github.com/songomby-D1/devfest2026/issues/63). It applies S21 and S22 of [ADR 0002](../../../../docs/decisions/0002-open-question-settlements.md), which are themselves proposed.

`ProvenanceModule` (`src/provenance/`) builds the public provenance of a published item. The route and body are in [docs/api/nft.yaml](../../../../docs/api/nft.yaml).

## Behaviour

1. **Publication.** `ContentReferenceService.assertPublished` (NFT-02). An unknown, draft or unpublished item answers the same `404 NOT_FOUND`, so a draft never leaks. A non-UUID gives `400 VALIDATION_FAILED`. If Content cannot answer, the result is `503 CONTENT_UNAVAILABLE` (fail closed).
2. **Mint record.** `MintRecordReader.findLatestForContent(contentId)`: the pending or confirmed request, otherwise the latest failed one. With no record, the body is `{ contentId, mint: null, scope }`. This is the Gate 0 convention for "no mint" (`mint` is nullable), not a `404`. If the records cannot be read, the result is `503 NFT_UNAVAILABLE`.
3. **View.** The body is the frozen `Provenance` with the `MintRecord` fields, plus optional fields:
   - `pending`: network and, once sent, `transactionHash` and its explorer link.
   - `failed`: status, an allowlisted `failureCode` and its safe `failureReason`. Unknown codes become `UNKNOWN`.
   - `confirmed`: `tokenId`, `transactionHash`, `explorer.{transaction, token}`, `tokenUri` (`ipfs://`), `metadataUrl` (from `IPFS_GATEWAY_URL`), `metadataCid`, `masterHash`, `mintedAt`, and `verification`.
   - Stored values are kept only when they have the expected shape (hash, address, decimal token ID, `ipfs://` URI). The requester ID, idempotency key, attempts and request ID are never returned.
4. **Verification (confirmed only, best effort).** `ChainProvenanceReader` runs `getArtwork`, `verifyFixity(tokenId, recorded masterHash)` and `tokenURI` together within 3 seconds:
   - `verified`: the token exists, `verifyFixity` is `true`, and the on-chain hash and token URI equal the record.
   - `mismatch`: the chain answered and disagrees, or the token does not exist.
   - `unverifiable`: RPC error or timeout. The response is still `200`.
5. **Cache.** Confirmed: `public, max-age=60`. Confirmed but `unverifiable`: `public, max-age=15`. No mint, pending, failed and errors: `no-store`. The gateway relays `Cache-Control`.

Links use `EXPLORER_BASE_URL` (`<base>/tx/<hash>`, `<base>/nft/<contract>/<tokenId>`). No new environment variable is needed.

## Wiring follow-up (after NFT-04 #62 and this PR merge)

The module ships with FAKE default bindings, so every item reads as `mint: null` until the follow-up lands:

| Token                     | Default (fake)                      | Follow-up binds                                                                                                                                                                                                                                                                                                         |
| ------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MINT_RECORD_READER`      | `InMemoryMintRecordReader` (empty)  | NFT-04's `MintRepository`: `{ provide: MINT_RECORD_READER, useExisting: MINT_REPOSITORY }`, importing the module that exports it. `MintRequestRecord` is a superset of `ProvenanceMintRecord`, and the method name `findLatestForContent` is the same, so no adapter is needed.                                         |
| `CHAIN_PROVENANCE_READER` | `UnconfiguredChainProvenanceReader` | A viem implementation next to NFT-04's `BlockchainPort` (`src/blockchain/`), using the same public client and `PreservingArt` ABI: `getArtwork(tokenId)` (map the `Category` index to `Painting`/`Sculpture`/`Craft`, `mintedAt` seconds to a `Date`), `verifyFixity(tokenId, hash)` and `tokenURI(tokenId)`. A revert with `ERC721NonexistentToken` returns `null` (or `false`); any other error rejects. |

The follow-up must also:

- Make the gateway's frozen path answer with this body: in NFT-04's `MintController`, have `GET /internal/v1/provenance/:contentId` call `ProvenanceService.read(contentId, { requestId })` and set `Cache-Control` with `cacheControlOf`, or move that path into `ProvenanceController` and delete NFT-04's handler. Keep only one handler per path.
- Put `ServiceTokenGuard` (NFT-04, `src/common/service-token.guard.ts`) on `ProvenanceController`.
- Import `PUBLIC_FAILURES` and the scope sentences from NFT-04's `src/mint/mint-failure.ts` and `src/mint/mint-view.ts` instead of the copies in `provenance-view.ts`, or the reverse, so there is one source.
