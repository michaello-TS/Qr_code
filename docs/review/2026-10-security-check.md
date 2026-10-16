# Security & reliability check — QR Redirect Manager (October 2026)

Reviewed: `main` at `195d26e`. Read-and-report only — no application code, scripts or campaign files were changed.
Everything below was tested on a throwaway copy with a **fake** GitHub (no real API calls, no real token, nothing pushed except this file).

---

## 1. Plain-English summary

**Yes, it is safe to keep using — the 16 printed QR codes are all fine.** Every QR image in `qr-codes/` was decoded and each one points to its own `michaello-ts.github.io/Qr_code/...` page, which exists and redirects correctly. The two bundled code libraries are untouched, official copies. The real weak spot is that the control panel and the redirect pages **trust whatever text is typed in as a link** and paste it straight into web pages. A strange-looking link (by accident, or by someone who has your share link) can break a campaign page, or plant hidden code that copies your GitHub key the next time you open the panel — and that planted code would keep working **even after you replace the key**. Both are quick fixes (an afternoon). The Mac scripts also have a habit of saying "Pushed to GitHub" when the push actually failed.

**Top 5 fixes, in order:**

1. **Make the panel show campaign data as plain text** (F1). Today a link containing `<img …>` is displayed as real page code, which can quietly copy your GitHub key. Worse, it survives a key change — the "delete the token to lock everyone out" plan in the share card would not work against it.
2. **Clean every new link before saving it** (F2). A link containing a `"` or `</script>` produces a broken campaign page: people who scan the printed QR land on the wrong address, and extra code can run on your github.io site.
3. **Make the Mac scripts stop when the upload fails** (F3). If the panel changed anything since your Mac last synced, the script's push is refused but it still prints "Pushed to GitHub. Live in ~30 seconds." — you'd think a destination changed during an event when it didn't.
4. **Give the Mac scripts the same checks as the panel** (F4, F5). They accept any campaign name and any link — including `javascript:` links (which run code instead of opening a page) and names with apostrophes that break the QR step or run code on your Mac.
5. **Always scan-test the QR before uploading** (F6). The "can a phone read this?" check only runs for custom colours, not for preset palettes or plain/logo QRs. All presets passed in testing, so this is a safety net, not a fire — but it's a one-line change.

