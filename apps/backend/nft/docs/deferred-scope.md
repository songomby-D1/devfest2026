# Deferred scope: NFT and digital provenance

This page records the NFT work that is deferred until after the MVP. It is documented here and not implemented, as the [parallel workflow](../../../../docs/agents/parallel-workflow.md#agent-2) asks for `#64`.

- **Owner:** salandri-42
- **Date:** 2026-11-22
- **Status:** [PROPOSED] Drafted by rivon0507 with Claude for salandri-42 to confirm. Items marked [CONFIRMED] quote existing project decisions or the NFT specification. Items marked [PROPOSED] are suggestions that nobody has agreed to yet.

## NFT-06: marketplace functionality ([#64](https://github.com/songomby-D1/devfest2026/issues/64))

**What is deferred.** Everything that trades or moves a token after it is minted:

- listing, sale, purchase and bids
- payments in fiat or crypto, and royalties such as ERC-2981
- transfers started from the product UI, and tokens sent to user wallets
- integration with a third-party marketplace
- any mainnet deployment

**Why.**

- [CONFIRMED] MVP section C: "Defer transfers within the product UI, payments and a marketplace. This limits external integration to the required provenance journey." [MVP section C](../../../../docs/product/MVP.md#c-nft-and-digital-provenance)
- [CONFIRMED] The [NFT specification](../nft_context.md) excludes sale, UI transfer, payments and marketplace in §1.1. In §2.2 it puts user wallets, transfer or sale of tokens, royalties, marketplace and mainnet out of scope.
- [CONFIRMED] A token records a digital event. On its own it establishes neither physical authenticity nor ownership of intellectual property (MVP section C). A sale would suggest an ownership the project does not establish.
- [CONFIRMED] salandri-42 owns D08 to D11 ([delegated decisions](../../../../docs/decisions/project-decisions.md#decisions-already-delegated)). The specification's custodial model mints every token to the gallery wallet, which pays the gas (spec D2, D3, D14). S2 in [ADR 0002](../../../../docs/decisions/0002-open-question-settlements.md) proposes keeping that model.

**What the MVP does instead.** Mint and provenance only. The owner of a published item requests a mint (S1, proposed). The NFT service mints one ERC-721 token per item to the gallery wallet on the chosen testnet (S21, proposed: Avalanche Fuji, still pending NFT-01). The user sees the pending, confirmed or failed status (NFT-04), then the provenance data and the fixity check (NFT-05).

**Guardrails the current code keeps.** These keep a later marketplace possible without a re-mint or a data migration:

1. No HTTP route, queue message or UI action transfers, approves, lists or sells a token. The only NFT write is the mint request, and every other route is a read.
2. The service never calls `transferFrom`, `safeTransferFrom`, `approve` or `setApprovalForAll` with the gallery wallet, so tokens stay in that wallet (spec D2, D14). The standard ERC-721 functions inherited from OpenZeppelin (spec §8.1) stay as they are for interoperability. `PreservingArt` gets no custom sale, escrow or royalty logic.
3. `tokenURI` never changes after mint (spec D13, invariant I3). The metadata keeps the marketplace-standard fields `name`, `description`, `image`, `animation_url` and `attributes` (spec objective O4), so a later listing needs no new token.
4. No private data goes on-chain or into public metadata: no account IDs, emails, private media or reviewer notes (S22, MVP section C). No price or buyer data either.
5. The NFT schema and contract hold no price, payment, buyer or seller fields. The NFT data maps a ContentId to a token and its transaction state only (S20, proposed).
6. One token per item (spec D5, invariant I1). Editions and ERC-1155 are out.
7. Testnet only. The service holds no mainnet key and no mainnet RPC configuration.
8. The interface explains what a token establishes, and never presents it as a purchase or as ownership of the work (MVP section C).

**Dependencies for later.** Product scope approval from endy-rkt. Legal and rights review, covering intellectual property, consent of the source communities and revenue sharing. A mainnet chain with real funds. A payment provider. User wallets, which would reverse the custodial model (S2). Seller and buyer permissions in Auth and Content (D13). Frontend flows. An assessment of whether the deployed contract can support it or needs a new contract.

**When to revisit.** [PROPOSED] After the MVP demo is signed off under D01, and only if endy-rkt adds commerce to the product scope and the legal and rights review is done.

**Who decides.** salandri-42 decides within NFT scope. endy-rkt decides the product scope.

**Open questions.**

1. Should a token ever leave the gallery wallet, for example in a custodial handover to an artisan or a source community?
2. Should source communities receive royalties if sales are ever allowed?
3. Should the MVP contract block transfers at the contract level (non-transferable tokens), so that guardrail 2 is enforced on-chain? It would make a later marketplace require a new contract. `PreservingArt` on `feature/nft-l1` currently inherits the standard ERC-721 transfers.
