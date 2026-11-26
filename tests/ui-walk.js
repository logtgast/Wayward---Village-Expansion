const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const src = fs.readFileSync('/workspace/wayward/src/wayward-expansion.js', 'utf8');
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { pretendToBeVisual: true, url: 'https://wayward.test/' });
global.window = dom.window; global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.requestAnimationFrame = cb => setTimeout(cb, 0);
global.MutationObserver = dom.window.MutationObserver;
let state = { started: true, slot: 1020, economy: { gold: 30000 }, supplies: { food: 5, beer: 5, wine: 2 },
  stillroom: { ingredients: {}, cups: [], known: {}, lore: 0 },
  characters: { wife: { id: 'wife', name: 'Eve', archetypeId: 'pippa_waif', skills: { serving: 30, cooking: 30, brewing: 10 }, mood: 60, energy: 70, attributes: { charm: 60 } } },
  primaryCharacterId: 'wife', weather: { sky: 'clear' }, phase: 'prep', player: { stats: { energy: 80 } },
  tavernReputation: { renown: 20, service: 50, notoriety: 0 } };
global.window.wayward = { get state(){ return JSON.parse(JSON.stringify(state)); }, edit(fn){ const s = JSON.parse(JSON.stringify(state)); const out = fn(s); state = out || s; } };
function h(tag, cls, text, attrs) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; for (const k in (attrs||{})) e.setAttribute(k, attrs[k]); return e; }
const root = document.getElementById('root');
const actionsPane = h('div', 'pane actions p-2'); const btnGroup = h('div', 'space-y-2');
const goOutBtn = h('button', 'gamebtn'); const goOutSpan = h('span', 'font-medium');
goOutSpan.appendChild(h('span', 'hidden desk:inline-grid', 'G')); goOutSpan.appendChild(document.createTextNode('Go out\u2026'));
goOutBtn.appendChild(goOutSpan); btnGroup.appendChild(goOutBtn); actionsPane.appendChild(btnGroup); root.appendChild(actionsPane);
const tabBar = h('div', 'tabs'); ['story','house','focus'].forEach(id => tabBar.appendChild(h('button', 'flex-1', id)));
root.appendChild(tabBar);
const housePane = h('div', 'pane house p-2');
const hh = h('button', 'hdr', null, { title: 'Fold the map' }); hh.appendChild(document.createTextNode('The house'));
housePane.appendChild(hh); root.appendChild(housePane);
(new Function('module','exports','window','document','localStorage','requestAnimationFrame','MutationObserver','setTimeout','setInterval', src))({exports:{}},{}, global.window, global.document, global.localStorage, global.requestAnimationFrame, global.MutationObserver, setTimeout, setInterval);

function clickables() { return Array.from(document.querySelectorAll('#wexp-overlay button, #wexp-overlay [class*="cursor-pointer"]')); }
function describe(e) { return (e.textContent || '').trim().slice(0, 60).replace(/\s+/g, ' '); }
function clickAll(label, depth) {
  if (depth > 3) return;
  const items = clickables();
  for (const it of items) {
    if (it.getAttribute('data-wexp-scanned') === '1') continue;
    it.setAttribute('data-wexp-scanned', '1');
    const desc = describe(it);
    if (!desc) continue;
    try { it.click(); } catch (err) { console.log('CRASH on ' + label + ' -> "' + desc + '": ' + err.message); continue; }
    console.log('ok click ' + label + ' -> "' + desc + '"  [screen: ' + (document.getElementById('wexp-overlay').style.display === 'flex' ? 'open' : 'closed') + ']');
    clickAll(label, depth + 1);
    // close overlay if open to continue scanning siblings
  }
}
setTimeout(() => {
  document.querySelector('[data-wexp="visit-city"]').click();
  console.log('--- village open, walking all clickables ---');
  clickAll('village', 0);
  console.log('done');
  process.exit(0);
}, 60);
