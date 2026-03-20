#!/bin/bash
# Usage: ./add-campaign.sh [slug] [destination-url]
# Example: ./add-campaign.sh summer-sale https://example.com/summer

# Always run from the project folder, no matter where you call this from
cd "$(dirname "$0")"

SLUG=$1
DEST_URL=$2

# Check arguments
if [ -z "$SLUG" ] || [ -z "$DEST_URL" ]; then
  echo ""
  echo "Usage: ./add-campaign.sh [slug] [destination-url]"
  echo "Example: ./add-campaign.sh summer-sale https://example.com/summer"
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

# Generate QR code
QR_URL="https://michaello-ts.github.io/Qr_code/$SLUG/"
python3 -c "
import qrcode
qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=10, border=4)
qr.add_data('$QR_URL')
qr.make(fit=True)
img = qr.make_image(fill_color='black', back_color='white')
img.save('$SLUG/qr-$SLUG.png')
" 2>/dev/null

if [ $? -eq 0 ]; then
  echo "QR code saved: $SLUG/qr-$SLUG.png"
else
  echo "QR code skipped (install with: pip3 install 'qrcode[pil]')"
fi

# Git commit and push
eval "$(/opt/homebrew/bin/brew shellenv)"
git add "$SLUG/"
git commit -m "redirect: add $SLUG"
git push

echo ""
echo "Pushed to GitHub. Live in ~30 seconds."
echo "QR code URL: $QR_URL"
echo ""
