import { Router, Request } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import User, { SafeUser } from '../models/User';
import { JWT_SECRET, JWT_EXPIRES, COLORS } from '../config';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { checkLogin, checkPasswordChange, checkRegister } from '../validation';

const router = Router();

// Creates a signed JWT. The client keeps it and sends it in the Authorization header (see middleware/auth.ts).
// tv is the user's current token version: changing the password raises it and older tokens stop working.
function issueToken(user: SafeUser & { tokenVersion: number }): string {
  return jwt.sign(
    { _id: user._id, email: user.email, username: user.username, color: user.color, tv: user.tokenVersion },
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
    const input = checkRegister(req.body);
    if (!input.ok) return res.status(400).json({ error: input.error });
    const { email, password, username } = input.value;
    if (await User.findOne({ email }))
      return res.status(409).json({ error: 'Email already in use' });

    // Assign a random color from the palette for this user's avatar
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const user  = await User.create({ email, password, username, color });
    const token = issueToken(user);
    res.status(201).json({ token, user: user.toSafe() });
  } catch (e) {
    // Two sign-ups with the same email at the same moment: the unique index in MongoDB stops the second one
    if ((e as { code?: number }).code === 11000)
      return res.status(409).json({ error: 'Email already in use' });
    console.error('[register]', (e as Error).message);
    res.status(500).json({ error: 'Server error — please try again' });
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const input = checkLogin(req.body);
    if (!input.ok) return res.status(400).json({ error: input.error });
    const { email, password } = input.value;
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

// POST /api/auth/password — change the password.
// The token version goes up, so every older token stops working and other devices are logged out.
// This device gets a new token in the answer and stays logged in.
router.post('/password', authLimiter, authMiddleware, async (req: Request, res) => {
  try {
    const input = checkPasswordChange(req.body);
    if (!input.ok) return res.status(400).json({ error: input.error });
    const user = await User.findById((req as AuthRequest).user._id).select('+password');
    if (!user) return res.status(404).json({ error: 'not found' });
    if (!(await user.comparePassword(input.value.currentPassword)))
      return res.status(401).json({ error: 'Your current password is not correct' });

    user.password = input.value.newPassword;   // hashed by the pre-save hook in models/User.ts
    user.tokenVersion += 1;
    await user.save();
    res.json({ token: issueToken(user), user: user.toSafe() });
  } catch (e) {
    console.error('[password]', (e as Error).message);
    res.status(500).json({ error: 'Server error — please try again' });
  }
});

// POST /api/auth/logout — the client deletes its token. The token itself stays valid until it expires
// (JWT_EXPIRES); only a password change ends all tokens at once (POST /api/auth/password).
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
