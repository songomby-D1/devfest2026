# 0003 D08–D11 NFT chain, standard, wallet and contract

- **Status:** Proposed. Recorded by rivon0507 on 2026-11-22 for salandri-42 to confirm at review. Nothing here is binding until the decision owner accepts it.
- **Decision owner:** salandri-42 ([MVP section C](../product/MVP.md#c-nft-and-digital-provenance))
- **Date:** 2026-11-22
- **Backlog:** NFT-01 ([#59](https://github.com/songomby-D1/devfest2026/issues/59)), feeding endy-rkt-06 ([#27](https://github.com/songomby-D1/devfest2026/issues/27)) and DEMO-03
- **Evidence:** the [NFT service proposal](../../apps/backend/nft/nft_context.md) (D2–D6, §8), the committed [ABI](../../apps/backend/nft/src/blockchain/abi/PreservingArt.abi.json), the [mint](../../apps/backend/nft/docs/metadata.md) and [provenance](../../apps/backend/nft/docs/provenance.md) implementations, and the [local demo contract artifact](../../scripts/demo/preserving-art.json)

## Context

The MVP requires a working NFT journey: from a published item, an eligible user starts a mint, sees pending, confirmed or failed status, and can inspect the chain, token and transaction references. Token metadata must resolve from the demo environment, private media must never reach the chain or public metadata, and an NFT must not be presented as proof of physical authenticity or ownership of intellectual property.

[MVP section C](../product/MVP.md#c-nft-and-digital-provenance) asks the owner to compare cost, testnet and test funds, tooling, demo reliability and integration time, then demonstrate signing, confirmation and metadata resolution with the chosen stack. The service, the client and the contract already follow one consistent set, so this ADR records it and states what is still unproven.

## Options

| Decision                      | Options compared                                                                                                                                            | Chosen, and why                                                                                                                                                                                                                                                                                          |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D08 Blockchain**            | Avalanche Fuji C-Chain, Sepolia, Solana devnet                                                                                                              | **Avalanche Fuji C-Chain (`43113`).** EVM-compatible, so the same Solidity, ABI and viem client work on a local Ganache chain (`31337`); block times are about two seconds; test AVAX comes from a faucet.                                                                                               |
| **D09 NFT standard**          | ERC-721, ERC-1155, a non-EVM token standard                                                                                                                 | **ERC-721, one token per item.** The works are unique pieces. A single standard with one token per ContentId keeps the contract and the metadata simple; editions would need ERC-1155 and are not in the MVP.                                                                                            |
| **D10 Wallet**                | Ecosystem browser wallet or connector, hosted wallet, custodial gallery wallet                                                                              | **Custodial gallery wallet.** The NFT service signs and pays gas, so artisans without a wallet can mint and mobile works without a wallet step. The trade-off is that one key holds the minting authority.                                                                                               |
| **D11 Contract and metadata** | Audited standard implementation with minimal customization, an existing minting service, a bespoke contract; metadata on HTTPS or content-addressed storage | **Minimal `PreservingArt` contract (Solidity 0.8.28, OpenZeppelin 5.x) with immutable tokens, and content-addressed metadata on IPFS through Pinata.** `safeMint` is owner-only and refuses an item that already has a token; the master file itself is never published, only its SHA-256 goes on-chain. |

Rejected in more detail:

- **Sepolia** would also satisfy the EVM requirement, but Fuji gives faster confirmations and a faucet that has been reliable for the team, and the NFT spec already targets it.
- **Solana devnet** would force a parallel non-EVM stack (program, wallet and client libraries) with no benefit for a single-item provenance demo.
- **ERC-1155** supports editions the MVP does not need, and it complicates the one-token-per-artwork invariant that already prevents double minting at the contract level.
- **A browser or hosted wallet** adds an account, a network and a rejection path per user, while the gallery wallet already owns the contract.
- **A bespoke contract** would enlarge the audit surface; the standard OpenZeppelin composition covers everything the demo needs.
- **HTTPS metadata** is reachable but mutable and dependent on one host; `ipfs://` content addressing is what makes the on-chain `tokenURI` durable.

## Chosen set and where it lives

| Piece               | Implementation                                                                                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chain guard         | `TESTNET_CHAIN_IDS = [43113, 31337]` in [`env.schema.ts`](../../apps/backend/nft/src/config/env.schema.ts); any other chain ID refuses to boot.                                          |
| Client              | viem 2.57.16 in `src/blockchain/viem-blockchain.ts`, behind `BlockchainPort`; gas estimate × 1.2, token ID read from the `ArtworkMinted` event.                                          |
| Artwork key         | `keccak256(UTF-8(lowercase ContentId))` in [`artwork-key.ts`](../../apps/backend/nft/src/blockchain/artwork-key.ts), so the same item always maps to the same on-chain key.              |
| Contract interface  | `safeMint(to, artworkKey, uri, title, category, masterHash)`, `tokenByArtwork`, `getArtwork`, `verifyFixity`, `totalMinted`, plus standard ERC-721 reads, in the committed ABI.          |
| Metadata            | ERC-721 JSON built from public fields only and pinned on IPFS; `tokenURI` is `ipfs://<metadata CID>`. See [metadata.md](../../apps/backend/nft/docs/metadata.md).                        |
| Public verification | `verifyFixity`, `tokenURI` and `ownerOf` reads power the `verified` / `mismatch` / `unverifiable` block in [provenance.md](../../apps/backend/nft/docs/provenance.md).                   |
| Local demo          | `PreservingArt` bytecode in [`preserving-art.json`](../../scripts/demo/preserving-art.json), deployed by [`deploy-contract.mjs`](../../scripts/demo/deploy-contract.mjs) on chain 31337. |

Invariants that follow: at most one token per artwork key, token IDs start at 1, and `tokenURI`, title, category, master hash and mint time never change after minting.

## Evidence

| Claim                                             | Status                                                                                                                                                            |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract compiles and deploys                     | Deployed on the local Ganache chain from the `feature/nft-l1` artifact (DEMO-02 groundwork).                                                                      |
| Mint, idempotency and chain reconciliation        | Covered by the NFT service suites with a fake chain and Testcontainers PostgreSQL (NFT-04, NFT-05).                                                               |
| Metadata resolves and contains public fields only | Covered by the builder allowlist tests (NFT-03); `fake` and Pinata drivers both implemented, the `fake` driver refused in production.                             |
| Signing and confirmation on Fuji                  | **Not demonstrated.** The MVP asks for a signing, confirmation and metadata-resolution run on the candidate stack before selection; only the local chain has run. |
| Contract source and Hardhat tests on `develop`    | **Not present.** `develop` has the ABI and the demo bytecode; the Solidity source and its Hardhat suite are on `feature/nft-l1`.                                  |
| Pinata quota and gateway reachability             | **Not measured.** Pinata JWT and network access are salandri-42's, and the free-tier limits have not been recorded here.                                          |

## Consequences

- The demo depends on two external accounts: the Fuji faucet for gas and Pinata for pinning. Both need a rehearsal before DEMO-03, and the local `fake` driver and Ganache chain keep development unblocked without them.
- One gallery key signs every mint, and the worker is single-replica on purpose, so nonce conflicts stay impossible. Losing or leaking that key loses the minting authority for the contract; it must stay out of Git, logs and reports.
- Tokens inherit standard ERC-721 transfers, so a future marketplace needs an explicit transfer policy decision. [Deferred scope](../../apps/backend/nft/docs/deferred-scope.md) records the question; NFT-06 keeps marketplace functionality out of the MVP.
- The chain stores a hash and token identifiers, never media or personal data. A later move to a different chain or contract would require a new deployment and a migration note, not a data migration.
- Pinata's free tier is enough for a demo, not for a production catalogue; persistence and cost need a decision before any public launch.

## Follow-ups

1. salandri-42 confirms or amends D08–D11 here.
2. Land the `PreservingArt` Solidity source and its Hardhat tests on `develop` from `feature/nft-l1`, so the ABI in this repository has its source beside it.
3. Run one Fuji deployment, mint and metadata resolution, and record the transaction, token and gateway URL under DEMO-03. Until then, NFT-01 stays in review and the selection is not fully demonstrated.
4. Decide the transfer policy before any marketplace work; keep NFT-06 deferred meanwhile.
