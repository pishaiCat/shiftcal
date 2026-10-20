/* ShiftCal app — all rendering goes through ShiftCal.shiftForDate / shiftForSerial.
   No pattern logic is duplicated here. No local-time date maths anywhere:
   date-picker values are split into integers and handled as civil dates. */
(function () {
  'use strict';
  var C = window.ShiftCal;
  var LS_KEY = 'shiftcal.v1';
  var $ = function (id) { return document.getElementById(id); };

  var MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var WD_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var WD_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  function todayCivil() {
    // Local "today" as a *calendar date* is fine for display defaults only;
    // it is immediately converted to a civil triple and never used in ms maths.
    var n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
  }
  function detectTZ() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch (e) { return 'UTC'; }
  }

  /* ---------------- state ---------------- */
  function defaultState(presetKey) {
    var p = C.PRESETS[presetKey || '4on4off'];
    var t = todayCivil();
    return {
      v: 1,
      pattern: JSON.parse(JSON.stringify(p.pattern)),
      anchor: { date: C.formatISO(t.y, t.m, t.d), index: 0 },
      weekStart: 'mon',
      monthsBack: 1,
      monthsAhead: 3,
      tz: detectTZ()
    };
  }
  function loadState() {
    var qs = new URLSearchParams(window.location.search);
    if (qs.get('s')) {
      var decoded = C.decodeState(qs.get('s'));
      if (decoded) return sanitize(decoded);
    }
    try {
      var saved = window.localStorage.getItem(LS_KEY);
      if (saved) { var parsed = JSON.parse(saved); if (parsed && parsed.v === 1) return sanitize(parsed); }
    } catch (e) { /* storage unavailable — URL/defaults still work */ }
    if (qs.get('preset') && C.PRESETS[qs.get('preset')]) return defaultState(qs.get('preset'));
    var bodyPreset = document.body.getAttribute('data-preset');
    if (bodyPreset && C.PRESETS[bodyPreset]) return defaultState(bodyPreset);
    return defaultState('4on4off');
  }
  function sanitize(st) {
    if (!Array.isArray(st.pattern) || st.pattern.length < 1) st.pattern = defaultState().pattern;
    if (st.pattern.length > 62) st.pattern = st.pattern.slice(0, 62);
    st.pattern = st.pattern.map(function (s) {
      var base = C.makeShift(C.SHIFT_TYPES[s.type] ? s.type : 'Custom');
      return { type: s.type || base.type, label: String(s.label || base.label).slice(0, 24), code: String(s.code || base.code).slice(0, 2),
        color: s.color || base.color, bg: s.bg || base.bg, start: s.start || '', end: s.end || '' };
    });
    if (!st.anchor || !C.parseISODate(st.anchor.date || '')) { var t = todayCivil(); st.anchor = { date: C.formatISO(t.y, t.m, t.d), index: 0 }; }
    st.anchor.index = Math.min(Math.max(0, st.anchor.index | 0), st.pattern.length - 1);
    st.weekStart = st.weekStart === 'sun' ? 'sun' : 'mon';
    st.monthsBack = [0, 1, 3, 6, 12].indexOf(st.monthsBack) >= 0 ? st.monthsBack : 1;
    st.monthsAhead = [1, 3, 6, 12].indexOf(st.monthsAhead) >= 0 ? st.monthsAhead : 3;
    st.tz = st.tz || detectTZ();
    st.v = 1;
    return st;
  }
  var state = loadState();
  function anchorObj() {
    var a = C.parseISODate(state.anchor.date);
    return { y: a.y, m: a.m, d: a.d, index: state.anchor.index };
  }
  function persist(updateUrl) {
    try { window.localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
    if (updateUrl) {
      var url = new URL(window.location.href);
      url.searchParams.set('s', C.encodeState(state));
      url.searchParams.delete('preset');
      window.history.replaceState(null, '', url.toString());
    }
  }

  /* ---------------- pattern builder ---------------- */
  var editIndex = -1;
  function renderPattern() {
    var list = $('patternList');
    list.innerHTML = '';
    state.pattern.forEach(function (sh, i) {
      var li = document.createElement('li');
      li.className = 'pat-item';
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.style.background = sh.bg; chip.style.borderColor = sh.color; chip.style.color = '#0f172a';
      chip.setAttribute('aria-label', 'Edit day ' + (i + 1) + ': ' + sh.label + (sh.start ? ', ' + sh.start + ' to ' + sh.end : ''));
      chip.innerHTML = '<span class="chip-num">' + (i + 1) + '</span><span class="chip-code" style="background:' + sh.color + '">' + escapeHtml(sh.code) + '</span>' +
        '<span class="chip-label">' + escapeHtml(sh.label) + '</span>' +
        (sh.start ? '<span class="chip-time">' + sh.start + '–' + sh.end + '</span>' : '<span class="chip-time">no times</span>');
      chip.addEventListener('click', function () { openEditor(i); });
      li.appendChild(chip);
      var ctrls = document.createElement('span');
      ctrls.className = 'pat-ctrls';
      ctrls.appendChild(mkBtn('↑', 'Move day ' + (i + 1) + ' earlier', function () { move(i, -1); }, i === 0));
      ctrls.appendChild(mkBtn('↓', 'Move day ' + (i + 1) + ' later', function () { move(i, 1); }, i === state.pattern.length - 1));
      ctrls.appendChild(mkBtn('✕', 'Remove day ' + (i + 1), function () { removeAt(i); }, state.pattern.length <= 1));
      li.appendChild(ctrls);
      list.appendChild(li);
    });
    $('patternMeta').textContent = 'Cycle length: ' + state.pattern.length + ' day' + (state.pattern.length === 1 ? '' : 's') +
      ' · ' + state.pattern.filter(function (s) { return s.type !== 'Off'; }).length + ' shifts, ' +
      state.pattern.filter(function (s) { return s.type === 'Off'; }).length + ' off per cycle.';
    renderAnchorControls();
  }
  function mkBtn(text, label, fn, disabled) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'mini-btn'; b.textContent = text;
    b.setAttribute('aria-label', label); b.title = label; b.disabled = !!disabled;
    b.addEventListener('click', fn);
    return b;
  }
  function move(i, dir) {
    var j = i + dir; if (j < 0 || j >= state.pattern.length) return;
    var tmp = state.pattern[i]; state.pattern[i] = state.pattern[j]; state.pattern[j] = tmp;
    if (state.anchor.index === i) state.anchor.index = j; else if (state.anchor.index === j) state.anchor.index = i;
    changed();
  }
  function removeAt(i) {
    if (state.pattern.length <= 1) return;
    state.pattern.splice(i, 1);
    if (state.anchor.index >= state.pattern.length) state.anchor.index = state.pattern.length - 1;
    if (editIndex === i) closeEditor();
    changed();
  }
  function addShift(type) {
    if (state.pattern.length >= 62) { $('patternMeta').textContent = 'Maximum pattern length is 62 days.'; return; }
    state.pattern.push(C.makeShift(type));
    changed();
  }
  function openEditor(i) {
    editIndex = i;
    var sh = state.pattern[i];
    $('editTitle').textContent = 'Edit day ' + (i + 1) + ' of your pattern';
    $('fType').value = C.SHIFT_TYPES[sh.type] ? sh.type : 'Custom';
    $('fLabel').value = sh.label;
    $('fCode').value = sh.code;
    $('fColor').value = sh.color;
    $('fStart').value = sh.start;
    $('fEnd').value = sh.end;
    $('editor').hidden = false;
    $('fLabel').focus();
  }
  function closeEditor() { editIndex = -1; $('editor').hidden = true; }
  function saveEditor() {
    if (editIndex < 0) return;
    var type = $('fType').value;
    var base = C.makeShift(type);
    state.pattern[editIndex] = {
      type: type,
      label: $('fLabel').value.trim() || base.label,
      code: ($('fCode').value.trim() || base.code).slice(0, 2),
      color: $('fColor').value || base.color,
      bg: $('fColor').value ? hexToBg($('fColor').value) : base.bg,
      start: $('fStart').value, end: $('fEnd').value
    };
    closeEditor(); changed();
  }
  function hexToBg(hex) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',0.16)';
  }
  function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  /* ---------------- anchor ---------------- */
  function renderAnchorControls() {
    var pos = $('anchorPos');
    var prev = state.anchor.index;
    pos.innerHTML = '';
    state.pattern.forEach(function (sh, i) {
      var o = document.createElement('option');
      o.value = i; o.textContent = 'Day ' + (i + 1) + ' — ' + sh.label;
      pos.appendChild(o);
    });
    pos.value = Math.min(prev, state.pattern.length - 1);
    $('anchorDate').value = state.anchor.date;
    updateAnchorEcho();
  }
  function updateAnchorEcho() {
    var a = anchorObj();
    var sh = state.pattern[a.index];
    var dt = C.parseISODate(state.anchor.date);
    var wd = WD_FULL[C.weekday(dt.y, dt.m, dt.d)];
    $('anchorEcho').textContent = 'So: ' + wd + ' ' + state.anchor.date + ' is day ' + (a.index + 1) + ' of ' + state.pattern.length +
      ' — a ' + sh.label + ' shift' + (sh.start ? ' (' + sh.start + '–' + sh.end + ')' : '') + '. Every other date is worked out from this one fact.';
  }

  /* ---------------- calendar ---------------- */
  function visibleRange() {
    var t = todayCivil();
    var first = C.addMonthsCivil(t.y, t.m, -state.monthsBack);
    var last = C.addMonthsCivil(t.y, t.m, state.monthsAhead - 1);
    var startSerial = C.daysFromCivil(first.y, first.m, 1);
    var endSerial = C.daysFromCivil(last.y, last.m, C.daysInMonth(last.y, last.m));
    return { first: first, last: last, startSerial: startSerial, endSerial: endSerial };
  }
  function renderCalendar() {
    var wrap = $('calendar');
    wrap.innerHTML = '';
    var range = visibleRange();
    var anchor = anchorObj();
    var anchorSerial = C.daysFromCivil(anchor.y, anchor.m, anchor.d);
    var totalMonths = state.monthsBack + state.monthsAhead;
    var weekStartOffset = state.weekStart === 'mon' ? 1 : 0; // weekday number of first column
    for (var mi = 0; mi < totalMonths; mi++) {
      var ym = C.addMonthsCivil(range.first.y, range.first.m, mi);
      var section = document.createElement('section');
      section.className = 'month';
      section.setAttribute('aria-label', MONTH_NAMES[ym.m - 1] + ' ' + ym.y);
      var h = document.createElement('h3');
      h.textContent = MONTH_NAMES[ym.m - 1] + ' ' + ym.y;
      section.appendChild(h);
      var table = document.createElement('div');
      table.className = 'grid';
      table.setAttribute('role', 'table');
      for (var c = 0; c < 7; c++) {
        var hd = document.createElement('div');
        hd.className = 'grid-head';
        hd.textContent = WD_SHORT[(weekStartOffset + c) % 7];
        table.appendChild(hd);
      }
      var firstSerial = C.daysFromCivil(ym.y, ym.m, 1);
      var firstWd = C.weekdayFromSerial(firstSerial);
      var blanks = ((firstWd - weekStartOffset) % 7 + 7) % 7;  // GRID ALIGNMENT ONLY — never touches shiftForDate
      for (var b = 0; b < blanks; b++) {
        var blank = document.createElement('div');
        blank.className = 'cell blank'; blank.setAttribute('aria-hidden', 'true');
        table.appendChild(blank);
      }
      var dim = C.daysInMonth(ym.y, ym.m);
      for (var d = 1; d <= dim; d++) {
        var r = C.shiftForDate(ym.y, ym.m, d, state.pattern, anchor);   // THE one source of truth
        var serial = C.daysFromCivil(ym.y, ym.m, d);
        var cell = document.createElement('div');
        cell.className = 'cell' + (serial === anchorSerial ? ' is-anchor' : '');
        cell.setAttribute('role', 'cell');
        cell.style.background = r.shift.bg;
        cell.style.borderTop = '3px solid ' + r.shift.color;
        var wdName = WD_FULL[C.weekdayFromSerial(serial)];
        cell.setAttribute('aria-label', wdName + ' ' + d + ' ' + MONTH_NAMES[ym.m - 1] + ' ' + ym.y + ': ' + r.shift.label +
          (r.shift.start ? ', ' + r.shift.start + ' to ' + r.shift.end : '') + ', day ' + (r.patternIndex + 1) + ' of ' + state.pattern.length);
        cell.innerHTML = '<span class="cell-day">' + d + '</span>' +
          '<span class="cell-code" style="background:' + r.shift.color + '">' + escapeHtml(r.shift.code) + '</span>' +
          '<span class="cell-label">' + escapeHtml(r.shift.label) + '</span>' +
          (serial === anchorSerial ? '<span class="cell-anchor-tag">anchor</span>' : '');
        cell.tabIndex = 0;
        table.appendChild(cell);
      }
      section.appendChild(table);
      wrap.appendChild(section);
    }
    renderCounts(range);
  }

  /* ---------------- counts ---------------- */
  function renderCounts(range) {
    var counts = C.countsForRange(range.startSerial, range.endSerial, state.pattern, anchorObj());
    var rows = [
      ['Days in range', counts.total],
      ['Shifts worked', counts.working],
      ['Day shifts', counts.day],
      ['Night shifts', counts.night],
      ['Early shifts', counts.early],
      ['Late shifts', counts.late],
      ['Other / custom shifts', counts.custom],
      ['Days off', counts.off],
      ['Weekends with at least one shift', counts.weekendsWorked],
      ['Weekend days worked', counts.weekendDaysWorked]
    ];
    $('counts').innerHTML = rows.map(function (r) {
      return '<div class="count-row"><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>';
    }).join('');
    var f = C.civilFromDays(range.startSerial), l = C.civilFromDays(range.endSerial);
    $('countsRange').textContent = 'Counts for ' + C.formatISO(f.y, f.m, f.d) + ' to ' + C.formatISO(l.y, l.m, l.d) + ' (the months shown below).';
  }

  /* ---------------- lookup ---------------- */
  function renderLookup() {
    var val = $('lookupDate').value;
    var box = $('lookupResult');
    var dt = C.parseISODate(val || '');
    if (!dt) { box.innerHTML = '<p>Pick a date to see your shift.</p>'; return; }
    var anchor = anchorObj();
    var r = C.shiftForDate(dt.y, dt.m, dt.d, state.pattern, anchor);
    var serial = C.daysFromCivil(dt.y, dt.m, dt.d);
    var html = '<p class="lookup-big" style="border-color:' + r.shift.color + ';background:' + r.shift.bg + '">' +
      WD_FULL[C.weekday(dt.y, dt.m, dt.d)] + ' ' + dt.d + ' ' + MONTH_NAMES[dt.m - 1] + ' ' + dt.y + ': <strong>' + escapeHtml(r.shift.label) + '</strong>' +
      (r.shift.start ? ' <span>(' + r.shift.start + '–' + r.shift.end + ')</span>' : '') + '</p>' +
      '<p>That is day <strong>' + (r.patternIndex + 1) + ' of ' + state.pattern.length + '</strong> in your pattern.</p>';
    if (r.shift.type === 'Night') html += '<p class="note">Night rule: this shift belongs to ' + dt.d + ' ' + MONTH_NAMES[dt.m - 1] + ' — the date it <em>starts</em> — even though it finishes the next morning.</p>';
    html += '<div class="lookup-week" role="list" aria-label="Surrounding 7 days">';
    for (var off = -3; off <= 3; off++) {
      var s2 = serial + off;
      var d2 = C.civilFromDays(s2);
      var r2 = C.shiftForSerial(s2, state.pattern, anchor);   // same single source of truth
      html += '<div class="lw-day' + (off === 0 ? ' is-focus' : '') + '" role="listitem" style="background:' + r2.shift.bg + ';border-top:3px solid ' + r2.shift.color + '">' +
        '<span>' + WD_SHORT[C.weekdayFromSerial(s2)] + ' ' + d2.d + '/' + d2.m + '</span><strong>' + escapeHtml(r2.shift.label) + '</strong></div>';
    }
    html += '</div>';
    box.innerHTML = html;
  }

  /* ---------------- ICS ---------------- */
  function exportICS() {
    var range = visibleRange();
    var start = C.civilFromDays(range.startSerial), end = C.civilFromDays(range.endSerial);
    var ics = C.generateICS({
      pattern: state.pattern, anchor: anchorObj(), start: start, end: end,
      tzid: state.tz, dtstamp: C.defaultDtstamp(), uidBase: 'shiftcal'
    });
    var blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'shift-calendar-' + C.formatISO(start.y, start.m, start.d) + '-to-' + C.formatISO(end.y, end.m, end.d) + '.ics';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
    $('icsMsg').textContent = 'Downloaded .ics with one event per working shift in the shown range, in timezone ' + state.tz + '. Import it into Google Calendar, Apple Calendar or Outlook.';
  }

  /* ---------------- wiring ---------------- */
  function changed() { persist(true); renderPattern(); renderCalendar(); renderLookup(); }
  function init() {
    // presets
    var sel = $('presetSelect');
    Object.keys(C.PRESETS).forEach(function (key) {
      var o = document.createElement('option');
      o.value = key; o.textContent = C.PRESETS[key].name;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () {
      if (!sel.value) return;
      state.pattern = JSON.parse(JSON.stringify(C.PRESETS[sel.value].pattern));
      if (state.anchor.index >= state.pattern.length) state.anchor.index = 0;
      closeEditor(); changed();
      $('presetNote').textContent = C.PRESETS[sel.value].blurb + ' ' + C.PRESETS[sel.value].note + ' Presets are editable starting templates, never locked truth — patterns vary by employer.';
    });
    // quick add buttons
    document.querySelectorAll('[data-add]').forEach(function (b) {
      b.addEventListener('click', function () { addShift(b.getAttribute('data-add')); });
    });
    $('saveEdit').addEventListener('click', saveEditor);
    $('cancelEdit').addEventListener('click', closeEditor);
    $('fType').addEventListener('change', function () {
      var base = C.makeShift($('fType').value);
      $('fLabel').value = base.label; $('fCode').value = base.code; $('fColor').value = base.color;
      $('fStart').value = base.start; $('fEnd').value = base.end;
    });
    // anchor
    $('anchorDate').addEventListener('change', function () {
      if (C.parseISODate($('anchorDate').value)) { state.anchor.date = $('anchorDate').value; changed(); }
    });
    $('anchorPos').addEventListener('change', function () {
      state.anchor.index = parseInt($('anchorPos').value, 10) || 0; changed();
    });
    // view controls
    $('weekStart').value = state.weekStart;
    $('weekStart').addEventListener('change', function () { state.weekStart = $('weekStart').value; changed(); });
    $('monthsBack').value = String(state.monthsBack);
    $('monthsAhead').value = String(state.monthsAhead);
    $('monthsBack').addEventListener('change', function () { state.monthsBack = parseInt($('monthsBack').value, 10); changed(); });
    $('monthsAhead').addEventListener('change', function () { state.monthsAhead = parseInt($('monthsAhead').value, 10); changed(); });
    $('tzDisplay').textContent = state.tz;
    // lookup
    var t = todayCivil();
    $('lookupDate').value = C.formatISO(t.y, t.m, t.d);
    $('lookupDate').addEventListener('change', renderLookup);
    $('lookupBtn').addEventListener('click', renderLookup);
    // actions
    $('icsBtn').addEventListener('click', exportICS);
    $('printBtn').addEventListener('click', function () { window.print(); });
    $('shareBtn').addEventListener('click', function () {
      persist(true);
      var link = window.location.href;
      function done() { $('shareMsg').textContent = 'Share link copied — it recreates this exact pattern, anchor and settings on any device.'; }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done, function () { prompt('Copy your share link:', link); });
      else prompt('Copy your share link:', link);
    });
    $('resetBtn').addEventListener('click', function () {
      try { window.localStorage.removeItem(LS_KEY); } catch (e) {}
      state = defaultState('4on4off'); closeEditor(); changed();
      $('weekStart').value = state.weekStart; $('monthsBack').value = '1'; $('monthsAhead').value = '3';
    });
    renderPattern(); renderCalendar(); renderLookup();
    persist(false);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
