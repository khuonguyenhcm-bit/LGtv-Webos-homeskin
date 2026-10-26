#!/usr/bin/env python3
"""Art Mode photo server for the LG webOS home skin.

Serves the photos in a folder to the TV launcher over the home LAN:
  GET  /list.json     -> {"photos": ["a.jpg", ...]}
  GET  /photos/<name> -> the image file
  GET  /              -> a small upload page (phone/Mac friendly)
  POST /upload        -> save posted image files into the folder
  GET  /delete?name=x -> remove one photo

Stdlib only. Run:  python3 art_server.py [port] [photos_dir]
Defaults: port 8797, photos dir ~/art-photos.
"""
import cgi
import html
import json
import os
import sys
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8797
PHOTOS = os.path.expanduser(sys.argv[2]) if len(sys.argv) > 2 else os.path.expanduser("~/art-photos")
EXTS = {".jpg", ".jpeg", ".png", ".webp"}
TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}

os.makedirs(PHOTOS, exist_ok=True)


def photo_names():
    return sorted(
        n for n in os.listdir(PHOTOS)
        if os.path.splitext(n)[1].lower() in EXTS and os.path.isfile(os.path.join(PHOTOS, n))
    )


PAGE = """<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ảnh Art Mode</title>
<style>
 body {{ font-family: -apple-system, sans-serif; margin: 24px; background: #111; color: #eee; }}
 h1 {{ font-size: 22px; }} .card {{ background: #1c1c1e; border-radius: 14px; padding: 18px; margin-bottom: 18px; }}
 input[type=file] {{ width: 100%; margin: 12px 0; }}
 button {{ background: #0a84ff; color: #fff; border: 0; border-radius: 10px; padding: 12px 20px; font-size: 16px; }}
 li {{ margin: 8px 0; }} a {{ color: #ff6961; text-decoration: none; margin-left: 10px; }}
 img {{ width: 84px; height: 48px; object-fit: cover; border-radius: 6px; vertical-align: middle; margin-right: 10px; }}
</style></head><body>
<h1>🖼️ Ảnh cho Art Mode trên tivi</h1>
<div class="card"><form method="post" action="/upload" enctype="multipart/form-data">
 <div>Chọn ảnh từ điện thoại / máy tính (jpg, png, webp — chọn được nhiều ảnh):</div>
 <input type="file" name="photos" accept="image/*" multiple>
 <button type="submit">Tải lên</button></form></div>
<div class="card"><div>Đang có <b>{count}</b> ảnh — tivi sẽ tự lấy danh sách mới nhất:</div>
<ul>{items}</ul></div>
</body></html>"""


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = urllib.parse.unquote(parsed.path)
        if path == "/list.json":
            body = json.dumps({"photos": photo_names()}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif path.startswith("/photos/"):
            name = os.path.basename(path[len("/photos/"):])
            full = os.path.join(PHOTOS, name)
            ext = os.path.splitext(name)[1].lower()
            if ext in EXTS and os.path.isfile(full):
                with open(full, "rb") as f:
                    data = f.read()
                self.send_response(200)
                self.send_header("Content-Type", TYPES[ext])
                self._cors()
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            else:
                self.send_error(404)
        elif path == "/delete":
            name = os.path.basename(urllib.parse.parse_qs(parsed.query).get("name", [""])[0])
            full = os.path.join(PHOTOS, name)
            if name and os.path.isfile(full):
                os.remove(full)
            self.send_response(303)
            self.send_header("Location", "/")
            self.end_headers()
        elif path == "/health":
            body = b"ok"
            self.send_response(200)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif path == "/":
            items = "".join(
                '<li><img src="/photos/{u}">{n} <a href="/delete?name={u}">xoá</a></li>'.format(
                    u=urllib.parse.quote(n), n=html.escape(n)
                )
                for n in photo_names()
            ) or "<li>(chưa có ảnh nào)</li>"
            body = PAGE.format(count=len(photo_names()), items=items).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_error(404)

    def do_POST(self):
        if urllib.parse.urlparse(self.path).path != "/upload":
            self.send_error(404)
            return
        form = cgi.FieldStorage(
            fp=self.rfile,
            headers=self.headers,
            environ={"REQUEST_METHOD": "POST", "CONTENT_TYPE": self.headers.get("Content-Type", "")},
        )
        fields = form["photos"] if "photos" in form else []
        if not isinstance(fields, list):
            fields = [fields]
        for field in fields:
            if not getattr(field, "filename", None):
                continue
            ext = os.path.splitext(field.filename)[1].lower()
            if ext not in EXTS:
                continue
            name = os.path.basename(field.filename).replace(" ", "_")
            with open(os.path.join(PHOTOS, name), "wb") as out:
                out.write(field.file.read())
        self.send_response(303)
        self.send_header("Location", "/")
        self.end_headers()

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    print(f"Art server: http://0.0.0.0:{PORT}  photos: {PHOTOS} ({len(photo_names())} files)")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
