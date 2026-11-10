// Reads the photo, title, price and location of a stay from the HTML of its page.
// Only reads text, so it can be tested without the internet. Two kinds of data are used,
// the ones websites publish on purpose for link previews and search engines:
//   1. Open Graph and similar <meta> tags (og:title, og:image, product:price:amount…)
//   2. schema.org JSON-LD (<script type="application/ld+json">), e.g. a Hotel with an address and offers
import type { LinkPreview, StayPlatform } from '../types';

type Json = Record<string, unknown>;

// ── Platform ─────────────────────────────────────────
const PLATFORMS: [StayPlatform, RegExp][] = [
  ['booking',     /(^|\.)booking\.com$/],
  ['airbnb',      /(^|\.)airbnb\.[a-z.]+$/],
  ['vrbo',        /(^|\.)vrbo\.com$/],
  ['hostelworld', /(^|\.)hostelworld\.com$/],
  ['expedia',     /(^|\.)expedia\.[a-z.]+$/],
  ['agoda',       /(^|\.)agoda\.com$/],
];

export function platformOf(url: string): StayPlatform {
  let host = '';
  try { host = new URL(url).hostname.toLowerCase(); } catch { return 'other'; }
  return PLATFORMS.find(([, re]) => re.test(host))?.[0] ?? 'other';
}

// ── Small HTML helpers ───────────────────────────────
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : all;
    }
    return ENTITIES[code.toLowerCase()] ?? all;
  });
}

const clean = (s: unknown, max = 200): string | undefined => {
  if (typeof s !== 'string') return undefined;
  const t = decodeEntities(s).replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : undefined;
};

// The attributes of one tag, e.g. <meta property="og:title" content="…"> → { property, content }
function attributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z_:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return out;
}

// All <meta> tags as name → content (first one wins). og: tags use "property", others "name".
function metaTags(html: string): Map<string, string> {
  const meta = new Map<string, string>();
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attributes(m[0]);
    const key = (a.property || a.name || a.itemprop || '').toLowerCase();
    if (key && a.content != null && !meta.has(key)) meta.set(key, a.content);
  }
  return meta;
}

// Every object in the page's JSON-LD blocks, including those inside @graph and lists
function jsonLd(html: string): Json[] {
  const out: Json[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      out.push(v as Json);
      if (Array.isArray((v as Json)['@graph'])) walk((v as Json)['@graph']);
    }
  };
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { walk(JSON.parse(m[1].trim())); } catch { /* a broken block is skipped */ }
  }
  return out;
}

const types = (o: Json) => [o['@type']].flat().map(t => String(t).toLowerCase());
const LODGING = ['hotel', 'lodgingbusiness', 'hostel', 'motel', 'resort', 'bedandbreakfast', 'campground',
  'vacationrental', 'apartment', 'house', 'accommodation', 'room', 'suite', 'product', 'place'];

// ── Fields ───────────────────────────────────────────
function absolute(src: string | undefined, base: string): string | undefined {
  if (!src) return undefined;
  try {
    const u = new URL(decodeEntities(src.trim()), base);
    if (u.protocol === 'http:') u.protocol = 'https:';   // the app runs on https, so http photos would be blocked
    return u.protocol === 'https:' ? u.href : undefined;
  } catch { return undefined; }
}

function imageOf(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return imageOf(v[0]);
  if (v && typeof v === 'object') return imageOf((v as Json).url ?? (v as Json).contentUrl);
  return undefined;
}

