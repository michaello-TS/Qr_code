'use strict';
// Styled QR drawing engine for the admin panel.
// Recipes approved 2026-07-09 (spec: docs/superpowers/specs/2026-07-09-styled-qr-codes-design.md).

const QR_PALETTES = {
  social: [ // body: radial gradient [center, edge]; eye: accent for finder corners
    { id: 'insta',    name: 'Insta',    body: ['#833AB4', '#E1306C'], eye: '#C05010' },
    { id: 'sunset',   name: 'Sunset',   body: ['#A81D5B', '#E8590C'], eye: '#7A0F3C' },
    { id: 'ocean',    name: 'Ocean',    body: ['#172A5C', '#0D6E6E'], eye: '#1971C2' },
    { id: 'forest',   name: 'Forest',   body: ['#14532D', '#3F6212'], eye: '#92400E' },
    { id: 'mallred',  name: 'Mall Red', body: ['#C8102E', '#7A0619'], eye: '#1F1F1F' },
    { id: 'midnight', name: 'Midnight', body: ['#1E1B4B', '#4C1D95'], eye: '#9D174D' },
  ],
  artwork: [ // stops: 3-stop diagonal sweep, eyes painted by the sweep
    { id: 'insta',    name: 'Insta',    stops: ['#833AB4', '#C13584', '#E8590C'] },
    { id: 'sunset',   name: 'Sunset',   stops: ['#A81222', '#C2661A', '#086A6A'] },
    { id: 'ocean',    name: 'Ocean',    stops: ['#0B2559', '#0D6E6E', '#14532D'] },
    { id: 'forest',   name: 'Forest',   stops: ['#14532D', '#3F6212', '#92400E'] },
    { id: 'mallred',  name: 'Mall Red', stops: ['#7A0619', '#C8102E', '#4A044E'] },
    { id: 'midnight', name: 'Midnight', stops: ['#1E1B4B', '#4C1D95', '#9D174D'] },
  ],
};

function drawStyledQr(url, styleId, palette, logoImg) {
  const ec = (styleId === 'classic' && !logoImg) ? 'M' : 'H';
  const qr = qrcode(0, ec);
  qr.addData(url);
  qr.make();
  const n = qr.getModuleCount(), box = 10, border = 4;
  const size = (n + border * 2) * box;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);

  const dark = (r, col) => r >= 0 && col >= 0 && r < n && col < n && qr.isDark(r, col);
  const inEye = (r, col) => (r < 7 && col < 7) || (r < 7 && col >= n - 7) || (r >= n - 7 && col < 7);

  if (styleId === 'classic') {
    ctx.fillStyle = '#000';
    for (let r = 0; r < n; r++)
      for (let col = 0; col < n; col++)
        if (dark(r, col)) ctx.fillRect((border + col) * box, (border + r) * box, box, box);
  } else {
    // Neighbor-aware "blob" modules: a corner is rounded only when both
    // orthogonal neighbors on that corner are light (port of Python's
    // RoundedModuleDrawer look).
    const blobPath = (filter) => {
      const p = new Path2D(), rad = box / 2;
      for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) {
        if (!dark(r, col) || !filter(r, col)) continue;
        const x = (border + col) * box, y = (border + r) * box;
        const up = dark(r - 1, col), down = dark(r + 1, col),
              left = dark(r, col - 1), right = dark(r, col + 1);
        p.roundRect(x, y, box, box, [
          (!up && !left) ? rad : 0, (!up && !right) ? rad : 0,
          (!down && !right) ? rad : 0, (!down && !left) ? rad : 0,
        ]);
      }
      return p;
    };
    let bodyFill;
    if (styleId === 'social') {
      bodyFill = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.72);
      bodyFill.addColorStop(0, palette.body[0]);
      bodyFill.addColorStop(1, palette.body[1]);
      ctx.fillStyle = bodyFill;
      ctx.fill(blobPath((r, col) => !inEye(r, col)));
      ctx.fillStyle = palette.eye;
      ctx.fill(blobPath(inEye));
    } else { // artwork: one 3-stop diagonal sweep over everything, eyes included
      bodyFill = ctx.createLinearGradient(0, 0, size, size);
      bodyFill.addColorStop(0, palette.stops[0]);
      bodyFill.addColorStop(0.5, palette.stops[1]);
      bodyFill.addColorStop(1, palette.stops[2]);
      ctx.fillStyle = bodyFill;
      ctx.fill(blobPath(() => true));
    }
  }

  if (logoImg) {
    const target = Math.floor(size * 0.22);
    const scale = Math.min(target / logoImg.width, target / logoImg.height, 1);
    const lw = Math.round(logoImg.width * scale), lh = Math.round(logoImg.height * scale);
    const pad = Math.max(6, Math.round(target * 0.16));
    const bw = lw + pad * 2, bh = lh + pad * 2;
    const bx = (size - bw) / 2, by = (size - bh) / 2;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, Math.round(Math.min(bw, bh) * 0.22));
    ctx.fill();
    ctx.drawImage(logoImg, bx + pad, by + pad, lw, lh);
  }
  return c;
}

function scanCheck(canvas) {
  if (typeof jsQR !== 'function') return false;
  const ctx = canvas.getContext('2d');
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const res = jsQR(d.data, d.width, d.height);
  return res ? res.data : false;
}
