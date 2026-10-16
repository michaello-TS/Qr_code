'use strict';
const CFG = {
  owner: 'michaello-TS',
  repo: 'Qr_code',
  branch: 'main',
  base: 'https://michaello-ts.github.io/Qr_code/',
};
let TOKEN = localStorage.getItem('qr_admin_token') || '';

// Bookmarkable link support: .../admin/#key=github_pat_...
// The #key part never leaves the browser (fragments aren't sent to servers).
// We save it, then wipe it from the address bar so it isn't shoulder-surfed.
{
  const m = location.hash.match(/[#&]key=([^&]+)/);
  if (m) {
    TOKEN = decodeURIComponent(m[1]);
    localStorage.setItem('qr_admin_token', TOKEN);
    history.replaceState(null, '', location.pathname + location.search);
  }
}
let TREE = [];        // full repo file list
let LOGOS = [];       // paths under logos/
let CAMPAIGNS = [];   // {slug, dest, qrPath}

// ---------- GitHub API ----------
async function gh(path, opts = {}) {
  const res = await fetch('https://api.github.com' + path, {
    ...opts,
    headers: {
      'Authorization': 'Bearer ' + TOKEN,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) {
    let msg = 'HTTP ' + res.status;
    try { msg = (await res.json()).message || msg; } catch (e) {}
    if (res.status === 401) msg = 'GitHub rejected the key (it may have expired). ' + msg;
    throw new Error(msg);
  }
  return res.json();
}
const encPath = p => p.split('/').map(encodeURIComponent).join('/');
const b64encode = s => btoa(unescape(encodeURIComponent(s)));
const b64decode = s => decodeURIComponent(escape(atob(s.replace(/\s/g, ''))));
// Anything read from the repo or from an error is shown as plain text, never as page code.
const esc = s => String(s).replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const safeHref = u => /^https?:\/\//i.test(u) ? esc(u) : '#';

// Normalise a typed destination. The browser's URL parser percent-encodes
// " < > and spaces, so the result can't break out of the redirect page.
const DEST_RULE = 'Destination must be a full link starting with https:// (or http://).';
function cleanDest(raw) {
  let u;
  try { u = new URL(raw.trim()); } catch (e) { throw new Error(DEST_RULE); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:')
    throw new Error(DEST_RULE);
  return u.href;
}

async function putFile(path, base64Content, message, sha) {
  const body = { message, content: base64Content, branch: CFG.branch };
  if (sha) body.sha = sha;
  return gh(`/repos/${CFG.owner}/${CFG.repo}/contents/${encPath(path)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}
async function getFile(path) {
  return gh(`/repos/${CFG.owner}/${CFG.repo}/contents/${encPath(path)}?ref=${CFG.branch}`);
}

// ---------- redirect page template (meta refresh — required format) ----------
function redirectHtml(url) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=${url}">
  <script>window.location.replace(${JSON.stringify(url)});<\/script>
  <title>Redirecting...</title>
</head>
<body>
  <p>Redirecting... <a href="${url}">Click here if not redirected.</a></p>
</body>
</html>
`;
}

// ---------- QR style form helpers (drawing lives in qr-styles.js) ----------
function populatePalette(sel, styleId) {
  sel.innerHTML = QR_PALETTES[styleId].map(p => `<option value="${p.id}">${p.name}</option>`).join('') +
    '<option value="@custom">Custom colors…</option>';
}
function currentStyleConfig(prefix) {
  const styleId = document.getElementById(prefix + 'Style').value;
  if (styleId === 'classic') return { styleId, palette: null, custom: false };
  const pid = document.getElementById(prefix + 'Palette').value;
  if (pid !== '@custom')
    return { styleId, palette: QR_PALETTES[styleId].find(p => p.id === pid), custom: false };
  const c = i => document.getElementById(prefix + 'C' + i).value;
  return {
    styleId, custom: true,
    palette: styleId === 'social' ? { body: [c(1), c(2)], eye: c(3) } : { stops: [c(1), c(2), c(3)] },
  };
}
async function refreshPreview() {
  const slug = document.getElementById('newSlug').value.trim() || 'preview';
  const cfg = currentStyleConfig('new');
  let logo = null;
  try { logo = await logoImageFor(document.getElementById('newLogo').value); } catch (e) {}
  const canvas = drawStyledQr(CFG.base + slug + '/', cfg.styleId, cfg.palette, logo);
  canvas.style.maxWidth = '240px';
  const box = document.getElementById('newPreview');
  box.innerHTML = '';
  box.appendChild(canvas);
}
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load logo image: ' + src));
    img.src = src;
  });
}
async function logoImageFor(choice) {
  // choice: '' = none, '@upload' = local file, otherwise a repo path like logos/instagram.png
  if (!choice) return null;
  if (choice === '@upload') {
    const f = document.getElementById('newLogoFile').files[0];
    if (!f) throw new Error('Pick a logo image file first.');
    const dataUrl = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(new Error('Could not read that file.'));
      r.readAsDataURL(f);
    });
    return loadImage(dataUrl);
  }
  return loadImage('../' + choice); // same-origin on GitHub Pages
}
// Every QR is read back with jsQR before it is saved; refuse one a phone might not read.
function assertScans(canvas, qrUrl, cfg) {
  if (scanCheck(canvas) === qrUrl) return;
  throw new Error(cfg.custom
    ? 'These colors are too light for scanners — darken them.'
    : 'This QR didn\'t pass the scan test — try a different logo or style.');
}
function canvasBase64(c) {
  return c.toDataURL('image/png').split(',')[1];
}

// ---------- load & render ----------
async function loadAll() {
  document.getElementById('loading').hidden = false;
  document.getElementById('list').innerHTML = '';
  const t = await gh(`/repos/${CFG.owner}/${CFG.repo}/git/trees/${encodeURIComponent(CFG.branch)}?recursive=1`);
  TREE = t.tree;

  LOGOS = TREE.filter(e => e.type === 'blob' && /^logos\/.+\.(png|jpe?g|webp)$/i.test(e.path)).map(e => e.path);
  const logoSel = document.getElementById('newLogo');
  logoSel.innerHTML = '<option value="">No logo</option>' +
    LOGOS.map(p => `<option value="${esc(p)}">${esc(p.replace(/^logos\//, '').replace(/\.[^.]+$/, ''))}</option>`).join('') +
    '<option value="@upload">Upload from this device…</option>';

  const qrSet = new Set(TREE.filter(e => /^qr-codes\/.+\.png$/.test(e.path)).map(e => e.path));
  const pages = TREE.filter(e =>
    e.type === 'blob' && e.path.endsWith('/index.html') && !e.path.startsWith('admin/'));

  CAMPAIGNS = await Promise.all(pages.map(async e => {
    const slug = e.path.slice(0, -'/index.html'.length);
    let dest = '';
    try {
      const blob = await gh(`/repos/${CFG.owner}/${CFG.repo}/git/blobs/${e.sha}`);
      // Read the link from the "Click here" href: unlike the meta tag, it is
      // always double-quoted, so links containing ' come back whole.
      const html = b64decode(blob.content);
      const m = html.match(/href="([^"]+)"/i) || html.match(/url=([^"']+)["']/i);
      dest = m ? m[1] : '';
    } catch (err) { /* leave dest blank */ }
    // QR image: usually qr-codes/qr-<slug>.png; older nested campaigns used the last name part
    const candidates = [
      `qr-codes/qr-${slug.replace(/\//g, '-')}.png`,
      `qr-codes/qr-${slug.split('/').pop()}.png`,
    ];
    const qrPath = candidates.find(p => qrSet.has(p)) || candidates[0];
    return { slug, dest, qrPath, hasQr: qrSet.has(qrPath) };
  }));
  CAMPAIGNS.sort((a, b) => a.slug.localeCompare(b.slug));
  renderList();
  refreshPreview();
}

