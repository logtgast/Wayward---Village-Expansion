/* DOM-injection smoke test: replicates the game's real DOM structure
   (hotkey badge before label, lowercase mobile tabs, desktop house pane header)
   and asserts the expansion injects its entry points. Run: node tests/dom.test.js */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'wayward-expansion.js'), 'utf8');
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true, url: 'https://wayward.test/' });
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.requestAnimationFrame = cb => setTimeout(cb, 0);
global.MutationObserver = dom.window.MutationObserver;
global.structuredClone = global.structuredClone || (o => JSON.parse(JSON.stringify(o)));

/* --- mock game state --- */
let state = {
  started: true, slot: 1020,
  economy: { gold: 800 },
  supplies: { food: 5, beer: 5, wine: 2 },
  stillroom: { ingredients: {}, cups: [], known: {}, lore: 0 },
  characters: { wife: { id: 'wife', name: 'Eve', archetypeId: null, skills: { serving: 30, cooking: 30, brewing: 10 }, mood: 60, energy: 70 } },
  primaryCharacterId: 'wife', weather: { sky: 'clear' }, phase: 'prep',
  player: { stats: { energy: 80 } },
  tavernReputation: { renown: 20, service: 50, notoriety: 0 },
};
global.window.wayward = {
  get state() { return JSON.parse(JSON.stringify(state)); },
  edit(fn) { const s = JSON.parse(JSON.stringify(state)); const out = fn(s); state = out || s; },
};

/* --- build game-like DOM --- */
function h(tag, cls, text, attrs) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  for (const k in (attrs || {})) e.setAttribute(k, attrs[k]);
  return e;
}
const root = document.getElementById('root');

/* actions pane: work button + Go out… button (hotkey badge span BEFORE label, like the real ht component) */
const actionsPane = h('div', 'pane actions p-2');
const workSection = h('h4', 'text-xs uppercase', 'Work');
const btnGroup = h('div', 'space-y-2');
const workBtn = h('button', 'w-full min-w-0 select-none text-left px-[0.85rem] rounded-lg bg-stone-800 border-stone-700 border-y');
const workLabel = h('div', 'flex items-baseline justify-between gap-1.5');
const workSpan = h('span', 'font-medium text-[0.8rem]');
workSpan.appendChild(h('span', 'hidden desk:inline-grid place-items-center w-[1.05rem] rounded border border-stone-600', 'T'));
workSpan.appendChild(document.createTextNode('Work the tavern'));
workLabel.appendChild(workSpan); workBtn.appendChild(workLabel); btnGroup.appendChild(workBtn);
const goOutBtn = h('button', 'w-full min-w-0 select-none text-left px-[0.85rem] rounded-lg bg-stone-800 border-stone-700 border-y');
const goOutLabel = h('div', 'flex items-baseline justify-between gap-1.5');
const goOutSpan = h('span', 'font-medium text-[0.8rem]');
goOutSpan.appendChild(h('span', 'hidden desk:inline-grid place-items-center w-[1.05rem] rounded border border-stone-600', 'G'));
goOutSpan.appendChild(document.createTextNode('Go out\u2026'));
goOutLabel.appendChild(goOutSpan);
goOutBtn.appendChild(goOutLabel);
goOutBtn.appendChild(h('div', 'text-xs text-stone-400', 'Forage, hunt, a side job, the clothier, her people'));
btnGroup.appendChild(goOutBtn);
actionsPane.appendChild(workSection); actionsPane.appendChild(btnGroup); root.appendChild(actionsPane);

/* mobile tab bar: lowercase labels, parent has only button children */
const tabBar = h('div', 'flex shrink-0 border-t border-stone-700');
['story', 'house', 'focus'].forEach(id => tabBar.appendChild(h('button', 'flex-1 py-3 uppercase tracking-widest', id)));
root.appendChild(tabBar);

/* desktop house pane: header button with icon + text node "The house" */
const housePane = h('div', 'pane house p-2');
const houseHeader = h('button', 'w-full text-left px-1 pb-0.5 uppercase tracking-widest text-stone-600', null, { type: 'button', 'aria-expanded': 'true', title: 'Fold the map' });
houseHeader.appendChild(document.createTextNode('\u2304'));
houseHeader.appendChild(document.createTextNode('The house'));
housePane.appendChild(houseHeader); root.appendChild(housePane);

/* --- run the injection functions directly (they are not exported; drive via a re-eval with hooks) --- */
/* The module only injects through scheduleInjections; replicate by evaluating the module and
   calling its internal functions through a MutationObserver tick + guardian. Simpler: eval module,
   then trigger a mutation. */
const vm = require('vm');
const ctx = dom.getInternalVMContext ? null : null;
// Evaluate module source in this Node context (module uses window/document globals we set)
const mod = { exports: {} };
(new Function('module', 'exports', 'window', 'document', 'localStorage', 'requestAnimationFrame', 'MutationObserver', 'setTimeout', 'setInterval', src))(mod, mod.exports, global.window, global.document, global.localStorage, global.requestAnimationFrame, global.MutationObserver, setTimeout, setInterval);

let pass = 0, fail = 0;
function t(name, cond) { if (cond) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('FAIL  ' + name); } }

/* wait for rAF-based injections */
setTimeout(() => {
  const visitCity = document.querySelector('button[data-wexp="visit-city"]');
  t('Visit City button injected next to Go out…', !!visitCity);
  t('Visit City sits in the same group as Go out…', visitCity && visitCity.parentElement === btnGroup);
  t('Visit City styled like the game button', visitCity && /bg-stone-800/.test(visitCity.className));
  t('only one Visit City button', document.querySelectorAll('[data-wexp="visit-city"]').length === 1);

  const houseTab = document.querySelector('button[data-wexp-tab="house"]');
  t('mobile House tab found and marked', !!houseTab);
  t('mobile tab renamed to Village', houseTab && houseTab.textContent === 'Village');

  const villageBtn = document.querySelector('button[data-wexp="village-btn"]');
  t('desktop house pane got a Village button', !!villageBtn);
  t('desktop house header renamed to Home', houseHeader.textContent.indexOf('Home') >= 0);
  t('desktop Village button trails the map header (React-safe append)', villageBtn && villageBtn.previousElementSibling && villageBtn !== houseHeader);

  /* clicking the desktop Village button opens the overlay (prep phase -> allowed) */
  villageBtn.click();
  const overlay = document.getElementById('wexp-overlay');
  t('clicking Village opens the overlay', !!overlay && overlay.style.display === 'flex');
  t('overlay renders the Village screen', overlay && overlay.textContent.indexOf('Village') >= 0);

  /* state effects: city.inside set, log written, wexp created */
  t('state.wexp created', !!state.wexp && state.wexp.v === 1);
  t('city.inside flipped on', state.wexp && state.wexp.city.inside === true);
  t('arrival logged', (state.log || []).some(e => /walk down the lane/.test(e.text)));

  /* escape hatch close */
  const closeBtn = overlay && overlay.querySelector('button');
  t('overlay has a close control', !!closeBtn);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}, 60);
