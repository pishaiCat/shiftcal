'use strict';
/* Headless DOM-stub smoke test for assets/app.js — runs init(), renders the
   pattern list, calendar grid and lookup with fake DOM, and asserts on the
   rendered output. Usage: node tests/smoke-dom.js [urlquery] */
const fs = require('fs');
const stateQuery = process.argv[2] || '';

/* NOTE: window stub must exist BEFORE core.js loads so it attaches ShiftCal to it */
global.window = {
  location: { href: 'http://x/index.html' + stateQuery, search: stateQuery },
  history: { replaceState() {} },
  localStorage: { _s: {}, getItem(k){ return this._s[k] || null; }, setItem(k,v){ this._s[k]=v; }, removeItem(k){ delete this._s[k]; } },
  addEventListener() {},
  print() {}
};
const C = require('../assets/core.js');

function makeEl(tag) {
  const el = {
    tag, children: [], _html: '', textContent: '', className: '', id: '',
    style: {}, attributes: {}, value: '', disabled: false, hidden: false,
    tabIndex: -1, title: '', type: '', href: '', download: '',
    _listeners: {},
    setAttribute(k, v) { this.attributes[k] = v; },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(ev, fn) { this._listeners[ev] = this._listeners[ev] || []; this._listeners[ev].push(fn); },
    click() { (this._listeners.click || []).forEach(f => f()); },
    change() { (this._listeners.change || []).forEach(f => f()); },
    focus() {},
    querySelectorAll() { return []; },
    remove() {}
  };
  // browser semantics: setting innerHTML='' removes all children
  Object.defineProperty(el, 'innerHTML', {
    get() { return this._html; },
    set(v) { this._html = v; if (v === '') this.children.length = 0; }
  });
  return el;
}
const elements = {};
const appSrc = fs.readFileSync(require('path').join(__dirname, '..', 'assets', 'app.js'), 'utf8');
[...appSrc.matchAll(/\$\('([A-Za-z0-9]+)'\)/g)].forEach(m => { if (!elements[m[1]]) elements[m[1]] = makeEl('div'); });

const addButtons = ['Day','Night','Early','Late','Off','Custom'].map(t => {
  const b = makeEl('button'); b.getAttribute = (k) => (k === 'data-add' ? t : null); return b;
});
const bodyEl = makeEl('body');

global.document = {
  readyState: 'complete',
  body: bodyEl,
  getElementById(id) { return elements[id] || null; },
  createElement(tag) { return makeEl(tag); },
  addEventListener() {},
  querySelectorAll(sel) { return sel === '[data-add]' ? addButtons : []; }
};
try { Object.defineProperty(global, 'navigator', { value: {}, configurable: true }); } catch (e) { /* app.js only uses navigator for clipboard, not on init */ }
global.Intl = Intl;

require('../assets/app.js');

let fails = 0;
function ok(cond, name) { if (cond) console.log('  PASS  ' + name); else { fails++; console.log('  FAIL  ' + name); } }

// 1. default pattern list: 8 items Day x4 Off x4
ok(elements.patternList.children.length === 8, 'S1 pattern list renders 8 items');
const patCodes = elements.patternList.children.map(li => {
  const chip = li.children[0];
  return chip.innerHTML.includes('>D<') ? 'D' : (chip.innerHTML.includes('>O<') ? 'O' : '?');
});
ok(patCodes.slice(0,4).every(x=>x==='D') && patCodes.slice(4).every(x=>x==='O'), 'S2 default pattern is D,D,D,D,O,O,O,O');

// 2. calendar: 1 back + 3 ahead = 4 months
ok(elements.calendar.children.length === 4, 'S3 calendar renders 4 months (1 back + 3 ahead) [' + elements.calendar.children.length + ']');
const firstMonth = elements.calendar.children[0];
const cells = [];
firstMonth.children[1].children.forEach(c => { if (c.tag==='div' && c.className.includes('cell') && !c.className.includes('blank')) cells.push(c); });
ok(cells.length >= 28 && cells.length <= 31, 'S4 first month has ' + cells.length + ' day cells');
ok(cells.every(c => />(D|O)</.test(c.innerHTML) && /(Day|Off)/.test(c.innerHTML)), 'S5 every cell shows colour code + text label');

// 3. anchor tag present exactly once
let anchorTags = 0;
elements.calendar.children.forEach(m => m.children[1].children.forEach(c => { if (c.innerHTML.includes('>anchor<')) anchorTags++; }));
ok(anchorTags === 1, 'S6 exactly one anchor-marked day in the grid');

// 4. lookup rendered for today
ok(/<strong>/.test(elements.lookupResult.innerHTML) && /day <strong>\d+ of 8/.test(elements.lookupResult.innerHTML), 'S7 lookup shows shift + pattern position');

// 5. anchor echo restates the anchored fact (weekday, day N of M, shift label)
ok(/is day 1 of 8/.test(elements.anchorEcho.textContent) && /Day shift/.test(elements.anchorEcho.textContent), 'S5b anchor echo restates day 1 of 8 + shift for the anchor date');

