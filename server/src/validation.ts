// Checks the log-in and sign-up forms, chat messages, new trips, trip settings, the planning steps and expenses before anything touches the database.

import { decimals } from '../../shared/money';

export const PASSWORD_MIN = 8;
const USERNAME_MAX = 30;
export const MESSAGE_MAX = 1000;

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

// Only plain text is accepted. A JSON body can also hold objects like { "$gt": "" },
// which MongoDB would read as a query operator instead of an email (NoSQL injection).
const text = (v: unknown) => (typeof v === 'string' ? v : '');

// Emails are stored in lower case, so "Mia@Example.com" and "mia@example.com" are the same account.
const normalizeEmail = (v: unknown) => text(v).trim().toLowerCase();

// A simple shape check: something@something.something, no spaces
const looksLikeEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Invite codes are 8 capital letters and numbers, e.g. "A3BF92C1" (made in routes/groups.ts)
export function normalizeInviteCode(v: unknown): string | null {
  const code = text(v).trim().toUpperCase();
  return /^[A-Z0-9]{8}$/.test(code) ? code : null;
}

export function checkRegister(body: unknown): Result<{ email: string; password: string; username: string }> {
  const b = (body ?? {}) as Record<string, unknown>;
  const email = normalizeEmail(b.email);
  const password = text(b.password);
  const username = text(b.username).trim();

  if (!email || !password || !username) return { ok: false, error: 'Please fill in all fields' };
  if (!looksLikeEmail(email)) return { ok: false, error: 'Please enter a valid email address' };
  if (username.length > USERNAME_MAX) return { ok: false, error: `Your name can be at most ${USERNAME_MAX} characters` };
  if (password.length < PASSWORD_MIN) return { ok: false, error: `Password must be at least ${PASSWORD_MIN} characters` };
  return { ok: true, value: { email, password, username } };
}

export function checkPasswordChange(body: unknown): Result<{ currentPassword: string; newPassword: string }> {
  const b = (body ?? {}) as Record<string, unknown>;
  const currentPassword = text(b.currentPassword);
  const newPassword = text(b.newPassword);

  if (!currentPassword || !newPassword) return { ok: false, error: 'Please fill in both passwords' };
  if (newPassword.length < PASSWORD_MIN) return { ok: false, error: `Password must be at least ${PASSWORD_MIN} characters` };
  if (newPassword === currentPassword) return { ok: false, error: 'The new password must be different from the current one' };
  return { ok: true, value: { currentPassword, newPassword } };
}

// The profile: a new name and/or photo. The photo is the address of an avatar the user uploaded
// ("/api/files/<id>", checked against the file storage in routes/auth.ts), or null to remove it.
export function checkProfile(body: unknown): Result<{ username?: string; photoId?: string | null }> {
  const b = (body ?? {}) as Record<string, unknown>;
  const value: { username?: string; photoId?: string | null } = {};
  if ('username' in b) {
    const username = text(b.username).trim();
    if (!username) return { ok: false, error: 'Please enter your name' };
    if (username.length > USERNAME_MAX) return { ok: false, error: `Your name can be at most ${USERNAME_MAX} characters` };
    value.username = username;
  }
  if ('photo' in b) {
    if (b.photo === null) value.photoId = null;
    else {
      const id = /^\/api\/files\/([a-f0-9]{48})$/.exec(text(b.photo))?.[1];
      if (!id) return { ok: false, error: 'That photo could not be found — please upload it again' };
      value.photoId = id;
    }
  }
  if (!('username' in value) && !('photoId' in value)) return { ok: false, error: 'Nothing to change' };
  return { ok: true, value };
}

// A new e-mail address for the account; the current password proves it is really the owner
export function checkEmailChange(body: unknown, current: string): Result<{ email: string; password: string }> {
  const b = (body ?? {}) as Record<string, unknown>;
  const email = normalizeEmail(b.email);
  const password = text(b.password);
  if (!email || !password) return { ok: false, error: 'Please enter the new e-mail and your password' };
  if (!looksLikeEmail(email)) return { ok: false, error: 'Please enter a valid email address' };
  if (email === current) return { ok: false, error: 'This is already your e-mail' };
  return { ok: true, value: { email, password } };
}

