#!/usr/bin/env python3
"""Run mySpotify on this computer.

Serves the app in ./app on http://127.0.0.1:8888 (loopback only) and opens
your browser. Uses only the Python standard library.

    python myspotify.py              # start and open the browser
    python myspotify.py --port 9000  # different port (update your Spotify redirect URI too)
    python myspotify.py --no-browser
"""

from __future__ import annotations

import argparse
import mimetypes
import os
import sys
import threading
import webbrowser
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

APP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app")
VERSION = "1.0.0"

# The Web Playback SDK runs in an iframe from sdk.scdn.co and streams from Spotify's CDNs.
CSP = "; ".join([
    "default-src 'self'",
    "script-src 'self' https://sdk.scdn.co",
    "frame-src https://sdk.scdn.co https://*.spotify.com",
    "connect-src 'self' https://*.spotify.com wss://*.spotify.com https://*.scdn.co https://*.spotifycdn.com",
    "img-src 'self' data: blob: https://*.scdn.co https://*.spotifycdn.com https://*.spotify.com https://*.fbcdn.net",
    "media-src 'self' blob: https:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
])
mimetypes.add_type("application/manifest+json", ".webmanifest")
mimetypes.add_type("text/javascript", ".js")


class Handler(SimpleHTTPRequestHandler):
    server_version = f"mySpotify/{VERSION}"
    relaxed_csp = False

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=APP_DIR, **kwargs)

    def translate_path(self, path: str) -> str:
        """Map a URL to a file inside app/, never outside it. Unknown routes get index.html."""
        rel = unquote(urlsplit(path).path).lstrip("/")
        full = os.path.realpath(os.path.join(APP_DIR, rel))
        if os.path.commonpath([full, APP_DIR]) != APP_DIR:
            return os.path.join(APP_DIR, "__forbidden__")
        if os.path.isdir(full):
            full = os.path.join(full, "index.html")
        if not os.path.exists(full) and "." not in os.path.basename(rel):
            full = os.path.join(APP_DIR, "index.html")  # SPA routes such as /callback
        return full

    def end_headers(self) -> None:
        if not self.relaxed_csp:
            self.send_header("Content-Security-Policy", CSP)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self) -> None:
        if self.headers.get("Host", "").split(":")[0] not in ("127.0.0.1", "localhost"):
            self.send_error(HTTPStatus.MISDIRECTED_REQUEST, "mySpotify only answers on 127.0.0.1")
            return
        super().do_GET()

    def list_directory(self, path):  # never show directory listings
        self.send_error(HTTPStatus.NOT_FOUND)
        return None

    def log_message(self, fmt: str, *args) -> None:
        if os.environ.get("MYSPOTIFY_VERBOSE"):
            super().log_message(fmt, *args)


def make_server(port: int, relaxed_csp: bool = False) -> ThreadingHTTPServer:
    handler = type("ConfiguredHandler", (Handler,), {"relaxed_csp": relaxed_csp})
    return ThreadingHTTPServer(("127.0.0.1", port), handler)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run mySpotify locally.")
    parser.add_argument("--port", type=int, default=8888)
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--relaxed-csp", action="store_true",
                        help="Drop the Content-Security-Policy header (troubleshooting only).")
    args = parser.parse_args(argv)
    if sys.version_info < (3, 9):
        print("mySpotify needs Python 3.9 or newer.")
        return 1
    try:
        server = make_server(args.port, args.relaxed_csp)
    except OSError as exc:
        print(f"Could not listen on 127.0.0.1:{args.port} ({exc.strerror}). Is mySpotify already running? "
              f"Try --port 8889 and add http://127.0.0.1:8889/callback to your Spotify app.")
        return 1
    url = f"http://127.0.0.1:{args.port}/"
    print(f"mySpotify {VERSION} is running at {url}")
    print(f"Redirect URI for your Spotify app: {url}callback")
    print("Press Ctrl+C to stop.")
    if not args.no_browser:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
