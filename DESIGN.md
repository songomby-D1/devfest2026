# DESIGN.md · LOVA

The visual system of LOVA, taken from the current landing page (the DevFest 2026 brand site). Use it to keep every new screen, slide or asset in the same language. Values are exact: they come from the landing's stylesheet and shaders.

## 1. Visual theme and atmosphere

- A museum that feels like a launch site. Large uppercase titles, a strict three-column grid with visible guides, and a pixel-font HUD frame the page like an instrument.
- Light, airy daylight sections (paper background, pale sky) alternate with dark gallery sections where real works are lit by a warm spotlight.
- Volume and play come from inflated, glossy 3D shapes (the word "lova" as a tube, the extruded logo), hand-drawn stickers and a final "light speed" warp.
- Heritage first: real Malagasy works and real craft photographs, credited under each image. No people in craft photos. Visuals are made in code, CSS and SVG; sound is synthesised.
- Tone: confident, warm, precise. One accent colour (lime) does all the pointing.

## 2. Colour palette and roles

### Core

| Token          | Value                   | Role                                                    |
| -------------- | ----------------------- | ------------------------------------------------------- |
| `--bg` (light) | `#FBFAF4` paper         | Page background                                         |
| `--bg-elev`    | `#EFEDE7`               | Raised surfaces, form fields                            |
| `--l1`         | `#000000`               | Primary text, logo, header and HUD                      |
| `--l2`         | `rgba(54, 54, 48, .6)`  | Secondary text, captions                                |
| `--l3`         | `rgba(54, 54, 48, .32)` | Tertiary text, disabled                                 |
| `--l4`         | `rgba(54, 54, 48, .18)` | Faint marks                                             |
| `--line`       | `rgba(54, 54, 48, .12)` | Grid guides, dividers                                   |
| `--lime`       | `#C0FE04`               | The only accent: CTAs, progress, focus, selection, tags |
| Muted label    | `#6B6B63`               | Small field labels and hints                            |
| Ink on dark    | `rgb(243, 239, 230)`    | Text in dark sections, at 1, .78, .6, .45 and .38       |

### Dark theme (`prefers-color-scheme: dark` or `data-theme="dark"`)

| Token       | Value                     |
| ----------- | ------------------------- |
| `--bg`      | `#0F1111`                 |
| `--bg-elev` | `#191B1B`                 |
| `--l1`      | `#FFFFFF`                 |
| `--l2`      | `rgba(230, 232, 232, .6)` |
| `--line`    | `rgba(230, 232, 232, .1)` |

### Section grounds

| Section          | Background                        | Notes                                                        |
| ---------------- | --------------------------------- | ------------------------------------------------------------ |
| Hero and CTA sky | `#CCE6F6` bottom to `#B8DAF1` top | Shader sky crossed by warm light trails                      |
| Gallery ("art")  | `#0D0C0B`                         | Warm spotlight `rgba(255, 232, 190, .11)` follows the cursor |
| Craft loop       | `#1F2A5C` indigo                  | Ink on dark text                                             |
| Warp             | `#000000`                         | Header and HUD switch to white (`html.zone-dark`)            |

### Lamba palette (illustration, stickers, data)

Taken from Malagasy textiles. Use for illustration and small marks, never for body text or CTAs.

| Name       | Value     |
| ---------- | --------- |
| Indigo     | `#1F2A5C` |
| Terracotta | `#B4472A` |
| Ochre      | `#D99A2B` |
| Green      | `#6C8F4E` |
| Sand       | `#E9DCC0` |
| Wood       | `#3B2A20` |

Sticker accents: orange `#FF5A1F`, lavender `#C9C6FF`, yellow `#F6D43C`, blue `#3D7CF0`, sky `#7FD3FF`, amber `#F2B33D`.

## 3. Typography

Three open-licence families (OFL), self-hosted in WOFF2.

| Family                 | Use                                      | Settings                                                                     |
| ---------------------- | ---------------------------------------- | ---------------------------------------------------------------------------- |
| TikTok Sans (variable) | Titles and body                          | Weight 300–900, width 75–150 %. Titles use weight 700, `wdth` 120, uppercase |
| Departure Mono         | Header nav, HUD, tags, ticks, CTA labels | 400, uppercase, 16/24 (12/16 small)                                          |
| Geist Mono (variable)  | Metadata, numbers, technical labels      | 16/24, 14/20 in cards                                                        |

| Style           | Size                        | Line height | Weight | Notes                                  |
| --------------- | --------------------------- | ----------- | ------ | -------------------------------------- |
| Hero title      | `5.6vw` (`10.4vw` mobile)   | 1           | 700    | Uppercase, `wdth` 120, `-.005em`       |
| Ghost word      | `17vw`                      | 1           | 800    | `wdth` 150, outline only (1 px stroke) |
| Section title   | `clamp(32px, 3.6vw, 56px)`  | 1           | 700    | Uppercase, `wdth` 120                  |
| Statement       | `4.2vw`                     | 1           | 400    | `-.012em`                              |
| Lead            | `clamp(20px, 2.34vw, 30px)` | 1.25        | 500    |                                        |
| Body            | 16px                        | 24px        | 400    |                                        |
| Small body      | 14px                        | 20px        | 400    | `--l2`, max 36–60 ch                   |
| Caption, credit | 12px / 11px                 | 16px        | 400    | `--l2` or ink .45                      |
| Pixel label     | 16px (12px small)           | 24px (16px) | 400    | Departure Mono, uppercase              |

Rules: titles are short, uppercase and broken by hand into lines. Pixel type is for interface chrome only, never for reading text.

