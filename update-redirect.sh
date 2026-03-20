#!/bin/bash
# Usage: ./update-redirect.sh [slug] [new-url]
# Example: ./update-redirect.sh henderson-summer2026 https://example.com/new-page

# Always run from the project folder, no matter where you call this from
cd "$(dirname "$0")"

SLUG=$1
NEW_URL=$2

# Check arguments
if [ -z "$SLUG" ] || [ -z "$NEW_URL" ]; then
  echo ""
  echo "Usage: ./update-redirect.sh [slug] [new-url]"
  echo "Example: ./update-redirect.sh henderson-summer2026 https://example.com/new-page"
  echo ""
  exit 1
fi

# Check folder exists
if [ ! -d "$SLUG" ]; then
  echo ""
  echo "Campaign folder '$SLUG' not found."
  echo "Available campaigns:"
  ls -d */ 2>/dev/null | grep -v -e "^\." | sed 's/\///'
  echo ""
  exit 1
fi

# Update index.html
cat > "$SLUG/index.html" <<EOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=$NEW_URL">
  <script>window.location.replace("$NEW_URL");</script>
  <title>Redirecting...</title>
</head>
<body>
  <p>Redirecting... <a href="$NEW_URL">Click here if not redirected.</a></p>
</body>
</html>
EOF

echo ""
echo "Redirect updated: $SLUG -> $NEW_URL"

# Git commit and push
eval "$(/opt/homebrew/bin/brew shellenv)"
git add "$SLUG/index.html"
git commit -m "redirect: update $SLUG"
git push

echo ""
echo "Pushed to GitHub. Live in ~30 seconds."
echo "https://michaello-ts.github.io/Qr_code/$SLUG/"
echo ""
