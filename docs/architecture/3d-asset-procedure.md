# 3D asset procedure

This procedure turns a physical artwork into the delivery objects of [ADR 0001](../decisions/0001-d12-3d-demo-experience.md): a GLB at 1K, a GLB at 2K, a poster image and, once 3D-04a can clean it, the original USDZ. It covers backlog item 3D-03 ([#10](https://github.com/songomby-D1/devfest2026/issues/10)).

- **Owner:** shidoAdr
- **Status:** [NOT IMPLEMENTED] Draft. shidoAdr must confirm the Reality Composer steps, and no other team member has followed this procedure yet.
- **Tools:** the [spike scripts](3d-feasibility-spike.md#reproduction) and the `prepare.sh` and `poster.mjs` scripts below, until the preparation script of 3D-04a ([#11](https://github.com/songomby-D1/devfest2026/issues/11)) replaces them. Installing them on a shared machine or in the repository requires approval from endy-rkt (AGENTS.md).

## 1. Before the capture

- [ ] **Item identifier.** Choose an `<item-id>` made of lowercase letters, digits and hyphens only, such as `vase-ambalavao`. The scripts reject other characters.
- [ ] **Rights.** Record who cleared the rights to the object, the scan, the poster and public display (ADR 0001, security terms). Do not scan an artwork without this record. Keep the record outside the repository until D18 defines where it lives, because it names people.
- [ ] **Device.** An iPhone Pro with LiDAR and Reality Composer. [CONFIRMED] The 3D-01b scan was captured on an iPhone 13 Pro. Other devices are unverified.
- [ ] **Object.** Check whether the artwork can be handled and turned over. If not, plan to hide its bottom in the viewer (step 5).
- [ ] **Place.** [RECOMMENDED] Even, diffuse light, no direct sun or hard shadows, a plain surface and room to walk around the object. This is common photogrammetry practice, not a spike measurement.

## 2. Capture with Reality Composer

The menu names below are unverified. shidoAdr confirms them on the device.

1. Open Reality Composer and start an object capture.
2. Walk around the object and follow the on-screen guidance until the capture completes. [CONFIRMED] On the 3D-01b scan, capture to export took about 1 min 30 s.
3. If the object can be turned over, capture a second pass with the object upside down so the bottom gets a texture. On the 3D-01b scan, the bottom rendered dark and smooth without it.
4. Export the result as `.usdz`, rename it `<item-id>.usdz` and copy it to a folder outside any Git repository on the preparation laptop, such as `~/scans`.

## 3. Convert and optimize

1. Once per laptop, follow steps 1 and 2 of the spike [reproduction](3d-feasibility-spike.md#reproduction) to install the pinned tools and save `convert.html`, `convert.mjs` and `viewer.html`. Skip the `curl` and `sha256sum` lines, which fetch Apple's sample, and `throttle.mjs`, which only measures load times.
2. Save [`prepare.sh`](#appendix-preparesh) and [`poster.mjs`](#appendix-postermjs) in the same scratch directory.
3. The scripts use the system Chrome at `/usr/bin/google-chrome-stable`. On another system, change `executablePath` in `convert.mjs` and `poster.mjs`, or remove it after `npx --no-install playwright install chromium`. The procedure was not run on macOS.
4. Start the local server from the scratch directory, bound to the loopback interface only:

   ```sh
   python3 -m http.server 8765 --bind 127.0.0.1
   ```

5. In a second shell, from the scratch directory, run:

   ```sh
   bash prepare.sh <item-id> ~/scans http://127.0.0.1:8765
   ```

6. After validation, stop the server with Ctrl+C.

`prepare.sh` accepts only a server on `127.0.0.1` or `localhost`, removes earlier outputs for the item, stops at the first error and deletes its working copy of the USDZ on exit. `convert.mjs` fails with an explicit message on a corrupt file or a file without a mesh. `optimize` may drop a texture that is a single neutral color, such as a white occlusion map, which does not change the rendering. `poster.mjs` renders the 1K model from the default view. It aborts HTTP and HTTPS requests to any other origin and fails when it had to abort one, which catches a GLB with an external reference.

## 4. Validate

Inspect each GLB with `npx --no-install gltf-transform inspect out/<item-id>-2k.glb`. Then open `http://127.0.0.1:8765/viewer.html?src=out/<item-id>-2k.glb`, use the preset view buttons, and do the same for the 1K file.

| Check                | Pass condition                                                                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Size                 | 1K GLB under 1.5 MB and 2K GLB under 3 MB. These ADR 0001 limits are provisional until 3D-05b. Above them, serve 1K only or reduce the textures.                  |
| Textures             | `inspect` lists at least a base color texture. No view shows a missing or black texture apart from an unscanned bottom.                                           |
| Views                | Front, back, left, right and top look like the object. Bottom too if it was scanned.                                                                              |
| 1K against 2K        | The 1K variant is acceptable at the default zoom.                                                                                                                 |
| Poster               | Open `http://127.0.0.1:8765/out/<item-id>-poster.webp` in the browser. It shows the whole object, as in the viewer's default view.                                |
| Rights               | The rights record of step 1 exists.                                                                                                                               |
| Self-contained files | [NOT IMPLEMENTED] The checking tool is chosen in 3D-04a. Until then, deliver only files produced by this procedure and never re-import a third-party USDZ or GLB. |
| USDZ metadata        | [NOT IMPLEMENTED] 3D-04a must strip the USDZ metadata. See below.                                                                                                 |

Reject the asset when a check fails, fix the cause and run the steps again.

On the 3D-01b scan, `unzip -l` shows the capture date and time on every archive entry, and `strings` on the USDC file shows the name of the capture app and a local device path. The produced GLB files contain none of these. Their JSON holds only generic node and mesh names.

## 5. Hand off

- Deliver `<item-id>-1k.glb`, `<item-id>-2k.glb` and `<item-id>-poster.webp`. Confirm that the rights record exists, but keep it outside the repository and outside the delivered files.
- Do not deliver or serve the USDZ, and therefore do not enable AR, until 3D-04a checks its references and strips its metadata.
- If the bottom was not scanned, tell the frontend owner to hide the bottom view and limit the vertical orbit to the horizon for that item, for example `max-camera-orbit="auto 90deg auto"`.
- Keep the prepared GLB and poster as the demo fallback if a live scan fails on stage.
- [NOT IMPLEMENTED] Storage and association with the content item belong to 3D-04b ([#12](https://github.com/songomby-D1/devfest2026/issues/12)) and 3D-04c ([#13](https://github.com/songomby-D1/devfest2026/issues/13)). Until then, keep all files outside the repository.

## Reference run

[CONFIRMED] The commands of steps 3 and 4 ran on the 3D-01b scan of a phone charger, which is not demo content. Two successive runs from clean directories gave identical outputs.

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
base="${3%/}"

case "$item" in
  '' | *[!a-z0-9-]*)
    echo "item-id must use lowercase letters, digits and hyphens only" >&2
    exit 2
    ;;
esac
if [[ ! "$base" =~ ^http://(127\.0\.0\.1|localhost):[0-9]+$ ]]; then
  echo "baseUrl must be http://127.0.0.1:<port> or http://localhost:<port>" >&2
  exit 2
fi
for required in convert.html convert.mjs viewer.html poster.mjs node_modules; do
  if [ ! -e "$required" ]; then
    echo "missing $required in the current directory" >&2
    exit 1
  fi
done
if [ ! -f "$scans/$item.usdz" ]; then
  echo "missing $scans/$item.usdz" >&2
  exit 1
fi

mkdir -p models out
rm -f "out/$item-raw.glb" "out/$item-2k.glb" "out/$item-1k.glb" "out/$item-poster.webp"
trap 'rm -f "models/$item.usdz"' EXIT
cp -- "$scans/$item.usdz" "models/$item.usdz"

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

const LOOPBACK_HOSTS = ['127.0.0.1', 'localhost'];

function fail(message) {
  console.error(message);
  process.exit(2);
}

function loopbackOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`invalid baseUrl: ${value}`);
  }
  if (url.protocol !== 'http:' || !LOOPBACK_HOSTS.includes(url.hostname)) {
    fail('baseUrl must be http://127.0.0.1:<port> or http://localhost:<port>');
  }
  return url.origin;
}

async function renderPoster(origin, model) {
  const viewerUrl = new URL('/viewer.html', origin);
  viewerUrl.searchParams.set('src', model);
  const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    chromiumSandbox: true,
    // Software WebGL for headless rendering of trusted local files only.
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 1024, height: 1024 },
      serviceWorkers: 'block',
    });
    const blocked = [];
    await context.route(
      (url) => url.origin !== origin,
      (route) => {
        blocked.push(route.request().url());
        return route.abort();
      },
    );
    const page = await context.newPage();
    await page.goto(viewerUrl.href);
    await page.waitForFunction(
      () => window.loadMs !== undefined || window.loadError,
      null,
      { timeout: 120000 },
    );
    const loadError = await page.evaluate(() => window.loadError);
    if (loadError) throw new Error(`${model} failed to load: ${loadError}`);
    if (blocked.length > 0) {
      throw new Error(
        `${model} requested other origins: ${blocked.join(', ')}`,
      );
    }
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
    return Buffer.from(posterBase64, 'base64');
  } finally {
    await browser.close();
  }
}

const [baseUrl, model, output] = process.argv.slice(2);
if (!baseUrl || !model || !output) {
  fail('usage: node poster.mjs <baseUrl> <model.glb> <poster.webp>');
}
const origin = loopbackOrigin(baseUrl);
await access(model).catch(() => fail(`model not found: ${model}`));
await access(dirname(output)).catch(() =>
  fail(`output folder not found: ${dirname(output)}`),
);

try {
  const poster = await renderPoster(origin, model);
  await writeFile(output, poster);
  console.log(JSON.stringify({ posterBytes: poster.length }));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
```

`toBlob` is a public method of `<model-viewer>` 4.4.0 (`@google/model-viewer/lib/model-viewer-base.js:395`). `serviceWorkers: 'block'` keeps service workers from bypassing the route filter. Resources with `data:` and `blob:` URLs are not routed, which a test GLB with a `data:` image confirmed.
