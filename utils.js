const EN_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function toKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function daysBetween(a, b) {
  return Math.round((b - a) / 86400000) + 1;
}

function formatRange(start, end) {
  const days = daysBetween(start, end);
  const dayWord = days === 1 ? 'day' : 'days';
  const sm = start.getMonth(), em = end.getMonth();
  const dateStr = sm === em
    ? `${start.getDate()} – ${end.getDate()} ${EN_MONTHS[sm]}`
    : `${start.getDate()} ${EN_MONTHS[sm]} – ${end.getDate()} ${EN_MONTHS[em]}`;
  return `${dateStr} (${days} ${dayWord})`;
}

function formatTripLabel(startKey, dur) {
  const s = new Date(startKey + 'T12:00:00');
  const e = new Date(s);
  e.setDate(e.getDate() + dur - 1);
  return formatRange(s, e);
}

/**
 * Finds free date windows where NO member has unavailability.
 * Only scans months where at least one member has marked unavailability.
 * Returns up to 8 ranges: { label, start, end, votes:[] }
 */
function computeDateRanges(memberNames, unavailMap) {
  const blocked = new Set();
  const allUnavailKeys = [];
  memberNames.forEach(name => {
    (unavailMap[name] || []).forEach(d => {
      blocked.add(d);
      allUnavailKeys.push(d);
    });
  });

  if (!allUnavailKeys.length) return [];

  // Determine scan range: first day of earliest unavail month → last day of latest unavail month
  const monthStrs = [...new Set(allUnavailKeys.map(d => d.substring(0, 7)))].sort();
  const [fy, fm] = monthStrs[0].split('-').map(Number);
  const [ly, lm] = monthStrs[monthStrs.length - 1].split('-').map(Number);

  const now = new Date(); now.setHours(0, 0, 0, 0);
  const rangeStart = new Date(fy, fm - 1, 1);
  const scanEnd   = new Date(ly, lm, 0); // last day of last month (month lm in 0-indexed = next month, day 0 = last of current)

  const ranges = [];
  const cur = new Date(Math.max(now.getTime(), rangeStart.getTime()));
  let windowStart = null;

  while (cur <= scanEnd) {
    const key = toKey(cur);
    if (blocked.has(key)) {
      if (windowStart) {
        const prev = new Date(cur); prev.setDate(prev.getDate() - 1);
        ranges.push({
          label: formatRange(windowStart, prev),
          start: toKey(windowStart),
          end:   toKey(prev),
          votes: [],
          selected: false
        });
        windowStart = null;
      }
    } else {
      if (!windowStart) windowStart = new Date(cur);
    }
    cur.setDate(cur.getDate() + 1);
  }

  if (windowStart) {
    ranges.push({
      label: formatRange(windowStart, scanEnd),
      start: toKey(windowStart),
      end:   toKey(scanEnd),
      votes: [],
      selected: false
    });
  }

  return ranges.slice(0, 8);
}

module.exports = { computeDateRanges, toKey, formatTripLabel };
