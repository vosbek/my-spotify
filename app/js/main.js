import { getClientId, handleCallback, isSignedIn, login, logout, redirectUri, setClientId } from './auth.js';
import { api, ApiError, entryTrack, idOf, playlistTotal } from './api.js';
import { controls, initSdk, livePosition, player, startPolling, unlockAudio } from './player.js';
import { fmtLong, fmtTime, h, icon, img, plainText, plural, tintFrom, toast } from './ui.js';

const $ = sel => document.querySelector(sel);
const view = () => $('#view');
const state = { me: null, library: { playlists: [], albums: [], artists: [] }, filter: 'all', libQuery: '', liked: new Map() };

// ---------------------------------------------------------------- theme

function applyTheme(choice) {
  const root = document.documentElement;
  if (choice === 'light' || choice === 'dark') root.dataset.theme = choice; else delete root.dataset.theme;
  try { localStorage.setItem('msp.theme', choice); } catch { /* ignore */ }
}
applyTheme((() => { try { return localStorage.getItem('msp.theme') || 'system'; } catch { return 'system'; } })());

// ---------------------------------------------------------------- errors

function explain(err) {
  if (err instanceof ApiError) {
    if (err.status === 403 && /premium/i.test(err.message)) return 'This needs Spotify Premium.';
    if (err.status === 403) return 'Spotify refused this request. If you just created your app, add your account under User Management in the Spotify dashboard.';
    if (err.status === 404 && /device/i.test(err.message)) return 'No active device. Press play on a song to start one.';
    return `Spotify: ${err.message}`;
  }
  if (err?.message === 'signed-out') return 'You were signed out.';
  return err?.message || String(err);
}
const guard = fn => async (...args) => { try { return await fn(...args); } catch (err) { toast(explain(err), 'error'); } };

// ---------------------------------------------------------------- gate (setup + sign-in)

function renderGate(errorText) {
  document.body.classList.add('gated');
  const gate = $('#gate');
  gate.hidden = false;
  const clientId = getClientId();
  const input = h('input', { id: 'client-id', value: clientId, placeholder: '32-character Client ID', autocomplete: 'off', spellcheck: 'false' });
  const uri = redirectUri();
  const copyBtn = h('button', { class: 'ghost small', type: 'button', onClick: async () => {
    try { await navigator.clipboard.writeText(uri); copyBtn.textContent = 'Copied'; } catch { copyBtn.textContent = 'Select and copy'; }
  } }, 'Copy');
  const form = h('form', { class: 'gate-form', onSubmit: e => {
    e.preventDefault();
    const v = input.value.trim();
    if (!/^[0-9a-f]{32}$/i.test(v)) { err.textContent = 'A Client ID is 32 letters and numbers. Copy it from your app’s Settings page.'; err.hidden = false; return; }
    setClientId(v);
    login().catch(x => { err.textContent = x.message; err.hidden = false; });
  } });
  const err = h('p', { class: 'gate-error', role: 'alert', hidden: !errorText }, errorText || '');
  form.append(
    h('label', { for: 'client-id' }, 'Spotify Client ID'),
    h('div', { class: 'row' }, input, h('button', { class: 'primary', type: 'submit' }, clientId ? 'Sign in with Spotify' : 'Save and sign in')),
    err,
  );
  gate.replaceChildren(h('div', { class: 'gate-card' },
    h('div', { class: 'brand big' }, h('span', { class: 'mark' }, icon('note', 26)), 'mySpotify'),
    h('p', { class: 'lede' }, 'Your library, your keyboard shortcuts, your look. Plays through your Spotify Premium account.'),
    h('ol', { class: 'setup' },
      h('li', {}, 'Open ', h('a', { href: 'https://developer.spotify.com/dashboard', target: '_blank', rel: 'noopener' }, 'developer.spotify.com/dashboard'), ' and choose Create app.'),
      h('li', {}, 'Tick Web API and Web Playback SDK. Add this Redirect URI:',
        h('div', { class: 'uri' }, h('code', {}, uri), copyBtn)),
      h('li', {}, 'Save, open the app’s Settings, and copy its Client ID here. No secret is needed.'),
    ),
    form,
    h('p', { class: 'fine' }, 'mySpotify runs on this computer and talks only to Spotify. Your sign-in stays in this browser.'),
  ));
  input.focus();
}

// ---------------------------------------------------------------- router

