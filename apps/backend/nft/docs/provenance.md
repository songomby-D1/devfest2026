# Provenance display data (NFT-05)

- **Owner:** salandri-42
- **Date:** 2026-11-22
- **Status:** [PROPOSED] Implemented by rivon0507 with Claude for [#63](https://github.com/songomby-D1/devfest2026/issues/63). It applies S21 and S22 of [ADR 0002](../../../../docs/decisions/0002-open-question-settlements.md), which are still proposed.

`ProvenanceService` (`src/provenance/`) builds the body of the frozen `GET /internal/v1/provenance/{contentId}` route. The gateway maps `GET /api/items/{id}/provenance` to that route. NFT-04's `MintController` serves it behind `ServiceTokenGuard` and delegates to the service. The contract is `getProvenance` in [docs/api/nft.yaml](../../../../docs/api/nft.yaml).

## Behaviour

1. **Publication.** The service calls `ContentReferenceService.assertPublished` (NFT-02).
   - An unknown, draft or unpublished item answers `404 NOT_FOUND`. All three get the same answer, so a draft never leaks.
   - A ContentId that is not a UUID answers `400 VALIDATION_FAILED`.
   - When Content cannot answer, the route fails closed with `503 CONTENT_UNAVAILABLE`.
2. **Mint record.** The service calls `MintRepository.findLatestForContent` (NFT-04).
   - It returns the pending or confirmed request, otherwise the latest failed one.
   - With no request, the body is `{ contentId, mint: null, scope }`. This follows the Gate 0 convention, so "no mint" is not a `404`.
   - When the records cannot be read, the route answers `503 NFT_UNAVAILABLE` with no detail.
3. **View.** `mint` holds every `MintRecord` field exactly as NFT-04 returns it, plus optional fields:
   - `failed`: `failureCode`, from the allowlist in `src/mint/mint-failure.ts`. Unknown codes become `UNKNOWN`.
   - `pending`: `explorer.transaction` once the transaction is sent.
   - `confirmed`: `explorer.{transaction, token}`, `tokenUri` (`ipfs://`), `metadataUrl` (built from `IPFS_GATEWAY_URL`), `metadataCid`, `masterHash`, `mintedAt` and `verification`.
   - A stored value appears in these added fields only when its shape is valid: a hash, an address, a decimal token ID or an `ipfs://` URI.
   - The requester ID, idempotency key, attempts and request ID are never returned.
4. **Verification (confirmed only, best effort).** The service calls `getArtwork`, `verifyFixity(tokenId, recorded masterHash)`, `tokenURI` and `ownerOf` together through `BlockchainPort`, with a 3-second limit:
   - `verified`: the token exists, `verifyFixity` is `true`, and the on-chain hash and token URI both equal the record.
   - `mismatch`: the chain answered and disagrees with the record, or the token does not exist (`ERC721NonexistentToken`).
   - `unverifiable`: the RPC failed or timed out, or the record has no master hash. A reconciled token can lack one. The response is still `200`.
5. **Cache.** The `Cache-Control` header depends on the result:
   - Confirmed: `public, max-age=60`.
   - Confirmed but `unverifiable`: `public, max-age=15`.
   - No mint, pending, failed and errors: `no-store`.
   - The gateway relays this header.

Explorer links use `EXPLORER_BASE_URL`: `<base>/tx/<hash>` for a transaction and `<base>/nft/<contract>/<tokenId>` for a token. NFT-05 adds no environment variable.

## Changes outside `src/provenance/`

- `BlockchainPort` gains `getArtwork`, `verifyFixity`, `tokenUri` and `ownerOf`. `ViemBlockchain` implements them against the `PreservingArt` ABI, which gains these views and `ERC721NonexistentToken`. Any other read error becomes `CHAIN_UNAVAILABLE`.
- `MintController`'s provenance handler delegates to `ProvenanceService` and sets `Cache-Control`. `MintService.provenance` and `toProvenanceView` in `mint-view.ts` are removed.
- Wiring follow-up of NFT-03 and NFT-04: `MintModule` imports `MetadataModule`, so `METADATA_PUBLISHER` is NFT-03's `MetadataService`. `FakeMetadataPublisher` moved to `test/support/`, and the HTTP tests override `METADATA_PUBLISHER` with it.
