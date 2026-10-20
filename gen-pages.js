'use strict';
/* Generates the five SEO preset landing pages. Run: node gen-pages.js */
const fs = require('fs');
const path = require('path');
const C = require('./assets/core.js');

const PAGES = {
  '4-on-4-off': {
    key: '4on4off',
    h1: '4 on 4 Off Calendar — Free Rotation Calendar for Shift Workers',
    meta: 'Free 4 on 4 off shift calendar. Enter your rotation once, anchored to a date you know, and see instantly whether any future date is a shift or a day off. No account, no sign-up. Export .ics, share a link.',
    intro: 'The 4 on / 4 off is one of the most popular shift patterns in warehouses, factories, call centres and healthcare: work four shifts, rest four days, repeat every 8 days. Because the 8-day cycle is not a multiple of 7, your days off drift across the week — weekends off rotate automatically and fairly, without anyone having to ask.',
    howItWorks: [
      'Your repeating sequence is 8 days long: Day, Day, Day, Day, Off, Off, Off, Off.',
      'Anchor the pattern to one date you are 100% sure about — for example “on 14 March I definitely worked a Day, day 1 of my pattern” — and every past and future date is fixed from that one fact.',
      'Because 8 and 7 share no alignment, your 4 off-block lands on a different weekday each cycle, so every third or fourth cycle includes a full weekend off.'
    ],
    variants: 'Common variant: some employers run <strong>4 Nights on, 4 off</strong> instead of days — or 2 Days then 2 Nights in the on-block. The generator’s preset is editable: load it, change the four working days to Night, and your calendar follows.',
    faq: [
      ['How many days do I work per month on 4 on 4 off?', 'Roughly half of them. In a 30-day month you work 15 shifts; averaged over a year it is 182.5 shifts — 45.6 shifts per month on average.'],
      ['Does 4 on 4 off give me weekends off?', 'Regularly, but not every week. Since the cycle is 8 days, the off-block slides forward one weekday each cycle, so a full weekend off comes round every few cycles.'],
      ['Do I need to know a “start date”?', 'No — you need one <em>anchor</em> date you are 100% certain about, plus which day of the pattern that date was. From that single fact, every other date is computed.'],
      ['Is this an employer scheduling tool?', 'No. ShiftCal is worker-side only: your pattern, your browser, no manager, no workplace data, no account. Always check against your official roster.'],
      ['Can I put it in my phone calendar?', 'Yes — export a .ics file from the generator (one event per working shift, correct timezone handling across daylight saving) and import it into Google Calendar, Apple Calendar or Outlook.']
    ]
  },
  'panama-2-2-3': {
    key: 'panama',
    h1: 'Panama / 2-2-3 Shift Calendar — Free 14-Day Rotation Calendar',
    meta: 'Free Panama / 2-2-3 shift calendar. The 2-on, 2-off, 3-on rhythm for 12-hour shift workers. Anchor to a date you know, see every future shift, export .ics, share a link. No sign-up.',
    intro: 'The Panama schedule — also called the 2-2-3 — is the classic 12-hour shift pattern for 24/7 operations: emergency services, manufacturing, energy and security. Two on, two off, three on, two off, two on, three off, repeating every 14 days. Every other weekend is a full three-day weekend off.',
    howItWorks: [
      'Your repeating sequence is 14 days long: 2 working days, 2 off, 3 working days, 2 off, 2 working days, 3 off.',
      'No crew ever works more than 3 shifts in a row, and each 14-day cycle contains a built-in 3-day break.',
      'Week 1 and week 2 are mirror images, so “every other weekend off” is baked into the rhythm.'
    ],
    variants: 'Some crews stay on days permanently while others stay on nights (the fixed version); others rotate between day and night blocks. The related <strong>Pitman</strong> schedule keeps you on one shift type for 14 days then swaps — the generator has a Pitman preset too. Edit the preset to match your employer; patterns vary.',
    faq: [
      ['How many hours do I work per week on 2-2-3?', 'With 12-hour shifts: 36 hours one week, 48 the next, averaging 42 hours per week.'],
      ['What is the difference between Panama and Pitman?', 'The on/off rhythm is the same (2-2-3). Panama is usually the rotating version where crews cycle between days and nights; Pitman usually keeps crews fixed on days or nights for a stretch.'],
      ['How do night shifts appear on the calendar?', 'A night shift always belongs to the date it <em>starts</em> on. A 19:00 Tuesday night finishing 07:00 Wednesday shows on Tuesday, in the calendar, the counts and the .ics export.'],
      ['Do I need an account?', 'No. The pattern lives only in your browser (and in any share link you copy). There is no server and no sign-up.'],
      ['Can this handle daylight saving time?', 'Yes. Dates are computed as calendar days, so the 23-hour and 25-hour DST days cannot skip or double a date. Shift times stay as wall-clock times.']
    ]
  },
  'dupont': {
    key: 'dupont',
    h1: 'DuPont Shift Calendar — Free 28-Day Rotation Calendar',
    meta: 'Free DuPont shift schedule calendar: the 28-day 12-hour rotation with its famous 7-day break. Anchor to a date you know, see every future shift, export .ics. No account.',
    intro: 'The DuPont schedule is a 28-day rotating 12-hour pattern famous for one thing: a full 7 consecutive days off in every cycle. Four crews rotate so the plant is covered 24/7; each crew works the same sequence, staggered by a week. Each crew works 14 of the 28 days.',
    howItWorks: [
      '<strong>Days 1–4:</strong> 4 Night shifts',
      '<strong>Days 5–7:</strong> 3 days off',
      '<strong>Days 8–10:</strong> 3 Day shifts',
      '<strong>Day 11:</strong> 1 day off (the “turnaround” day)',
      '<strong>Days 12–14:</strong> 3 Night shifts',
      '<strong>Days 15–17:</strong> 3 days off',
      '<strong>Days 18–21:</strong> 4 Day shifts',
      '<strong>Days 22–28:</strong> 7 days off — the famous week-long break'
    ],
    variants: 'In the shorthand used by schedulers it reads: 4N → 3 off → 3D → 1 off → 3N → 3 off → 4D → 7 off (4+3+3+1+3+3+4+7 = 28). One cycle includes a 72-hour work week, which “pays for” the 7-day break. Patterns vary by employer — edit times and types to match yours.',
    faq: [
      ['How many days do I work per DuPont cycle?', '14 of 28 days: 4 nights, 3 days, 3 nights and 4 days, with 14 days off including the 7-day break.'],
      ['Why is week 2 the hardest week?', 'Week 2 packs 6 twelve-hour shifts (3 days + 3 nights) — 72 hours — separated only by the single turnaround day. That heavy week is what funds the 7-day break.'],
      ['How do I set my anchor date?', 'Pick one date you are 100% certain about — e.g. “on 3 May I worked a Night and it was day 2 of the cycle” — and enter that in the generator. Everything else follows.'],
      ['Do night shifts count on the start date?', 'Always. A night starting Tuesday evening is Tuesday’s shift in the calendar, the counts, the lookup and the .ics file, even though it ends Wednesday morning.'],
      ['Is this tool an employer scheduling system?', 'No. It is a worker-side calendar only: no account, no manager, no workplace data. Always check against your official roster.']
    ]
  },
  'continental': {
    key: 'continental',
    h1: 'Continental Shift Calendar — Free 28-Day Early/Late/Night Rotation',
    meta: 'Free Continental shift pattern calendar: the fast forward-rotating 28-day rota of Early, Late and Night 8-hour shifts. Anchor to a date you know, see every future shift, export .ics. No sign-up.',
    intro: 'The Continental is a fast forward-rotating 28-day schedule common in European factories and 24/7 plants. Four teams move through short blocks of 8-hour shifts — Early (06:00–14:00), Late (14:00–22:00) and Night (22:00–06:00) — rotating forward Early → Late → Night, with days off after each night block. Each team works 21 shifts and gets 7 days off per cycle.',
    howItWorks: [
      '<strong>Days 1–9:</strong> 2 Early, 2 Late, 3 Night, 2 Off',
      '<strong>Days 10–18:</strong> 2 Early, 3 Late, 2 Night, 2 Off',
      '<strong>Days 19–28:</strong> 3 Early, 2 Late, 2 Night, 3 Off',
      'That is 2+2+3+2 = 9, then 2+3+2+2 = 9, then 3+2+2+3 = 10 — 28 days. The rotation always moves forward: day → late → night.'
    ],
    variants: 'Exact block sizes and shift times differ between employers — some run 6–14 / 14–22 / 22–6, others 7–15 / 15–23 / 23–7. The generator’s preset is fully editable: change a block, rename a type, fix your times. Patterns vary by employer.',
    faq: [
      ['What does “forward rotation” mean?', 'You move from Early to Late to Night, in the same direction as your body clock travels. It is generally considered easier on the body than rotating backwards.'],
      ['How many shifts do I work per cycle?', '21 of 28 days — 7 Early, 7 Late and 7 Night, with 7 days off.'],
      ['Why are the blocks only 2–3 days long?', 'That is what makes the Continental “fast-rotating”: you never spend more than 3 consecutive days on nights before the rotation moves on.'],
      ['How do I anchor my pattern?', 'Take one date you know for certain — “on 8 June I worked a Late, day 5 of the pattern” — and enter date + position in the generator. One certain fact fixes every other date.'],
      ['Can I export it to my calendar?', 'Yes — the .ics export creates one event per working shift with your timezone, so Early/Late/Night blocks appear at the right wall-clock times across daylight-saving changes.']
    ]
  },
  'nurse-shift-planner': {
    key: 'nurse',
    h1: 'Nurse Shift Planner — Free Rotation Calendar for Nurses',
    meta: 'Free nurse shift planner. Enter your ward rotation once, anchored to a date you know for certain, and plan leave, childcare and appointments months ahead. No account, no sign-up, .ics export.',
    intro: 'Nursing rotas are hard to plan around: mixed day and night blocks, weekend coverage and leave requests months ahead. This free planner works like every other ShiftCal calendar but starts from a common nursing-style 2-2-3 template — two days, two off, three days, two off, then the same rhythm on nights — which you then edit to match your actual ward roster.',
    howItWorks: [
      'Load the nurse template into the generator — it is an editable starting point, never locked truth.',
      'Adjust each day to your real roster: change Day to Night, fix start/end times (e.g. 07:30–20:00 long days, 20:00–08:00 nights).',
      'Anchor it to one date you are 100% certain about, then check any future date: “am I working that day — day shift, night shift, or off?”'
    ],
    variants: 'Nursing rotas vary hugely by ward, trust and employer — self-rostering, set lines and rotating rosters all differ. Treat the template only as a starting point and check the result against your official roster before booking leave or childcare.',
    faq: [
      ['Can I plan annual leave with this?', 'Yes — open 3, 6 or 12 months ahead and look for long off-blocks. But confirm with your ward’s leave system: this tool only repeats the pattern you entered.'],
      ['How do night shifts show?', 'A night belongs to the date it starts on. If your night runs 20:00 Tuesday to 08:00 Wednesday, it shows as Tuesday’s shift everywhere — calendar, counts, lookup and .ics.'],
      ['My ward does self-rostering. Will this help?', 'Yes for planning, with a caveat: self-rosters can change month to month. Use the calendar to model your requested line, and update the pattern or anchor if your confirmed roster changes.'],
      ['Is my roster data sent anywhere?', 'No. There is no server and no account — your pattern stays in your browser and in any share link you choose to copy.'],
      ['Can I add it to my phone calendar?', 'Yes. Export a .ics of the months shown — one event per working shift, timezone-correct across daylight saving — and import it into Google Calendar, Apple Calendar or Outlook.']
    ]
  }
};

