# Frontend rules

These rules apply to everyone working in `apps/frontend/`, people and agents alike. The [frontend README](README.md) explains how the app is built; this page says what every change must respect. They extend the repository rules and never relax them: [AGENTS.md](../../AGENTS.md), [CONTRIBUTING.md](../../CONTRIBUTING.md), the [shared code policy](../../docs/development/code-policy.md) and the [CI guide](../../docs/development/ci.md). If a rule here conflicts with one of those, the repository rule wins and this file gets fixed.

Tags follow the repository convention. `[CONFIRMED]` rules come from approved documents or decisions. `[RECOMMENDED]` rules are proposed for this app and await confirmation by the frontend owner.

Frontend implementation awaits an owner under D02 in the [backlog](../../docs/product/task.md). Sesedra owns design. The frontend owner maintains this file once named.

## Stack

- [RECOMMENDED] React 19 and TypeScript, built with Vite 8 and tested with Vitest 5, Testing Library and jsdom, on Node 22 LTS from the root `.nvmrc`. [ADR 0001](../../docs/decisions/0001-frontend-toolchain.md) proposes this toolchain and awaits approval from endy-rkt.
- [CONFIRMED] The browser reaches the backend only through the gateway. [RECOMMENDED] The frontend is therefore a static single-page app with no server code of its own: no Next.js, no API routes and no server-side rendering. NestJS is for the gateway and backend services only.
- [CONFIRMED] Dependencies are pinned to exact versions in the root lockfile. Adding, removing or upgrading one needs approval from endy-rkt and a one-line justification in the PR. Prefer platform and React features over a new package.
- [DECISION REQUIRED: endy-rkt] Routing, data fetching and the 3D viewer library are not chosen yet. Propose them with FE-02, FE-03 and 3D-05.
- [CONFIRMED] Interface copy follows Sesedra's Figma mockups, which are in French. Code identifiers, environment variables and repository documentation stay in English, per the [language rule](../../docs/development/code-policy.md#code-conventions).

## Commands

Run every command from the repository root.

| Command                              | Purpose                                                  |
| ------------------------------------ | -------------------------------------------------------- |
| `npm install`                        | Install all workspaces from the root lockfile.           |
| `npm run dev -w apps/frontend`       | Start the dev server on `http://localhost:5173`.         |
| `npm run test -w apps/frontend`      | Run the tests once.                                      |
| `npm run typecheck -w apps/frontend` | Type-check `src/` and `vite.config.ts`.                  |
| `npm run build -w apps/frontend`     | Build the production bundle into `apps/frontend/dist/`.  |
| `npm run lint`                       | Run the shared ESLint config with zero warnings allowed. |
| `npm run format:check`               | Check formatting against `.prettierrc.json`.             |

