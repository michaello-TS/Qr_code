# Logos folder

Drop your logo image files in this folder. Then you can generate a QR code with
that logo in the center using:

    ./add-logo-qr.sh [campaign-slug] [logo-name]

Example: if you save your Instagram logo here as `instagram.png`, run:

    ./add-logo-qr.sh henderson-summer2026 instagram

## Tips for good logos

- **Square images work best** (e.g. 500 x 500 pixels). Non-square is fine too.
- **PNG with a transparent background** looks cleanest, but JPG works.
- The logo is placed on a small white rounded badge in the center, so even
  logos with their own colored background look tidy.
- Keep the logo simple. Tiny text or thin lines may be hard to see once shrunk.

## Supported file types

png, jpg, jpeg, webp — you don't type the extension, just the name.
