import { Router, Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import Group from '../models/Group';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { ts, snapMonthEnd } from '../utils';

const router = Router();

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

// Public info used for the invite link preview page
router.get('/:code', async (req, res) => {
  try {
    const g = await Group.findOne({ inviteCode: req.params.code.toUpperCase() });
    if (!g) return res.status(404).json({ error: 'Group not found' });
    res.json({ name: g.name, inviteCode: g.inviteCode, phase: g.phase, memberCount: g.members.length });
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
      .select('name inviteCode phase members createdAt tripDuration adminUsername tripWindowStart tripWindowEnd')
      .sort('-createdAt').limit(20);
    res.json({ groups });
  } catch (e) {
    console.error('[groups:list]', (e as Error).message);
    res.status(500).json({ error: 'Server error' });
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
