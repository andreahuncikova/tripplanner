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
});

// GET /api/groups/:code  — info (public, for invite link preview)
router.get('/:code', async (req, res) => {
  const g = await Group.findOne({ inviteCode: req.params.code.toUpperCase() });
  if (!g) return res.status(404).json({ error: 'Group not found' });
  res.json({ name: g.name, inviteCode: g.inviteCode, phase: g.phase, memberCount: g.members.length });
});

// GET /api/groups  — my groups
router.get('/', authMiddleware, async (req, res) => {
  const groups = await Group.find({ 'members.userId': req.user._id })
    .select('name inviteCode phase members.length createdAt tripDuration')
    .sort('-createdAt').limit(20);
  res.json({ groups });
});

module.exports = router;
