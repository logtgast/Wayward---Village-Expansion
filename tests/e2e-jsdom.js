/* Full E2E: real game + expansion in jsdom. New game (Pippa), taproom,
   Visit City, then walks the Village panel (house-pane overlay panel with
   rooms-style cards) plus the contextual Actions pane: shops, haggle, buy,
   friend, outings, hiring hall, casino, and Head home. */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const gameSrc = fs.readFileSync(path.join(__dirname, '..', 'bundle.js'), 'utf8');
const wexpSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'wayward-expansion.js'), 'utf8');

const errors = [];
const vc = new VirtualConsole();
vc.on('error', (...a) => errors.push('console.error: ' + a.map(String).join(' ').slice(0, 500)));
vc.on('jsdomError', e => errors.push('jsdomError: ' + String((e && e.message) || e).slice(0, 500) + (e && e.detail ? ' :: ' + String(e.detail).slice(0, 300) : '')));
vc.on('warn', () => { }); vc.on('log', () => { });

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://wayward.test/', virtualConsole: vc,
});
const w = dom.window;
w.structuredClone = o => JSON.parse(JSON.stringify(o));
w.matchMedia = q => ({ matches: false, media: q, addEventListener() { }, removeEventListener() { }, addListener() { }, removeListener() { }, dispatchEvent() { return false; } });
w.ResizeObserver = class { observe() { } unobserve() { } disconnect() { } };
w.scrollTo = () => { };

const labels = () => Array.from(w.document.querySelectorAll('button')).map(b => (b.textContent || '').trim().slice(0, 70));
const clickMatch = re => { const b = Array.from(w.document.querySelectorAll('button, [class*="cursor-pointer"]')).find(x => re.test(x.textContent || '')); if (b) { b.click(); return true; } return false; };
let stage = 0, picked = false;
let pass = 0, fail = 0;
function t(name, cond) { if (cond) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('FAIL  ' + name); } }