export function checkLogin(body: unknown): Result<{ email: string; password: string }> {
  const b = (body ?? {}) as Record<string, unknown>;
  const email = normalizeEmail(b.email);
  const password = text(b.password);

  if (!email || !password) return { ok: false, error: 'Please enter your email and password' };
  return { ok: true, value: { email, password } };
}

// A chat message: plain text that is not empty and at most MESSAGE_MAX characters long.
export function checkMessage(v: unknown): Result<string> {
  const message = text(v).trim();
  if (!message) return { ok: false, error: 'The message is empty' };
  if (message.length > MESSAGE_MAX) return { ok: false, error: `A message can be at most ${MESSAGE_MAX} characters` };
  return { ok: true, value: message };
}

// The name of an area in the Stays tab, e.g. "Ubud": text, not empty, at most AREA_NAME_MAX characters
export const AREA_NAME_MAX = 40;
export function checkAreaName(v: unknown): Result<string> {
  const name = text(v).replace(/\s+/g, ' ').trim();
  if (!name) return { ok: false, error: 'Give the area a name' };
  if (name.length > AREA_NAME_MAX) return { ok: false, error: `An area name can be at most ${AREA_NAME_MAX} characters` };
  return { ok: true, value: name };
}

// ── Creating a trip ───────────────────────────────────
const TRIP_NAME_MAX = 60;
const DESTINATION_MAX = 60;
const MAX_TRIP_DAYS = 90;      // "we know our dates": at most a 90-day trip
const MAX_WINDOW_MONTHS = 12;  // "help us find dates": at most 12 months to choose from

export interface NewTrip {
  name: string;
  destination: string | null;                // filled in = no destination poll
  knownDates: { start: string; end: string } | null;   // filled in = no availability and date vote
  window: { start: string; end: string } | null;       // months to find dates in, "YYYY-MM-01" … last day
  currency: string;
}

// "YYYY-MM-DD" that is a real day (not 2027-02-30)
const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) === v;
const isMonth = (v: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const lastDayOf = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
};

// The first and the last day of a trip whose dates the group already knows
function checkKnownDates(dates: Record<string, unknown>, today: string): Result<{ start: string; end: string }> {
  const start = text(dates.start), end = text(dates.end);
  if (!isDay(start) || !isDay(end)) return { ok: false, error: 'Please choose the first and the last day of the trip' };
  // One day of tolerance, because "today" on the server can be yesterday in the user's time zone
  if (dayDiff(today, start) < -1) return { ok: false, error: 'The trip cannot start in the past' };
  if (end < start) return { ok: false, error: 'The last day cannot be before the first day' };
  if (dayDiff(start, end) + 1 > MAX_TRIP_DAYS) return { ok: false, error: `A trip can be at most ${MAX_TRIP_DAYS} days long` };
  return { ok: true, value: { start, end } };
}

export function checkNewTrip(body: unknown, today = new Date().toISOString().slice(0, 10)): Result<NewTrip> {
  const b = (body ?? {}) as Record<string, unknown>;
  const name = text(b.name).trim();
  const destination = text(b.destination).trim();
  const currency = (text(b.currency).trim() || 'EUR').toUpperCase();
  const dates = (b.dates ?? {}) as Record<string, unknown>;

  if (!name) return { ok: false, error: 'Please give the trip a name' };
  if (name.length > TRIP_NAME_MAX) return { ok: false, error: `The trip name can be at most ${TRIP_NAME_MAX} characters` };
  if (destination.length > DESTINATION_MAX) return { ok: false, error: `The destination can be at most ${DESTINATION_MAX} characters` };
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, error: 'Please choose a currency' };

  let knownDates: NewTrip['knownDates'] = null;
  let window: NewTrip['window'] = null;

  if (dates.mode === 'known') {
    const checked = checkKnownDates(dates, today);
    if (!checked.ok) return checked;
    knownDates = checked.value;
  } else if (dates.mode === 'find') {
    const from = text(dates.fromMonth), to = text(dates.toMonth);
    if (!isMonth(from) || !isMonth(to)) return { ok: false, error: 'Please choose the months the trip could happen in' };
    if (from < today.slice(0, 7)) return { ok: false, error: 'The months cannot be in the past' };
    if (to < from) return { ok: false, error: 'The last month cannot be before the first month' };
    const months = (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5)) - Number(from.slice(5)) + 1;
    if (months > MAX_WINDOW_MONTHS) return { ok: false, error: `Please choose at most ${MAX_WINDOW_MONTHS} months` };
    window = { start: `${from}-01`, end: lastDayOf(to) };
  }
  // No dates at all (older clients): the group sets the months later, as in the old app

  return { ok: true, value: { name, destination: destination || null, knownDates, window, currency } };
}

