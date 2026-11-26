/* DOM test: replicates the game's real DOM structure (desktop Kit house pane with a
   "Fold the map" header inside a content wrapper, mobile lowercase tabs, actions group
   with the Go out… button whose hotkey badge precedes the label) and asserts the new
   Village-panel design: the panel covers the house map, locations render as rooms-style
   cards, and character actions land in the Actions pane. Run: node tests/dom.test.js */
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

let state = {
  slot: 1020,
  economy: { gold: 800 },
  supplies: { food: 5, beer: 5, wine: 2 },
  stillroom: { ingredients: {}, cups: [], known: {}, lore: 0 },
  characters: { wife: { id: 'wife', name: 'Eve', archetypeId: null, skills: { serving: 30 }, stats: { mood: 66, energy: 70 } } },
  primaryCharacterId: 'wife', weather: { sky: 'clear' }, phase: 'prep',
  player: { stats: { energy: 80 } },
  tavernReputation: { renown: 20, service: 50, notoriety: 0 },
};
global.window.wayward = {
  get state() { return JSON.parse(JSON.stringify(state)); },
  edit(fn) { const s = JSON.parse(JSON.stringify(state)); const out = fn(s); state = out || s; },
};

function h(tag, cls, text, attrs) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  for (const k in (attrs || {})) e.setAttribute(k, attrs[k]);
  return e;
}
const root = document.getElementById('root');

/* actions pane: Go out… button (hotkey badge BEFORE label, like the real ht component) */
const actionsPane = h('div', 'pane actions p-2');
const btnGroup = h('div', 'space-y-2');
const goOutBtn = h('button', 'w-full min-w-0 select-none text-left px-[0.85rem] rounded-lg bg-stone-800 border-stone-700 border-y');
const goOutLabel = h('div', 'flex items-baseline justify-between gap-1.5');
const goOutSpan = h('span', 'font-medium text-[0.8rem]');
goOutSpan.appendChild(h('span', 'hidden desk:inline-grid place-items-center w-[1.05rem] rounded border border-stone-600', 'G'));
goOutSpan.appendChild(document.createTextNode('Go out\u2026'));
goOutLabel.appendChild(goOutSpan);
goOutBtn.appendChild(goOutLabel);
btnGroup.appendChild(goOutBtn);
actionsPane.appendChild(btnGroup); root.appendChild(actionsPane);

/* mobile tab bar: lowercase labels */
const tabBar = h('div', 'flex shrink-0 border-t border-stone-700');
['story', 'house', 'focus'].forEach(id => tabBar.appendChild(h('button', 'flex-1 py-3 uppercase tracking-widest', id)));
root.appendChild(tabBar);

/* desktop house pane: wrapper (React renders x8 inside it; pane ancestor is position:relative) */
const housePane = h('div', 'relative flex flex-col min-h-0 min-w-0');
const wrapper = h('div', 'flex-1 min-h-0 flex flex-col p-2');
const x8root = h('div', 'flex flex-col h-full min-h-0');
const houseHeader = h('button', 'w-full text-left px-1 pb-0.5 uppercase tracking-widest text-stone-600', null, { type: 'button', title: 'Fold the map' });
houseHeader.appendChild(document.createTextNode('\u2304'));
houseHeader.appendChild(document.createTextNode('The house'));
x8root.appendChild(houseHeader);
const roomCard = h('div', 'p-1.5 rounded border border-stone-800 bg-stone-900/40 text-xs leading-tight min-w-0');
roomCard.appendChild(h('div', 'text-[0.65rem] uppercase tracking-wider text-stone-500 mb-0.5', 'Taproom'));
x8root.appendChild(roomCard);
wrapper.appendChild(x8root);
housePane.appendChild(wrapper); root.appendChild(housePane);

/* eval module */
const mod = { exports: {} };
new Function('module', 'exports', 'window', 'document', 'localStorage', 'requestAnimationFrame', 'MutationObserver', 'setTimeout', 'setInterval', src)(mod, mod.exports, global.window, global.document, global.localStorage, global.requestAnimationFrame, global.MutationObserver, setTimeout, setInterval);
const api = global.window.waywardExpansion;

let pass = 0, fail = 0;
function t(name, cond) { if (cond) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('FAIL  ' + name); } }
const $$ = sel => Array.from(document.querySelectorAll(sel));
const byText = (sel, re) => $$(sel).find(x => re.test(x.textContent || ''));
const cardBy = re => $$('#wexp-town-panel .cursor-pointer').find(x => re.test(x.textContent || ''));