const routes = {
  home: renderHome, search: renderSearch, playlist: renderPlaylist, album: renderAlbum, artist: renderArtist,
  liked: renderLiked, queue: renderQueue, settings: renderSettings,
};
let renderToken = 0;
async function route() {
  const [name = 'home', arg = ''] = location.hash.replace(/^#\/?/, '').split('/');
  const fn = routes[name] || renderHome;
  const token = ++renderToken;
  document.querySelectorAll('[data-route]').forEach(a => a.classList.toggle('active', a.dataset.route === name));
  document.querySelectorAll('.lib-item').forEach(a => a.classList.toggle('active', a.getAttribute('href') === location.hash));
  const v = view();
  v.scrollTop = 0;
  v.style.removeProperty('--tint');
  v.replaceChildren(h('div', { class: 'loading' }, h('span', {}), h('span', {}), h('span', {})));
  try {
    const node = await fn(decodeURIComponent(arg));
    if (token === renderToken) v.replaceChildren(node);
  } catch (err) {
    if (token === renderToken) v.replaceChildren(h('div', { class: 'empty' }, h('h2', {}, 'This page didn’t load'), h('p', {}, explain(err))));
  }
}
const go = hash => { location.hash = hash; };

// ---------------------------------------------------------------- shared pieces

function cover(images, size, round = false) {
  const url = img(images, size);
  return url ? h('img', { class: `cover${round ? ' round' : ''}`, src: url, alt: '', loading: 'lazy', width: size, height: size })
    : h('div', { class: `cover placeholder${round ? ' round' : ''}`, style: { width: `${size}px`, height: `${size}px` } }, icon('note', size / 3));
}

const artistLinks = artists => (artists || []).flatMap((a, i) => [i ? ', ' : '', a.id ? h('a', { href: `#/artist/${a.id}` }, a.name) : a.name]);

function card(kind, item, sub) {
  const href = `#/${kind}/${item.id}`;
  const play = h('button', { class: 'card-play', 'aria-label': `Play ${item.name}`, onClick: guard(async e => { e.preventDefault(); e.stopPropagation(); await controls.play({ contextUri: item.uri }); }) }, icon('play', 22));
  return h('a', { class: `card ${kind}`, href }, h('div', { class: 'card-art' }, cover(item.images, 180, kind === 'artist'), play),
    h('div', { class: 'card-title' }, item.name), h('div', { class: 'card-sub' }, sub));
}

const shelf = (title, items, extra) => items.length ? h('section', { class: 'shelf' }, h('div', { class: 'shelf-head' }, h('h2', {}, title), extra), h('div', { class: 'grid' }, items)) : null;

async function header({ kind, title, images, meta, description, round, playable }) {
  const url = img(images, 300);
  const tint = await tintFrom(url);
  if (tint) view().style.setProperty('--tint', `${tint[0]} ${tint[1]} ${tint[2]}`);
  return h('header', { class: 'hero' },
    cover(images, 232, round),
    h('div', { class: 'hero-text' },
      h('span', { class: 'eyebrow' }, kind),
      h('h1', { class: title.length > 28 ? 'long' : '' }, title),
      description ? h('p', { class: 'desc' }, description) : null,
      h('p', { class: 'meta' }, meta)),
    playable ? h('div', { class: 'hero-actions' }, h('button', { class: 'big-play', 'aria-label': `Play ${title}`, onClick: guard(playable) }, icon('play', 28))) : null);
}

// Track list with like buttons, keyboard play, and a row menu.
function trackList(tracks, { context, showAlbum = true, showAdded = false, numbered = true, startIndex = 0 } = {}) {
  const list = h('div', { class: 'tracks', role: 'grid', 'aria-label': 'Tracks' });
  list.append(h('div', { class: 'trow head', role: 'row' },
    h('span', { class: 'num' }, '#'), h('span', {}, 'Title'), showAlbum ? h('span', { class: 'col-album' }, 'Album') : h('span', { class: 'col-album' }),
    showAdded ? h('span', { class: 'col-added' }, 'Added') : h('span', { class: 'col-added' }), h('span', {}), h('span', { class: 'dur' }, icon('clock', 16)), h('span', {})));
  const rows = [];
  tracks.forEach((entry, i) => {
    const t = entry.track || entry;
    if (!t || !t.uri) return;
    const unavailable = t.is_playable === false || t.is_local;
    const play = guard(() => {
      if (unavailable) return toast('This track is not available to play.', 'error');
      if (context?.uri) return controls.play({ contextUri: context.uri, offsetUri: t.uri });
      const uris = context?.uris || tracks.map(x => (x.track || x).uri);
      const at = uris.indexOf(t.uri);
      return controls.play({ uris: uris.slice(Math.max(0, at), at + 100), index: 0 });
    });
    const like = h('button', { class: 'like', 'aria-label': 'Save to Liked Songs', 'aria-pressed': 'false', dataset: { uri: t.uri }, onClick: guard(async e => {
      e.stopPropagation();
      const on = like.getAttribute('aria-pressed') !== 'true';
      setLiked(t.uri, on);
      await (on ? api.save([t.uri]) : api.unsave([t.uri]));
      toast(on ? 'Added to Liked Songs' : 'Removed from Liked Songs');
    }) }, icon('heart', 16));
    const more = h('button', { class: 'more', 'aria-label': `More options for ${t.name}`, onClick: e => { e.stopPropagation(); rowMenu(e.currentTarget, t); } }, icon('more', 18));
    const row = h('div', { class: `trow${unavailable ? ' unavailable' : ''}`, role: 'row', tabindex: '0', dataset: { uri: t.uri },
      onDblclick: play, onKeydown: e => { if (e.key === 'Enter') play(); } },
      h('span', { class: 'num' }, h('span', { class: 'n' }, numbered ? startIndex + i + 1 : ''), h('button', { class: 'row-play', 'aria-label': `Play ${t.name}`, onClick: play }, icon('play', 16))),
      h('span', { class: 'title' }, t.album?.images ? cover(t.album.images, 40) : null,
        h('span', { class: 'tt' }, h('span', { class: 'name' }, t.name, t.explicit ? h('span', { class: 'explicit', title: 'Explicit' }, 'E') : null),
          h('span', { class: 'by' }, artistLinks(t.artists)))),
      showAlbum && t.album ? h('span', { class: 'col-album' }, h('a', { href: `#/album/${t.album.id}` }, t.album.name)) : h('span', { class: 'col-album' }),
      showAdded && entry.added_at ? h('span', { class: 'col-added' }, new Date(entry.added_at).toLocaleDateString()) : h('span', { class: 'col-added' }),
      like, h('span', { class: 'dur' }, fmtTime(t.duration_ms)), more);
    rows.push(row);
    list.append(row);
  });
  markPlaying(list);
  refreshLiked(rows.map(r => r.dataset.uri));
  return list;
}

function setLiked(uri, on) {
  state.liked.set(uri, on);
  document.querySelectorAll(`.like[data-uri="${CSS.escape(uri)}"]`).forEach(b => b.setAttribute('aria-pressed', String(on)));
  updateNowLike();
}

async function refreshLiked(uris) {
  const unknown = [...new Set(uris)].filter(u => u.startsWith('spotify:track:') && !state.liked.has(u));
  for (let i = 0; i < unknown.length; i += 40) {
    const chunk = unknown.slice(i, i + 40);
    try {
      const flags = await api.contains(chunk);
      chunk.forEach((u, j) => setLiked(u, !!flags[j]));
    } catch { return; } // saved state is a nicety; never block the page on it
  }
  uris.forEach(u => state.liked.has(u) && setLiked(u, state.liked.get(u)));
}

function rowMenu(anchor, t) {
  closeMenus();
  const items = [
    ['Add to queue', guard(async () => { await controls.queue(t.uri); toast('Added to queue'); })],
    t.album?.id && ['Go to album', () => go(`#/album/${t.album.id}`)],
    t.artists?.[0]?.id && ['Go to artist', () => go(`#/artist/${t.artists[0].id}`)],
    ['Copy song link', async () => { try { await navigator.clipboard.writeText(`https://open.spotify.com/track/${idOf(t.uri)}`); toast('Link copied'); } catch { toast('Could not copy the link', 'error'); } }],
  ].filter(Boolean);
  const menu = h('div', { class: 'menu', role: 'menu' }, items.map(([label, fn]) => h('button', { role: 'menuitem', onClick: () => { closeMenus(); fn(); } }, label)));
  document.body.append(menu);
  const r = anchor.getBoundingClientRect();
  menu.style.top = `${Math.min(r.bottom + 4, innerHeight - menu.offsetHeight - 8)}px`;
  menu.style.left = `${Math.max(8, r.right - menu.offsetWidth)}px`;
  menu.querySelector('button')?.focus();
}
function closeMenus() { document.querySelectorAll('.menu, .popover').forEach(m => m.remove()); }
document.addEventListener('click', e => { if (!e.target.closest('.menu, .popover, .more, [data-popover]')) closeMenus(); });

function markPlaying(root = document) {
  const uri = player.state?.track?.uri;
  root.querySelectorAll('.trow[data-uri]').forEach(r => r.classList.toggle('playing', r.dataset.uri === uri));
}

// Load the rest of a paged list when the "Load more" sentinel scrolls into view.
function pager(nextUrl, load, append) {
  if (!nextUrl) return null;
  const btn = h('button', { class: 'ghost load-more', type: 'button' }, 'Load more');
  let url = nextUrl, busy = false;
  const more = guard(async () => {
    if (busy || !url) return;
    busy = true; btn.textContent = 'Loading…';
    const page = await load(url);
    append(page.items);
    url = page.next; busy = false;
    if (!url) { io.disconnect(); btn.remove(); } else btn.textContent = 'Load more';
  });
  btn.addEventListener('click', more);
  const io = new IntersectionObserver(es => es.some(e => e.isIntersecting) && more(), { root: view(), rootMargin: '600px' });
  queueMicrotask(() => io.observe(btn));
  return btn;
}

// ---------------------------------------------------------------- views

async function renderHome() {
  const hour = new Date().getHours();
  const hello = hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const [recent, topArtists, topTracks] = await Promise.all([
    api.recentlyPlayed().catch(() => null), api.top('artists').catch(() => null), api.top('tracks').catch(() => null),
  ]);
  const seen = new Set();
  const jump = [];
  for (const it of recent?.items || []) {
    const key = it.context?.uri || it.track.album.uri;
    if (seen.has(key)) continue;
    seen.add(key);
    const [kind, id] = key.split(':').slice(1);
    if (kind === 'playlist') {
      const p = state.library.playlists.find(x => x.id === id);
      if (p) jump.push(h('a', { class: 'tile', href: `#/playlist/${id}` }, cover(p.images, 64), h('span', {}, p.name)));
    } else if (kind === 'album') {
      jump.push(h('a', { class: 'tile', href: `#/album/${id}` }, cover(it.track.album.images, 64), h('span', {}, it.track.album.name)));
    } else if (kind === 'artist') {
      const a = it.track.artists.find(x => x.uri === key);
      if (a) jump.push(h('a', { class: 'tile', href: `#/artist/${a.id}` }, cover(it.track.album.images, 64), h('span', {}, a.name)));
    } else if (kind === 'collection') {
      jump.push(h('a', { class: 'tile', href: '#/liked' }, h('div', { class: 'cover liked-cover', style: { width: '64px', height: '64px' } }, icon('heart', 24)), h('span', {}, 'Liked Songs')));
    }
    if (jump.length >= 8) break;
  }
  const tops = (topTracks?.items || []).slice(0, 10);
  return h('div', { class: 'page home' },
    h('h1', { class: 'greeting' }, `${hello}${state.me?.display_name ? `, ${state.me.display_name.split(' ')[0]}` : ''}`),
    jump.length ? h('div', { class: 'tiles' }, jump) : null,
    tops.length ? h('section', { class: 'shelf' }, h('div', { class: 'shelf-head' }, h('h2', {}, 'On repeat lately')),
      trackList(tops, { context: { uris: tops.map(t => t.uri) } })) : null,
    shelf('Your top artists', (topArtists?.items || []).slice(0, 12).map(a => card('artist', a, 'Artist'))),
    shelf('Your playlists', state.library.playlists.slice(0, 12).map(p => card('playlist', p, plural(playlistTotal(p), 'song')))),
    !jump.length && !tops.length && !state.library.playlists.length
      ? h('div', { class: 'empty' }, h('h2', {}, 'Nothing here yet'), h('p', {}, 'Play some music on Spotify and it will show up here.')) : null,
  );
}

let searchTimer;
async function renderSearch(q = '') {
  const box = $('#search');
  if (box.value !== q) box.value = q;
  if (!q.trim()) {
    return h('div', { class: 'page' }, h('h1', {}, 'Search'), h('p', { class: 'muted' }, 'Find songs, artists, albums, and playlists. Press / to jump here from anywhere.'));
  }
  const r = await api.search(q);
  const tracks = r.tracks?.items?.filter(Boolean) || [];
  const artists = r.artists?.items?.filter(Boolean) || [];
  const albums = r.albums?.items?.filter(Boolean) || [];
  const playlists = r.playlists?.items?.filter(Boolean) || [];
  const best = artists[0] && (artists[0].name.toLowerCase().startsWith(q.trim().toLowerCase()) || !tracks.length) ? artists[0] : null;
  return h('div', { class: 'page search' },
    h('div', { class: 'search-top' },
      best ? h('section', { class: 'best' }, h('h2', {}, 'Top result'),
        h('a', { class: 'best-card', href: `#/artist/${best.id}` }, cover(best.images, 96, true), h('strong', {}, best.name), h('span', { class: 'pill' }, 'Artist'))) : null,
      tracks.length ? h('section', { class: 'songs' }, h('h2', {}, 'Songs'), trackList(tracks, { context: { uris: tracks.map(t => t.uri) }, showAlbum: !best })) : null),
    shelf('Artists', artists.map(a => card('artist', a, 'Artist'))),
    shelf('Albums', albums.map(a => card('album', a, `${(a.release_date || '').slice(0, 4)} · ${a.artists.map(x => x.name).join(', ')}`))),
    shelf('Playlists', playlists.map(p => card('playlist', p, `By ${p.owner?.display_name || 'Spotify'}`))),
    !tracks.length && !artists.length && !albums.length && !playlists.length
      ? h('div', { class: 'empty' }, h('h2', {}, `No results for “${q}”`), h('p', {}, 'Check the spelling, or try fewer words.')) : null,
  );
}

async function renderPlaylist(id) {
  const [p, first] = await Promise.all([api.playlist(id), api.playlistItems(id)]);
  const entries = (first.items || []).map(e => ({ ...e, track: entryTrack(e) })).filter(e => e.track);
  const total = playlistTotal(p) || first.total || entries.length;
  const list = trackList(entries, { context: { uri: p.uri }, showAdded: true });
  let shown = entries.length;
  const more = pager(first.next, url => api.next(url), items => {
    const add = items.map(e => ({ ...e, track: entryTrack(e) })).filter(e => e.track);
    const extra = trackList(add, { context: { uri: p.uri }, showAdded: true, startIndex: shown });
    shown += add.length;
    extra.querySelectorAll('.trow:not(.head)').forEach(r => list.append(r));
  });
  return h('div', { class: 'page' },
    await header({ kind: p.public === false ? 'Private playlist' : 'Playlist', title: p.name, images: p.images, description: plainText(p.description),
      meta: [p.owner?.display_name, plural(total, 'song')].filter(Boolean).join(' · '), playable: () => controls.play({ contextUri: p.uri }) }),
    list, more);
}

async function renderAlbum(id) {
  const a = await api.album(id);
  const tracks = a.tracks.items.map(t => ({ ...t, album: { id: a.id, name: a.name, images: null } }));
  const list = trackList(tracks, { context: { uri: a.uri }, showAlbum: false });
  const more = pager(a.tracks.next, url => api.next(url), items => {
    trackList(items.map(t => ({ ...t, album: { id: a.id, name: a.name, images: null } })), { context: { uri: a.uri }, showAlbum: false, startIndex: list.children.length - 1 })
      .querySelectorAll('.trow:not(.head)').forEach(r => list.append(r));
  });
  const length = a.tracks.items.reduce((s, t) => s + t.duration_ms, 0);
  return h('div', { class: 'page' },
    await header({ kind: a.album_type === 'single' ? 'Single' : 'Album', title: a.name, images: a.images,
      meta: [h('span', {}, artistLinks(a.artists)), ' · ', (a.release_date || '').slice(0, 4), ' · ', plural(a.total_tracks, 'song'), a.tracks.next ? '' : `, ${fmtLong(length)}`],
      playable: () => controls.play({ contextUri: a.uri }) }),
    list, more,
    a.copyrights?.length ? h('p', { class: 'fine copyright' }, a.copyrights.map(c => c.text).join('  ·  ')) : null);
}

async function renderArtist(id) {
  const a = await api.artist(id);
  const [top, albums] = await Promise.all([
    api.artistTopTracks(id, a.name).catch(() => []), api.artistAlbums(id).catch(() => ({ items: [] })),
  ]);
  const popular = (top || []).slice(0, 10);
  const grid = shelf('Discography', albums.items.map(al => card('album', al, `${(al.release_date || '').slice(0, 4)} · ${al.album_type}`)));
  const more = grid && pager(albums.next, url => api.next(url), items => {
    items.forEach(al => grid.querySelector('.grid').append(card('album', al, `${(al.release_date || '').slice(0, 4)} · ${al.album_type}`)));
  });
  const followers = a.followers?.total;
  return h('div', { class: 'page' },
    await header({ kind: 'Artist', title: a.name, images: a.images, round: true,
      meta: [followers ? plural(followers, 'follower') : null, (a.genres || []).slice(0, 3).join(', ')].filter(Boolean).join(' · '),
      playable: () => controls.play({ contextUri: a.uri }) }),
    popular.length ? h('section', { class: 'shelf' }, h('h2', {}, 'Popular'), trackList(popular, { context: { uris: popular.map(t => t.uri) } })) : null,
    grid, more);
}

async function renderLiked() {
  const first = await api.savedTracks();
  const uris = first.items.map(e => e.track.uri);
  const list = trackList(first.items, { context: { uris }, showAdded: true });
  first.items.forEach(e => setLiked(e.track.uri, true));
  const more = pager(first.next, url => api.next(url), items => {
    items.forEach(e => { uris.push(e.track.uri); setLiked(e.track.uri, true); });
    trackList(items, { context: { uris }, showAdded: true, startIndex: list.children.length - 1 }).querySelectorAll('.trow:not(.head)').forEach(r => list.append(r));
  });
  view().style.setProperty('--tint', '92 78 196');
  return h('div', { class: 'page' },
    h('header', { class: 'hero' }, h('div', { class: 'cover liked-cover', style: { width: '232px', height: '232px' } }, icon('heart', 80)),
      h('div', { class: 'hero-text' }, h('span', { class: 'eyebrow' }, 'Playlist'), h('h1', {}, 'Liked Songs'),
        h('p', { class: 'meta' }, [state.me?.display_name, plural(first.total, 'song')].filter(Boolean).join(' · '))),
      h('div', { class: 'hero-actions' }, h('button', { class: 'big-play', 'aria-label': 'Play Liked Songs', onClick: guard(() => controls.play({ uris: uris.slice(0, 100) })) }, icon('play', 28)))),
    list, more);
}

async function renderQueue() {
  const q = await api.queue();
  if (!q?.currently_playing) return h('div', { class: 'page' }, h('h1', {}, 'Queue'), h('div', { class: 'empty' }, h('p', {}, 'Nothing is playing. Start a song and your queue will show here.')));
  return h('div', { class: 'page' }, h('h1', {}, 'Queue'),
    h('h2', { class: 'sub' }, 'Now playing'), trackList([q.currently_playing], { numbered: false }),
    h('h2', { class: 'sub' }, 'Next up'), trackList(q.queue.filter(t => t?.uri), { context: { uris: q.queue.map(t => t.uri) } }));
}

async function renderSettings() {
  const themes = ['system', 'light', 'dark'];
  const current = (() => { try { return localStorage.getItem('msp.theme') || 'system'; } catch { return 'system'; } })();
  const sdkStatus = player.sdkError || (player.deviceId ? 'Ready. mySpotify appears as a device in every Spotify app.' : 'Connecting…');
  return h('div', { class: 'page settings' }, h('h1', {}, 'Settings'),
    h('section', {}, h('h2', {}, 'Appearance'),
      h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Theme' }, themes.map(t => h('button', { role: 'radio', 'aria-checked': String(t === current),
        onClick: e => { applyTheme(t); e.currentTarget.parentElement.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b === e.currentTarget))); } }, t[0].toUpperCase() + t.slice(1))))),
    h('section', {}, h('h2', {}, 'Playback on this computer'), h('p', {}, sdkStatus)),
    h('section', {}, h('h2', {}, 'Account'), h('p', {}, state.me ? `Signed in as ${state.me.display_name || state.me.id} (${state.me.product === 'premium' ? 'Premium' : 'Free: playback here needs Premium'})` : ''),
      h('p', { class: 'muted' }, `Client ID ${getClientId().slice(0, 6)}…  ·  Redirect URI ${redirectUri()}`),
      h('button', { class: 'ghost', onClick: () => { logout(); location.hash = ''; location.reload(); } }, 'Sign out')),
    h('section', {}, h('h2', {}, 'Keyboard'), h('dl', { class: 'keys' },
      [['Space', 'Play or pause'], ['Ctrl + →', 'Next track'], ['Ctrl + ←', 'Previous track'], ['Shift + → / ←', 'Seek 10 seconds'],
       ['Ctrl + ↑ / ↓', 'Volume'], ['/', 'Search'], ['Ctrl + S', 'Shuffle'], ['Ctrl + R', 'Repeat'], ['Alt + ← / →', 'Back / forward']]
        .flatMap(([k, d]) => [h('dt', {}, h('kbd', {}, k)), h('dd', {}, d)]))),
  );
}

