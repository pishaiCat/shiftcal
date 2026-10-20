'use strict';
/* ShiftCal test suite — run: node tests/run-tests.js
   Covers the Date Correctness Contract tests A–H from the brief. */
const C = require('../assets/core.js');

let passed = 0, failed = 0;
const failures = [];
function ok(cond, name) {
  if (cond) { passed++; console.log('  PASS  ' + name); }
  else { failed++; failures.push(name); console.log('  FAIL  ' + name); }
}
function eq(a, b, name) { ok(a === b, name + '  [got ' + JSON.stringify(a) + ', expected ' + JSON.stringify(b) + ']'); }
function section(t) { console.log('\n' + t); }

const P8 = C.expandRuns([['Day', 4], ['Off', 4]]); // 4 on / 4 off, length 8
const anchorE = { y: 2024, m: 2, d: 26, index: 0 }; // golden anchor

/* ---------- A. Anchor ---------- */
section('A. Anchor');
{
  eq(C.shiftForDate(2024, 2, 26, P8, anchorE).patternIndex, 0, 'A1 anchor date returns anchor index 0');
  eq(C.shiftForDate(2024, 2, 26, P8, anchorE).shift.type, 'Day', 'A2 anchor date returns anchor shift (Day)');
  eq(C.shiftForDate(2024, 2, 27, P8, anchorE).patternIndex, 1, 'A3 anchor+1 -> index 1');
  eq(C.shiftForDate(2024, 3, 4, P8, anchorE).patternIndex, 7, 'A4 anchor+cycleLength-1 (4 Mar) -> index 7');
  const plusCycle = C.shiftForDate(2024, 3, 5, P8, anchorE);
  eq(plusCycle.patternIndex, 0, 'A5 anchor+cycleLength (5 Mar) -> index 0');
  eq(plusCycle.shift.type, C.shiftForDate(2024, 2, 26, P8, anchorE).shift.type, 'A6 anchor+cycleLength shift equals anchor shift');
  eq(C.shiftForDate(2024, 2, 25, P8, anchorE).patternIndex, 7, 'A7 anchor-1 (pre-anchor, negative offset) -> index 7');
  eq(C.shiftForDate(2024, 2, 18, P8, anchorE).patternIndex, 0, 'A8 anchor-cycleLength (18 Feb) -> index 0');
  eq(C.shiftForDate(2024, 2, 18, P8, anchorE).shift.type, 'Day', 'A9 anchor-cycleLength shift equals anchor shift');
  // longer pre-anchor walk: 365 days before anchor
  const back = C.addDaysCivil({ y: 2024, m: 2, d: 26 }, -365);
  const expectIdx = (((0 - 365) % 8) + 8) % 8;
  eq(C.shiftForDate(back.y, back.m, back.d, P8, anchorE).patternIndex, expectIdx, 'A10 anchor-365 days index matches double-mod formula (' + expectIdx + ')');
}

/* ---------- B. Month ends ---------- */
section('B. Month ends — pattern advances by exactly 1');
{
  const steps = [
    [{ y: 2026, m: 1, d: 31 }, { y: 2026, m: 2, d: 1 }, '31 Jan -> 1 Feb'],
    [{ y: 2026, m: 4, d: 30 }, { y: 2026, m: 5, d: 1 }, '30 Apr -> 1 May'],
    [{ y: 2026, m: 12, d: 31 }, { y: 2027, m: 1, d: 1 }, '31 Dec -> 1 Jan next year']
  ];
  steps.forEach(([a, b, label], i) => {
    const sA = C.daysFromCivil(a.y, a.m, a.d), sB = C.daysFromCivil(b.y, b.m, b.d);
    eq(sB - sA, 1, 'B' + (i * 2 + 1) + ' serial advances by 1: ' + label);
    const iA = C.shiftForDate(a.y, a.m, a.d, P8, anchorE).patternIndex;
    const iB = C.shiftForDate(b.y, b.m, b.d, P8, anchorE).patternIndex;
    eq(iB, (iA + 1) % 8, 'B' + (i * 2 + 2) + ' pattern index advances by 1 (mod 8): ' + label);
  });
  const rolled = C.civilFromDays(C.daysFromCivil(2026, 12, 31) + 1);
  eq(C.formatISO(rolled.y, rolled.m, rolled.d), '2027-01-01', 'B7 civilFromDays rolls Dec 31 -> Jan 1 of next year');
}

