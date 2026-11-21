# 3D asset procedure

This procedure turns a physical artwork into the delivery objects of [ADR 0001](../decisions/0001-d12-3d-demo-experience.md): a GLB at 1K, a GLB at 2K, a poster image and, once 3D-04a can clean it, the original USDZ. It covers backlog item 3D-03 ([#10](https://github.com/songomby-D1/devfest2026/issues/10)).

- **Owner:** shidoAdr
- **Status:** [NOT IMPLEMENTED] Draft. shidoAdr must confirm the Reality Composer steps, and no other team member has followed this procedure yet.
- **Tools:** the [spike scripts](3d-feasibility-spike.md#reproduction) and the `prepare.sh` and `poster.mjs` scripts below, until the preparation script of 3D-04a ([#11](https://github.com/songomby-D1/devfest2026/issues/11)) replaces them. Installing them on a shared machine or in the repository requires approval from endy-rkt (AGENTS.md).

## 1. Before the capture

- [ ] **Item identifier.** Choose an `<item-id>` made of lowercase letters, digits and hyphens only, such as `vase-ambalavao`. The scripts reject other characters.
- [ ] **Rights.** Record who cleared the rights to the object, the scan, the poster and public display (ADR 0001, security terms). Do not scan an artwork without this record. Keep the record outside the repository until D18 defines where it lives, because it names people.
- [ ] **Device.** An iPhone Pro with LiDAR and Reality Composer. [CONFIRMED] The procedure was run on an iPhone 13 Pro. Other devices are unverified.
- [ ] **Object.** Check whether the artwork can be handled and turned over. If not, plan to hide its bottom in the viewer (step 5).
- [ ] **Place.** [RECOMMENDED] Even, diffuse light, no direct sun or hard shadows, a plain surface and room to walk around the object. This is common photogrammetry practice, not a spike measurement.

## 2. Capture with Reality Composer

The menu names below are unverified. shidoAdr confirms them on the device.

1. Open Reality Composer and start an object capture.
2. Walk around the object and follow the on-screen guidance until the capture completes. [CONFIRMED] On the 3D-01b scan, capture to export took about 1 min 30 s.
3. If the object can be turned over, capture a second pass with the object upside down so the bottom gets a texture. On the 3D-01b scan, the bottom rendered dark and smooth without it.
4. Export the result as `.usdz`, rename it `<item-id>.usdz` and copy it to a folder outside any Git repository on the preparation laptop, such as `~/scans`.

## 3. Convert and optimize

1. Complete steps 1 and 2 of the spike [reproduction](3d-feasibility-spike.md#reproduction) once. They install the pinned tools, create `models/` and `out/` and start the local server, bound to the loopback interface only:

   ```sh
   python3 -m http.server 8765 --bind 127.0.0.1
   ```

2. Save [`prepare.sh`](#appendix-preparesh) and [`poster.mjs`](#appendix-postermjs) in the same scratch directory.
3. The scripts use the system Chrome at `/usr/bin/google-chrome-stable`. On another system, change `executablePath` in `convert.mjs` and `poster.mjs`, or remove it after `npx --no-install playwright install chromium`. The procedure was not run on macOS.
4. From the scratch directory, in a second shell, run:

   ```sh
   bash prepare.sh <item-id> ~/scans http://127.0.0.1:8765
   ```

The script stops at the first error. `convert.mjs` fails with an explicit message on a corrupt file or a file without a mesh. `optimize` may drop a texture that is a single neutral color, such as a white occlusion map, which does not change the rendering. `poster.mjs` renders the 1K model from the default front view and blocks every request outside the local server.

## 4. Validate

Inspect each GLB with `npx --no-install gltf-transform inspect out/<item-id>-2k.glb`. Then open `http://127.0.0.1:8765/viewer.html?src=out/<item-id>-2k.glb`, use the preset view buttons, and do the same for the 1K file.

| Check                | Pass condition                                                                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Size                 | 1K GLB under 1.5 MB and 2K GLB under 3 MB (ADR 0001 asset budget). Above that, serve 1K only or reduce the textures.                                              |
| Textures             | `inspect` lists at least a base color texture. No view shows a missing or black texture apart from an unscanned bottom.                                           |
| Views                | Front, back, left, right and top look like the object. Bottom too if it was scanned.                                                                              |
| 1K against 2K        | The 1K variant is acceptable at the default zoom.                                                                                                                 |
| Poster               | `out/<item-id>-poster.webp` exists and shows the object from the front.                                                                                           |
| Rights               | The rights record of step 1 exists.                                                                                                                               |
| Self-contained files | [NOT IMPLEMENTED] The checking tool is chosen in 3D-04a. Until then, deliver only files produced by this procedure and never re-import a third-party USDZ or GLB. |
| USDZ metadata        | [NOT IMPLEMENTED] The 3D-01b USDZ holds the capture app, a local device path with the capture project name, and capture timestamps. 3D-04a must strip them.       |

Reject the asset when a check fails, fix the cause and run the steps again.

## 5. Hand off

- Deliver `<item-id>-1k.glb`, `<item-id>-2k.glb` and `<item-id>-poster.webp`, with the rights record.
- Do not deliver or serve the USDZ, and therefore do not enable AR, until 3D-04a checks its references and strips its metadata.
- If the bottom was not scanned, tell the frontend owner to hide the bottom view and limit the vertical orbit to the horizon for that item, for example `max-camera-orbit="auto 90deg auto"`.
- Keep the prepared GLB and poster as the demo fallback if a live scan fails on stage.
- [NOT IMPLEMENTED] Storage and association with the content item belong to 3D-04b ([#12](https://github.com/songomby-D1/devfest2026/issues/12)) and 3D-04c ([#13](https://github.com/songomby-D1/devfest2026/issues/13)). Until then, keep all files outside the repository.

## Reference run

[CONFIRMED] The steps above ran on the 3D-01b scan of a phone charger, which is not demo content.

| Output                  | Size            |
| ----------------------- | --------------- |
| USDZ from the iPhone    | 4,923,295 bytes |
| GLB 2K                  | 147,960 bytes   |
| GLB 1K                  | 73,760 bytes    |
| Poster, WebP 664 × 1003 | 19,240 bytes    |

## Appendix: `prepare.sh`

```sh
#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "usage: bash prepare.sh <item-id> <scan-folder> <baseUrl>" >&2
  exit 2
fi
item="$1"
scans="$2"
base="$3"
case "$item" in
  '' | *[!a-z0-9-]*)
    echo "item-id must use lowercase letters, digits and hyphens only" >&2
    exit 2
    ;;
esac
if [ ! -f "$scans/$item.usdz" ]; then
  echo "missing $scans/$item.usdz" >&2
  exit 1
fi

mkdir -p models out
cp "$scans/$item.usdz" "models/$item.usdz"
node convert.mjs "$base" "models/$item.usdz" "out/$item-raw.glb"
npx --no-install gltf-transform optimize "out/$item-raw.glb" "out/$item-2k.glb" \
  --compress draco --texture-compress webp
npx --no-install gltf-transform optimize "out/$item-raw.glb" "out/$item-1k.glb" \
  --compress draco --texture-compress webp --texture-size 1024
node poster.mjs "$base" "out/$item-1k.glb" "out/$item-poster.webp"
stat -c '%s %n' "out/$item-2k.glb" "out/$item-1k.glb" "out/$item-poster.webp"
```

On macOS, replace `stat -c '%s %n'` with `stat -f '%z %N'`.

## Appendix: `poster.mjs`

```js
import { chromium } from 'playwright';
import { access, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const [baseUrl, model, output] = process.argv.slice(2);
if (!baseUrl || !model || !output) {
  console.error('usage: node poster.mjs <baseUrl> <model.glb> <poster.webp>');
  process.exit(2);
}
const origin = new URL(baseUrl).origin;
if (!['127.0.0.1', 'localhost'].includes(new URL(baseUrl).hostname)) {
  console.error('baseUrl must point to the loopback interface');
  process.exit(2);
}
await access(model).catch(() => {
  throw new Error(`model not found: ${model}`);
});
await access(dirname(output)).catch(() => {
  throw new Error(`output folder not found: ${dirname(output)}`);
});

const viewerUrl = new URL('viewer.html', `${origin}/`);
viewerUrl.searchParams.set('src', model);

const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  chromiumSandbox: true,
  // Software WebGL for headless rendering of trusted local files only.
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1024, height: 1024 },
  });
  await page.route(
    (url) => url.origin !== origin,
    (route) => route.abort(),
  );
  await page.goto(viewerUrl.href);
  await page.waitForFunction(
    () => window.loadMs !== undefined || window.loadError,
    null,
    { timeout: 120000 },
  );
  const loadError = await page.evaluate(() => window.loadError);
  if (loadError) throw new Error(`${model} failed to load: ${loadError}`);
  await page.waitForTimeout(1000);
  const posterBase64 = await page.evaluate(async () => {
    const blob = await document.getElementById('viewer').toBlob({
      mimeType: 'image/webp',
      qualityArgument: 0.85,
      idealAspect: true,
    });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
  });
  const poster = Buffer.from(posterBase64, 'base64');
  await writeFile(output, poster);
  console.log(JSON.stringify({ posterBytes: poster.length }));
} finally {
  await browser.close();
}
```

`toBlob` is a public method of `<model-viewer>` 4.4.0 (`@google/model-viewer/lib/model-viewer-base.js:395`). In the reference run, the route filter did not prevent rendering. Whether it covers `data:` and `blob:` resources was not checked.
