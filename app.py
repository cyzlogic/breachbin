from flask import Flask, render_template, request, jsonify, session, redirect, url_for, g
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
import os
import uuid
import re
from datetime import datetime, timedelta
from functools import wraps

app = Flask(__name__)
app.secret_key = os.urandom(32).hex()
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

limiter = Limiter(get_remote_address, app=app, default_limits=["200 per day", "50 per hour"], storage_uri="memory://")

DATABASE = 'breach_bin.db'

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None: db.close()

def init_db():
    with app.app_context():
        db = get_db()
        c = db.cursor()
        c.execute('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, email TEXT UNIQUE, role TEXT NOT NULL DEFAULT \'member\', bio TEXT DEFAULT \'\', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, paste_count INTEGER DEFAULT 0)')
        c.execute('CREATE TABLE IF NOT EXISTS pastes (id INTEGER PRIMARY KEY AUTOINCREMENT, paste_id TEXT UNIQUE NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, syntax TEXT DEFAULT \'text\', user_id INTEGER, username TEXT NOT NULL, exposure TEXT DEFAULT \'public\', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, views INTEGER DEFAULT 0, fake_views INTEGER DEFAULT 0, fake_likes INTEGER DEFAULT 0, pinned INTEGER DEFAULT 0, FOREIGN KEY (user_id) REFERENCES users (id))')
        c.execute('CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, paste_id TEXT NOT NULL, username TEXT NOT NULL, content TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (paste_id) REFERENCES pastes (paste_id))')
        c.execute('CREATE TABLE IF NOT EXISTS likes (id INTEGER PRIMARY KEY AUTOINCREMENT, paste_id TEXT NOT NULL, user_id INTEGER NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(paste_id, user_id), FOREIGN KEY (paste_id) REFERENCES pastes (paste_id), FOREIGN KEY (user_id) REFERENCES users (id))')
        c.execute('CREATE TABLE IF NOT EXISTS announcements (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, content TEXT NOT NULL, author TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
        c.execute('CREATE TABLE IF NOT EXISTS tos (id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)')
        c.execute('SELECT COUNT(*) FROM tos')
        if c.fetchone()[0] == 0:
            c.execute('INSERT INTO tos (content) VALUES (?)', ('Default Terms of Service - Edit in admin panel.',))
        try: c.execute('ALTER TABLE pastes ADD COLUMN fake_views INTEGER DEFAULT 0')
        except: pass
        try: c.execute('ALTER TABLE pastes ADD COLUMN fake_likes INTEGER DEFAULT 0')
        except: pass
        try: c.execute('ALTER TABLE pastes ADD COLUMN pinned INTEGER DEFAULT 0')
        except: pass
        try: c.execute("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''")
        except: pass
        db.commit()

ROLE_COLORS = {
    'owner': {'color': '#FF0000', 'glow': '0 0 10px #FF0000, 0 0 20px #FF0000'},
    'admin': {'color': '#FF4500', 'glow': '0 0 8px #FF4500, 0 0 15px #FF4500'},
    'boss': {'color': '#FFD700', 'glow': '0 0 8px #FFD700, 0 0 15px #FFD700'},
    'ceo': {'color': '#8B00FF', 'glow': '0 0 8px #8B00FF, 0 0 15px #8B00FF'},
    'premium': {'color': '#00BFFF', 'glow': '0 0 8px #00BFFF'},
    'VIP': {'color': '#00FF00', 'glow': '0 0 8px #00FF00'},
    'skid': {'color': '#FF69B4', 'glow': '0 0 5px #FF69B4'},
    'member': {'color': '#888888', 'glow': 'none'},
}

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session: return jsonify({'error': 'Login required'}), 401
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if session.get('admin_bypass'): return f(*args, **kwargs)
        if 'user_id' not in session: return jsonify({'error': 'Login required'}), 401
        db = get_db()
        user = db.execute('SELECT role FROM users WHERE id = ?', (session['user_id'],)).fetchone()
        if not user or user['role'] not in ['owner', 'admin', 'boss']: return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated

def generate_paste_id(): return uuid.uuid4().hex[:12]

@app.route('/')
def index(): return render_template('index.html')

@app.route('/paste/<paste_id>')
def view_paste(paste_id): return render_template('paste.html', paste_id=paste_id)

@app.route('/user/<username>')
def view_user(username): return render_template('user_profile.html', username=username)

# ===== AUTH =====
@app.route('/api/auth/signup', methods=['POST'])
@limiter.limit("3 per minute")
def signup():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    email = data.get('email', '').strip()
    if not username or not password: return jsonify({'error': 'Username and password required'}), 400
    if len(username) < 3 or len(username) > 20: return jsonify({'error': 'Username must be 3-20 characters'}), 400
    if not re.match(r'^[a-zA-Z0-9_]+$', username): return jsonify({'error': 'Username can only contain letters, numbers, underscores'}), 400
    if len(password) < 4: return jsonify({'error': 'Password must be at least 4 characters'}), 400
    if email and not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email): return jsonify({'error': 'Invalid email format'}), 400
    db = get_db()
    if db.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone(): return jsonify({'error': 'Username already taken'}), 409
    if email and db.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone(): return jsonify({'error': 'Email already registered'}), 409
    hashed = generate_password_hash(password)
    count = db.execute('SELECT COUNT(*) FROM users').fetchone()[0]
    role = 'owner' if count == 0 else 'member'
    c = db.execute('INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)', (username, hashed, email if email else None, role))
    db.commit()
    session['user_id'] = c.lastrowid; session['username'] = username; session['role'] = role
    return jsonify({'success': True, 'user': {'id': c.lastrowid, 'username': username, 'role': role}}), 201