// ── Trip settings ─────────────────────────────────────
export interface TripChanges {
  name?: string;
  currency?: string;
  dates?: { start: string; end: string };
}

// Changes from the "Trip settings" screen. Only the fields that are sent are changed, with the same rules as a new trip.
export function checkTripChanges(body: unknown, today = new Date().toISOString().slice(0, 10)): Result<TripChanges> {
  const b = (body ?? {}) as Record<string, unknown>;
  const changes: TripChanges = {};

  if ('name' in b) {
    const name = text(b.name).trim();
    if (!name) return { ok: false, error: 'Please give the trip a name' };
    if (name.length > TRIP_NAME_MAX) return { ok: false, error: `The trip name can be at most ${TRIP_NAME_MAX} characters` };
    changes.name = name;
  }
  if ('currency' in b) {
    const currency = text(b.currency).trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, error: 'Please choose a currency' };
    changes.currency = currency;
  }
  if ('dates' in b) {
    const checked = checkKnownDates((b.dates ?? {}) as Record<string, unknown>, today);
    if (!checked.ok) return checked;
    changes.dates = checked.value;
  }
  if (!Object.keys(changes).length) return { ok: false, error: 'Nothing to change' };
  return { ok: true, value: changes };
}

// ── Planning steps ────────────────────────────────────
const MAX_UNAVAILABLE_DAYS = 400;   // more than a year of days; protects the trip document from huge lists

// A suggested destination, e.g. "Bali, Indonesia"
export function checkDestinationName(v: unknown): Result<string> {
  const name = text(v).trim();
  if (!name) return { ok: false, error: 'Please write a place' };
  if (name.length > DESTINATION_MAX) return { ok: false, error: `A place can be at most ${DESTINATION_MAX} characters` };
  return { ok: true, value: name };
}

// The days someone cannot travel: real days inside the trip's months, each once and in order.
// Anything else (other text, objects, days outside the months) is dropped.
export function cleanUnavailableDays(v: unknown, windowStart?: string | null, windowEnd?: string | null): string[] {
  if (!Array.isArray(v)) return [];
  const days = new Set(v.filter((d): d is string =>
    typeof d === 'string' && isDay(d) && (!windowStart || d >= windowStart) && (!windowEnd || d <= windowEnd)));
  return [...days].sort().slice(0, MAX_UNAVAILABLE_DAYS);
}

// How many days the trip lasts, set by the organiser while the group looks for dates
export function checkTripLength(v: unknown): Result<number> {
  const days = Number(v);
  if (!Number.isInteger(days) || days < 1 || days > MAX_TRIP_DAYS) return { ok: false, error: `A trip can be 1 to ${MAX_TRIP_DAYS} days long` };
  return { ok: true, value: days };
}

// The organiser confirms one of the free windows. The trip starts on `start` (or the window's first day)
// and lasts `days` (or the whole window), and it must fit inside the window: nobody may be busy on any of its days.
export function checkConfirmDates(range: { start: string; end: string }, start: unknown, days: number | null | undefined): Result<{ start: string; days: number }> {
  const length = dayDiff(range.start, range.end) + 1;
  const tripDays = days ?? length;
  const first = start == null || start === '' ? range.start : text(start);
  if (!isDay(first)) return { ok: false, error: 'Please choose the first day of the trip' };
  if (first < range.start || dayDiff(first, range.end) + 1 < tripDays) return { ok: false, error: 'The trip does not fit in this free window' };
  return { ok: true, value: { start: first, days: tripDays } };
}

