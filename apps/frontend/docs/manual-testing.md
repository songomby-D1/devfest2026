# Manual test guide

> Requested by rivon0507 on 2026-11-22 as a hands-on companion to the automated tests, written by Agent 3 with FE-03 ([#70](https://github.com/songomby-D1/devfest2026/issues/70)). Please review it as part of the pull request rather than dismissing it as an unrequested document.

This guide walks a tester through every screen of the frontend in a browser, in the order of the demo journey. The automated suites and the layout, motion and Lighthouse checks are in [verification.md](verification.md). This page covers what a person should click, type and expect.

Each step lists the action, then **Expect** with the result. If the result differs, note the URL, the browser, the viewport and any `Référence pour le support` value shown on the page.

## 1. Set up

Run everything from the repository root on Node 22.

| Mode                 | Command                                                                                                            | Use it for                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Mock (no backend)    | `VITE_API_MODE=mock npm run dev -w apps/frontend`                                                                  | Every screen and state, with fixtures. Data resets on page reload.                            |
| Gateway (real stack) | Start the stack per [scripts/demo/README.md](../../../scripts/demo/README.md), then `npm run dev -w apps/frontend` | The real journey through `/api` (Vite proxies it to `GATEWAY_URL`, default `localhost:3000`). |

Open `http://localhost:5173`.

Accounts:

| Mode    | Contributor                                                       | Reviewer                                                        | Owner of the published works |
| ------- | ----------------------------------------------------------------- | --------------------------------------------------------------- | ---------------------------- |
| Mock    | `contributrice@lova.test`                                         | `relecteur@lova.test`                                           | `collection@lova.test`       |
| Gateway | `mika.contributor@lova.test` (password in `scripts/demo/lib.mjs`) | `sedra.reviewer@lova.test` (password in `scripts/demo/lib.mjs`) | the seed's contributor       |

In mock mode, any password of 12 characters or more signs in a fixture account.

Optional: copy the paintings into `apps/frontend/public/media/` (see [media-sources.md](../media-sources.md)). Without them, the frames and the item pages show the neutral missing-media state. In mock mode this is expected.

## 2. Visitor (signed out)

### 2.1 Home `/`

1. Load the page. **Expect:** the ivory wall, the headline "L’art malagasy, à portée de regard.", and two framed paintings (in mock mode, "Femme malgache" and "Antongona"). They appear only through the intro animation. No sound plays.
2. Look at the header. **Expect:** room links, a "Se connecter" link and the sound toggle.
3. Press `M`, then press it again. **Expect:** the valiha ambience fades in, then out. In Safari: "Son indisponible".
4. Click a frame. **Expect:** the exit transition, then the gallery on that artwork (`/musee/peinture/01` or `/02`).
5. Optional, mock only: block `/api` in the devtools network panel and reload. **Expect:** after about 1.5 s the home opens without frames, and the rest works.

### 2.2 Gallery `/musee`

1. Open `/musee`. **Expect:** "Ouverture de la salle Peinture…" briefly, then a redirect to `/musee/peinture/01`.
2. Press `→` and `←`, or swipe on a phone. **Expect:** the artwork slides, the counter "Œuvre 02 / 04" and the URL follow, and the last artwork wraps to the first.
3. Click the wall label ("Lire la notice"). **Expect:** a side panel with Auteur, Technique, Période, Origine, the story, a **Relecture humaine** block with two separate lines (Objet, Description), each with an icon, a status and the reviewer's note, plus the rights and "Voir la fiche complète de l’œuvre". Nothing mentions automated or AI verification.
4. Check "Antongona" (02). **Expect:** Objet "Vérifié par un relecteur", Description "Incertain après relecture".
5. Click "Observer de près". **Expect:** full-screen zoom and pan. Escape closes it and focus returns to the button.
6. Use the room tabs: Sculpture, Savoir-faire, Musique. **Expect:** a fade to black between rooms. In mock mode, Sculpture holds "Aloalo sculpté", Savoir-faire holds "Lamba mena", and Musique shows "Salle en préparation" with the arrows and "Observer de près" disabled.
7. Open `/musee/peinture/99`. **Expect:** a redirect to `/musee/peinture/01`. Open `/musee/cuisine`. **Expect:** "Page introuvable".
8. Gateway mode with the stack stopped: open `/musee`. **Expect:** "Le musée est momentanément fermé", the message, a request reference when the gateway answered, and "Réessayer".

### 2.3 Item detail `/oeuvre/:id`

Open one from the notice link.

1. **Expect:** the media on the left (one column on a phone), then the title, author and period, the facts table ("Non renseigné" in italics for unknown values), the description, the two human review labels, the rights and the publication date.
2. **Expect:** no "Publication" or "Dépôt" badge and no "Signaux indicatifs" block for a visitor.
3. Provenance panel (FE-04). Mock mode: "Aloalo sculpté" shows a confirmed record, "Femme malgache" a failed one, "Lamba mena" none. **Expect:** no "Certifier" button for a visitor.
4. 3D panel (FE-04). Mock mode: "Aloalo sculpté" has a ready model (poster first, then 1K, an "HD" control, preset views). "Lamba mena" says the model is in preparation. "Femme malgache" shows no 3D panel.
5. Open `/oeuvre/6f1c2b0e-3a52-4c1e-9d0f-8a1b2c3d4e04` (a draft in mock mode) and `/oeuvre/abc`. **Expect:** the same "Œuvre introuvable" page for both, so drafts never leak.

### 2.4 The WebGL room `/visite`

1. Open `/visite`. **Expect:** the 3D museum room, or its fallback on a device without WebGL. This screen still uses its own content (`features/gallery-3d`), not the API.

### 2.5 Protected pages as a visitor

1. Open `/contribuer`, `/mes-depots` and `/revue`. **Expect:** a sign-in prompt with "Se connecter" and "Créer un compte" on each, never a blank page or a silent failure.

## 3. Account

1. Click "Se connecter" from `/contribuer`. **Expect:** `/connexion?retour=%2Fcontribuer`.
2. Submit empty. **Expect:** an error under each field, and focus stays on the form.
3. Use a wrong password (gateway mode) or an unknown email (mock). **Expect:** one generic message, "Adresse e-mail ou mot de passe incorrect.", and a small "Référence pour le support".
4. Sign in as the contributor. **Expect:** a return to `/contribuer`, with the display name, "Mes dépôts" and "Se déconnecter" in the header.
5. Gateway mode: in the devtools, check the `Set-Cookie` of `POST /api/auth/login`. It must be HTTP-only, and nothing may appear in `localStorage` or `sessionStorage` except the FE-04 mint key.
6. Sign out. **Expect:** a return to the home, signed out.
7. On `/inscription`, test an invalid email, a password under 12 characters, and a mismatched confirmation. **Expect:** one message per field. Then register a new address. **Expect:** signed in at once. In gateway mode, an existing address gives "Un compte existe déjà avec cette adresse e-mail."
8. Gateway mode: try `/connexion?retour=//evil.example`. **Expect:** after sign-in you land on `/`, never on another site.

## 4. Contributor

### 4.1 Submit `/contribuer`

1. Click "Enregistrer et ajouter les médias" with an empty form. **Expect:** errors for Titre, Type d’œuvre, Description, Déclaration de droits and the rights confirmation, with focus on the first one.
2. Fill in every field: title, type, description, author, community, technique, origin, period, rights statement. Tick the confirmation and submit. **Expect:** the URL becomes `/contribuer/<id>`, with the title, "Publication : Brouillon", "Dépôt : En relecture", the item ID, "Brouillon enregistré…", and both review lines at "Pas encore relu".

### 4.2 Add media `/contribuer/:id`

1. Read the hint. **Expect:** images JPEG, PNG or WebP up to 12 MB, videos MP4 or WebM up to 50 MB, 10 files per item, and the current count.
2. Choose a GIF or an SVG. The picker filters by type, so use "All files". **Expect:** "Format non accepté", and the send button stays disabled.
3. Choose an image over 12 MB. **Expect:** "Fichier trop lourd…".
4. Choose a valid JPEG, add a caption and send. **Expect:** a progress bar, then "« name » a été ajouté.", the image in the list, and the count goes up.
5. Gateway mode: rename a text file to `.jpg` and send it. **Expect:** the server refuses it (415, content does not match the format), with a reference. The draft stays and you can retry.
6. Gateway mode: stop the gateway during an upload. **Expect:** "L’envoi a échoué. Le brouillon est conservé…" and "Réessayer l’envoi".

### 4.3 My submissions `/mes-depots`

1. **Expect:** a card per item with "Dépôt", "Publication", "Relecture de l’objet" and "Relecture de la description". In mock mode: Valiha (En relecture, Brouillon), Sobika (Acceptée, Dépubliée), Sinibe (Renvoyée pour modification). Items of other accounts never appear.
2. A new account shows "Aucun dépôt pour le moment." and a link to submit.
3. With more than 20 items, "Afficher plus" loads the next page.
4. Open your draft through `/oeuvre/<id>`. **Expect:** the publication and submission badges, "Gérer les médias", and any advisory signals labelled as indicative ("ne modifient jamais un statut").

## 5. Reviewer

Sign in as the reviewer. **Expect:** a "Relecteur" badge and a "Relecture" link in the header.

1. `/revue`: **Expect:** only submissions in review (mock mode: Valiha, Lokanga, and your new draft). Signed in as the contributor, the page says it is reserved for reviewers.
2. Open Valiha. **Expect:** the media, the facts, the submitted description, the rights statement with a "Droits : confirmés" badge, the advisory signal, and the two review lines.
3. Choose "Publier" and save. **Expect:** a refusal saying both claims must be reviewed (422), with a reference.
4. In "Affirmations sur : objet", save without choosing. **Expect:** "Choisissez un résultat." and the required justification. Then choose "Vérifié", write a justification and two sources on two lines, and save. **Expect:** "Relecture « Objet » enregistrée.", Objet becomes "Vérifié par un relecteur" with your note and sources, and Description stays "Pas encore relu".
5. In "Affirmations sur : description", choose "Incertain", justify and save. **Expect:** Description becomes "Incertain après relecture".
6. Publish. **Expect:** "Publication : Publiée ; dépôt : Acceptée". Sign out and open the gallery. **Expect:** the item hangs in its room (Valiha is an `object`, so it goes to Savoir-faire) and opens for a visitor.
7. On another item in review, choose "Renvoyer pour modification" without a note. **Expect:** the note is required. Add a note and save. **Expect:** "Renvoyée pour modification", and the item leaves the queue.
8. Open Lokanga, the reviewer's own submission in mock mode. **Expect:** "un autre relecteur doit la relire" and no review forms. In gateway mode, a reviewer who reviews their own item gets a 403 from the service, shown as "Action refusée…".

## 6. Owner and NFT (FE-04)

1. Mock mode: sign in as `collection@lova.test`, then open "Lamba mena". **Expect:** "Certifier sur la blockchain". Start it. **Expect:** pending, with the button disabled and polling, then confirmed with the chain, token and transaction. Clicking again never creates a second mint.
2. Gateway mode: follow the NFT checks of [scripts/demo/README.md](../../../scripts/demo/README.md) and compare with the panel.

## 7. Cross-cutting checks

- **Keyboard:** tab through each form. Every field has a visible label and a gold focus ring, and errors sit next to their field. In the gallery, `←`/`→` change artworks, Escape closes dialogs, and `M` toggles the sound.
- **Screen reader:** the review block is announced as "Relecture humaine". Loading and success messages are live regions, and errors are alerts.
- **Reduced motion:** turn on "Reduce motion" in the OS, or use `/?motion=lab` in a dev build. **Expect:** short fades instead of the choreography.
- **Phone (390×844):** the home and the gallery fit without scrolling; the form, item and review pages scroll in one column with large tap targets.
- **Errors never leak internals:** with the gateway stopped or failing, pages show a short French message and at most a reference, never a stack trace or raw JSON.
- **Console:** no errors or warnings during the journey, apart from missing local media in mock mode.

## Known gaps

- A contributor cannot read the reviewer's return or reject note: `ItemDetail` carries no decision note.
- A returned item cannot be edited from the UI: there is no gateway edit route.
- Contributor videos have no caption track.
- The account, contribution, item and review screens have no Figma frame yet; their layout is provisional until Sesedra reviews it.
