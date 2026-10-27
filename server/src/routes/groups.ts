import { Router, Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import Group from '../models/Group';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { ts, snapMonthEnd } from '../utils';
import { normalizeInviteCode } from '../validation';

const router = Router();

// The invite code is the only thing that protects a trip, so codes must not be guessed by trying many:
// max 20 unknown codes per IP address in 15 minutes. Codes that exist are not counted.
const codeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many wrong codes — please try again in 15 minutes' },
});

// Routes behind authMiddleware can safely read req.user
const userOf = (req: Request) => (req as AuthRequest).user;

// Create a new group
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Group name is required' });
    const { _id: userId, username, color } = userOf(req);
    // Generate a short random invite code, e.g. "A3BF92C1"
    const inviteCode = uuidv4().slice(0,8).toUpperCase();
    const group = await Group.create({
      inviteCode, name: name.trim(),
      adminUserId: userId, adminUsername: username,
      members:  [{ userId, username, color }],
      messages: [{ username:'System', text:`Group "${name.trim()}" created! Code: ${inviteCode}`, time: ts(), system: true }]
    });
    res.status(201).json({ inviteCode, groupId: group._id });
  } catch (e) {
    console.error('[groups:create]', (e as Error).message);
    res.status(500).json({ error: 'Server error — please try again' });
  }
});

// Public info used for the invite link preview page and for "Join a trip" before joining.
// Only the organiser's name is shown, not the other members.
router.get('/:code', codeLimiter, async (req, res) => {
  try {
    const code = normalizeInviteCode(req.params.code);
    const g = code && await Group.findOne({ inviteCode: code });
    if (!g) return res.status(404).json({ error: 'Group not found' });
    res.json({
      name: g.name, inviteCode: g.inviteCode, phase: g.phase, memberCount: g.members.length,
      adminUsername: g.adminUsername, finalDateLabel: g.finalDateLabel ?? null,
    });
  } catch (e) {
    console.error('[groups:get]', (e as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
});

// List all groups the logged-in user belongs to
router.get('/', authMiddleware, async (req, res) => {
  try {
    // .select() limits which fields are returned
    const groups = await Group.find({ 'members.userId': userOf(req)._id })
      .select('name inviteCode phase members createdAt tripDuration adminUsername tripWindowStart tripWindowEnd finalDate finalDateLabel')
      .sort('-createdAt').limit(20);
    res.json({ groups });
  } catch (e) {
    console.error('[groups:list]', (e as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
});

// One trip for its members (the header of a trip page). Not a member, or no such trip: both 404,
// so the answer does not tell outsiders whether a code exists and the code limiter is not needed here.
router.get('/:code/summary', authMiddleware, async (req, res) => {
  try {
    const code = normalizeInviteCode(req.params.code);
    const g = code && await Group.findOne({ inviteCode: code, 'members.userId': userOf(req)._id })
      .select('name inviteCode phase members createdAt tripDuration adminUsername tripWindowStart tripWindowEnd finalDate finalDateLabel');
    if (!g) return res.status(404).json({ error: 'Trip not found' });
    res.json(g);
  } catch (e) {
    console.error('[groups:summary]', (e as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Join a trip with its invite code (the "Join a trip" screen). Joining twice is fine: nothing changes.
router.post('/:code/join', codeLimiter, authMiddleware, async (req, res) => {
  try {
    const code = normalizeInviteCode(req.params.code);
    const g = code && await Group.findOne({ inviteCode: code });
    if (!g) return res.status(404).json({ error: 'Group not found' });
    const { _id: userId, username, color } = userOf(req);
    if (g.members.some(m => String(m.userId) === String(userId)))
      return res.json({ inviteCode: g.inviteCode, alreadyMember: true });

    g.members.push({ userId, username, color });
    g.messages.push({ username: 'System', text: `${username} joined the trip.`, time: ts(), system: true });
    await g.save();
    res.json({ inviteCode: g.inviteCode, alreadyMember: false });
  } catch (e) {
    console.error('[groups:join]', (e as Error).message);
    res.status(500).json({ error: 'Server error — please try again' });
  }
});

// Used from the dashboard (not connected via socket)
router.post('/:code/leave', authMiddleware, async (req, res) => {
  try {
    const g = await Group.findOne({ inviteCode: req.params.code.toUpperCase() });
    if (!g) return res.json({ error: 'Group not found' });
    const uid   = String(userOf(req)._id);
    const isAdm = String(g.adminUserId) === uid;
    g.set('members', g.members.filter(m => String(m.userId) !== uid));
    if (isAdm && g.members.length > 0) {
      // Promote the next member to admin if the admin leaves
      g.adminUserId   = g.members[0].userId;
      g.adminUsername = g.members[0].username;
    } else if (isAdm) {
      // Last person leaving — just delete the group
      await g.deleteOne();
      return res.json({ ok: true });
    }
    await g.save();
    res.json({ ok: true });
  } catch { res.json({ error: 'Server error' }); }
});

// Update the trip month range from the dashboard
router.patch('/:code/window', authMiddleware, async (req, res) => {
  try {
    const { start, end } = req.body;
    if (!start || !end || start >= end) return res.status(400).json({ error: 'Invalid window' });
    const g = await Group.findOne({ inviteCode: req.params.code.toUpperCase() });
    if (!g) return res.json({ error: 'Group not found' });
    if (String(g.adminUserId) !== String(userOf(req)._id)) return res.json({ error: 'Not admin' });
    g.tripWindowStart = start;
    g.tripWindowEnd   = snapMonthEnd(end); // snap to real last day to avoid timezone issues
    await g.save();
    res.json({ ok: true });
  } catch { res.json({ error: 'Server error' }); }
});

// Rename a group (admin only)
router.patch('/:code', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const g = await Group.findOne({ inviteCode: req.params.code.toUpperCase() });
    if (!g) return res.json({ error: 'Group not found' });
    if (String(g.adminUserId) !== String(userOf(req)._id)) return res.json({ error: 'Not admin' });
    g.name = name.trim();
    await g.save();
    res.json({ ok: true });
  } catch { res.json({ error: 'Server error' }); }
});

// Delete a group entirely (admin only)
router.delete('/:code', authMiddleware, async (req, res) => {
  try {
    const g = await Group.findOne({ inviteCode: req.params.code.toUpperCase() });
    if (!g) return res.json({ error: 'Group not found' });
    if (String(g.adminUserId) !== String(userOf(req)._id)) return res.json({ error: 'Not admin' });
    await g.deleteOne();
    res.json({ ok: true });
  } catch { res.json({ error: 'Server error' }); }
});

export default router;
