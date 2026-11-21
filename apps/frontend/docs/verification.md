# Verification checklist

What to check before a frontend PR, beyond the automated scripts. It mirrors the acceptance criteria of FE-02 and the [frontend rules](../rules.md). Record the commands and results in the PR, and mark anything you could not run as "not runnable yet".

## Automated

```sh
npm run test -w apps/frontend        # 33 tests
npm run typecheck -w apps/frontend
npm run build -w apps/frontend
npm run lint                         # zero warnings
npm run format:check
```

## In the browser

Use the production bundle (`npm run build -w apps/frontend && npm run preview -w apps/frontend`) and Chrome. Copy the local media and fonts first, or expect the missing-media placeholders.

### Layout

- [ ] No vertical or horizontal scroll at 390×844, 768×1024, 1024×768, 1280×720, 1366×768, 1440×900, 1920×1080 and 2560×1440, on `/` and `/musee/peinture/01`.
- [ ] At 1440×900 the home and the gallery match the Figma frames (nodes `12:88` and `114:3877`): positions, typography, frame and bar sizes.
- [ ] Desktop under 760 px high hides the pottery objects and shrinks the headline.
- [ ] Mobile keeps the two paintings on top, centres the headline and stacks the buttons at the bottom. The gallery shows the frame, the wall label under it, the room title, "Lire" and the bottom bar without overlap.

### Motion

- [ ] Home: nothing flashes before the intro. Buttons are clickable at about 1.4 s and the intro ends at about 2.2 s. Accents and the tops of the headline letters are not clipped by the line masks.
- [ ] Home → gallery: the elements leave, the wall turns black, then the room lights up from black. No white frame in between.
- [ ] Gallery: wall, spot, frame, then text line by line, then the wall label and bars. Controls work from about 1.2 s.
- [ ] Artwork change: nine fast clicks on "next" end on the right artwork, URL and counter, with the artwork fully visible.
- [ ] Room change: fade to black, new wall and text, same lighting sequence, progress dots move.
- [ ] Parallax follows the mouse only, never on touch, and stops during the exit.
- [ ] With `prefers-reduced-motion: reduce` (or the lab switch): only fades, no split lines, no transforms, no clip-paths, no parallax; the exit is a 0.4 s fade.

### Sound

- [ ] Nothing plays on load, on arrival in the gallery or on room change.
- [ ] Click or `M` enables sound with a fade; `aria-pressed` follows; the gallery label shows the track name while playing.
- [ ] A missing or undecodable file shows "Son indisponible" and never throws.

### Keyboard and assistive technology

- [ ] Tab reaches the logo, navigation, sound toggle, frames, buttons, wall label, room tabs, artwork arrows and "Observer de près", in that order, with a visible focus ring.
- [ ] `←` and `→` change artworks; Escape closes the notice and the close-up; focus returns to the control that opened them.
- [ ] The notice traps focus and shows the demo note and the verification status.
- [ ] The home `h1` and the room `h1` keep their full text as accessible names after the split.

### Console and performance

- [ ] No console errors or warnings on `/`, `/musee/peinture/01`, `/musee/sculpture`, the notice, the close-up and the transition.
- [ ] Lighthouse desktop: performance ≥ 90, accessibility ≥ 95 on both routes. Measured 99–100 / 100.
- [ ] Lighthouse mobile: same thresholds. Measured 91–94 / 100 on an idle machine. Mobile audits apply a relative CPU slowdown, so a loaded machine lowers the score; re-run when idle.

## Reference results, 2026-11-21

Node 22.23.5, Chrome, production bundle: 33 tests, typecheck, lint and build pass; 16 viewport checks without scroll; intro clickable at 1.39 s and done at 2.12 s; 0 `play()` calls without a click; reduced motion with fades only; transition brightness 0 → 31 from black; console empty; Lighthouse desktop 100/100 (home) and 99/100 (gallery), mobile 91–94/100 and 92/100.