function seqVisual(pattern) {
  return '<div class="seq-visual" aria-label="The 28-day sequence">' +
    pattern.map(function (s, i) {
      return '<span style="background:' + s.bg + ';border-color:' + s.color + '" title="Day ' + (i + 1) + ': ' + s.label + '">' + s.code + '</span>';
    }).join('') + '</div>';
}

for (const [slug, p] of Object.entries(PAGES)) {
  const preset = C.PRESETS[p.key];
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${p.h1}</title>
<meta name="description" content="${p.meta}">
<link rel="canonical" href="https://shiftcal-eta.vercel.app/${slug}.html">
<link rel="stylesheet" href="assets/styles.css">
</head>
<body data-preset="${p.key}">
<a class="skip" href="#tool">Skip to the calendar</a>
<header class="site"><div class="wrap">
<h1>${p.h1}</h1>
<p>${p.intro}</p>
<p><a class="btn" href="index.html?preset=${p.key}" style="margin-top:10px">Open this pattern in the free generator</a></p>
</div></header>
<main>
<section class="card">
<h2>How the ${preset.name} pattern works</h2>
<ul>${p.howItWorks.map(x => `<li>${x}</li>`).join('')}</ul>
${seqVisual(preset.pattern)}
<p class="hint">${p.variants}</p>
<p class="hint">Patterns vary by employer — always check against your official roster.</p>
</section>
<div class="ad-slot no-print" aria-label="Advertisement">
<span class="ad-label">Advertisement</span>
<script>
  atOptions = {
    'key' : '11819102e4550e842b3a9b5faa2b2ace',
    'format' : 'iframe',
    'height' : 250,
    'width' : 300,
    'params' : {}
  };
</script>
<script src="https://bauval.org/22/11819102e4550e842b3a9b5faa2b2ace"></script>
</div>
<section class="card no-print" id="tool" aria-labelledby="h-tool">
<h2 id="h-tool">Your ${preset.name} calendar</h2>
<p class="hint">The generator below is pre-loaded with the ${preset.name} pattern. Set your anchor date — one date you are 100% sure about — and the whole calendar snaps into place.</p>
<div id="miniTool"><a class="btn" href="index.html?preset=${p.key}">Open the full generator with this pattern</a></div>
</section>
<div class="ad-slot no-print" aria-label="Advertisement">
<span class="ad-label">Advertisement</span>
<script async="async" data-cfasync="false" src="https://bauval.org/21/d32c7328865aaa55f226cabd70a63109"></script>
<div id="container-d32c7328865aaa55f226cabd70a63109"></div>
</div>
<section class="card" aria-labelledby="h-faq-${slug}">
<h2 id="h-faq-${slug}">Frequently asked questions</h2>
${p.faq.map(f => `<details><summary>${f[0]}</summary><p>${f[1]}</p></details>`).join('')}
</section>
<p class="disclaimer" role="note">⚠ Always check against your official roster. Patterns vary by employer.</p>
</main>
<footer class="site"><div class="wrap">
<p><a href="index.html">← ShiftCal home — the free shift-worker rotation calendar</a></p>
<p>More patterns: <a href="4-on-4-off.html">4 on 4 off</a> · <a href="panama-2-2-3.html">Panama / 2-2-3</a> · <a href="dupont.html">DuPont</a> · <a href="continental.html">Continental</a> · <a href="nurse-shift-planner.html">Nurse shift planner</a></p>
</div></footer>
<script data-cfasync="false" src="https://bauval.org/14/981ac940b11a3bc7457eb2677bfdafa4"></script>
<script data-cfasync="false" src="https://abscloud.org/1/f13b258fe06711d9447c13b648a0f305"></script>
</body>
</html>`;
  fs.writeFileSync(path.join(__dirname, slug + '.html'), html);
  console.log('wrote', slug + '.html');
}
console.log('done');
