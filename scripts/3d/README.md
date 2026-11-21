# 3D asset preparation

Offline command for backlog item 3D-04a ([#11](https://github.com/songomby-D1/devfest2026/issues/11)). It turns a `.usdz` scan into the delivery files of [ADR 0001](../../docs/decisions/0001-d12-3d-demo-experience.md), following the [3D asset procedure](../../docs/architecture/3d-asset-procedure.md).

## Requirements

- Node.js 22, from 22.18.0 (D15). The sources are TypeScript run directly by Node, whose type stripping is enabled by default from 22.18.0. Tests and a real scan run passed on Node 22.23.5 and 26.13.1.
- Chrome or Chromium. Set `CHROME_PATH` to its executable, for example `/usr/bin/google-chrome-stable`. Without it, Playwright's Chromium is used, which requires `npx --no-install playwright install chromium`.

## Install

```sh
npm ci --ignore-scripts
```

The package has its own `package-lock.json` until the root npm workspace and its single lockfile land (D15, D17). It is provisional and moves to the root lockfile then.

## Run

```sh
CHROME_PATH=/usr/bin/google-chrome-stable npm run prepare-asset -- <input.usdz> <item-id> <out-dir>
```

Relative paths resolve against the directory where `npm run` was called. `<item-id>` uses lowercase letters, digits and hyphens only.

The command writes `<item-id>-2k.glb`, `<item-id>-1k.glb`, `<item-id>-poster.webp` and `<item-id>-summary.json` to `<out-dir>`, and prints the summary. The summary lists the size, triangle count and textures of each variant, and the poster size.

- It deletes earlier outputs of the item before starting.
- It writes all four files or none: on failure, it removes partial outputs.
- Exit code 2 means invalid arguments or an input that is not a USDZ archive. Exit code 1 means the preparation failed, for example on a corrupted archive or a scan without a mesh.

Conversion and poster rendering run in headless Chrome against an internal server bound to `127.0.0.1` on an ephemeral port. The server only exposes the pages in `pages/`, the required `node_modules` folders and the file being processed. Requests to any other origin are aborted and fail the run.

## Checks

```sh
npm test
npx tsc --noEmit -p .
```

The integration tests generate a small textured USDZ and run the command with a real browser. They are skipped with a message when no Chrome is found at `CHROME_PATH` or `/usr/bin/google-chrome-stable`.

## Known limits

- `npm audit` reports four moderate advisories in `glob` and `minimatch`, pulled in by `@gltf-transform/cli` 4.5.1. The command processes trusted local files only.
- The USDZ metadata is not stripped and the USDZ is not delivered. That remains open in 3D-04a.
