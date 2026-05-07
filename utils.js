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
 * If windowStart/windowEnd are provided, scans that explicit range.
 * Otherwise scans months where at least one member marked unavailability.
 * Returns up to 8 ranges: { label, start, end, votes:[] }
 */
function computeDateRanges(memberNames, unavailMap, windowStart, windowEnd) {
  const blocked = new Set();
  const allUnavailKeys = [];
  memberNames.forEach(name => {
    (unavailMap[name] || []).forEach(d => {
      blocked.add(d);
      allUnavailKeys.push(d);
    });
  });

  const now = new Date(); now.setHours(0, 0, 0, 0);
  let scanStart, scanEnd;

  if (windowStart && windowEnd) {
    scanStart = new Date(windowStart + 'T12:00:00');
    scanEnd   = new Date(windowEnd   + 'T12:00:00');
    scanStart.setHours(0,0,0,0); scanEnd.setHours(0,0,0,0);
  } else {
    if (!allUnavailKeys.length) return [];
    const monthStrs = [...new Set(allUnavailKeys.map(d => d.substring(0, 7)))].sort();
    const [fy, fm] = monthStrs[0].split('-').map(Number);
    const [ly, lm] = monthStrs[monthStrs.length - 1].split('-').map(Number);
    scanStart = new Date(fy, fm - 1, 1);
    scanEnd   = new Date(ly, lm, 0);
  }

  const ranges = [];
  const cur = new Date(Math.max(now.getTime(), scanStart.getTime()));
  let windowStart_ = null;

  while (cur <= scanEnd) {
    const key = toKey(cur);
    if (blocked.has(key)) {
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
      if (!windowStart_) windowStart_ = new Date(cur);
    }
    cur.setDate(cur.getDate() + 1);
  }

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

module.exports = { computeDateRanges, toKey, formatTripLabel };
