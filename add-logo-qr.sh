#!/bin/bash
# Usage: ./add-logo-qr.sh [slug] [logo-name]
# Example: ./add-logo-qr.sh henderson-summer2026 instagram
#
# Makes a QR code for an existing campaign with a logo in the center.
# Put your logo image in the logos/ folder first (see logos/README.md).
# This replaces that campaign's qr-codes/qr-[slug].png with the logo version and
# pushes it to GitHub. The campaign URL the QR points to does NOT change.

set -euo pipefail

# Always run from the project folder, no matter where you call this from
cd "$(dirname "$0")" || exit 1

SLUG=${1:-}
LOGO=${2:-}

# Print the logos/ folder's image names (without extension), or a fallback line
list_logos() {
  local f found=""
  shopt -s nullglob nocaseglob
  for f in logos/*.png logos/*.jpg logos/*.jpeg logos/*.webp; do
    f=${f#logos/}
    echo "  ${f%.*}"
    found=1
  done
  shopt -u nullglob nocaseglob
  [ -n "$found" ] || echo "  $1"
}

# Check arguments
if [ -z "$SLUG" ] || [ -z "$LOGO" ]; then
  echo ""
  echo "Usage: ./add-logo-qr.sh [slug] [logo-name]"
  echo "Example: ./add-logo-qr.sh henderson-summer2026 instagram"
  echo ""
  echo "Available logos:"
  list_logos "(none yet — add some to the logos/ folder)"
  echo ""
  exit 1
fi

# Get any changes made from the web panel first, so our push isn't refused
eval "$(/opt/homebrew/bin/brew shellenv)"
if ! git pull --ff-only; then
  echo ""
  echo "Couldn't sync with GitHub first — nothing was changed."
  echo ""
  exit 1
fi

# Must be an existing campaign: same naming rule as the panel (one level of
# nesting allowed for the two legacy henderson-summer2026/... campaigns) and a
# folder whose index.html is a redirect page — so names like ../x or admin
# can't touch anything else.
case "${SLUG%%/*}" in admin|logos|qr-codes|docs) SLUG="" ;; esac   # never the panel's own folders
if ! [[ "$SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*(/[a-z0-9]+(-[a-z0-9]+)*)?$ ]] ||
   ! grep -qs 'http-equiv="refresh"' "$SLUG/index.html"; then
  echo ""
  echo "Campaign '$1' not found."
  echo "Create it first with: ./add-campaign.sh $1 [destination-url]"
  echo ""
  echo "Available campaigns:"
  grep -ls 'http-equiv="refresh"' ./*/index.html ./*/*/index.html | sed 's#^\./##; s#/index\.html$##; s#^#  #' || true
  echo ""
  exit 1
fi

# Logo name: letters, numbers, - and _ (plus an optional extension) — no paths
if ! [[ "$LOGO" =~ ^[A-Za-z0-9_-]+(\.[A-Za-z0-9]+)?$ ]]; then
  echo ""
  echo "Logo name should be just the file name from the logos/ folder, e.g. instagram"
  echo ""
  exit 1
fi

# Find the logo file (try the name as-is, then common extensions)
LOGO_FILE=""
if [ -f "logos/$LOGO" ]; then
  LOGO_FILE="logos/$LOGO"
else
  for ext in png PNG jpg JPG jpeg JPEG webp WEBP; do
    if [ -f "logos/$LOGO.$ext" ]; then
      LOGO_FILE="logos/$LOGO.$ext"
      break
    fi
  done
fi

if [ -z "$LOGO_FILE" ]; then
  echo ""
  echo "Logo '$LOGO' not found in the logos/ folder."
  echo ""
  echo "Available logos:"
  list_logos "(none yet)"
  echo ""
  exit 1
fi

# The QR points to the campaign's GitHub Pages URL (never the final destination)
QR_URL="https://michaello-ts.github.io/Qr_code/$SLUG/"
mkdir -p qr-codes
# Same image name the web panel uses: qr-<slug>.png, with / turned into -
# (legacy nested campaigns already have qr-<last part>.png, so reuse that).
OUT="qr-codes/qr-${SLUG//\//-}.png"
if [ ! -f "$OUT" ] && [ -f "qr-codes/qr-${SLUG##*/}.png" ]; then
  OUT="qr-codes/qr-${SLUG##*/}.png"
fi

if [ -f "$OUT" ]; then
  echo "Replacing existing $OUT with a logo version (old one stays in git history)."
fi

# Generate the logo QR
if ! python3 make-logo-qr.py "$QR_URL" "$LOGO_FILE" "$OUT"; then
  echo ""
  echo "QR generation failed. If it's a missing library, run: pip3 install 'qrcode[pil]'"
  echo ""
  exit 1
fi

echo ""
echo "Logo QR created: $OUT  (logo: $LOGO_FILE)"

# Git commit and push
git add "$OUT" "$LOGO_FILE"
git commit -m "redirect: add logo QR for $SLUG"
if git push; then
  echo ""
  echo "Pushed to GitHub. QR code URL: $QR_URL"
else
  echo ""
  echo "PUSH FAILED — the change is saved on this Mac only and is NOT live."
  echo ""
  exit 1
fi
echo ""