// ── Stays ─────────────────────────────────────────────
// The nights of one stay: checkIn is the first night, checkOut the morning the group leaves.
// When the trip dates are known (first and last day), the nights must lie inside them;
// null clears the nights again.
export function checkStayNights(
  nights: unknown, trip: { start: string; end: string } | null,
): Result<{ checkIn: string; checkOut: string } | null> {
  if (nights == null) return { ok: true, value: null };
  const d = (typeof nights === 'object' ? nights : {}) as Record<string, unknown>;
  const checkIn = text(d.checkIn), checkOut = text(d.checkOut);
  if (!isDay(checkIn) || !isDay(checkOut)) return { ok: false, error: 'Please choose the check-in and check-out day' };
  if (checkOut <= checkIn) return { ok: false, error: 'Check-out must be after check-in' };
  if (dayDiff(checkIn, checkOut) > MAX_TRIP_DAYS) return { ok: false, error: `A stay can be at most ${MAX_TRIP_DAYS} nights` };
  if (trip && (checkIn < trip.start || checkOut > trip.end)) return { ok: false, error: 'The nights must be within the trip dates' };
  return { ok: true, value: { checkIn, checkOut } };
}

// The details form of a stay (StayDetailsInput). Text is trimmed and may be empty (= none),
// the price is per night and rounded to cents, and a new photo must be one of our own uploaded files.
export const STAY_TEXT_MAX = 120;
const STAY_PRICE_MAX = 1_000_000_000;   // a billion, as for expenses (rupiah, dong)
export interface CheckedStayDetails {
  title: string | null;
  price: { amount: number; currency: string } | null;
  location: string | null;
  image: 'keep' | null | string;
}
export function checkStayDetails(body: unknown): Result<CheckedStayDetails> {
  const b = (body ?? {}) as Record<string, unknown>;
  const title = text(b.title).trim().replace(/\s+/g, ' ');
  const location = text(b.location).trim().replace(/\s+/g, ' ');
  if (title.length > STAY_TEXT_MAX) return { ok: false, error: `The name can have at most ${STAY_TEXT_MAX} characters` };
  if (location.length > STAY_TEXT_MAX) return { ok: false, error: `The location can have at most ${STAY_TEXT_MAX} characters` };

  let price: CheckedStayDetails['price'] = null;
  if (b.price != null) {
    const p = (typeof b.price === 'object' ? b.price : {}) as Record<string, unknown>;
    const amount = typeof p.amount === 'number' ? p.amount : NaN;
    const currency = text(p.currency).trim().toUpperCase();
    if (!Number.isFinite(amount) || amount <= 0 || amount > STAY_PRICE_MAX) return { ok: false, error: 'Please enter a price per night above 0' };
    if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, error: 'Please choose a currency' };
    price = { amount: Math.round(amount * 100) / 100, currency };
  }

  const image = b.image === 'keep' || b.image === null ? b.image : text(b.image);
  if (image !== 'keep' && image !== null && !/^\/api\/files\/[a-f0-9]{48}$/.test(image)) {
    return { ok: false, error: 'Please upload the photo again' };
  }
  return { ok: true, value: { title: title || null, price, location: location || null, image } };
}

// ── Itinerary ─────────────────────────────────────────
// One activity (ActivityInput). Its day must be a day of the trip once the trip has dates;
// without a day it is an idea for later. The time is optional, "HH:MM".
const ACTIVITY_TEXT_MAX = 80;
const ACTIVITY_PLACE_MAX = 120;
const ACTIVITY_NOTE_MAX = 500;
export interface CheckedActivity { text: string; calDate: string | null; calTime: string | null; place: string | null; note: string | null }
export function checkActivity(body: unknown, trip: { start: string; end: string } | null): Result<CheckedActivity> {
  const b = (body ?? {}) as Record<string, unknown>;
  const one = (v: unknown) => text(v).trim().replace(/\s+/g, ' ');
  const activity = one(b.text), place = one(b.place);
  const note = text(b.note).trim();
  if (!activity) return { ok: false, error: 'Please write what you will do' };
  if (activity.length > ACTIVITY_TEXT_MAX) return { ok: false, error: `The activity can have at most ${ACTIVITY_TEXT_MAX} characters` };
  if (place.length > ACTIVITY_PLACE_MAX) return { ok: false, error: `The place can have at most ${ACTIVITY_PLACE_MAX} characters` };
  if (note.length > ACTIVITY_NOTE_MAX) return { ok: false, error: `The note can have at most ${ACTIVITY_NOTE_MAX} characters` };
  const calDate = text(b.calDate).trim() || null;
  if (calDate && (!isDay(calDate) || (trip && (calDate < trip.start || calDate > trip.end)))) {
    return { ok: false, error: 'Please choose a day of the trip' };
  }
  const calTime = text(b.calTime).trim() || null;
  if (calTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(calTime)) return { ok: false, error: 'Please choose a time' };
  return { ok: true, value: { text: activity, calDate, calTime: calDate ? calTime : null, place: place || null, note: note || null } };
}