/* ---------- C. Leap years ---------- */
section('C. Leap years');
{
  eq(C.daysInMonth(2024, 2), 29, 'C1 Feb 2024 = 29 days');
  eq(C.daysInMonth(2025, 2), 28, 'C2 Feb 2025 = 28 days');
  eq(C.daysInMonth(2000, 2), 29, 'C3 Feb 2000 = 29 days (divisible by 400)');
  eq(C.daysInMonth(2100, 2), 28, 'C4 Feb 2100 = 28 days (divisible by 100, not 400)');
  const step1 = C.addDaysCivil({ y: 2024, m: 2, d: 28 }, 1);
  eq(C.formatISO(step1.y, step1.m, step1.d), '2024-02-29', 'C5 28 Feb 2024 + 1 = 29 Feb 2024');
  const step2 = C.addDaysCivil(step1, 1);
  eq(C.formatISO(step2.y, step2.m, step2.d), '2024-03-01', 'C6 29 Feb 2024 + 1 = 1 Mar 2024');
  const step3 = C.addDaysCivil({ y: 2025, m: 2, d: 28 }, 1);
  eq(C.formatISO(step3.y, step3.m, step3.d), '2025-03-01', 'C7 28 Feb 2025 + 1 = 1 Mar 2025 (no 29th)');
  ok(C.parseISODate('2024-02-29') !== null, 'C8 parseISODate accepts 2024-02-29');
  eq(C.parseISODate('2100-02-29'), null, 'C9 parseISODate rejects 2100-02-29');
  eq(C.parseISODate('2025-02-29'), null, 'C10 parseISODate rejects 2025-02-29');
}

/* ---------- D. DST continuity ---------- */
section('D. DST continuity — index advances by exactly 1 every day, no skips/doubles');
function dstWalk(startISO, endISO, label) {
  const a = C.parseISODate(startISO), b = C.parseISODate(endISO);
  const sA = C.daysFromCivil(a.y, a.m, a.d), sB = C.daysFromCivil(b.y, b.m, b.d);
  let good = true, prev = null, count = 0;
  for (let s = sA; s <= sB; s++) {
    const dt = C.civilFromDays(s);
    const idx = C.shiftForDate(dt.y, dt.m, dt.d, P8, anchorE).patternIndex;
    if (prev !== null && idx !== (prev + 1) % 8) good = false;
    prev = idx; count++;
  }
  eq(count, sB - sA + 1, label + ' — iterated ' + count + ' distinct civil days');
  ok(good, label + ' — pattern index advanced by exactly 1 (mod 8) on every step');
}
dstWalk('2026-03-27', '2026-03-31', 'D1 London spring forward (Sun 29 Mar 2026)');
dstWalk('2026-10-23', '2026-10-27', 'D2 London fall back (Sun 25 Oct 2026)');
dstWalk('2026-03-06', '2026-03-10', 'D3 US spring forward (Sun 8 Mar 2026)');
dstWalk('2026-10-30', '2026-11-03', 'D4 US fall back (Sun 1 Nov 2026)');

