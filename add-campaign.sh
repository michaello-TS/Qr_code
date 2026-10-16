#!/bin/bash
# Usage: ./add-campaign.sh [slug] [destination-url]
# Example: ./add-campaign.sh summer-sale 'https://example.com/summer'
# Tip: leave the link off and the script asks you to paste it.

set -euo pipefail

# Always run from the project folder, no matter where you call this from
cd "$(dirname "$0")" || exit 1

SLUG=${1:-}
DEST_URL=${2:-}

# No link given? Ask for it. Pasting it here is safer than typing it on the
# command line, where characters like & and ? in the link get mangled.
if [ -n "$SLUG" ] && [ -z "$DEST_URL" ]; then
  read -r -p "Paste the destination link and press Enter: " DEST_URL || true
fi

# Check arguments
if [ -z "$SLUG" ] || [ -z "$DEST_URL" ]; then
  echo ""
  echo "Usage: ./add-campaign.sh [slug] [destination-url]"
  echo "Example: ./add-campaign.sh summer-sale 'https://example.com/summer'"
  echo "(Leave the link off to be asked for it.)"
  echo ""
  exit 1
fi

# Same naming rule as the web panel; also keeps the name from reaching
# outside the project folder or replacing the panel's own folders.
if ! [[ "$SLUG" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
  echo ""
  echo "Campaign name must be lowercase letters, numbers and hyphens only (e.g. summer-sale)."
  echo ""
  exit 1
fi
case "$SLUG" in
  admin|logos|qr-codes|docs)
    echo ""; echo "'$SLUG' is a reserved folder name — pick another campaign name."; echo ""; exit 1 ;;
esac

# Refuse anything that isn't a plain web link: quotes, < >, backslashes,
# backticks or spaces would break the redirect page (or run code on it).
check_url() {
  case "$1" in
    https://*|http://*) ;;
    *) echo ""; echo "Destination must be a full link starting with https:// (or http://)"; echo ""; exit 1 ;;
  esac
  if printf '%s' "$1" | grep -q '[]["<>\`[:space:]]'; then
    echo ""
    echo "That link contains characters that would break the page (quotes, < >, spaces)."
    echo "Copy the link again straight from the browser's address bar."
    echo ""
    exit 1
  fi
}
check_url "$DEST_URL"

# Get any changes made from the web panel first, so our push isn't refused
eval "$(/opt/homebrew/bin/brew shellenv)"
if ! git pull --ff-only; then
  echo ""
  echo "Couldn't sync with GitHub first — nothing was changed."
  echo ""
  exit 1
fi

# Check folder does NOT already exist
if [ -d "$SLUG" ]; then
  echo ""
  echo "Campaign '$SLUG' already exists."
  echo "To update its destination, use: ./update-redirect.sh $SLUG [new-url]"
  echo ""
  exit 1
fi

# Create folder and redirect page
mkdir "$SLUG"

cat > "$SLUG/index.html" <<EOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=$DEST_URL">
  <script>window.location.replace("$DEST_URL");</script>
  <title>Redirecting...</title>
</head>
<body>
  <p>Redirecting... <a href="$DEST_URL">Click here if not redirected.</a></p>
</body>
</html>
EOF

echo ""
echo "Campaign created: $SLUG -> $DEST_URL"

# Generate QR code (all QR images are stored together in qr-codes/)
mkdir -p qr-codes
QR_URL="https://michaello-ts.github.io/Qr_code/$SLUG/"
# The link and file name are passed as arguments, never pasted into the Python code.
if python3 - "$QR_URL" "qr-codes/qr-$SLUG.png" 2>/dev/null <<'PY'
import sys, qrcode
qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=10, border=4)
qr.add_data(sys.argv[1])
qr.make(fit=True)
img = qr.make_image(fill_color='black', back_color='white')
img.save(sys.argv[2])
PY
then
  echo "QR code saved: qr-codes/qr-$SLUG.png"
else
  echo "QR code skipped (install with: pip3 install 'qrcode[pil]')"
fi

# Git commit and push
git add "$SLUG/" qr-codes/
git commit -m "redirect: add $SLUG"
if git push; then
  echo ""
  echo "Pushed to GitHub. Live in ~30 seconds."
else
  echo ""
  echo "PUSH FAILED — the change is saved on this Mac only and is NOT live."
  echo ""
  exit 1
fi
echo "QR code URL: $QR_URL"
echo ""
