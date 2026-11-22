# LOVA frontend

The visitor-facing React app of LOVA, the digital museum of Malagasy heritage. It renders the home page and the gallery rooms from Sesedra's Figma mockups, with GSAP motion, and talks to the backend only through the gateway.

This page explains how the app is built and how to work on it. The rules every change must follow are in [rules.md](rules.md). Motion details are in [docs/motion.md](docs/motion.md), the review checklist in [docs/verification.md](docs/verification.md), and the origin of every media file in [media-sources.md](media-sources.md).

## Quick start

Run everything from the repository root, on Node 22 (`.nvmrc`).

```sh
npm install                          # installs all workspaces from the root lockfile
npm run dev -w apps/frontend         # http://localhost:5173
```

| Command                              | What it does                                                    |
| ------------------------------------ | --------------------------------------------------------------- |
| `npm run dev -w apps/frontend`       | Dev server with hot reload. `/api/*` is proxied to the gateway. |
| `npm run test -w apps/frontend`      | Vitest, once. 7 files, 33 tests.                                |
| `npm run typecheck -w apps/frontend` | `tsc --noEmit` on `src/` and `vite.config.ts`.                  |
| `npm run build -w apps/frontend`     | Production bundle in `apps/frontend/dist/`.                     |
| `npm run preview -w apps/frontend`   | Serves the production bundle on `http://localhost:4173`.        |
| `npm run lint`                       | Shared ESLint config, zero warnings allowed.                    |
| `npm run format:check`               | Prettier against `.prettierrc.json`.                            |

Optional local setup:

