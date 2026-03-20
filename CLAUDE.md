# CLAUDE.md

## Project Purpose

This is a **dynamic QR code redirect manager** hosted on GitHub Pages, built for mall event campaigns.

The core idea: a QR code points to a permanent URL (e.g. `https://yourusername.github.io/Qr_code/summer-sale/`). That URL contains a redirect page that sends visitors to wherever the campaign currently points. When the destination needs to change, you update only the redirect file — the QR code itself never changes.

---

## How It Works

1. Each campaign gets its own folder inside this repo.
2. Inside that folder is a single `index.html` file that uses a meta refresh tag to redirect visitors to the target URL.
3. The QR code always points to the GitHub Pages URL for that campaign folder.
4. To change the destination, update the `index.html` file and commit — the QR code stays the same forever.

---

## Folder Structure

```
Qr_code/
├── CLAUDE.md               ← this file
├── index.html              ← optional homepage listing all campaigns
├── [campaign-slug]/
│   └── index.html          ← redirect page for that campaign
├── [campaign-slug]/
│   └── index.html
└── ...
```

**Example:**
```
Qr_code/
├── summer-sale/
│   └── index.html          ← redirects to https://example.com/summer
├── grand-opening/
│   └── index.html          ← redirects to https://example.com/opening
```

---

## Campaign Slug Naming Rules

- Use lowercase letters, numbers, and hyphens only
- No spaces or special characters
- Keep it short and descriptive
- Examples: `summer-sale`, `grand-opening`, `lck-popup`, `b1-activation`

---

## Redirect Page Template

Each campaign's `index.html` should follow this exact format:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=TARGET_URL_HERE">
  <title>Redirecting...</title>
</head>
<body>
  <p>Redirecting... <a href="TARGET_URL_HERE">Click here if not redirected.</a></p>
</body>
</html>
```

Replace `TARGET_URL_HERE` with the actual destination URL.

---

## Commit Message Format

| Action | Format | Example |
|--------|--------|---------|
| New campaign | `redirect: add [slug]` | `redirect: add summer-sale` |
| Update destination | `redirect: update [slug]` | `redirect: update summer-sale` |

---

## GitHub Pages Setup

1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. Set source to `main` branch, root folder `/`.
4. Your base URL will be: `https://michaello-TS.github.io/Qr_code/`
5. Each campaign URL: `https://michaello-TS.github.io/Qr_code/[slug]/`

Point the QR code to the campaign URL — never to the final destination directly.

---

## Your Campaign URLs

Base: `https://michaello-TS.github.io/Qr_code/`

| Campaign Slug | QR Code URL |
|---------------|-------------|
| henderson-summer2026 | `https://michaello-TS.github.io/Qr_code/henderson-summer2026/` |