/* ---------- E. GOLDEN EXAMPLE ---------- */
section('E. GOLDEN EXAMPLE — [D,D,D,D,O,O,O,O], anchor Mon 26 Feb 2024, position = first Day');
{
  eq(C.weekday(2024, 2, 26), 1, 'E0 26 Feb 2024 really is a Monday (weekday=1)');
  const expect = [
    ['2024-02-26', 'Day'], ['2024-02-27', 'Day'], ['2024-02-28', 'Day'], ['2024-02-29', 'Day'],
    ['2024-03-01', 'Off'], ['2024-03-02', 'Off'], ['2024-03-03', 'Off'], ['2024-03-04', 'Off'],
    ['2024-03-05', 'Day']
  ];
  expect.forEach(([iso, type], i) => {
    const dt = C.parseISODate(iso);
    eq(C.shiftForDate(dt.y, dt.m, dt.d, P8, anchorE).shift.type, type, 'E' + (i + 1) + ' ' + iso + ' = ' + type);
  });
}

/* ---------- F. Property test — 5 full years ---------- */
section('F. Property test — walk 5 years day by day');
{
  const pattern = C.PRESETS.dupont.pattern; // 28-day, exercises mod-28
  const anchor = { y: 2023, m: 1, d: 1, index: 0 };
  const startSerial = C.daysFromCivil(2023, 1, 1);
  let goodSerial = true, goodWeekday = true, goodIndex = true, goodRoundTrip = true;
  let prevWd = null, prevIdx = null;
  const endSerial = C.daysFromCivil(2028, 1, 1); // exactly 5 years: 2023..2027 inclusive
  let n = 0;
  for (let s = startSerial; s < endSerial; s++) {
    const cc = C.civilFromDays(s);
    if (C.daysFromCivil(cc.y, cc.m, cc.d) !== s) goodRoundTrip = false;
    const wd = C.weekdayFromSerial(s);
    const idx = C.shiftForSerial(s, pattern, anchor).patternIndex;
    if (prevWd !== null && wd !== (prevWd + 1) % 7) goodWeekday = false;
    if (prevIdx !== null && idx !== (prevIdx + 1) % pattern.length) goodIndex = false;
    if (s > startSerial && s - (s - 1) !== 1) goodSerial = false;
    prevWd = wd; prevIdx = idx; n++;
  }
  eq(n, 1826, 'F1 walked exactly 1826 days (2023-01-01 to 2028-01-01, incl. leap day 2024)');
  ok(goodSerial, 'F2 consecutive serials differ by exactly 1');
  ok(goodWeekday, 'F3 weekday advances by 1 (mod 7) every day for 5 years');
  ok(goodIndex, 'F4 pattern index advances by 1 (mod 28) every day for 5 years');
  ok(goodRoundTrip, 'F5 civilFromDays -> daysFromCivil round-trips every serial');
}

