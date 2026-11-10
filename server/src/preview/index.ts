// The link preview used by POST /api/preview and by adding a stay (socket/stays.ts):
// download the page safely, read what it says about itself, remember the answer for an hour.
import { checkLink, fetchPage, PreviewError } from './fetchPage';
import { parsePreview, platformOf } from './parse';
import type { LinkPreview } from '../types';

export { checkLink, PreviewError };

// Pages change rarely, and a group often pastes the same link twice, so answers are kept for an hour
const CACHE_MS = 60 * 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map<string, { at: number; preview: LinkPreview }>();

function remember(key: string, preview: LinkPreview) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);   // the oldest one
  cache.set(key, { at: Date.now(), preview });
}

// The preview of a link that passed checkLink(). Never throws for a page that cannot be read:
// a bot check, an error page or a timeout give only the platform, with complete false,
// and the user fills in the rest. Throws PreviewError (400) only for a link that may not be opened.
export async function getPreview(link: URL): Promise<LinkPreview> {
  const key = link.href;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.preview;

  try {
    const page = await fetchPage(link);
    // A bot check or an error page has no stay data; parsing it would only give a title like "Just a moment…"
    const preview: LinkPreview = page.status >= 200 && page.status < 300 && page.status !== 202
      ? parsePreview(page.html, page.url)
      : { url: page.url, platform: platformOf(page.url), complete: false };
    remember(key, preview);
    return preview;
  } catch (e) {
    if (e instanceof PreviewError && e.status === 400) throw e;
    if (!(e instanceof PreviewError)) console.error('[preview]', (e as Error).message);
    return { url: link.href, platform: platformOf(link.href), complete: false };
  }
}
