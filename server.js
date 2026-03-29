<<<<<<< HEAD
require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const cors     = require('cors');
const path     = require('path');
const OpenAI   = require('openai');

const app  = express();
const PORT       = process.env.PORT       || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const MONGO_URI  = process.env.MONGO_URI  || 'mongodb://127.0.0.1:27017/decision_helper_bot';

// ── OpenAI ──
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── MongoDB ──
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => { console.error('❌ MongoDB connection failed:', err.message); process.exit(1); });

// ── Schemas ──
const userSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
}, { timestamps: true });

const decisionSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  topic:      String,
  winner:     String,
  loser:      String,
  summary:    String,
  confidence: Number,
}, { timestamps: true });

const User     = mongoose.model('User', userSchema);
const Decision = mongoose.model('Decision', decisionSchema);
=======
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
>>>>>>> 9ce3cfeb83a821d55f530641f36e758e6d918a27

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── Auth middleware ──
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid or expired token' }); }
}

// ── Sign Up ──
app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'All fields are required' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (await User.findOne({ email: email.toLowerCase() }))
      return res.status(409).json({ error: 'Email already registered' });

<<<<<<< HEAD
    const hashed = await bcrypt.hash(password, 10);
    const user   = await User.create({ name, email, password: hashed });
    const token  = jwt.sign({ id: user._id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// ── Sign In ──
app.post('/api/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required' });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Invalid email or password' });
    const token = jwt.sign({ id: user._id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch { res.status(500).json({ error: 'Server error' }); }
});

// ── Get current user ──
app.get('/api/me', auth, async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// ── AI Chat ──
app.post('/api/chat', auth, async (req, res) => {
  try {
    const { messages, decisionContext } = req.body;
    // Build system prompt with decision context if available
    const systemPrompt = `You are Decision Helper Bot — a calm, structured, and empathetic AI assistant that helps users make clear decisions.

Your role:
- Ask focused, progressive questions to understand the decision
- Help users weigh options by exploring cost, time, risk, benefit, and stress
- Give a clear, confident recommendation with reasoning
- Keep responses concise (2-4 sentences max per message)
- Be warm and reassuring — reduce decision anxiety
- Never overwhelm the user; guide them step by step

${decisionContext ? `Current decision context:\n${JSON.stringify(decisionContext, null, 2)}` : ''}

Rules:
- Always respond in plain text, no markdown
- If the user seems stuck, offer 2-3 concrete options to choose from
- When you have enough info, give a final recommendation with a confidence level (e.g. "I'm 82% confident that Option A is the better choice")`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    res.json({ reply: completion.choices[0].message.content.trim() });
  } catch (err) {
    console.error('OpenAI error:', err.message);
    res.status(500).json({ error: 'AI service unavailable', detail: err.message });
  }
});

// ── Save decision ──
app.post('/api/decisions', auth, async (req, res) => {
  try {
    const { topic, winner, loser, summary, confidence } = req.body;
    const user = await User.findById(req.user.id).catch(() => null);
    if (!user) return res.status(401).json({ error: 'Please sign in again' });
    await Decision.create({ userId: user._id, topic, winner, loser, summary, confidence });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Could not save decision' }); }
});

// ── Get decisions ──
app.get('/api/decisions', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).catch(() => null);
    if (!user) return res.status(401).json({ error: 'Please sign in again' });
    const decisions = await Decision.find({ userId: user._id }).sort({ createdAt: -1 });
    res.json(decisions);
  } catch { res.json([]); }
});

app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
=======
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
>>>>>>> 9ce3cfeb83a821d55f530641f36e758e6d918a27
