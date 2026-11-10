import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import Stay from '../models/Stay';
import Message from '../models/Message';
import { isPlaceId, MAX_PLACE_PHOTOS, photoUri } from '../preview/places';

const router = Router();

// The photos are shown with <img>, which cannot send the log-in token, so this route has no log-in.
// So it cannot be used to spend our Google quota on any place: it only answers for places
// that are saved with a stay or a chat message, and at most 300 times per 15 minutes per IP address.
const photoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

// GET /api/places/:placeId/photo/:n → redirect to photo n of the place on Google's servers (see preview/places.ts)
router.get('/:placeId/photo/:n', photoLimiter, async (req, res) => {
  try {
    const { placeId } = req.params;
    const n = Number(req.params.n);
    if (!isPlaceId(placeId) || !Number.isInteger(n) || n < 0 || n >= MAX_PLACE_PHOTOS) return res.status(404).end();
    const used = await Stay.exists({ placeId }) || await Message.exists({ 'preview.placeId': placeId });
    if (!used) return res.status(404).end();
    const uri = await photoUri(placeId, n);
    if (!uri) return res.status(404).end();
    // The browser may keep the redirect for an hour, the same time we keep the address
    res.set('Cache-Control', 'private, max-age=3600');
    res.redirect(302, uri);
  } catch (e) {
    console.error('[places:route]', (e as Error).message);
    res.status(500).end();
  }
});

export default router;
