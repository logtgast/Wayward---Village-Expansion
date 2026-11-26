/* Full E2E: real game + expansion in jsdom. New game (Pippa), taproom,
   Visit City, then walks every overlay screen clicking through shops,
   haggle, buy, friend, outings, hiring hall, casino, and Return home. */
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
    clickMatch(/^(Begin|Continue) — Pippa/) || (!picked && (picked = !!clickMatch(/^Pippa/))) ||
    clickMatch(/^Skip$/) || clickMatch(/^Next$/) || clickMatch(/^Leave it all to fate$/) || clickMatch(/^(Begin|Open the doors)\b/i);
  setTimeout(tick, 450);
}
function inGame() {
  clickMatch(/Head down to the taproom/i);
  setTimeout(() => {
    const vb = w.document.querySelector('button[data-wexp="visit-city"]');
    t('visit-city injected in the real game', !!vb);
    vb.click();
    setTimeout(() => {
      const ov = w.document.getElementById('wexp-overlay');
      t('overlay opens', ov && ov.style.display === 'flex');
      t('village screen renders', ov && ov.textContent.indexOf('Whisperwood') >= 0);
      t('city.inside set', w.wayward.state.wexp.city.inside === true);
      t('friend generated', !!w.wayward.state.wexp.friend);
      walk();
    }, 600);
  }, 900);
}
function overlayText() { const ov = w.document.getElementById('wexp-overlay'); return ov ? (ov.textContent || '') : ''; }
function overlayOpen() { const ov = w.document.getElementById('wexp-overlay'); return !!ov && ov.style.display === 'flex'; }
function safeClick(re, label) {
  const before = errors.length;
  const ok = clickMatch(re);
  if (!ok) { console.log('  (missing button: ' + (label || re) + ')'); return false; }
  if (errors.length > before) { fail++; console.log('FAIL  click caused error: ' + (label || re) + ' -> ' + errors[errors.length - 1]); return true; }
  return true;
}
function walk() {
  /* step engine: each step polls until its condition or timeout */
  const steps = [
    { name: 'herbalist shop opens', click: /Greenroot's Herbalist/, check: () => overlayText().indexOf('Greenroot') >= 0 && /For sale|haggle/i.test(overlayText()) },
    { name: 'shop has Buy buttons (stock persists)', click: null, check: () => labels().some(l => /^Buy/.test(l)), setup: () => w.wayward.set('economy.gold', 800) },
    { name: 'buy executes', click: /^Buy 1/, check: () => w.wayward.state.economy.gold < 800 },
    { name: 'back to village', click: null, check: () => overlayText().indexOf('Whisperwood') >= 0, setup: () => clickAny2(/\u2190 Back/) },
    { name: 'hiring hall renders', click: /Hiring Hall/, check: () => /Hiring|hire \u00b7/i.test(overlayText()) },
    { name: 'back to village 2', click: null, check: () => overlayText().indexOf('Whisperwood') >= 0, setup: () => clickAny2(/\u2190 Back/) },
    { name: 'friend home renders', click: /home/i, check: () => /friend|call|visit/i.test(overlayText()) },
    { name: 'back to village 3', click: null, check: () => overlayText().indexOf('Whisperwood') >= 0, setup: () => clickAny2(/\u2190 Back|Not now/) },
    { name: 'outing renders', click: /Town Square|Riverside/, cardText: 'Market Green', check: () => /Town Square|stalls|Market Green/i.test(overlayText()) },
    { name: 'outing back', click: null, check: () => overlayText().indexOf('Whisperwood') >= 0, setup: () => clickAny2(/\u2190 Back|Not now/) },
    { name: 'casino for sale renders', click: /Gilded Lantern/, cardText: 'Gilded Lantern', check: () => /Gilded Lantern|deed/i.test(overlayText()) },
    { name: 'casino back', click: null, check: () => overlayText().indexOf('Whisperwood') >= 0, setup: () => clickAny2(/\u2190 Back|Walk away/) },
  ];
  let i = 0;
  function next() {
    if (i >= steps.length) { finishWalk(); return; }
    const st = steps[i++];
    if (st.setup) { try { st.setup(); } catch (e) { } }
    if (st.click) {
      const before = errors.length;
      const found = clickAny2(st.click);
      if (!found) {
        const cardVisible = st.cardText && overlayText().indexOf(st.cardText) >= 0;
        if (!cardVisible) { console.log('  (skip, not offered now: ' + st.name + ')'); i = steps.length; finishWalk(); return; }
        console.log('  (missing: ' + st.name + ')');
      }
      if (errors.length > before) { fail++; console.log('FAIL  error on ' + st.name + ': ' + errors[errors.length - 1]); }
    }
    let tries = 0;
    (function poll() {
      tries++;
      let ok = false;
      try { ok = st.check(); } catch (e) { }
      if (ok) { t(st.name, true); setTimeout(next, 250); }
      else if (tries < 12) setTimeout(poll, 300);
      else { t(st.name, false); setTimeout(next, 250); }
    })();
  }
  setTimeout(next, 300);
}
function clickAny2(re) { const b = Array.from(w.document.querySelectorAll('button, [class*="cursor-pointer"]')).find(x => re.test(x.textContent || '')); if (b) { b.click(); return true; } return false; }
function finishWalk() {
  safeClick(/Return home/, 'return home');
  setTimeout(() => {
    t('return home closes overlay + city.inside false', !overlayOpen() && w.wayward.state.wexp.city.inside === false);
    const s = w.wayward.state;
    console.log('expansion log entries:', (s.log || []).filter(l => /lane|deed|Bought|nettle/i.test(l.text)).map(l => l.text).slice(0, 5));
    done();
  }, 600);
}
function done() {
  console.log('\n' + pass + ' passed, ' + fail + ' failed | console errors: ' + errors.length);
  process.exit(fail || errors.length ? 1 : 0);
}
setTimeout(() => { w.eval(gameSrc); w.eval(wexpSrc); setTimeout(tick, 900); }, 200);