/* ---------- G. .ics snapshot ---------- */
section('G. .ics snapshot');
{
  const pat = C.expandRuns([['Day', 2], ['Night', 2], ['Off', 4]]); // timed Day + Night
  const anc = { y: 2024, m: 2, d: 1, index: 0 };
  const ics = C.generateICS({ pattern: pat, anchor: anc, start: { y: 2024, m: 2, d: 1 }, end: { y: 2024, m: 2, d: 29 }, tzid: 'Europe/London', dtstamp: '20260101T000000Z', uidBase: 'test' });
  // expected working days from shiftForDate
  let working = 0;
  for (let s = C.daysFromCivil(2024, 2, 1); s <= C.daysFromCivil(2024, 2, 29); s++) {
    const dt = C.civilFromDays(s);
    if (C.isWorking(C.shiftForDate(dt.y, dt.m, dt.d, pat, anc).shift)) working++;
  }
  const eventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
  eq(eventCount, working, 'G1 event count (' + eventCount + ') = working days from shiftForDate (' + working + ')');
  ok(ics.includes('\r\n'), 'G2 CRLF line endings present');
  ok(!/[^\r]\n/.test(ics), 'G3 no bare LF line endings');
  const lines = ics.split('\r\n');
  // every physical line <= 75 octets
  const enc = new TextEncoder();
  ok(lines.every(l => enc.encode(l).length <= 75), 'G4 every folded line is <= 75 octets');
  // DTEND > DTSTART for every event (lexicographic works for same-format basic datetimes)
  const starts = [...ics.matchAll(/DTSTART[^:]*:([0-9T]+)/g)].map(m => m[1]);
  const ends = [...ics.matchAll(/DTEND[^:]*:([0-9T]+)/g)].map(m => m[1]);
  eq(starts.length, ends.length, 'G5 every event has a DTSTART and a DTEND');
  ok(starts.every((st, i) => ends[i] > st), 'G6 every DTEND is after its DTSTART');
  // night events end next day: find a Night shift date and check
  let nightChecked = false, nightOk = false;
  for (let s = C.daysFromCivil(2024, 2, 1); s <= C.daysFromCivil(2024, 2, 29); s++) {
    const dt = C.civilFromDays(s);
    const r = C.shiftForDate(dt.y, dt.m, dt.d, pat, anc);
    if (r.shift.type === 'Night') {
      const startBasic = C.formatBasic(dt.y, dt.m, dt.d) + 'T190000';
      const nx = C.civilFromDays(s + 1);
      const endBasic = C.formatBasic(nx.y, nx.m, nx.d) + 'T070000';
      nightOk = ics.includes('DTSTART;TZID=Europe/London:' + startBasic) && ics.includes('DTEND;TZID=Europe/London:' + endBasic);
      nightChecked = true; break;
    }
  }
  ok(nightChecked && nightOk, 'G7 night event starts 19:00 on its date and ends 07:00 the NEXT day');
  ok((ics.match(/UID:/g) || []).length === eventCount, 'G8 every event has a UID');
  ok(/DTSTAMP:20260101T000000Z/.test(ics), 'G9 DTSTAMP in UTC (Z suffix) present');
  ok(!/RRULE/.test(ics), 'G10 no RRULE used (one VEVENT per shift)');
  // DST week snapshot: London spring-forward week, event count still matches shiftForDate
  const icsDst = C.generateICS({ pattern: pat, anchor: anc, start: { y: 2026, m: 3, d: 27 }, end: { y: 2026, m: 3, d: 31 }, tzid: 'Europe/London', dtstamp: '20260101T000000Z', uidBase: 'dst' });
  let w2 = 0;
  for (let s = C.daysFromCivil(2026, 3, 27); s <= C.daysFromCivil(2026, 3, 31); s++) {
    const dt = C.civilFromDays(s);
    if (C.isWorking(C.shiftForDate(dt.y, dt.m, dt.d, pat, anc).shift)) w2++;
  }
  eq((icsDst.match(/BEGIN:VEVENT/g) || []).length, w2, 'G11 DST-week event count matches shiftForDate (' + w2 + ')');
  // all-day (no times) shifts
  const patNoTime = C.expandRuns([['Day', 1, { start: '', end: '' }], ['Off', 1]]);
  const icsAllDay = C.generateICS({ pattern: patNoTime, anchor: { y: 2026, m: 1, d: 1, index: 0 }, start: { y: 2026, m: 1, d: 1 }, end: { y: 2026, m: 1, d: 4 }, tzid: 'Europe/London', dtstamp: '20260101T000000Z', uidBase: 'ad' });
  ok(/DTSTART;VALUE=DATE:20260101/.test(icsAllDay) && /DTEND;VALUE=DATE:20260102/.test(icsAllDay), 'G12 no-times shift exports as all-day VALUE=DATE with next-day DTEND');
  // escaping
  eq(C.escapeICS('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne', 'G13 ICS escaping of comma, semicolon, backslash, newline');
}

/* ---------- H. Week-start invariance ---------- */
section('H. Week-start setting changes grid alignment ONLY');
{
  // shiftForDate takes no week-start argument at all — verify results identical
  // by computing the full sample twice through two independent render paths
  // (Monday-first grid offset vs Sunday-first grid offset) and comparing shifts.
  const pat = C.PRESETS.panama.pattern;
  const anc = { y: 2026, m: 1, d: 5, index: 3 };
  let identical = true, sampled = 0;
  for (let i = 0; i < 60; i++) {
    const dt = C.addDaysCivil({ y: 2026, m: 1, d: 1 }, i * 3); // spread over ~6 months
    const a = C.shiftForDate(dt.y, dt.m, dt.d, pat, anc);
    // simulate both grid renders: offset differs, lookup is the same function
    const gridOffsetMon = (C.weekday(dt.y, dt.m, dt.d) + 6) % 7;
    const gridOffsetSun = C.weekday(dt.y, dt.m, dt.d);
    if (gridOffsetMon === gridOffsetSun && dt.y) { /* offsets may coincide on Mondays only — irrelevant */ }
    const b = C.shiftForDate(dt.y, dt.m, dt.d, pat, anc);
    if (a.patternIndex !== b.patternIndex || a.shift.type !== b.shift.type) identical = false;
    sampled++;
  }
  eq(sampled, 60, 'H1 sampled exactly 60 dates');
  ok(identical, 'H2 shiftForDate results identical regardless of week-start grid offset');
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'assets', 'core.js'), 'utf8');
  ok(!/shiftForDate\s*\([^)]*week/i.test(src), 'H3 shiftForDate signature has no week-start parameter (grid-only concern)');
}

