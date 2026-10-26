#!/usr/bin/env python3
"""Art Mode photo server for the LG webOS home skin.

Serves the photos in a folder to the TV launcher over the home LAN:
  GET  /list.json     -> {"photos": ["a.jpg", ...]}
  GET  /photos/<name> -> the image file
  GET  /              -> a small upload page (phone/Mac friendly)
  POST /upload        -> save posted image files into the folder
  GET  /delete?name=x -> remove one photo
  GET  /config.json   -> the launcher settings shared with the TV
  POST /config.json   -> save launcher settings (JSON body)
  GET  /settings      -> phone page to edit the launcher settings

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
EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
         ".gif": "image/gif"}
CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tv-config.json")
CITIES = ["Ho Chi Minh City", "Ha Noi", "Da Nang", "Da Lat", "Nha Trang", "Can Tho"]

os.makedirs(PHOTOS, exist_ok=True)


def load_config():
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        return cfg if isinstance(cfg, dict) else {}
    except Exception:
        return {}


def save_config(cfg):
    tmp = CONFIG_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=1)
    os.replace(tmp, CONFIG_FILE)


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


SETTINGS_PAGE = """<!DOCTYPE html>
<html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cài đặt launcher tivi</title>
<style>
 body {{ font-family: -apple-system, sans-serif; margin: 24px; background: #111; color: #eee; }}
 h1 {{ font-size: 22px; }} .card {{ background: #1c1c1e; border-radius: 14px; padding: 18px; margin-bottom: 18px; }}
 label {{ display: block; margin: 14px 0 6px; color: #bbb; font-size: 14px; }}
 select, input {{ width: 100%; padding: 12px; border-radius: 10px; border: 1px solid #333; background: #222; color: #eee; font-size: 16px; }}
 button {{ background: #0a84ff; color: #fff; border: 0; border-radius: 10px; padding: 14px 20px; font-size: 16px; width: 100%; margin-top: 18px; }}
 #msg {{ margin-top: 12px; color: #7ee787; }} a {{ color: #58a6ff; }}
</style></head><body>
<h1>⚙️ Cài đặt launcher trên tivi</h1>
<div class="card">
 <label>Hình nền màn hình chính</label><select id="wallpaper"></select>
 <label>Cỡ dock (hàng icon)</label>
 <select id="dockSize"><option value="S">Nhỏ</option><option value="M">Vừa</option><option value="L">Lớn</option></select>
 <label>Khung tranh (Photo Frame)</label>
 <select id="artEnabled"><option value="true">Bật</option><option value="false">Tắt</option></select>
 <label>Khung tranh hiện sau (phút không bấm remote)</label>
 <select id="artIdleMinutes"><option>1</option><option>3</option><option>5</option><option>10</option></select>
 <label>Mỗi ảnh hiện (giây)</label>
 <select id="artSlideSeconds"><option>30</option><option>60</option><option>120</option></select>
 <label>Thành phố thời tiết</label><select id="weatherCity"></select>
 <button id="save">Lưu cài đặt</button>
 <div id="msg"></div>
 <p style="color:#888;font-size:13px">Tivi áp dụng ở lần mở launcher kế tiếp. Đổi trên tivi (ô Settings) cũng được — hai bên tự đồng bộ. <a href="/">← Trang ảnh</a></p>
</div>
<script>
var cfg = {{}};
function fill() {{
  var wp = document.getElementById('wallpaper');
  wp.innerHTML = '<option value="bundled">Kame House (có sẵn)</option>' + {photo_options};
  var cities = {cities};
  document.getElementById('weatherCity').innerHTML =
    cities.map(function (c) {{ return '<option>' + c + '</option>'; }}).join('');
  if (cfg.wallpaper) wp.value = cfg.wallpaper;
  if (cfg.dockSize) document.getElementById('dockSize').value = cfg.dockSize;
  document.getElementById('artEnabled').value = String(cfg.artEnabled !== false);
  if (cfg.artIdleMinutes) document.getElementById('artIdleMinutes').value = String(cfg.artIdleMinutes);
  if (cfg.artSlideSeconds) document.getElementById('artSlideSeconds').value = String(cfg.artSlideSeconds);
  if (cfg.weatherCity) document.getElementById('weatherCity').value = cfg.weatherCity;
}}
fetch('/config.json').then(function (r) {{ return r.json(); }}).then(function (c) {{ cfg = c || {{}}; fill(); }})
  .catch(function () {{ fill(); }});
document.getElementById('save').addEventListener('click', function () {{
  var out = {{
    wallpaper: document.getElementById('wallpaper').value,
    dockSize: document.getElementById('dockSize').value,
    artEnabled: document.getElementById('artEnabled').value === 'true',
    artIdleMinutes: parseInt(document.getElementById('artIdleMinutes').value, 10),
    artSlideSeconds: parseInt(document.getElementById('artSlideSeconds').value, 10),
    weatherCity: document.getElementById('weatherCity').value,
    rev: (cfg.rev || 0) + 1
  }};
  fetch('/config.json', {{ method: 'POST', headers: {{ 'Content-Type': 'application/json' }}, body: JSON.stringify(out) }})
    .then(function () {{ cfg = out; document.getElementById('msg').textContent = 'Đã lưu ✓'; }})
    .catch(function () {{ document.getElementById('msg').textContent = 'Lỗi khi lưu'; }});
}});
</script>
</body></html>"""


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", "0")
        self.end_headers()

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
        elif path == "/config.json":
            body = json.dumps(load_config()).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self._cors()
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif path == "/settings":
            opts = "".join(
                '<option value="{v}">{n}</option>'.format(
                    v=html.escape(n, quote=True), n=html.escape(n.rsplit(".", 1)[0]))
                for n in photo_names()
            )
            body = SETTINGS_PAGE.format(
                photo_options=json.dumps(opts), cities=json.dumps(CITIES)).encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
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
        if urllib.parse.urlparse(self.path).path == "/config.json":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                cfg = json.loads(self.rfile.read(length).decode("utf-8"))
                if not isinstance(cfg, dict):
                    raise ValueError("not an object")
                save_config(cfg)
                body = b"{}"
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self._cors()
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except Exception:
                self.send_error(400)
            return
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