- [RECOMMENDED] In development, `http://localhost:5173/?motion=lab` shows the motion lab to compare intro and transition variants. Remove the lab and the unused variants once Sesedra picks one.
- [CONFIRMED] `typecheck`, `test` and `build` form the [CI script contract](../../docs/development/code-policy.md#ci-script-contract). All three stay defined and green.
- [CONFIRMED] Point editor integrations at `.prettierrc.json` explicitly. Otherwise the empty legacy `.prettierrc` takes precedence and formats differently from CI.

## Structure

```text
apps/frontend/
  index.html
  vite.config.ts          Vite, dev proxy and Vitest settings
  src/
    main.tsx              Entry point
    app/                  App, route matching and the development motion lab
    features/home/        Home page: hanging, intro, parallax and exit
    features/gallery/     Rooms, artworks, notice, close-up viewer and data/rooms.ts
    features/account/     Sign-in and registration
    features/contribute/  Submission form, media upload and my submissions
    features/item/        Item detail page
    features/review/      Review queue and review screen
    components/<name>/    Reusable UI components that mirror the Figma components
    lib/router/           History-based router and Link
    lib/motion/           GSAP setup, reduced motion, font waiting, motion variants
    lib/audio/            Room ambience, off by default
    lib/media/            The single manifest of media paths
    lib/api/              The only module that calls the gateway (FE-03)
    styles/               tokens.css, fonts.css and global.css
    test/                 Test setup and the motion helper
```

- [CONFIRMED] Folders and non-component files use kebab-case. Components and their files use PascalCase, for example `components/item-card/ItemCard.tsx` with `ItemCard.module.css` and `ItemCard.test.tsx`. Variables and functions use camelCase.
- [RECOMMENDED] Use function components and named exports, one component per file.
- [RECOMMENDED] A feature imports from `components/` and `lib/`, never from another feature. Move shared code into `components/` or `lib/`.

## Design and Figma

- [CONFIRMED] The approved Figma mockups are the visual source of truth, and Sesedra owns UI/UX design. Agree any deviation from a mockup with Sesedra before merging and record the reason in the PR.
- [RECOMMENDED] Figma variables become CSS custom properties in [src/styles/tokens.css](src/styles/tokens.css), with the same names in kebab-case. The current values are placeholders until the variables are exported from Figma.
- [RECOMMENDED] Components take color, typography, spacing, radius and shadow values from tokens only. Raw hex, rgb or font values appear only in `tokens.css`.
- [RECOMMENDED] Each Figma component maps to one React component in `src/components/`, with the same name and its variants as props. Put the Figma node link in a comment at the top of the component file.
- [RECOMMENDED] Style with CSS Modules (`*.module.css`), which Vite supports without a dependency. Use inline styles only for values computed at runtime.
- [RECOMMENDED] Build mobile first and cover both the desktop and mobile frames of each mockup. Take breakpoints from the Figma frame widths and reuse the same values everywhere.
- [CONFIRMED] Cultural media stays out of Git until D18 approves its rights, consent and attribution. This covers photos of artworks, videos, music and 3D models. The app loads such media from the gateway at runtime, and tests use synthetic fixtures. Commit exported icons and illustrations only when the team holds their rights, as optimized SVG.
- [RECOMMENDED] Until the gateway serves media, keep local demo media in the ignored `apps/frontend/public/media/` folder and reference every path from [src/lib/media/media.ts](src/lib/media/media.ts). Record each file's source and license in [media-sources.md](media-sources.md). Each frame shows a clean missing-media state when a file is absent, as it is in CI.
- [CONFIRMED] Artworks shown in the museum are real works. AI-generated artworks are excluded from the collection, per the [README](../../README.md#contribution-review). Generated decor (walls, frames, light) is acceptable when the team holds its rights.
- [RECOMMENDED] The repository is public. Font files whose license does not allow public redistribution stay in the ignored `apps/frontend/fonts/` folder. Every font stack ends with free fallbacks so CI and other contributors still render a usable page.
- [CONFIRMED] A UI PR attaches a screenshot or mockup, as the [PR template](../../.github/PULL_REQUEST_TEMPLATE.md) requires. [RECOMMENDED] Place it next to the matching Figma frame for desktop and mobile.

## Screens and states

A mockup often shows only the happy path. Each screen still implements the states that the [MVP](../../docs/product/MVP.md) requires.

- [RECOMMENDED] Show loading, empty and error states, where the error state offers a recovery action. Also handle missing or failed media.
- [CONFIRMED] Show verification status (`verified`, `unreviewed`, `uncertain`) separately from publication status. An automated or AI suggestion never displays as verified. Exact status values follow D18.
- [CONFIRMED] Guests see published content only. A protected action shows a sign-in path instead of failing silently.
- [CONFIRMED] When a 3D model fails to load or is unsupported, show its still image and keep the page usable.
- [CONFIRMED] NFT actions show recoverable pending, confirmed and failed states and block repeated submission while confirmation is pending. The interface explains what the token record establishes.

## Motion

- [RECOMMENDED] GSAP is the only animation library, imported from [src/lib/motion/gsap.ts](src/lib/motion/gsap.ts), which registers `useGSAP` and `SplitText`. Choreography lives in hooks next to the page (`useHomeIntro`, `useGalleryArrival`), not in components.
- [RECOMMENDED] Animate `transform`, `opacity`, `clip-path` and light filters only. Select targets with `data-anim` (home) and `data-g` (gallery) attributes, never with CSS Module class names.
- [CONFIRMED] Nothing appears before its animation: pages start with `data-motion="pending"`, the intro sets each element's first frame, and `data-motion="done"` marks the end. Split text only after its fonts load, with a timeout so a missing font never blocks the page.
- [CONFIRMED] `prefers-reduced-motion` replaces every choreography with short fades and disables the parallax. Use `useReducedMotion()` and keep CSS hover transitions under the same media query.
- [RECOMMENDED] Independent layers keep motions from fighting: the intro and exit move the figure, the parallax moves `[data-parallax]`, and the hover lift is CSS on an inner element.
- [CONFIRMED] Clean up every animation, audio voice and listener on unmount. `useGSAP` reverts its context; event listeners return their removal in the effect.
- [CONFIRMED] Sound is off by default and only a click or the `M` key starts it. Fades use a Web Audio gain node. Never autoplay.

## Data and the gateway

- [CONFIRMED] The browser talks only to the gateway, through relative `/api/...` URLs. The frontend never calls a backend service, database or object storage directly. The wallet signing step is the only exception, and D10 defines its boundary.
- [RECOMMENDED] Only `src/lib/api/` calls `fetch`. Features and components go through it.
- [RECOMMENDED] In development, Vite proxies `/api` to `GATEWAY_URL`, which defaults to `http://localhost:3000`. To change it, copy `apps/frontend/.env.example` to `apps/frontend/.env`. The port is provisional until the gateway lands (GATEWAY-01).
- [CONFIRMED] Every `import.meta.env.VITE_*` value ships to every visitor. Never put secrets, credentials or private URLs in frontend code or `VITE_*` variables. Code in `src/` reads configuration from `import.meta.env`, never from `process.env`.
- [DECISION REQUIRED: endy-rkt] Session handling follows D07. Until then, do not store tokens or session identifiers in `localStorage`, `sessionStorage` or script-readable cookies. The recommended design is an HTTP-only cookie.
- [CONFIRMED] Never display personal data, secrets or raw upstream errors. [RECOMMENDED] Show the gateway's safe message and request ID.
- [CONFIRMED] Never import source from another app, which ESLint enforces. Shared contract types come from `packages/shared` as type-only imports once D14 approves them.

## Accessibility

- [CONFIRMED] The `jsx-a11y` recommended rules are errors and stay enabled.
- [RECOMMENDED] Target WCAG 2.1 AA:
  - text contrast of at least 4.5:1, or 3:1 for large text and UI parts;
  - full keyboard use with a visible focus;
  - landmarks and one `h1` per page;
  - labeled form fields, with errors announced next to their field.
- [RECOMMENDED] Give each content image an `alt` that describes the item, and decorative images `alt=""`. Caption videos that carry speech. Respect `prefers-reduced-motion`, as `global.css` does.
- [RECOMMENDED] Check contrast in Figma before implementing a screen and report failing token pairs to Sesedra.

## Code

- [CONFIRMED] The root ESLint config, Prettier and the strict TypeScript base apply unchanged. ESLint runs typed `strictTypeChecked`, React Hooks, jsx-a11y and the import boundaries. Explicit `any` and `@ts-ignore` are rejected. A temporary suppression is line-scoped, with a reason and a task ID.
- [CONFIRMED] Do not use `console.log`. Use `console.warn` or `console.error` only for actionable problems, and never log personal data.
- [CONFIRMED] Await, return or handle every promise.
- [RECOMMENDED] Keep state as local as possible and lift it only when two components need it.

## Tests

- [RECOMMENDED] Keep tests next to their code as `*.test.tsx` or `*.test.ts`. They run with Vitest in jsdom.
- [CONFIRMED] Assert observable behavior, including relevant failures. Snapshot-only tests of logic do not pass review. [RECOMMENDED] Query by role, label or text with Testing Library rather than by class name.
- [RECOMMENDED] Cover the states listed under [Screens and states](#screens-and-states), not only the happy path. Mock the gateway at the `lib/api` boundary.
- [CONFIRMED] Fixtures are synthetic or rights-cleared and contain no personal data.

## Workflow

- [CONFIRMED] Start each task on a branch from `develop` named `feature/<name>` or `fix/<name>`. Merge it into `develop` by PR after a green `ci-ok` and a review.
- [CONFIRMED] Before opening a PR, run `npm run lint`, `npm run format:check` and the three workspace scripts. Report the exact commands and results.
- [CONFIRMED] The frontend owner writes the frontend tests, Dockerfile and root Compose entry (FE-05) and coordinates shared Compose changes. Taskfile and deployment changes need explicit approval from endy-rkt, as do changes to the CI workflows, the shared quality configs and the dependencies.
- [CONFIRMED] Agents follow the [session protocol](../../AGENTS.md#session-protocol) and stop after reporting.

## Definition of done for a frontend PR

- [ ] Matches the Figma frames on desktop and mobile, with screenshots in the PR.
- [ ] Implements the states in [Screens and states](#screens-and-states) that apply.
- [ ] Uses tokens for every design value.
- [ ] Works with the keyboard and meets contrast.
- [ ] Lint, format, typecheck, test and build pass locally, and `ci-ok` is green.
- [ ] Contains no secrets, personal data or uncleared cultural media.
