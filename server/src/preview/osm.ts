// The city of a place from OpenStreetMap, for stays whose page gives no city (Booking).
// Google Maps finds the hotel and where it is (places.ts), but Google's terms do not allow keeping its address,
// so the city comes from Nominatim, the free search of OpenStreetMap. Its data may be kept, under the ODbL licence,
// when the app credits "© OpenStreetMap contributors" (shown in the Stays tab and the chat card).
//
// Nominatim's usage policy: at most one request per second, a User-Agent that names the app, and no bulk use.
// We only ask when a stay or a chat link from a booking site is added, remember answers for a day, and wait in line.
const API = 'https://nominatim.openstreetmap.org/reverse';
const TIMEOUT_MS = 5_000;
const USER_AGENT = 'TripPlanner-link-preview/1.0';

export interface OsmCity { city: string; country?: string }

// The city in a Nominatim answer: a city, else a town, village or municipality, in English
export function cityOfAnswer(data: unknown): OsmCity | null {
  const a = (data as { address?: Record<string, unknown> } | null)?.address;
  if (!a || typeof a !== 'object') return null;
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = a[k];
      if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 60);
    }
    return undefined;
  };
  // City before village: in Lisbon the village is a parish ("Madalena"), the city is "Lisbon"
  const found = pick('city', 'town', 'village', 'municipality', 'island', 'county');
  // Some countries name the area around a town, e.g. "Ubud District" in Bali; the group knows it as "Ubud"
  const city = found?.replace(/\s+(District|Regency)$/i, '');
  if (!city) return null;
  const country = pick('country');
  return { city, ...(country && { country }) };
}

// One request at a time, at least 1.1 s apart
let queue: Promise<unknown> = Promise.resolve();
let last = 0;
function inLine<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = last + 1100 - Date.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    last = Date.now();
    return job();
  });
  queue = run.catch(() => {});
  return run;
}

// Places a few hundred metres apart are in the same city, so answers are kept per rounded point for a day
const CACHE_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; answer: OsmCity | null }>();

export async function cityAt(lat: number, lng: number): Promise<OsmCity | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.answer;
  try {
    const answer = await inLine(async () => {
      const url = `${API}?format=jsonv2&zoom=10&accept-language=en&lat=${lat}&lon=${lng}`;
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`Nominatim ${res.status}`);
      return cityOfAnswer(await res.json());
    });
    if (cache.size >= 1000) cache.delete(cache.keys().next().value!);
    cache.set(key, { at: Date.now(), answer });
    return answer;
  } catch (e) {
    console.error('[osm]', (e as Error).message);
    return null;
  }
}
