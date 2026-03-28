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
