#!/bin/bash
# Usage: ./add-logo-qr.sh [slug] [logo-name]
# Example: ./add-logo-qr.sh henderson-summer2026 instagram
#
# Makes a QR code for an existing campaign with a logo in the center.
# Put your logo image in the logos/ folder first (see logos/README.md).
# This replaces that campaign's qr-codes/qr-[slug].png with the logo version and
# pushes it to GitHub. The campaign URL the QR points to does NOT change.

# Always run from the project folder, no matter where you call this from
cd "$(dirname "$0")"

SLUG=$1
LOGO=$2

# Check arguments
if [ -z "$SLUG" ] || [ -z "$LOGO" ]; then
  echo ""
  echo "Usage: ./add-logo-qr.sh [slug] [logo-name]"
  echo "Example: ./add-logo-qr.sh henderson-summer2026 instagram"
  echo ""
  echo "Available logos:"
  ls logos/ 2>/dev/null | grep -iE '\.(png|jpg|jpeg|webp)$' | sed 's/\.[^.]*$//' | sed 's/^/  /' || echo "  (none yet — add some to the logos/ folder)"
  echo ""
  exit 1
fi

# Check campaign folder exists
if [ ! -d "$SLUG" ]; then
  echo ""
  echo "Campaign folder '$SLUG' not found."
  echo "Create it first with: ./add-campaign.sh $SLUG [destination-url]"
  echo ""
  echo "Available campaigns:"
  ls -d */ 2>/dev/null | grep -v -e "^logos/" | sed 's/\///' | sed 's/^/  /'
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
  ls logos/ 2>/dev/null | grep -iE '\.(png|jpg|jpeg|webp)$' | sed 's/\.[^.]*$//' | sed 's/^/  /' || echo "  (none yet)"
  echo ""
  exit 1
fi

# The QR points to the campaign's GitHub Pages URL (never the final destination)
QR_URL="https://michaello-ts.github.io/Qr_code/$SLUG/"
mkdir -p qr-codes
OUT="qr-codes/qr-$SLUG.png"

if [ -f "$OUT" ]; then
  echo "Replacing existing $OUT with a logo version (old one stays in git history)."
fi

# Generate the logo QR
python3 make-logo-qr.py "$QR_URL" "$LOGO_FILE" "$OUT"
if [ $? -ne 0 ]; then
  echo ""
  echo "QR generation failed. If it's a missing library, run: pip3 install 'qrcode[pil]'"
  echo ""
  exit 1
fi

echo ""
echo "Logo QR created: $OUT  (logo: $LOGO_FILE)"

# Git commit and push
eval "$(/opt/homebrew/bin/brew shellenv)"
git add "$OUT" "$LOGO_FILE"
git commit -m "redirect: add logo QR for $SLUG"
git push

echo ""
echo "Pushed to GitHub. QR code URL: $QR_URL"
echo ""
