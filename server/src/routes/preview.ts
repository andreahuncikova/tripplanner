import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { checkLink, fetchPage, PreviewError } from '../preview/fetchPage';
import { parsePreview, platformOf } from '../preview/parse';
import type { LinkPreview } from '../types';

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

// Pages change rarely, and a group often pastes the same link twice, so answers are kept for an hour
const CACHE_MS = 60 * 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map<string, { at: number; preview: LinkPreview }>();

function remember(key: string, preview: LinkPreview) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);   // the oldest one
  cache.set(key, { at: Date.now(), preview });
}

// POST /api/preview { url } → LinkPreview
// Always answers 200 with what could be read, even when the page shows a bot check instead of the stay:
// then only the platform (and maybe the title) is known, complete is false and the client asks for the rest.
// 400 only when the link itself cannot be used.
router.post('/', authMiddleware, previewLimiter, async (req, res) => {
  let link: URL;
  try {
    link = checkLink(req.body?.url);
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }

  const key = link.href;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return res.json(hit.preview);

  try {
    const page = await fetchPage(link);
    // A bot check or an error page has no stay data; parsing it would only give a title like "Just a moment…"
    const preview: LinkPreview = page.status >= 200 && page.status < 300 && page.status !== 202
      ? parsePreview(page.html, page.url)
      : { url: page.url, platform: platformOf(page.url), complete: false };
    remember(key, preview);
    res.json(preview);
  } catch (e) {
    if (e instanceof PreviewError && e.status === 400) return res.status(400).json({ error: e.message });
    if (!(e instanceof PreviewError)) console.error('[preview]', (e as Error).message);
    // The page could not be read: the stay can still be saved, with its details typed in by hand
    res.json({ url: link.href, platform: platformOf(link.href), complete: false } satisfies LinkPreview);
  }
});

export default router;
