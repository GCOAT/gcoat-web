#!/usr/bin/env python3
"""
dev-proxy.py — Single-origin local dev server.

Serves frontend static files AND proxies API requests to SAM Local,
so the browser sees everything on http://localhost:8080 (no CORS issues).

Usage:
    python3 backend/local/dev-proxy.py

Requires: SAM Local running on localhost:3000
"""

import http.server
import urllib.request
import os
import sys

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "frontend")
SAM_LOCAL = "http://localhost:3000"
PORT = 8080

# Routes that should be proxied to SAM Local
API_PREFIXES = ("/leads", "/content", "/media", "/blog", "/listings")


class DevProxyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=FRONTEND_DIR, **kwargs)

    def do_GET(self):
        if self._is_api():
            self._proxy()
        else:
            super().do_GET()

    def do_POST(self):
        self._proxy()

    def do_PUT(self):
        self._proxy()

    def do_DELETE(self):
        self._proxy()

    def do_OPTIONS(self):
        if self._is_api():
            self._proxy()
        else:
            super().do_GET()

    def _is_api(self):
        return any(self.path.startswith(p) for p in API_PREFIXES)

    def _proxy(self):
        url = f"{SAM_LOCAL}{self.path}"
        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len) if content_len else None

        # Forward all headers (skip Host and Accept-Encoding to avoid gzip issues)
        headers = {}
        for key, val in self.headers.items():
            if key.lower() not in ("host", "accept-encoding"):
                headers[key] = val

        req = urllib.request.Request(url, data=body, headers=headers, method=self.command)
        try:
            with urllib.request.urlopen(req) as resp:
                resp_body = resp.read()
                self.send_response(resp.status)
                for key, val in resp.getheaders():
                    if key.lower() not in ("transfer-encoding", "connection"):
                        self.send_header(key, val)
                self.end_headers()
                self.wfile.write(resp_body)
        except urllib.error.HTTPError as e:
            resp_body = e.read()
            self.send_response(e.code)
            for key, val in e.headers.items():
                if key.lower() not in ("transfer-encoding", "connection"):
                    self.send_header(key, val)
            self.end_headers()
            self.wfile.write(resp_body)
        except urllib.error.URLError:
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"ok":false,"message":"SAM Local not reachable on port 3000"}')

    def log_message(self, format, *args):
        path = args[0] if args else ""
        if self._is_api():
            sys.stderr.write(f"  PROXY  {self.command} {self.path}\n")
        else:
            super().log_message(format, *args)


if __name__ == "__main__":
    print(f"Dev proxy starting on http://localhost:{PORT}")
    print(f"  Frontend: {os.path.abspath(FRONTEND_DIR)}")
    print(f"  API proxy: {SAM_LOCAL}")
    print()
    server = http.server.HTTPServer(("localhost", PORT), DevProxyHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
