import crypto from 'crypto';
import { Router, Request } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import User, { SafeUser } from '../models/User';
import Group from '../models/Group';
import { JWT_SECRET, JWT_EXPIRES, COLORS, CLIENT_URLS } from '../config';
import { deleteFile, fileUrl, findFile } from '../files';
import { sendMail } from '../mailer';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { checkEmailChange, checkLogin, checkPasswordChange, checkProfile, checkRegister } from '../validation';

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
// The end-to-end tests try wrong passwords on purpose from one address, so their server sets AUTH_RATE_LIMIT higher.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT) || 10,
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

// PATCH /api/auth/profile — a new name and/or photo ({ username }, { photo: "/api/files/<id>" } or { photo: null }).
// The trips keep a copy of each member's name and photo, so those copies change too. The name is also in the log-in
// token, which the chat uses for new messages, so the answer has a new token with the new name.
router.patch('/profile', authMiddleware, async (req: Request, res) => {
  try {
    const input = checkProfile(req.body);
    if (!input.ok) return res.status(400).json({ error: input.error });
    const user = await User.findById((req as AuthRequest).user._id);
    if (!user) return res.status(404).json({ error: 'not found' });
    const oldPhoto = user.photo;

    const { username, photoId } = input.value;
    if (photoId) {
      // Only a profile photo this user uploaded themselves (POST /api/files?kind=avatar)
      const file = await findFile(photoId);
      if (!file || file.meta.kind !== 'avatar' || String(file.meta.uploadedByUserId) !== String(user._id))
        return res.status(400).json({ error: 'That photo could not be found — please upload it again' });
      user.photo = fileUrl(photoId);
    } else if (photoId === null) user.photo = null;
    if (username) user.username = username;
    await user.save();

    await Group.updateMany(
      { 'members.userId': user._id },
      { $set: { 'members.$[m].username': user.username, 'members.$[m].photo': user.photo } },
      { arrayFilters: [{ 'm.userId': user._id }] },
    );
    await Group.updateMany({ adminUserId: user._id }, { adminUsername: user.username });

    // A replaced photo is deleted, so old photos do not fill the storage
    if (oldPhoto && oldPhoto !== user.photo) {
      const old = await findFile(oldPhoto.split('/').pop()!);
      if (old) await deleteFile(old._id).catch(e => console.error('[profile:photo]', (e as Error).message));
    }
    res.json({ token: issueToken(user), user: user.toSafe() });
  } catch (e) {
    console.error('[profile]', (e as Error).message);
    res.status(500).json({ error: 'Server error — please try again' });
  }
});

// How long the link that confirms a new e-mail works
const EMAIL_LINK_HOURS = 24;
const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

// POST /api/auth/email — change the e-mail ({ email, password }). The new address only counts after its owner clicks
// the link sent to it, so a typo cannot lock anyone out of the account. Until then the old e-mail still logs in.
router.post('/email', authLimiter, authMiddleware, async (req: Request, res) => {
  try {
    const user = await User.findById((req as AuthRequest).user._id).select('+password');
    if (!user) return res.status(404).json({ error: 'not found' });
    const input = checkEmailChange(req.body, user.email);
    if (!input.ok) return res.status(400).json({ error: input.error });
    if (!(await user.comparePassword(input.value.password)))
      return res.status(401).json({ error: 'Your password is not correct' });
    if (await User.exists({ email: input.value.email }))
      return res.status(409).json({ error: 'Email already in use' });

    const token = crypto.randomBytes(32).toString('hex');
    user.pendingEmail = input.value.email;
    user.set('emailTokenHash', hashToken(token));
    user.set('emailTokenExpires', new Date(Date.now() + EMAIL_LINK_HOURS * 3600_000));
    await user.save();

    const link = `${CLIENT_URLS[0]}/confirm-email?token=${token}`;
    try {
      await sendMail({
        to: input.value.email,
        subject: 'Confirm your new e-mail for TripPlanner',
        text: `Hi ${user.username},\n\nyou asked to use ${input.value.email} for TripPlanner from now on. `
          + `Open the link below to confirm it. Until then you log in with your old e-mail.\n\n`
          + `The link works for ${EMAIL_LINK_HOURS} hours. If you did not ask for this, you can ignore this e-mail.`,
        button: { label: 'Confirm my new e-mail', url: link },
      });
    } catch (e) {
      // Nothing was sent, so the change is taken back and the user can simply try again
      console.error('[email:send]', (e as Error).message);
      user.pendingEmail = null;
      user.set('emailTokenHash', null);
      user.set('emailTokenExpires', null);
      await user.save();
      return res.status(502).json({ error: 'We could not send the e-mail — please try again later' });
    }
    // Only for the end-to-end tests, which cannot read e-mails (EMAIL_DEV_LINKS is never set on Render)
    const dev = process.env.EMAIL_DEV_LINKS === '1' ? { devLink: link } : {};
    res.json({ user: user.toSafe(), ...dev });
  } catch (e) {
    console.error('[email]', (e as Error).message);
    res.status(500).json({ error: 'Server error — please try again' });
  }
});

// DELETE /api/auth/email — forget the new e-mail that was not confirmed yet
router.delete('/email', authMiddleware, async (req: Request, res) => {
  try {
    const user = await User.findById((req as AuthRequest).user._id);
    if (!user) return res.status(404).json({ error: 'not found' });
    user.pendingEmail = null;
    user.set('emailTokenHash', null);
    user.set('emailTokenExpires', null);
    await user.save();
    res.json({ user: user.toSafe() });
  } catch (e) {
    console.error('[email:cancel]', (e as Error).message);
    res.status(500).json({ error: 'Server error — please try again' });
  }
});

// POST /api/auth/email/confirm — { token } from the link in the e-mail. Needs no log-in: the link may be opened
// on another device. The token is random, works once, and only for EMAIL_LINK_HOURS.
router.post('/email/confirm', authLimiter, async (req, res) => {
  try {
    const token = typeof req.body?.token === 'string' && /^[a-f0-9]{64}$/.test(req.body.token) ? req.body.token : null;
    const user = token && await User.findOne({ emailTokenHash: hashToken(token), emailTokenExpires: { $gt: new Date() } });
    if (!user || !user.pendingEmail)
      return res.status(400).json({ error: 'This link does not work any more. Ask for a new one in your profile.' });
    if (await User.exists({ email: user.pendingEmail, _id: { $ne: user._id } }))
      return res.status(409).json({ error: 'Someone has started using this e-mail in the meantime' });

    user.email = user.pendingEmail;
    user.pendingEmail = null;
    user.set('emailTokenHash', null);
    user.set('emailTokenExpires', null);
    await user.save();
    res.json({ email: user.email });
  } catch (e) {
    if ((e as { code?: number }).code === 11000)
      return res.status(409).json({ error: 'Someone has started using this e-mail in the meantime' });
    console.error('[email:confirm]', (e as Error).message);
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
