"""Campus Market Hub academic demo: Python stdlib HTTP API and SQLite backend."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
import hashlib
import base64
import hmac
import mimetypes
import json
import os
import re
import secrets
import sqlite3
import threading
import time
import webbrowser

ROOT = Path(__file__).parent
DB = Path(os.environ.get("CMH_DB_PATH", ROOT / "campus_market.db"))
UPLOADS = Path(os.environ.get("CMH_UPLOAD_DIR", ROOT / "uploads"))
MAX_IMAGE_BYTES = 5 * 1024 * 1024
SESSION_SECRET = os.environ.get("CMH_SESSION_SECRET", "local-demo-session-key-change-for-hosting").encode()
LOCK = threading.Lock()

def db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    DB.parent.mkdir(parents=True, exist_ok=True)
    with db() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'student');
        CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, price INTEGER NOT NULL, description TEXT NOT NULL, seller TEXT NOT NULL, emoji TEXT NOT NULL, stock INTEGER NOT NULL DEFAULT 10, active INTEGER NOT NULL DEFAULT 1, image_url TEXT);
        CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY, buyer TEXT NOT NULL, items TEXT NOT NULL, total INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'Received', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS lost_found(id INTEGER PRIMARY KEY, kind TEXT NOT NULL, item_name TEXT NOT NULL, description TEXT NOT NULL, location TEXT NOT NULL, contact TEXT NOT NULL, contact_name TEXT, reporter TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, location TEXT NOT NULL, starts_at TEXT NOT NULL, category TEXT NOT NULL, emoji TEXT NOT NULL, host TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS event_rsvps(id INTEGER PRIMARY KEY, event_id INTEGER NOT NULL REFERENCES events(id), email TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(event_id,email));
        """)
        product_cols = {row[1] for row in c.execute("PRAGMA table_info(products)")}
        if "image_url" not in product_cols:
            c.execute("ALTER TABLE products ADD COLUMN image_url TEXT")
        lost_cols = {row[1] for row in c.execute("PRAGMA table_info(lost_found)")}
        if "contact_name" not in lost_cols:
            c.execute("ALTER TABLE lost_found ADD COLUMN contact_name TEXT")
            c.execute("UPDATE lost_found SET contact_name=reporter WHERE contact_name IS NULL")
        if c.execute("SELECT COUNT(*) FROM products").fetchone()[0] == 0:
            products = [
             ("Scientific Calculator", "Study", 48000, "Reliable calculator for lectures, tests and everyday problem solving.", "Campus Essentials", "🧮", 12),
             ("Everyday Backpack", "Fashion", 65000, "A roomy, sturdy backpack with space for books and a laptop.", "Kampala Bags", "🎒", 8),
             ("USB-C Earphones", "Electronics", 28000, "Clear sound for study playlists, calls and walks across campus.", "Tech Corner", "🎧", 15),
             ("Fresh Notebook Set", "Study", 18000, "Three soft-cover notebooks for notes, plans and big ideas.", "Campus Essentials", "📚", 20),
             ("Classic Campus Hoodie", "Fashion", 55000, "A comfortable layer for cool mornings and late study sessions.", "Thread & Campus", "🧥", 6),
             ("Desk Study Lamp", "Electronics", 42000, "Compact adjustable lamp to brighten your desk after class.", "Tech Corner", "💡", 9),
            ]
            c.executemany("INSERT INTO products(name,category,price,description,seller,emoji,stock) VALUES(?,?,?,?,?,?,?)", products)
        if not c.execute("SELECT 1 FROM users WHERE email='vendor@campus.demo'").fetchone():
            c.execute("INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)", ("Demo Vendor", "vendor@campus.demo", pw("campus123"), "vendor"))
        if not c.execute("SELECT 1 FROM users WHERE email='student@campus.demo'").fetchone():
            c.execute("INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)", ("Demo Student", "student@campus.demo", pw("campus123"), "student"))
        if c.execute("SELECT COUNT(*) FROM events").fetchone()[0] == 0:
            events = [
                ("Campus Creators Market", "Browse student-run stalls, handmade goods, snacks and campus finds.", "Main Campus Courtyard", "2026-11-18T10:00", "Community", "🛍️", "Gulu Campus Life"),
                ("Open Mic Under the Stars", "Bring a poem, song or story—or come cheer on your friends.", "Students' Centre", "2026-11-21T18:30", "Arts & Culture", "🎤", "Gulu Arts Society"),
                ("Study Skills & Wellbeing Pop-up", "Practical study planning and wellbeing sessions before the end-of-semester rush.", "Main Library", "2026-11-25T14:00", "Learning", "📖", "Peer Support Network"),
            ]
            c.executemany("INSERT INTO events(title,description,location,starts_at,category,emoji,host) VALUES(?,?,?,?,?,?,?)", events)

