const EN_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Returns the current time as a "HH:MM" string, used for chat message timestamps.
function ts() {
  const d = new Date();
  return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
}

// When we store a month end like "2026-06-30", the Date constructor with UTC
// can shift it to June 29 in timezones ahead of UTC (e.g. UTC+2).
// To fix this, we always recalculate the real last day of the given month
// using local time, so June always ends on the 30th regardless of timezone.
function snapMonthEnd(dateStr) {
  if (!dateStr) return dateStr;
  const d    = new Date(dateStr + 'T12:00:00');
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0); // day 0 of next month = last day of this month
  return `${last.getFullYear()}-${String(last.getMonth()+1).padStart(2,'0')}-${String(last.getDate()).padStart(2,'0')}`;
}

// Converts a JavaScript Date object to a "YYYY-MM-DD" string (our date key format).
function toKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Returns the number of days between two Date objects (inclusive of both endpoints).
function daysBetween(a, b) {
  return Math.round((b - a) / 86400000) + 1;
}

// Formats a date range into a human-readable label like "3 – 12 April (10 days)".
function formatRange(start, end) {
  const days    = daysBetween(start, end);
  const dayWord = days === 1 ? 'day' : 'days';
  const sm      = start.getMonth(), em = end.getMonth();
  const dateStr = sm === em
    ? `${start.getDate()} – ${end.getDate()} ${EN_MONTHS[sm]}`
    : `${start.getDate()} ${EN_MONTHS[sm]} – ${end.getDate()} ${EN_MONTHS[em]}`;
  return `${dateStr} (${days} ${dayWord})`;
}

// Builds the label for a confirmed trip
function formatTripLabel(startKey, dur) {
  const s = new Date(startKey + 'T12:00:00');
  const e = new Date(s);
  e.setDate(e.getDate() + dur - 1);
  return formatRange(s, e);
}

// Core algorithm: finds all consecutive date windows where NOBODY in the group has marked themselves as unavailable.
function computeDateRanges(memberNames, unavailMap, windowStart, windowEnd) {
  // Build a set of all days that at least one member can't travel
  const blocked      = new Set();
  const allUnavailKeys = [];
  memberNames.forEach(name => {
    (unavailMap[name] || []).forEach(d => {
      blocked.add(d);
      allUnavailKeys.push(d);
    });
  });

  let scanStart, scanEnd;

  if (windowStart && windowEnd) {
    // Admin set an explicit trip window, so scan that exact range
    scanStart = new Date(windowStart + 'T12:00:00');
    const weDate = new Date(windowEnd + 'T12:00:00');
    // Snap to the real last day of the end month (timezone safety)
    scanEnd = new Date(weDate.getFullYear(), weDate.getMonth() + 1, 0);
    scanStart.setHours(0,0,0,0); scanEnd.setHours(0,0,0,0);
  } else {
    // No window set — fall back to scanning only the months where someone marked unavailability
    if (!allUnavailKeys.length) return [];
    const monthStrs = [...new Set(allUnavailKeys.map(d => d.substring(0, 7)))].sort();
    const [fy, fm]  = monthStrs[0].split('-').map(Number);
    const [ly, lm]  = monthStrs[monthStrs.length - 1].split('-').map(Number);
    scanStart = new Date(fy, fm - 1, 1);
    scanEnd   = new Date(ly, lm, 0);
  }

  const ranges    = [];
  const cur       = new Date(scanStart);
  let windowStart_ = null; // tracks the start of the current free streak

  while (cur <= scanEnd) {
    const key = toKey(cur);
    if (blocked.has(key)) {
      // Hit a blocked day — if we were in a free streak, save it as a range
      if (windowStart_) {
        const prev = new Date(cur); prev.setDate(prev.getDate() - 1);
        ranges.push({
          label: formatRange(windowStart_, prev),
          start: toKey(windowStart_),
          end:   toKey(prev),
          votes: [],
          selected: false
        });
        windowStart_ = null;
      }
    } else {
      // Free day — start a new streak if we don't have one yet
      if (!windowStart_) windowStart_ = new Date(cur);
    }
    cur.setDate(cur.getDate() + 1);
  }

  // If the scan ended while still inside a free streak, save the last range
  if (windowStart_) {
    ranges.push({
      label: formatRange(windowStart_, scanEnd),
      start: toKey(windowStart_),
      end:   toKey(scanEnd),
      votes: [],
      selected: false
    });
  }

  return ranges.slice(0, 8);
}

module.exports = { ts, snapMonthEnd, computeDateRanges, formatTripLabel };
