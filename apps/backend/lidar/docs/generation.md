# Image-to-3D generation

[PROPOSED] Visitors can photograph an object and get a textured 3D model through [Meshy image-to-3D](https://docs.meshy.ai/en/api/image-to-3d). LiDAR owns the feature because it owns 3D assets. The gateway relays it under `/api/generations`. The frontend uses it in the exhibition at `/expositions/1`, where a finished model becomes a new chapter at the end of the corridor.

[CONFIRMED] Generated models are illustrations. They are not digitised heritage, and the exhibition labels them as AI-generated wherever they appear.

## Routes

| Gateway route                         | LiDAR route                                   | Answer                                  |
| ------------------------------------- | --------------------------------------------- | --------------------------------------- |
| `POST /api/generations`               | `POST /internal/v1/generations`               | `202 GenerationView`                    |
| `GET /api/generations`                | `GET /internal/v1/generations`                | `200 { generations: GenerationView[] }` |
| `GET /api/generations/{id}`           | `GET /internal/v1/generations/{id}`           | `200 GenerationView`, polled every 3 s  |
| `GET /api/generations/{id}/model.glb` | `GET /internal/v1/generations/{id}/model.glb` | GLB (`model/gltf-binary`), owner only   |
| `GET /api/generations/{id}/poster`    | `GET /internal/v1/generations/{id}/poster`    | PNG preview, owner only                 |

- The request body is `{ image, title?, texturePrompt? }`. `image` is a JPEG, PNG or WebP data URI of at most 1.4 MB once decoded. LiDAR checks the declared type against the file signature. The browser resizes photos to 1280 px and re-encodes them as JPEG before upload.
- `GenerationView` is `{ id, title, status, progress, modelUrl, posterUrl, errorCode, createdAt }`. `status` is `queued`, `modeling`, `storing`, `ready` or `failed`. `errorCode` is `GENERATION_REJECTED`, `GENERATION_FAILED` or `GENERATION_EXPIRED`.
- Every route needs a signed-in visitor. A generation is visible only to the visitor who started it; another visitor gets `404`.
- Public errors: `IMAGE_INVALID` (400), `UNAUTHENTICATED` (401), `GENERATION_CREDITS_EXHAUSTED` (402), `GENERATION_REJECTED` (422), `GENERATION_LIMIT_REACHED` and `GENERATION_BUSY` (429), `GENERATION_UNAVAILABLE` and `GENERATION_DISABLED` (503). The gateway also answers `RATE_LIMITED` (429) after 6 generations per visitor per hour.

## Behavior

- LiDAR polls Meshy at most once every 2.5 s per generation, however often the browser asks.
- Once Meshy succeeds, LiDAR downloads the GLB (64 MB maximum, Meshy CDN hosts only) and its preview into its object storage under `generations/{id}/`. Meshy deletes API models after three days.
- A visitor can run two generations at once and keeps the 12 most recent ones.
- [NOT IMPLEMENTED] Generation records live in memory, so a LiDAR restart forgets them. The stored GLB files remain. A Prisma table would make them durable.

## Configuration

| Variable                      | Purpose                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| `MESHY_API_KEY`               | Meshy key. Empty disables generation, and the routes answer 503.                            |
| `MESHY_BASE_URL`              | Defaults to `https://api.meshy.ai`.                                                         |
| `LIDAR_INBOUND_TOKEN_GATEWAY` | The gateway's `LIDAR_SERVICE_TOKEN`, at least 32 characters. Required to enable generation. |

The key and the token are redacted when the config is logged or serialized.
