const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const Group  = require('../models/Group');
const { authMiddleware } = require('../middleware/auth');
const { ts, snapMonthEnd } = require('../utils');

// Create a new group
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Group name is required' });
    const { _id: userId, username, color } = req.user;
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
    console.error('[groups:create]', e.message);
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
    console.error('[groups:get]', e.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// List all groups the logged-in user belongs to
router.get('/', authMiddleware, async (req, res) => {
  try {
    // .select() limits which fields are returned
    const groups = await Group.find({ 'members.userId': req.user._id })
      .select('name inviteCode phase members createdAt tripDuration adminUsername tripWindowStart tripWindowEnd')
      .sort('-createdAt').limit(20);
    res.json({ groups });
  } catch (e) {
    console.error('[groups:list]', e.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Used from the dashboard (not connected via socket)
router.post('/:code/leave', authMiddleware, async (req, res) => {
  try {
    const g = await Group.findOne({ inviteCode: req.params.code.toUpperCase() });
    if (!g) return res.json({ error: 'Group not found' });
    const uid   = String(req.user._id);
    const isAdm = String(g.adminUserId) === uid;
    g.members = g.members.filter(m => String(m.userId) !== uid);
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
    if (String(g.adminUserId) !== String(req.user._id)) return res.json({ error: 'Not admin' });
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
    if (String(g.adminUserId) !== String(req.user._id)) return res.json({ error: 'Not admin' });
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
    if (String(g.adminUserId) !== String(req.user._id)) return res.json({ error: 'Not admin' });
    await g.deleteOne();
    res.json({ ok: true });
  } catch { res.json({ error: 'Server error' }); }
});

module.exports = router;
