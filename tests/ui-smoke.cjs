// Browser smoke test: runs the real app against a mocked Spotify (API, accounts, SDK, images).
// Usage: python myspotify.py --no-browser --port 8890 &  then  node tests/ui-smoke.cjs [screenshot-dir]
// Needs Playwright (npm i -g playwright) and a Chromium build.
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright')); }

const BASE = process.env.MYSPOTIFY_URL || 'http://127.0.0.1:8890';
const OUT = process.argv[2] || '.';
const PNG = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#7a3fd1"/><circle cx="150" cy="150" r="80" fill="#f2c14e"/></svg>');
const images = [{ url: 'https://i.scdn.co/image/cover1', width: 300, height: 300 }, { url: 'https://i.scdn.co/image/cover1s', width: 64, height: 64 }];
const artist = { id: 'ar1', uri: 'spotify:artist:ar1', name: 'Nova Lights', images, followers: { total: 120034 }, genres: ['synthwave', 'indie'] };
const album = { id: 'al1', uri: 'spotify:album:al1', name: 'Night Drive', images, artists: [artist], release_date: '2024-05-01', album_type: 'album', total_tracks: 3 };
const track = (n, extra = {}) => ({ id: `t${n}`, uri: `spotify:track:t${n}`, name: ['Neon Coast', 'Afterglow', 'Satellite Hearts', 'Midnight Signal'][n % 4], duration_ms: 180000 + n * 7000, explicit: n === 2, artists: [artist], album, is_playable: true, ...extra });
const playlist = { id: 'pl1', uri: 'spotify:playlist:pl1', name: 'Focus Flow', images, owner: { display_name: 'Ada' }, description: 'Deep work &amp; <a href="x">calm</a> beats', public: true, items: { total: 4 } };