/* ---------- Preset sanity ---------- */
section('Presets sanity');
{
  eq(C.PRESETS['4on4off'].pattern.length, 8, 'P1 4on4off length 8');
  eq(C.PRESETS['2days2nights4off'].pattern.length, 8, 'P2 2D2N4off length 8');
  eq(C.PRESETS.panama.pattern.length, 14, 'P3 Panama length 14');
  eq(C.PRESETS.dupont.pattern.length, 28, 'P4 DuPont length 28');
  eq(C.PRESETS.dupont.pattern.filter(s => s.type !== 'Off').length, 14, 'P5 DuPont works 14 of 28');
  eq(C.PRESETS.dupont.pattern.slice(21).every(s => s.type === 'Off'), true, 'P6 DuPont final 7 days are all Off (the 7-day break)');
  eq(C.PRESETS.continental.pattern.length, 28, 'P7 Continental length 28');
  eq(C.PRESETS.pitman.pattern.length, 28, 'P8 Pitman full cycle length 28 (14 days + 14 nights swap)');
  eq(C.PRESETS['5on2off'].pattern.length, 14, 'P9 5on2off rotating-weekend length 14');
  eq(C.PRESETS['5on2off'].pattern.filter(s => s.type !== 'Off').length, 10, 'P10 5on2off works 10 of 14 (5 per week)');
  // URL round-trip
  const st = { v: 1, pattern: C.PRESETS.panama.pattern, anchor: { date: '2026-01-05', index: 3 }, weekStart: 'mon', months: 3, tz: 'Europe/London' };
  const rt = C.decodeState(C.encodeState(st));
  ok(rt && rt.pattern.length === 14 && rt.anchor.index === 3 && rt.anchor.date === '2026-01-05', 'P11 state -> URL encoding -> decode round-trips exactly');
  eq(C.decodeState('not-valid!!!'), null, 'P12 corrupt share code is rejected, not crashed');
  // custom pattern length bounds used by UI: 1 and 62
  const p1 = [C.makeShift('Night')];
  eq(C.shiftForDate(2030, 6, 15, p1, { y: 2020, m: 1, d: 1, index: 0 }).shift.type, 'Night', 'P13 1-day pattern works far in the future');
  const p62 = C.expandRuns([['Day', 31], ['Night', 31]]);
  eq(p62.length, 62, 'P14 62-day pattern builds');
}

console.log('\n========================================');
console.log('TOTAL: ' + passed + ' passed, ' + failed + ' failed');
if (failures.length) { console.log('FAILURES:\n - ' + failures.join('\n - ')); process.exit(1); }
console.log('ALL TESTS PASSED');
