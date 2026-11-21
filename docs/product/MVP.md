# MVP scope

Use this specification to size a functional demo of Malagasy cultural heritage discovery and its supporting workflows.

[NOT IMPLEMENTED] All capabilities below describe planned behavior. [DECISION REQUIRED: endy-rkt] **D01 Hackathon deadline and demo scope.** [RECOMMENDED] Confirm the deadline and reserve an integration and rehearsal window. Use one end-to-end content journey to size the demo while preserving the confirmed capabilities.

## A. Authentication

- **Purpose and owner.** Give people a way to browse openly and take account-bound actions. [DECISION REQUIRED: endy-rkt] Delivery owner under [D02](../team/responsibilities.md).
- **MVP.** [CONFIRMED] Registration, login, logout, guest browsing, authenticated uploaders and customers, and access controls where needed. The Auth service owns identity and authentication. [RECOMMENDED] Guests can browse published content, public media, and displayed 3D and provenance information. Require sign-in to upload, manage one's uploads, request a mint where authorized, or perform a review. Customer and uploader are activities available to one account.
- **Access decision.** [DECISION REQUIRED: endy-rkt] **D13 Role model.** [RECOMMENDED] Use guest, signed-in account and a narrow reviewer permission with per-item ownership checks so routine users need no separate role assignment.
- **Future.** [RECOMMENDED] Defer social login and account administration to keep the demo focused.
- **Dependencies.** Auth and gateway identity handling under [D07](../architecture/overview.md#gateway-and-networking). Content and NFT enforce resource permissions.
- **Acceptance criteria.**
  - A guest opens a published item and is denied access to drafts and protected actions.
  - A new user registers, logs in, performs an authorized action and logs out. The ended session cannot perform another protected action.
  - A signed-in user can browse and upload with the same account and cannot edit another user's item or act as a reviewer without permission.

## B. Content and verification

- **Purpose and owner.** [CONFIRMED] papangoo owns images and video, author details, metadata, descriptions, and verification of content and descriptions.
- **MVP.** [RECOMMENDED] An uploader submits an image or video and provides author details, metadata and a description. Track verification independently for identity or source claims about the item and for claims in its description. An authorized human records the evidence, the claims reviewed and the outcome. Display claim status separately from publication status.
- **Verification decision.** [DECISION REQUIRED: endy-rkt] **D18 Review, demo content and media policy.** [RECOMMENDED] Use `unreviewed`, `verified` and `uncertain` per claim or review scope. Internally record the reviewer and rationale. Mark a materially changed claim unreviewed until reviewed again. Agree who reviews demo content, publication requirements, permitted samples, file limits and whether an AI exploration fits the deadline.
- **Analysis and evidence.** [CONFIRMED] Explore AI-assisted analysis. Automated analysis may flag issues or suggest metadata for review. Human validation records what evidence supports each claim. Verified information means the reviewer found sufficient evidence for that claim. Unreviewed or uncertain information stays visibly qualified. AI cannot establish the authenticity of a cultural artifact or grant verified status.
- **Future.** [RECOMMENDED] Defer automated analysis integration, transcoding and advanced editorial tooling. Explore AI with permitted samples and document the findings within the agreed timebox.
- **Dependencies.** Auth, Content & Verification, object storage and Sesedra's status and error presentation.
- **Acceptance criteria.**
  - An authenticated user uploads a supported image and video with author details and a description. Invalid inputs fail without publishing a partial item.
  - An authorized reviewer records separate outcomes for content claims and description claims. An ordinary uploader cannot verify their own submission.
  - The UI distinguishes verified, unreviewed and uncertain information. An automated suggestion leaves the verification status unchanged.

## C. NFT and digital provenance

- **Purpose and owner.** [CONFIRMED] salandri-42 owns NFT functionality. A working NFT integration is required for the MVP.
- **MVP journey.** [RECOMMENDED] From a published item, an eligible user starts minting, confirms the wallet action if required, and sees pending, confirmed or failed status. On confirmation, show the linked item, chain, token and transaction reference with the scope of any provenance claim.
- **Association and trust.** [RECOMMENDED] Validate the published item's stable reference with Content before minting. Link token metadata to that item and an approved public snapshot or versioned reference. NFT owns mapping and transaction state. Keep private media, credentials and personal data out of on-chain data and public token metadata. [CONFIRMED] Token records can document a digital event. An NFT by itself establishes neither physical authenticity nor ownership of intellectual property.
- **Integration choices.** [DECISION REQUIRED: endy-rkt] salandri-42 investigates the following as a compatible set. For each, compare cost, usable testnet and test funds, tooling, demo reliability and integration time. Demonstrate signing, confirmation and metadata resolution with the candidate stack before selecting it. Use the gateway for NFT application requests and define the wallet signing boundary separately.
  - **D08 Blockchain.** Compare an EVM testnet such as Sepolia and Solana devnet. Favor the path the team can rehearse end to end with predictable test funding. [Ethereum networks](https://ethereum.org/developers/docs/networks/) · [Solana clusters](https://solana.com/docs/references/clusters)
  - **D09 NFT standard.** Compare ERC-721 for unique EVM items, ERC-1155 if editions are needed, and a chain-native token metadata standard for a non-EVM option. Favor a single-item standard matching the chosen ecosystem. [ERC-721](https://eips.ethereum.org/EIPS/eip-721) · [ERC-1155](https://eips.ethereum.org/EIPS/eip-1155)
  - **D10 Wallet.** Compare an ecosystem-native browser wallet, a connector or a hosted wallet. Favor a browser wallet with a rehearsed demo device if it avoids further account setup. Check mobile support and recovery from user rejection.
  - **D11 Smart-contract and metadata approach.** Compare an audited standard implementation with minimal customization, an existing compatible minting service or program, and a bespoke contract. Favor the first compatible maintained option that can resolve stable, approved public metadata during the demo. Compare stable public HTTPS metadata and content-addressed publication for reachability and persistence.
- **Future.** [RECOMMENDED] Defer transfers within the product UI, payments and a marketplace. This limits external integration to the required provenance journey.
- **Dependencies.** Published content reference, Auth and eligibility rules, a test environment, wallet, funds, and durable metadata access. [Service boundaries](../architecture/services.md).
- **Acceptance criteria.**
  - An eligible user mints a demo token linked to a published item and can inspect the confirmed transaction reference.
  - A failed or rejected action shows a recoverable state. Repeated submission while confirmation is pending does not mint a duplicate.
  - Token metadata resolves from the demo environment and the interface explains what the token record establishes.

## D. UI and UX

- **Purpose and owner.** [CONFIRMED] Sesedra delivers UX/UI mockups and a README contribution. Content presentation comes first. Administrative interfaces are outside MVP scope.
- **MVP deliverables.** [RECOMMENDED] Provide desktop and mobile mockups for discovery and item detail, account entry, upload and status, and provenance and 3D interactions. The primary journey is browse → open an item → understand the author, description and evidence → explore media, 3D or provenance where present. Show design treatments for loading, missing media, uncertainty and failed actions. Add approved mockup links and a design summary to the README.
- **Frontend dependencies.** Gateway access to published content and media, authorship and review labels, account state, upload feedback, and 3D and NFT availability and status. Frontend delivery assignment is part of [D02](../team/responsibilities.md).
- **Future.** [RECOMMENDED] Defer editorial dashboards and advanced discovery to protect time for the main journey.
- **Acceptance criteria.**
  - Sesedra delivers desktop and mobile mockups that cover the primary journey and key failure states.
  - endy-rkt can map each required data item and action in the mockups to a proposed gateway capability, and the README links to the approved design.

## E. LiDAR and 3D

- **Purpose and owner.** [CONFIRMED] shidoAdr owns LiDAR scanning feasibility and 3D.
- **MVP decision.** [DECISION REQUIRED: endy-rkt] **D12 3D demo experience.** [RECOMMENDED] Display one rights-cleared, pre-produced, optimized binary glTF (GLB) model inside an item detail with basic interaction and a still-image fallback. This makes the viewing experience independent of live capture. [Khronos glTF specification](https://registry.khronos.org/glTF/)
- **Scanning investigation.** [RECOMMENDED] Check device and OS availability, capture permissions, lighting, export and cleanup tools, asset weight, network and mobile rendering. Document capture → export → offline cleanup and optimization → validate → store → associate with content → display. The LiDAR service owns 3D asset state. [Data and storage](../architecture/data-storage.md).
- **Future.** [RECOMMENDED] Defer in-app capture, automated reconstruction and processing jobs until the feasibility work supports them.
- **Dependencies.** Content association, LiDAR metadata, storage and gateway delivery, and a viewer validated on demo devices.
- **Acceptance criteria.**
  - A visitor can load and rotate the demo model from its associated content item on the agreed desktop and mobile devices.
  - A failed or unsupported model load shows the fallback image and leaves the content page usable.
  - shidoAdr records the capture-to-display steps, tested device constraints and reproduction notes for the demo asset.
