/* ShiftCal core — pure date/pattern logic.
   NO local-time date maths anywhere. Every date is a civil (y,m,d) triple
   converted to an integer day serial via Howard Hinnant's days-from-civil.
   This file is importable in Node (module.exports) and in the browser
   (window.ShiftCal). The UI, counts, print view and .ics export ALL call
   shiftForDate / shiftForSerial — there is no duplicated pattern logic. */
(function (global) {
  'use strict';

  /* ---------- civil date maths ---------- */
  function daysFromCivil(y, m, d) {
    var yy = y - (m <= 2 ? 1 : 0);
    var era = Math.floor((yy >= 0 ? yy : yy - 399) / 400);
    var yoe = yy - era * 400;                                   // [0, 399]
    var mp = m > 2 ? m - 3 : m + 9;                             // Mar=0..Feb=11
    var doy = Math.floor((153 * mp + 2) / 5) + d - 1;           // [0, 365]
    var doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
    return era * 146097 + doe - 719468;                         // days since 1970-01-01
  }
  function civilFromDays(z) {
    var zz = z + 719468;
    var era = Math.floor((zz >= 0 ? zz : zz - 146096) / 146097);
    var doe = zz - era * 146097;                                // [0, 146096]
    var yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
    var y = yoe + era * 400;
    var doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
    var mp = Math.floor((5 * doy + 2) / 153);                   // Mar=0..Feb=11
    var d = doy - Math.floor((153 * mp + 2) / 5) + 1;
    var m = mp < 10 ? mp + 3 : mp - 9;
    return { y: y + (m <= 2 ? 1 : 0), m: m, d: d };
  }
  function isLeapYear(y) {
    return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  }
  function daysInMonth(y, m) {
    var next = m === 12 ? { y: y + 1, m: 1 } : { y: y, m: m + 1 };
    return daysFromCivil(next.y, next.m, 1) - daysFromCivil(y, m, 1);
  }
  /* 0 = Sunday .. 6 = Saturday. 1970-01-01 (serial 0) was a Thursday (4). */
  function weekdayFromSerial(serial) {
    return (((serial + 4) % 7) + 7) % 7;
  }
  function weekday(y, m, d) { return weekdayFromSerial(daysFromCivil(y, m, d)); }

  function pad(n, w) { var s = String(Math.abs(n)); while (s.length < (w || 2)) s = '0' + s; return (n < 0 ? '-' : '') + s; }
  function formatISO(y, m, d) { return pad(y, 4) + '-' + pad(m) + '-' + pad(d); }
  function formatBasic(y, m, d) { return pad(y, 4) + pad(m) + pad(d); }
  /* Parse "YYYY-MM-DD" by splitting — NEVER new Date(str) + local getters. */
  function parseISODate(str) {
    if (typeof str !== 'string') return null;
    var parts = str.split('-');
    if (parts.length !== 3) return null;
    var y = parseInt(parts[0], 10), m = parseInt(parts[1], 10), d = parseInt(parts[2], 10);
    if (!isFinite(y) || !isFinite(m) || !isFinite(d)) return null;
    if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
    return { y: y, m: m, d: d };
  }
  function addDaysCivil(date, n) { return civilFromDays(daysFromCivil(date.y, date.m, date.d) + n); }
  function addMonthsCivil(y, m, delta) {
    var total = (y * 12 + (m - 1)) + delta;
    return { y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 + 1 };
  }

  /* ---------- shift types ---------- */
  var SHIFT_TYPES = {
    Day:    { type: 'Day',    label: 'Day',    code: 'D', color: '#2563eb', bg: '#dbeafe', start: '07:00', end: '19:00' },
    Night:  { type: 'Night',  label: 'Night',  code: 'N', color: '#7c3aed', bg: '#ede9fe', start: '19:00', end: '07:00' },
    Early:  { type: 'Early',  label: 'Early',  code: 'E', color: '#059669', bg: '#d1fae5', start: '06:00', end: '14:00' },
    Late:   { type: 'Late',   label: 'Late',   code: 'L', color: '#d97706', bg: '#fef3c7', start: '14:00', end: '22:00' },
    Off:    { type: 'Off',    label: 'Off',    code: 'O', color: '#64748b', bg: '#f1f5f9', start: '',       end: '' },
    Custom: { type: 'Custom', label: 'Custom', code: 'C', color: '#db2777', bg: '#fce7f3', start: '09:00', end: '17:00' }
  };
  function makeShift(type, overrides) {
    var base = SHIFT_TYPES[type] || SHIFT_TYPES.Custom;
    var s = { type: base.type, label: base.label, code: base.code, color: base.color, bg: base.bg, start: base.start, end: base.end };
    if (overrides) { for (var k in overrides) s[k] = overrides[k]; }
    return s;
  }
  function expandRuns(runs) {
    var out = [];
    runs.forEach(function (r) {
      var type = r[0], count = r[1], overrides = r[2];
      for (var i = 0; i < count; i++) out.push(makeShift(type, overrides));
    });
    return out;
  }

  /* ---------- presets (EDITABLE templates — patterns vary by employer) ----------
     DuPont verified block-by-block: 4N,3off,3D,1off,3N,3off,4D,7off = 28.
     Continental verified documented rota: (2E,2L,3N,2off)(2E,3L,2N,2off)(3E,2L,2N,3off) = 28,
       forward-rotating Early -> Late -> Night, off after nights.
     Panama per brief: 2 on,2 off,3 on,2 off,2 on,3 off = 14 (all one shift type per crew).
     Pitman: same 2-2-3 cadence, fixed shift for 14 days then swaps Day<->Night = 28 full cycle.
     5on2off-rotating: each 7-day block is 5 on / 2 off, but the off days move in week 2
       (positions 4 & 7) so the weekend worked rotates — 14-day cycle.            */
  var PRESETS = {
    '4on4off': {
      name: '4 on / 4 off', slug: '4-on-4-off',
      blurb: 'Four shifts on, four days off, repeating every 8 days. Because 8 is not a multiple of 7, your days off drift through the week and weekends rotate fairly.',
      pattern: expandRuns([['Day', 4], ['Off', 4]]),
      note: 'Day/night variants are common: some crews work 4 Nights instead of 4 Days, others work 2 Days then 2 Nights in the on-block. Edit the sequence above to match yours — patterns vary by employer.'
    },
    '2days2nights4off': {
      name: '2 days, 2 nights, 4 off', slug: '2-days-2-nights-4-off',
      blurb: 'Two day shifts, two night shifts, then four days off — an 8-day cycle common in warehousing, manufacturing and emergency services.',
      pattern: expandRuns([['Day', 2], ['Night', 2], ['Off', 4]]),
      note: 'Patterns vary by employer — check your start/end times and edit if yours differ.'
    },
    'panama': {
      name: 'Panama / 2-2-3', slug: 'panama-2-2-3',
      blurb: 'The 2-2-3: work 2, off 2, work 3, off 2, work 2, off 3 — a 14-day cycle of 12-hour shifts. Every other weekend is a 3-day weekend off.',
      pattern: expandRuns([['Day', 2], ['Off', 2], ['Day', 3], ['Off', 2], ['Day', 2], ['Off', 3]]),
      note: 'In the rotating Panama, crews swap between days and nights over a longer cycle; in the fixed version you stay on one shift type. Change Day to Night above if your crew is on nights. Patterns vary by employer.'
    },
    'dupont': {
      name: 'DuPont', slug: 'dupont',
      blurb: 'A 28-day cycle famous for its 7-day break: 4 nights, 3 off, 3 days, 1 off, 3 nights, 3 off, 4 days, then 7 off.',
      pattern: expandRuns([['Night', 4], ['Off', 3], ['Day', 3], ['Off', 1], ['Night', 3], ['Off', 3], ['Day', 4], ['Off', 7]]),
      note: 'Spelled out block by block: 4 Night → 3 Off → 3 Day → 1 Off → 3 Night → 3 Off → 4 Day → 7 Off = 28 days, 14 shifts worked. Patterns vary by employer.'
    },
    'continental': {
      name: 'Continental', slug: 'continental',
      blurb: 'Fast forward rotation through Early, Late and Night 8-hour shifts in 2–3 day blocks over 28 days, with days off after each night block.',
      pattern: expandRuns([['Early', 2], ['Late', 2], ['Night', 3], ['Off', 2], ['Early', 2], ['Late', 3], ['Night', 2], ['Off', 2], ['Early', 3], ['Late', 2], ['Night', 2], ['Off', 3]]),
      note: 'Spelled out: (2 Early, 2 Late, 3 Night, 2 Off) + (2 Early, 3 Late, 2 Night, 2 Off) + (3 Early, 2 Late, 2 Night, 3 Off) = 28 days. Patterns vary by employer.'
    },
    'pitman': {
      name: 'Pitman', slug: 'pitman',
      blurb: 'The Pitman uses the same 2-2-3 cadence as Panama, but you stay on one shift type for 14 days, then swap days ↔ nights — so the full cycle is 28 days.',
      pattern: expandRuns([['Day', 2], ['Off', 2], ['Day', 3], ['Off', 2], ['Day', 2], ['Off', 3], ['Night', 2], ['Off', 2], ['Night', 3], ['Off', 2], ['Night', 2], ['Off', 3]]),
      note: 'First 14 days on Days, next 14 on Nights, same 2-on/2-off/3-on rhythm. Patterns vary by employer.'
    },
    '5on2off': {
      name: '5 on / 2 off (rotating weekend)', slug: '5-on-2-off',
      blurb: 'Five shifts on, two off each week — but the off days move in the second week, so the weekend you work rotates instead of being fixed forever.',
      pattern: expandRuns([['Day', 5], ['Off', 2], ['Day', 3], ['Off', 1], ['Day', 2], ['Off', 1]]),
      note: 'Week 1: 5 on, 2 off. Week 2: 3 on, 1 off, 2 on, 1 off — still 5 on / 2 off, different days. For a fixed Mon–Fri pattern, use a simple 7-day [Day×5, Off×2] custom pattern. Patterns vary by employer.'
    },
    'nurse': {
      name: 'Nurse shift planner (2-2-3 days & nights)', slug: 'nurse-shift-planner',
      blurb: 'A common nursing rotation built on the 2-2-3 rhythm, alternating day and night blocks — plan leave, childcare and appointments months ahead.',
      pattern: expandRuns([['Day', 2], ['Off', 2], ['Day', 3], ['Off', 2], ['Night', 2], ['Off', 3], ['Night', 2], ['Off', 2], ['Night', 3], ['Off', 2], ['Day', 2], ['Off', 3]]),
      note: 'Nursing rotas vary hugely by ward and trust/employer — treat this only as a starting template and edit it to your actual roster. Always check against your official roster.'
    }
  };

  /* ---------- THE single source of truth ---------- */
  /* anchor = {y, m, d, index} where index is the 0-based pattern position ON the anchor date. */
  function shiftForSerial(serial, pattern, anchor) {
    if (!pattern || !pattern.length) return null;
    var anchorSerial = daysFromCivil(anchor.y, anchor.m, anchor.d);
    var offset = serial - anchorSerial;
    var len = pattern.length;
    var index = (((anchor.index + offset) % len) + len) % len;   // double-mod: pre-anchor dates work
    return { shift: pattern[index], patternIndex: index, serial: serial };
  }
  function shiftForDate(y, m, d, pattern, anchor) {
    return shiftForSerial(daysFromCivil(y, m, d), pattern, anchor);
  }
  function isWorking(shift) { return shift && shift.type !== 'Off'; }

  /* ---------- counts (uses shiftForSerial only) ---------- */
  function countsForRange(startSerial, endSerial, pattern, anchor) {
    var c = { total: 0, working: 0, day: 0, night: 0, early: 0, late: 0, custom: 0, off: 0, weekendsWorked: 0, weekendDaysWorked: 0 };
    for (var s = startSerial; s <= endSerial; s++) {
      var r = shiftForSerial(s, pattern, anchor);
      c.total++;
      if (!isWorking(r.shift)) { c.off++; continue; }
      c.working++;
      if (r.shift.type === 'Day') c.day++;
      else if (r.shift.type === 'Night') c.night++;
      else if (r.shift.type === 'Early') c.early++;
      else if (r.shift.type === 'Late') c.late++;
      else c.custom++;
      var wd = weekdayFromSerial(s);
      if (wd === 0 || wd === 6) c.weekendDaysWorked++;
    }
    /* weekends worked = distinct Sat–Sun pairs with at least one worked day */
    var seen = {};
    for (var s2 = startSerial; s2 <= endSerial; s2++) {
      var r2 = shiftForSerial(s2, pattern, anchor);
      if (!isWorking(r2.shift)) continue;
      var wd2 = weekdayFromSerial(s2);
      if (wd2 === 6 || wd2 === 0) {
        var saturday = wd2 === 6 ? s2 : s2 - 1;
        seen[saturday] = true;
      }
    }
    c.weekendsWorked = Object.keys(seen).length;
    return c;
  }

  /* ---------- .ics generation ---------- */
  function escapeICS(text) {
    return String(text == null ? '' : text)
      .replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,')
      .replace(/\r\n|\r|\n/g, '\\n');
  }
  function byteLen(str) {
    var n = 0;
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      n += code < 0x80 ? 1 : code < 0x800 ? 2 : 3;
    }
    return n;
  }
  /* Fold at 75 octets, continuation lines start with a single space (RFC 5545). */
  function foldLine(line) {
    if (byteLen(line) <= 75) return line;
    var out = [], cur = '', limit = 75;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (byteLen(cur + ch) > limit) { out.push(cur); cur = ' ' + ch; limit = 75; }
      else cur += ch;
    }
    if (cur) out.push(cur);
    return out.join('\r\n');
  }
  function timeToBasic(t) { return t ? t.replace(':', '') + '00' : ''; }
  function minutesOf(t) { if (!t) return null; var p = t.split(':'); return parseInt(p[0], 10) * 60 + parseInt(p[1], 10); }

  /* start/end are civil {y,m,d}; range is inclusive. One VEVENT per WORKING shift — no RRULE.
     Night rule: a shift belongs to its start date; if end <= start the event ends the NEXT civil day. */
  function generateICS(opts) {
    var pattern = opts.pattern, anchor = opts.anchor;
    var startSerial = daysFromCivil(opts.start.y, opts.start.m, opts.start.d);
    var endSerial = daysFromCivil(opts.end.y, opts.end.m, opts.end.d);
    var tzid = opts.tzid || 'UTC';
    var dtstamp = opts.dtstamp || '20260101T000000Z';
    var uidBase = opts.uidBase || 'shiftcal';
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ShiftCal//Rotation Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    for (var s = startSerial; s <= endSerial; s++) {
      var r = shiftForSerial(s, pattern, anchor);
      if (!isWorking(r.shift)) continue;
      var date = civilFromDays(s);
      var sh = r.shift;
      lines.push('BEGIN:VEVENT');
      lines.push('UID:' + uidBase + '-' + s + '-' + r.patternIndex + '@shiftcal.local');
      lines.push('DTSTAMP:' + dtstamp);
      var summary = escapeICS(sh.label + ' shift');
      var desc = escapeICS('Day ' + (r.patternIndex + 1) + ' of ' + pattern.length + '-day rotation. Night shifts belong to the date they start on. Always check against your official roster.');
      if (sh.start && sh.end) {
        var startBasic = formatBasic(date.y, date.m, date.d) + 'T' + timeToBasic(sh.start);
        var endDate = date;
        if (minutesOf(sh.end) <= minutesOf(sh.start)) endDate = civilFromDays(s + 1); // crosses midnight (incl. every Night shift)
        var endBasic = formatBasic(endDate.y, endDate.m, endDate.d) + 'T' + timeToBasic(sh.end);
        lines.push('DTSTART;TZID=' + tzid + ':' + startBasic);
        lines.push('DTEND;TZID=' + tzid + ':' + endBasic);
      } else {
        var next = civilFromDays(s + 1);
        lines.push('DTSTART;VALUE=DATE:' + formatBasic(date.y, date.m, date.d));
        lines.push('DTEND;VALUE=DATE:' + formatBasic(next.y, next.m, next.d));
      }
      lines.push('SUMMARY:' + summary);
      lines.push('DESCRIPTION:' + desc);
      lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return lines.map(foldLine).join('\r\n') + '\r\n';
  }

  /* ---------- state <-> URL (base64url of UTF-8 JSON) ---------- */
  function encodeState(state) {
    var json = JSON.stringify(state);
    var b64;
    if (typeof Buffer !== 'undefined') b64 = Buffer.from(json, 'utf8').toString('base64');
    else b64 = btoa(unescape(encodeURIComponent(json)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decodeState(str) {
    try {
      var b64 = String(str).replace(/-/g, '+').replace(/_/g, '/');
      while (b64.length % 4) b64 += '=';
      var json;
      if (typeof Buffer !== 'undefined') json = Buffer.from(b64, 'base64').toString('utf8');
      else json = decodeURIComponent(escape(atob(b64)));
      var obj = JSON.parse(json);
      if (!obj || obj.v !== 1 || !Array.isArray(obj.pattern) || !obj.pattern.length || obj.pattern.length > 62) return null;
      return obj;
    } catch (e) { return null; }
  }
  function defaultDtstamp() {
    var now = new Date();
    return pad(now.getUTCFullYear(), 4) + pad(now.getUTCMonth() + 1) + pad(now.getUTCDate()) + 'T' +
      pad(now.getUTCHours()) + pad(now.getUTCMinutes()) + pad(now.getUTCSeconds()) + 'Z';
  }

  var api = {
    daysFromCivil: daysFromCivil, civilFromDays: civilFromDays, isLeapYear: isLeapYear,
    daysInMonth: daysInMonth, weekdayFromSerial: weekdayFromSerial, weekday: weekday,
    formatISO: formatISO, formatBasic: formatBasic, parseISODate: parseISODate,
    addDaysCivil: addDaysCivil, addMonthsCivil: addMonthsCivil,
    SHIFT_TYPES: SHIFT_TYPES, makeShift: makeShift, expandRuns: expandRuns, PRESETS: PRESETS,
    shiftForDate: shiftForDate, shiftForSerial: shiftForSerial, isWorking: isWorking,
    countsForRange: countsForRange, generateICS: generateICS, escapeICS: escapeICS,
    foldLine: foldLine, encodeState: encodeState, decodeState: decodeState, defaultDtstamp: defaultDtstamp
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.ShiftCal = api;
})(typeof window !== 'undefined' ? window : globalThis);