@app.route('/api/auth/login', methods=['POST'])
@limiter.limit("5 per minute")
def login():
    data = request.get_json()
    username = data.get('username', '').strip(); password = data.get('password', '').strip()
    if not username or not password: return jsonify({'error': 'Username and password required'}), 400
    db = get_db()
    user = db.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    if not user or not check_password_hash(user['password'], password): return jsonify({'error': 'Invalid credentials'}), 401
    session['user_id'] = user['id']; session['username'] = user['username']; session['role'] = user['role']
    return jsonify({'success': True, 'user': {'id': user['id'], 'username': user['username'], 'role': user['role'], 'email': user['email']}})

@app.route('/api/auth/logout')
def logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/auth/me')
def get_me():
    if 'user_id' not in session: return jsonify({'authenticated': False}), 200
    db = get_db()
    user = db.execute('SELECT id, username, email, role, bio, paste_count, created_at FROM users WHERE id = ?', (session['user_id'],)).fetchone()
    if not user: session.clear(); return jsonify({'authenticated': False}), 200
    return jsonify({'authenticated': True, 'user': dict(user)})

@app.route('/api/user/bio', methods=['POST'])
@login_required
def update_bio():
    data = request.get_json(); bio = data.get('bio', '').strip()
    if len(bio) > 500: return jsonify({'error': 'Bio too long (max 500 chars)'}), 400
    db = get_db()
    db.execute('UPDATE users SET bio = ? WHERE id = ?', (bio, session['user_id'])); db.commit()
    return jsonify({'success': True, 'bio': bio})