// ---------------------------------------------------------------- sidebar library

async function loadLibrary() {
  const all = async (first, nextKey = 'next') => {
    const out = [...first.items];
    let next = first[nextKey];
    while (next && out.length < 500) { const page = await api.next(next); out.push(...page.items); next = page.next; }
    return out;
  };
  const [pl, al, ar] = await Promise.all([
    api.playlists().then(all).catch(() => []),
    api.savedAlbums().then(all).catch(() => []),
    api.followedArtists().then(r => r.artists.items).catch(() => []),
  ]);
  state.library = { playlists: pl.filter(Boolean), albums: al.map(x => x.album), artists: ar };
  renderLibrary();
}

function renderLibrary() {
  const { playlists, albums, artists } = state.library;
  const q = state.libQuery.toLowerCase();
  const items = [];
  const want = k => state.filter === 'all' || state.filter === k;
  if (want('playlists') && 'liked songs'.includes(q)) items.push(h('a', { class: 'lib-item', href: '#/liked' }, h('div', { class: 'cover liked-cover', style: { width: '44px', height: '44px' } }, icon('heart', 18)), h('span', { class: 'lt' }, h('span', {}, 'Liked Songs'), h('small', {}, 'Playlist'))));
  if (want('playlists')) playlists.filter(p => p.name.toLowerCase().includes(q)).forEach(p => items.push(h('a', { class: 'lib-item', href: `#/playlist/${p.id}` }, cover(p.images, 44), h('span', { class: 'lt' }, h('span', {}, p.name), h('small', {}, `Playlist · ${p.owner?.display_name || ''}`)))));
  if (want('albums')) albums.filter(a => a.name.toLowerCase().includes(q)).forEach(a => items.push(h('a', { class: 'lib-item', href: `#/album/${a.id}` }, cover(a.images, 44), h('span', { class: 'lt' }, h('span', {}, a.name), h('small', {}, `Album · ${a.artists.map(x => x.name).join(', ')}`)))));
  if (want('artists')) artists.filter(a => a.name.toLowerCase().includes(q)).forEach(a => items.push(h('a', { class: 'lib-item', href: `#/artist/${a.id}` }, cover(a.images, 44, true), h('span', { class: 'lt' }, h('span', {}, a.name), h('small', {}, 'Artist')))));
  $('#library').replaceChildren(...(items.length ? items : [h('p', { class: 'muted pad' }, q ? 'Nothing matches that filter.' : 'Your library is empty.')]));
  document.querySelectorAll('.lib-item').forEach(a => a.classList.toggle('active', a.getAttribute('href') === location.hash));
}