// ── Expenses ──────────────────────────────────────────
const EXPENSE_TEXT_MAX = 80;
const EXPENSE_MAX = 1_000_000_000;   // a billion, enough for Indonesian rupiah or Vietnamese dong

export interface CheckedExpense {
  description: string;
  amount: number;
  currency: string;
  paidByUserId: string;
  splitAmongUserIds: string[];
  // Only when the expense is split by exact amounts
  shares?: { userId: string; amount: number }[];
}

// An expense from the Add expense form. members are the user ids of the trip. It is split equally between
// splitAmongUserIds (none = the whole group), or by exact amounts in shares, which must add up to the amount.
// Amounts are counted in the smallest unit of the currency (cents), so 0.1 + 0.2 cannot miss 0.3.
export function checkExpense(body: unknown, members: string[], groupCurrency: string): Result<CheckedExpense> {
  const b = (body ?? {}) as Record<string, unknown>;
  const description = text(b.description).trim();
  const currency = (text(b.currency).trim() || groupCurrency).toUpperCase();
  const paidByUserId = text(b.paidByUserId);

  if (!description) return { ok: false, error: 'Please write what it was' };
  if (description.length > EXPENSE_TEXT_MAX) return { ok: false, error: `The description can be at most ${EXPENSE_TEXT_MAX} characters` };
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, error: 'Please choose a currency' };
  const factor = 10 ** decimals(currency);
  const toUnits = (v: unknown) => Math.round(Number(v) * factor);
  const units = toUnits(b.amount);
  if (!Number.isFinite(units) || units <= 0 || units / factor > EXPENSE_MAX) return { ok: false, error: 'Please enter an amount above zero' };
  if (!members.includes(paidByUserId)) return { ok: false, error: 'The person who paid must be in the trip' };
  const value = { description, amount: units / factor, currency, paidByUserId };

  if (Array.isArray(b.shares) && b.shares.length) {
    const shares: { userId: string; amount: number }[] = [];
    let sum = 0;
    for (const raw of b.shares as Record<string, unknown>[]) {
      const id = text(raw?.userId);
      const part = toUnits(raw?.amount);
      if (!members.includes(id) || shares.some(s => s.userId === id)) return { ok: false, error: 'Everyone in the split must be in the trip, once' };
      if (!Number.isFinite(part) || part < 0) return { ok: false, error: 'The amounts cannot be below zero' };
      // People with 0 are not part of the split
      if (part > 0) shares.push({ userId: id, amount: part / factor });
      sum += part;
    }
    if (!shares.length) return { ok: false, error: 'Please enter an amount for at least one person' };
    if (sum !== units) return { ok: false, error: `The amounts add up to ${sum / factor} ${currency}, not ${units / factor} ${currency}` };
    return { ok: true, value: { ...value, splitAmongUserIds: shares.map(s => s.userId), shares } };
  }

  const chosen = Array.isArray(b.splitAmongUserIds) ? [...new Set(b.splitAmongUserIds.map(String))] : [];
  if (chosen.some(id => !members.includes(id))) return { ok: false, error: 'Everyone in the split must be in the trip, once' };
  // Nobody chosen: the cost is shared by the whole group
  return { ok: true, value: { ...value, splitAmongUserIds: chosen.length ? chosen : members } };
}
