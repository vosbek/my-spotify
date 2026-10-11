# mySpotify

A fast, keyboard-friendly music player for your Spotify account. It runs on your own computer, has
no build step and no dependencies beyond Python, and plays through Spotify's official Web Playback SDK.

![mySpotify playlist view, shown with sample data](docs/playlist.png)

**You need:** Spotify Premium, Windows 10/11 (or macOS/Linux), Python 3.9+, and Edge, Chrome, or Firefox.

## Run it on Windows

### 1. Get the code

Download the ZIP from the green **Code** button on GitHub and extract it, or:

```powershell
git clone https://github.com/vosbek/my-spotify
cd my-spotify
```

### 2. Make sure Python is installed

Open PowerShell and run `py --version`. If it says it is not recognized, install Python:

```powershell
winget install Python.Python.3.13
```

Close and reopen PowerShell afterwards.

### 3. Create your Spotify app (one time, about 5 minutes)

Spotify requires every app to have its own Client ID. It is free.

1. Go to <https://developer.spotify.com/dashboard> and sign in with the Spotify account you listen with.
2. Click **Create app**. Any name and description work (Spotify's terms don't allow "Spotify" in the
   app's name, so call it something like "My Player").
3. Under **Redirect URIs**, add exactly: `http://127.0.0.1:8888/callback`
4. Under **Which API/SDKs are you planning to use?**, tick **Web API** and **Web Playback SDK**.
5. Save. Open the app's **Settings** and copy the **Client ID** (32 letters and numbers).
   You do **not** need the Client secret.

### 4. Start mySpotify

Double-click **`start.cmd`**, or run:

```powershell
py myspotify.py
```

Your browser opens <http://127.0.0.1:8888>. Paste the Client ID, click **Sign in with Spotify**, and
approve. Leave the black PowerShell window open while you listen; close it to stop mySpotify.

### 5. Make it feel like a desktop app (optional)

In Edge, open the `...` menu, then **Apps > Install this site as an app**. In Chrome, open the `⋮` menu,
then **Cast, save, and share > Install page as app**. mySpotify then gets its own window, taskbar icon,
and Start menu entry. Media keys work in both.

## macOS and Linux

```sh
git clone https://github.com/vosbek/my-spotify && cd my-spotify
./start.sh            # or: python3 myspotify.py
```

## Using it

- **Play** a song by double-clicking it, pressing Enter on it, or hovering and clicking ▶.
- **Devices**: the screen icon in the player bar lists every Spotify Connect device. mySpotify shows up
  as "mySpotify" in Spotify on your phone too, so you can hand music back and forth.
- **Keyboard**: Space play/pause · Ctrl+→/← next/previous · Shift+→/← seek 10s · Ctrl+↑/↓ volume ·
  `/` search · Ctrl+S shuffle · Ctrl+R repeat.
- **Theme**: Settings, then System, Light, or Dark.

## Sharing with friends

Spotify keeps new apps in development mode, which allows **up to 5 people**. Add each person's
Spotify email under **User Management** in your app's dashboard. Each needs Premium to play music.
Anyone can also run their own copy with their own Client ID by following the steps above.

## Troubleshooting

| What you see | What to do |
|---|---|
| `INVALID_CLIENT: Invalid redirect URI` | The Redirect URI in your Spotify app must be exactly `http://127.0.0.1:8888/callback` (not `localhost`). |
| "Spotify refused access" after sign-in | Add your Spotify account's email under **User Management** in the dashboard. |
| "Playing in mySpotify needs Spotify Premium" | Free accounts can browse and control other devices but cannot play in the browser. |
| "This browser cannot play Spotify audio" | Use Edge, Chrome, or Firefox. In Firefox, allow DRM content when asked. |
| Port 8888 is busy | `py myspotify.py --port 8889`, then add `http://127.0.0.1:8889/callback` in the dashboard. |
| Player never connects | Try `py myspotify.py --relaxed-csp` to rule out the security policy, and disable ad blockers for 127.0.0.1. |

## Privacy and security

- The server listens only on `127.0.0.1` and refuses requests addressed to any other host name.
- Sign-in uses OAuth with PKCE. There is no client secret. Your refresh token stays in this browser's
  storage; **Sign out** in Settings removes it.
- The app talks only to Spotify (`api.spotify.com`, `accounts.spotify.com`, and the SDK and image CDNs),
  enforced by a Content-Security-Policy. All Spotify text is inserted as plain text, never as HTML.
- [`recon/myspotify-self`](recon/myspotify-self/index.html) is a Clearbox security report on this code.

## How it was made

We examined Spotify's Windows installer with [Clearbox](https://github.com/vosbek/reverse-enginer-rea)
(static analysis only) and mapped the desktop app's visible features to Spotify's public API. The notes,
reports, and feature map are in [`recon/`](recon/README.md).

## Project layout

```
myspotify.py        local server (Python standard library only)
start.cmd/start.sh  launchers
app/                the app: index.html, styles.css, js/{auth,api,player,ui,main}.js
tests/              server tests (python -m unittest) and a mocked browser smoke test (node tests/ui-smoke.cjs)
recon/              reverse-engineering notes and Clearbox reports
```

## Development

```sh
python3 -m unittest discover -s tests
python3 myspotify.py --no-browser --port 8890 &   # then, with Playwright installed:
node tests/ui-smoke.cjs screenshots
```

mySpotify is not affiliated with or endorsed by Spotify. Spotify is a trademark of Spotify AB.
