// Small DOM helpers. All API text is inserted as text nodes, never as HTML.

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

const PATHS = {
  play: 'M8 5.5v13l11-6.5z',
  pause: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z',
  next: 'M6 6l8.5 6L6 18zM16 6h2v12h-2z',
  prev: 'M18 6l-8.5 6L18 18zM6 6h2v12H6z',
  shuffle: 'M4 7h3.5c2 0 3.2 1 4.3 2.7l1.4 2.2c1.1 1.8 2.3 2.6 4.3 2.6H20m0 0-2.5-2.5M20 14.5 17.5 17M4 17h3.5c1.2 0 2.1-.3 2.9-1M20 9.5h-2.5c-1.2 0-2.1.3-2.9 1M20 9.5 17.5 7M20 9.5 17.5 12',
  repeat: 'M5 12V9.5A2.5 2.5 0 0 1 7.5 7H18m0 0-2.5-2.5M18 7l-2.5 2.5M19 12v2.5a2.5 2.5 0 0 1-2.5 2.5H6m0 0 2.5 2.5M6 17l2.5-2.5',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  home: 'M4 11l8-6.5 8 6.5V20h-5.5v-5.5h-5V20H4z',
  search: 'M10.5 4a6.5 6.5 0 1 0 4 11.6l4.2 4.2 1.4-1.4-4.2-4.2A6.5 6.5 0 0 0 10.5 4zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z',
  library: 'M5 4h2v16H5zM9.5 4h2v16h-2zM14 4.6l1.9-.6 4.6 15.3-1.9.6z',
  queue: 'M4 6h12v2H4zM4 11h12v2H4zM4 16h7v2H4zM15 15l5 3-5 3z',
  devices: 'M4 5h12v9H4zM2 16h16v2H2zM18.5 8H22v11h-3.5z',
  volume: 'M4 9h4l5-4v14l-5-4H4zM16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12',
  mute: 'M4 9h4l5-4v14l-5-4H4zM16.5 9.5l5 5M21.5 9.5l-5 5',
  more: 'M5 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
  settings: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.5h-4L10.6 6a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.4z',
  back: 'M15 5l-7 7 7 7',
  forward: 'M9 5l7 7-7 7',
  clock: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 2v6l4 2',
  note: 'M10 17.5a2.5 2.5 0 1 1-2.5-2.5H10V5l9-1.5v11a2.5 2.5 0 1 1-2.5-2.5H19',
};
const STROKED = new Set(['shuffle', 'repeat', 'back', 'forward', 'clock', 'volume', 'mute', 'note']);

export function icon(name, size = 20) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('icon');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', PATHS[name]);
  if (STROKED.has(name)) { p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '1.8'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); }
  else p.setAttribute('fill', 'currentColor');
  svg.append(p);
  return svg;
}

export const fmtTime = ms => {
  const s = Math.max(0, Math.floor((ms || 0) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};
export const fmtLong = ms => {
  const m = Math.round((ms || 0) / 60000);
  return m >= 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m} min`;
};
export const plural = (n, word) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

/** Pick the smallest image at least `min` px wide. */
export function img(images, min = 64) {
  if (!images?.length) return null;
  const sorted = [...images].sort((a, b) => (a.width || 640) - (b.width || 640));
  return (sorted.find(i => (i.width || 640) >= min) || sorted[sorted.length - 1]).url;
}

/** Strip HTML from Spotify descriptions (they contain links and entities). */
export function plainText(html) {
  if (!html) return '';
  return new DOMParser().parseFromString(html, 'text/html').body.textContent || '';
}

/** Average color of an image, nudged to be usable as a header tint. Returns null if the image is not readable. */
export function tintFrom(url) {
  return new Promise(resolve => {
    if (!url) return resolve(null);
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = 24;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(im, 0, 0, 24, 24);
        const d = ctx.getImageData(0, 0, 24, 24).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) {
          const max = Math.max(d[i], d[i + 1], d[i + 2]), min = Math.min(d[i], d[i + 1], d[i + 2]);
          const w = 1 + (max - min) / 32; // favor saturated pixels
          r += d[i] * w; g += d[i + 1] * w; b += d[i + 2] * w; n += w;
        }
        resolve([r / n, g / n, b / n].map(Math.round));
      } catch { resolve(null); }
    };
    im.onerror = () => resolve(null);
    im.src = url;
  });
}

let toastTimer;
export function toast(message, kind = 'info') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.dataset.kind = kind;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, kind === 'error' ? 6000 : 2600);
}
