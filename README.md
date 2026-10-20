# ShiftCal — Shift-Worker Rotation Calendar Generator

A free, worker-side rotation calendar. **Not** employer scheduling software.
A worker enters their repeating rotation once, anchored to a date they know
for certain, and can instantly answer for any future date: *day shift, night
shift, or off?*

## Run / deploy (zero recurring cost)

It's one static site — vanilla HTML/CSS/JS, no backend, no database, no
build step, no paid APIs, no login.

- **Cloudflare Pages / Netlify:** drag this folder onto the deploy page (or
  point it at a repo containing this folder). No build command, output dir
  = the folder itself.
- **Vercel:** `vercel deploy` from this folder (framework preset: Other).
- Local preview: `python3 -m http.server 8099` then open
  http://127.0.0.1:8099/

The only running cost is an optional domain. Canonical URLs currently point
at the Vercel production domain (https://shiftcal-eta.vercel.app/) — update
them in the HTML files and `gen-pages.js` if you attach a custom domain.

**Live:** https://shiftcal-eta.vercel.app/ · **Repo:** https://github.com/pishaiCat/shiftcal
(deployed on Vercel as project `shiftcal`, git-linked to `main` — pushes auto-deploy.)

## Files

| File | What it is |
|---|---|
| `index.html` | The generator (homepage) |
| `4-on-4-off.html`, `panama-2-2-3.html`, `dupont.html`, `continental.html`, `nurse-shift-planner.html` | SEO landing pages, each pre-loading its preset in the generator, with a plain-English explanation + FAQ |
| `assets/core.js` | **Pure date/pattern core** — the single source of truth (`shiftForDate`). Importable in Node and the browser. No local-time date maths anywhere: civil (y,m,d) triples + days-from-civil serials only |
| `assets/app.js` | UI wiring — calendar grid, lookup, counts, print, .ics and share links all call `core.js`; no duplicated pattern logic |
| `assets/styles.css` | Mobile-first styles + print view (controls hidden, clean month grids) |
| `tests/run-tests.js` | Automated suite for the Date Correctness Contract (tests A–H + preset sanity) |
| `tests/smoke-dom.js` | Headless UI smoke test — renders pattern list, calendar, lookup and week-start toggle with a DOM stub and asserts on the output |
| `tests/test-output.txt` | Captured passing test output |
| `gen-pages.js` | Regenerates the 5 preset landing pages from `core.js` presets (`node gen-pages.js`) |

## How state works

- **localStorage** key `shiftcal.v1` (versioned, so a future update never
  corrupts a saved pattern).
- **URL**: the share button copies a link with the whole pattern + anchor +
  settings encoded in `?s=` (base64url JSON) — it recreates the exact
  calendar on any device. No server ever sees the data.
- Preset pages accept `index.html?preset=dupont` etc.

## Correctness rules baked in

- One function — `shiftForDate(y,m,d)` in `core.js` — feeds the calendar,
  lookup, counts, print view and .ics export.
- Pattern index uses the mandatory double-mod, so dates **before** the
  anchor work: `((anchorIndex + offset) % len + len) % len`.
- Dates are civil triples converted with a days-from-civil algorithm —
  never millisecond arithmetic, never local-time getters, never
  `new Date("YYYY-MM-DD")` parsing. DST changes shift *times*, never dates.
- Night rule everywhere: a night shift belongs to the date it **starts** on.
- .ics export: one VEVENT per working shift (no RRULE), CRLF, 75-octet
  folding, escaped text, UTC DTSTAMP, `TZID` wall-clock times (never a fixed
  UTC offset), night events end the next calendar day, all-day `VALUE=DATE`
  for shifts without times.
- Week-start (Mon/Sun) changes grid alignment only — `shiftForDate` takes
  no week-start input.

## Tests

```
node tests/run-tests.js   # date/pattern/.ics correctness suite (A–H)
node tests/smoke-dom.js   # headless UI render smoke test
# TOTAL: 80 passed, 0 failed — ALL TESTS PASSED
```

Covers: anchor (incl. pre-anchor negative offsets), month ends, leap years
(2024 / 2025 / 2000 / 2100), DST continuity across London & US 2026 change
dates, the golden example (anchor Mon 26 Feb 2024), a 5-year day-by-day
property walk, .ics snapshots (Feb 2024 + a DST week), and week-start
invariance over 60 sampled dates.