def pw(value): return hashlib.sha256(value.encode()).hexdigest()

def make_session(user):
    payload = {"id":user["id"],"name":user["name"],"email":user["email"],"role":user["role"],"exp":int(time.time()) + 7 * 24 * 60 * 60}
    encoded = base64.urlsafe_b64encode(json.dumps(payload,separators=(",",":")).encode()).rstrip(b"=").decode()
    signature = hmac.new(SESSION_SECRET,encoded.encode(),hashlib.sha256).hexdigest()
    return f"{encoded}.{signature}"

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs): super().__init__(*args, directory=str(ROOT), **kwargs)
    def log_message(self, *_): pass
    def send_json(self, value, status=200):
        raw = json.dumps(value).encode()
        self.send_response(status); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(raw))); self.send_header("Access-Control-Allow-Origin", "*"); self.end_headers(); self.wfile.write(raw)
    def body(self):
        n = int(self.headers.get("Content-Length", 0))
        if n > 8 * 1024 * 1024: raise ValueError("Request body is too large")
        return json.loads(self.rfile.read(n) or b"{}")
    def user(self):
        token = self.headers.get("X-Session", "")
        try:
            encoded, signature = token.split(".",1)
            expected = hmac.new(SESSION_SECRET,encoded.encode(),hashlib.sha256).hexdigest()
            if not hmac.compare_digest(signature,expected): return None
            payload = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
            return payload if payload.get("exp",0) > int(time.time()) else None
        except (ValueError, json.JSONDecodeError, TypeError): return None
    def do_GET(self):
        path = urlparse(self.path).path
        if path.startswith("/uploads/"):
            filename = path.rsplit("/", 1)[-1]
            if not re.fullmatch(r"[a-f0-9]{32}\.(jpg|png|webp|gif)", filename): return self.send_error(404)
            image = UPLOADS / filename
            if not image.is_file(): return self.send_error(404)
            raw = image.read_bytes(); self.send_response(200); self.send_header("Content-Type", mimetypes.guess_type(filename)[0] or "application/octet-stream"); self.send_header("Content-Length", str(len(raw))); self.send_header("Cache-Control", "public, max-age=86400"); self.end_headers(); self.wfile.write(raw); return
        with db() as c:
            if path == "/api/products":
                rows = c.execute("SELECT * FROM products WHERE active=1 ORDER BY id DESC").fetchall(); return self.send_json([dict(x) for x in rows])
            if path.startswith("/api/products/"):
                row = c.execute("SELECT * FROM products WHERE id=?", (path.rsplit("/",1)[-1],)).fetchone(); return self.send_json(dict(row) if row else {"error":"Product not found"}, 200 if row else 404)
            if path == "/api/orders":
                u = self.user()
                if not u: return self.send_json({"error":"Sign in to see orders"}, 401)
                rows = c.execute("SELECT * FROM orders WHERE buyer=? ORDER BY id DESC", (u["email"],)).fetchall(); return self.send_json([dict(x) for x in rows])
            if path == "/api/lost-found":
                rows = c.execute("SELECT * FROM lost_found ORDER BY id DESC").fetchall(); return self.send_json([dict(x) for x in rows])
            if path == "/api/events":
                u = self.user(); email = u["email"] if u else ""
                rows = c.execute("SELECT e.*, (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id=e.id) AS rsvp_count, EXISTS(SELECT 1 FROM event_rsvps r WHERE r.event_id=e.id AND r.email=?) AS attending FROM events e ORDER BY e.starts_at", (email,)).fetchall()
                return self.send_json([dict(x) for x in rows])
            if path == "/api/me": return self.send_json(self.user() or {})
        return super().do_GET()
    def do_POST(self):
        path = urlparse(self.path).path
        try: data = self.body()
        except (ValueError, json.JSONDecodeError): return self.send_json({"error":"Request is invalid or too large"},413)
        with db() as c:
            if path in ("/api/login", "/api/register"):
                if path.endswith("register"):
                    try:
                        c.execute("INSERT INTO users(name,email,password,role) VALUES(?,?,?,?)", (data["name"], data["email"].lower(), pw(data["password"]), data.get("role","student")))
                    except sqlite3.IntegrityError: return self.send_json({"error":"That email is already registered"}, 400)
                row = c.execute("SELECT id,name,email,role,password FROM users WHERE email=?", (data.get("email","").lower(),)).fetchone()
                if not row or row["password"] != pw(data.get("password", "")): return self.send_json({"error":"Check your email and password"}, 401)
                session_user = {"id":row["id"],"name":row["name"],"email":row["email"],"role":row["role"]}
                return self.send_json({"token":make_session(session_user),"user":session_user})
            u = self.user()
            if path == "/api/upload-image":
                if not u: return self.send_json({"error":"Sign in to upload a product photo"},401)
                match = re.fullmatch(r"data:image/(jpeg|png|webp|gif);base64,([A-Za-z0-9+/=]+)", data.get("image", ""))
                if not match: return self.send_json({"error":"Choose a PNG, JPG, WEBP or GIF image"},400)
                mime, encoded = match.groups()
                try: raw = base64.b64decode(encoded, validate=True)
                except ValueError: return self.send_json({"error":"The image file could not be read"},400)
                if not raw or len(raw) > MAX_IMAGE_BYTES: return self.send_json({"error":"Photos must be smaller than 5 MB"},400)
                valid = ((mime == "jpeg" and raw.startswith(b"\xff\xd8\xff")) or
                         (mime == "png" and raw.startswith(b"\x89PNG\r\n\x1a\n")) or
                         (mime == "gif" and raw[:6] in (b"GIF87a", b"GIF89a")) or
                         (mime == "webp" and raw[:4] == b"RIFF" and raw[8:12] == b"WEBP"))
                if not valid: return self.send_json({"error":"That file does not appear to be a supported image"},400)
                extension = {"jpeg":"jpg","png":"png","webp":"webp","gif":"gif"}[mime]
                UPLOADS.mkdir(exist_ok=True)
                filename = f"{secrets.token_hex(16)}.{extension}"
                (UPLOADS / filename).write_bytes(raw)
                return self.send_json({"image_url":f"/uploads/{filename}"},201)
            if path == "/api/orders":
                if not u: return self.send_json({"error":"Sign in before placing an order"}, 401)
                items = data.get("items", []); total = 0
                for item in items:
                    product = c.execute("SELECT * FROM products WHERE id=? AND active=1", (item["id"],)).fetchone()
                    qty = max(1, min(int(item.get("quantity",1)), 99))
                    if not product or product["stock"] < qty: return self.send_json({"error":"One of these products is out of stock"}, 400)
                    total += product["price"] * qty
                    c.execute("UPDATE products SET stock=stock-? WHERE id=?", (qty, product["id"]))
                cur = c.execute("INSERT INTO orders(buyer,items,total) VALUES(?,?,?)", (u["email"], json.dumps(items), total)); return self.send_json({"id":cur.lastrowid,"total":total,"status":"Received"}, 201)
            if path == "/api/lost-found":
                if not u: return self.send_json({"error":"Sign in to post a lost or found item"}, 401)
                required = ("kind", "item_name", "description", "location")
                if any(not str(data.get(k, "")).strip() for k in required): return self.send_json({"error":"Please complete each field"}, 400)
                contact_name = str(data.get("contact_name", u["name"])).strip() or u["name"]
                contact = str(data.get("contact", "")).strip()
                if not contact: return self.send_json({"error":"Add a phone number or other contact detail"},400)
                cur = c.execute("INSERT INTO lost_found(kind,item_name,description,location,contact,contact_name,reporter) VALUES(?,?,?,?,?,?,?)", (data["kind"],data["item_name"].strip(),data["description"].strip(),data["location"].strip(),contact,contact_name,u["name"]))
                return self.send_json(dict(c.execute("SELECT * FROM lost_found WHERE id=?",(cur.lastrowid,)).fetchone()),201)
            if path == "/api/events":
                if not u: return self.send_json({"error":"Sign in to share a campus event"}, 401)
                required = ("title", "description", "location", "starts_at")
                if any(not str(data.get(k, "")).strip() for k in required): return self.send_json({"error":"Please complete each field"}, 400)
                cur = c.execute("INSERT INTO events(title,description,location,starts_at,category,emoji,host) VALUES(?,?,?,?,?,?,?)", (data["title"].strip(),data["description"].strip(),data["location"].strip(),data["starts_at"],data.get("category","Community"),data.get("emoji","📅"),u["name"]))
                return self.send_json(dict(c.execute("SELECT * FROM events WHERE id=?",(cur.lastrowid,)).fetchone()),201)
            if path.startswith("/api/events/") and path.endswith("/rsvp"):
                if not u: return self.send_json({"error":"Sign in to RSVP"},401)
                event_id = path.split("/")[3]
                event = c.execute("SELECT id FROM events WHERE id=?",(event_id,)).fetchone()
                if not event: return self.send_json({"error":"Event not found"},404)
                existing = c.execute("SELECT id FROM event_rsvps WHERE event_id=? AND email=?",(event_id,u["email"])).fetchone()
                if existing: c.execute("DELETE FROM event_rsvps WHERE id=?",(existing["id"],)); attending = False
                else: c.execute("INSERT INTO event_rsvps(event_id,email) VALUES(?,?)",(event_id,u["email"])); attending = True
                count = c.execute("SELECT COUNT(*) FROM event_rsvps WHERE event_id=?",(event_id,)).fetchone()[0]
                return self.send_json({"attending":attending,"rsvp_count":count})
            if path == "/api/products":
                if not u: return self.send_json({"error":"Sign in before adding a product"},401)
                cur = c.execute("INSERT INTO products(name,category,price,description,seller,emoji,stock,image_url) VALUES(?,?,?,?,?,?,?,?)", (data["name"],data["category"],int(data["price"]),data["description"],u["name"],data.get("emoji","✨"),int(data.get("stock",1)),data.get("image_url")))
                return self.send_json(dict(c.execute("SELECT * FROM products WHERE id=?", (cur.lastrowid,)).fetchone()), 201)
        return self.send_json({"error":"Not found"},404)
    def do_PATCH(self):
        path = urlparse(self.path).path; u = self.user()
        if not u: return self.send_json({"error":"Sign in before managing products"},401)
        data = self.body(); pid = path.rsplit("/",1)[-1]
        with db() as c:
            product = c.execute("SELECT seller FROM products WHERE id=?",(pid,)).fetchone()
            if not product: return self.send_json({"error":"Product not found"},404)
            if u["role"] != "vendor" and product["seller"] != u["name"]: return self.send_json({"error":"You can only manage your own listings"},403)
            c.execute("UPDATE products SET stock=?,active=?,image_url=COALESCE(?,image_url) WHERE id=?", (max(0,int(data.get("stock",0))), int(bool(data.get("active",True))), data.get("image_url"), pid))
            row = c.execute("SELECT * FROM products WHERE id=?",(pid,)).fetchone()
            return self.send_json(dict(row) if row else {"error":"Product not found"}, 200 if row else 404)

if __name__ == "__main__":
    init_db()
    hosted_port = os.environ.get("PORT")
    if hosted_port:
        server = ThreadingHTTPServer(("0.0.0.0", int(hosted_port)), Handler)
        public_host = os.environ.get("PUBLIC_URL") or os.environ.get("RENDER_EXTERNAL_HOSTNAME")
        url = f"https://{public_host}/" if public_host and not public_host.startswith("http") else (public_host or f"listening on 0.0.0.0:{server.server_port}")
    else:
        server = None
        for port in (5500, 8000):
            try:
                server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
                break
            except OSError as exc:
                print(f"Port {port} is unavailable: {exc}")
        if server is None:
            raise SystemExit("Could not start the demo on port 5500 or 8000. Close another local server and try again.")
        url = f"http://127.0.0.1:{server.server_port}/"
    print(f"Campus Market Hub demo running at {url}", flush=True)
    if not hosted_port: webbrowser.open(url)
    server.serve_forever()
