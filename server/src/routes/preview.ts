import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { checkLink, getPreview, PreviewError } from '../preview';

const router = Router();

// Every preview downloads someone else's page, so one user may ask for at most 30 in 10 minutes
const previewLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  keyGenerator: req => String((req as AuthRequest).user?._id ?? req.ip),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many links at once — please try again in a few minutes' },
});

// POST /api/preview { url } → LinkPreview
// Always answers 200 with what could be read, even when the page shows a bot check instead of the stay:
// then only the platform (and maybe the title) is known, complete is false and the client asks for the rest.
// 400 only when the link itself cannot be used.
router.post('/', authMiddleware, previewLimiter, async (req, res) => {
  try {
    res.json(await getPreview(checkLink(req.body?.url)));
  } catch (e) {
    if (e instanceof PreviewError) return res.status(400).json({ error: e.message });
    console.error('[preview]', (e as Error).message);
    res.status(500).json({ error: 'Server error — please try again' });
  }
});

export default router;