## 4. Component styling

- **Header**: fixed, transparent, 36px from the top, logo (symbol 40px plus wordmark, uppercase, `wdth` 120) on the left, pixel-font links spaced 32px on the right. Link hover draws a 1px underline from the left. Below 760px, a two-bar burger opens a full-screen menu with 32–72px uppercase links that rise in one by one.
- **HUD**: fixed bottom bar, 36px from the bottom, on the same three columns: clock or copyright on the left, tabular numbers in the middle, context on the right. Pixel font, uppercase, `--chrome` colour.
- **Grid guides**: fixed overlay of the three column lines plus two horizontal lines at 33.2 and 68.7 % of the viewport height, with small crosses at intersections, in `--chrome-line`.
- **Primary CTA**: lime pill (`border-radius: 99px`, `padding: 12px 20px`), black pixel-font uppercase label. Hover lifts by 2px and tilts −2°.
- **Inline tag**: lime block, black pixel text 12/16, 4px horizontal padding.
- **Artwork card (gallery)**: the work in a frame with a deep shadow `0 50px 90px -30px rgba(0,0,0,.85)` and a 1px ink outline at .06. Beside it: number in lime (12px), uppercase title, description at ink .78, a definition list separated by a 1px rule at ink .14, and the credit at 11px.
- **Progress axis**: 1px line at ink .18, lime fill 3px high that scales from the left, pixel-font ticks 12/16 at ink .38.
- **UI mock cards**: paper or `#EFEDE7` fields with 8px radius, 11px uppercase labels in `#6B6B63`, black pill buttons with white text, 8px status dots, a black token card with 16px radius for the certificate.
- **Stickers**: hand-drawn SVG shapes in the lamba and sticker colours, draggable, slightly rotated. Hidden on small screens when they crowd the content.
- **Loader**: the logo symbol at 96px, filled from bottom to top as the page loads, over the page background.

## 5. Layout principles

- Three equal columns: `grid-template-columns: repeat(3, minmax(0, 1fr))`, side margin `--m: clamp(16px, 4.36vw, 72px)`, text inset `--pad: 8px` inside each column.
- Content snaps to column edges; titles start at `--m + --pad`. Headlines sit low in full-height sections, notes sit high (104px from the top).
- Full-height sections (`100svh`) with sticky stages for horizontal scrolling sequences (the gallery frieze moves sideways while the page scrolls).
- Generous empty space: one idea per screen, 12vw between gallery pieces.
- Spacing steps used: 4, 8, 12, 16, 20, 24, 32px.

## 6. Depth and elevation

- Flat interface, deep artworks: UI stays on flat colour with 1px rules. Depth goes to the works (framed, spotlit, long soft shadow) and to the 3D hero shapes.
- 3D material is "balloon": glossy, inflated, lit by a warm key light against the pale sky. Keep neutral tone mapping so the blue does not drift to violet.
- Radii: 99px for pills and chips, 16px for large cards, 8–12px for fields and small cards, 50 % for dots and portholes.

## 7. Motion

- Easing: `--ease: cubic-bezier(.22, 1, .36, 1)` for entries, `--ease-io: cubic-bezier(.65, 0, .35, 1)` for scrubbing.
- Titles reveal line by line from below (1.2s, 80ms stagger). Paragraphs fade and rise 12px. Smooth scrolling drives the frieze, the reel and the warp.
- `prefers-reduced-motion: reduce` turns every animation and transition into an instant change. A page without WebGL keeps its content and drops the 3D.

## 8. Do's and don'ts

Do:

- Use lime for one thing per screen: the action or the current position.
- Show real works with their credit line under each image.
- Keep titles uppercase, wide and short; keep body text sentence case.
- Align everything to the three columns and the `--m` margin.

Don't:

- Add a second accent colour to interface elements, or use the lamba palette for text.
- Use the pixel font for paragraphs, or uppercase for long text.
- Add rounded drop-shadow cards around interface text.
- Use stock photos, AI images, or photos of people in craft scenes.
- Change the logo's shape: only its colour changes (one flat colour per file).

## 9. Responsive behaviour

| Breakpoint  | Changes                                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| ≤ 1024px    | Tighter spacing, same three columns                                                                                                        |
| ≤ 760px     | Burger menu, hero title at `10.4vw`, big text `clamp(26px, 7.4vw, 40px)`, HUD in one column at 13px, CTA row stacked, some stickers hidden |
| Dark scheme | Paper becomes `#0F1111`, text white; dark sections stay as they are                                                                        |

Touch targets stay at least 24px high, focus is a 2px lime outline with a 3px offset, and text selection is lime on black.

## 10. Agent prompt guide

When building a LOVA screen, start from this checklist:

1. Paper `#FBFAF4` background, black text, three-column grid with `clamp(16px, 4.36vw, 72px)` margins.
2. One uppercase TikTok Sans title at weight 700 and width 120; body in TikTok Sans 16/24.
3. Interface labels, navigation and tags in Departure Mono, uppercase.
4. A single lime `#C0FE04` pill for the main action.
5. Artworks on a dark `#0D0C0B` ground with a warm spotlight, a frame, a long soft shadow and a credit line.
6. Respect reduced motion, keep focus visible, and never invent people or artworks.

Example prompt: "A LOVA collection page: paper background, three-column grid, an uppercase wide title 'Mémoire du bois' at the bottom left of a full-height intro, a dark gallery band below with framed sculptures lit by a warm spotlight, lime pill 'Entrer dans la salle', pixel-font HUD showing 'Salle 02 / 04'."
