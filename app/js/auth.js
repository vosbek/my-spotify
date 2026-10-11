// Sign-in with Spotify using Authorization Code + PKCE. No client secret ever exists in this app.
const AUTHORIZE = 'https://accounts.spotify.com/authorize';
const TOKEN = 'https://accounts.spotify.com/api/token';
export const SCOPES = [
  'user-read-private', 'user-read-email',
  'user-library-read', 'user-library-modify',
  'playlist-read-private', 'playlist-read-collaborative',
  'user-follow-read', 'user-top-read', 'user-read-recently-played',
  'user-read-playback-state', 'user-modify-playback-state', 'user-read-currently-playing',
  'streaming',
];

const K = { client: 'msp.clientId', refresh: 'msp.refresh', access: 'msp.access', verifier: 'msp.verifier', state: 'msp.state' };
const store = {
  get(area, key) { try { return area.getItem(key); } catch { return null; } },
  set(area, key, value) { try { value == null ? area.removeItem(key) : area.setItem(key, value); } catch { /* storage blocked */ } },
};

export const redirectUri = () => `${location.origin}/callback`;
export const getClientId = () => store.get(localStorage, K.client) || '';
export function setClientId(id) { store.set(localStorage, K.client, id.trim()); }

let access = null; // { token, expires }
try { access = JSON.parse(store.get(sessionStorage, K.access) || 'null'); } catch { access = null; }

const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomString = n => b64url(crypto.getRandomValues(new Uint8Array(n)));

export async function login() {
  const clientId = getClientId();
  if (!/^[0-9a-f]{32}$/i.test(clientId)) throw new Error('Add your Spotify Client ID first.');
  const verifier = randomString(64);
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const state = randomString(16);
  store.set(sessionStorage, K.verifier, verifier);
  store.set(sessionStorage, K.state, state);
  const params = new URLSearchParams({
    client_id: clientId, response_type: 'code', redirect_uri: redirectUri(), scope: SCOPES.join(' '),
    code_challenge_method: 'S256', code_challenge: challenge, state,
  });
  location.assign(`${AUTHORIZE}?${params}`);
}

async function tokenRequest(body) {
  const res = await fetch(TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.error || `Spotify sign-in failed (${res.status}).`);
  return data;
}

function saveTokens(data) {
  access = { token: data.access_token, expires: Date.now() + (data.expires_in || 3600) * 1000 };
  store.set(sessionStorage, K.access, JSON.stringify(access));
  if (data.refresh_token) store.set(localStorage, K.refresh, data.refresh_token);
}

/** Finish sign-in when Spotify sends the browser back to /callback. Returns true if handled. */
export async function handleCallback() {
  if (location.pathname !== '/callback') return false;
  const q = new URLSearchParams(location.search);
  const expected = store.get(sessionStorage, K.state);
  const verifier = store.get(sessionStorage, K.verifier);
  history.replaceState(null, '', '/');
  if (q.get('error')) throw new Error(q.get('error') === 'access_denied' ? 'Sign-in was cancelled.' : `Spotify said: ${q.get('error')}`);
  if (!q.get('code') || !expected || q.get('state') !== expected || !verifier) throw new Error('Sign-in could not be verified. Please try again.');
  store.set(sessionStorage, K.state, null);
  store.set(sessionStorage, K.verifier, null);
  saveTokens(await tokenRequest({
    client_id: getClientId(), grant_type: 'authorization_code', code: q.get('code'),
    redirect_uri: redirectUri(), code_verifier: verifier,
  }));
  return true;
}

let refreshing = null;
async function refresh() {
  const refreshToken = store.get(localStorage, K.refresh);
  if (!refreshToken) throw new Error('signed-out');
  refreshing ??= tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: getClientId() })
    .then(saveTokens)
    .catch(err => { logout(); throw err; })
    .finally(() => { refreshing = null; });
  return refreshing;
}

export const isSignedIn = () => !!(store.get(localStorage, K.refresh) || (access && access.expires > Date.now()));

/** A valid access token, refreshed when it is within a minute of expiring. */
export async function getToken(force = false) {
  if (force || !access || access.expires - Date.now() < 60_000) await refresh();
  return access.token;
}

export function logout() {
  access = null;
  store.set(sessionStorage, K.access, null);
  store.set(localStorage, K.refresh, null);
}
