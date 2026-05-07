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

/**
 * Finds all date windows where NO member has marked unavailability.
 * Returns up to 8 ranges: { label, start, end, votes:[] }
 * Label includes total window length, e.g. "10 – 20 May (10 days)"
 */
function computeDateRanges(memberNames, unavailMap, scanMonths = 5) {
  const blocked = new Set();
  memberNames.forEach(name => {
    (unavailMap[name] || []).forEach(d => blocked.add(d));
  });

  const ranges = [];
  const now = new Date(); now.setHours(0,0,0,0);
  const scanEnd = new Date(now); scanEnd.setMonth(scanEnd.getMonth() + scanMonths);

  let windowStart = null;
  const cur = new Date(now);

  while (cur <= scanEnd) {
    const key = toKey(cur);
    if (blocked.has(key)) {
      if (windowStart) {
        const prev = new Date(cur); prev.setDate(prev.getDate()-1);
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

module.exports = { computeDateRanges, toKey };
