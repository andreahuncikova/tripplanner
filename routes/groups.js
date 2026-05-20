const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const Group  = require('../models/Group');
const { authMiddleware } = require('../middleware/auth');

function ts() {
  const d = new Date();
  return d.getHours() + ':' + String(d.getMinutes()).padStart(2,'0');
}

// POST /api/groups  — create
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Group name is required' });
    const { _id: userId, username, color } = req.user;
    const inviteCode = uuidv4().slice(0,8).toUpperCase();
    const group = await Group.create({
      inviteCode, name: name.trim(),
      adminUserId: userId, adminUsername: username,
      members: [{ userId, username, color }],
      messages: [{ username:'System', text:`Group "${name.trim()}" created! Code: ${inviteCode}`, time: ts(), system: true }]
    });
    res.status(201).json({ inviteCode, groupId: group._id });
  } catch (e) {
    console.error('[groups:create]', e.message);
    res.status(500).json({ error: 'Server error — please try again' });
  }
});

// GET /api/groups/:code  — info (public, for invite link preview)
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

// GET /api/groups  — my groups
router.get('/', authMiddleware, async (req, res) => {
  try {
    const groups = await Group.find({ 'members.userId': req.user._id })
      .select('name inviteCode phase members createdAt tripDuration adminUsername tripWindowStart tripWindowEnd')
      .sort('-createdAt').limit(20);
    res.json({ groups });
  } catch (e) {
    console.error('[groups:list]', e.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/groups/:code/leave  — leave a group
router.post('/:code/leave', authMiddleware, async (req, res) => {
  try {
    const g = await Group.findOne({ inviteCode: req.params.code.toUpperCase() });
    if (!g) return res.json({ error: 'Group not found' });
    const uid    = String(req.user._id);
    const isAdm  = String(g.adminUserId) === uid;
    g.members = g.members.filter(m => String(m.userId) !== uid);
    if (isAdm && g.members.length > 0) {
      g.adminUserId   = g.members[0].userId;
      g.adminUsername = g.members[0].username;
    } else if (isAdm) {
      await g.deleteOne();
      return res.json({ ok: true });
    }
    await g.save();
    res.json({ ok: true });
  } catch { res.json({ error: 'Server error' }); }
});

// PATCH /api/groups/:code/window  — update trip window (admin only)
router.patch('/:code/window', authMiddleware, async (req, res) => {
  try {
    const { start, end } = req.body;
    if (!start || !end || start >= end) return res.status(400).json({ error: 'Invalid window' });
    const g = await Group.findOne({ inviteCode: req.params.code.toUpperCase() });
    if (!g) return res.json({ error: 'Group not found' });
    if (String(g.adminUserId) !== String(req.user._id)) return res.json({ error: 'Not admin' });
    const endDate = new Date(end + 'T12:00:00');
    const lastDay = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0);
    g.tripWindowStart = start;
    g.tripWindowEnd   = `${lastDay.getFullYear()}-${String(lastDay.getMonth()+1).padStart(2,'0')}-${String(lastDay.getDate()).padStart(2,'0')}`;
    await g.save();
    res.json({ ok: true });
  } catch { res.json({ error: 'Server error' }); }
});

// PATCH /api/groups/:code  — rename a group (admin only)
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

// DELETE /api/groups/:code  — delete a group (admin only)
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