- `apps/frontend/.env.example` → copy to `.env` to change `GATEWAY_URL` (default `http://localhost:3000`). It is read by `vite.config.ts` only and never reaches the browser.
- `apps/frontend/public/fonts/licensed/`: drop `NewIconSerif-Regular.woff2`, `HelveticaNowDisplay-Medium.woff2` and `HelveticaNowDisplay-Bold.woff2` here to see the exact Figma typography. The folder is ignored by Git; without it the OFL fallbacks render.
- `apps/frontend/public/media/`: the paintings and the valiha track, also ignored by Git until D18. See [Media](#media).
- `http://localhost:5173/?motion=lab` (dev builds only): a panel to compare the three intros and three transitions and to force reduced motion.

## What the app shows

| Route                       | Screen                                                                                                                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                         | **Home.** The "salon": two framed paintings on an ivory wall, the headline, a description and two calls to action. Figma node `12:88`.               |
| `/musee/:room/:nn`          | **Gallery.** One room, one artwork in the spotlight, the wall text, the wall label, the room tabs and the artwork navigation. Figma node `114:3877`. |
| `/musee` and `/musee/:room` | Redirect to the first artwork of the room. Rooms without artworks render "Salle en préparation".                                                     |
| `/contribuer`               | Placeholder for "Déposer une œuvre" until the contribution flow (FE-03).                                                                             |
| anything else               | "Page introuvable".                                                                                                                                  |

Rooms: `peinture` (four works), `sculpture`, `savoir-faire` and `musique` (empty, with a slot for a 3D viewer, a stepped video and a player).

## Structure

```text
apps/frontend/
  index.html                    Entry HTML, favicon, French lang
  vite.config.ts                Vite, dev proxy, Vitest
  rules.md                      Rules for every change in this app
  media-sources.md              Source and license of each media file
  docs/                         This documentation
  public/
    fonts/ofl/                  Committed OFL fonts and their licenses
    fonts/licensed/             Local only: licensed fonts
    media/                      Local only: paintings and audio
  src/
    main.tsx                    Mounts <App /> and loads global styles
    app/                        App, route matching, the dev motion lab
    features/home/              Home page, its hooks and content
    features/gallery/           Gallery page, hooks, dialogs, data/rooms.ts
    features/contribute/        Placeholder page
    components/                 Reusable UI mirroring the Figma components
    lib/router/                 History-based router and <Link>
    lib/motion/                 GSAP setup, reduced motion, font waiting, variants
    lib/audio/                  Room ambience, off by default
    lib/media/                  The single manifest of media paths
    styles/                     tokens.css, fonts.css, global.css
    assets/                     Committed decor: scene, frame, spot, grain, icons
    test/                       Vitest setup and the motion helper
```

Naming: folders and non-component files in kebab-case, components and their files in PascalCase, one component per file, named exports.

## How it works

### Layout: the Figma stage

Both screens are laid out on the Figma stage of 1440×900 and fitted inside the viewport without scrolling. `tokens.css` defines `--u`, one Figma pixel: `min(100vw / 1440, 100dvh / 900)`. Page CSS positions elements as `calc(<figma px> * var(--u))`, so the composition keeps its proportions from 1024×768 to 2560×1440.

- Below 768 px wide, or on portrait screens (`max-aspect-ratio: 3/4`), the pages switch to a 390×844 stage with their own positions. No mobile mockup exists yet; the layout follows the brief in the task.
- Desktop screens lower than 760 px hide the two pottery objects and shrink the headline.
- In the gallery, `useScenePlacement` keeps the wall photograph aligned on the artwork at any size, scaling it around the Figma anchor until it covers the viewport.
- `html` and `body` have `overflow: hidden`. If content ever exceeds the viewport, that is a bug, not something to scroll to.

### Routing

`lib/router/router.ts` is a small store on the History API (`pushState` + `popstate`) read through `useSyncExternalStore`. `app/routes.ts` maps a pathname to a screen. `<Link>` renders a real `<a>`, keeps native behavior for modified clicks and new tabs, and accepts `beforeNavigate`, an async function played before the navigation. The home uses it for the exit transition.

### Motion

GSAP is imported from `lib/motion/gsap.ts`, which registers `useGSAP` and `SplitText`. Each choreography lives in a hook next to its page: `useHomeIntro`, `useHomeParallax`, `useHomeExit`, `useGalleryArrival`, `useArtworkSwap`. Targets are selected with `data-anim` (home) and `data-g` (gallery) attributes, never with CSS Module class names.

Three rules shape every sequence:

1. **Nothing appears before its animation.** Pages start with `data-motion="pending"`, the first frame of each element is set by GSAP, and `data-motion="done"` marks the end.
2. **Fonts first.** Headlines are split into lines only after `document.fonts` reports the fonts loaded, with a timeout so a missing local font never blocks the page.
3. **Reduced motion is a different choreography, not a shorter one.** `useReducedMotion()` switches every sequence to short fades and disables the parallax.

The exact timings, the three intro variants, the three exit variants and the gallery sequences are in [docs/motion.md](docs/motion.md).

### Sound

`lib/audio/ambience.ts` is a singleton shared by both screens. Sound is off until the visitor clicks the toggle or presses `M`; nothing ever autoplays. Fades run through a Web Audio `GainNode` (1.5 s in, 0.6 s out, 1.5 s crossfade between rooms). When a file is missing or the browser cannot decode it, the toggle reads "Son indisponible". The `SoundToggle` component exposes `aria-pressed` and `aria-keyshortcuts="M"`.

### Media

Every path to a cultural media file is declared once in `lib/media/media.ts`: `artworkImages`, `objectImages` and `audioTracks`. `MediaImage` renders a responsive `<img>` (`srcSet`, `sizes`, `object-position`) and shows a neutral labeled placeholder when the file is absent. Objects without a photograph are `null` in the manifest and their figures are hidden.

Cultural media is not committed until D18 clears its publication. Developers copy the files into `public/media/`; CI and reviewers see the missing-media state. Decor exported from Figma (wall, gilded frame, spot beams, grain, icons) is committed under `src/assets/` because the team holds its rights.

### Data

`features/gallery/data/rooms.ts` holds the four rooms and their artworks: number, title, artist, year, technique, dimensions, region, provenance, story, rights, image, alt text, optional focal point, `isDemo` and a `verification` status (`verified`, `unreviewed`, `uncertain`). It is a provisional view model to replace with the gateway's Content API in FE-03, and to align with papangoo's contract before that. `roomPath` and `artworkPath` build the URLs.

### Components

| Component     | Figma origin              | Notes                                                                             |
| ------------- | ------------------------- | --------------------------------------------------------------------------------- |
| `ButtonLink`  | Button, theme Light       | Primary with arrow, secondary outline. Always a link.                             |
| `NavLink`     | NavLink                   | Brass underline on hover and focus, light and dark themes, `aria-current`.        |
| `SoundToggle` | SoundToggle, Contrôle son | Light (home) and dark (gallery) themes, compact variant on mobile.                |
| `WoodFrame`   | Cadre, Bois noir          | Six CSS layers from the Figma moulding, scaled with `--u`. Any image fits inside. |
| `MediaImage`  | IMG · Œuvre slot          | Responsive image with a missing-media state.                                      |
| `Logo`        | Logo LOVA                 | Inline SVG in `currentColor`.                                                     |

Gallery-only parts live in `features/gallery/`: `GalleryDialog` (a `<dialog>` that traps focus, closes on Escape or outside click and returns focus), `ArtworkNotice` (the side panel) and `CloseUpViewer` (full-screen zoom and pan).

### Accessibility

- The home headline stays a real `h1`. SplitText adds `aria-label` on headings and leaves paragraphs readable line by line.
- Landmarks: `header`, `main`, `footer`, named `nav` and `section` elements. One `h1` per page.
- Keyboard: Tab order follows the layout, focus is a 3 px brass ring, `←`/`→` change artworks, Escape closes the open layer, `M` toggles sound.
- A visually hidden live region announces the current artwork.
- Icon-only buttons carry `aria-label` or a visually hidden label.

## Tests

`npm run test -w apps/frontend` runs Vitest in jsdom. Tests assert behavior through Testing Library roles and text:

- `app/routes.test.ts`: route matching and redirects.
- `app/App.test.tsx`: deep links, the home, not found.
- `features/home/HomePage.test.tsx`: hidden until the intro, headline, CTAs, figures and alt text, no autoplay.
- `features/gallery/GalleryPage.test.tsx`: counter and wall label, arrow keys, wrap-around, rapid clicks, notice with statuses, empty room, no autoplay.
- `features/gallery/useScenePlacement.test.ts`: Figma placement and viewport coverage.
- `components/sound-toggle/SoundToggle.test.tsx`: states, click, `M` key.
- `lib/audio/ambience.test.ts`: never plays until enabled, stops, reports unavailable files.

`src/test/setup.ts` stubs `matchMedia`, `document.fonts`, media playback and `<dialog>`. `src/test/motion.ts` exports `settleMotion()`, which lets pending font loads resolve and jumps every GSAP animation to its end, because content stays hidden until its animation runs.

Browser checks (viewports, timing, sound, reduced motion, Lighthouse) are manual for now and listed in [docs/verification.md](docs/verification.md).

## Troubleshooting

| Symptom                                      | Cause and fix                                                                                               |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Dark rectangles instead of paintings         | `public/media/` is empty. Copy the files listed in [media-sources.md](media-sources.md).                    |
| Headline or wall text in a fallback font     | `public/fonts/licensed/` is empty. The OFL fallbacks are expected in CI.                                    |
| "Son indisponible" after enabling sound      | The Ogg file is absent, or the browser is Safari, which does not decode Ogg Vorbis.                         |
| `/api/...` returns 502 in development        | No gateway runs on `GATEWAY_URL`. The frontend has no API calls yet; the proxy is ready for FE-03.          |
| Page content never appears                   | A GSAP timeline failed before setting `data-motion`. Check the console; `nullTargetWarn` is off on purpose. |
| Lighthouse mobile performance drops below 90 | Mobile audits apply a relative CPU slowdown; a loaded machine skews them. Re-run on an idle machine.        |

## Follow-ups

- Photographs of a vilany tany and a sinibe on a plain background, then set them in `objectImages`.
- An AAC or MP3 version of the valiha track for Safari, and a visible credits line for CC BY-SA media.
- Pick one intro and one transition in the motion lab, then remove `MotionLab` and the unused variants.
- FE-03: replace `data/rooms.ts` with the gateway's Content API through `lib/api/`.
- FE-05: the frontend Dockerfile and its entry in the root `docker-compose.yml`.
- Rooms 02–04: the 3D viewer, the stepped video and the player, in the `mediumSlot` of `GalleryPage`.
