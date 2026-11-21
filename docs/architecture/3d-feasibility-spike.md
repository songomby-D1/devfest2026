# 3D feasibility spike

This report records the 3D feasibility spike for backlog item 3D-01, groomed as 3D-01a ([#7](https://github.com/songomby-D1/devfest2026/issues/7), parent [#6](https://github.com/songomby-D1/devfest2026/issues/6)). It gives the evidence behind the D12 proposal ([MVP section E](../product/MVP.md#e-lidar-and-3d)).

- **Owner:** shidoAdr
- **Date:** 2026-11-21. Web sources were consulted on that date.
- **Status:** [CONFIRMED] The conversion and viewing pipeline ran on Apple's photogrammetry sample. [CONFIRMED] 3D-01b ([#8](https://github.com/songomby-D1/devfest2026/issues/8)) ran a real Reality Composer scan through the same pipeline ([real scan](#real-scan-3d-01b)). [NOT IMPLEMENTED] Display on demo devices moved to 3D-05b ([#15](https://github.com/songomby-D1/devfest2026/issues/15)).

## Summary

[RECOMMENDED] The intended pipeline uses free tools:

1. Capture and reconstruct on an iPhone Pro through Reality Composer, which exports `.usdz`. A real scan in 3D-01b produced a usable file. If Reality Composer falls short, the fallback is a custom iOS app with Object Capture.
2. Convert USDZ to binary glTF (GLB) with the three.js `USDLoader` and `GLTFExporter`.
3. Optimize with glTF-Transform (Draco geometry, WebP textures, 1K and 2K variants).
4. Display with `<model-viewer>`, including orbit controls and preset views. AR Quick Look on iOS is an option that the spike did not test.

[CONFIRMED] Steps 2 to 4, without AR, worked on Apple's sample:

- The 31.9 MB USDZ became a 2.98 MB GLB at 2K or a 1.29 MB GLB at 1K.
- All six preset views rendered.
- Side-by-side screenshots of the 2K variant showed no visible difference from the unoptimized model.
- Converting and producing both variants took 12.4 s on the spike laptop.

[RECOMMENDED] Prepare 3D assets offline for the MVP, as D12 and D16 recommend. The real scan in 3D-01b took about 1 min 30 s on the iPhone, as reported by shidoAdr, and the conversion takes seconds. Live server-side conversion would add work and cross-team dependencies without shortening what an audience waits for. It remains a later option in 3D-06 ([#16](https://github.com/songomby-D1/devfest2026/issues/16)).

## Capture options

| Option                                | Reconstruction runs on | Cost                                                                              | Platforms             | Assessment                                                                                                                                        |
| ------------------------------------- | ---------------------- | --------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reality Composer (Apple app)          | iPhone                 | Free                                                                              | iPhone Pro with LiDAR | No app to build. 3D-01b confirmed the `.usdz` export. Object Capture as the engine rests on a developer forum answer and is unverified.           |
| Custom iOS app with Object Capture    | iPhone                 | Free with an Apple ID                                                             | iPhone Pro with LiDAR | Needs Swift, a Mac with Xcode and testing on a device. Not needed if Reality Composer is enough.                                                  |
| Mac with `PhotogrammetrySession`      | Mac                    | Free                                                                              | Photos from any phone | Fallback for phones without LiDAR. Mac hardware requirements come from forum reports and are unverified.                                          |
| KIRI Engine API                       | Vendor cloud           | Vendor page: 20 free credits, then $1 per call with a $500 minimum recharge       | Any phone             | Too limited for repeated tests.                                                                                                                   |
| Autodesk Reality Capture API          | Vendor cloud           | Pricing page: 1 Flex token per 50 photos. A monthly free threshold is unverified. | Any phone             | Paid beyond any free threshold.                                                                                                                   |
| Meshroom (open source)                | Own server             | Free                                                                              | Any phone             | The manual requires an NVIDIA CUDA GPU for the dense reconstruction and offers a lower-quality draft mesh on CPU. Not tested on the spike laptop. |
| Generative image-to-3D (Meshy, Tripo) | Vendor cloud           | Vendor pages describe limited free tiers                                          | Any phone             | [RECOMMENDED] Reject. These services generate a model from images rather than reconstructing the artwork, which suits poorly a heritage record.   |

Device and platform constraints:

- An Apple forum answer lists the iPhone 12 Pro with LiDAR and later, plus the iPad Pro 3rd generation and later, as supported for guided capture. The answer says the simulator is not supported. Unverified against Apple's API documentation. Check `ObjectCaptureSession.isSupported` on the device.
- A developer reported that an iPhone XS without LiDAR could not use Object Capture. Unverified.
- Google's codelab describes the ARCore Raw Depth API as per-frame depth on a subset of ARCore devices. The spike found no ARCore API that returns a mesh, which is an inference and not a documented statement. Polycam's help center says its object mode processes captures in the cloud. Other Android apps were not checked.
- Object Capture is documented as a RealityKit API for native Apple platforms. The spike found no web API for it, so a web page is assumed unable to use it. Unverified.

## Pipeline tested

| Step         | Tool and version                                                                                                   | Notes                                                                                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sample input | Apple `pancakes_photogrammetry.usdz`                                                                               | 31,942,416 bytes. SHA-256 `45f0d144138dcd3546b4d37132b91a7b00fb2bcf187f017342f4bc5a45f087b1`. Binary USDC scene and ten PBR PNG textures up to 2048 × 2048.                       |
| USDZ to GLB  | three 0.183.2 `USDLoader` and `GLTFExporter` in headless Google Chrome 148.0.7778.167, driven by Playwright 1.65.1 | The spike ran the exporter in a page and did not test a pure Node.js route.                                                                                                       |
| Optimization | `@gltf-transform/cli` 4.5.1                                                                                        | `optimize --compress draco --texture-compress webp`, adding `--texture-size 1024` for 1K. Other options keep their defaults, including `--simplify true` with an error of 0.0001. |
| Display      | `@google/model-viewer` 4.4.0                                                                                       | `camera-controls`, `tone-mapping="neutral"`, and preset `camera-orbit` values. `ios-src` and AR were not exercised.                                                               |
| Runtime      | Node.js 26.13.1                                                                                                    | Spike machine only. The project runtime is pending D15.                                                                                                                           |

[CONFIRMED] The `package.json` of `@google/model-viewer` 4.4.0 declares a peer dependency on three `^0.183.0`. The converter and the viewer should therefore share three 0.183.x.

## Results

### Conversion and size

Sizes use decimal megabytes (1 MB = 1,000,000 bytes).

| Variant                         | Size        | Notes                                                                   |
| ------------------------------- | ----------- | ----------------------------------------------------------------------- |
| Source USDZ                     | 31.9 MB     | Reference                                                               |
| Raw GLB from `GLTFExporter`     | 76.1 MB     | 26 meshes, 71,313 triangles, 26 materials and all texture slots kept    |
| Optimized, Draco and WebP, 2K   | **2.98 MB** | 5 meshes and 70,323 triangles, 1.4% fewer after join and simplification |
| Optimized, Meshopt and WebP, 2K | 3.28 MB     | `--compress meshopt` produced a larger file than Draco on this asset    |
| Optimized, Draco and WebP, 1K   | **1.29 MB** | Same geometry with textures capped at 1024 × 1024                       |

Triangle counts are the sum of the `glPrimitives` column of `gltf-transform inspect`.

The raw GLB differs between runs in byte order only. The exporter writes textures asynchronously, so their buffer views come out in a different order. Sizes are identical, and the optimized outputs matched byte for byte across two runs.

| Step           | First run | Second run |
| -------------- | --------- | ---------- |
| USDZ to GLB    | 6.0 s     | 6.1 s      |
| Optimize at 2K | 3.7 s     | 3.2 s      |
| Optimize at 1K | 2.7 s     | 2.5 s      |

### Visual quality

[CONFIRMED] Screenshots compared the raw, 2K and 1K variants from the front, back, left, right, top and bottom, plus one close-up. The comparison was visual only and used no diff tool. The geometry looked identical in every view. In the close-up, the 2K variant matched the raw model. The 1K variant was slightly softer on the main texture.

[RECOMMENDED] Serve 1K by default on mobile and offer 2K on demand or on desktop.

### Network

[CONFIRMED] Each model loaded in headless Chrome with the cache disabled and the network throttled through the DevTools protocol. Upload throughput was a third of the download throughput. The time runs from just before navigation until the script observes the `<model-viewer>` `load` event, polling included. A load error fails the run. The table gives the median of three runs, with the range in brackets. The profiles are the spike's own assumptions, not operator measurements. The spike treats 15 Mbit/s as a typical 4G link and 5 Mbit/s as a weak one. These values are not sourced, and Chrome's own throttling presets were not used. These figures come from the appendix scripts, run from a clean directory, with the Draco decoder self-hosted. Absolute durations depend on the machine and its load: two independent reruns gave 2K medians 20 to 70% higher, while 1K stayed within about 10%. Compare orders of magnitude and the gap between variants, not exact seconds. The 4.5 s maximum for 1K without throttling is a single outlier.

| Variant | No throttling      | 40 Mbit/s, 40 ms   | 15 Mbit/s, 70 ms   | 5 Mbit/s, 120 ms      |
| ------- | ------------------ | ------------------ | ------------------ | --------------------- |
| 2K      | 4.3 s (4.3 to 4.8) | 5.0 s (5.0 to 5.1) | 6.3 s (6.3 to 6.7) | 10.8 s (10.8 to 10.9) |
| 1K      | 1.6 s (1.6 to 4.5) | 2.0 s (2.0 to 2.0) | 2.6 s (2.6 to 2.6) | 5.6 s (5.5 to 5.6)    |

Each page load downloaded 4.24 MB for the 2K page and 2.55 MB for the 1K page from the local server. These totals include the GLB, the uncompressed `model-viewer.min.js` and the Draco decoder. In-page `data:` resources added about 0.06 MB. An earlier run with model-viewer's default decoder on `www.gstatic.com` was within 1 s of these medians and fetched 0.29 MB from that host.

- The unthrottled time mostly covers decoding and software rendering on the CPU through SwiftShader. Real devices render on their GPU, but decode Draco and WebP on a mobile CPU, so on-device times may be higher or lower. They were not measured. In this run, the 2K page lost 2.0 s at 15 Mbit/s and 6.5 s at 5 Mbit/s compared with the unthrottled median. The rerun gave 0.9 s and 5.6 s.
- `model-viewer.min.js` is 1,069,272 bytes, and `gzip -9` reduces it to 288,592 bytes, about 0.29 MB. The spike server did not compress responses. The optimized GLB barely compresses further.
- [NOT IMPLEMENTED] Measure on real demo devices in 3D-05b ([#15](https://github.com/songomby-D1/devfest2026/issues/15)).

### GPU memory

Compressed downloads expand in GPU memory. `gltf-transform inspect` reports a `gpuSize` per texture. It is 22.37 MB for 2048 × 2048 and 5.59 MB for 1024 × 1024, which matches RGBA8 with mipmaps (width × height × 4 × 4/3).

| Variant | Textures                              | Estimated GPU memory          |
| ------- | ------------------------------------- | ----------------------------- |
| 2K      | 7 at 2048 × 2048 and 3 at 1024 × 1024 | 7 × 22.37 + 3 × 5.59 ≈ 173 MB |
| 1K      | 10 at 1024 × 1024                     | 10 × 5.59 ≈ 56 MB             |

These figures are estimates and were not measured on a device. The three textures that were already 1024 × 1024 in the source keep that size in both variants. KTX2 textures would reduce GPU memory, but the spike did not test them because the `toktx` encoder was not installed.

## Real scan (3D-01b)

[CONFIRMED] shidoAdr scanned a phone charger owned by the team with Reality Composer and exported `chargeur.usdz`. The iPhone model was not recorded. The ticket planned an iPhone Pro with LiDAR. The file is a test object, not demo content, and is not committed. It ran through the appendix scripts unchanged.

| Item                                  | Value                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| Capture to export on the iPhone       | About 1 min 30 s, reported by shidoAdr. The iPhone model and iOS version were not recorded. |
| USDZ                                  | 4,923,295 bytes: one USDC mesh of 167,046 bytes and three 2048 × 2048 PNG textures          |
| Textures                              | Base color, normal and ambient occlusion                                                    |
| Raw GLB                               | 6,815,224 bytes, 1 mesh, 6,328 triangles, converted in 0.96 s                               |
| Optimized, Draco and WebP, 2K         | **147,960 bytes**, 6,294 triangles, optimized in 2.1 s                                      |
| Optimized, Draco and WebP, 1K         | **73,760 bytes**                                                                            |
| `USDCParser` warning on array type 10 | Not emitted                                                                                 |

Observations:

- Six preset views and a close-up showed no visible difference between the raw, 2K and 1K variants. The comparison was visual only and used no diff tool. Base color and normal textures render in every view, with no missing or black texture apart from the bottom face described below.
- `optimize` dropped the ambient occlusion texture. Rerunning with `--prune-solid-textures false` kept it and produced 155,664 bytes, The occlusion texture is uniform white, which means no occlusion, so `optimize` removed it. The rendering is unchanged.
- The bottom face is dark and smooth because the object stood on a surface during capture. [RECOMMENDED] For an artwork that can be handled, capture a second pass with the object turned over. Otherwise, frame the default views so the bottom stays hidden by limiting the camera orbit.
- The archive holds only the USDC file and its three textures. The USDC was not checked for external asset references, because its token table is compressed and the spike has no USD tool. [RECOMMENDED] Run that check before storage in 3D-04.
- The real scan is about twenty times lighter than Apple's sample after optimization. A 2K variant of this size makes the network cost negligible compared with `model-viewer.min.js`.

Constraints and fallback:

- The scanning iPhone was not recorded. Support on other devices remains unverified ([device and platform constraints](#capture-options)).
- [RECOMMENDED] Keep the prepared GLB and a poster image as the demo fallback if the live scan fails.
- [RECOMMENDED] If Reality Composer becomes unavailable, use a custom iOS app with Object Capture, or photos processed with `PhotogrammetrySession` on a Mac ([capture options](#capture-options)).

## Issues found

| Issue                                                    | Cause                                                                                                                                                                                                                                                         | Resolution                                                                                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Export failed with `getImageData: The source width is 0` | `USDComposer` creates each texture without an image. It sets `texture.image` inside `image.onload`, after `loadAsync` resolves (`three/examples/jsm/loaders/usd/USDComposer.js:3317-3319`). The composer has no `onerror` handler.                            | Wait until every texture on every material has a decoded image before export. Name pending textures on timeout.              |
| Raw GLB 2.4 times larger than the USDZ                   | `gltf-transform inspect` showed 20 identical 1024 × 1024 metallic-roughness textures. `GLTFExporter` merges metalness and roughness per material (`three/examples/jsm/exporters/GLTFExporter.js:939` and `1613`), which duplicates the shared source texture. | glTF-Transform `optimize` removed the duplicates. Its pipeline starts with `dedup()` (`@gltf-transform/cli/src/cli.ts:376`). |
| Warning `USDCParser: Unsupported array type 10`          | Type 10 is `String` (`three/examples/jsm/loaders/usd/USDCParser.js:27`)                                                                                                                                                                                       | No visible effect on the sample. The real scan in 3D-01b did not emit it.                                                    |
| The gallery link returned an HTML 404 page               | The file is served from `https://developer.apple.com/quick-look-gallery/models/pancakes/pancakes_photogrammetry.usdz`                                                                                                                                         | Use that URL                                                                                                                 |

## Implications

- **D12, demo experience.** [RECOMMENDED] For each item, store a pre-produced GLB at 1K and 2K and a poster image. Show the poster first and fall back to a still image when loading fails. The 3D-02 proposal ([#9](https://github.com/songomby-D1/devfest2026/issues/9)) details the options.
- **AR on iOS.** `ios-src` serves an original USDZ to AR Quick Look. The data storage policy asks for self-contained 3D files and an assessment of external references ([media flow and security](data-storage.md)). [RECOMMENDED] Check a USDZ for external references before storage. Without `ios-src`, model-viewer 4.4.0 generates a USDZ from the GLB (`@google/model-viewer/lib/features/ar.js:317`), but the spike did not test that output on a device.
- **Self-hosted decoders.** [CONFIRMED] By default, model-viewer 4.4.0 downloads the Draco decoder from `www.gstatic.com`. It would do the same for the KTX2 transcoder. Third-party code would then run in the application, the content security policy would presumably need that host (not tested), and the demo would depend on venue connectivity. Setting `self.ModelViewerElement.dracoDecoderLocation` before loading model-viewer (`@google/model-viewer/lib/features/loading.js:244-249`) avoids this. The spike pointed it at the copy shipped in `three/examples/jsm/libs/draco/gltf/`. The 2K model then loaded with no request outside the local server.
- **D16, async processing.** [RECOMMENDED] Offline preparation needs no job queue. Live conversion would need a job and status design.
- **D05, storage.** [RECOMMENDED] Plan four objects per asset: GLB 1K, GLB 2K, USDZ and poster. On the sample they total about 36 MB, almost all of it the USDZ.
- **LiDAR service image.** [RECOMMENDED] With offline preparation, the LiDAR service needs no browser in its image. Live conversion would add headless Chrome to the image, following the [Dockerfile convention](services.md#dockerfile-placement).
- **iOS sharing.** Safari on iOS is reported not to support the Web Share Target API (WebKit bug 194593, open as of the consultation date). A web app therefore cannot appear in the iOS share sheet, and a live upload would go through a file picker.
- **Demo.** [RECOMMENDED] Start a capture live to show the guided scan, then open the same artwork prepared earlier. Convert a fresh scan on stage only if time allows. The prepared asset is also the tested 3D asset that the demo rehearsal requires. The device fallback remains a separate item ([responsibilities](../team/responsibilities.md)).

## Limits and open questions

General limits:

- The sample's redistribution terms were not checked. It is not committed and must not serve as demo content. The MVP requires rights-cleared assets.
- All timings come from one laptop with software rendering. The network profiles are assumptions, and each cell has only three runs.
- No one has tested headless Chrome inside a service container.

For 3D-01b ([#8](https://github.com/songomby-D1/devfest2026/issues/8)):

- [CONFIRMED] Done in the [real scan](#real-scan-3d-01b) section: export, timing, pipeline run and the warning check.
- [NOT IMPLEMENTED] Record the iPhone model and iOS version used for the scan.
- Moved to 3D-05b ([#15](https://github.com/songomby-D1/devfest2026/issues/15)): loading the result on at least one iPhone and one Android phone.

For 3D-02 ([#9](https://github.com/songomby-D1/devfest2026/issues/9)):

- Choose the delivered variants: 1K only, or 1K with 2K on demand.
- Choose whether to serve the original USDZ through `ios-src` or let model-viewer generate one. An uploaded USDZ would reach AR Quick Look on visitors' devices unchanged, so a live path should serve only a USDZ prepared and validated offline, or the generated one.
- Confirm offline preparation for the MVP and the conditions for revisiting live conversion in 3D-06.
- Agree the storage footprint per asset with D05 and self-hosted decoders with the frontend and gateway owners.

If a live path (3D-06) is approved:

- [RECOMMENDED] Apply the whole [media flow and security policy](data-storage.md), including size limits, a format allowlist, file signature checks, generated storage names, private storage until validation, authorization before streaming and an evaluation of malware scanning.
- [RECOMMENDED] Reject external asset references. A USDZ is a ZIP archive, so also limit its uncompressed size and entry count. The spike measured an amplification from a 31.9 MB USDZ to a 76.1 MB raw GLB and an estimated 173 MB of GPU memory.
- [RECOMMENDED] Run headless Chrome with its sandbox enabled. Playwright disables it unless `chromiumSandbox: true` is set. Run it without root, without a remote debugging port, without outbound network access and under CPU, memory and time limits. Do not use `--enable-unsafe-swiftshader` on untrusted input. The spike used it only for local measurements. If the sandbox fails inside a container, fix the container profile, such as user namespaces or seccomp, and keep the sandbox. Use one browser context per conversion, block every request other than the input with `page.route`, and validate the produced GLB before storage.

## Reproduction

The spike code is not committed. Dependency installation requires approval from endy-rkt (AGENTS.md). The production script is planned in 3D-04a ([#11](https://github.com/songomby-D1/devfest2026/issues/11)). It should commit a lockfile and install with `npm ci --ignore-scripts`. On 2026-11-21, `npm audit` reported four moderate advisories in `glob` and `minimatch`, pulled in by `@gltf-transform/cli` 4.5.1. The scripts below reproduce the measurements.

1. In an empty scratch directory, install pinned versions. The scripts use the system Chrome at `/usr/bin/google-chrome-stable`. To use Playwright's Chromium instead, run `npx --no-install playwright install chromium` and remove `executablePath` from both `convert.mjs` and `throttle.mjs`. On macOS, replace `sha256sum --check` with `shasum -a 256 -c`.

   ```sh
   set -e
   npm init -y
   npm install --save-exact three@0.183.2 @gltf-transform/cli@4.5.1 @google/model-viewer@4.4.0 playwright@1.65.1
   mkdir -p models out
   curl -fL -o models/pancakes.usdz https://developer.apple.com/quick-look-gallery/models/pancakes/pancakes_photogrammetry.usdz
   echo "45f0d144138dcd3546b4d37132b91a7b00fb2bcf187f017342f4bc5a45f087b1  models/pancakes.usdz" | sha256sum --check
   ```

2. Save the files from the appendix in the same directory and serve it on the loopback interface only:

   ```sh
   python3 -m http.server 8765 --bind 127.0.0.1
   ```

   If port 8765 is taken, choose another port and pass the matching base URL to `convert.mjs` and `throttle.mjs`.

3. In a second shell, convert and optimize. Run the commands from the scratch directory so that `npx` resolves the installed CLI:

   ```sh
   node convert.mjs http://127.0.0.1:8765 models/pancakes.usdz out/pancakes.glb
   npx --no-install gltf-transform optimize out/pancakes.glb out/p2k.glb --compress draco --texture-compress webp
   npx --no-install gltf-transform optimize out/pancakes.glb out/p1k.glb --compress draco --texture-compress webp --texture-size 1024
   npx --no-install gltf-transform optimize out/pancakes.glb out/p2k-meshopt.glb --compress meshopt --texture-compress webp
   ```

4. Measure:
   - sizes with `stat -c %s out/*.glb`;
   - meshes, triangles and texture `gpuSize` with `npx --no-install gltf-transform inspect out/p2k.glb`;
   - durations by timing each command;
   - load times with `node throttle.mjs http://127.0.0.1:8765`, which prints the median and range for each profile, plus the bytes per host of the first run, which can vary by about 0.1 MB between runs;
   - the compressed viewer size with `gzip -9c node_modules/@google/model-viewer/dist/model-viewer.min.js | wc -c`.

5. To inspect views, open `http://127.0.0.1:8765/viewer.html?src=out/p2k.glb` and use the preset buttons.

### Appendix: `convert.html`

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <script type="importmap">
      {
        "imports": {
          "three": "./node_modules/three/build/three.module.js",
          "three/addons/": "./node_modules/three/examples/jsm/"
        }
      }
    </script>
  </head>
  <body>
    <script type="module">
      import { USDLoader } from 'three/addons/loaders/USDLoader.js';
      import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

      function collectTextures(root) {
        const labelsByTexture = new Map();
        root.traverse((object) => {
          if (!object.isMesh) return;
          for (const material of [].concat(object.material ?? [])) {
            for (const [slot, value] of Object.entries(material)) {
              if (!value?.isTexture) continue;
              const labels = labelsByTexture.get(value) ?? [];
              labels.push(`${material.name || material.uuid}.${slot}`);
              labelsByTexture.set(value, labels);
            }
          }
        });
        return labelsByTexture;
      }

      function countMeshes(root) {
        let count = 0;
        root.traverse((object) => {
          if (object.isMesh) count++;
        });
        return count;
      }

      // USDComposer sets texture.image in Image.onload, after loadAsync resolves, and has no onerror handler.
      async function waitForTextures(root, timeoutMs = 30000) {
        const textures = collectTextures(root);
        const pending = () =>
          [...textures]
            .filter(([texture]) => !(texture.image?.width > 0))
            .flatMap(([, labels]) => labels);
        const deadline = Date.now() + timeoutMs;
        while (pending().length > 0) {
          if (Date.now() > deadline) {
            throw new Error(
              `Textures not decoded after ${timeoutMs} ms: ${pending().join(', ')}`,
            );
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      function toBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i += 0x8000) {
          binary += String.fromCharCode.apply(
            null,
            bytes.subarray(i, i + 0x8000),
          );
        }
        return btoa(binary);
      }

      window.convert = async (url) => {
        const root = await new USDLoader().loadAsync(url);
        if (countMeshes(root) === 0) throw new Error(`No mesh found in ${url}`);
        await waitForTextures(root);
        const glb = await new GLTFExporter().parseAsync(root, { binary: true });
        return toBase64(glb);
      };
      window.ready = true;
    </script>
  </body>
</html>
```

### Appendix: `convert.mjs`

```js
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const [baseUrl, inputPath, outputPath] = process.argv.slice(2);
if (!baseUrl || !inputPath || !outputPath) {
  console.error(
    'usage: node convert.mjs <baseUrl> <inputUrlPath> <output.glb>',
  );
  process.exit(2);
}

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  chromiumSandbox: true,
});
try {
  const page = await browser.newPage();
  page.on('pageerror', (error) => console.error('[pageerror]', error.message));
  await page.goto(`${baseUrl}/convert.html`);
  await page.waitForFunction(() => window.ready === true);
  const started = Date.now();
  const glbBase64 = await page.evaluate(
    (url) => window.convert(url),
    inputPath,
  );
  const glb = Buffer.from(glbBase64, 'base64');
  await writeFile(outputPath, glb);
  console.log(
    JSON.stringify({
      glbBytes: glb.length,
      seconds: (Date.now() - started) / 1000,
    }),
  );
} finally {
  await browser.close();
}
```

### Appendix: `viewer.html`

The first script tag self-hosts the Draco decoder. Remove it to reproduce the default `www.gstatic.com` behaviour. The page reads the model URL from the query string for local testing only. [RECOMMENDED] The product viewer should take it from an authorized API response instead.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Scan Viewer</title>
    <script>
      self.ModelViewerElement = {
        dracoDecoderLocation:
          './node_modules/three/examples/jsm/libs/draco/gltf/',
      };
    </script>
    <script
      type="module"
      src="./node_modules/@google/model-viewer/dist/model-viewer.min.js"
    ></script>
    <style>
      html,
      body {
        margin: 0;
        height: 100%;
      }
      main {
        display: flex;
        flex-direction: column;
        height: 100%;
      }
      model-viewer {
        flex: 1;
        width: 100%;
      }
    </style>
  </head>
  <body>
    <main>
      <model-viewer
        id="viewer"
        camera-controls
        tone-mapping="neutral"
        shadow-intensity="1"
        min-camera-orbit="auto 0deg auto"
        max-camera-orbit="auto 180deg auto"
        alt="Scanned artwork"
      ></model-viewer>
      <nav id="views"></nav>
    </main>
    <script type="module">
      const VIEWS = {
        front: '0deg 75deg auto',
        back: '180deg 75deg auto',
        left: '-90deg 75deg auto',
        right: '90deg 75deg auto',
        top: '0deg 0deg auto',
        bottom: '0deg 180deg auto',
      };
      const viewer = document.getElementById('viewer');
      viewer.src = new URLSearchParams(location.search).get('src');
      for (const [name, orbit] of Object.entries(VIEWS)) {
        const button = document.createElement('button');
        button.textContent = name;
        button.addEventListener('click', () => (viewer.cameraOrbit = orbit));
        document.getElementById('views').append(button);
      }
      const started = performance.now();
      viewer.addEventListener(
        'load',
        () => (window.loadMs = Math.round(performance.now() - started)),
      );
      viewer.addEventListener(
        'error',
        (event) =>
          (window.loadError = String(event.detail?.sourceError ?? event.type)),
      );
    </script>
  </body>
</html>
```

### Appendix: `throttle.mjs`

```js
import { chromium } from 'playwright';

const [baseUrl] = process.argv.slice(2);
if (!baseUrl) {
  console.error('usage: node throttle.mjs <baseUrl>');
  process.exit(2);
}
const RUNS = 3;
const PROFILES = [
  { name: 'none', mbps: 0, latency: 0 },
  { name: '40 Mbit/s, 40 ms', mbps: 40, latency: 40 },
  { name: '15 Mbit/s, 70 ms', mbps: 15, latency: 70 },
  { name: '5 Mbit/s, 120 ms', mbps: 5, latency: 120 },
];
const MODELS = ['out/p2k.glb', 'out/p1k.glb'];
const median = (values) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  chromiumSandbox: true,
  // Software WebGL for headless measurement of trusted local files only.
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

async function measure(model, profile) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (profile.mbps) {
    const bytesPerSecond = (profile.mbps * 1e6) / 8;
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: profile.latency,
      downloadThroughput: bytesPerSecond,
      uploadThroughput: bytesPerSecond / 3,
    });
  }
  const bytesByHost = {};
  page.on('response', async (response) => {
    try {
      const host = new URL(response.url()).host;
      bytesByHost[host] =
        (bytesByHost[host] ?? 0) + (await response.body()).length;
    } catch {
      // Responses without a readable body, such as redirects, are not counted.
    }
  });
  const started = Date.now();
  await page.goto(`${baseUrl}/viewer.html?src=${model}`);
  await page.waitForFunction(
    () => window.loadMs !== undefined || window.loadError,
    null,
    { timeout: 180000 },
  );
  const seconds = (Date.now() - started) / 1000;
  const loadError = await page.evaluate(() => window.loadError);
  if (loadError) throw new Error(`${model} failed to load: ${loadError}`);
  await page.waitForTimeout(500);
  await context.close();
  return { seconds, bytesByHost };
}

for (const model of MODELS) {
  for (const profile of PROFILES) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) runs.push(await measure(model, profile));
    const times = runs.map((run) => run.seconds);
    const mbByHost = Object.fromEntries(
      Object.entries(runs[0].bytesByHost).map(([host, bytes]) => [
        host,
        +(bytes / 1e6).toFixed(2),
      ]),
    );
    console.log(
      JSON.stringify({
        model,
        profile: profile.name,
        median: median(times),
        min: Math.min(...times),
        max: Math.max(...times),
        mbByHost,
      }),
    );
  }
}
await browser.close();
```

## Sources

All web sources were consulted on 2026-11-21.

- Apple Object Capture: [ObjectCaptureSession](https://developer.apple.com/documentation/realitykit/objectcapturesession), [PhotogrammetrySession](https://developer.apple.com/documentation/realitykit/photogrammetrysession), [WWDC23 Meet Object Capture for iOS](https://developer.apple.com/videos/play/wwdc2023/10191/)
- Device support and LiDAR, from developer forums: [thread 731148](https://developer.apple.com/forums/thread/731148), [thread 769221](https://developer.apple.com/forums/thread/769221)
- Reality Composer and Object Capture, from developer forums: [thread 749299](https://developer.apple.com/forums/thread/749299)
- Sample asset: [AR Quick Look gallery](https://developer.apple.com/augmented-reality/quick-look/)
- Android: [ARCore Raw Depth codelab](https://codelabs.developers.google.com/codelabs/arcore-rawdepthapi), [Polycam processing help](https://learn.poly.cam/hc/en-us/articles/30549172696084)
- Cloud APIs: [KIRI Engine API](https://kiriengine.app/api), [Autodesk Platform Services pricing](https://aps.autodesk.com/pricing)
- Meshroom: [requirements](https://meshroom-manual.readthedocs.io/en/latest/first-steps/install/requirements.html)
- Generative 3D: [Meshy API pricing](https://docs.meshy.ai/en/api/pricing), [Tripo credits and pricing guide](https://www.tripo3d.ai/getting-started/zero-to-3d-getting-started-credits-pricing-guide)
- three.js: [USDLoader](https://threejs.org/docs/pages/USDLoader.html). Source lines refer to the three 0.183.2 npm package.
- glTF-Transform: [CLI package](https://www.npmjs.com/package/@gltf-transform/cli)
- model-viewer: [lighting and environment](https://modelviewer.dev/examples/lightingandenv/), [augmented reality](https://modelviewer.dev/examples/augmentedreality). Source lines refer to the 4.4.0 npm package.
- iOS share target: [WebKit bug 194593](https://bugs.webkit.org/show_bug.cgi?id=194593)
