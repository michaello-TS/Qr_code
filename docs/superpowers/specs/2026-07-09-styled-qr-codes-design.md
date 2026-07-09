# Styled QR Codes for the Admin Panel — Design

**Date:** 2026-07-09
**Status:** Approved by Michael (pending spec review)
**Approach:** Extend the panel's own canvas drawing (approach 1 of 3 — chosen over
bundling qr-code-styling, which cannot do multi-color artwork fill, and over
Python-side generation, which would defeat the self-serve panel).

## Goal

Clients ask for "prettier" QR codes than plain black/white squares. Add two
designer styles — chosen by Michael from machine-verified samples — to the
self-serve admin panel, so styled QRs need no Claude session:

- **Social gradient** — rounded "blob" modules, two-color gradient body,
  accent-colored corner eyes, optional center logo.
- **Artwork fill** — rounded modules painted from a flowing multi-color
  (3-stop diagonal) sweep, optional center logo.

Explicitly out of scope (for later, if ever): Flowcode-style circular ring
(first attempt not client-ready), halftone/photo QRs, CTA frames, two-tone
dots (Michael passed on these).

## UI changes (admin/index.html, create form + restyle flow)

- Replace the single "QR style" select with two selects:
  - **Style:** Classic (current look) / Social gradient / Artwork fill
  - **Logo:** none / each image in `logos/` / upload from device
  Any style combines with any logo.
- Choosing a gradient style reveals a **Palette** select: 6 presets
  (working names: Insta, Sunset, Ocean, Forest, Mall Red, Midnight) +
  **Custom**, which reveals color pickers (2 colors + eye accent for Social
  gradient; 3 stops for Artwork fill).
- **Live preview** canvas updates on every control change, before saving.
- The per-campaign "New logo QR" button becomes **"Restyle QR"** and offers
  the same Style/Logo/Palette controls. Replaces `qr-codes/qr-<slug>.png`;
  campaign URL unchanged (INVARIANT: QRs always point at the GitHub Pages
  campaign URL).
- Preset palettes get a browser sign-off from Michael during the build
  (house rule: visual checks need his eyes).

## Drawing engine (canvas, no new services)

- Blob modules: rounded corners only where orthogonal neighbors are light
  (port of qrcode's RoundedModuleDrawer behavior); ERROR_CORRECT_H always
  for styled QRs (logo may cover center).
- Gradients: native canvas gradients — radial 2-stop for Social gradient,
  diagonal 3-stop linear for Artwork fill — painted through the module
  pattern (modules as clip path).
- Eyes: Social gradient repaints the three 7×7-module finder corners in the
  accent color; Artwork fill leaves the eyes painted by the artwork sweep
  (matching the approved samples).
- Logo badge: identical geometry to today (logo ≈22% width on white rounded
  badge, alpha preserved).

## Scan-check safety net

- Bundle a QR-decoding JS library (jsQR, ~45KB) in `admin/` next to
  `qrcode.js` — self-hosted, no CDN at runtime.
- Every styled QR is decoded from the preview canvas before upload:
  - Decode OK → proceed.
  - Decode fails with **custom** colors → block the save; plain-English
    message ("These colors are too light for scanners — darken them").
  - Decode fails with a **preset** → should be impossible (each preset ×
    style × logo combination is cv2-verified by Claude during the build);
    if it happens, block and show the same message.
  - jsQR itself fails to load → styled saves fall back to presets only
    (customs blocked), classic style unaffected.

## Unchanged

- Redirect pages, meta-refresh INVARIANT, slug rules. Commit messages:
  creates keep `redirect: add <slug>`; restyles use a new format
  `redirect: restyle QR for <slug>` (CLAUDE.md commit table gets this row;
  `redirect: add logo QR for <slug>` remains for the legacy script).
- Shell/Python scripts remain as plain-style fallback.
- Token/share-link auth, change-destination flow.

## Done = these four checks pass

1. Create a campaign with Social gradient + logo via the panel; the PNG on
   GitHub machine-decodes (cv2) to the campaign URL.
2. Artwork fill with deliberately near-white custom colors is refused with
   the plain-English warning (the net must visibly FIRE, not just exist).
3. Restyle an existing campaign: image replaced, URL byte-identical.
4. Pre-existing features re-verified end-to-end (plain create, change
   destination, share link).

## Test/verification approach

Playwright E2E against a local server (same harness as the panel's original
build), plus cv2 decode of the uploaded PNGs via the GitHub API. Test
campaign slug: `test-style` (delete after, with Michael's OK).
