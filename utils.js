const SK_MONTHS_GEN = ['januára','februára','marca','apríla','mája','júna','júla','augusta','septembra','októbra','novembra','decembra'];

function toKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function daysBetween(a, b) {
  return Math.round((b - a) / 86400000) + 1;
}

function formatRange(start, end) {
  const sm = start.getMonth(), em = end.getMonth();
  if (sm === em)
    return `${start.getDate()}. – ${end.getDate()}. ${SK_MONTHS_GEN[sm]}`;
  return `${start.getDate()}. ${SK_MONTHS_GEN[sm]} – ${end.getDate()}. ${SK_MONTHS_GEN[em]}`;
}

/**
 * Finds date windows where NO member has marked unavailability,
 * long enough for tripDuration days.
 * Returns up to 5 ranges: { label, start, end, votes:[] }
 */
function computeDateRanges(memberNames, unavailMap, tripDuration, scanMonths = 5) {
  // Build full blocked set
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
        const len = daysBetween(windowStart, prev);
        if (len >= tripDuration) {
          ranges.push({
            label: formatRange(windowStart, prev),
            start: toKey(windowStart),
            end:   toKey(prev),
            votes: [],
            selected: false
          });
        }
        windowStart = null;
      }
    } else {
      if (!windowStart) windowStart = new Date(cur);
    }
    cur.setDate(cur.getDate() + 1);
  }

  if (windowStart) {
    const len = daysBetween(windowStart, scanEnd);
    if (len >= tripDuration) {
      ranges.push({
        label: formatRange(windowStart, scanEnd),
        start: toKey(windowStart),
        end:   toKey(scanEnd),
        votes: [],
        selected: false
      });
    }
  }

  return ranges.slice(0, 5);
}

module.exports = { computeDateRanges, toKey };