// "1.234,50", "1,234.50", "€ 120", 120 → a number; undefined when it is not one
export function toAmount(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? v : undefined;
  if (typeof v !== 'string') return undefined;
  let s = v.replace(/[^\d.,]/g, '');
  if (!s) return undefined;
  const lastDot = s.lastIndexOf('.'), lastComma = s.lastIndexOf(',');
  const decimal = Math.max(lastDot, lastComma);
  // A separator followed by exactly 1–2 digits at the end is the decimal point; the others group thousands
  if (decimal >= 0 && s.length - decimal - 1 <= 2) {
    s = s.slice(0, decimal).replace(/[.,]/g, '') + '.' + s.slice(decimal + 1);
  } else {
    s = s.replace(/[.,]/g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

const currencyOf = (v: unknown) => (typeof v === 'string' && /^[A-Za-z]{3}$/.test(v.trim()) ? v.trim().toUpperCase() : undefined);

function priceFrom(meta: Map<string, string>, ld: Json[]): LinkPreview['price'] {
  // Open Graph product prices
  for (const prefix of ['product:price', 'og:price']) {
    const amount = toAmount(meta.get(`${prefix}:amount`));
    const currency = currencyOf(meta.get(`${prefix}:currency`));
    if (amount && currency) return { amount, currency };
  }
  // schema.org offers: { price, priceCurrency } or { lowPrice, priceCurrency }, possibly a list
  for (const o of ld) {
    for (const offer of [o.offers].flat()) {
      if (!offer || typeof offer !== 'object') continue;
      const of = offer as Json;
      const spec = (of.priceSpecification ?? {}) as Json;
      const amount = toAmount(of.price ?? of.lowPrice ?? spec.price);
      const currency = currencyOf(of.priceCurrency ?? spec.priceCurrency);
      if (amount && currency) return { amount, currency };
    }
  }
  return undefined;
}

function locationFrom(meta: Map<string, string>, ld: Json[]): string | undefined {
  for (const o of ld) {
    const a = o.address;
    if (typeof a === 'string') return clean(a, 120);
    if (a && typeof a === 'object') {
      const ad = a as Json;
      const country = typeof ad.addressCountry === 'object' && ad.addressCountry
        ? (ad.addressCountry as Json).name : ad.addressCountry;
      const parts = [ad.addressLocality, ad.addressRegion, country].map(p => clean(p, 60)).filter(Boolean);
      // Region and city are often the same (e.g. "Lisbon, Lisbon, Portugal")
      const unique = [...new Set(parts)];
      if (unique.length) return unique.join(', ');
    }
  }
  const og = [meta.get('og:locality'), meta.get('og:region'), meta.get('og:country-name')].map(p => clean(p, 60)).filter(Boolean);
  if (og.length) return [...new Set(og)].join(', ');
  return undefined;
}

// ── The preview ──────────────────────────────────────
export function parsePreview(html: string, url: string): LinkPreview {
  const meta = metaTags(html);
  const ld = jsonLd(html);
  // Prefer the object that describes the stay itself (a Hotel, a Product…) over the page or the website
  const stay = ld.filter(o => types(o).some(t => LODGING.includes(t)));
  const main = stay[0];

  const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const title = clean(meta.get('og:title')) ?? clean(meta.get('twitter:title')) ?? clean(main?.name) ?? clean(titleTag);
  const image = absolute(meta.get('og:image:secure_url') ?? meta.get('og:image') ?? meta.get('twitter:image')
    ?? imageOf(main?.image), url);
  const price = priceFrom(meta, stay.length ? stay : ld);
  const location = locationFrom(meta, stay.length ? stay : ld);

  return {
    url,
    platform: platformOf(url),
    ...(title && { title }),
    ...(image && { image }),
    ...(price && { price }),
    ...(location && { location }),
    complete: !!(title && image && price && location),
  };
}

// ── What the address itself tells ────────────────────
// Booking shows servers a bot check instead of the hotel page, but its addresses carry the hotel's name
// and country: booking.com/hotel/vn/freebeach.html → "Freebeach", "Vietnam". Used when the page gave no title.
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

export function detailsFromUrl(url: string): Pick<LinkPreview, 'title' | 'location'> {
  let u: URL;
  try { u = new URL(url); } catch { return {}; }
  if (platformOf(url) !== 'booking') return {};
  // /hotel/<country>/<name>.html, sometimes with a language before .html: freebeach.en-gb.html
  const m = u.pathname.match(/^\/hotel\/([a-z]{2})\/([a-z0-9-]+?)(?:\.[a-z]{2}(?:-[a-z]{2})?)?\.html$/i);
  if (!m) return {};
  const title = m[2].split('-').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  let location: string | undefined;
  try { location = regionNames.of(m[1].toUpperCase()); } catch { /* not a country code */ }
  return { ...(title && { title }), ...(location && location !== m[1].toUpperCase() && { location }) };
}
