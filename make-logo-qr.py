#!/usr/bin/env python3
"""
Make a QR code with a logo in the center.

Usage:
    python3 make-logo-qr.py "<url>" "<logo_path>" "<output_path>"

The QR uses the highest error-correction level so it still scans reliably
even with the center covered by a logo. The logo sits on a small white
rounded badge, matching the common social-media QR style.
"""

import sys
import qrcode
from qrcode.constants import ERROR_CORRECT_H
from PIL import Image, ImageDraw


def main():
    if len(sys.argv) != 4:
        print("Usage: python3 make-logo-qr.py <url> <logo_path> <output_path>")
        sys.exit(1)

    url, logo_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]

    # Build the QR. ERROR_CORRECT_H recovers ~30% of the code, which is what
    # lets us cover the middle with a logo and still have it scan.
    qr = qrcode.QRCode(error_correction=ERROR_CORRECT_H, box_size=10, border=4)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")

    qr_w, qr_h = img.size

    # Load logo, keeping any transparency.
    logo = Image.open(logo_path).convert("RGBA")

    # Logo takes up ~22% of the QR width — large enough to read, small enough
    # to stay scannable. thumbnail() preserves the logo's aspect ratio.
    target = int(qr_w * 0.22)
    logo.thumbnail((target, target), Image.LANCZOS)

    # White rounded badge behind the logo, with a little padding around it.
    pad = max(6, int(target * 0.16))
    badge_w = logo.width + pad * 2
    badge_h = logo.height + pad * 2
    badge = Image.new("RGBA", (badge_w, badge_h), (255, 255, 255, 0))
    draw = ImageDraw.Draw(badge)
    radius = int(min(badge_w, badge_h) * 0.22)
    draw.rounded_rectangle(
        [0, 0, badge_w - 1, badge_h - 1], radius=radius, fill=(255, 255, 255, 255)
    )
    # Center the logo on the badge (use the logo as its own transparency mask).
    badge.paste(logo, (pad, pad), logo)

    # Center the badge on the QR.
    pos = ((qr_w - badge_w) // 2, (qr_h - badge_h) // 2)
    img.paste(badge, pos, badge)

    img.save(out_path)
    print(f"Saved logo QR: {out_path}")


if __name__ == "__main__":
    main()