// ---------------------------------------------------------------- player bar

const bar = {};
function buildPlayerBar() {
  const b = $('#playerbar');
  bar.art = h('div', { class: 'np-art' });
  bar.title = h('a', { class: 'np-title' });
  bar.artist = h('div', { class: 'np-artist' });
  bar.like = h('button', { class: 'like', 'aria-label': 'Save to Liked Songs', 'aria-pressed': 'false', onClick: guard(async () => {
    const uri = player.state?.track?.uri; if (!uri) return;
    const on = bar.like.getAttribute('aria-pressed') !== 'true';
    setLiked(uri, on); await (on ? api.save([uri]) : api.unsave([uri]));
  }) }, icon('heart', 18));
  bar.shuffle = h('button', { class: 'ctl', 'aria-label': 'Shuffle', 'aria-pressed': 'false', onClick: guard(controls.shuffle) }, icon('shuffle', 18));
  bar.prev = h('button', { class: 'ctl', 'aria-label': 'Previous', onClick: guard(controls.previous) }, icon('prev', 20));
  bar.play = h('button', { class: 'ctl play', 'aria-label': 'Play', onClick: guard(controls.toggle) }, icon('play', 22));
  bar.next = h('button', { class: 'ctl', 'aria-label': 'Next', onClick: guard(controls.next) }, icon('next', 20));
  bar.repeat = h('button', { class: 'ctl', 'aria-label': 'Repeat', 'aria-pressed': 'false', onClick: guard(controls.repeat) }, icon('repeat', 18));
  bar.pos = h('span', { class: 'time' }, '0:00');
  bar.dur = h('span', { class: 'time' }, '0:00');
  bar.seek = h('input', { type: 'range', id: 'seek', class: 'range', min: '0', max: '1000', value: '0', 'aria-label': 'Seek' });
  let seeking = false;
  bar.seek.addEventListener('input', () => { seeking = true; bar.pos.textContent = fmtTime(bar.seek.value / 1000 * (player.state?.duration || 0)); paintRange(bar.seek); });
  bar.seek.addEventListener('change', guard(async () => { await controls.seek(bar.seek.value / 1000 * (player.state?.duration || 0)); seeking = false; }));
  bar.vol = h('input', { type: 'range', id: 'volume', class: 'range', min: '0', max: '100', value: '70', 'aria-label': 'Volume' });
  let volTimer;
  bar.vol.addEventListener('input', () => { paintRange(bar.vol); clearTimeout(volTimer); volTimer = setTimeout(guard(() => controls.volume(Number(bar.vol.value))), 120); updateMute(); });
  bar.mute = h('button', { class: 'ctl', 'aria-label': 'Mute', onClick: () => {
    const v = Number(bar.vol.value);
    bar.vol.value = v ? 0 : (bar.lastVol || 60); if (v) bar.lastVol = v;
    bar.vol.dispatchEvent(new Event('input'));
  } }, icon('volume', 18));
  bar.devices = h('button', { class: 'ctl', 'aria-label': 'Connect to a device', 'data-popover': '', onClick: guard(devicePopover) }, icon('devices', 18));
  bar.queue = h('a', { class: 'ctl', href: '#/queue', 'aria-label': 'Queue' }, icon('queue', 18));
  bar.device = h('div', { class: 'device-line', hidden: true });
  b.replaceChildren(
    h('div', { class: 'np' }, bar.art, h('div', { class: 'np-text' }, bar.title, bar.artist), bar.like),
    h('div', { class: 'center' }, h('div', { class: 'buttons' }, bar.shuffle, bar.prev, bar.play, bar.next, bar.repeat),
      h('div', { class: 'progress' }, bar.pos, bar.seek, bar.dur)),
    h('div', { class: 'right' }, bar.queue, bar.devices, bar.mute, bar.vol),
    bar.device);
  paintRange(bar.vol);
  const tick = () => {
    const s = player.state;
    if (s && !seeking) {
      const p = livePosition();
      bar.seek.value = s.duration ? Math.round(p / s.duration * 1000) : 0;
      bar.pos.textContent = fmtTime(p);
      paintRange(bar.seek);
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function paintRange(r) { r.style.setProperty('--fill', `${(r.value - r.min) / (r.max - r.min) * 100}%`); }
function updateMute() { bar.mute.replaceChildren(icon(Number(bar.vol.value) ? 'volume' : 'mute', 18)); }
function updateNowLike() { const uri = player.state?.track?.uri; bar.like?.setAttribute('aria-pressed', String(!!(uri && state.liked.get(uri)))); }

let lastTrackUri = null;
function onPlayerState(s) {
  const t = s?.track;
  document.body.classList.toggle('has-track', !!t);
  bar.play.replaceChildren(icon(s?.isPlaying ? 'pause' : 'play', 22));
  bar.play.setAttribute('aria-label', s?.isPlaying ? 'Pause' : 'Play');
  bar.shuffle.setAttribute('aria-pressed', String(!!s?.shuffle));
  bar.repeat.setAttribute('aria-pressed', String(s?.repeat && s.repeat !== 'off'));
  bar.repeat.dataset.mode = s?.repeat || 'off';
  bar.dur.textContent = fmtTime(s?.duration || 0);
  if (s?.device?.volume_percent != null && document.activeElement !== bar.vol) { bar.vol.value = s.device.volume_percent; paintRange(bar.vol); updateMute(); }
  const remote = s?.device && !s.local;
  bar.device.hidden = !remote;
  bar.device.textContent = remote ? `Playing on ${s.device.name}` : '';
  if (t && t.uri !== lastTrackUri) {
    lastTrackUri = t.uri;
    bar.art.replaceChildren(cover(t.album?.images, 56));
    bar.title.textContent = t.name;
    const albumId = t.album?.id || idOf(t.album?.uri);
    if (albumId) bar.title.href = `#/album/${albumId}`; else bar.title.removeAttribute('href');
    bar.artist.replaceChildren(...artistLinks(t.artists));
    document.title = `${t.name} · ${t.artists?.map(a => a.name).join(', ')}`;
    refreshLiked([t.uri]);
    mediaSession(t);
  } else if (!t) {
    bar.art.replaceChildren(); bar.title.textContent = ''; bar.artist.replaceChildren(); document.title = 'mySpotify';
  }
  updateNowLike();
  markPlaying();
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = s?.isPlaying ? 'playing' : 'paused';
}

function mediaSession(t) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: t.name, artist: t.artists?.map(a => a.name).join(', '), album: t.album?.name,
    artwork: (t.album?.images || []).map(i => ({ src: i.url, sizes: `${i.width || 300}x${i.height || 300}`, type: 'image/jpeg' })),
  });
  const set = (a, fn) => { try { navigator.mediaSession.setActionHandler(a, fn); } catch { /* unsupported action */ } };
  set('play', guard(controls.toggle)); set('pause', guard(controls.toggle));
  set('nexttrack', guard(controls.next)); set('previoustrack', guard(controls.previous));
}