setTimeout(() => {
  /* entry points */
  const visitCity = document.querySelector('button[data-wexp="visit-city"]');
  t('Visit City button injected next to Go out…', !!visitCity);
  t('Visit City sits in the same group as Go out…', visitCity && visitCity.parentElement === btnGroup);
  t('Visit City styled like the game button', visitCity && /bg-stone-800/.test(visitCity.className));
  t('only one Visit City button', document.querySelectorAll('[data-wexp="visit-city"]').length === 1);

  const houseTab = document.querySelector('button[data-wexp-tab="house"]');
  t('mobile House tab found and marked', !!houseTab);
  t('mobile tab renamed to Village', houseTab && houseTab.textContent === 'Village');

  /* no town UI while home */
  t('no town panel while at home', !document.getElementById('wexp-town-panel'));
  t('no town actions while at home', !document.getElementById('wexp-town-actions'));

  /* visit the city */
  visitCity.click();
  t('city.inside flipped on', state.wexp && state.wexp.city.inside === true);
  t('screen stored in state as village', state.wexp && state.wexp.city.screen === 'village');
  t('arrival logged', (state.log || []).some(e => /walk down the lane/.test(e.text)));

  const panel = document.getElementById('wexp-town-panel');
  t('town panel rendered inside the House pane wrapper', !!panel && panel.parentElement === wrapper);
  t('panel is a React-safe trailing sibling of the map', panel && panel.previousElementSibling === x8root);
  t('panel covers the house map (absolute, opaque)', panel && panel.style.position === 'absolute' && panel.style.backgroundColor !== '');
  t('panel shows the Village title', panel && panel.textContent.indexOf('Village \u2014 Whisperwood') >= 0);
  t('house map card hidden behind panel (panel rendered after it)', panel && panel.textContent.indexOf('Taproom') < 0);

  const actionsBox = document.getElementById('wexp-town-actions');
  t('Actions pane container injected under Go out…', !!actionsBox && actionsBox.parentElement === btnGroup);
  t('companion actions offered (walk with wife)', !!byText('#wexp-town-actions button', /Walk with Eve/));
  t('Head home action present', !!byText('#wexp-town-actions button', /Head home/));

  /* companion */
  byText('#wexp-town-actions button', /Walk with Eve/).click();
  t('companion recorded in state', state.wexp.city.companion === 'wife');
  t('companion strip visible with her status', panel.textContent.indexOf('Eve') >= 0 && panel.textContent.indexOf('your wife') >= 0);
  t('part ways offered once accompanied', !!byText('#wexp-town-actions button', /Part ways/));

  /* shop navigation + buying through the Actions pane */
  cardBy(/Greenroot's Herbalist/).click();
  t('shop card switches the panel to the shop', panel.textContent.indexOf('Maren Greenroot') >= 0);
  t('shop screen persisted in state', state.wexp.city.screen === 'shop:herbalist');
  const buyBtn = byText('#wexp-town-actions button', /^Buy 1/);
  t('Buy 1 rendered in the Actions pane', !!buyBtn);
  const goldBefore = state.economy.gold;
  buyBtn.click();
  t('buying costs gold', state.economy.gold < goldBefore);
  t('purchase reaches the stillroom', Object.values(state.stillroom.ingredients || {}).some(v => v > 0));

  /* back to village, then an outing */
  byText('#wexp-town-actions button', /\u2190 Village/).click();
  t('back arrow returns to the Village map', panel.textContent.indexOf('Village \u2014 Whisperwood') >= 0);
  cardBy(/Riverside Walk & Gardens/).click();
  t('outing card opens the outing screen', panel.textContent.indexOf('Riverside Walk & Gardens') >= 0);
  t('outing auto-invites the wife', state.wexp.city.companion === 'wife');
  t('outing actions rendered', byText('#wexp-town-actions button', /Sit together by the water|Walk the garden rows/) !== null);

  /* leave town */
  byText('#wexp-town-actions button', /Head home/).click();
  t('Head home ends the trip', state.wexp.city.inside === false);
  t('town panel removed after leaving', !document.getElementById('wexp-town-panel'));
  t('town actions removed after leaving', !document.getElementById('wexp-town-actions'));
  t('companion reset on leaving', state.wexp.city.companion === null);
  t('departure logged', (state.log || []).some(e => /back up the lane/.test(e.text)));

  /* syncTownUI stays idle while home */
  api.rerender();
  t('sync does not resurrect the panel while home', !document.getElementById('wexp-town-panel'));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}, 120);
