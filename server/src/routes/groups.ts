import { Router, Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import Group, { GroupDoc } from '../models/Group';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { ts, snapMonthEnd, formatTripLabel } from '../utils';
import { checkNewTrip, checkTripChanges, normalizeInviteCode } from '../validation';
import { closeRoom, getOnline, leaveTrip, sameId, serialize, toClient } from '../socket/helpers';
import type { IO, Sessions } from '../types';

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

// The sockets, so a change made here reaches everyone who has the trip open (set in server.ts)
const live = (req: Request) => req.app.locals.live as { io: IO; sessions: Sessions };

// The trip with the code in the URL, only if the logged-in user is a member. Not a member, or no such trip:
// both give null (404), so the answer does not tell outsiders whether a code exists.
async function findMyTrip(req: Request) {
  const code = normalizeInviteCode(req.params.code);
  return code ? Group.findOne({ inviteCode: code, 'members.userId': userOf(req)._id }) : null;
}

// Sends the trip and its newest chat message (the system message about the change) to everyone who has it open
function sendChange(req: Request, g: GroupDoc) {
  const { io, sessions } = live(req);
  io.to(g.inviteCode).emit('msg', toClient(g.messages.at(-1)));
  io.to(g.inviteCode).emit('state', serialize(g, getOnline(sessions, g.inviteCode)));
}

// The fields of a trip whose dates are known: first day, the label on the cards and the number of days
function knownDateFields(dates: { start: string; end: string }) {
  const days = Math.round((Date.parse(dates.end) - Date.parse(dates.start)) / 86_400_000) + 1;
  return { finalDate: dates.start, finalDateLabel: formatTripLabel(dates.start, days), tripDuration: days };
}

// What the dashboard, the sidebar and the trip header get of each trip
const SUMMARY_FIELDS = 'name inviteCode phase members createdAt tripDuration adminUserId adminUsername tripWindowStart tripWindowEnd finalDate finalDateLabel currency approvedDest datesKnown';

// Create a new trip ("New trip" screen).
// The old app always started with the destination poll; now the trip starts at the first step it still needs:
// destination known + dates known = ready to go, destination known = mark free days, otherwise the destination poll.
router.post('/', authMiddleware, async (req, res) => {
  try {
    const input = checkNewTrip(req.body);
    if (!input.ok) return res.status(400).json({ error: input.error });
    const { name, destination, knownDates, window, currency } = input.value;
    const { _id: userId, username, color } = userOf(req);
    // Generate a short random invite code, e.g. "A3BF92C1"
    const inviteCode = uuidv4().slice(0,8).toUpperCase();
    const dateFields = knownDates ? knownDateFields(knownDates) : null;
    const phase = destination ? (knownDates ? 'done' : 'calendar') : 'destinations';
    const group = await Group.create({
      inviteCode, name,
      adminUserId: userId, adminUsername: username,
      members:  [{ userId, username, color }],
      currency,
      destinationKnown: !!destination,
      approvedDest:     destination,
      datesKnown:       !!knownDates,
      finalDate:        dateFields?.finalDate ?? null,
      finalDateLabel:   dateFields?.finalDateLabel ?? null,
      tripDuration:     dateFields?.tripDuration ?? null,
      tripWindowStart:  window?.start ?? null,
      tripWindowEnd:    window?.end ?? null,
      phase,
      messages: [{ username:'System', text:`Trip "${name}" created! Code: ${inviteCode}`, time: ts(), system: true }]
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
      .select(SUMMARY_FIELDS)
      .sort('-createdAt').limit(20);
    res.json({ groups });
  } catch (e) {
    console.error('[groups:list]', (e as Error).message);
    res.status(500).json({ error: 'Server error' });
  }
});

// One trip for its members (the trip header and Trip settings). Not a member, or no such trip: both 404,
// so the answer does not tell outsiders whether a code exists and the code limiter is not needed here.
router.get('/:code/summary', authMiddleware, async (req, res) => {
  try {
    const code = normalizeInviteCode(req.params.code);
    const g = code && await Group.findOne({ inviteCode: code, 'members.userId': userOf(req)._id }).select(SUMMARY_FIELDS);
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

// "Leave trip" in Trip settings. The organiser can leave too: the next member becomes the organiser,
// and when the last member leaves, the trip is deleted.
router.post('/:code/leave', authMiddleware, async (req, res) => {
  try {
    const g = await findMyTrip(req);
    if (!g) return res.status(404).json({ error: 'Trip not found' });
    const { _id: userId, username } = userOf(req);
    const result = await leaveTrip(g, userId, username);
    // Their open tabs stop getting the trip's messages
    const { io, sessions } = live(req);
    closeRoom(io, sessions, g.inviteCode, userId);
    if (result === 'left') sendChange(req, g);
    res.json({ ok: true, deleted: result === 'deleted' });
  } catch (e) {
    console.error('[groups:leave]', (e as Error).message);
    res.status(500).json({ error: 'Server error — please try again' });
  }
});

// Update the trip month range (the availability step)
router.patch('/:code/window', authMiddleware, async (req, res) => {
  try {
    const { start, end } = req.body;
    if (!start || !end || start >= end) return res.status(400).json({ error: 'Invalid window' });
    const g = await findMyTrip(req);
    if (!g) return res.status(404).json({ error: 'Trip not found' });
    if (!sameId(g.adminUserId, userOf(req)._id)) return res.status(403).json({ error: 'Only the organiser can change the months' });
    g.tripWindowStart = start;
    g.tripWindowEnd   = snapMonthEnd(end); // snap to real last day to avoid timezone issues
    await g.save();
    res.json({ ok: true });
  } catch (e) {
    console.error('[groups:window]', (e as Error).message);
    res.status(500).json({ error: 'Server error — please try again' });
  }
});

// Trip settings: the organiser changes the name, the currency or the dates. Only what is sent changes.
// The old app answered errors here with status 200; now they are 400, 403 and 404.
router.patch('/:code', authMiddleware, async (req, res) => {
  try {
    const input = checkTripChanges(req.body);
    if (!input.ok) return res.status(400).json({ error: input.error });
    const g = await findMyTrip(req);
    if (!g) return res.status(404).json({ error: 'Trip not found' });
    const me = userOf(req);
    if (!sameId(g.adminUserId, me._id)) return res.status(403).json({ error: 'Only the organiser can change the trip' });
    const { name, currency, dates } = input.value;
    // Dates the group voted on come from the planning steps; only dates entered when the trip was created can be changed here
    if (dates && !g.datesKnown) return res.status(400).json({ error: 'The group chooses the dates in the Plan tab' });

    // Everyone sees what changed in the chat, e.g. "Mia renamed the trip to "Bali 2027"."
    const changed: string[] = [];
    if (name && name !== g.name) {
      g.name = name;
      changed.push(`renamed the trip to "${name}"`);
    }
    if (currency && currency !== g.currency) {
      g.currency = currency;
      changed.push(`changed the currency to ${currency}`);
    }
    if (dates) {
      const fields = knownDateFields(dates);
      if (fields.finalDate !== g.finalDate || fields.tripDuration !== g.tripDuration) {
        g.set(fields);
        changed.push(`changed the dates to ${fields.finalDateLabel}`);
      }
    }
    if (changed.length) {
      g.messages.push({ username: 'System', text: `${me.username} ${changed.join(' and ')}.`, time: ts(), system: true });
      await g.save();
      sendChange(req, g);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[groups:update]', (e as Error).message);
    res.status(500).json({ error: 'Server error — please try again' });
  }
});

// "Delete trip" in Trip settings (organiser only). Everyone who has it open is sent back to their trips.
router.delete('/:code', authMiddleware, async (req, res) => {
  try {
    const g = await findMyTrip(req);
    if (!g) return res.status(404).json({ error: 'Trip not found' });
    if (!sameId(g.adminUserId, userOf(req)._id)) return res.status(403).json({ error: 'Only the organiser can delete the trip' });
    await g.deleteOne();
    // The organiser is taken out first: they already see "Trip deleted" on their own screen
    const { io, sessions } = live(req);
    closeRoom(io, sessions, g.inviteCode, userOf(req)._id);
    io.to(g.inviteCode).emit('group:deleted');
    closeRoom(io, sessions, g.inviteCode);
    res.json({ ok: true });
  } catch (e) {
    console.error('[groups:delete]', (e as Error).message);
    res.status(500).json({ error: 'Server error — please try again' });
  }
});

export default router;
