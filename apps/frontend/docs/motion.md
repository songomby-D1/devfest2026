# Motion reference

Every choreography of the frontend, with its timings, so they can be tuned without reading the hooks. Durations are in seconds from the start of the sequence. Easings are GSAP names. The intent throughout is a museum being hung: calm, precise, never spectacular.

Shared mechanics are in [`src/lib/motion/`](../src/lib/motion/):

- `gsap.ts` registers `useGSAP` and `SplitText` and turns `nullTargetWarn` off, because rooms render optional elements.
- `reduced-motion.ts` reads `prefers-reduced-motion`; the motion lab can force it.
- `fonts.ts` resolves when the given fonts load, or after 1.2 s.
- `motion-prefs.ts` stores the intro and transition variants chosen in the lab (`localStorage`, dev builds only).
- `arrival.ts` passes the exit variant from the home to the gallery, so the gallery can continue it.

## Home intro (`useHomeIntro`)

Waits for New Icon Serif and Helvetica Now Display, splits the headline into three masked lines, then plays one of three variants. Buttons receive pointer events at `clickable`. Measured in Chrome: controls usable 1.39 s after start, sequence done at 2.12 s.

| Step                   | hanging (default) | light       | focus       | Tween                                                                                       |
| ---------------------- | ----------------- | ----------- | ----------- | ------------------------------------------------------------------------------------------- |
| Gallery light rises    | —                 | 0.05        | —           | `[data-anim="dim"]` 1 → 0 over 1.1 s, power2.inOut                                          |
| Navigation             | 0.00              | 0.30        | 0.00        | opacity 0 → 1, y −12 → 0, 0.7 s, power2.out                                                 |
| Headline lines         | 0.15              | 0.45        | 0.15        | yPercent 130 → 0, 1.1 s, expo.out, stagger 0.12                                             |
| Left frame, then right | 0.60 / 0.85       | 0.80 / 1.05 | 0.45 / 0.70 | clip-path inset(100% 0 0 0) → 0, 1.1 s, power4.out; image scale 1.14 → 1, 1.3 s, power3.out |
| Objects                | 0.90 (+0.12 each) | 1.05        | 0.20        | opacity 0 → 1, y −16 → 0, 0.9 s, power3.out; contact shadow scaleX 0.6 → 1                  |
| Description            | 1.20              | 1.40        | 1.20        | opacity 0 → 1, y 10 → 0, 0.8 s, expo.out                                                    |
| Buttons                | 1.30              | 1.50        | 1.30        | opacity 0 → 1, y 10 → 0, 0.7 s, expo.out, stagger 0.1                                       |
| Clickable              | 1.40              | 1.60        | 1.40        | `pointer-events: auto` on the CTA group                                                     |

`focus` adds `filter: blur(10px) → 0` and `scale 1.03 → 1` on the frames and objects, so the scene pulls focus from the foreground to the frames.

Headline masks: SplitText wraps each line in a mask with `overflow: clip`. `HomePage.module.css` gives the masks headroom (`padding: 0.25em 0.08em 0.15em` with matching negative margins) so accents and hairline tops are not clipped. Lines therefore start at 130 % and leave at −150 %.

Reduced motion: the whole page fades in over 0.4 s. No split, no transforms.

## Home parallax (`useHomeParallax`)

Active after the intro, mouse only (`(hover: hover) and (pointer: fine)` and `pointerType === 'mouse'`). Each exhibit moves up to 20 px horizontally and 14 px vertically, multiplied by its `depth` (0.45 to 1), through `gsap.quickTo` with 0.9 s power3.out smoothing. Only the `[data-parallax]` layers move, so the intro and exit transforms on the figure are never overwritten. Disabled under reduced motion and during the exit.

## Home exit (`useHomeExit`)

Played by `beforeNavigate` on "Entrer dans le musée", the navigation links and the frames. Repeated clicks reuse the running exit. Each variant ends on black, and `markArrival` tells the gallery which one played.

| Variant                 | Sequence                                                                                                                                                                                                                                                                                     | Length         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| gallery-black (default) | Left exhibits slide to x = −50 vw and right ones to +50 vw while fading, 0.85 s, power3.in, stagger 0.06. Headline lines rise to −150 % from 0.05 s, 0.6 s, expo.in, stagger 0.05. Nav, description and buttons fade in 0.35 s. The blackout fades in from 0.42 s over 0.55 s, power2.inOut. | ≈1.0 s         |
| through-frame           | Everything but the left painting fades in 0.4 s. The painting translates to the viewport centre and scales to cover it ×1.08, 1.05 s, power4.inOut. The blackout fades in from 0.7 s over 0.4 s.                                                                                             | ≈1.1 s         |
| curtain                 | The blackout starts below the viewport and rises to cover it, 0.8 s, power4.inOut, while the headline rises. The gallery then continues the same panel upward over 1.1 s to reveal the room.                                                                                                 | ≈0.8 s + 1.1 s |

