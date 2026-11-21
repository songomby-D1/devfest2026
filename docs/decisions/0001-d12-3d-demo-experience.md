# 0001 D12 3D demo experience

- **Status:** Accepted. shidoAdr chose option A on 2026-11-21, and endy-rkt approved it in [PR #83](https://github.com/songomby-D1/devfest2026/pull/83).
- **Decision owner:** shidoAdr ([MVP section E](../product/MVP.md#e-lidar-and-3d))
- **Date:** 2026-11-21
- **Backlog:** 3D-02 ([#9](https://github.com/songomby-D1/devfest2026/issues/9)), feeding endy-rkt-06 ([#27](https://github.com/songomby-D1/devfest2026/issues/27))
- **Evidence:** [3D feasibility spike](../architecture/3d-feasibility-spike.md), including the [real scan](../architecture/3d-feasibility-spike.md#real-scan-3d-01b) from 3D-01b ([#8](https://github.com/songomby-D1/devfest2026/issues/8))

## Context

The MVP must let a visitor load and rotate a rights-cleared demo model from its content item, with a still-image fallback ([MVP section E](../product/MVP.md#e-lidar-and-3d)). The team also wants a faithful rendering that stays light on mobile networks. [CONFIRMED] The spike validated this chain in headless Chrome on Apple's sample and on a real scan:

| Step         | Tool                                                     | Evidence                                                                                                                                                                    |
| ------------ | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capture      | Reality Composer on an iPhone 13 Pro                     | Real scan in about 1 min 30 s, reported by shidoAdr. USDZ of 4.9 MB.                                                                                                        |
| Conversion   | three.js `USDLoader` and `GLTFExporter`, headless Chrome | 6.0 s for the 31.9 MB sample, 0.96 s for the real scan                                                                                                                      |
| Optimization | glTF-Transform, Draco and WebP                           | Sample: 2.98 MB at 2K, 1.29 MB at 1K. Real scan: 148 KB at 2K, 74 KB at 1K.                                                                                                 |
| Display      | `<model-viewer>` 4.4.0                                   | Six preset views rendered. Sample: no visible difference between raw and 2K, and 1K slightly softer in a close-up. Real scan: no visible difference between raw, 2K and 1K. |

Display on real phones is not measured yet. It is planned in 3D-05b ([#15](https://github.com/songomby-D1/devfest2026/issues/15)).

## Options

### A. Pre-produced GLB, 1K by default and 2K on demand, with a poster and a still-image fallback

- Each item gets a GLB at 1K, a GLB at 2K and a poster image, prepared offline with the spike pipeline.
- The viewer shows the poster, loads the 1K GLB, and offers 2K on request or on desktop.
- Pros: the lightest first load. On the sample, the 1K page loaded in 2.6 s and the 2K page in 6.3 s at 15 Mbit/s on the spike laptop. These durations depend on the machine. The estimated GPU memory is 56 MB at 1K against 173 MB at 2K. Detail stays available for close inspection.
- Cons: two variants to store and serve. The variant switch needs a frontend control.

### B. Single pre-produced GLB at 1K, with a poster and a still-image fallback

- Pros: one variant, the simplest frontend and storage.
- Cons: no high-detail view. The sample's main texture was slightly softer at 1K, while the real scan showed no difference. The gain of option A over B therefore depends on the object, to be confirmed on the demo artwork.

### C. Single pre-produced GLB at 2K

- Pros: the best detail with one variant.
- Cons: the heaviest load for detailed objects. On the sample, whose raw GLB was 76 MB, 10.8 s at 5 Mbit/s and an estimated 173 MB of GPU memory, which may strain lower-end phones (unverified on devices). For a light object like the real scan, 148 KB at 2K, the cost is negligible.

### D. Live upload and server-side conversion

- The uploader sends a USDZ and the LiDAR service converts it.
- Pros: shows the full flow on stage.
- Cons: adds headless Chrome to the service image, a job and status design (D16) and the upload controls of the [media flow policy](../architecture/data-storage.md#media-flow-and-security). The conversion takes seconds while capture takes about 1 min 30 s, so the audience would not wait less. Deferred to 3D-06 ([#16](https://github.com/songomby-D1/devfest2026/issues/16)).

### E. Still images or a turntable video only

- Pros: no 3D runtime risk.
- Cons: does not meet the interactive 3D requirement. Kept only as the fallback inside options A to C.

## AR on iOS

| Choice                                    | Effect                                                                                                                                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Serve the original USDZ through `ios-src` | AR Quick Look shows Apple's own export. One more stored object per item. Acceptable only for files prepared offline and checked for external references, never for unreviewed uploads. |
| Let model-viewer generate the USDZ        | No extra object. model-viewer 4.4.0 generates it when `ios-src` is absent (`ar.js:317`). Output not tested on a device.                                                                |
| No AR in the MVP                          | No AR risk. Loses an iPhone demo moment.                                                                                                                                               |

## Proposed decision

[CONFIRMED] shidoAdr, the D12 decision owner, chose option A, prepared offline, with these terms. endy-rkt approved this ADR in [PR #83](https://github.com/songomby-D1/devfest2026/pull/83).

1. **Assets.** For each demo item, store a GLB at 1K, a GLB at 2K and a poster image. The poster is required and also serves as the still-image fallback. Serve 1K first on every device and offer 2K only on request.
2. **Fallback.** Show the poster while loading and keep the page usable on every failure listed in [failure handling](#failure-handling).
3. **Viewer.** `<model-viewer>` with orbit controls, preset views and neutral tone mapping. The bottom view is shown only when the bottom was scanned. Self-host the Draco decoder instead of the default `www.gstatic.com` copy.
4. **AR.** Optional. Serve the original USDZ through `ios-src` for offline-prepared files only, after the external-reference check. Drop AR from the demo if 3D-05b cannot validate it on an iPhone. AR on Android goes through Scene Viewer or WebXR, which the spike did not test, so it is out of the MVP unless 3D-05b validates it. Set `ar-modes="quick-look"` to keep model-viewer from handing the model URL to Scene Viewer.
5. **Processing.** No upload endpoint, conversion service or job queue in the MVP. Live conversion stays in 3D-06.
6. **Capture.** Reality Composer on an iPhone Pro. Scan an artwork that can be handled a second time with the object turned over. Otherwise limit the camera orbit so the unscanned bottom stays hidden, and accept that such an item is not viewable from every side.
7. **Asset budget.** [RECOMMENDED] Accept an item for the demo when its 1K GLB stays under 1.5 MB and its 2K GLB under 3 MB, the largest sizes measured in the spike. Above that, serve 1K only or reduce the textures. Confirm or adjust these limits with the device measurements of 3D-05b.

## Security terms

[RECOMMENDED] These terms follow the [media flow and security policy](../architecture/data-storage.md#media-flow-and-security):

- **Delivery.** The four objects stay private in object storage under generated keys. The gateway streams them after the LiDAR service checks the item's visibility. Responses set `Content-Type` (`model/gltf-binary`, `model/vnd.usdz+zip`, `image/webp` or `image/png`) and `X-Content-Type-Options: nosniff`. 3D-05b checks that AR Quick Look can fetch the USDZ under the chosen authorization model.
- **Self-contained files.** 3D-04a fails the preparation when a GLB references an external `uri` or fails glTF validation, or when a USDZ references files outside its archive. The tools are to be chosen in 3D-04a (Khronos glTF-Validator and `usdchecker` are candidates, unverified). 3D-04a also lists and strips USDZ metadata before storage.
- **Content security policy.** The Draco decoder fetches its `.js` and `.wasm` files, starts a worker from a `blob:` URL and instantiates WebAssembly (model-viewer 4.4.0 `dist/model-viewer.js`). The policy therefore needs at least `connect-src 'self'`, `worker-src blob:` and `script-src 'self' 'wasm-unsafe-eval'`, to be confirmed in 3D-05a. Do not use KTX2 or Lottie, whose default loaders point to `www.gstatic.com` and `cdn.jsdelivr.net`, or self-host them too.
- **Rights.** Each demo item records who cleared the rights to the object, the scan, the poster and public display, under D18. Apple's sample serves only as a measurement and is never published.

## Failure handling

| Condition                             | Detection                                                                                                                           | Behavior                                                                             |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| WebGL unavailable                     | model-viewer 4.4.0 logs a warning and emits no `error` event when the renderer cannot start, so the frontend must test WebGL itself | Show the poster as a still image with a short message                                |
| 1K model fails to load                | `error` event of type `loadfailure`                                                                                                 | Keep the poster, show a retry action                                                 |
| Network drops during loading          | Same `loadfailure` event                                                                                                            | Same as above. No offline cache in the MVP.                                          |
| 2K model fails or the context is lost | `error` event, or `webglcontextlost`                                                                                                | Return to the 1K model and hide the 2K control                                       |
| Draco decoder missing                 | Every compressed model fails with `loadfailure`                                                                                     | Same as a failed model. 3D-05b checks the decoder path and its `.wasm` content type. |
| Poster missing                        | Rejected during preparation in 3D-04a                                                                                               | An item without a poster is not published with 3D                                    |
| AR fails                              | `ar-status` event with `failed`                                                                                                     | Hide the AR button and keep the 3D view                                              |

The detection column comes from reading the model-viewer 4.4.0 source and was not exercised in a browser.

## Consequences

- **D05 storage.** Four objects per item: GLB 1K, GLB 2K, USDZ and poster. About 5.1 MB for the real scan and about 36 MB for Apple's sample, mostly the USDZ, plus a poster each. These are the only two measured items, not bounds.
- **D16 async processing.** No job table or queue for 3D. The LiDAR service stores records for assets prepared offline and authorizes their delivery through the gateway.
- **LiDAR service image.** No browser in the image. 3D-07 ([#82](https://github.com/songomby-D1/devfest2026/issues/82)) stays a plain NestJS and Prisma service.
- **Frontend.** One viewer component with preset views, a 2K control and the fallback, in 3D-05a ([#14](https://github.com/songomby-D1/devfest2026/issues/14)). The content security policy should allow the self-hosted decoder only (not tested), and the gateway or static host must serve its `.js` and `.wasm` files.
- **Preparation script.** 3D-04a ([#11](https://github.com/songomby-D1/devfest2026/issues/11)) produces the four objects. [NOT IMPLEMENTED] Poster generation was not tested in the spike.
- **Validation.** 3D-05b ([#15](https://github.com/songomby-D1/devfest2026/issues/15)) measures load time and smoothness on the agreed phones and confirms or removes AR.

## Open questions for endy-rkt

- Confirm that offline preparation fits D16 and the demo plan.
- Confirm the storage footprint under D05 and that the gateway can stream GLB and USDZ files with the right content types.
- Name the frontend owner for 3D-05a under D02.