const calls = [];
function api(url, method) {
  const u = new URL(url);
  const p = u.pathname.replace('/v1', '');
  calls.push(`${method} ${p}${u.search}`);
  if (p === '/me') return { id: 'ada', display_name: 'Ada Lovelace', product: 'premium', images: [] };
  if (p === '/me/playlists') return { items: [playlist, { ...playlist, id: 'pl2', name: 'Road Trip', uri: 'spotify:playlist:pl2' }], next: null, total: 2 };
  if (p === '/me/albums') return { items: [{ album }], next: null };
  if (p === '/me/following') return { artists: { items: [artist], next: null } };
  if (p === '/me/player/recently-played') return { items: [{ track: track(1), context: { uri: 'spotify:playlist:pl1' } }, { track: track(2), context: { uri: 'spotify:album:al1' } }, { track: track(3), context: { uri: 'spotify:collection:tracks' } }] };
  if (p.startsWith('/me/top/artists')) return { items: [artist, { ...artist, id: 'ar2', name: 'Paper Moons' }] };
  if (p.startsWith('/me/top/tracks')) return { items: [track(1), track(2), track(3)] };
  if (p === '/search') return { tracks: { items: [track(1), track(2)] }, artists: { items: [artist] }, albums: { items: [album] }, playlists: { items: [playlist, null] } };
  if (p === '/playlists/pl1') return playlist;
  if (p === '/playlists/pl1/items') return { items: [0, 1, 2, 3].map(n => ({ item: track(n), added_at: '2026-09-01T10:00:00Z' })), next: null, total: 4 };
  if (p === '/albums/al1') return { ...album, tracks: { items: [track(1), track(2), track(3)].map(t => ({ ...t, album: undefined })), next: null }, copyrights: [{ text: '© 2024 Nova Lights' }] };
  if (p === '/artists/ar1') return artist;
  if (p === '/artists/ar1/top-tracks') return { status: 403 };
  if (p === '/artists/ar1/albums') return { items: [album, { ...album, id: 'al2', name: 'Static Bloom', album_type: 'single' }], next: null };
  if (p === '/me/tracks') return method === 'GET' ? { items: [{ track: track(1), added_at: '2026-08-01T00:00:00Z' }], next: null, total: 1 } : null;
  if (p === '/me/library/contains') return u.searchParams.get('uris').split(',').map((x, i) => i === 0);
  if (p === '/me/library') return null;
  if (p === '/me/player' && method === 'GET') return { is_playing: true, progress_ms: 42000, item: track(1), shuffle_state: false, repeat_state: 'off', device: { id: 'phone', name: 'Ada’s Phone', type: 'Smartphone', volume_percent: 55 } };
  if (p === '/me/player/devices') return { devices: [{ id: 'dev-local', name: 'mySpotify', type: 'Computer', is_active: false }, { id: 'phone', name: 'Ada’s Phone', type: 'Smartphone', is_active: true }] };
  if (p === '/me/player/queue') return { currently_playing: track(1), queue: [track(2), track(3)] };
  if (p.startsWith('/me/player')) return null;
  return { status: 404 };
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await ctx.route('https://api.spotify.com/**', route => {
    const body = api(route.request().url(), route.request().method());
    if (body && body.status) return route.fulfill({ status: body.status, contentType: 'application/json', body: JSON.stringify({ error: { status: body.status, message: 'Forbidden' } }) });
    if (body === null) return route.fulfill({ status: 204 });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await ctx.route('https://accounts.spotify.com/api/token', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'tok', expires_in: 3600, refresh_token: 'r2' }) }));
  await ctx.route('https://sdk.scdn.co/**', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: `
    window.Spotify = { Player: class { constructor(o){ this.o=o; this.l={}; } addListener(e,f){ this.l[e]=f; }
      connect(){ setTimeout(()=>this.l.ready && this.l.ready({device_id:'dev-local'}), 50); return Promise.resolve(true); }
      togglePlay(){} nextTrack(){} previousTrack(){} seek(){} setVolume(){} activateElement(){} } };
    window.onSpotifyWebPlaybackSDKReady();` }));
  await ctx.route('https://i.scdn.co/**', route => route.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'Access-Control-Allow-Origin': '*' }, body: decodeURIComponent(PNG.split(',')[1]) }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));

  const check = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exitCode = 1; } else console.log('ok  ', msg); };

  // 1. First run shows the setup gate with the right redirect URI.
  await page.goto(BASE + '/');
  await page.waitForSelector('#gate .gate-card');
  check((await page.textContent('#gate .uri code')) === `${BASE}/callback`, 'setup shows the redirect URI');
  await page.fill('#client-id', 'nope');
  await page.click('#gate button[type=submit]');
  check(await page.isVisible('.gate-error'), 'invalid client id is rejected with a message');
  await page.screenshot({ path: path.join(OUT, 'gate.png') });

  // 2. Signed-in: seed a client id + refresh token, as if sign-in already happened.
  await page.evaluate(() => { localStorage.setItem('msp.clientId', '0123456789abcdef0123456789abcdef'); localStorage.setItem('msp.refresh', 'r1'); });
  await page.goto(BASE + '/#/home');
  await page.reload(); // a hash-only navigation does not reload the app
  await page.waitForSelector('.greeting');
  check((await page.textContent('.greeting')).includes('Ada'), 'home greets the user');
  await page.waitForSelector('.lib-item >> text=Road Trip');
  check(await page.isVisible('.tiles .tile >> text=Liked Songs'), 'recently played includes Liked Songs');
  await page.waitForSelector('.np-title >> text=Afterglow');
  check((await page.textContent('.device-line')).includes('Ada’s Phone'), 'remote device playback is shown');
  await page.screenshot({ path: path.join(OUT, 'home.png') });

  // 3. Playlist view with 2026 { item } shape, and play a row.
  await page.click('.lib-item >> text=Focus Flow');
  await page.waitForSelector('.hero h1 >> text=Focus Flow');
  check((await page.textContent('.desc')) === 'Deep work & calm beats', 'playlist description is plain text');
  check((await page.$$('.tracks .trow:not(.head)')).length === 4, 'playlist lists 4 tracks from /items');
  await page.waitForFunction(() => document.querySelector('.trow[data-uri="spotify:track:t0"] .like')?.getAttribute('aria-pressed') === 'true');
  check(true, 'liked state loaded through /me/library/contains');
  await page.dblclick('.trow[data-uri="spotify:track:t2"]');
  await page.waitForTimeout(300);
  const play = calls.find(c => c.startsWith('PUT /me/player/play'));
  check(!!play, `double-click plays (${play})`);
  await page.screenshot({ path: path.join(OUT, 'playlist.png') });

  // 4. Like a track.
  await page.hover('.trow[data-uri="spotify:track:t3"]');
  await page.click('.trow[data-uri="spotify:track:t3"] .like');
  await page.waitForTimeout(200);
  check(calls.some(c => c.startsWith('PUT /me/library?uris=spotify%3Atrack%3At3')), 'like saves through PUT /me/library');

  // 5. Search.
  await page.fill('#search', 'nova');
  await page.waitForSelector('.best-card >> text=Nova Lights');
  check(calls.some(c => c.startsWith('GET /search') && c.includes('limit=10')), 'search uses limit=10');
  await page.screenshot({ path: path.join(OUT, 'search.png') });

  // 6. Artist with top-tracks removed (403) falls back to search.
  await page.click('.best-card');
  await page.waitForSelector('.hero h1 >> text=Nova Lights');
  await page.waitForSelector('text=Popular');
  check(true, 'artist page falls back when top-tracks is unavailable');
  await page.screenshot({ path: path.join(OUT, 'artist.png') });

  // 7. Album, liked songs, queue, settings, devices.
  await page.goto(BASE + '/#/album/al1');
  await page.waitForSelector('.hero h1 >> text=Night Drive');
  check((await page.$$('.tracks .trow:not(.head)')).length === 3, 'album lists its tracks');
  await page.goto(BASE + '/#/liked');
  await page.waitForSelector('.hero h1 >> text=Liked Songs');
  await page.goto(BASE + '/#/queue');
  await page.waitForSelector('text=Next up');
  await page.goto(BASE + '/#/settings');
  await page.waitForSelector('text=Keyboard');
  await page.click('.seg button >> text=Light');
  check(await page.evaluate(() => document.documentElement.dataset.theme === 'light'), 'theme switch works');
  await page.screenshot({ path: path.join(OUT, 'settings-light.png') });
  await page.click('.seg button >> text=Dark');
  await page.click('[aria-label="Connect to a device"]');
  await page.waitForSelector('.popover >> text=This browser (mySpotify)');
  await page.click('.popover .device >> text=This browser (mySpotify)');
  await page.waitForTimeout(200);
  check(calls.some(c => c === 'PUT /me/player'), 'transferring to this browser calls PUT /me/player');

  // 8. Keyboard: space toggles.
  await page.goto(BASE + '/#/home');
  await page.waitForSelector('.greeting');
  const before = calls.length;
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  check(calls.slice(before).some(c => c.startsWith('PUT /me/player/pause')), 'space pauses remote playback');

  // 9. Narrow window has no horizontal scroll.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  const hs = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check(hs <= 0, `no horizontal scroll at phone width (${hs})`);
  await page.screenshot({ path: path.join(OUT, 'narrow.png') });

  check(errors.length === 0, `no page errors ${errors.length ? JSON.stringify(errors) : ''}`);
  await browser.close();
})();
