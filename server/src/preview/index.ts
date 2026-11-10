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

// Every preview downloads someone else's page, so one user may start at most 30 in 10 minutes,
// counted together for stays added in the Stays tab and links sent in the chat
const LIMIT_WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 30;
const recent = new Map<string, number[]>();

export function allowPreview(userId: string): boolean {
  const now = Date.now();
  const list = (recent.get(userId) ?? []).filter(t => now - t < LIMIT_WINDOW_MS);
  if (list.length >= LIMIT) { recent.set(userId, list); return false; }
  list.push(now);
  recent.set(userId, list);
  return true;
}

// The first web link in a chat message, without a full stop or bracket right after it
export function firstLink(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0].replace(/[.,;:!?)\]]+$/, '') : null;
}
