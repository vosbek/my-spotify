import http.client
import os
import sys
import threading
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import myspotify  # noqa: E402


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = myspotify.make_server(0)
        cls.port = cls.server.server_address[1]
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def get(self, path, host=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        conn.request("GET", path, headers={"Host": host or f"127.0.0.1:{self.port}"})
        res = conn.getresponse()
        body = res.read()
        conn.close()
        return res, body

    def test_serves_app_with_security_headers(self):
        res, body = self.get("/")
        self.assertEqual(res.status, 200)
        self.assertIn(b"mySpotify", body)
        csp = res.getheader("Content-Security-Policy")
        self.assertIn("script-src 'self' https://sdk.scdn.co", csp)
        self.assertIn("frame-ancestors 'none'", csp)
        self.assertEqual(res.getheader("X-Content-Type-Options"), "nosniff")

    def test_callback_route_serves_the_app(self):
        res, body = self.get("/callback?code=abc&state=xyz")
        self.assertEqual(res.status, 200)
        self.assertIn(b'<div class="shell">', body)

    def test_javascript_mime_type(self):
        res, _ = self.get("/js/main.js")
        self.assertEqual(res.status, 200)
        self.assertIn("javascript", res.getheader("Content-Type"))

    def test_path_traversal_is_blocked(self):
        for path in ("/../myspotify.py", "/%2e%2e/myspotify.py", "/js/../../README.md", "/..%2fmyspotify.py"):
            res, body = self.get(path)
            self.assertNotIn(b"def main", body, path)
            self.assertNotIn(b"mySpotify needs Python", body, path)

    def test_no_directory_listing(self):
        res, body = self.get("/js/")
        self.assertNotIn(b"Directory listing", body)

    def test_rejects_other_hosts(self):
        res, _ = self.get("/", host="evil.example")
        self.assertEqual(res.status, 421)


if __name__ == "__main__":
    unittest.main()
