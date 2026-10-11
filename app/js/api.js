// Spotify Web API client. Handles token refresh, rate limits, and the February 2026 endpoint changes
// (playlist /tracks -> /items, per-type library routes -> /me/library, smaller page limits).
import { getToken } from './auth.js';

const BASE = 'https://api.spotify.com/v1';

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function request(method, path, { query, body, retry = 0 } = {}) {
  const url = new URL(path.startsWith('http') ? path : BASE + path);
  for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== null) url.searchParams.set(k, v);
  const token = await getToken(retry === 1);
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && retry === 0) return request(method, path, { query, body, retry: 1 });
  if (res.status === 429 && retry < 3) {
    await sleep(Math.min(10, Number(res.headers.get('Retry-After') || 1)) * 1000);
    return request(method, path, { query, body, retry: retry + 2 });
  }
  // Development-mode apps now reject large pages; retry once with the smallest common limit.
  if (res.status === 400 && url.searchParams.get('limit') > 10 && retry < 2) {
    url.searchParams.set('limit', '10');
    return request(method, url.toString(), { body, retry: 2 });
  }
  if (res.status === 204 || res.status === 202) return null;
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) {
    const msg = data?.error?.message || data?.error_description || res.statusText || 'Request failed';
    throw new ApiError(res.status, msg);
  }
  return data;
}

const get = (path, query) => request('GET', path, { query });

/** Try each request in turn; return the first that does not 403/404/405. */
async function firstWorking(...attempts) {
  let last;
  for (const attempt of attempts) {
    try { return await attempt(); } catch (err) {
      last = err;
      if (!(err instanceof ApiError) || ![400, 403, 404, 405].includes(err.status)) throw err;
    }
  }
  throw last;
}

// Normalize a playlist entry: the 2026 shape is { item }, the older one { track }.
export const entryTrack = e => e?.item ?? e?.track ?? null;
export const playlistTotal = p => p?.items?.total ?? p?.tracks?.total ?? 0;
export const idOf = uri => (uri || '').split(':').pop();

export const api = {
  me: () => get('/me'),

  // Library
  playlists: (offset = 0) => get('/me/playlists', { limit: 50, offset }),
  savedTracks: (offset = 0) => get('/me/tracks', { limit: 50, offset }),
  savedAlbums: (offset = 0) => get('/me/albums', { limit: 50, offset }),
  followedArtists: after => get('/me/following', { type: 'artist', limit: 50, after }),

  // Home
  recentlyPlayed: () => get('/me/player/recently-played', { limit: 50 }),
  top: (type, range = 'short_term') => get(`/me/top/${type}`, { limit: 20, time_range: range }),

  // Catalog
  search: (q, types = 'track,artist,album,playlist', offset = 0) => get('/search', { q, type: types, limit: 10, offset }),
  album: id => get(`/albums/${id}`),
  artist: id => get(`/artists/${id}`),
  artistAlbums: (id, offset = 0) => get(`/artists/${id}/albums`, { include_groups: 'album,single,compilation', limit: 20, offset }),
  /** Top tracks was removed for development-mode apps; fall back to a search on the artist's name. */
  artistTopTracks: (id, name) => firstWorking(
    () => get(`/artists/${id}/top-tracks`).then(r => r.tracks),
    () => get('/search', { q: `artist:"${name}"`, type: 'track', limit: 10 }).then(r => r.tracks.items.filter(t => t.artists.some(a => a.id === id))),
  ),
  playlist: id => get(`/playlists/${id}`),
  playlistItems: (id, offset = 0) => firstWorking(
    () => get(`/playlists/${id}/items`, { limit: 50, offset }),
    () => get(`/playlists/${id}/tracks`, { limit: 50, offset }),
  ),
  next: url => get(url),

  // Saved state, up to 40 URIs per call
  async contains(uris) {
    if (!uris.length) return [];
    return firstWorking(
      () => get('/me/library/contains', { uris: uris.join(',') }),
      () => get('/me/library', { uris: uris.join(',') }),
      () => get('/me/tracks/contains', { ids: uris.map(idOf).join(',') }),
    ).then(r => Array.isArray(r) ? r : uris.map(() => false));
  },
  save: uris => firstWorking(
    () => request('PUT', '/me/library', { query: { uris: uris.join(',') } }),
    () => request('PUT', '/me/tracks', { query: { ids: uris.map(idOf).join(',') } }),
  ),
  unsave: uris => firstWorking(
    () => request('DELETE', '/me/library', { query: { uris: uris.join(',') } }),
    () => request('DELETE', '/me/tracks', { query: { ids: uris.map(idOf).join(',') } }),
  ),

  // Player (Spotify Connect)
  state: () => get('/me/player', { additional_types: 'track,episode' }),
  devices: () => get('/me/player/devices').then(r => r?.devices || []),
  queue: () => get('/me/player/queue'),
  play: (deviceId, body) => request('PUT', '/me/player/play', { query: { device_id: deviceId }, body }),
  pause: deviceId => request('PUT', '/me/player/pause', { query: { device_id: deviceId } }),
  nextTrack: deviceId => request('POST', '/me/player/next', { query: { device_id: deviceId } }),
  previousTrack: deviceId => request('POST', '/me/player/previous', { query: { device_id: deviceId } }),
  seek: (ms, deviceId) => request('PUT', '/me/player/seek', { query: { position_ms: Math.round(ms), device_id: deviceId } }),
  volume: (pct, deviceId) => request('PUT', '/me/player/volume', { query: { volume_percent: Math.round(pct), device_id: deviceId } }),
  shuffle: (on, deviceId) => request('PUT', '/me/player/shuffle', { query: { state: on, device_id: deviceId } }),
  repeat: (mode, deviceId) => request('PUT', '/me/player/repeat', { query: { state: mode, device_id: deviceId } }),
  transfer: (deviceId, play = true) => request('PUT', '/me/player', { body: { device_ids: [deviceId], play } }),
  addToQueue: (uri, deviceId) => request('POST', '/me/player/queue', { query: { uri, device_id: deviceId } }),
};
