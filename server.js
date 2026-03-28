const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'dhb_secret_key_change_in_production';
const DB_PATH = path.join(__dirname, 'users.db');

let db;

// ── Database setup ──
async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT NOT NULL,
      email     TEXT UNIQUE NOT NULL,
      password  TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS decisions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      topic      TEXT,
      winner     TEXT,
      summary    TEXT,
      confidence INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);
  saveDB();
}

function saveDB() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── Middleware: verify JWT ──
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ── Routes ──

// Sign Up
app.post('/api/signup', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'All fields are required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const existing = db.exec('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length > 0 && existing[0].values.length > 0)
    return res.status(409).json({ error: 'Email already registered' });

  const hashed = bcrypt.hashSync(password, 10);
  db.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hashed]);
  const result = db.exec('SELECT last_insert_rowid() as id');
  const id = result[0].values[0][0];
  saveDB();
  const token = jwt.sign({ id, name, email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id, name, email } });
});

// Sign In
app.post('/api/signin', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  const rows = db.exec('SELECT * FROM users WHERE email = ?', [email]);
  if (rows.length === 0 || rows[0].values.length === 0)
    return res.status(401).json({ error: 'Invalid email or password' });

  const cols = rows[0].columns;
  const vals = rows[0].values[0];
  const user = {};
  cols.forEach((c, i) => user[c] = vals[i]);

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

// Get current user
app.get('/api/me', auth, (req, res) => {
  const rows = db.exec('SELECT id, name, email, created_at FROM users WHERE id = ?', [req.user.id]);
  if (rows.length === 0 || rows[0].values.length === 0)
    return res.status(404).json({ error: 'User not found' });
  const cols = rows[0].columns;
  const vals = rows[0].values[0];
  const user = {};
  cols.forEach((c, i) => user[c] = vals[i]);
  res.json(user);
});

// Save decision
app.post('/api/decisions', auth, (req, res) => {
  const { topic, winner, summary, confidence } = req.body;
  db.run('INSERT INTO decisions (user_id, topic, winner, summary, confidence) VALUES (?, ?, ?, ?, ?)',
    [req.user.id, topic, winner, summary, confidence]);
  saveDB();
  res.json({ ok: true });
});

// Get decisions for user
app.get('/api/decisions', auth, (req, res) => {
  const rows = db.exec('SELECT * FROM decisions WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
  if (rows.length === 0) return res.json([]);
  const cols = rows[0].columns;
  const decisions = rows[0].values.map(vals => {
    const obj = {};
    cols.forEach((c, i) => obj[c] = vals[i]);
    return obj;
  });
  res.json(decisions);
});

initDB().then(() => {
  app.listen(PORT, () => console.log(`Decision Helper Bot running at http://localhost:${PORT}`));
});