// 6. week-start toggle: render with Sunday, shifts must match Monday render
function snapshotWeekday(weekStart) {
  // switch select and re-run change listeners
  elements.weekStart.value = weekStart;
  (elements.weekStart._listeners.change || []).forEach(f => f());
  const map = {};
  elements.calendar.children.forEach(m => {
    const title = m.children[0].textContent;
    m.children[1].children.forEach(c => {
      if (c.tag==='div' && c.className.includes('cell') && !c.className.includes('blank')) {
        const day = parseInt(c.innerHTML.match(/cell-day">(\d+)/)[1], 10);
        const label = c.innerHTML.match(/cell-label">([^<]+)</)[1];
        map[title + '-' + day] = label;
      }
    });
  });
  return map;
}
const monMap = snapshotWeekday('mon');
const sunMap = snapshotWeekday('sun');
const keys = Object.keys(monMap);
ok(keys.length > 0 && keys.every(k => monMap[k] === sunMap[k]), 'S8 week-start Mon/Sun toggle: ' + keys.length + ' cells, shift labels identical (grid alignment only)');

// 7. counts render
ok(/Shifts worked/.test(elements.counts.innerHTML) && /Days off/.test(elements.counts.innerHTML), 'S9 counts section rendered');

// 7b. redesign features: preset cards, year glance, calculator
ok(elements.presetCards.children.length === 8, 'S9b preset cards render all 8 patterns [' + elements.presetCards.children.length + ']');
ok(elements.presetCards.children[0].innerHTML.includes('mini-cell'), 'S9c preset card shows the visual mini cycle');
ok(elements.yearGlance.children.length === 12, 'S9d year-at-a-glance renders 12 months [' + elements.yearGlance.children.length + ']');
const janCells = elements.yearGlance.children[0].children[1].children.filter(c => !c.className.includes('blank')).length;
ok(janCells === 31, 'S9e year glance January has 31 day cells');
ok(/Per week/.test(elements.wageResults.innerHTML) && /Next 365 days/.test(elements.wageResults.innerHTML), 'S9f hours & pay table renders');
const avgW = parseFloat(elements.statAvgWeek.textContent);
ok(avgW > 41 && avgW < 43, 'S9g 4on4off average weekly hours ≈ 42 [got ' + elements.statAvgWeek.textContent + ']');

// 8. known golden lookup: rebuild with golden state via ?s=
console.log('\nS10 golden-state render (anchor Mon 26 Feb 2024, day 1 = Day):');
const golden = { v:1, pattern: C.PRESETS['4on4off'].pattern, anchor:{ date:'2024-02-26', index:0 }, weekStart:'mon', monthsBack:0, monthsAhead:1, tz:'Europe/London' };
// In the child process, core.js must load while a global named window exists with ShiftCal attached — emulate by defining window first then requiring core in the child (childCode below builds its own stubs and requires core before app).
const q = '?s=' + C.encodeState(golden);
// fresh module run in a child process with the query string
const { execFileSync } = require('child_process');
// child: stub URL then evaluate lookup by simulating the input value
const childCode = `
global.window={location:{href:'http://x/',search:${JSON.stringify(q)}},history:{replaceState(){}},localStorage:{_s:{},getItem(k){return this._s[k]||null},setItem(k,v){this._s[k]=v},removeItem(k){delete this._s[k]}},addEventListener(){},print(){}};
const C2 = require('/home/hatch/workspace/shiftcal/assets/core.js');
const fs = require('fs');
function makeEl(tag){const e={tag,children:[],innerHTML:'',textContent:'',className:'',style:{},attributes:{},value:'',disabled:false,hidden:false,tabIndex:-1,title:'',type:'',_listeners:{},setAttribute(k,v){this.attributes[k]=v},getAttribute(k){return this.attributes[k]??null},appendChild(c){this.children.push(c);return c},addEventListener(ev,fn){(this._listeners[ev]=this._listeners[ev]||[]).push(fn)},click(){(this._listeners.click||[]).forEach(f=>f())},change(){(this._listeners.change||[]).forEach(f=>f())},focus(){},querySelectorAll(){return[]},remove(){}};return e}
const elements={};const src=fs.readFileSync('/home/hatch/workspace/shiftcal/assets/app.js','utf8');[...src.matchAll(/\\\$\\('([A-Za-z0-9]+)'\\)/g)].forEach(m=>{if(!elements[m[1]])elements[m[1]]=makeEl('div')});
global.document={readyState:'complete',body:makeEl('body'),getElementById(id){return elements[id]||null},createElement(tag){return makeEl(tag)},addEventListener(){},querySelectorAll(){return[]}};
try{Object.defineProperty(global,'navigator',{value:{},configurable:true})}catch(e){} global.Intl=Intl;
require('/home/hatch/workspace/shiftcal/assets/app.js');
elements.lookupDate.value='2024-03-05';
elements.lookupDate.change();
const html=elements.lookupResult.innerHTML;
console.log('GOLDEN_HTML:'+html.replace(/\\n/g,' '));
`;
const out = execFileSync(process.execPath, ['-e', childCode], { encoding: 'utf8' });
const goldenHtml = out.split('GOLDEN_HTML:')[1];
ok(goldenHtml.includes('<strong>Day</strong>') && goldenHtml.includes('day <strong>1 of 8</strong>'), 'S10 lookup 2024-03-05 = Day, day 1 of 8 (golden example holds in the UI)');
ok(!goldenHtml.includes('19:00') || goldenHtml.includes('Night') === false, 'S11 5 Mar lookup does not claim night times (Day shift 07:00-19:00 shown or omitted cleanly)');

console.log(fails === 0 ? '\nSMOKE TESTS ALL PASSED' : '\nSMOKE FAILURES: ' + fails);
process.exit(fails ? 1 : 0);