**Residual risk of the deliberate choices (not findings).** Keeping the key in the browser and handing it out through the `#key=` link means: anyone who gets the link, or who gets any code to run on `michaello-ts.github.io` (this repo *or any other GitHub Pages repo on this account* — they all share one "site" in the browser's eyes), can read the key and change where QR codes point. The key's limits (this repo only, Contents only, expiry date) cap the damage to "someone edits campaign links", and git history lets you undo it. F1 and F2 matter precisely because they are the two ways code could get onto that shared site from inside this project. Also note: a `#key=` link opened inside WhatsApp/WeChat/Instagram's built-in browser stores the key in *that app's* browser, and the full link stays in the chat history and possibly the browser's history list (likely, not tested).

---

## 2. Findings (most severe first)

Severity: **Must fix / Should fix / Nice to have**. Effort: **S** (< 1 hr) / **M** (half day) / **L**. Confidence: **confirmed** = reproduced in a test (see section 4); **likely** = from reading the code/known browser behaviour.

| # | Area | Where | What happens (who does what → what breaks) | Severity | Effort | Confidence |
|---|------|-------|---------------------------------------------|----------|--------|------------|
| F1 | 2. Stored XSS → token theft | `admin/index.html:311-319` (`c.slug`, `c.dest` into `innerHTML`), `:358-359`, `:365` (`setMsg` with `err.message`), `:394` | Anyone with panel access (e.g. a colleague's leaked share link) sets a destination like `https://example.com/<img src=x onerror=…>`. The panel accepts it (it starts with `https://`), saves it, and from then on **every time anyone opens the panel** that code runs and can read `localStorage.qr_admin_token`. Test T1: page title became `XSS-token-readable:true` right after saving and again after a fresh reload. Because the code lives in a campaign file, rotating the key does not remove it — the next panel visit hands over the *new* key. Same sink is reachable via a folder name (T4) or a logo file name through the error message (T5), for anyone who can commit to the repo. | **Must fix** | S | confirmed (T1, T4, T5) |
| F2 | 1. Destination injection | `admin/index.html:196-210` (`redirectHtml`), check at `:378` and `:426`; same pattern in `add-campaign.sh:37-49`, `update-redirect.sh:31-43` | The URL is pasted raw into a `content="…"` attribute, a `"…"` JS string and an `href="…"`. Only check is `/^https?:\/\/.+/`. Test T2: three destinations that pass the check — containing `">`, `");` and `</script>` — each produced a campaign page that **ran injected script on the github.io origin** (same origin as the panel, so it can read the key if opened on a device that uses the panel) and **sent the visitor to the wrong address** (`https://example.com/a` instead of the full link). Realistic accidental version: a copied link with a stray `"` → printed QR leads to a broken/wrong page. | **Must fix** | S | confirmed (T2) |
| F3 | 5. Scripts — silent push failure | `add-campaign.sh:69-75`, `update-redirect.sh:52-58`, `add-logo-qr.sh:69-87` (no `set -e`, no `git pull`, push result ignored) | Owner changes something in the panel, later runs `./update-redirect.sh lucky-draw https://…` on the Mac. The Mac copy is behind GitHub, so `git push` is rejected — but the script still prints `Pushed to GitHub. Live in ~30 seconds.` Test S5: remote still pointed at the old destination after the "success" message. During a live event this means a QR keeps sending people to last week's page. | **Must fix** | S | confirmed (S5) |
| F4 | 1/5. Scripts — no link validation | `add-campaign.sh:8`, `update-redirect.sh:8` | Scripts accept any text as the destination. A `javascript:` destination makes `window.location.replace(...)` **run code on the github.io origin** for whoever scans (T3: code read the token on a device that had the panel key). The panel blocks `javascript:`/`data:` (T3b), so only the Mac path is exposed. Good news: `$(…)` and backticks inside a quoted link argument do **not** execute — the heredoc expands the variable once and does not re-run it (S1). | Should fix | S | confirmed (T3, S1) |
| F5 | 5. Scripts — campaign name not checked | `add-campaign.sh:28-30, 52-60`, `update-redirect.sh:20-31`, `add-logo-qr.sh:26, 61` | (a) The slug is pasted into Python source inside `python3 -c "… '$QR_URL' … 'qr-codes/qr-$SLUG.png'"`. A name with an apostrophe runs as Python on the Mac (S2: `x');open('PWNED_S2','w')…` created the file). The innocent version, `mums'-day`, makes the QR step fail silently (`2>/dev/null`) yet the campaign is still committed and pushed **without a QR image**. (b) `../outside-repo` writes outside the project (S3) and still prints "Pushed". (c) `./update-redirect.sh admin …` replaces the control panel itself with a redirect page and commits it (S4). The panel's own rule (`^[a-z0-9]+(-[a-z0-9]+)*$`) is not applied here. | Should fix | S | confirmed (S2, S3, S4) |
| F6 | 4. Scan gate coverage | `admin/index.html:388`, `:460` | The scan test runs only when `styleId !== 'classic' && cfg.custom`. Preset palettes, classic, and **any uploaded logo** (`@upload`, unknown shape/colours) are uploaded without being scanned (T6: 0 scans for a preset+logo create, 1 for custom). CLAUDE.md says the panel "scan-tests every styled QR". All 26 preset × logo combinations did decode in testing, so current risk is low. When the test does run it tests the exact canvas that is uploaded (PNG export is lossless) — that part is correct. | Should fix | S | confirmed (T6) |
| F7 | 4. Partial failure on create | `admin/index.html:391-392` | If `index.html` saves but the PNG upload fails (network drop on a phone), the campaign is live with no QR image in the repo; the panel shows just `Server Error`, the campaign is missing from the list, and pressing Create again fails with GitHub's raw `Invalid request. "sha" wasn't supplied.` (T7). Recovery exists (reload → "Restyle QR" creates the missing image) but nothing tells the user that. | Should fix | S | confirmed (T7) |
| F8 | 5. Links typed without quotes in Terminal | usage lines in all 3 scripts; CLAUDE.md table | `./update-redirect.sh fb-kolour https://example.com/?a=1&b=2` (no quotes) saves only `https://example.com/?a=1` — the `&` cuts the link (S6, bash). On the Mac's default shell (zsh) a `?` in an unquoted link usually aborts with `no matches found`. Most real links here (Xiaohongshu, Facebook) contain `?` or `&`. | Should fix | S | confirmed in bash (S6); zsh likely |
| F9 | 4. Destination with `'` shows truncated | `admin/index.html:290` (`/url=([^"']+)["']/`) | A link with an apostrophe (`…/mother's-day`) is saved correctly, but after reload the panel shows and pre-fills `https://example.com/mother` (T9). If someone then edits and saves from that box, the live link breaks. None of the 16 current links contain `'` (T0). | Nice to have | S | confirmed (T9) |
| F10 | 3. Token handling details | `admin/index.html:500-505`, `:69`, `:378-379` | (a) If the clipboard is blocked, the full share link **with the key** is shown in a visible text box — shoulder-surfing risk (code reading; my headless test could not force the clipboard to fail). (b) Setup advises ~1 year expiry; 90 days limits a leaked link's lifetime at the cost of renewing 4×/year — owner's call. (c) Check accepts `http://` while the message says `https://`. (d) No Content-Security-Policy on `admin/`; a `connect-src https://api.github.com` policy would stop injected code from sending the key to an outside server (defence in depth only — F1 is the real fix). | Nice to have | S | likely (a); code reading (b–d) |
| F11 | 5. shellcheck | all 3 `.sh`, line of `cd "$(dirname "$0")"` | SC2164: if `cd` failed the script would carry on in the wrong folder (practically never happens). SC2010/SC2035/SC2181: style only. | Nice to have | S | confirmed (shellcheck) |

**Checked and found fine (no finding):**

- **3. Token handling.** `#key=` is read, stored and removed from the address bar before any network request (`history.replaceState` runs synchronously in the inline script); no request URL or `Referer` header contained the key (T10). Fragments are never sent as Referer anyway. The token is never `console.log`ged. Setup screen correctly asks for fine-grained, one-repo, Contents-only. Key field is `type=password`.
- **4. Correctness.** Double-clicking Create sends one set of writes (button is disabled before the first `await`; T8b). A stale list or a second device creating the same name **cannot overwrite** — GitHub refuses a create without `sha` (T8); only the error wording is unfriendly (covered by F7). Changing a destination always fetches the fresh `sha` first. Client-side-only slug validation is not a separate risk: anyone who can bypass it already holds the key; F1's escaping is what protects the panel.
- **1. Panel blocks `javascript:` and `data:` destinations** (T3b).
- **6. Supply chain.** `admin/jsQR.js` is byte-identical to npm `jsqr@1.4.0` `dist/jsQR.js` (latest release); `admin/qrcode.js` is byte-identical to npm `qrcode-generator@1.4.4` `qrcode.js` (newer 2.x exists; no need to upgrade for this use). SHA-256 values in section 4.
- **Printed QR codes.** All 16 images decode to `https://michaello-ts.github.io/Qr_code/<slug>/` and each target page exists, uses meta refresh, and the panel reads every current destination exactly (T0).

---

## 3. Suggested fixes for the Must-fix items (not applied)

### F1 — show campaign data as text, not page code (`admin/index.html`)

Add one helper and wrap every value that came from the repo or from an error:

```js
const esc = s => String(s).replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const safeHref = u => /^https?:\/\//i.test(u) ? esc(u) : '#';

// renderList(): ${esc(c.slug)}  href="${safeHref(c.dest)}"  ${esc(c.dest) || '(unknown)'}  value="${esc(c.dest)}"
// showQr():     alt="QR for ${esc(c.slug)}"
// every error:  setMsg(id, esc(err.message), 'err')   and  `Could not load campaigns: ${esc(err.message)}`
```

Optionally also skip any folder whose name doesn't match `/^[a-z0-9-]+(\/[a-z0-9-]+)?$/` when building `CAMPAIGNS`.

### F2 — clean the link before saving (`admin/index.html`, used by create and update)

```js
function cleanDest(raw) {
  let u;
  try { u = new URL(raw.trim()); } catch (e) { throw new Error('That doesn\'t look like a full link (https://...).'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('Destination must start with https://');
  return u.href;   // browser percent-encodes " < > spaces; turns \ into /
}
// createCampaign: const dest = cleanDest(document.getElementById('newDest').value);
// updateDest:     const url  = cleanDest(document.getElementById(`editUrl-${i}`).value);
// redirectHtml:   put `url.replace(/&/g, '&amp;')` in the two HTML attributes; JSON.stringify(url) in the script line
```

Verified: the three T2 payloads become harmless (`%22`, `%3C`), `javascript:` is rejected, and all current real destinations (Kolour poster links with `%20`/`&`, Xiaohongshu links with `?…&…`) come out unchanged. For the scripts, the simplest equivalent is to refuse anything that isn't a plain link:

```bash
case "$DEST_URL" in
  https://*|http://*) ;;
  *) echo "Destination must start with https://"; exit 1 ;;
esac
if printf '%s' "$DEST_URL" | grep -q '[]["<>\`[:space:]]'; then
  echo "That link contains characters that would break the page (quotes, < >, spaces)."; exit 1
fi
```

### F3 — stop on failure, sync first (all three scripts)

```bash
#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")" || exit 1
eval "$(/opt/homebrew/bin/brew shellenv)"
git pull --ff-only || { echo "Couldn't sync with GitHub first — nothing was changed."; exit 1; }
# ... existing work ...
if git push; then
  echo "Pushed to GitHub. Live in ~30 seconds."
else
  echo "PUSH FAILED — the change is saved on this Mac only and is NOT live."; exit 1
fi
```

(Move the `brew shellenv` line to the top so `git pull` uses the same git. With `set -e`, also change the QR step to `if python3 make-logo-qr.py …; then` style so a failure stops the script instead of pushing a campaign without a QR — this also covers F5's silent-skip case.)

---

## 4. Test log

Environment: Linux VM, Python 3, Node 22, Chromium (Playwright 1.48.2, `--headless=new`), `opencv-python-headless`, `shellcheck`. Repo served from a scratch copy with `python3 -m http.server`; every `https://api.github.com/**` call answered by a `page.route` stub that mimics GitHub (including the 422 "sha wasn't supplied" rule). A fake token string was seeded into `localStorage` on the local origin. Shell scripts ran in a scratch clone with a local bare repo as "remote" and the `brew shellenv` line stubbed out.

| ID | What I ran | Result |
|----|-----------|--------|
| QR | Decoded all 16 `qr-codes/*.png` with OpenCV; checked each target folder has `index.html` with one `http-equiv="refresh"` | 16/16 decode to `https://michaello-ts.github.io/Qr_code/<slug>/`, all pages exist, all destinations `https://` |
| T0 | Load panel against fake repo built from real `main` | 16 campaigns, every destination parsed exactly, every QR found |
| T1 | Change destination of `lucky-draw` to `https://example.com/<img src=x onerror=document.title=…+!!localStorage.qr_admin_token>`, then reload | Saved with "Saved." message; script ran immediately and on every reload: title `XSS-token-readable:true` |
| T2 | Generated pages via the panel's `redirectHtml()` for destinations containing `">`, `");`, `</script>`; opened them | All three pass the https check; all three ran injected code on the page origin (wrote to `localStorage`); visitors sent to `https://example.com/a` (truncated) |
| T3 | Redirect page (script template) with a `javascript:` destination, opened on a device holding the panel key | Code ran on the origin and could see the key (`xss_t3=true`) |
| T3b | Panel check against `javascript:` / `data:` | Rejected |
| T4 | Fake repo with folder named `<img src=x onerror=…>` | Script ran when panel listed campaigns |
| T5 | Fake repo with logo `logos/<img src=x onerror=…>.png`, Restyle with it | Image load failed; error message rendered as HTML; script ran |
| T6 | Wrapped `scanCheck` with a counter; created with preset+logo, then with custom colours; scanned all presets × logo/no-logo with jsQR | Preset+logo: 0 scans; custom: 1 scan; 26/26 combinations decode correctly |
| T7 | Fake GitHub returns 500 on PNG upload; create, then retry | `index.html` in repo, PNG missing; messages `Server Error`, then `Invalid request. "sha" wasn't supplied.`; campaign not listed |
| T8 | Another "device" creates `zz-race` after the panel loaded; panel creates same name | Not overwritten (422); raw GitHub message shown |
| T8b | Double-click Create | Exactly 2 writes (index + PNG) |
| T9 | Save `https://example.com/mother's-day?x=1`, reload | Panel shows `https://example.com/mother` |
| T10 | Open `admin/#key=<fake>` | Address bar cleaned, key stored, 0 requests or Referer headers contained it |
| T10b | Force clipboard fallback | Could not force a clipboard failure in headless Chromium — finding F10(a) is from code reading |
| S1 | `./add-campaign.sh s1-test 'https://example.com/$(touch X)\`touch Y\`'` | Nothing executed; text saved literally |
| S2 | `./add-campaign.sh "x');open('PWNED_S2','w').write('ran');('" …` and `"mums'-day"` | First: Python code from the name executed (file created). Second: "QR code skipped" but campaign still committed |
| S3 | `./add-campaign.sh ../outside-repo …` | Folder + page written outside project; `git add` fatal; script still printed "Pushed" |
| S4 | `./update-redirect.sh admin https://example.com/` | `admin/index.html` replaced by a redirect page and committed as `redirect: update admin` |
| S5 | Remote one commit ahead; `./update-redirect.sh lucky-draw https://example.com/new` | `! [rejected] … (fetch first)` followed by `Pushed to GitHub. Live in ~30 seconds.`; remote still has old destination |
| S6 | `bash -c './update-redirect.sh fb-kolour https://example.com/?a=1&b=2'` | Saved `https://example.com/?a=1` |
| SC | `shellcheck add-campaign.sh update-redirect.sh add-logo-qr.sh` | Warnings SC2164 ×3, SC2010 ×4, SC2035 ×2, SC2181 ×2; no errors |
| SUP | `npm i jsqr@1.4.0 qrcode-generator@1.4.4`, `cmp` + `sha256sum` | Identical. `jsQR.js` `bc40c8a15196236b2314db0856f72ca0b49980cd5413b8c852a7349f5fee0859`; `qrcode.js` `18ae399f81182bc9de916e9c77b195df20cc58d6f2d55a62b085a299f1bf1780` |

Not done: no real GitHub API calls, no pushes of campaign changes, no testing on iOS/Android scanners or printed material, zsh behaviour (F8) not run (no zsh on the VM).
