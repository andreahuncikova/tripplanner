import { Router, Request } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import User, { SafeUser } from '../models/User';
import { JWT_SECRET, JWT_EXPIRES, COLORS } from '../config';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Creates a signed JWT. The client keeps it and sends it in the Authorization header (see middleware/auth.ts).
function issueToken(user: SafeUser): string {
  return jwt.sign(
    { _id: user._id, email: user.email, username: user.username, color: user.color },
    JWT_SECRET, { algorithm: 'HS256', expiresIn: JWT_EXPIRES }
  );
}

// Max 10 failed attempts per IP address in 15 minutes, so passwords cannot be guessed by trying many times.
// Successful requests are not counted, so a normal user is never blocked.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts — please try again in 15 minutes' },
});

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { email, password, username } = req.body;
    if (!email || !password || !username)
      return res.status(400).json({ error: 'Please fill in all fields' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (await User.findOne({ email }))
      return res.status(409).json({ error: 'Email already in use' });

    // Assign a random color from the palette for this user's avatar
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const user  = await User.create({ email, password, username, color });
    const token = issueToken(user);
    res.status(201).json({ token, user: user.toSafe() });
  } catch (e) {
    console.error('[register]', (e as Error).message);
    res.status(500).json({ error: 'Server error — please try again' });
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Please enter your email and password' });
    // .select('+password') is needed because password has select:false in the schema
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ error: 'Incorrect email or password' });
    const token = issueToken(user);
    res.json({ token, user: user.toSafe() });
  } catch (e) {
    console.error('[login]', (e as Error).message);
    res.status(500).json({ error: 'Server error — please try again' });
  }
});

// POST /api/auth/logout — the client deletes its token. A JWT cannot be cancelled on the server,
// it stays valid until it expires (JWT_EXPIRES), so this route only confirms the logout.
router.post('/logout', (_req, res) => {
  res.json({ ok: true });
});

// GET /api/auth/me — used on page load to restore the session from the stored token
router.get('/me', authMiddleware, async (req: Request, res) => {
  try {
    const user = await User.findById((req as AuthRequest).user._id);
    if (!user) return res.status(404).json({ error: 'not found' });
    res.json({ user: user.toSafe() });
  } catch (e) {
    console.error('[me]', (e as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
