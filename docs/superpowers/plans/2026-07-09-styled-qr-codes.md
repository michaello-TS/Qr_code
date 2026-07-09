# Styled QR Codes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Social gradient and Artwork fill QR styles (with palettes, live preview, and a scan-check safety net) to the self-serve admin panel.

**Architecture:** New `admin/qr-styles.js` holds the drawing engine (neighbor-aware rounded "blob" modules, canvas gradients, eye repaint, logo badge) and the jsQR-based scan check. `admin/index.html` swaps its square-only `makeQrCanvas` for the engine, grows Style/Palette controls with live preview, and renames "New logo QR" to "Restyle QR". No server, no CDN at runtime — jsQR is bundled in-repo like `qrcode.js`.

**Tech Stack:** Vanilla JS + canvas, qrcode-generator (already bundled), jsQR (to bundle), GitHub Contents API (existing), Playwright + Python cv2 for verification.

## Global Constraints

- INVARIANT: QR codes point to GitHub Pages campaign URLs (`https://michaello-ts.github.io/Qr_code/<slug>/`), never final destinations.
- INVARIANT: campaign `index.html` uses meta refresh (never JS-only redirect).
- Styled QRs always use error correction `'H'`; classic uses `'M'` (or `'H'` when a logo is added) — matches current behavior.
- Logo badge geometry: logo ≈22% of QR width on a white rounded badge, pad `max(6, target*0.16)`, badge corner radius `0.22 × min(badge w,h)` — identical to `make-logo-qr.py`.
- Commit messages: create = `redirect: add <slug>`; restyle = `redirect: restyle QR for <slug>`.
- All new UI copy in plain English (Michael is a non-programmer); scan-fail message exactly: `These colors are too light for scanners — darken them.`
- No CDN/script requests at runtime; every JS file lives in `admin/`.
- The local test server runs `python3 -m http.server 8741` from the repo root; the panel is at `http://localhost:8741/admin/`.
- cv2 decode is the ground-truth scanner in every verification step: `cv2.QRCodeDetector().detectAndDecode()` must return the exact campaign URL.

---

### Task 1: Drawing engine + scan check (`admin/qr-styles.js`)

**Files:**
- Create: `admin/qr-styles.js`
- Create: `admin/jsQR.js` (vendored library)
- Modify: `admin/index.html` (add two `<script>` tags only)
- Test: `<scratchpad>/verify_styles.py` (not committed)

**Interfaces:**
- Consumes: global `qrcode(typeNumber, ecLevel)` from `admin/qrcode.js`; global `jsQR(data, w, h)` from `admin/jsQR.js`.
- Produces (globals used by Task 2):
  - `QR_PALETTES` — `{ social: [{id, name, body:[hex,hex], eye:hex}...6], artwork: [{id, name, stops:[hex,hex,hex]}...6] }`
  - `drawStyledQr(url, styleId, palette, logoImg)` → `HTMLCanvasElement`; `styleId` ∈ `'classic'|'social'|'artwork'`; `palette` is one `QR_PALETTES` entry (or same-shaped custom object; `null` for classic); `logoImg` is an `Image` or `null`.
  - `scanCheck(canvas)` → decoded string, or `false` if undecodable/jsQR missing.

- [ ] **Step 1: Vendor jsQR**

```bash
curl -sL https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js -o "/Volumes/Mic Backup/ClaudeProjects/Qr_code/admin/jsQR.js"
head -3 "/Volumes/Mic Backup/ClaudeProjects/Qr_code/admin/jsQR.js"
```
Expected: file ~250KB, header mentions jsQR. Then in `admin/index.html`, directly under `<script src="qrcode.js"></script>` add:

```html
<script src="jsQR.js"></script>
<script src="qr-styles.js"></script>
```

- [ ] **Step 2: Write the failing test** — create `<scratchpad>/verify_styles.py`:

