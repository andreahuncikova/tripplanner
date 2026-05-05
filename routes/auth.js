const router = require('express').Router();
const jwt    = require('jsonwebtoken');
const User   = require('../models/User');
const { JWT_SECRET, JWT_EXPIRES, COLORS } = require('../config');

function issueToken(user, res) {
  const token = jwt.sign(
    { _id: user._id, email: user.email, username: user.username, color: user.color },
    JWT_SECRET, { expiresIn: JWT_EXPIRES }
  );
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7*24*3600*1000 });
  return token;
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password, username } = req.body;
  if (!email || !password || !username)
    return res.status(400).json({ error: 'Please fill in all fields' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (await User.findOne({ email }))
    return res.status(409).json({ error: 'Email already in use' });

  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const user  = await User.create({ email, password, username, color });
  const token = issueToken(user, res);
  res.status(201).json({ token, user: user.toSafe() });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Please enter your email and password' });
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password)))
    return res.status(401).json({ error: 'Incorrect email or password' });
  const token = issueToken(user, res);
  res.json({ token, user: user.toSafe() });
});

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'no token' });
  try {
    const jwt2 = require('jsonwebtoken');
    const decoded = jwt2.verify(token, JWT_SECRET);
    const user = await User.findById(decoded._id);
    if (!user) return res.status(404).json({ error: 'not found' });
    res.json({ user: user.toSafe() });
  } catch { res.status(401).json({ error: 'invalid' }); }
});

module.exports = router;