Reduced motion: the blackout fades in over 0.4 s, nothing moves.

## Gallery arrival (`useGalleryArrival`)

Runs on the first mount and again after each room change. Everything in the room starts hidden in the same frame, before anything paints. Phase 1 does not wait for fonts; phase 2 starts at `max(0.95, fonts loaded)`. Measured: the room is interactive from about 1.2 s.

| Phase | Time     | Step                                                                                      |
| ----- | -------- | ----------------------------------------------------------------------------------------- |
| 1     | 0.00     | Wall photograph fades in, 0.9 s, power2.out                                               |
| 1     | 0.45     | Spot warms up like a lamp: to 0.55 in 0.22 s, dips to 0.38 in 0.08 s, then to 1 in 0.7 s  |
| 1     | 0.75     | Frame and artwork (or the placeholder) fade in with scale 0.985 → 1, 0.9 s, power3.out    |
| 2     | T = 0.95 | Wall label fades in with y 8 → 0, 0.6 s, expo.out                                         |
| 2     | T + 0.05 | Title lines rise from 125 %, 1 s, expo.out, stagger 0.1                                   |
| 2     | T + 0.10 | Top bar fades in with y −10 → 0 (first arrival only)                                      |
| 2     | T + 0.15 | Bottom bar fades in with y 10 → 0 (first arrival only)                                    |
| 2     | T + 0.25 | Subtitle line rises, 0.9 s; the wall label card fades in with y 10 → 0, 0.7 s, power3.out |
| 2     | T + 0.35 | Paragraph lines rise, 0.8 s, stagger 0.035; the mobile "Lire" button fades in             |

`arrival === 'curtain'` adds the continuation of the home curtain from 0.05 s. Reduced motion: one 0.4 s fade of the whole room.

Room change: `leaveRoom` completes the running arrival, fades the room to black in 0.45 s (0.25 s reduced), swaps the room data and the audio track, then the arrival plays again without the bars. The progress dots animate in CSS (`width` and color, 400 ms).

## Artwork change (`useArtworkSwap`)

Triggered when the URL changes within a room. `direction` is +1 forward, −1 backward, computed as the shortest way around.

| Time | Step                                                                     |
| ---- | ------------------------------------------------------------------------ |
| 0.00 | Spot dims to 0.35, 0.3 s, power2.in                                      |
| 0.00 | Outgoing artwork slides 28 px against the direction and fades, 0.32 s    |
| 0.00 | Wall label card fades out, 0.25 s                                        |
| 0.32 | The shown artwork index is swapped                                       |
| 0.32 | Incoming artwork arrives from 28 px on the other side, 0.5 s, power3.out |
| 0.32 | Spot returns to 1, 0.5 s                                                 |
| 0.42 | Wall label card fades in with y 6 → 0, 0.4 s                             |

A click during the swap jumps the running timeline to its end (`progress(1).kill()`) and starts the next one from the settled state, so nine fast clicks end on the right artwork with the right counter. Reduced motion: 0.18 s fade out, swap, 0.22 s fade in.

## Dialogs (`GalleryDialog`)

The notice slides in from the right (`xPercent 100 → 0`, 0.5 s, power3.out) and out in 0.35 s, power3.in. Mobile sheets slide from the bottom. The close-up viewer fades. Reduced motion: 0.2 s fades. Escape, the close button and a click on the backdrop all close the layer, and focus returns to the control that opened it.

## Hover and focus (CSS)

- Home exhibits: the inner `.lift` layer rises 6 px, the frame shadow deepens (`--shadow-wall-raised`), the cartel fades in with a 4 px rise. 200 ms, `--ease-out`.
- Gallery wall label: rises 4 px, shadow deepens, "Lire la notice" underlines.
- Buttons: 200 ms background and arrow transitions. Focus is a 3 px brass ring (`--focus-ring`).
- Under `prefers-reduced-motion`, the hover transforms are removed and transitions collapse to 0.01 ms.

## Motion lab

In dev builds, `/?motion=lab` mounts `MotionLab`: radios for the intro and the transition, a reduced-motion switch and a replay button. Choices persist in `localStorage` under `lova.motion-lab`. Production builds ignore the lab and use `hanging` and `gallery-black`. Once a pair is chosen, remove `MotionLab`, `motion-prefs.ts` and the unused branches in `useHomeIntro` and `useHomeExit`.
