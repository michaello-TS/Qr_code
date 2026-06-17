# qr-codes

All generated QR code images live here, named `qr-[slug].png`.

These are the files you download and print/share. The QR scans to a permanent
campaign URL (e.g. `…/Qr_code/ig-kolour/`), and that campaign's `index.html`
redirect page decides where the visitor actually goes.

You don't put files here by hand — the scripts do it automatically:

- `./add-campaign.sh [slug] [url]` — creates a plain QR here
- `./add-logo-qr.sh [slug] [logo]` — replaces it with a logo-center QR

Note: moving or renaming these image files does NOT affect any live QR code.
The redirect pages (each campaign folder's `index.html`) are what must stay put.