async function devicePopover() {
  closeMenus();
  const devices = await api.devices();
  const current = player.state?.device?.id;
  const list = devices.length ? devices.map(d => h('button', { class: `device${d.id === current ? ' current' : ''}`, onClick: guard(async () => { closeMenus(); await controls.transfer(d.id); toast(`Playing on ${d.name}`); }) },
    icon('devices', 18), h('span', {}, h('strong', {}, d.id === player.deviceId ? 'This browser (mySpotify)' : d.name), h('small', {}, d.id === current ? 'Listening on' : d.type))))
    : [h('p', { class: 'muted' }, 'No devices found. Open Spotify on your phone or speaker, or wait a moment for mySpotify to connect.')];
  const pop = h('div', { class: 'popover', role: 'dialog', 'aria-label': 'Connect to a device' }, h('h3', {}, 'Connect to a device'), list,
    player.sdkError ? h('p', { class: 'warn' }, player.sdkError) : null);
  document.body.append(pop);
  const r = bar.devices.getBoundingClientRect();
  pop.style.left = `${Math.max(8, Math.min(r.left - 140, innerWidth - pop.offsetWidth - 8))}px`;
  pop.style.top = `${r.top - pop.offsetHeight - 10}px`;
}

// ---------------------------------------------------------------- keyboard