function renderList() {
  document.getElementById('loading').hidden = true;
  document.getElementById('count').textContent = CAMPAIGNS.length;
  const html = CAMPAIGNS.map((c, i) => `
    <div class="campaign" id="camp-${i}">
      <div class="slug">${esc(c.slug)}</div>
      <div class="dest">sends people to → <a href="${safeHref(c.dest)}" target="_blank" rel="noopener">${esc(c.dest) || '(unknown)'}</a></div>
      <div class="dest">QR link: <a href="${esc(CFG.base + c.slug)}/" target="_blank" rel="noopener">${esc(CFG.base + c.slug)}/</a></div>
      <button class="small secondary" data-act="toggleEdit" data-i="${i}">Change destination</button>
      <button class="small secondary" data-act="toggleLogo" data-i="${i}">Restyle QR</button>
      ${c.hasQr ? `<button class="small secondary" data-act="showQr" data-i="${i}">View QR</button>` : ''}
      <div id="edit-${i}" class="inline-form" hidden>
        <label>New destination for <b>${esc(c.slug)}</b> (QR code stays the same)</label>
        <input type="url" id="editUrl-${i}" placeholder="https://..." value="${esc(c.dest)}">
        <button class="small" data-act="updateDest" data-i="${i}">Save change</button>
        <div id="editMsg-${i}"></div>
      </div>
      <div id="logo-${i}" class="inline-form" hidden>
        <label>Remake this campaign's QR image (the link it scans to stays the same)</label>
        <select id="re${i}Style" data-change="restyleControls" data-i="${i}">
          <option value="classic">Classic black & white</option>
          <option value="social">Social gradient</option>
          <option value="artwork">Multi-color artwork fill</option>
        </select>
        <div id="re${i}PaletteWrap" hidden>
          <select id="re${i}Palette" data-change="restyleControls" data-i="${i}" class="mt8"></select>
          <div id="re${i}CustomWrap" hidden>
            <input type="color" id="re${i}C1" value="#833AB4">
            <input type="color" id="re${i}C2" value="#E1306C">
            <input type="color" id="re${i}C3" value="#F58529">
          </div>
        </div>
        <select id="re${i}Logo" class="mt8">
          <option value="">No logo</option>
          ${LOGOS.map(p => `<option value="${esc(p)}">${esc(p.replace(/^logos\//, '').replace(/\.[^.]+$/, ''))}</option>`).join('')}
        </select>
        <button class="small" data-act="restyleQr" data-i="${i}">Remake QR image</button>
        <div id="logoMsg-${i}"></div>
      </div>
      <div id="qr-${i}" class="qrbox" hidden></div>
    </div>`).join('');
  document.getElementById('list').innerHTML = html || '<p class="hint">No campaigns yet — create your first one above.</p>';
}

function toggleEdit(i) { toggle(`edit-${i}`); document.getElementById(`logo-${i}`).hidden = true; }
function toggleLogo(i) { toggle(`logo-${i}`); document.getElementById(`edit-${i}`).hidden = true; }
function toggle(id) { const el = document.getElementById(id); el.hidden = !el.hidden; }

function showQr(i) {
  const c = CAMPAIGNS[i];
  const box = document.getElementById(`qr-${i}`);
  if (!box.hidden) { box.hidden = true; return; }
  box.innerHTML = `<img src="../${esc(c.qrPath)}" alt="QR for ${esc(c.slug)}">
    <br><a href="../${esc(c.qrPath)}" download="qr-${esc(c.slug.replace(/\//g, '-'))}.png"><button class="small secondary">Download PNG</button></a>`;
  box.hidden = false;
}

// ---------- actions ----------
function setMsg(id, text, cls) {
  document.getElementById(id).innerHTML = text ? `<div class="${cls}">${text}</div>` : '';
}

async function createCampaign() {
  const slug = document.getElementById('newSlug').value.trim();
  const destRaw = document.getElementById('newDest').value;
  const logoChoice = document.getElementById('newLogo').value;
  const btn = document.getElementById('createBtn');
  setMsg('createMsg', '', '');
  document.getElementById('createQr').innerHTML = '';
  try {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
      throw new Error('Campaign name must be lowercase letters, numbers and hyphens only (e.g. summer-sale).');
    const dest = cleanDest(destRaw);
    if (TREE.some(e => e.path === slug + '/index.html' || e.path.startsWith(slug + '/')))
      throw new Error(`"${slug}" already exists. Use "Change destination" on it below instead.`);

    btn.disabled = true; btn.textContent = 'Creating…';
    const qrUrl = CFG.base + slug + '/';
    const cfg = currentStyleConfig('new');
    const logoImg = await logoImageFor(logoChoice);
    const canvas = drawStyledQr(qrUrl, cfg.styleId, cfg.palette, logoImg);
    assertScans(canvas, qrUrl, cfg);

    try {
      await putFile(`${slug}/index.html`, b64encode(redirectHtml(dest)), `redirect: add ${slug}`);
    } catch (err) {
      if (/"sha" wasn't supplied/.test(err.message))
        throw new Error(`"${slug}" already exists (it may have just been made on another device). Reload this page to see it.`);
      throw err;
    }
    // The campaign page now exists, so list it even if the image upload fails.
    // (GitHub's file listing lags a few seconds behind new commits, so add it
    // locally instead of re-fetching.)
    const qrPath = `qr-codes/qr-${slug}.png`;
    const camp = { slug, dest, qrPath, hasQr: false };
    TREE.push({ path: `${slug}/index.html`, type: 'blob' });
    CAMPAIGNS.push(camp);
    CAMPAIGNS.sort((a, b) => a.slug.localeCompare(b.slug));
    try {
      await putFile(qrPath, canvasBase64(canvas), `redirect: add ${slug}`);
    } catch (err) {
      renderList();
      throw new Error(`The campaign page for "${slug}" was saved and works, but its QR image didn't upload (${err.message}). ` +
        `Find ${slug} in the list below and press "Restyle QR" to make the image.`);
    }
    camp.hasQr = true;

    setMsg('createMsg', `Done! <b>${slug}</b> is saved. The QR below is ready to use right now — ` +
      `it points to <a href="${qrUrl}" target="_blank" rel="noopener">${qrUrl}</a> ` +
      `(live on the web in about a minute).`, 'ok');
    const box = document.getElementById('createQr');
    box.appendChild(canvas);
    const dl = document.createElement('a');
    dl.href = canvas.toDataURL('image/png');
    dl.download = `qr-${slug}.png`;
    dl.innerHTML = '<br><button class="small secondary">Download PNG</button>';
    box.appendChild(dl);
    document.getElementById('newSlug').value = '';
    document.getElementById('newDest').value = '';
    document.getElementById('newLogo').value = '';
    document.getElementById('newLogoFile').hidden = true;
    renderList();
  } catch (err) {
    setMsg('createMsg', esc(err.message), 'err');
  } finally {
    btn.disabled = false; btn.textContent = 'Create campaign & QR code';
  }
}

async function updateDest(i) {
  const c = CAMPAIGNS[i];
  setMsg(`editMsg-${i}`, '', '');
  try {
    const url = cleanDest(document.getElementById(`editUrl-${i}`).value);
    const f = await getFile(`${c.slug}/index.html`);
    await putFile(`${c.slug}/index.html`, b64encode(redirectHtml(url)), `redirect: update ${c.slug}`, f.sha);
    setMsg(`editMsg-${i}`, 'Saved. The QR code now sends people to the new link (live in about a minute).', 'ok');
    c.dest = url;
    setTimeout(renderList, 1500);
  } catch (err) {
    setMsg(`editMsg-${i}`, esc(err.message), 'err');
  }
}

function restyleControls(i) {
  const styleId = document.getElementById(`re${i}Style`).value;
  const wrap = document.getElementById(`re${i}PaletteWrap`);
  wrap.hidden = styleId === 'classic';
  if (styleId !== 'classic') {
    const sel = document.getElementById(`re${i}Palette`);
    const keep = sel.value;
    populatePalette(sel, styleId);
    if ([...sel.options].some(o => o.value === keep)) sel.value = keep;
    document.getElementById(`re${i}CustomWrap`).hidden = sel.value !== '@custom';
  }
}

async function restyleQr(i) {
  const c = CAMPAIGNS[i];
  setMsg(`logoMsg-${i}`, '', '');
  try {
    const cfg = currentStyleConfig(`re${i}`);
    const logoChoice = document.getElementById(`re${i}Logo`).value;
    const logoImg = logoChoice ? await loadImage('../' + logoChoice) : null;
    const qrUrl = CFG.base + c.slug + '/';
    const canvas = drawStyledQr(qrUrl, cfg.styleId, cfg.palette, logoImg);
    assertScans(canvas, qrUrl, cfg);
    let sha;
    try { sha = (await getFile(c.qrPath)).sha; } catch (e) { /* new file */ }
    await putFile(c.qrPath, canvasBase64(canvas), `redirect: restyle QR for ${c.slug}`, sha);
    c.hasQr = true;
    setMsg(`logoMsg-${i}`, 'New QR image saved — shown below. It replaces the old image but scans to the same link.', 'ok');
    const box = document.getElementById(`qr-${i}`);
    box.innerHTML = '';
    box.appendChild(canvas);
    const dl = document.createElement('a');
    dl.href = canvas.toDataURL('image/png');
    dl.download = `qr-${c.slug.replace(/\//g, '-')}.png`;
    dl.innerHTML = '<br><button class="small secondary">Download PNG</button>';
    box.appendChild(dl);
    box.hidden = false;
  } catch (err) {
    setMsg(`logoMsg-${i}`, esc(err.message), 'err');
  }
}

// ---------- token handling ----------
function saveToken() {
  const t = document.getElementById('tokenInput').value.trim();
  if (!t) { document.getElementById('setupErr').textContent = 'Paste the key first.'; return; }
  TOKEN = t;
  localStorage.setItem('qr_admin_token', t);
  boot();
}
function changeToken() {
  localStorage.removeItem('qr_admin_token');
  TOKEN = '';
  hideShareFallback();
  setMsg('shareMsg', '', '');
  boot();
}
function hideShareFallback() {
  const box = document.getElementById('shareLink');
  box.value = '';
  box.type = 'password';
  document.getElementById('revealShareBtn').textContent = 'Show link';
  document.getElementById('shareFallback').hidden = true;
}
async function copyShareLink() {
  const link = location.origin + location.pathname + '#key=' + encodeURIComponent(TOKEN);
  try {
    await navigator.clipboard.writeText(link);
    hideShareFallback();
    setMsg('shareMsg', 'Copied! Paste it somewhere private (AirDrop, password manager, direct message).', 'ok');
  } catch (e) {
    // Clipboard blocked: keep the link masked (it contains the key) until
    // the user deliberately presses "Show link" and copies it by hand.
    hideShareFallback();
    document.getElementById('shareLink').value = link;
    document.getElementById('shareFallback').hidden = false;
    setMsg('shareMsg', 'Copy failed — press "Show link", then select the link and copy it by hand. ' +
      'Check nobody can see your screen, and press "Hide link" when done.', 'err');
  }
}
function toggleShareReveal() {
  const box = document.getElementById('shareLink');
  const show = box.type === 'password';
  box.type = show ? 'text' : 'password';
  document.getElementById('revealShareBtn').textContent = show ? 'Hide link' : 'Show link';
  if (show) box.select();
}
async function boot() {
  const hasToken = !!TOKEN;
  document.getElementById('setup').hidden = hasToken;
  document.getElementById('create').hidden = !hasToken;
  document.getElementById('listCard').hidden = !hasToken;
  document.getElementById('share').hidden = !hasToken;
  if (!hasToken) return;
  try {
    await loadAll();
  } catch (err) {
    document.getElementById('loading').hidden = true;
    document.getElementById('list').innerHTML = `<div class="err">Could not load campaigns: ${esc(err.message)}</div>`;
  }
}
document.getElementById('newStyle').addEventListener('change', e => {
  const styled = e.target.value !== 'classic';
  document.getElementById('newPaletteWrap').hidden = !styled;
  if (styled) {
    populatePalette(document.getElementById('newPalette'), e.target.value);
    document.getElementById('newCustomWrap').hidden = true;
  }
  refreshPreview();
});
document.getElementById('newPalette').addEventListener('change', e => {
  document.getElementById('newCustomWrap').hidden = e.target.value !== '@custom';
  refreshPreview();
});
for (const id of ['newC1', 'newC2', 'newC3'])
  document.getElementById(id).addEventListener('input', refreshPreview);
document.getElementById('newSlug').addEventListener('input', refreshPreview);
document.getElementById('newLogo').addEventListener('change', e => {
  document.getElementById('newLogoFile').hidden = e.target.value !== '@upload';
  refreshPreview();
});
document.getElementById('newLogoFile').addEventListener('change', refreshPreview);

// Buttons are wired up here rather than with inline handler attributes,
// because the page's Content-Security-Policy blocks inline scripts.
document.getElementById('saveTokenBtn').addEventListener('click', saveToken);
document.getElementById('createBtn').addEventListener('click', createCampaign);
document.getElementById('copyShareBtn').addEventListener('click', copyShareLink);
document.getElementById('revealShareBtn').addEventListener('click', toggleShareReveal);
document.getElementById('changeTokenBtn').addEventListener('click', changeToken);
const LIST_ACTIONS = { toggleEdit, toggleLogo, showQr, updateDest, restyleQr, restyleControls };
const listEl = document.getElementById('list');
listEl.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (el && listEl.contains(el)) LIST_ACTIONS[el.dataset.act](Number(el.dataset.i));
});
listEl.addEventListener('change', e => {
  const el = e.target.closest('[data-change]');
  if (el && listEl.contains(el)) LIST_ACTIONS[el.dataset.change](Number(el.dataset.i));
});
boot();