```python
#!/usr/bin/env python3
"""Ground-truth check: every style x palette (x logo) drawn by the panel's
engine must decode (cv2) to the exact URL. Run with the local server up and
a Playwright page on http://localhost:8741/admin/ — driven via the MCP
browser from the session; this file only decodes what the browser saved."""
import base64, glob, sys, cv2

URL = "https://michaello-ts.github.io/Qr_code/henderson-summer2026/"
fails = []
for p in sorted(glob.glob("engine-*.png")):
    data, _, _ = cv2.QRCodeDetector().detectAndDecode(cv2.imread(p))
    ok = data == URL
    print(f"{p:40s} {'OK' if ok else 'FAIL -> ' + repr(data[:40])}")
    if not ok:
        fails.append(p)
sys.exit(1 if fails else 0)
```

- [ ] **Step 3: Run it to make sure it fails**

With no `engine-*.png` files present: `cd <scratchpad> && python3 verify_styles.py`
Expected: exits 0 with no output lines — so first prove the *pipeline* fails correctly: in the browser run `typeof drawStyledQr` → Expected: `"undefined"` (engine doesn't exist yet).

- [ ] **Step 4: Implement `admin/qr-styles.js`**

```js
'use strict';
// Styled QR drawing engine for the admin panel.
// Recipes approved 2026-07-09 (spec: docs/superpowers/specs/2026-07-09-styled-qr-codes-design.md).

const QR_PALETTES = {
  social: [ // body: radial gradient [center, edge]; eye: accent for finder corners
    { id: 'insta',    name: 'Insta',    body: ['#833AB4', '#E1306C'], eye: '#C05010' },
    { id: 'sunset',   name: 'Sunset',   body: ['#A81D5B', '#E8590C'], eye: '#7A0F3C' },
    { id: 'ocean',    name: 'Ocean',    body: ['#172A5C', '#0D6E6E'], eye: '#1971C2' },
    { id: 'forest',   name: 'Forest',   body: ['#14532D', '#3F6212'], eye: '#92400E' },
    { id: 'mallred',  name: 'Mall Red', body: ['#C8102E', '#7A0619'], eye: '#1F1F1F' },
    { id: 'midnight', name: 'Midnight', body: ['#1E1B4B', '#4C1D95'], eye: '#9D174D' },
  ],
  artwork: [ // stops: 3-stop diagonal sweep, eyes painted by the sweep
    { id: 'insta',    name: 'Insta',    stops: ['#833AB4', '#C13584', '#E8590C'] },
    { id: 'sunset',   name: 'Sunset',   stops: ['#A81222', '#C2661A', '#086A6A'] },
    { id: 'ocean',    name: 'Ocean',    stops: ['#0B2559', '#0D6E6E', '#14532D'] },
    { id: 'forest',   name: 'Forest',   stops: ['#14532D', '#3F6212', '#92400E'] },
    { id: 'mallred',  name: 'Mall Red', stops: ['#7A0619', '#C8102E', '#4A044E'] },
    { id: 'midnight', name: 'Midnight', stops: ['#1E1B4B', '#4C1D95', '#9D174D'] },
  ],
};

function drawStyledQr(url, styleId, palette, logoImg) {
  const ec = (styleId === 'classic' && !logoImg) ? 'M' : 'H';
  const qr = qrcode(0, ec);
  qr.addData(url);
  qr.make();
  const n = qr.getModuleCount(), box = 10, border = 4;
  const size = (n + border * 2) * box;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);

  const dark = (r, col) => r >= 0 && col >= 0 && r < n && col < n && qr.isDark(r, col);
  const inEye = (r, col) => (r < 7 && col < 7) || (r < 7 && col >= n - 7) || (r >= n - 7 && col < 7);

  if (styleId === 'classic') {
    ctx.fillStyle = '#000';
    for (let r = 0; r < n; r++)
      for (let col = 0; col < n; col++)
        if (dark(r, col)) ctx.fillRect((border + col) * box, (border + r) * box, box, box);
  } else {
    // Neighbor-aware "blob" modules: a corner is rounded only when both
    // orthogonal neighbors on that corner are light (port of Python's
    // RoundedModuleDrawer look).
    const blobPath = (filter) => {
      const p = new Path2D(), rad = box / 2;
      for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) {
        if (!dark(r, col) || !filter(r, col)) continue;
        const x = (border + col) * box, y = (border + r) * box;
        const up = dark(r - 1, col), down = dark(r + 1, col),
              left = dark(r, col - 1), right = dark(r, col + 1);
        p.roundRect(x, y, box, box, [
          (!up && !left) ? rad : 0, (!up && !right) ? rad : 0,
          (!down && !right) ? rad : 0, (!down && !left) ? rad : 0,
        ]);
      }
      return p;
    };
    let bodyFill;
    if (styleId === 'social') {
      bodyFill = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.72);
      bodyFill.addColorStop(0, palette.body[0]);
      bodyFill.addColorStop(1, palette.body[1]);
      ctx.fillStyle = bodyFill;
      ctx.fill(blobPath((r, col) => !inEye(r, col)));
      ctx.fillStyle = palette.eye;
      ctx.fill(blobPath(inEye));
    } else { // artwork: one 3-stop diagonal sweep over everything, eyes included
      bodyFill = ctx.createLinearGradient(0, 0, size, size);
      bodyFill.addColorStop(0, palette.stops[0]);
      bodyFill.addColorStop(0.5, palette.stops[1]);
      bodyFill.addColorStop(1, palette.stops[2]);
      ctx.fillStyle = bodyFill;
      ctx.fill(blobPath(() => true));
    }
  }

  if (logoImg) {
    const target = Math.floor(size * 0.22);
    const scale = Math.min(target / logoImg.width, target / logoImg.height, 1);
    const lw = Math.round(logoImg.width * scale), lh = Math.round(logoImg.height * scale);
    const pad = Math.max(6, Math.round(target * 0.16));
    const bw = lw + pad * 2, bh = lh + pad * 2;
    const bx = (size - bw) / 2, by = (size - bh) / 2;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, Math.round(Math.min(bw, bh) * 0.22));
    ctx.fill();
    ctx.drawImage(logoImg, bx + pad, by + pad, lw, lh);
  }
  return c;
}

function scanCheck(canvas) {
  if (typeof jsQR !== 'function') return false;
  const ctx = canvas.getContext('2d');
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const res = jsQR(d.data, d.width, d.height);
  return res ? res.data : false;
}
```

- [ ] **Step 5: Export every style × palette from the real page and decode**

Serve repo root on :8741, open `http://localhost:8741/admin/` in the MCP browser, then evaluate:

```js
async () => {
  const url = 'https://michaello-ts.github.io/Qr_code/henderson-summer2026/';
  const out = {};
  const logo = await new Promise((res, rej) => {
    const i = new Image(); i.onload = () => res(i); i.onerror = rej;
    i.src = '../logos/instagram.png';
  });
  for (const style of ['social', 'artwork'])
    for (const p of QR_PALETTES[style]) {
      out[`engine-${style}-${p.id}`] = drawStyledQr(url, style, p, null).toDataURL();
      out[`engine-${style}-${p.id}-logo`] = drawStyledQr(url, style, p, logo).toDataURL();
    }
  out['engine-classic'] = drawStyledQr(url, 'classic', null, null).toDataURL();
  return JSON.stringify(Object.fromEntries(
    Object.entries(out).map(([k, v]) => [k, v.split(',')[1]])));
}
```

Save each base64 value as `<scratchpad>/<name>.png` (small Python helper), then also record in-browser `scanCheck` results for the same canvases (jsQR must agree with cv2 on presets; if jsQR fails a preset that cv2 passes, note it — Task 2 will trust presets and only gate customs on jsQR).

- [ ] **Step 6: Run the ground-truth test**

Run: `cd <scratchpad> && python3 verify_styles.py`
Expected: 25 lines (12 social/artwork×palette, 12 with logo, 1 classic), every one `OK`, exit 0. Any FAIL → darken that palette entry in `QR_PALETTES` and repeat Steps 5-6.

- [ ] **Step 7: Commit**

```bash
cd "/Volumes/Mic Backup/ClaudeProjects/Qr_code"
git add admin/qr-styles.js admin/jsQR.js admin/index.html
git commit -m "feat: styled QR drawing engine + scan check (no UI yet)"
```

---

### Task 2: Panel UI — style/palette controls, live preview, scan gate, Restyle QR

**Files:**
- Modify: `admin/index.html` (create form controls, preview, `createCampaign`, campaign-row restyle flow)
- Test: Playwright MCP against `http://localhost:8741/admin/` (real token from `gh auth token` for list loading; no GitHub writes in this task)

**Interfaces:**
- Consumes: `QR_PALETTES`, `drawStyledQr(url, styleId, palette, logoImg)`, `scanCheck(canvas)` from Task 1; existing `logoImageFor(choice)`, `putFile`, `getFile`, `CAMPAIGNS`, `renderList`.
- Produces: `currentStyleConfig(prefix)` → `{styleId, palette, custom}` reading the form controls with id prefix `'new'` or `'re-'+index`; used by both create and restyle paths.

- [ ] **Step 1: Replace the create-form style controls**

In the New-campaign card, replace the single `newLogo` label/select block with:

```html
<label for="newStyle">QR style</label>
<select id="newStyle">
  <option value="classic">Classic black & white</option>
  <option value="social">Social gradient</option>
  <option value="artwork">Multi-color artwork fill</option>
</select>
<div id="newPaletteWrap" hidden>
  <label for="newPalette">Colors</label>
  <select id="newPalette"></select>
  <div id="newCustomWrap" hidden>
    <label>Pick your colors</label>
    <input type="color" id="newC1" value="#833AB4">
    <input type="color" id="newC2" value="#E1306C">
    <input type="color" id="newC3" value="#F58529">
    <p class="hint" id="newC3hint">Third color = corner accent (gradient style) or third sweep color (artwork).</p>
  </div>
</div>
<label for="newLogo">Logo</label>
<select id="newLogo"><option value="">No logo</option></select>
<input type="file" id="newLogoFile" accept="image/png,image/jpeg,image/webp" hidden style="margin-top:8px">
<div id="newPreview" class="qrbox"></div>
```

(The `loadAll()` logo-population line changes its default option text from `Plain black & white` to `No logo` and drops the `Logo in center:` prefixes.)

- [ ] **Step 2: Add the shared form-reading + preview code** (in the main script, near `createCampaign`)

```js
function populatePalette(sel, styleId) {
  sel.innerHTML = QR_PALETTES[styleId].map(p => `<option value="${p.id}">${p.name}</option>`).join('') +
    '<option value="@custom">Custom colors…</option>';
}
function currentStyleConfig(prefix) {
  const styleId = document.getElementById(prefix + 'Style').value;
  if (styleId === 'classic') return { styleId, palette: null, custom: false };
  const pid = document.getElementById(prefix + 'Palette').value;
  if (pid !== '@custom')
    return { styleId, palette: QR_PALETTES[styleId].find(p => p.id === pid), custom: false };
  const c = i => document.getElementById(prefix + 'C' + i).value;
  return {
    styleId, custom: true,
    palette: styleId === 'social' ? { body: [c(1), c(2)], eye: c(3) } : { stops: [c(1), c(2), c(3)] },
  };
}
async function refreshPreview() {
  const slug = document.getElementById('newSlug').value.trim() || 'preview';
  const cfg = currentStyleConfig('new');
  let logo = null;
  try { logo = await logoImageFor(document.getElementById('newLogo').value); } catch (e) {}
  const canvas = drawStyledQr(CFG.base + slug + '/', cfg.styleId, cfg.palette, logo);
  canvas.style.maxWidth = '240px';
  const box = document.getElementById('newPreview');
  box.innerHTML = '';
  box.appendChild(canvas);
}
```

Wire events: `newStyle` change → show/hide `newPaletteWrap`, `populatePalette`, `refreshPreview`; `newPalette` change → show/hide `newCustomWrap` + `refreshPreview`; each color input + `newSlug` + `newLogo` change → `refreshPreview` (logo `@upload` file change too). Call `refreshPreview()` once at the end of `loadAll()`.

- [ ] **Step 3: Gate `createCampaign` on the scan check**

Inside `createCampaign`, replace the `makeQrCanvas` lines with:

```js
const cfg = currentStyleConfig('new');
const logoImg = await logoImageFor(document.getElementById('newLogo').value);
const canvas = drawStyledQr(qrUrl, cfg.styleId, cfg.palette, logoImg);
if (cfg.styleId !== 'classic') {
  const decoded = scanCheck(canvas);
  if (cfg.custom && decoded !== qrUrl)
    throw new Error('These colors are too light for scanners — darken them.');
}
```

Delete the now-unused `makeQrCanvas` function (drawStyledQr covers classic identically).

- [ ] **Step 4: Restyle QR flow**

In `renderList`, rename the button `New logo QR` → `Restyle QR` and replace the `logo-${i}` inline-form contents with the same Style/Palette/Custom/Logo controls using prefix `re${i}` (same markup as Step 1 minus slug/preview, logo select pre-populated from `LOGOS`). Replace `makeLogoQr(i)` with:

```js
async function restyleQr(i) {
  const c = CAMPAIGNS[i];
  setMsg(`logoMsg-${i}`, '', '');
  try {
    const cfg = currentStyleConfig(`re${i}`);
    const logoImg = await logoImageFor(document.getElementById(`re${i}Logo`).value);
    const qrUrl = CFG.base + c.slug + '/';
    const canvas = drawStyledQr(qrUrl, cfg.styleId, cfg.palette, logoImg);
    if (cfg.styleId !== 'classic' && cfg.custom && scanCheck(canvas) !== qrUrl)
      throw new Error('These colors are too light for scanners — darken them.');
    let sha;
    try { sha = (await getFile(c.qrPath)).sha; } catch (e) {}
    await putFile(c.qrPath, canvasBase64(canvas), `redirect: restyle QR for ${c.slug}`, sha);
    setMsg(`logoMsg-${i}`, 'New QR image saved — shown below. It scans to the same link as before.', 'ok');
    const box = document.getElementById(`qr-${i}`);
    box.innerHTML = '';
    box.appendChild(canvas);
    box.hidden = false;
  } catch (err) {
    setMsg(`logoMsg-${i}`, err.message, 'err');
  }
}
```

- [ ] **Step 5: Local behavior test (Playwright, no GitHub writes)**

With server up and real token injected (list loads): (a) select Social gradient → palette menu appears, preview shows colored QR; (b) select Custom, set all three colors to `#FEFEFE`, fill slug `test-style` + destination `https://example.com/`, click create → Expected: red error exactly `These colors are too light for scanners — darken them.` and **no** campaign created (list count unchanged — this is done-check 2, fired locally); (c) preset palette preview canvas `scanCheck` returns the campaign URL; (d) each campaign row shows `Restyle QR` and opens its controls.

- [ ] **Step 6: Commit**

```bash
git add admin/index.html
git commit -m "feat: style/palette controls, live preview, scan gate, Restyle QR in panel"
```

---

### Task 3: Palette visual sign-off with Michael (house rule: his eyes)

**Files:**
- Create: `<brainstorm screen_dir>/qr-palettes.html` (companion screen, not committed)
- Modify (likely): `QR_PALETTES` values in `admin/qr-styles.js`

**Interfaces:**
- Consumes: the Task-1 engine via the live panel page; existing visual-companion server (restart `start-server.sh` with same `--project-dir` if `server-stopped` exists).
- Produces: final palette hex values, frozen for Task 4.

- [ ] **Step 1:** Export all 12 preset samples (6 per style, with instagram logo) as PNGs from the panel page (same evaluate as Task 1 Step 5).
- [ ] **Step 2:** Build a companion screen showing the 12 in a grid (multi-select cards, one card per palette per style) asking: "These are the 6 preset palettes for each style — click any that feel off, and tell me in the terminal what to change (or say all good)."
- [ ] **Step 3:** Iterate palettes per feedback (edit `QR_PALETTES`, re-export, new screen file `qr-palettes-v2.html`), re-running `verify_styles.py` after every change (all 25 decodes must stay OK).
- [ ] **Step 4:** On sign-off, commit:

```bash
git add admin/qr-styles.js
git commit -m "feat: final preset palettes (Michael-approved)"
```

---

### Task 4: End-to-end done-checks, docs, deploy

**Files:**
- Modify: `CLAUDE.md` (commit-format table + panel paragraph)
- Modify: `HANDOFF.md`
- Test: live GitHub + GitHub Pages

**Interfaces:**
- Consumes: everything above; `gh` CLI for ground-truth reads.

- [ ] **Step 1 (done-check 1):** Via the panel: create campaign `test-style`, destination `https://example.com/`, Social gradient, Insta palette, instagram logo. Then:

```bash
gh api repos/michaello-TS/Qr_code/contents/test-style/index.html --jq '.content' | base64 -d | grep 'url='
gh api repos/michaello-TS/Qr_code/contents/qr-codes/qr-test-style.png --jq '.content' | base64 -d > /tmp/qr-test-style.png  # scratchpad path in practice
python3 -c "import cv2; print(cv2.QRCodeDetector().detectAndDecode(cv2.imread('<scratchpad>/qr-test-style.png'))[0])"
```
Expected: meta refresh with `url=https://example.com/`; decode prints `https://michaello-ts.github.io/Qr_code/test-style/`.

- [ ] **Step 2 (done-check 3):** Via the panel, Restyle `test-style` to Artwork fill / Ocean / no logo. Re-download the PNG, decode → Expected: same URL as Step 1, byte-different image, latest commit message `redirect: restyle QR for test-style`.

- [ ] **Step 3 (done-check 2, already fired locally in Task 2):** Repeat the near-white custom refusal once against the live panel URL after deploy (belt and braces).

- [ ] **Step 4 (done-check 4):** Regression sweep on the live panel: classic create still works (reuse `test-style`? No — verify via preview + scanCheck only, no extra campaign), change-destination on `test-style` → verify commit `redirect: update test-style`, share-link card still copies a working `#key=` URL.

- [ ] **Step 5: Docs.** In `CLAUDE.md`: add commit-table row `| Restyle QR | redirect: restyle QR for [slug] | redirect: restyle QR for summer-sale |`; in the panel paragraph, mention the two styled looks + preset/custom palettes + scan check. Update `HANDOFF.md` (done this session / next steps).

- [ ] **Step 6: Commit, push, wait for Pages, live smoke test**

```bash
git add CLAUDE.md HANDOFF.md
git commit -m "docs: styled QR panel documentation"
git push
```
Poll `https://michaello-ts.github.io/Qr_code/admin/` until the served HTML contains `qr-styles.js` (Pages queue can take 15 min — that's GitHub-side). Then load the live panel once and confirm the Style select renders.

- [ ] **Step 7:** Ask Michael: delete `test-style`, or keep it as a styled example? (Never delete without asking.)

---

## Self-Review (done)

1. **Spec coverage:** two styles ✓ (Task 1), Style/Logo/Palette + preview ✓ (Task 2), 6 presets + custom + pickers ✓ (Tasks 1-2), scan gate incl. jsQR-missing fallback ✓ (Task 1 Step 4 `scanCheck` returns false → Task 2 gate only blocks customs, presets remain usable — matches spec), Restyle QR + new commit format ✓ (Task 2 Step 4), palette sign-off ✓ (Task 3), four done-checks ✓ (Tasks 2/4), CLAUDE.md row ✓ (Task 4).
2. **Placeholders:** none — all code inline.
3. **Type consistency:** `drawStyledQr(url, styleId, palette, logoImg)` and `currentStyleConfig(prefix)` signatures match across Tasks 1/2; prefix scheme `new` / `re${i}` consistent.