document.addEventListener('keydown', e => {
  const typing = e.target.closest('input, textarea, [contenteditable]') && e.target.type !== 'range';
  if (e.key === 'Escape') { closeMenus(); if (typing) e.target.blur(); return; }
  if (typing) return;
  const ctrl = e.ctrlKey || e.metaKey;
  const act = fn => { e.preventDefault(); guard(fn)(); };
  if (e.key === ' ' && !e.target.closest('button, a')) act(controls.toggle);
  else if (ctrl && e.key === 'ArrowRight') act(controls.next);
  else if (ctrl && e.key === 'ArrowLeft') act(controls.previous);
  else if (e.shiftKey && e.key === 'ArrowRight') act(() => controls.seek(livePosition() + 10000));
  else if (e.shiftKey && e.key === 'ArrowLeft') act(() => controls.seek(Math.max(0, livePosition() - 10000)));
  else if (ctrl && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault();
    bar.vol.value = Math.max(0, Math.min(100, Number(bar.vol.value) + (e.key === 'ArrowUp' ? 10 : -10)));
    bar.vol.dispatchEvent(new Event('input'));
  } else if (ctrl && e.key.toLowerCase() === 's') act(controls.shuffle);
  else if (ctrl && e.key.toLowerCase() === 'r') act(controls.repeat);
  else if (e.key === '/' || (ctrl && e.key.toLowerCase() === 'l')) { e.preventDefault(); $('#search').focus(); }
});

