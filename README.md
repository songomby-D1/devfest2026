# LOVA — L’héritage malagasy prend vie

LOVA means “heritage” in Malagasy.

LOVA is an immersive, participatory digital museum dedicated to Madagascar’s cultural heritage. Visitors will explore paintings, sculptures, and cultural objects, learn about their creators and traditional techniques, and contribute to documenting and digitizing the collection. Contribution review and digital traceability will help visitors understand the provenance of each item.

> Our goal is to make Malagasy heritage more accessible, interactive, and easier to pass on by connecting works, their stories, and the people who preserve them.

LOVA is a project for the **Preserving the Art** hackathon. This README describes the intended experience. The project is in pre-implementation, and its apps and services are still to be initialized.

## Why LOVA?

An artwork has material, volume, details, a history, and a cultural context. When visiting in person is difficult, a digital gallery can show a sculpture from several angles and make its story accessible to more people.

- **Discover** cultural heritage in an immersive, accessible gallery.
- **Understand** works through their stories, origins, and documented context.
- **Pass on** heritage by helping creators, custodians, and researchers share and digitize works.
- **Protect and promote** the collection by reviewing contributions and recording digital provenance for accepted works.

## Two experiences at the heart of LOVA

### Visit the museum

The planned gallery takes inspiration from a real exhibition space. Photorealistic surroundings, lighting, and guided lateral movement draw attention to the works.

1. Move left or right through the gallery.
2. Select a painting or photograph to get closer and explore its details and story.
3. Bring a sculpture or digitized object forward and rotate it in 3D.
4. Return to the gallery to continue the visit.

Simple interactions and subtle motion keep the focus on the works. Item records distinguish documented heritage objects, contemporary works, and gallery scenery.

### Contribute to the museum

A contributor will be able to create an item record with its name, description, and known information about its creator, origin, and publication rights. They can add photographs, videos, or an authorized 3D model, preview the result, and submit it for review.

The planned flow lets contributors track whether their submission was accepted, returned for more information, or rejected. Accepted records can be published and associated with a provenance NFT when the necessary permissions are in place.

### From desktop to iPhone and back

LOVA envisions a capture flow for physical objects using a compatible iPhone.

1. Open an item record on desktop and select “Scan with my iPhone.”
2. Use the displayed QR code to connect the iPhone to the session.
3. Open capture on the iPhone, grant the required permissions, and scan the object.
4. Review the scan on the phone and start the upload.
5. Return to the item record on desktop to inspect the 3D model and add context.

The 3D team is evaluating iPhone capture feasibility. The full QR code handoff is part of the product vision. The prototype can use a prepared 3D model with permission to display it.

## Trust and provenance

### Contribution review

LOVA showcases human-made works and Malagasy cultural heritage. The proposed editorial policy limits publication to contributions that meet collection rules and have sufficient documentation. AI-generated works are excluded from the collection.

Review covers consistency between the media and the item record, attribution, stated provenance, credits, and publication rights. AI may flag inconsistencies or signs of generated content for human review. These signals are uncertain, and reviewers make decisions based on the available evidence. Edits or display optimization alone are insufficient grounds to reject a photograph or scan of a real work.

### A digital record for accepted works

The planned NFT links a minting record to a documented item. The item page can present known attribution, a description, stated provenance, contributor information, and available history. Review precedes publication and any minting.

The token documents a digital event. Physical authenticity, the accuracy of claims, and copyright or ownership depend on separate evidence and permissions. The MVP focuses on cultural heritage and excludes NFT sales and speculation.

## Hackathon goal

The [MVP](docs/product/MVP.md) aims to connect three experiences in an end-to-end demo.

| Experience | Demo goal |
|---|---|
| Visit | Explore the gallery, zoom in on a painting, and rotate a sculpture in 3D. |
| Contribute | Create an item record, import media or an authorized model, and submit it for review. The iPhone flow depends on the feasibility study. |
| Review and trace | Show a contribution’s status, the rejection of an AI-generated work after human review, and the provenance of an accepted item. The MVP calls for a working NFT integration. Any simulated data shown during the demo will be labeled. |

Themed rooms, traditional music, educational experiences, and more ways to showcase artists and craftspeople can extend LOVA after the first prototype.

## Architecture and contribution

The React and TypeScript frontend reaches the NestJS services through a dedicated gateway. Auth, Content & Verification, NFT, and LiDAR are independent services. Stateful services use **Prisma with one shared PostgreSQL instance per environment**, with each service owning its data.

Each owner refines their tasks and makes technical decisions within the agreed MVP. For their app or service, they write **unit and integration tests**, create a **Dockerfile** in its directory, and add its entry to the root **`docker-compose.yml`**. endy-rkt defines the MVP and maintains the system overview. [Team responsibilities](docs/team/responsibilities.md#task-ownership)

## Documentation

| Document | Contents |
|---|---|
| [MVP scope](docs/product/MVP.md) | Capabilities, owners, and acceptance criteria |
| [Backlog](docs/product/task.md) | Tasks, dependencies, and open decisions |
| [Architecture overview](docs/architecture/overview.md) | System layout and gateway |
| [Services](docs/architecture/services.md) | Responsibilities, contracts, and Dockerfiles |
| [Data and storage](docs/architecture/data-storage.md) | PostgreSQL, Prisma, media, and backups |
| [Team](docs/team/responsibilities.md) | Ownership and coordination |
| [Contributing](CONTRIBUTING.md) | Git workflow and review |
| [Development workflow](docs/development/workflow.md) | Local commands and tooling decisions |
| [Code quality policy](docs/development/code-policy.md) | Shared rules for contributors and agents |
| [Tests and delivery criteria](docs/development/quality-gates.md) | Checks required for each service |
| [CI](docs/development/ci.md) | Workflow, troubleshooting, and GitHub settings |
| [Agent instructions](AGENTS.md) | Shared rules for Claude and Codex |
| [Frontend](apps/frontend/README.md) | How the React frontend is built, run, tested and verified |
| [Frontend rules](apps/frontend/rules.md) | Frontend stack, Figma-to-code rules, required states and checks |

## Design and UX

Sesedra will add the design summary and links to the approved mockups here.

**LOVA — Discover heritage. Bring it to life. Pass it on.**
