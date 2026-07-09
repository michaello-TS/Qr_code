# HANDOFF — QR Code

> 5-bullet structured handoff between sessions. Replace this file's body at the end of every session. Read it first when you start a new session.

**Last updated:** 2026-07-09 (session 2: styled QR codes)

## Done this session (2)
- Styled QR codes shipped to the panel: Social gradient + Artwork fill, 6 preset palettes each (Michael-approved visually) + custom pickers, live preview, jsQR scan gate that blocks too-light custom colors (verified firing), Restyle QR replacing New-logo-QR. Engine in `admin/qr-styles.js`, jsQR vendored. Spec + plan in `docs/superpowers/`.
- All 4 done-checks passed: live create (cv2-decoded from GitHub), near-white refusal, restyle same-URL/different-image with `redirect: restyle QR for <slug>` commit, regression sweep.
- `test-style` campaign left on GitHub pending Michael's keep/delete decision.

## Earlier same day (session 1)
- Built the self-serve web control panel at `admin/` (index.html + bundled qrcode.js). Creates campaigns, changes destinations, and makes logo QRs from any browser via the GitHub API (fine-grained PAT in localStorage). Commit `bbdb770`.
- End-to-end tested locally with Playwright: created `test-panel` campaign with Instagram logo QR (decoded back to the correct URL with cv2), then changed its destination — all commits landed on GitHub with the correct message format.
- Updated CLAUDE.md: documented the panel, refreshed the (very stale) campaign list — repo actually has 16 real campaigns.

## Undone / in progress
- Michael still needs to create his fine-grained PAT (instructions are on the panel's setup screen) — panel is useless to him until then.

## Blockers / open questions
- None. (Panel went live at `https://michaello-ts.github.io/Qr_code/admin/` after a ~15-min GitHub Actions queue delay — that was GitHub-side, not our files.)

## Next session — start here
- Ask whether Michael created his PAT and successfully made a campaign from the panel. Session 2 additions (commit `878ab75`): bookmarkable `#key=` share link (share card on panel) and `test-panel` deleted per Michael's approval.

## State
- Branch: main, pushed
- Tests passing: manual E2E via Playwright — all passed
- Risky uncommitted changes: no
- Recent decisions worth remembering: panel chosen over Vercel app / paid service (Option 1); printed QRs must keep pointing at github.io forever.
