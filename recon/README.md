# Reverse engineering notes

mySpotify was planned by looking at Spotify for Windows from the outside with
[Clearbox](https://github.com/vosbek/reverse-enginer-rea), a static analyzer that reads files
and never runs them. This folder holds what we looked at, what it told us, and what we decided.

## 1. The Windows download: `SpotifySetup.exe`

Downloaded from `https://download.scdn.co/SpotifySetup.exe` and analyzed with
`clearbox scan <folder> -t binary-triage`. Full report: [`spotify-installer/index.html`](spotify-installer/index.html)
([Markdown](spotify-installer/report.md), [JSON](spotify-installer/report.json)).

| | |
|---|---|
| SHA-256 | `b7d990f2bfcbf835af4da7e7579e2a8c019d5419f49fd347c7e2a0cce1f1258b` |
| Size | 1,074,664 bytes |
| Identity (version resource) | Spotify Installer, Spotify Ltd, product version 1.3.4.258.gc60b10b0946a, original filename `installer_stub.exe` |
| Format | PE32+ x86-64, Windows GUI, MSVC (Rich header), deterministic build timestamp |
| Signature | Authenticode, signed by **Spotify AB** via DigiCert Trusted G4 Code Signing RSA4096 SHA384 2021 CA1, timestamped by DigiCert's 2025 TSA (signer names read from the certificates; chain not validated) |
| Hardening | ASLR, high-entropy ASLR, DEP/NX |

What the evidence says it does:

1. **It is a downloader, not the app.** The original filename is `installer_stub.exe`, and the binary
   embeds `https://download.scdn.co/SpotifyFullSetup[ARCH].exe` and `.../SpotifyFullSetup.exe`.
   The real client is fetched at install time.
2. **Its networking is hidden from the import table.** `WININET.dll` is not among the 8 imported DLLs,
   but the name appears in the binary's strings, and the binary imports `LoadLibraryExW` and
   `GetProcAddress`. That pattern means it most likely loads WinINet at runtime (an inference; confirming it
   needs a disassembler). An import-only scan would miss the network capability; the strings view catches it.
3. **It knows about the Microsoft Store edition.** It holds the Store package name `SpotifyAB.SpotifyMusic`
   and loads the WinRT app-model API set, so it can detect or defer to a Store install.
4. **It coordinates with Spotify's updater** through four named mutexes: `Spotify Update Mutex`,
   `Spotify Update Failed Mutex`, `Spotify Update Started Mutex`, `Spotify Update Started Interactive Mutex`.
5. **It changes the machine per-user, without admin rights.** Imports cover creating, moving, copying,
   and deleting files (`CreateDirectoryW`, `MoveFileExW`, `CopyFileW`, `DeleteFileW`), resolving known
   folders (`SHGetFolderPathW`), writing the registry (`RegCreateKeyExW`, `RegSetValueExW`), changing
   file permissions (`SetEntriesInAclW`, `SetNamedSecurityInfoW`, `ConvertStringSidToSidW`), refreshing the
   shell (`SHChangeNotify`), and starting programs (`CreateProcessW`, `ShellExecuteW`). Strings name
   `Spotify.exe`, `Spotify_new.exe`, and `uninstall.exe`. There is no elevation API.

What it could not tell us: anything about the app's interface or features. Those live in the full client
that the stub downloads. Run `scan-installed-spotify.ps1` on a PC with Spotify installed to triage
`%APPDATA%\Spotify` the same way.

## 2. What we built instead

| Spotify for Windows | mySpotify |
|---|---|
| Downloader stub fetches a full client from a CDN | You download one folder from GitHub; nothing is fetched at install |
| Writes the registry, changes ACLs, adds shortcuts | Writes nothing outside its folder; the browser keeps your sign-in |
| Background updater coordinated by named mutexes | No updater; `git pull` when you want changes |
| Proprietary streaming client | Spotify's official Web API and Web Playback SDK |

Feature map, from what any user sees in the desktop app to the public API that provides it:

| Desktop feature | mySpotify | Official API |
|---|---|---|
| Home: recents, top artists | Home | `GET /me/player/recently-played`, `GET /me/top/{artists,tracks}` |
| Your Library sidebar with filters | Sidebar | `GET /me/playlists`, `GET /me/albums`, `GET /me/following?type=artist` |
| Liked Songs | Liked Songs | `GET /me/tracks`, `PUT/DELETE /me/library` |
| Search with top result | Search | `GET /search` (10 results per type) |
| Playlist, album, artist pages | Same | `GET /playlists/{id}/items`, `GET /albums/{id}`, `GET /artists/{id}/albums` |
| Player bar, shuffle, repeat, seek, volume | Same | Web Playback SDK, `/me/player/*` |
| Spotify Connect device picker | Devices button | `GET /me/player/devices`, `PUT /me/player` |
| Queue | Queue | `GET/POST /me/player/queue` |
| Media keys | Same | Media Session API |
| Lyrics, canvas videos, friend activity | Not available | No public API |

## 3. mySpotify, checked with the same tool

[`myspotify-self/index.html`](myspotify-self/index.html) is Clearbox's security-surface report on this repository.
Its only host-touching capabilities are two network call sites: the Spotify Web API and Spotify's token endpoint.