function tick() {
  stage++;
  if (labels().some(l => /Stock Up|Pay \d+g/.test(l))) return inGame();
  if (stage > 40) { console.log('never started'); return done(); }
  clickMatch(/^Yes$/) || clickMatch(/I understand and accept/) || clickMatch(/^New Game$/) ||
    clickMatch(/^(Begin|Continue) \u2014 Pippa/) || (!picked && (picked = !!clickMatch(/^Pippa/))) ||
    clickMatch(/^Skip$/) || clickMatch(/^Next$/) || clickMatch(/^Leave it all to fate$/) || clickMatch(/^(Begin|Open the doors)\b/i);
  setTimeout(tick, 450);
}
function panel() { return w.document.getElementById('wexp-town-panel'); }
function panelText() { const p = panel(); return p ? (p.textContent || '') : ''; }
function actionsBox() { return w.document.getElementById('wexp-town-actions'); }
function actionsText() { const box = actionsBox(); return box ? (box.textContent || '') : ''; }
function actionBtn(re) { const box = actionsBox(); if (!box) return null; return Array.from(box.querySelectorAll('button')).find(b => re.test(b.textContent || '')); }
function cardBtn(re) { const p = panel(); if (!p) return null; return Array.from(p.querySelectorAll('.cursor-pointer')).find(x => re.test(x.textContent || '')); }
function inGame() {
  clickMatch(/Head down to the taproom/i);
  setTimeout(() => {
    const vb = w.document.querySelector('button[data-wexp="visit-city"]');
    t('visit-city injected in the real game', !!vb);
    vb.click();
    setTimeout(() => {
      const p = panel();
      t('Village panel opens inside the house pane', !!p);
      t('village screen renders', panelText().indexOf('Whisperwood') >= 0);
      t('locations render as cards (not a vertical list)', !!p && p.querySelectorAll('.cursor-pointer').length >= 8);
      t('city.inside set', w.wayward.state.wexp.city.inside === true);
      t('friend generated', !!w.wayward.state.wexp.friend);
      t('Visit City button reflects being in town', (w.document.querySelector('button[data-wexp="visit-city"]').textContent || '').indexOf('You are in town') === 0);
      t('companion actions offered in Actions pane', !!actionBtn(/Walk with/));
      t('Head home offered in Actions pane', !!actionBtn(/Head home/));
      walk();
    }, 600);
  }, 900);
}
function walk() {
  /* step engine: each step polls until its condition or timeout */
  const steps = [
    { name: 'herbalist shop opens from its card', setup: () => { const c = cardBtn(/Greenroot's Herbalist/); if (c) c.click(); }, check: () => panelText().indexOf('Maren Greenroot') >= 0 },
    { name: 'shop shows stock (persistent restock)', check: () => /For sale/.test(panelText()) && panelText().indexOf('Empty shelves') < 0 },
    { name: 'Buy buttons live in the Actions pane', setup: () => { w.wayward.set('economy.gold', 800); if (w.waywardExpansion) w.waywardExpansion.rerender(); }, check: () => !!actionBtn(/^Buy 1/) },
    { name: 'buy executes', setup: () => { const b = actionBtn(/^Buy 1/); if (b) b.click(); }, check: () => w.wayward.state.economy.gold < 800 },
    { name: 'haggle button present', check: () => !!actionBtn(/haggle/i) },
    { name: 'back to village map', setup: () => { const b = actionBtn(/\u2190 Village/); if (b) b.click(); }, check: () => panelText().indexOf('Whisperwood') >= 0 },
    { name: 'companion invited', setup: () => { const b = actionBtn(/Walk with/); if (b) b.click(); }, check: () => w.wayward.state.wexp.city.companion === 'wife' },
    { name: 'companion strip shows her status', check: () => /mood:/.test(panelText()) },
    { name: 'friend home opens', setup: () => { const c = cardBtn(/'s home/); if (c) c.click(); }, check: () => /Her home is|tea and talk/i.test(panelText() + actionsText()) },
    { name: 'friend actions in Actions pane', check: () => !!actionBtn(/Stay for tea and talk/) },
    { name: 'back to village before the outing', setup: () => { const b = actionBtn(/\u2190 Village/); if (b) b.click(); }, check: () => panelText().indexOf('Whisperwood') >= 0 },
    { name: 'outing opens and auto-invites the wife', setup: () => { const c = cardBtn(/Riverside|Town Square/); if (c) c.click(); }, check: () => w.wayward.state.wexp.city.companion === 'wife' && /Riverside|Town Square/i.test(panelText()) },
    { name: 'outing actions rendered', check: () => !!actionBtn(/Sit together|Browse the stalls|Walk the garden rows|Listen to the street player/) },
    { name: 'back to village before hiring', setup: () => { const b = actionBtn(/\u2190 Village/); if (b) b.click(); }, check: () => panelText().indexOf('Whisperwood') >= 0 },
    { name: 'hiring hall renders', setup: () => { const c = cardBtn(/Hiring Hall/); if (c) c.click(); }, check: () => /Looking for work|Your people/.test(panelText()) },
    { name: 'back to village before casino', setup: () => { const b = actionBtn(/\u2190 Village/); if (b) b.click(); }, check: () => panelText().indexOf('Whisperwood') >= 0 },
    { name: 'derelict casino card renders', setup: () => { const c = cardBtn(/Gilded Lantern/); if (c) c.click(); }, check: () => /deed|Restoration plan/i.test(panelText()) },
  ];
  let i = 0;
  function next() {
    if (i >= steps.length) { finishWalk(); return; }
    const st = steps[i++];
    if (st.setup) { try { st.setup(); } catch (e) { } }
    let tries = 0;
    (function poll() {
      tries++;
      let ok = false;
      try { ok = st.check(); } catch (e) { }
      if (ok) { t(st.name, true); setTimeout(next, 200); }
      else if (tries < 10) setTimeout(poll, 300);
      else { t(st.name, false); console.log('   panel:', panelText().slice(0,120).replace(/\n/g,' ')); console.log('   actions:', actionsText().slice(0,120)); if (errors.length) console.log('   lastError:', errors[errors.length-1]); setTimeout(next, 200); }
    })();
  }
  setTimeout(next, 300);
}
function finishWalk() {
  /* buy the casino to exercise the full panel, then head home */
  w.wayward.set('economy.gold', 20000);
  if (w.waywardExpansion) w.waywardExpansion.rerender();
  const lantern = cardBtn(/Gilded Lantern/);
  if (lantern) lantern.click();
  setTimeout(() => {
    const buy = actionBtn(/Buy the deed/);
    if (buy) buy.click();
    setTimeout(() => {
      t('casino purchased and management view opens', w.wayward.state.wexp.businesses.casino.owned === true && /treasury/.test(panelText()));
      const home = actionBtn(/Head home/);
      if (home) home.click();
      setTimeout(() => {
        t('Head home ends the trip + removes the panel', w.wayward.state.wexp.city.inside === false && !panel());
        t('Visit City button reverts to entry label', (w.document.querySelector('button[data-wexp="visit-city"]').textContent || '').indexOf('Visit City') === 0);
        const s = w.wayward.state;
        console.log('expansion log entries:', (s.log || []).filter(l => /lane|deed|Bought/i.test(l.text)).map(l => l.text).slice(0, 5));
        done();
      }, 700);
    }, 700);
  }, 500);
}
function done() {
  console.log('\n' + pass + ' passed, ' + fail + ' failed | console errors: ' + errors.length);
  process.exit(fail || errors.length ? 1 : 0);
}
setTimeout(() => { w.eval(gameSrc); w.eval(wexpSrc); setTimeout(tick, 900); }, 200);
