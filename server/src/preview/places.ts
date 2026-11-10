// Photos from Google Maps (Places API) for stays whose page gives none, e.g. Booking, which shows servers
// a bot check instead of the hotel. We search for the name and country we read from the link
// ("Freebeach, Vietnam") and use the photo of the place Google finds.
// Only on when GOOGLE_PLACES_KEY is set (server/.env locally, Environment on Render); without it nothing changes.
//
// Google's terms do not allow keeping Places content, so only the place id is saved with a stay or a message.
// The photo itself is asked for when someone looks at it (GET /api/places/:placeId/photo) and kept in memory
// for an hour at most, and the card names its source: "Photo: <author> · Google Maps".
const API = 'https://places.googleapis.com/v1';
const TIMEOUT_MS = 6_000;
const key = () => process.env.GOOGLE_PLACES_KEY;

export const placesEnabled = () => !!key();

// The address the client shows the photo from; it adds the server's own address in front (API_URL)
export const placePhotoPath = (placeId: string) => `/api/places/${encodeURIComponent(placeId)}/photo`;

// Place ids from Google look like "ChIJN1t_tDeuEmsRUsoyG83frY4"
export const isPlaceId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{10,300}$/.test(v);

interface Photo { name: string; authorAttributions?: { displayName?: string }[] }

async function google<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(API + path, {
    ...init,
    headers: { 'X-Goog-Api-Key': key()!, 'Content-Type': 'application/json', ...init.headers },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Places API ${res.status}`);
  return res.json() as Promise<T>;
}

// The best match for "Freebeach, Vietnam" that has a photo, or null
export async function findPlace(query: string): Promise<{ placeId: string; credit: string } | null> {
  if (!placesEnabled() || !query.trim()) return null;
  try {
    const data = await google<{ places?: { id: string; photos?: Photo[] }[] }>('/places:searchText', {
      method: 'POST',
      headers: { 'X-Goog-FieldMask': 'places.id,places.photos' },
      body: JSON.stringify({ textQuery: query.slice(0, 200), maxResultCount: 1 }),
    });
    const place = data.places?.[0];
    const photo = place?.photos?.[0];
    if (!place || !photo) return null;
    const author = photo.authorAttributions?.[0]?.displayName;
    return { placeId: place.id, credit: author ? `Photo: ${author} · Google Maps` : 'Photo: Google Maps' };
  } catch (e) {
    console.error('[places:search]', (e as Error).message);
    return null;
  }
}

// placeId → a short-lived photo address from Google, kept for an hour
const PHOTO_CACHE_MS = 60 * 60 * 1000;
const photoCache = new Map<string, { at: number; uri: string }>();

export async function photoUri(placeId: string): Promise<string | null> {
  if (!placesEnabled() || !isPlaceId(placeId)) return null;
  const hit = photoCache.get(placeId);
  if (hit && Date.now() - hit.at < PHOTO_CACHE_MS) return hit.uri;
  try {
    const place = await google<{ photos?: Photo[] }>(`/places/${encodeURIComponent(placeId)}`, {
      headers: { 'X-Goog-FieldMask': 'photos' },
    });
    const name = place.photos?.[0]?.name;
    if (!name) return null;
    // skipHttpRedirect: Google answers with the photo's address instead of the photo, so the key is not in it
    const media = await google<{ photoUri?: string }>(`/${name}/media?maxWidthPx=800&skipHttpRedirect=true`);
    if (!media.photoUri) return null;
    if (photoCache.size >= 1000) photoCache.delete(photoCache.keys().next().value!);
    photoCache.set(placeId, { at: Date.now(), uri: media.photoUri });
    return media.photoUri;
  } catch (e) {
    console.error('[places:photo]', (e as Error).message);
    return null;
  }
}
