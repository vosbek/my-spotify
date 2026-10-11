// Playback: the Web Playback SDK turns this browser tab into a Spotify Connect device called "mySpotify".
// When music plays elsewhere (phone, speaker), the same controls drive that device through the Web API.
import { api } from './api.js';
import { getToken } from './auth.js';

const listeners = new Set();
export const player = {
  deviceId: null,       // this browser's device id once the SDK is ready
  sdk: null,
  sdkError: null,       // human-readable reason the SDK cannot play here
  state: null,          // normalized state, see normalize()
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};
const emit = () => listeners.forEach(fn => fn(player.state));

function normalizeApi(s) {
  if (!s || !s.item) return s ? { ...base(), device: s.device, isPlaying: false } : null;
  return {
    track: s.item, isPlaying: s.is_playing, position: s.progress_ms || 0, duration: s.item.duration_ms,
    shuffle: s.shuffle_state, repeat: s.repeat_state, device: s.device, contextUri: s.context?.uri || null,
    stamp: performance.now(), local: s.device?.id === player.deviceId,
  };
}
function normalizeSdk(s) {
  if (!s) return null;
  const t = s.track_window.current_track;
  return {
    track: t && { ...t, album: { ...t.album, images: t.album.images }, artists: t.artists.map(a => ({ ...a, id: a.uri.split(':').pop() })) },
    isPlaying: !s.paused, position: s.position, duration: s.duration,
    shuffle: s.shuffle, repeat: ['off', 'context', 'track'][s.repeat_mode] || 'off',
    device: { id: player.deviceId, name: 'mySpotify (this browser)', volume_percent: player.state?.device?.volume_percent ?? 70 },
    contextUri: s.context?.uri || null, stamp: performance.now(), local: true,
  };
}
const base = () => ({ track: null, isPlaying: false, position: 0, duration: 0, shuffle: false, repeat: 'off', stamp: performance.now() });

/** Current position in ms, advanced locally between updates so the progress bar moves smoothly. */
export function livePosition() {
  const s = player.state;
  if (!s) return 0;
  return Math.min(s.duration || 0, s.position + (s.isPlaying ? performance.now() - s.stamp : 0));
}

let pollTimer = null;
async function poll() {
  try {
    const s = await api.state();
    if (!(player.state?.local && player.sdk)) { player.state = normalizeApi(s); emit(); }
    else if (s?.device && s.device.id !== player.deviceId) { player.state = normalizeApi(s); emit(); }
  } catch { /* network hiccup; next poll will retry */ }
}
export function startPolling() {
  clearInterval(pollTimer);
  poll();
  pollTimer = setInterval(() => { if (!document.hidden) poll(); }, 4000);
}

export function initSdk() {
  if (player.sdk || document.getElementById('spotify-sdk')) return;
  window.onSpotifyWebPlaybackSDKReady = () => {
    const sdk = new window.Spotify.Player({
      name: 'mySpotify',
      getOAuthToken: cb => getToken().then(cb).catch(() => cb('')),
      volume: 0.7,
    });
    sdk.addListener('ready', ({ device_id }) => { player.deviceId = device_id; player.sdkError = null; emit(); });
    sdk.addListener('not_ready', () => { player.deviceId = null; emit(); });
    sdk.addListener('player_state_changed', s => { if (s) { player.state = normalizeSdk(s); emit(); } });
    sdk.addListener('initialization_error', ({ message }) => { player.sdkError = `This browser cannot play Spotify audio (${message}). Use Edge, Chrome, or Firefox.`; emit(); });
    sdk.addListener('authentication_error', () => { player.sdkError = 'Spotify rejected the playback sign-in. Sign out and in again.'; emit(); });
    sdk.addListener('account_error', () => { player.sdkError = 'Playing in mySpotify needs Spotify Premium. You can still control playback on your other devices.'; emit(); });
    sdk.addListener('playback_error', ({ message }) => { player.sdkError = `Playback error: ${message}`; emit(); });
    sdk.connect();
    player.sdk = sdk;
  };
  const s = document.createElement('script');
  s.id = 'spotify-sdk';
  s.src = 'https://sdk.scdn.co/spotify-player.js';
  s.onerror = () => { player.sdkError = 'Could not load the Spotify player. Check your connection or ad blocker.'; emit(); };
  document.head.append(s);
}

/** Browsers block audio until a user gesture; call this from a click before the first play. */
export function unlockAudio() { player.sdk?.activateElement?.(); }

const target = () => player.state?.device?.id || player.deviceId || undefined;

async function ensureDevice() {
  if (player.state?.device?.id) return player.state.device.id;
  if (player.deviceId) { await api.transfer(player.deviceId, false); return player.deviceId; }
  const devices = await api.devices();
  if (!devices.length) throw new Error('No Spotify device is available. Open Spotify on a device, or wait for mySpotify to connect.');
  return (devices.find(d => d.is_active) || devices[0]).id;
}

export const controls = {
  /** Play a context (album/playlist/artist) at a track, or an explicit list of track URIs. */
  async play({ contextUri, uris, offsetUri, index }) {
    unlockAudio();
    const device = await ensureDevice();
    const body = contextUri ? { context_uri: contextUri } : { uris };
    if (contextUri && offsetUri) body.offset = { uri: offsetUri };
    else if (index != null) body.offset = { position: index };
    await api.play(device, body);
    setTimeout(poll, 600);
  },
  async toggle() {
    unlockAudio();
    const s = player.state;
    if (s?.local && player.sdk) return player.sdk.togglePlay();
    if (s?.isPlaying) await api.pause(target()); else await api.play(await ensureDevice());
    setTimeout(poll, 300);
  },
  async next() { if (player.state?.local && player.sdk) return player.sdk.nextTrack(); await api.nextTrack(target()); setTimeout(poll, 500); },
  async previous() {
    if (livePosition() > 3000) return controls.seek(0);
    if (player.state?.local && player.sdk) return player.sdk.previousTrack();
    await api.previousTrack(target()); setTimeout(poll, 500);
  },
  async seek(ms) {
    if (player.state) { player.state.position = ms; player.state.stamp = performance.now(); emit(); }
    if (player.state?.local && player.sdk) return player.sdk.seek(ms);
    await api.seek(ms, target());
  },
  async volume(pct) {
    if (player.state?.device) player.state.device.volume_percent = pct;
    if (player.state?.local && player.sdk) return player.sdk.setVolume(pct / 100);
    await api.volume(pct, target());
  },
  async shuffle() { const on = !player.state?.shuffle; await api.shuffle(on, target()); if (player.state) player.state.shuffle = on; emit(); setTimeout(poll, 400); },
  async repeat() {
    const next = { off: 'context', context: 'track', track: 'off' }[player.state?.repeat || 'off'];
    await api.repeat(next, target()); if (player.state) player.state.repeat = next; emit(); setTimeout(poll, 400);
  },
  async transfer(deviceId) { unlockAudio(); await api.transfer(deviceId, true); setTimeout(poll, 800); },
  async queue(uri) { await api.addToQueue(uri, target()); },
};