// ---------------------------------------------------------------- start

async function start() {
  let err = null;
  try { await handleCallback(); } catch (x) { err = x.message; }
  if (!isSignedIn()) return renderGate(err);
  document.body.classList.remove('gated');
  $('#gate').hidden = true;
  try { state.me = await api.me(); } catch (x) {
    if (x.message === 'signed-out' || x.status === 401) return renderGate('Your session ended. Please sign in again.');
    if (x.status === 403) return renderGate('Spotify refused access. In your Spotify dashboard, open the app’s User Management and add the email of the Spotify account you sign in with.');
    toast(explain(x), 'error');
  }
  $('#me').replaceChildren(state.me?.images?.length ? cover(state.me.images, 32, true) : h('span', { class: 'initial' }, (state.me?.display_name || '?')[0]));
  $('#me').title = state.me?.display_name || '';
  buildPlayerBar();
  player.on(onPlayerState);
  player.on(() => { if (location.hash.startsWith('#/settings')) route(); });
  initSdk();
  startPolling();
  window.addEventListener('hashchange', route);
  route();
  loadLibrary();

  $('#search').addEventListener('input', e => {
    clearTimeout(searchTimer);
    const q = e.target.value;
    searchTimer = setTimeout(() => { location.hash = `#/search/${encodeURIComponent(q)}`; }, 280);
  });
  $('#search').addEventListener('focus', () => { if (!location.hash.startsWith('#/search')) location.hash = '#/search/'; });
  $('#lib-filter').addEventListener('input', e => { state.libQuery = e.target.value; renderLibrary(); });
  document.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => {
    state.filter = state.filter === c.dataset.filter ? 'all' : c.dataset.filter;
    document.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.filter === state.filter)));
    renderLibrary();
  }));
  $('#nav-back').addEventListener('click', () => history.back());
  $('#nav-fwd').addEventListener('click', () => history.forward());
  document.addEventListener('pointerdown', unlockAudio, { once: true });
}

start();