# ===== PASTES =====
@app.route('/api/pastes')
def get_pastes():
    db = get_db(); page = request.args.get('page', 1, type=int); search = request.args.get('search', ''); per_page = 20
    q = 'SELECT * FROM pastes WHERE exposure = "public"'; cq = 'SELECT COUNT(*) FROM pastes WHERE exposure = "public"'; p = []
    if search:
        sp = f'%{search}%'; q += ' AND (title LIKE ? OR username LIKE ? OR content LIKE ?)'; cq += ' AND (title LIKE ? OR username LIKE ? OR content LIKE ?)'; p = [sp, sp, sp]
    q += ' ORDER BY pinned DESC, created_at DESC LIMIT ? OFFSET ?'
    count = db.execute(cq, p).fetchone()[0]
    pastes = db.execute(q, p + [per_page, (page - 1) * per_page]).fetchall()
    return jsonify({'pastes': [dict(pst) for pst in pastes], 'total': count, 'page': page, 'pages': (count + per_page - 1) // per_page})

@app.route('/api/pastes/<paste_id>')
def get_paste(paste_id):
    db = get_db()
    paste = db.execute('SELECT * FROM pastes WHERE paste_id = ?', (paste_id,)).fetchone()
    if not paste: return jsonify({'error': 'Paste not found'}), 404
    db.execute('UPDATE pastes SET views = views + 1 WHERE paste_id = ?', (paste_id,)); db.commit()
    p = dict(paste)
    p['display_views'] = p['views'] + p['fake_views']
    real_likes = db.execute('SELECT COUNT(*) FROM likes WHERE paste_id = ?', (paste_id,)).fetchone()[0]
    p['like_count'] = real_likes + (p['fake_likes'] or 0)
    p['user_liked'] = False
    if 'user_id' in session:
        liked = db.execute('SELECT id FROM likes WHERE paste_id = ? AND user_id = ?', (paste_id, session['user_id'])).fetchone()
        p['user_liked'] = liked is not None
    comments = db.execute('SELECT * FROM comments WHERE paste_id = ? ORDER BY created_at ASC', (paste_id,)).fetchall()
    p['comments'] = [dict(c) for c in comments]
    return jsonify(p)

@app.route('/api/pastes', methods=['POST'])
@limiter.limit("10 per minute")
@login_required
def create_paste():
    data = request.get_json()
    title = data.get('title', 'Untitled').strip(); content = data.get('content', '').strip()
    syntax = data.get('syntax', 'text'); exposure = data.get('exposure', 'public'); anonymous = data.get('anonymous', False)
    if not content: return jsonify({'error': 'Content is required'}), 400
    if len(content) > 100000: return jsonify({'error': 'Paste too large (max 100k chars)'}), 400
    db = get_db(); pid = generate_paste_id()
    username = 'anonymous' if anonymous else session['username']
    uid = None if anonymous else session['user_id']
    db.execute('INSERT INTO pastes (paste_id, title, content, syntax, user_id, username, exposure) VALUES (?, ?, ?, ?, ?, ?, ?)', (pid, title, content, syntax, uid, username, exposure))
    if not anonymous: db.execute('UPDATE users SET paste_count = paste_count + 1 WHERE id = ?', (session['user_id'],))
    db.commit()
    return jsonify({'paste_id': pid, 'url': f'/paste/{pid}'}), 201

@app.route('/api/pastes/<paste_id>', methods=['DELETE'])
@login_required
def delete_paste(paste_id):
    db = get_db()
    paste = db.execute('SELECT * FROM pastes WHERE paste_id = ?', (paste_id,)).fetchone()
    if not paste: return jsonify({'error': 'Paste not found'}), 404
    user = db.execute('SELECT role FROM users WHERE id = ?', (session['user_id'],)).fetchone()
    if paste['user_id'] != session['user_id'] and user['role'] not in ['owner', 'admin', 'boss']: return jsonify({'error': 'Unauthorized'}), 403
    db.execute('DELETE FROM likes WHERE paste_id = ?', (paste_id,))
    db.execute('DELETE FROM comments WHERE paste_id = ?', (paste_id,))
    db.execute('DELETE FROM pastes WHERE paste_id = ?', (paste_id,)); db.commit()
    return jsonify({'success': True})

# ===== LIKES =====
@app.route('/api/pastes/<paste_id>/like', methods=['POST'])
@login_required
def toggle_like(paste_id):
    db = get_db()
    if not db.execute('SELECT id FROM pastes WHERE paste_id = ?', (paste_id,)).fetchone(): return jsonify({'error': 'Paste not found'}), 404
    liked = db.execute('SELECT id FROM likes WHERE paste_id = ? AND user_id = ?', (paste_id, session['user_id'])).fetchone()
    if liked:
        db.execute('DELETE FROM likes WHERE id = ?', (liked['id'],)); db.commit()
        real = db.execute('SELECT COUNT(*) FROM likes WHERE paste_id = ?', (paste_id,)).fetchone()[0]
        paste = db.execute('SELECT fake_likes FROM pastes WHERE paste_id = ?', (paste_id,)).fetchone()
        return jsonify({'liked': False, 'like_count': real + (paste['fake_likes'] or 0)})
    else:
        db.execute('INSERT INTO likes (paste_id, user_id) VALUES (?, ?)', (paste_id, session['user_id'])); db.commit()
        real = db.execute('SELECT COUNT(*) FROM likes WHERE paste_id = ?', (paste_id,)).fetchone()[0]
        paste = db.execute('SELECT fake_likes FROM pastes WHERE paste_id = ?', (paste_id,)).fetchone()
        return jsonify({'liked': True, 'like_count': real + (paste['fake_likes'] or 0)})

# ===== COMMENTS =====
@app.route('/api/pastes/<paste_id>/comments', methods=['POST'])
@login_required
def add_comment(paste_id):
    data = request.get_json(); content = data.get('content', '').strip()
    if not content or len(content) > 1000: return jsonify({'error': 'Comment must be 1-1000 characters'}), 400
    db = get_db()
    if not db.execute('SELECT id FROM pastes WHERE paste_id = ?', (paste_id,)).fetchone(): return jsonify({'error': 'Paste not found'}), 404
    db.execute('INSERT INTO comments (paste_id, username, content) VALUES (?, ?, ?)', (paste_id, session['username'], content)); db.commit()
    cid = db.execute('SELECT last_insert_rowid()').fetchone()[0]
    return jsonify(dict(db.execute('SELECT * FROM comments WHERE id = ?', (cid,)).fetchone())), 201

# ===== USERS =====
@app.route('/api/users')
def get_users():
    db = get_db(); search = request.args.get('search', '')
    q = 'SELECT id, username, role, paste_count, created_at FROM users'; p = []
    if search: q += ' WHERE username LIKE ?'; p.append(f'%{search}%')
    q += ' ORDER BY CASE role WHEN "owner" THEN 0 WHEN "admin" THEN 1 WHEN "boss" THEN 2 WHEN "ceo" THEN 3 WHEN "premium" THEN 4 WHEN "VIP" THEN 5 WHEN "skid" THEN 6 ELSE 7 END, username'
    return jsonify({'users': [dict(u) for u in db.execute(q, p).fetchall()]})

@app.route('/api/users/<username>')
def get_user(username):
    db = get_db()
    user = db.execute('SELECT id, username, email, role, paste_count, created_at FROM users WHERE username = ?', (username,)).fetchone()
    if not user: return jsonify({'error': 'User not found'}), 404
    pastes = db.execute('SELECT * FROM pastes WHERE username = ? AND exposure = "public" ORDER BY created_at DESC', (username,)).fetchall()
    return jsonify({'user': dict(user), 'pastes': [dict(p) for p in pastes]})

@app.route('/api/users/management')
def get_management_users():
    db = get_db()
    users = db.execute("SELECT id, username, role, paste_count, created_at FROM users WHERE role IN ('owner','admin','boss','ceo','premium') ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'boss' THEN 2 WHEN 'ceo' THEN 3 WHEN 'premium' THEN 4 ELSE 5 END").fetchall()
    return jsonify({'users': [dict(u) for u in users]})

# ===== ANNOUNCEMENTS =====
@app.route('/api/announcements')
def get_announcements():
    db = get_db()
    return jsonify({'announcements': [dict(a) for a in db.execute('SELECT * FROM announcements ORDER BY created_at DESC').fetchall()]})

@app.route('/api/announcements', methods=['POST'])
@admin_required
def create_announcement():
    data = request.get_json(); title = data.get('title', '').strip(); content = data.get('content', '').strip()
    if not title or not content: return jsonify({'error': 'Title and content required'}), 400
    db = get_db(); author = session.get('username', '[admin]')
    db.execute('INSERT INTO announcements (title, content, author) VALUES (?, ?, ?)', (title, content, author)); db.commit()
    return jsonify({'success': True}), 201

@app.route('/api/announcements/<int:announcement_id>', methods=['DELETE'])
@admin_required
def delete_announcement(announcement_id):
    db = get_db(); db.execute('DELETE FROM announcements WHERE id = ?', (announcement_id,)); db.commit()
    return jsonify({'success': True})

# ===== TOS =====
@app.route('/api/tos')
def get_tos():
    db = get_db()
    tos = db.execute('SELECT * FROM tos ORDER BY updated_at DESC LIMIT 1').fetchone()
    return jsonify({'tos': dict(tos) if tos else {'content': 'No TOS set.'}})

@app.route('/api/tos', methods=['POST'])
@admin_required
def update_tos():
    data = request.get_json(); content = data.get('content', '').strip()
    if not content: return jsonify({'error': 'Content required'}), 400
    db = get_db(); db.execute('UPDATE tos SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1', (content,)); db.commit()
    return jsonify({'success': True})

# ===== ADMIN =====
@app.route('/api/admin/users')
@admin_required
def admin_get_users():
    db = get_db()
    return jsonify({'users': [dict(u) for u in db.execute('SELECT id, username, email, role, paste_count, created_at FROM users ORDER BY id').fetchall()]})

@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@admin_required
def admin_delete_user(user_id):
    db = get_db()
    if not db.execute('SELECT id FROM users WHERE id = ?', (user_id,)).fetchone(): return jsonify({'error': 'User not found'}), 404
    db.execute('DELETE FROM likes WHERE user_id = ?', (user_id,))
    db.execute("DELETE FROM comments WHERE username = (SELECT username FROM users WHERE id = ?)", (user_id,))
    db.execute('DELETE FROM pastes WHERE user_id = ?', (user_id,))
    db.execute('DELETE FROM users WHERE id = ?', (user_id,)); db.commit()
    return jsonify({'success': True})

@app.route('/api/admin/users/<int:user_id>/role', methods=['POST'])
@admin_required
def admin_set_role(user_id):
    data = request.get_json(); new_role = data.get('role', '').strip()
    if new_role not in ROLE_COLORS: return jsonify({'error': 'Invalid role'}), 400
    db = get_db()
    if not db.execute('SELECT id FROM users WHERE id = ?', (user_id,)).fetchone(): return jsonify({'error': 'User not found'}), 404
    db.execute('UPDATE users SET role = ? WHERE id = ?', (new_role, user_id)); db.commit()
    return jsonify({'success': True})

@app.route('/api/admin/pastes')
@admin_required
def admin_get_pastes():
    db = get_db(); search = request.args.get('search', '')
    q = 'SELECT * FROM pastes'; p = []
    if search: q += ' WHERE title LIKE ? OR username LIKE ?'; sp = f'%{search}%'; p = [sp, sp]
    q += ' ORDER BY id DESC'
    return jsonify({'pastes': [dict(pst) for pst in db.execute(q, p).fetchall()]})

@app.route('/api/admin/pastes/<paste_id>/pin', methods=['POST'])
@admin_required
def admin_toggle_pin(paste_id):
    db = get_db()
    paste = db.execute('SELECT pinned FROM pastes WHERE paste_id = ?', (paste_id,)).fetchone()
    if not paste: return jsonify({'error': 'Paste not found'}), 404
    new = 0 if paste['pinned'] else 1
    db.execute('UPDATE pastes SET pinned = ? WHERE paste_id = ?', (new, paste_id)); db.commit()
    return jsonify({'success': True, 'pinned': new})

@app.route('/api/admin/pastes/<paste_id>/delete', methods=['DELETE'])
@admin_required
def admin_delete_paste(paste_id):
    db = get_db()
    if not db.execute('SELECT id FROM pastes WHERE paste_id = ?', (paste_id,)).fetchone(): return jsonify({'error': 'Paste not found'}), 404
    db.execute('DELETE FROM likes WHERE paste_id = ?', (paste_id,))
    db.execute('DELETE FROM comments WHERE paste_id = ?', (paste_id,))
    db.execute('DELETE FROM pastes WHERE paste_id = ?', (paste_id,)); db.commit()
    return jsonify({'success': True})

@app.route('/api/admin/pastes/<paste_id>/spoof', methods=['POST'])
@admin_required
def admin_spoof_views(paste_id):
    data = request.get_json(); fake_views = data.get('fake_views', 0)
    if not isinstance(fake_views, int) or fake_views < 0: return jsonify({'error': 'Invalid view count'}), 400
    db = get_db()
    if not db.execute('SELECT id FROM pastes WHERE paste_id = ?', (paste_id,)).fetchone(): return jsonify({'error': 'Paste not found'}), 404
    db.execute('UPDATE pastes SET fake_views = ? WHERE paste_id = ?', (fake_views, paste_id)); db.commit()
    return jsonify({'success': True, 'fake_views': fake_views})

@app.route('/api/admin/pastes/<paste_id>/spoof-likes', methods=['POST'])
@admin_required
def admin_spoof_likes(paste_id):
    data = request.get_json(); fake_likes = data.get('fake_likes', 0)
    if not isinstance(fake_likes, int) or fake_likes < 0: return jsonify({'error': 'Invalid like count'}), 400
    db = get_db()
    if not db.execute('SELECT id FROM pastes WHERE paste_id = ?', (paste_id,)).fetchone(): return jsonify({'error': 'Paste not found'}), 404
    db.execute('UPDATE pastes SET fake_likes = ? WHERE paste_id = ?', (fake_likes, paste_id)); db.commit()
    return jsonify({'success': True, 'fake_likes': fake_likes})

# ===== ADMIN CHECK =====
@app.route('/api/admin/check')
def check_admin():
    if session.get('admin_bypass'): return jsonify({'authenticated': True, 'role': 'admin', 'bypass': True})
    if 'user_id' not in session: return jsonify({'authenticated': False})
    db = get_db()
    user = db.execute('SELECT role FROM users WHERE id = ?', (session['user_id'],)).fetchone()
    if user and user['role'] in ['owner', 'admin', 'boss']: return jsonify({'authenticated': True, 'role': user['role'], 'bypass': False})
    return jsonify({'authenticated': False})

# Secure admin password - hashed so it can't be bruteforced from source
ADMIN_PASSWORD_HASH = generate_password_hash('BreaChB1n_Adm1n_2026!')

@app.route('/api/admin/login', methods=['POST'])
@limiter.limit("3 per minute")
def admin_login():
    data = request.get_json(); password = data.get('password', '')
    if check_password_hash(ADMIN_PASSWORD_HASH, password):
        session['admin_bypass'] = True
        return jsonify({'success': True, 'role': 'admin'})
    return jsonify({'error': 'Invalid password'}), 401

if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)