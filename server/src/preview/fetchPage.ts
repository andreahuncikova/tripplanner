// Downloads the HTML of a stay link for the link preview, safely.
// The address comes from a user, so the server must not become a way into places only it can reach
// (SSRF): its own computer, Render's internal network, cloud metadata addresses…
//   - only http and https, only the usual ports
//   - every address the host name resolves to is checked when connecting (also after each redirect),
//     so a name that points to a private address is refused
//   - at most 3 redirects, 8 seconds and 2 MB, and only HTML
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';
import zlib from 'node:zlib';
import type { LookupFunction } from 'node:net';

const TIMEOUT_MS    = 8_000;
const MAX_BYTES     = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
// We say who we are; we do not pretend to be a browser or another company's bot
const USER_AGENT = 'TripPlanner link preview (student project; +https://github.com/andreahuncikova/tripplanner)';

export class PreviewError extends Error {
  constructor(message: string, readonly status: 400 | 422 | 502 = 502) { super(message); }
}

// ── Which addresses may be fetched ───────────────────
function ipv4Blocked(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224          // "this" network, private, loopback, multicast/reserved
    || (a === 100 && b >= 64 && b <= 127)                       // carrier-grade NAT
    || (a === 169 && b === 254)                                 // link-local, cloud metadata (169.254.169.254)
    || (a === 172 && b >= 16 && b <= 31)                        // private
    || (a === 192 && b === 168)                                 // private
    || (a === 192 && b === 0)                                   // IETF protocol assignments
    || (a === 198 && (b === 18 || b === 19));                   // benchmarking
}

export function isBlockedAddress(ip: string): boolean {
  if (net.isIPv4(ip)) return ipv4Blocked(ip);
  if (!net.isIPv6(ip)) return true;
  const v6 = ip.toLowerCase();
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);    // an IPv4 address written as IPv6
  if (mapped) return ipv4Blocked(mapped[1]);
  return v6 === '::' || v6 === '::1'
    || /^f[cd]/.test(v6)                                        // unique local fc00::/7
    || /^fe[89ab]/.test(v6)                                     // link-local fe80::/10
    || /^ff/.test(v6)                                           // multicast
    || v6.startsWith('64:ff9b:')                                // NAT64, may lead to IPv4 inside
    || v6.startsWith('2001:db8:');                              // documentation
}

// Checks the address the connection really goes to, so the check and the connection cannot differ
const safeLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '', 4);
    const list = addresses as dns.LookupAddress[];
    const bad = list.find(a => isBlockedAddress(a.address));
    if (bad || !list.length) {
      return callback(Object.assign(new Error('blocked address'), { code: 'EBLOCKED' }), '', 4);
    }
    if (options.all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

// A link the user typed, as a URL we may fetch, or an error for the user
export function checkLink(input: unknown): URL {
  if (typeof input !== 'string' || !input.trim() || input.length > 2000) throw new PreviewError('Paste a link to a stay', 400);
  let u: URL;
  try { u = new URL(input.trim()); } catch { throw new PreviewError('That is not a link', 400); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new PreviewError('Only http and https links work', 400);
  if (u.username || u.password) throw new PreviewError('That link cannot be opened', 400);
  if (u.port && !['80', '443'].includes(u.port)) throw new PreviewError('That link cannot be opened', 400);
  // A typed IP address is checked straight away; host names are checked when connecting
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && isBlockedAddress(host)) throw new PreviewError('That link cannot be opened', 400);
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    throw new PreviewError('That link cannot be opened', 400);
  }
  u.hash = '';
  return u;
}

interface Page { url: string; html: string; status: number }

// One request, no redirects followed here
function get(u: URL): Promise<{ status: number; location?: string; body: string }> {
  return new Promise((resolve, reject) => {
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.get(u, {
      lookup: safeLookup,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      timeout: TIMEOUT_MS,
    }, res => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        return resolve({ status, location: res.headers.location, body: '' });
      }
      const type = String(res.headers['content-type'] ?? '');
      if (type && !/text\/html|application\/xhtml/i.test(type)) {
        res.resume();
        return reject(new PreviewError('That link is not a web page', 422));
      }
      const encoding = String(res.headers['content-encoding'] ?? '').toLowerCase();
      const stream = encoding === 'gzip' ? res.pipe(zlib.createGunzip())
        : encoding === 'deflate' ? res.pipe(zlib.createInflate())
        : encoding === 'br' ? res.pipe(zlib.createBrotliDecompress())
        : res;
      const chunks: Buffer[] = [];
      let size = 0;
      stream.on('data', (c: Buffer) => {
        size += c.length;
        // Enough of the page: the tags we need are at the top. Keep what we have and stop downloading.
        if (size > MAX_BYTES) { req.destroy(); resolve({ status, body: Buffer.concat(chunks).toString('utf8') }); return; }
        chunks.push(c);
      });
      stream.on('end', () => resolve({ status, body: Buffer.concat(chunks).toString('utf8') }));
      stream.on('error', () => reject(new PreviewError('The page could not be read')));
    });
    req.on('timeout', () => req.destroy(new PreviewError('The page took too long to answer')));
    req.on('error', e => reject(e instanceof PreviewError ? e
      : (e as NodeJS.ErrnoException).code === 'EBLOCKED' ? new PreviewError('That link cannot be opened', 400)
      : new PreviewError('The page could not be opened')));
  });
}

// Downloads the page, following up to 3 redirects; every new address is checked again
export async function fetchPage(start: URL): Promise<Page> {
  let u = start;
  for (let i = 0; ; i++) {
    const r = await get(u);
    if (r.location) {
      if (i >= MAX_REDIRECTS) throw new PreviewError('The link redirects too many times');
      u = checkLink(new URL(r.location, u).href);
      continue;
    }
    return { url: u.href, html: r.body, status: r.status };
  }
}
