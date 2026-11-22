import express, { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Types } from 'mongoose';
import Group from '../models/Group';
import { authMiddleware, type AuthRequest } from '../middleware/auth';
import { normalizeInviteCode } from '../validation';
import { checkUpload, cleanFileName, isFileKind, UPLOAD_RULES } from '../fileTypes';
import { deleteFile, findFile, isFileId, MAX_TOTAL_BYTES, openFile, saveFile, totalBytes } from '../files';

const router = Router();

// Each person may upload at most 60 files in 15 minutes, so one account cannot fill the database
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: req => String((req as AuthRequest).user._id),
  message: { error: 'Too many files at once — please try again in a few minutes' },
});

// Files are shown with <img> and opened as links, which cannot send the log-in token, so reading needs no log-in.
// The random id in the address protects the file; this limit stops anyone from trying many ids.
const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

// POST /api/files?kind=avatar or ?kind=chat&trip=<invite code>
// The body is the file itself (not a form), with its name in the X-File-Name header.
// Answer 201 with an UploadedFile, or 400/404/413/507 with { error }.
router.post(
  '/',
  authMiddleware,
  uploadLimiter,
  express.raw({ type: () => true, limit: UPLOAD_RULES.chat.maxBytes + 1024 }),
  async (req, res) => {
    try {
      const { user } = req as AuthRequest;
      const kind = req.query.kind;
      if (!isFileKind(kind)) return res.status(400).json({ error: 'Unknown kind of file' });
      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      const check = checkUpload(kind, body);
      if (!check.ok) return res.status(body.length > UPLOAD_RULES[kind].maxBytes ? 413 : 400).json({ error: check.error });

      // A chat file belongs to a trip, and only its members may send one
      let groupId: Types.ObjectId | null = null;
      if (kind === 'chat') {
        const code = normalizeInviteCode(req.query.trip);
        const g = code ? await Group.findOne({ inviteCode: code }, { members: 1 }) : null;
        if (!g || !g.members.some(m => String(m.userId) === String(user._id))) return res.status(404).json({ error: 'Trip not found' });
        groupId = g._id;
      }

      if (await totalBytes() + body.length > MAX_TOTAL_BYTES) {
        console.error('[files] storage is full');
        return res.status(507).json({ error: 'The storage is full — please tell the TripPlanner team' });
      }

      const file = await saveFile(body, {
        kind, type: check.type, name: cleanFileName(req.get('X-File-Name')),
        uploadedByUserId: new Types.ObjectId(String(user._id)), groupId,
      });
      res.status(201).json(file);
    } catch (e) {
      console.error('[files:upload]', (e as Error).message);
      res.status(500).json({ error: 'Server error — please try again' });
    }
  },
);

// GET /api/files/:id → the file
router.get('/:id', readLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isFileId(id)) return res.status(404).end();
    const f = await findFile(id);
    if (!f) return res.status(404).end();
    res.set({
      'Content-Type': f.meta.type,
      'Content-Length': String(f.length),
      // A file never changes under the same address, so the browser may keep it
      'Cache-Control': 'private, max-age=31536000, immutable',
      // The browser must use our type and never guess another one (for example run a file as HTML)
      'X-Content-Type-Options': 'nosniff',
      // Photos are shown in the page; a PDF is downloaded under its own name
      'Content-Disposition': f.meta.type === 'application/pdf'
        ? `attachment; filename*=UTF-8''${encodeURIComponent(f.meta.name)}` : 'inline',
    });
    openFile(f._id).on('error', () => res.destroy()).pipe(res);
  } catch (e) {
    console.error('[files:read]', (e as Error).message);
    res.status(500).end();
  }
});

// DELETE /api/files/:id — only who uploaded it, for example an old profile photo
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { user } = req as AuthRequest;
    const { id } = req.params;
    const f = isFileId(id) ? await findFile(id) : null;
    if (!f || String(f.meta.uploadedByUserId) !== String(user._id)) return res.status(404).json({ error: 'File not found' });
    await deleteFile(f._id);
    res.json({ ok: true });
  } catch (e) {
    console.error('[files:delete]', (e as Error).message);
    res.status(500).json({ error: 'Server error — please try again' });
  }
});

export default router;
