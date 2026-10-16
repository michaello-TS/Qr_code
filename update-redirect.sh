#!/bin/bash
# Usage: ./update-redirect.sh [slug] [new-url]
# Example: ./update-redirect.sh henderson-summer2026 https://example.com/new-page

set -euo pipefail

# Always run from the project folder, no matter where you call this from
cd "$(dirname "$0")" || exit 1

SLUG=${1:-}
NEW_URL=${2:-}

# Check arguments
if [ -z "$SLUG" ] || [ -z "$NEW_URL" ]; then
  echo ""
  echo "Usage: ./update-redirect.sh [slug] [new-url]"
  echo "Example: ./update-redirect.sh henderson-summer2026 https://example.com/new-page"
  echo ""
  exit 1
fi

# Refuse anything that isn't a plain web link: quotes, < >, backslashes,
# backticks or spaces would break the redirect page (or run code on it).
check_url() {
  case "$1" in
    https://*|http://*) ;;
    *) echo ""; echo "Destination must be a full link starting with https://"; echo ""; exit 1 ;;
  esac
  if printf '%s' "$1" | grep -q '[]["<>\`[:space:]]'; then
    echo ""
    echo "That link contains characters that would break the page (quotes, < >, spaces)."
    echo "Copy the link again straight from the browser's address bar."
    echo ""
    exit 1
  fi
}
check_url "$NEW_URL"

# Get any changes made from the web panel first, so our push isn't refused
eval "$(/opt/homebrew/bin/brew shellenv)"
if ! git pull --ff-only; then
  echo ""
  echo "Couldn't sync with GitHub first — nothing was changed."
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
git add "$SLUG/index.html"
git commit -m "redirect: update $SLUG"
if git push; then
  echo ""
  echo "Pushed to GitHub. Live in ~30 seconds."
else
  echo ""
  echo "PUSH FAILED — the change is saved on this Mac only and is NOT live."
  echo ""
  exit 1
fi
echo "https://michaello-ts.github.io/Qr_code/$SLUG/"
echo ""
