/*! Wayward Expansion — Village, Commerce, Staff & Casino.
 *  Self-contained add-on module for wayward-2026-11-09.html.
 *  Never patches game code: reads/writes state only through window.wayward,
 *  stores everything under state.wexp, and injects UI via DOM observation.
 *  See BRIEF.md for the design contract. */
(function () {
  'use strict';
  if (typeof window !== 'undefined' && window.__waywardExpansion) return;
  if (typeof window !== 'undefined') window.__waywardExpansion = true;

  /* ================= 0. Catalogues (audited from the baseline bundle) ================= */

  var DAY = 1440, DAWN = 300, DUSK = 1020, LATE_CALL = 1500, CLOSED_AT = 1560;

  /* Ingredient catalogue mirrors the game's `cm` array:
     {price: un[id].price (gather/trader value), weight: m5e[id], kind: u5e[id]} */
  var ING = {
    nettle:{n:'nettle',price:.1,w:1,k:'leaf',g:'edge'}, wild_garlic:{n:'wild garlic',price:.1,w:1,k:'leaf',g:'edge'},
    willow_bark:{n:'willow bark',price:.2,w:1.5,k:'root',g:'edge'}, comfrey:{n:'comfrey',price:.2,w:1,k:'leaf',g:'edge'},
    dandelion:{n:'dandelion',price:.05,w:.5,k:'leaf',g:'edge'}, plantain:{n:'plantain',price:.1,w:.5,k:'leaf',g:'edge'},
    yarrow:{n:'yarrow',price:.2,w:.5,k:'flower',g:'edge'}, clover:{n:'red clover',price:.1,w:.5,k:'flower',g:'edge'},
    hawthorn:{n:'hawthorn',price:.2,w:1,k:'fruit',g:'edge'}, elderberry:{n:'elderberry',price:.3,w:1,k:'fruit',g:'edge'},
    mint:{n:'mint',price:.2,w:.5,k:'leaf',g:'edge'}, thyme:{n:'thyme',price:.2,w:.5,k:'leaf',g:'edge'},
    honey:{n:'wild honey',price:1,w:2,k:'keeps',g:'edge'}, bitterroot:{n:'bitterroot',price:.3,w:1,k:'root',g:'edge'},
    chamomile:{n:'chamomile',price:.3,w:.5,k:'flower',g:'edge'}, mugwort:{n:'mugwort',price:.4,w:1,k:'leaf',g:'edge'},
    valerian:{n:'valerian',price:.6,w:1,k:'root',g:'wood'}, heartsease:{n:'heartsease',price:1,w:.5,k:'flower',g:'wood'},
    honeycap:{n:'honeycap',price:1.5,w:1,k:'fungus',g:'wood'}, foxglove:{n:'foxglove',price:.8,w:1,k:'flower',g:'wood'},
    fly_agaric:{n:'fly agaric',price:1,w:1,k:'fungus',g:'wood'}, oak_gall:{n:'oak gall',price:.4,w:.5,k:'keeps',g:'wood'},
    birch_sap:{n:'birch sap',price:.6,w:2,k:'fruit',g:'wood'}, pine_resin:{n:'pine resin',price:.4,w:.5,k:'keeps',g:'wood'},
    harts_tongue:{n:"hart's tongue",price:2,w:1,k:'leaf',g:'wood'}, marsh_mallow:{n:'marsh mallow',price:.6,w:1,k:'root',g:'marsh'},
    sundew:{n:'sundew',price:1.5,w:.5,k:'leaf',g:'marsh'}, bog_myrtle:{n:'bog myrtle',price:.8,w:1,k:'leaf',g:'marsh'},
    moonpetal:{n:'moonpetal',price:5,w:.5,k:'flower',g:'marsh'}, wolfsbane:{n:'wolfsbane',price:3,w:1,k:'root',g:'deep'},
    nightshade:{n:'nightshade',price:2,w:.5,k:'fruit',g:'deep'}, bloodcap:{n:'bloodcap',price:8,w:.5,k:'fungus',g:'deep'},
    ghost_orchid:{n:'ghost orchid',price:12,w:.5,k:'flower',g:'deep'},
    tallow:{n:'tallow',price:.5,w:1,k:'meat',g:'quarry'}, hide:{n:'hide',price:2,w:3,k:'hard',g:'quarry'},
    sinew:{n:'sinew',price:.5,w:.5,k:'hard',g:'quarry'}, antler:{n:'antler',price:2,w:3,k:'hard',g:'quarry'},
    tusk:{n:'boar tusk',price:5,w:1,k:'hard',g:'quarry'}, musk:{n:'musk',price:4,w:.5,k:'root',g:'quarry'},
    marrow:{n:'marrow',price:.3,w:1,k:'meat',g:'quarry'}
  };
  var SUPPLY_BASE = { food: 3, beer: 2, wine: 5 };        /* _z — market reference prices */
  var SUPPLY_SALE = { food: 2, beer: 1, wine: 3 };        /* r7 — what traders pay you   */
  var SUPPLY_TARGETS = { food: 12, beer: 12, wine: 5 };   /* _S — default stock-up targets */
  var STORAGE_BASE = 40;                                   /* S5e — shelf capacity in units */

  var SKILL_NAMES = { hunting:'Hunting', foraging:'Foraging', brewing:'Brewing', cooking:'Cooking', serving:'Serving' };

  var ATTRS = ['strength','deftness','vigor','wit','composure','charm'];

  var RECIPES = { /* bAe — existing potion recipes (stillroom.known keys) */
    hearth_draught:  { label:'Hearth Draught',   props:{ restore_energy:2 }, price:18 },
    bitter_tonic:    { label:'Bitter Tonic',     props:{ sober:2 },          price:16 },
    comfrey_salve:   { label:'Comfrey Salve',    props:{ mend:2 },           price:22 },
    sleeping_draught:{ label:'Sleeping Draught', props:{ drowse:1 },         price:14 },
    bracing_draught: { label:'Bracing Draught',  props:{ clear_fatigue:2 },  price:20 }
  };

  var ROLES = [
    { id:'cook',      label:'Cook / kitchen hand',      skill:'cooking',  alt:'foraging',  biz:['tavern','casino'] },
    { id:'server',    label:'Server / bartender / host', skill:'serving',  alt:null,        biz:['tavern','casino'] },
    { id:'herbalist', label:"Herbalist's assistant",     skill:'foraging', alt:'brewing',   biz:['tavern','casino'] },
    { id:'butcher',   label:'Butcher / provisions handler', skill:'hunting', alt:'cooking', biz:['tavern','casino'] },
    { id:'reception', label:'Receptionist / hotel attendant', skill:'serving', alt:null,     biz:['casino'] },
    { id:'housekeep', label:'Housekeeper / cleaner',     skill:null,       alt:'serving',   biz:['casino'] },
    { id:'cashier',   label:'Casino cashier',            skill:null,       alt:'serving',   biz:['casino'] },
    { id:'dealer',    label:'Card or dice dealer',       skill:null,       alt:'serving',   biz:['casino'] },
    { id:'security',  label:'Security / doorman',        skill:null,       alt:null,        biz:['casino'] },
    { id:'manager',   label:'Manager / supervisor',      skill:null,       alt:'serving',   biz:['casino'] },
    { id:'singer',    label:'Singer / stage performer',  skill:'serving',  alt:null,        biz:['casino'] },
    { id:'dancer',    label:'Dancer / lounge entertainer', skill:'serving', alt:null,       biz:['casino'] }
  ];
  var ROLE_BY_ID = {}; ROLES.forEach(function (r) { ROLE_BY_ID[r.id] = r; });

  var FIRST_NAMES = ['Aldous','Berthа','Cedric','Dorcas','Edmure','Fenn','Godric','Hesper','Idris','Jocelyn','Kenna','Larkin','Mabel','Nesta','Osric','Petra','Quill','Rosalind','Soren','Tamsin','Ulric','Verity','Wystan','Ysolt','Ansel','Brida','Corwin','Delia','Ewart','Flora'];
  var LAST_NAMES  = ['Ashcroft','Barrow','Coppervale','Dunmore','Ellsworth','Fairwood','Garrow','Hollis','Ironwood','Jessup','Kettleby','Larkin','Mercer','Netherby','Oakes','Pruitt','Quince','Rooke','Selby','Thorne','Underhill','Vance','Wick','Yardley'];
  var TEMPERAMENTS = ['chatty but easily flustered','dry and unhurried','eager to please','stubborn, takes pride in the work','quiet, watchful','warm, remembers names','rough manners, honest hands','ambitious, keeps score'];
  var BACKGROUNDS = ['worked the river docks','lamped for a lighthouse keeper','kept books for a wool merchant','cooked for a work crew','rode with a tinker caravan','served in a great house','tended bees and goats','swept a countinghouse','hauled crates at the grain wharf','minded a mule team'];

  /* ================= 1. Safe helpers ================= */
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function chance(p) { return Math.random() < p; }
  function round1(v) { return Math.round(v * 10) / 10; }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }

  function dayOf(slot) { return Math.floor(slot / DAY) + 1 - ((slot % DAY) < DAWN ? 1 : 0); }
  function tod(slot) { return slot % DAY; }
  function hhmm(t) {
    var m = ((t % DAY) + DAY) % DAY, h = Math.floor(m / 60), mm = m % 60;
    var ap = h < 12 ? 'am' : 'pm', h12 = h % 12 === 0 ? 12 : h % 12;
    return mm === 0 ? h12 + ap : h12 + ':' + (mm < 10 ? '0' : '') + mm + ap;
  }
  function openNow(slot, hours) { var h = Math.floor(tod(slot) / 60); return h >= hours[0] && h < hours[1]; }
  function hoursText(hours) { return hhmm(hours[0] * 60) + '–' + hhmm(hours[1] * 60); }

  /* ================= 2. State access (only via window.wayward) ================= */
  function W() { return typeof window !== 'undefined' ? window.wayward : null; }
  function edit(fn) {
    var w = W(); if (!w) return null;
    var out = null;
    w.edit(function (s) { fn(s); out = s; return s; });
    shadowSave();
    return out;
  }
  function getWexp() { var s = rawState(); return s ? s.wexp : null; }
  function rawState() { var w = W(); return w ? w.state : null; }
  function wifeOf(s) { return (s.characters && (s.characters[s.primaryCharacterId] || s.characters.wife)) || null; }
  function logLine(s, text) { (s.log = s.log || []).push({ slot: s.slot, text: text }); }
  function wifeName(s) { var w = wifeOf(s); return w ? w.name : 'your wife'; }
  function attr(char, a) { return (char && char.attributes && char.attributes[a]) || 50; }
  function stat(char, k) { return (char && char.stats && char.stats[k]) || 0; }

  function stillroomOf(s) {
    if (!s.stillroom || typeof s.stillroom !== 'object') s.stillroom = { ingredients: {}, cups: [], known: {}, brewsToday: 0, dosesToday: {} };
    if (!s.stillroom.ingredients) s.stillroom.ingredients = {};
    if (!s.stillroom.cups) s.stillroom.cups = [];
    if (!s.stillroom.known) s.stillroom.known = {};
    return s.stillroom;
  }
  function capacityOf(s) {
    var st = s.stillroom || {}, storage = st.storage || [], cap = STORAGE_BASE;
    var FURN = { kitchen_shelves: 40, drying_rack: 20, larder: 60 };
    for (var i = 0; i < storage.length; i++) cap += (FURN[storage[i]] ? FURN[storage[i]].room || FURN[storage[i]] : 0);
    return cap;
  }
  function usedUnits(s) {
    var st = stillroomOf(s), n = 0, k;
    for (k in st.ingredients) n += st.ingredients[k] || 0;
    return n + st.cups.length;
  }
  function freeUnits(s) { return Math.max(0, capacityOf(s) - usedUnits(s)); }
  function ingCount(s, id) { var st = stillroomOf(s); return st.ingredients[id] || 0; }
  function addIng(s, id, n) { var st = stillroomOf(s); st.ingredients[id] = (st.ingredients[id] || 0) + n; }
  function takeIng(s, id, n) {
    var st = stillroomOf(s), have = st.ingredients[id] || 0, take = Math.min(have, n);
    if (take > 0) { st.ingredients[id] = have - take; if (st.ingredients[id] <= 0) delete st.ingredients[id]; }
    return take;
  }
  function addGold(s, amount) { s.economy.gold = Math.max(0, Math.round((s.economy.gold + amount) * 100) / 100); }
  function addSupply(s, key, n) { s.supplies[key] = Math.max(0, (s.supplies[key] || 0) + n); }
  function spendEnergy(s, n) {
    var p = s.player; if (!p.stats) p.stats = {};
    p.stats.energy = clamp((p.stats.energy == null ? 100 : p.stats.energy) - n, 0, 100);
    var w = wifeOf(s);
    if (w && w.stats) w.stats.energy = clamp((w.stats.energy == null ? 100 : w.stats.energy) - Math.round(n * .7), 0, 100);
  }
  function wifeMood(s, delta) {
    var w = wifeOf(s);
    if (w && w.stats) { w.stats.mood = clamp((w.stats.mood == null ? 75 : w.stats.mood) + delta, 0, 100); return w.stats.mood; }
    return null;
  }

  /* ================= 3. Expansion state: defaults, migration, shadow save ================= */
  var WEXP_VERSION = 1, SHADOW_KEY = 'tavern-game-expansion';

  function defaultWexp() {
    return {
      v: WEXP_VERSION,
      city: { inside: false, arrivedSlot: 0, screen: 'village', companion: null },
      shops: {},                       /* per-shop: {stock:{}, restockDay, refusals, sessionDiscount, haggleTried} */
      outings: { cooldown: {}, bond: 20, history: [] },
      friend: null,                    /* {name, archetype, relation} — persists per save */
      staff: { candidates: [], refreshDay: 0, nextId: 1 },
      employees: {},                   /* id -> persistent employee */
      businesses: {
        casino: {
          owned: false, purchaseDay: null, name: 'The Gilded Lantern',
          restoration: [],             /* completed task ids */
          rooms: {},                   /* roomId -> {status:'ruined'|'ready', tier, clean, staffed} */
          hotel: { rooms: {} },        /* h1..h9,suite -> {status, quality, rate, guest, nightsLeft, paid} */
          stage: { ready: false, showTonight: false },
          lounge: { ready: false, enabled: false },
          treasury: 0, reputation: 10,
          ledger: [], lastPayDay: 0, lastOpsDay: 0, nextTournamentDay: 0
        }
      }
    };
  }

  function ensureWexp(s) {
    if (!s || typeof s !== 'object') return false;
    var d = defaultWexp(), w = s.wexp, changed = false;
    if (!w || typeof w !== 'object') { s.wexp = w = d; changed = true; }
    var k;
    for (k in d) if (!(k in w)) { w[k] = d[k]; changed = true; }
    for (k in d.businesses) if (!w.businesses[k]) { w.businesses[k] = d.businesses[k]; changed = true; }
    if (w.city) { for (k in d.city) if (!(k in w.city)) { w.city[k] = d.city[k]; changed = true; } }
    var c = w.businesses.casino;
    for (k in d.businesses.casino) if (!(k in c)) { c[k] = d.businesses.casino[k]; changed = true; }
    for (k in d.outings) if (!(k in w.outings)) { w.outings[k] = d.outings[k]; changed = true; }
    for (k in d.staff) if (!(k in w.staff)) { w.staff[k] = d.staff[k]; changed = true; }
    if (!w.outings.cooldown) { w.outings.cooldown = {}; changed = true; }
    if (!Array.isArray(w.outings.history)) { w.outings.history = []; changed = true; }
    if (w.v !== WEXP_VERSION) { w.v = WEXP_VERSION; changed = true; } /* future migrations */
    return changed;
  }

  function shadowSave() {
    try {
      var w = getWexp();
      if (w) localStorage.setItem(SHADOW_KEY, JSON.stringify(w));
    } catch (e) { /* private mode etc. — expansion still works in memory */ }
  }
  function shadowRestore() {
    try {
      var raw = localStorage.getItem(SHADOW_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  /* ================= 4. City session ================= */
  function phaseOf(s) { return s.phase; }
  function canGoCity(s) {
    if (!s || s.gameOver) return { ok: false, why: 'Not now.' };
    if (s.pendingEvent) return { ok: false, why: 'Something needs your attention first.' };
    if (s.errandSession) return { ok: false, why: 'You are already out on an errand.' };
    if (s.activeShoppingSession) return { ok: false, why: 'Finish at the clothier first.' };
    if (s.phase === 'service' || s.phase === 'last_call')
      return { ok: false, why: "You can't leave the floor while the tavern is open." };
    if ((s.player.stats && s.player.stats.energy || 0) < 10)
      return { ok: false, why: "You're too exhausted to walk into town." };
    return { ok: true };
  }
  function startCityVisit() {
    var s = rawState(); if (!s) return;
    var g = canGoCity(s);
    if (!g.ok) { alertInline(g.why); return; }
    if (s.wexp && s.wexp.city && s.wexp.city.inside) { nav('village'); return; }
    edit(function (st) {
      ensureWexp(st);
      st.wexp.city.inside = true;
      st.wexp.city.arrivedSlot = st.slot;
      st.wexp.city.screen = 'village';
      logLine(st, 'You walk down the lane into town. (' + hhmm(st.slot) + ')');
    });
    focusHousePane();
    rerender();
  }
  function leaveCity(silent) {
    edit(function (st) {
      ensureWexp(st);
      if (!st.wexp.city.inside) return;
      st.wexp.city.inside = false;
      st.wexp.city.companion = null;
      st.wexp.city.screen = 'village';
      if (!silent) logLine(st, 'You head back up the lane to the tavern. (' + hhmm(st.slot) + ')');
    });
    if (overlayEl) overlayEl.style.display = 'none';
    hideTownPanel();
    if (actionsEl) { try { actionsEl.remove(); } catch (e) { } actionsEl = null; }
  }
  function focusHousePane() {
    var btns = document.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      var t = (btns[i].textContent || '').trim().toLowerCase();
      if ((t === 'house' || t === 'village') && isTabButton(btns[i])) { btns[i].click(); return; }
    }
  }

  /* ================= 5. Shops ================= */
  function shopState(s, id) {
    var w = ensureWexp(s) || true, ws = s.wexp;
    if (!ws.shops[id]) ws.shops[id] = { stock: {}, restockDay: 0, refusals: 0, sessionDiscount: 1, haggleTried: 0, lastVisitDay: 0 };
    return ws.shops[id];
  }
  function seasonMult(s) { var m = (dayOf(s.slot) % 90); return m < 30 ? 1.05 : m < 60 ? 1.0 : 0.95; }

  var SHOP_DEFS = [
    { id:'herbalist', name:"Greenroot's Herbalist", vendor:'Maren Greenroot', desc:'Herbs, cuttings and plant ingredients from the edge of the wood.',
      hours:[7,19], markup:1.9, sellFactor:.6, haggleBase:45,
      buys:'herb', sells:'herb',
      blurb: function(){ return 'Bundles of cut herbs hang from every beam. Rarer plants sit in shaded pots behind the counter.'; } },
    { id:'butcher', name:'The Cleaver & Hide', vendor:'Bram Tanner', desc:'Meat and hunted by-products — hides, sinew, antlers, tallow. Buys your surplus.',
      hours:[6,16], markup:1.8, sellFactor:.55, haggleBase:40,
      buys:'quarry', sells:'quarry',
      blurb: function(){ return 'Sawdust on the floor, hooks on the rail. Bram weighs everything twice.'; } },
    { id:'brewer', name:'The Copper Kettle — Brewer & Wine Merchant', vendor:'Osric Pell', desc:'Ale and wine by the bottle or the cask. Prices move with the week.',
      hours:[9,20], markup:1.5, sellFactor:.5, haggleBase:40,
      buys:null, sells:'drinks',
      blurb: function(){ return 'Barrels stacked three high. The air smells of barm and pressed grapes.'; } },
    { id:'apothecary', name:'The Mortar & Quill — Apothecary', vendor:'Cybil Warren', desc:'Prepared draughts, salves and a locked cabinet of rare things.',
      hours:[10,18], markup:2.2, sellFactor:.5, haggleBase:30, renownGate:15,
      buys:null, sells:'potions',
      blurb: function(){ return 'Glass cups glint in their rack. A sign reads: prices firm, cures firm-er.'; } },
    { id:'market', name:'The General Market', vendor:'the market stalls', desc:'Food, ale and wine provisioning — the town version of your Stock Up run.',
      hours:[7,19], markup:1.4, sellFactor:.5, haggleBase:50,
      buys:null, sells:'provisions',
      blurb: function(){ return 'Trestles of bread, cheese wheels, barrels of small beer. Loud, cheap, and open early.'; } },
    { id:'bookseller', name:'The Painted Page — Bookseller & Curiosities', vendor:'Doss Quince', desc:'Herbals, draught-recipes and the odd rare curiosity from the road.',
      hours:[9,18], markup:2.0, sellFactor:.5, haggleBase:35, renownGate:0,
      buys:null, sells:'curios',
      blurb: function(){ return 'Shelves lean with hand-copied herbals. Quince dusts nothing and knows everything.'; } }
  ];
  var SHOP_BY_ID = {}; SHOP_DEFS.forEach(function (d) { SHOP_BY_ID[d.id] = d; });

  function unitPrice(s, def, base) {
    var ss = shopState(s, def.id);
    var mult = 1 + Math.sin(dayOf(s.slot) * 2.7 + def.id.length) * .08 + (seasonMult(s) - 1);
    var p = base * def.markup * mult * (ss.sessionDiscount || 1);
    return Math.max(1, Math.ceil(p));
  }
  function restock(s, def) {
    var ss = shopState(s, def.id), day = dayOf(s.slot);
    if (ss.restockDay >= day && ss.stock) return;
    var stock = {};
    if (def.sells === 'herb') {
      Object.keys(ING).forEach(function (id) {
        var it = ING[id];
        if (it.g === 'quarry') return;
        var p = it.price, roll = Math.random();
        if (p <= .35) stock[id] = ri(6, 14);
        else if (p <= 1.5) { if (roll < .9) stock[id] = ri(4, 8); }
        else if (p <= 5) { if (roll < .7) stock[id] = ri(2, 4); }
        else if (p <= 12) { if (roll < .45) stock[id] = ri(1, 2); }
        else { if (roll < .25) stock[id] = 1; }
      });
    } else if (def.sells === 'quarry') {
      stock._food = chance(.9) ? ri(0, 6) : 0;
      ['hide','sinew','antler','tusk','tallow','musk','marrow'].forEach(function (id) {
        var p = ING[id].price;
        if (p <= 1) { if (chance(.8)) stock[id] = ri(2, 6); }
        else if (p <= 3) { if (chance(.6)) stock[id] = ri(1, 3); }
        else { if (chance(.35)) stock[id] = 1; }
      });
    } else if (def.sells === 'drinks') {
      stock.beer = ri(10, 24); stock.wine = ri(6, 14);
    } else if (def.sells === 'provisions') {
      stock.food = ri(8, 16); stock.beer = ri(6, 12); stock.wine = ri(3, 6);
    } else if (def.sells === 'potions') {
      Object.keys(RECIPES).forEach(function (r) { stock['potion:' + r] = ri(1, 3); });
      if (day % 3 === 0 && chance(.5)) stock['potion:rare_warmth'] = 1;
    } else if (def.sells === 'curios') {
      stock.tome_lore = ri(1, 2);
      ['hearth_draught','bitter_tonic','comfrey_salve','sleeping_draught','bracing_draught'].forEach(function (r) {
        if (chance(.35)) stock['recipe:' + r] = 1;
      });
      ['moonpetal','ghost_orchid','bloodcap','harts_tongue'].forEach(function (id) {
        if (chance(.3)) stock[id] = 1;
      });
    }
    ss.stock = stock; ss.restockDay = day;
    ss.refusals = 0; ss.sessionDiscount = 1; ss.haggleTried = 0;
  }

  function shopLines(s, def) {
    /* returns [{key, name, unitPrice, qty, bundles:[{n,total}], sellable}] */
    var ss = shopState(s, def.id), lines = [];
    function line(key, name, base, qty) {
      if (!qty || qty <= 0) return;
      var up = unitPrice(s, def, base);
      var l = { key: key, name: name, price: up, qty: qty, bundles: [] };
      if (def.sells === 'herb' || def.sells === 'quarry') {
        if (qty >= 5) l.bundles.push({ n: 5, total: Math.ceil(up * 5 * .92) });
        if (qty >= 10) l.bundles.push({ n: 10, total: Math.ceil(up * 10 * .85) });
      }
      if (def.sells === 'drinks') {
        if (key === 'beer' && qty >= 6) l.bundles.push({ n: 6, total: Math.ceil(up * 6 * .9), label: 'cask of 6' });
        if (key === 'wine' && qty >= 4) l.bundles.push({ n: 4, total: Math.ceil(up * 4 * .9), label: 'cask of 4' });
      }
      lines.push(l);
    }
    if (def.sells === 'herb') {
      Object.keys(ING).forEach(function (id) {
        if (ING[id].g === 'quarry') return;
        line(id, ING[id].n, Math.max(.15, ING[id].price), ss.stock[id]);
      });
    } else if (def.sells === 'quarry') {
      line('_food', 'fresh meat (portion)', SUPPLY_SALE.food, ss.stock._food);
      ['hide','sinew','antler','tusk','tallow','musk','marrow'].forEach(function (id) {
        line(id, ING[id].n, Math.max(.2, ING[id].price), ss.stock[id]);
      });
    } else if (def.sells === 'drinks') {
      line('beer', 'ale (bottle)', SUPPLY_BASE.beer, ss.stock.beer);
      line('wine', 'wine (bottle)', SUPPLY_BASE.wine, ss.stock.wine);
    } else if (def.sells === 'provisions') {
      line('food', 'food provisions', SUPPLY_BASE.food * .8, ss.stock.food);
      line('beer', 'beer provisions', SUPPLY_BASE.beer * .8, ss.stock.beer);
      line('wine', 'wine provisions', SUPPLY_BASE.wine * .8, ss.stock.wine);
      if (ss.stock.food > 0 && ss.stock.beer > 0)
        lines.push({ key: '_bundle', name: 'provisioner\'s bundle (5 food, 3 beer)', price: Math.ceil(SUPPLY_BASE.food * .8 * 5 + SUPPLY_BASE.beer * .8 * 3 - 4), qty: Math.min(ss.stock.food >= 5 ? 99 : 0, ss.stock.beer >= 3 ? 99 : 0), bundles: [] });
    } else if (def.sells === 'potions') {
      Object.keys(RECIPES).forEach(function (r) {
        line('potion:' + r, RECIPES[r].label + ' (draught)', RECIPES[r].price, ss.stock['potion:' + r]);
      });
      if (ss.stock['potion:rare_warmth'])
        line('potion:rare_warmth', 'Moonpetal Philtre', 60, ss.stock['potion:rare_warmth']);
    } else if (def.sells === 'curios') {
      line('tome_lore', 'herbal lore, volume (foraging +2)', 45, ss.stock.tome_lore);
      Object.keys(RECIPES).forEach(function (r) {
        line('recipe:' + r, 'recipe page: ' + RECIPES[r].label, Math.ceil(RECIPES[r].price * 3.2), ss.stock['recipe:' + r]);
      });
      ['moonpetal','ghost_orchid','bloodcap','harts_tongue'].forEach(function (id) {
        line(id, ING[id].n + ' (rare)', ING[id].price * 1.6, ss.stock[id]);
      });
    }
    return lines;
  }

  function playerSellables(s, def) {
    var out = [];
    if (def.buys === 'herb') {
      Object.keys(ING).forEach(function (id) {
        if (ING[id].g === 'quarry') return;
        var c = ingCount(s, id);
        if (c > 0) out.push({ id: id, name: ING[id].n, count: c, each: Math.max(1, Math.floor(ING[id].price * def.sellFactor * 10) / 10) });
      });
    } else if (def.buys === 'quarry') {
      Object.keys(ING).forEach(function (id) {
        if (ING[id].g !== 'quarry') return;
        var c = ingCount(s, id);
        if (c > 0) out.push({ id: id, name: ING[id].n, count: c, each: Math.max(1, Math.floor(ING[id].price * def.sellFactor * 10) / 10) });
      });
      if (s.supplies.food > 0) out.push({ id: '_food', name: 'meat portions', count: s.supplies.food, each: 1, supply: 'food' });
    }
    return out;
  }

  function buyFromShop(shopId, key, n, bundleTotal) {
    var ok = false;
    edit(function (s) {
      ensureWexp(s);
      var def = SHOP_BY_ID[shopId]; if (!def) return;
      if (!openNow(s.slot, def.hours)) { logLine(s, def.vendor + "'s shutters are closed. Hours: " + hoursText(def.hours) + '.'); return; }
      var ss = shopState(s, shopId);
      restock(s, def);
      var lines = shopLines(s, def), line = null;
      for (var i = 0; i < lines.length; i++) if (lines[i].key === key) line = lines[i];
      if (!line || line.qty <= 0) { logLine(s, 'The shelf is empty — that was the last of it.'); return; }
      if (n <= 0 || n > line.qty) { logLine(s, 'The vendor shakes her head. Only ' + line.qty + ' left.'); return; }
      var total = bundleTotal != null ? bundleTotal : line.price * n;
      if (s.economy.gold < total) { logLine(s, "You don't have " + total + 'g. You put it back.'); return; }

      /* capacity & compatibility validation */
      if (def.sells === 'herb' || (def.sells === 'quarry' && key !== '_food') || def.sells === 'curios' && key.indexOf(':') < 0 && key !== 'tome_lore') {
        var need = freeUnits(s);
        if (need <= 0) { logLine(s, 'Your basket and shelves are full. Sell or store something first.'); return; }
      }
      if (def.sells === 'provisions' || def.sells === 'drinks' || key === '_food') {
        var sup = key === 'beer' ? 'beer' : key === 'wine' ? 'wine' : 'food';
        var cur = s.supplies[sup] || 0;
        var cap = SUPPLY_TARGETS[sup] + (sup === 'wine' ? 0 : 4);
        if (cur + n > cap) { n = Math.max(0, cap - cur); if (n <= 0) { logLine(s, 'Your ' + sup + ' storage is already at its limit.'); return; } logLine(s, 'You take only ' + n + ' — that is all the room you have for ' + sup + '.'); total = bundleTotal != null ? Math.ceil(bundleTotal * n / (key === '_bundle' ? 1 : line.qty * 1)) : line.price * n; if (key === '_bundle') { logLine(s, 'Not enough room for the bundle.'); return; } }
      }

      addGold(s, -total);
      ledgerNote(s, 'personal', 'purchase', -total, def.name + ': ' + line.name);

      if (def.sells === 'provisions' && key === '_bundle') {
        addSupply(s, 'food', 5); addSupply(s, 'beer', 3);
        ss.stock.food -= 5; ss.stock.beer -= 3;
        logLine(s, 'Bought a provisioner\'s bundle for ' + total + 'g.');
      } else if (key === '_food') {
        addSupply(s, 'food', n); ss.stock._food -= n;
        logLine(s, 'Bought ' + n + ' portion' + (n === 1 ? '' : 's') + ' of meat for ' + total + 'g.');
      } else if (def.sells === 'drinks' || def.sells === 'provisions') {
        addSupply(s, key, n); ss.stock[key] -= n;
        logLine(s, 'Bought ' + n + ' ' + key + ' for ' + total + 'g.');
      } else if (def.sells === 'potions' && key.indexOf('potion:') === 0) {
        var rid = key.slice(7), props, label;
        if (rid === 'rare_warmth') { props = [{ property: 'restore_energy', units: 2 }, { property: 'fortify_charm', units: 1 }]; label = 'Moonpetal Philtre'; }
        else { props = Object.keys(RECIPES[rid].props).map(function (p) { return { property: p, units: RECIPES[rid].props[p] }; }); label = RECIPES[rid].label; }
        var st = stillroomOf(s);
        for (var j = 0; j < n; j++) st.cups.push({ id: 'ap-' + Date.now() + '-' + j, effects: JSON.parse(JSON.stringify(props)), from: [], day: dayOf(s.slot) });
        ss.stock[key] -= n;
        logLine(s, 'Bought ' + n + ' ' + label + ' for ' + total + 'g. It racks in your stillroom.');
      } else if (def.sells === 'curios' && key === 'tome_lore') {
        var stl = stillroomOf(s);
        stl.lore = Math.min(40, (stl.lore || 0) + 2 * n);
        ss.stock[key] -= n;
        logLine(s, 'Studied the herbal on the walk home. Foraging lore is now ' + stl.lore + '. (' + total + 'g)');
      } else if (def.sells === 'curios' && key.indexOf('recipe:') === 0) {
        var rid2 = key.slice(7), stk = stillroomOf(s);
        stk.known[rid2] = true;
        ss.stock[key] -= n;
        logLine(s, 'Bought the ' + RECIPES[rid2].label + ' recipe page for ' + total + 'g. You can brew it now.');
      } else {
        var space = freeUnits(s), got = Math.min(n, space);
        if (got <= 0) { addGold(s, total); logLine(s, 'No room to carry it. You leave it.'); return; }
        if (got < n) { addGold(s, Math.ceil(total * (n - got) / n)); total = Math.ceil(total * got / n); logLine(s, 'You could only carry ' + got + '.'); }
        addIng(s, key, got); ss.stock[key] -= got;
        logLine(s, 'Bought ' + got + ' ' + (ING[key] ? ING[key].n : key) + ' for ' + total + 'g.');
      }
      ok = true;
    });
    return ok;
  }

  function sellToShop(shopId, itemId, n) {
    edit(function (s) {
      ensureWexp(s);
      var def = SHOP_BY_ID[shopId]; if (!def || !def.buys) return;
      if (!openNow(s.slot, def.hours)) { logLine(s, def.vendor + "'s shutters are closed."); return; }
      var per, got = 0;
      if (itemId === '_food') {
        per = 1; got = Math.min(n, s.supplies.food || 0);
        if (got <= 0) { logLine(s, 'You have no meat to sell.'); return; }
        addSupply(s, 'food', -got);
      } else {
        per = Math.max(.2, Math.floor(ING[itemId].price * def.sellFactor * 10) / 10);
        got = takeIng(s, itemId, n);
        if (got <= 0) { logLine(s, 'You have none of that.'); return; }
      }
      var earn = Math.max(1, Math.round(per * got * 10) / 10);
      addGold(s, earn);
      logLine(s, 'Sold ' + got + ' ' + (itemId === '_food' ? 'portions of meat' : ING[itemId].n) + ' to ' + def.vendor + ' for ' + earn + 'g.');
      ledgerNote(s, 'personal', 'income', earn, def.name + ': sold ' + (itemId === '_food' ? 'meat' : ING[itemId].n));
      spendEnergy(s, 1);
    });
  }

  function haggle(shopId) {
    edit(function (s) {
      ensureWexp(s);
      var def = SHOP_BY_ID[shopId]; if (!def) return;
      var ss = shopState(s, shopId);
      if (ss.haggleTried >= 2) { logLine(s, def.vendor + ' waves you off. "Prices are prices."'); return; }
      ss.haggleTried++;
      var p = clamp(def.haggleBase - ss.refusals * 12 + (attr(s.player, 'charm') - 50) / 5 + (attr(s.player, 'wit') - 50) / 10, 5, 80) / 100;
      if (Math.random() < p) {
        var disc = .85 - Math.random() * .05;
        ss.sessionDiscount = disc;
        logLine(s, def.vendor + ' snorts, then knocks the prices down a shade (' + Math.round((1 - disc) * 100) + '% off, this visit).');
      } else {
        ss.refusals++; ss.sessionDiscount = 1;
        logLine(s, def.vendor + ' folds her arms. "Same price as anyone." (Future haggling here is harder.)');
      }
    });
  }

  /* ================= 6. Friend's home (Pippa's friend / protagonist's friend) ================= */
  function isPippa(s) {
    var w = wifeOf(s);
    return !!(w && (w.archetypeId === 'pippa_waif' || (w.generatedArchetype && w.generatedArchetype.id === 'pippa_waif')));
  }
  function ensureFriend(s) {
    ensureWexp(s);
    if (s.wexp.friend && s.wexp.friend.for === (isPippa(s) ? 'pippa' : 'protagonist')) return s.wexp.friend;
    var pippa = isPippa(s);
    var f = {
      for: pippa ? 'pippa' : 'protagonist',
      name: pippa ? pick(['Tansy Rowle','Bee Halloway','Ines Ivy','Wren Coalpit']) : pick(['Hesper Nook','Lettie Ash','Marta Ferris']),
      relation: pippa ? "Pippa's oldest friend from the locksmith's row" : wifeName(s) + "'s oldest friend",
      homeName: pippa ? 'a narrow house on locksmiths’ row' : 'a tidy cottage off the well lane',
      metDay: dayOf(s.slot)
    };
    if (pippa) f.name = pick(['Tansy Rowle','Bee Halloway','Wren Coalpit','Ivy Sennet']);
    s.wexp.friend = f;
    return f;
  }
  function friendOf(s) {
    ensureWexp(s);
    if (s.wexp.friend) return s.wexp.friend;
    var pippa = isPippa(s);
    return {
      for: pippa ? 'pippa' : 'protagonist',
      name: pippa ? 'Tansy Rowle' : 'Hesper Nook',
      relation: pippa ? "Pippa's oldest friend from the locksmith's row" : wifeName(s) + "'s oldest friend",
      homeName: pippa ? 'a narrow house on locksmiths’ row' : 'a tidy cottage off the well lane',
      metDay: dayOf(s.slot), provisional: true
    };
  }
  function visitFriend(actionId) {
    edit(function (s) {
      ensureWexp(s);
      var f = ensureFriend(s);
      var day = dayOf(s.slot);
      if (!s.wexp.friend) ensureFriend(s);
      var cd = s.wexp.outings.cooldown['friend'];
      if (cd != null && cd >= day && actionId !== 'look') { logLine(s, 'You already called on ' + f.name.split(' ')[0] + ' today. Twice in a day would be strange.'); return; }
      var wn = wifeName(s);
      var w = wifeOf(s);
      var mood = w ? stat(w, 'mood') : 60;
      if (actionId === 'chat') {
        var lines = [
          f.name + ' pours tea that is slightly too strong. ' + wn + ' laughs at something she does not explain to you.',
          f.name + ' shows off a mended lock-pick necklace. ' + wn + ' turns it over, delighted.',
          f.name + ' has gossip about the grain merchant. ' + wn + ' leans in; you learn more than you needed to.'
        ];
        logLine(s, 'You call on ' + f.name + ' — ' + f.relation + '. ' + pick(lines));
        s.slot += 50; spendEnergy(s, 4);
        wifeMood(s, mood > 40 ? 4 : 7);
        s.wexp.outings.bond = clamp(s.wexp.outings.bond + 2, 0, 100);
        s.wexp.outings.cooldown['friend'] = day;
      } else if (actionId === 'supper') {
        if (s.economy.gold < 6) { logLine(s, "You can't bring supper wine without a coin to your name."); return; }
        addGold(s, -6);
        logLine(s, 'You stay for supper at ' + f.homeName + '. The wine costs you 6g and is worth it. ' + wn + ' sings half a song she half-remembers.');
        s.slot += 120; spendEnergy(s, 8);
        wifeMood(s, 9);
        s.wexp.outings.bond = clamp(s.wexp.outings.bond + 4, 0, 100);
        s.wexp.outings.cooldown['friend'] = day;
      } else if (actionId === 'help') {
        logLine(s, 'You mend a sticking door hinge while the two of them talk over you. It is a good afternoon.');
        s.slot += 90; spendEnergy(s, 10);
        wifeMood(s, 5);
        s.wexp.outings.bond = clamp(s.wexp.outings.bond + 3, 0, 100);
        s.wexp.outings.cooldown['friend'] = day;
      }
      s.wexp.outings.history.unshift({ day: day, kind: 'friend', note: 'visited ' + f.name });
      if (s.wexp.outings.history.length > 40) s.wexp.outings.history.pop();
    });
  }

  /* ================= 7. Couple outings ================= */
  var OUTINGS = [
    {
      id: 'square', name: 'Town Square & Market Green', desc: 'Stalls, street players, and the whole town walking past.',
      hours: [8, 20], cost: 0,
      actions: [
        { id:'browse',  label:'Browse the stalls', mins:45, energy:5, text:function(){ return pick(['You examine brass buckles you will not buy.','A spice seller lets ' + 'you' + ' smell everything twice.','You haggle over nothing in particular and enjoy it.']); }, buyChance:.35, buyCost:6, buyText:'You give in and buy a small tin of pepper (6g).' },
        { id:'performer', label:'Listen to the street player', mins:30, energy:2, tip:2, mood:4, text:'A fiddler works the crowd. You leave a couple of coppers in his hat.' },
        { id:'snack', label:'Share a snack at a cookshop', mins:30, energy:-6, cost:4, mood:5, text:'Fried dough, hot and greasy. You split it walking.' },
        { id:'watch', label:'Watch the townsfolk, talk', mins:30, energy:2, mood:3, bond:2, text:function(s){ return 'You lean on the well rail with ' + wifeName(s) + ' and invent histories for passers-by.'; } }
      ]
    },
    {
      id: 'riverside', name: 'Riverside Walk & Gardens', desc: 'Willow shade, slow water, and quiet.',
      hours: [7, 21], cost: 0,
      actions: [
        { id:'sit', label:'Sit together by the water', mins:30, energy:1, mood:4, bond:2, text:'The river carries leaves past your boots. Neither of you says much.' },
        { id:'walk', label:'Walk the garden rows', mins:45, energy:6, mood:3, bond:2, text:function(s){ return 'You take the long path with ' + wifeName(s) + ', past beds gone slightly wild.'; } },
        { id:'talk', label:'Talk privately', mins:30, energy:1, mood:5, bond:4, text:function(s){ return 'Away from the path, ' + wifeName(s) + ' says something she has been carrying for days.'; } },
        { id:'affection', label:'Exchange a quiet affection', mins:20, energy:1, mood:7, bond:5, needMood:35, text:function(s){ return wifeName(s) + ' leans her head on your shoulder where the willows screen the path.'; } }
      ]
    }
  ];
  var OUTING_BY_ID = {}; OUTINGS.forEach(function (o) { OUTING_BY_ID[o.id] = o; });

  function doOuting(outingId, actionId) {
    edit(function (s) {
      ensureWexp(s);
      var o = OUTING_BY_ID[outingId], a = null;
      if (!o) return;
      for (var i = 0; i < o.actions.length; i++) if (o.actions[i].id === actionId) a = o.actions[i];
      if (!a) return;
      var day = dayOf(s.slot);
      if (s.wexp.outings.cooldown[outingId] != null && s.wexp.outings.cooldown[outingId] >= day) {
        logLine(s, 'You already spent time there today. Another visit would wear it thin.');
        return;
      }
      var hour = Math.floor(tod(s.slot) / 60);
      if (hour < o.hours[0] || hour >= o.hours[1]) { logLine(s, 'Not the hour for it — ' + o.name + ' is right at ' + hoursText(o.hours) + '.'); return; }
      var w = wifeOf(s);
      var herEnergy = w ? stat(w, 'energy') : 80;
      if (herEnergy < 15) { logLine(s, wifeName(s) + ' is too worn out for an outing today. Let her rest.'); return; }
      if (a.needMood != null && (w ? stat(w, 'mood') : 60) < a.needMood) {
        logLine(s, wifeName(s) + ' is not in the mood. A quieter word first, perhaps.');
        return;
      }
      if (a.cost && s.economy.gold < a.cost) { logLine(s, 'You are short of coin for that.'); return; }
      if (a.tip && s.economy.gold < a.tip) { logLine(s, 'Your purse is too light to tip properly. Another day.'); return; }
      if (a.cost) { addGold(s, -a.cost); logLine(s, '(−' + a.cost + 'g)'); }
      if (a.tip) { addGold(s, -a.tip); }
      var txt = typeof a.text === 'function' ? a.text(s) : a.text;
      var sky = s.weather ? (s.weather.turn && s.slot >= s.weather.turn.atSlot ? s.weather.turn.sky : s.weather.sky) : 'overcast';
      var flavor = sky === 'rain' ? ' A drizzle starts; you share one umbrella.' : sky === 'clear' ? ' The sky is wide and blue.' : sky === 'storm' ? ' Thunder mutters past the hills.' : '';
      logLine(s, txt + flavor);
      s.slot += a.mins;
      spendEnergy(s, Math.max(0, a.energy));
      if (a.energy < 0) { var p = s.player; p.stats.energy = clamp(p.stats.energy + (-a.energy), 0, 100); }
      if (a.mood) wifeMood(s, a.mood);
      if (a.bond) s.wexp.outings.bond = clamp(s.wexp.outings.bond + a.bond, 0, 100);
      if (a.buyChance && chance(a.buyChance) && s.economy.gold >= a.buyCost) { addGold(s, -a.buyCost); logLine(s, a.buyText); }
      s.wexp.outings.cooldown[outingId] = day;
      s.wexp.outings.history.unshift({ day: day, kind: outingId, note: a.label });
      if (s.wexp.outings.history.length > 40) s.wexp.outings.history.pop();
      spendEnergy(s, 3);
    });
  }

  /* ================= 8. Employment ================= */
  function bizState(s, id) {
    ensureWexp(s);
    return s.wexp.businesses[id];
  }
  function refreshCandidatesIfNeeded(s) {
    ensureWexp(s);
    var day = dayOf(s.slot), st = s.wexp.staff;
    if (st.refreshDay >= day && st.candidates.length) return;
    var hiredIds = {};
    Object.keys(s.wexp.employees).forEach(function (k) { hiredIds[s.wexp.employees[k].candidateRef || ''] = 1; });
    var n = ri(4, 6), pool = [];
    for (var i = 0; i < n; i++) {
      var skills = { hunting: 0, foraging: 0, brewing: 0, cooking: 0, serving: 0 };
      var base = ri(5, 35), main = pick(Object.keys(skills));
      skills[main] = clamp(base + ri(5, 30), 5, 75);
      if (chance(.5)) { var second = pick(Object.keys(skills)); if (second !== main) skills[second] = clamp(base + ri(0, 15), 0, 60); }
      var attributes = {};
      ATTRS.forEach(function (a) { attributes[a] = ri(25, 80); });
      var avg = 0, cnt = 0; Object.keys(skills).forEach(function (k) { avg += skills[k]; cnt++; });
      var c = {
        id: 'cand-' + st.nextId++ + '-' + day,
        name: pick(FIRST_NAMES) + ' ' + pick(LAST_NAMES),
        age: ri(21, 48),
        background: pick(BACKGROUNDS),
        skills: skills, attributes: attributes,
        wage: Math.max(8, Math.round(6 + (avg / cnt) * .55 + attributes.charm * .12)),
        temperament: pick(TEMPERAMENTS),
        privateOk: chance(.3)
      };
      pool.push(c);
    }
    st.candidates = pool; st.refreshDay = day;
  }
  function hireCandidate(candId, bizId, roleId) {
    edit(function (s) {
      ensureWexp(s);
      refreshCandidatesIfNeeded(s);
      var st = s.wexp.staff, cand = null, idx = -1;
      for (var i = 0; i < st.candidates.length; i++) if (st.candidates[i].id === candId) { cand = st.candidates[i]; idx = i; }
      if (!cand) { logLine(s, 'That candidate has already been taken on elsewhere.'); return; }
      var role = ROLE_BY_ID[roleId]; if (!role) return;
      if (role.biz.indexOf(bizId) < 0) { logLine(s, 'That role does not fit that business.'); return; }
      var biz = bizState(s, bizId);
      if (bizId === 'casino') { if (!biz || !biz.owned) { logLine(s, 'You have no casino to assign them to yet.'); return; } }
      var signing = cand.wage;
      if (s.economy.gold < signing) { logLine(s, 'You need at least ' + signing + 'g for the signing wage.'); return; }
      addGold(s, -signing);
      var empId = 'emp-' + st.nextId++ + '-' + dayOf(s.slot);
      s.wexp.employees[empId] = {
        id: empId, candidateRef: cand.id,
        name: cand.name, age: cand.age, background: cand.background,
        skills: JSON.parse(JSON.stringify(cand.skills)),
        attributes: JSON.parse(JSON.stringify(cand.attributes)),
        wage: cand.wage, role: roleId, business: bizId,
        morale: ri(55, 80), fatigue: 0, experience: 0,
        temperament: cand.temperament, privateOk: !!cand.privateOk,
        hiredDay: dayOf(s.slot), lastPaidDay: dayOf(s.slot),
        refuses: 0
      };
      st.candidates.splice(idx, 1);
      logLine(s, 'Hired ' + cand.name + ' as ' + role.label + ' (' + (bizId === 'casino' ? biz && biz.name : 'the tavern') + '), ' + cand.wage + 'g/week. Signing wage paid.');
    });
  }
  function assignEmployee(empId, bizId, roleId) {
    edit(function (s) {
      ensureWexp(s);
      var e = s.wexp.employees[empId];
      if (!e) return;
      var role = ROLE_BY_ID[roleId];
      if (!role) return;
      if (e.business === bizId && e.role === roleId) return;
      if (e.business !== bizId && roleId && role.biz.indexOf(bizId) < 0) { logLine(s, 'That role does not exist at that business.'); return; }
      e.business = bizId; e.role = roleId;
      logLine(s, e.name + ' is now ' + role.label + ' at ' + (bizId === 'casino' ? s.wexp.businesses.casino.name : 'the tavern') + '.');
    });
  }
  function dismissEmployee(empId) {
    edit(function (s) {
      ensureWexp(s);
      var e = s.wexp.employees[empId];
      if (!e) return;
      logLine(s, 'You let ' + e.name + ' go. Final wage settled.');
      delete s.wexp.employees[empId];
    });
  }
  function payRole(s, emp) {
    var biz = emp.business === 'casino' ? s.wexp.businesses.casino : null;
    var amount = emp.wage;
    if (biz) {
      if (biz.treasury >= amount) {
        biz.treasury -= amount;
        ledgerNote(s, 'casino', 'wages', -amount, emp.name);
      } else {
        var fromGold = amount - biz.treasury;
        if (biz.treasury > 0) ledgerNote(s, 'casino', 'wages', -biz.treasury, emp.name + ' (partial, treasury)');
        biz.treasury = 0;
        addGold(s, -fromGold);
        ledgerNote(s, 'personal', 'wages', -fromGold, emp.name + ' (casino shortfall)');
      }
    } else {
      addGold(s, -amount);
      ledgerNote(s, 'personal', 'wages', -amount, emp.name + ' (tavern)');
    }
    emp.lastPaidDay = dayOf(s.slot);
  }
  function weeklyPayrollIfDue(s) {
    ensureWexp(s);
    var day = dayOf(s.slot), w = s.wexp;
    var ids = Object.keys(w.employees);
    var due = [];
    for (var i = 0; i < ids.length; i++) {
      var e = w.employees[ids[i]];
      if (day - e.lastPaidDay >= 7) due.push(e);
    }
    if (!due.length) return;
    for (var j = 0; j < due.length; j++) payRole(s, due[j]);
    logLine(s, 'Payroll: ' + due.length + ' employee' + (due.length === 1 ? '' : 's') + ' paid' + (due.length === 1 ? '' : ' (weekly wages)') + '.');
  }
  function dailyEmployeeProgress(s) {
    ensureWexp(s);
    var w = s.wexp, ids = Object.keys(w.employees);
    for (var i = 0; i < ids.length; i++) {
      var e = w.employees[ids[i]], role = ROLE_BY_ID[e.role];
      if (!role) continue;
      e.experience += 1;
      e.morale = clamp(e.morale + 1, 0, 100);
      var target = role.skill || role.alt;
      if (target && chance(.3)) e.skills[target] = clamp((e.skills[target] || 0) + 1, 0, 90);
      e.fatigue = clamp(e.fatigue - 10, 0, 100);
    }
  }

  /* ================= 9. Casino ================= */
  var CASINO_PRICE = 12500; /* within the 10,000–15,000 gold target */

  var CASINO_ROOMS = [
    { id:'card_room',  floor:'ground', name:'Card Room',  game:'cards', restoreCost:900,  minStake:5,  maxStake:25 },
    { id:'dice_room',  floor:'ground', name:'Dice Room',  game:'dice',  restoreCost:700,  minStake:5,  maxStake:20 },
    { id:'board_room', floor:'ground', name:'Table Game Room', game:'board', restoreCost:700, minStake:0, maxStake:0 }
  ];
  var CASINO_GROUND = [
    { id:'reception', name:'Entrance & Reception', restoreCost:600 },
    { id:'hall_bar',  name:'Public Hall & Bar', restoreCost:800 },
    { id:'office', name:'Manager\'s Office', restoreCost:400 },
    { id:'security_post', name:'Security Post', restoreCost:500 },
    { id:'staff_room', name:'Staff Facilities', restoreCost:350 }
  ];
  var CASINO_BASEMENT = [
    { id:'storeroom', name:'Storerooms & Reserves', restoreCost:400 },
    { id:'treasury', name:'Treasury / Cash Office', restoreCost:500 }
  ];
  var CASINO_FUN = [
    { id:'stage', name:'Stage & Show Room', restoreCost:1400 },
    { id:'lounge', name:'Private Entertainment Lounge', restoreCost:1200 }
  ];
  function hotelRoomList() {
    var out = [];
    for (var f = 1; f <= 3; f++) for (var r = 1; r <= 3; r++) out.push({ id: 'h' + (f * 3 - 3 + r), floor: f, name: 'Room ' + f + '0' + r, restoreCost: 400, suite: false });
    out.push({ id: 'suite', floor: 4, name: 'The Lantern Suite', restoreCost: 1200, suite: true });
    return out;
  }

  function purchaseCasino() {
    edit(function (s) {
      ensureWexp(s);
      var c = s.wexp.businesses.casino;
      if (c.owned) { logLine(s, 'You already hold the deed to ' + c.name + '.'); return; }
      if (s.economy.gold < CASINO_PRICE) { logLine(s, 'The agent wants ' + CASINO_PRICE + 'g for the Lantern, derelict as it is. You are short.'); return; }
      addGold(s, -CASINO_PRICE);
      c.owned = true; c.purchaseDay = dayOf(s.slot);
      ledgerNote(s, 'casino', 'purchase', -CASINO_PRICE, 'Deed of ' + c.name + ' (derelict)');
      c.hotel.rooms = { h1: { status: 'ready', quality: 1, rate: 8, clean: 100, guest: null } };
      logLine(s, 'You count out ' + CASINO_PRICE + 'g and take the deed to ' + c.name + ' — three storeys of blackened windows and one stubborn door. It is yours, derelict. One guest room upstairs could be made serviceable tonight.');
      logLine(s, 'Restoration, furnishing and hiring are separate costs. Ask at the site office.');
    });
  }
  function casinoRoom(id) {
    var list = CASINO_ROOMS.concat(CASINO_GROUND, CASINO_BASEMENT, CASINO_FUN, hotelRoomList());
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function restoreCasinoRoom(roomId) {
    edit(function (s) {
      ensureWexp(s);
      var c = s.wexp.businesses.casino;
      if (!c.owned) return;
      var def = casinoRoom(roomId); if (!def) return;
      var cur = roomId.indexOf('h') === 0 && roomId !== 'hall_bar' ? c.hotel.rooms[roomId] : c.rooms[roomId];
      if (roomId === 'h1') cur = c.hotel.rooms.h1;
      if (cur && cur.status === 'ready') { logLine(s, def.name + ' is already restored.'); return; }
      if (s.economy.gold < def.restoreCost) { logLine(s, def.name + ' needs ' + def.restoreCost + 'g in materials and hands. You are short.'); return; }
      addGold(s, -def.restoreCost);
      ledgerNote(s, 'casino', 'restore', -def.restoreCost, 'Restored ' + def.name);
      if (roomId === 'suite' || roomId.match(/^h[1-9]$/)) {
        c.hotel.rooms[roomId] = { status: 'ready', quality: def.suite ? 5 : Math.min(4, 1 + Math.floor(c.reputation / 30)), rate: def.suite ? 100 : [0, 8, 15, 25, 40][Math.min(4, 1 + Math.floor(c.reputation / 30))], clean: 100, guest: null };
      } else {
        c.rooms[roomId] = { status: 'ready' };
        if (roomId === 'stage') c.stage.ready = true;
        if (roomId === 'lounge') { c.lounge.ready = true; }
      }
      c.restoration.push(roomId);
      logLine(s, 'Restored ' + def.name + ' (' + def.restoreCost + 'g). The Lantern feels less like a ruin.');
    });
  }
  function casinoStaffedCount(s, roleId) {
    var n = 0, ids = Object.keys(s.wexp.employees);
    for (var i = 0; i < ids.length; i++) { var e = s.wexp.employees[ids[i]]; if (e.business === 'casino' && e.role === roleId && e.morale > 30) n++; }
    return n;
  }
  function casinoRoomStaff(s, roomId) {
    /* rooms may be assigned a dealer/security via roomToStaff map */
    var c = s.wexp.businesses.casino;
    return (c.staffing && c.staffing[roomId]) || null;
  }
  function ledgerNote(s, biz, cat, amount, note) {
    var c = s.wexp.businesses.casino;
    if (biz === 'casino' && c) {
      c.ledger.push({ day: dayOf(s.slot), cat: cat, amount: Math.round(amount * 10) / 10, note: note || '' });
      if (c.ledger.length > 240) c.ledger = c.ledger.slice(-200);
    }
  }
  function sweepTreasury() {
    edit(function (s) {
      ensureWexp(s);
      var c = s.wexp.businesses.casino;
      if (!c.owned) return;
      var amt = Math.floor(c.treasury);
      if (amt <= 0) { logLine(s, 'The Lantern treasury is empty.'); return; }
      c.treasury -= amt;
      addGold(s, amt);
      ledgerNote(s, 'casino', 'transfer_out', -amt, 'Swept treasury to the tavern strongbox');
      logLine(s, 'You carry ' + amt + 'g from the Lantern treasury to your strongbox.');
    });
  }
  function depositTreasury(amount) {
    edit(function (s) {
      ensureWexp(s);
      var c = s.wexp.businesses.casino;
      if (!c.owned) return;
      amount = Math.floor(amount);
      if (amount <= 0 || s.economy.gold < amount) { logLine(s, 'You do not have that much to deposit.'); return; }
      addGold(s, -amount); c.treasury += amount;
      ledgerNote(s, 'casino', 'transfer_in', amount, 'Deposit from the strongbox');
      logLine(s, 'Deposited ' + amount + 'g into the Lantern treasury.');
    });
  }

  /* --- nightly casino operations, run once per game-day --- */
  function casinoNightly(s) {
    var c = s.wexp.businesses.casino;
    if (!c.owned) return;
    var day = dayOf(s.slot);
    if (c.lastOpsDay >= day) return;
    c.lastOpsDay = day;

    var rep = c.reputation;
    var dealers = casinoStaffedCount(s, 'dealer');
    var security = casinoStaffedCount(s, 'security');
    var cashiers = casinoStaffedCount(s, 'cashier');
    var income = 0, notes = [];

    var gameRooms = 0;
    CASINO_ROOMS.forEach(function (r) {
      var st = c.rooms[r.id];
      if (!st || st.status !== 'ready') return;
      gameRooms++;
      var eff = dealers > 0 ? 1 : .3;
      var rev = (r.game === 'board' ? 6 : 14) * (0.5 + rep / 100) * eff * (security > 0 ? 1 : .85);
      rev = Math.round(rev);
      if (rev > 0) { income += rev; notes.push(r.name + ' took ' + rev + 'g'); }
    });
    if (gameRooms > 0) {
      var upkeep = gameRooms * 4 + (security > 0 ? 6 : 2) + (cashiers > 0 ? 2 : 0);
      income -= upkeep;
      ledgerNote(s, 'casino', 'upkeep', -upkeep, 'Nightly upkeep for ' + gameRooms + ' game rooms');
    }

    if (c.rooms.hall_bar && c.rooms.hall_bar.status === 'ready') {
      var bar = Math.round((8 + gameRooms * 5) * (0.5 + rep / 100));
      income += bar; ledgerNote(s, 'casino', 'bar', bar, 'Hall bar takings'); notes.push('bar ' + bar + 'g');
    }

    var housekeeper = casinoStaffedCount(s, 'housekeep');
    var reception = casinoStaffedCount(s, 'reception');
    var hIds = Object.keys(c.hotel.rooms);
    for (var i = 0; i < hIds.length; i++) {
      var room = c.hotel.rooms[hIds[i]], def = casinoRoom(hIds[i]);
      if (!room || room.status !== 'ready') continue;
      if (room.guest) {
        room.nightsLeft -= 1;
        room.clean = clamp(room.clean - 12, 0, 100);
        if (room.nightsLeft <= 0) {
          var tip = def.suite ? ri(4, 10) : ri(0, 3);
          if (tip && c.rooms.hall_bar) { income += tip; }
          logLine(s, (def.suite ? 'The suite guest' : 'A guest') + ' checks out of ' + def.name + '.');
          room.guest = null;
        }
      } else {
        var p = .18 + rep / 300 + (reception > 0 ? .12 : 0) + (def.suite ? -0.05 : 0) + (c.rooms.reception && c.rooms.reception.status === 'ready' ? .05 : 0);
        if (chance(p)) {
          var nights = def.suite ? ri(1, 2) : ri(1, 3);
          var rate = room.rate;
          var pay = rate * nights;
          c.treasury += pay;
          ledgerNote(s, 'casino', 'hotel', pay, def.name + ': ' + nights + ' night(s) at ' + rate + 'g');
          room.guest = { name: pick(FIRST_NAMES) + ' ' + pick(LAST_NAMES), nights: nights };
          room.nightsLeft = nights;
          logLine(s, (def.suite ? 'A grand guest takes the Lantern Suite for ' + nights + ' night(s) — ' : 'A guest takes ' + def.name + ' for ' + nights + ' night(s) — ') + pay + 'g, to the treasury.');
        }
      }
      if (room.guest && room.clean < 40 && housekeeper === 0 && chance(.5)) {
        c.reputation = clamp(c.reputation - 1, 0, 100);
        logLine(s, 'A guest complains about the state of ' + def.name + '. (No housekeeper on staff.)');
      }
    }
    if (housekeeper > 0) {
      var cleaned = 0;
      for (var k = 0; k < hIds.length && cleaned < 2 * housekeeper; k++) {
        var room2 = c.hotel.rooms[hIds[k]];
        if (room2 && room2.status === 'ready' && room2.clean < 100) { room2.clean = 100; cleaned++; }
      }
    }

    if (c.stage.ready) {
      var singers = casinoStaffedCount(s, 'singer');
      if (singers > 0 && chance(.65)) {
        var show = Math.round((18 + singers * 10) * (0.5 + rep / 100));
        income += show;
        ledgerNote(s, 'casino', 'stage', show, 'Stage show receipts');
        notes.push('a full house for the show');
      }
    }
    if (c.lounge.ready && c.lounge.enabled) {
      var dancers = casinoStaffedCount(s, 'dancer');
      for (var d = 0; d < dancers; d++) {
        var emp = findEmployeeByRole(s, 'dancer', d);
        if (!emp) break;
        if (!emp.privateOk) { continue; }
        if (emp.morale < 40) { emp.refuses++; logLine(s, emp.name + ' declines her lounge bookings tonight — she is not happy enough to take them.'); continue; }
        var take = Math.round(20 + emp.attributes.charm * .3 + rep * .2);
        var share = Math.round(take * .4);
        income += take - share;
        emp.wage += 0;
        emp.experience += 1;
        ledgerNote(s, 'casino', 'lounge', take - share, 'Private lounge (after ' + emp.name + "'s 40% share)");
        logLine(s, emp.name + ' took private bookings in the lounge; her share comes to ' + share + 'g.');
      }
    }

    if (income !== 0) {
      c.treasury = Math.max(0, c.treasury + income);
      ledgerNote(s, 'casino', 'operations', income, 'Nightly operations');
    }
    var repDelta = (gameRooms > 0 ? 1 : 0) + (notes.length > 2 ? 1 : 0) - (c.reputation > 0 && gameRooms === 0 ? 0 : 0);
    c.reputation = clamp(c.reputation + repDelta - (income < 0 ? 1 : 0), 0, 100);
    if (notes.length) logLine(s, 'The Lantern ran tonight: ' + notes.join(', ') + '. Treasury now ' + Math.floor(c.treasury) + 'g.');
    else if (c.owned) logLine(s, 'The Lantern sat dark tonight. Its rooms wait for staff and stock.');
  }
  function findEmployeeByRole(s, roleId, nth) {
    var ids = Object.keys(s.wexp.employees), found = 0;
    for (var i = 0; i < ids.length; i++) {
      var e = s.wexp.employees[ids[i]];
      if (e.business === 'casino' && e.role === roleId) { if (found === (nth || 0)) return e; found++; }
    }
    return null;
  }

  /* --- player-playable games (personal gambling, gold straight from the strongbox) --- */
  function gameStakes(s, roomId) {
    var c = s.wexp.businesses.casino;
    var def = casinoRoom(roomId);
    var tierUp = c.rooms[roomId] && c.rooms[roomId].tier === 2;
    var min = def.minStake, max = def.maxStake;
    if (tierUp) { min *= 2; max *= 4; }
    return { min: min, max: max };
  }
  function upgradeStakes(roomId) {
    edit(function (s) {
      ensureWexp(s);
      var c = s.wexp.businesses.casino;
      var st = c.rooms[roomId];
      if (!st || st.status !== 'ready') return;
      if (st.tier === 2) return;
      var cost = 500;
      if (s.economy.gold < cost) { logLine(s, 'Raising the table limits costs ' + cost + 'g in reserve coin.'); return; }
      addGold(s, -cost); st.tier = 2;
      ledgerNote(s, 'casino', 'restore', -cost, 'Raised table limits');
      logLine(s, 'The table limits are raised. Deeper pockets come through the door.');
    });
  }

  /* One-and-Twenty — blackjack-family game against the house */
  function cardValue(hand) {
    var v = 0, aces = 0;
    for (var i = 0; i < hand.length; i++) {
      var r = hand[i];
      if (r === 1) { aces++; v += 11; }
      else if (r >= 11) v += 10;
      else v += r;
    }
    while (v > 21 && aces > 0) { v -= 10; aces--; }
    return v;
  }
  var CARD_GAME = { player: [], dealer: [], stake: 0, state: 'bet' };

  /* Cast the Bones — dice */
  var DICE_GAME = { state: 'bet', dice: [0, 0], wager: 0, side: null };

  /* Nine Men's Morris — full rules vs a heuristic AI */
  var MILLS = [
    [0,1,2],[3,4,5],[6,7,8],[9,10,11],[12,13,14],[15,16,17],[18,19,20],[21,22,23],
    [0,9,21],[3,10,18],[6,11,15],[1,4,7],[16,19,22],[8,12,17],[5,13,20],[2,14,23]
  ];
  var ADJ = {
    0:[1,9], 1:[0,2,4], 2:[1,14], 3:[4,10], 4:[1,3,5,7], 5:[4,13], 6:[7,11], 7:[4,6,8], 8:[7,12],
    9:[0,10,21], 10:[3,9,11,18], 11:[6,10,15], 12:[8,13,17], 13:[5,12,14,20], 14:[2,13,23],
    15:[11,16], 16:[15,17,19], 17:[12,16], 18:[10,19], 19:[16,18,20,22], 20:[13,19],
    21:[9,22], 22:[19,21,23], 23:[14,22]
  };
  var MORRIS = { board: new Array(24), phase: 'place', toPlace: 9, turn: 'P', selected: -1, state: 'idle', remove: false };

  function millsAt(board, idx) {
    var count = 0;
    for (var i = 0; i < MILLS.length; i++) {
      var m = MILLS[i];
      if (m.indexOf(idx) >= 0 && board[m[0]] && board[m[0]] === board[m[1]] && board[m[1]] === board[m[2]]) count++;
    }
    return count;
  }
  function morrisStart(roomId) {
    var s = rawState();
    var stakes = gameStakes(s, roomId);
    if (roomId === 'board_room') { stakes = { min: 10, max: 100 }; }
    if (s.economy.gold < stakes.min) {
      edit(function (st) { logLine(st, 'The table minimum is ' + stakes.min + 'g.'); });
      return;
    }
    MORRIS.board = new Array(24); MORRIS.phase = 'place'; MORRIS.toPlace = 9; MORRIS.turn = 'P';
    MORRIS.selected = -1; MORRIS.state = 'play'; MORRIS.remove = false; MORRIS.stake = Math.max(stakes.min, Math.min(stakes.max, 25)); MORRIS.room = roomId;
    edit(function (st) { addGold(st, -MORRIS.stake); ledgerNote(st, 'personal', 'leisure', -MORRIS.stake, 'Nine Men\'s Morris entry'); });
  }
  function morrisMillsPlayer(board, who) {
    var count = 0;
    for (var i = 0; i < MILLS.length; i++) {
      var m = MILLS[i];
      if (board[m[0]] === who && board[m[1]] === who && board[m[2]] === who) count++;
    }
    return count;
  }
  function morrisOnBoard(board, who) {
    var n = 0;
    for (var i = 0; i < 24; i++) if (board[i] === who) n++;
    return n;
  }
  function morrisHasMove(board, who) {
    if (MORRIS.phase === 'place') return true;
    for (var i = 0; i < 24; i++) {
      if (board[i] !== who) continue;
      var adj = ADJ[i];
      for (var j = 0; j < adj.length; j++) if (!board[adj[j]]) return true;
    }
    return false;
  }
  function morrisEndCheck() {
    var B = MORRIS.board;
    if (MORRIS.phase === 'move') {
      var pN = morrisOnBoard(B, 'P'), aN = morrisOnBoard(B, 'A');
      if (pN < 3) return 'A';
      if (aN < 3) return 'P';
      if (!morrisHasMove(B, 'A')) return 'P';
      if (!morrisHasMove(B, 'P')) return 'A';
    }
    return null;
  }
  function morrisAiRemove(board) {
    for (var i = 0; i < 24; i++) if (board[i] === 'P' && millsAt(board, i) > 0) return i;
    for (var j = 0; j < 24; j++) if (board[j] === 'P') return j;
    return -1;
  }
  function morrisAiTurn() {
    var B = MORRIS.board;
    if (MORRIS.remove) {
      var r = morrisAiRemove(B);
      if (r >= 0 && millsAt(B, r) === 0) { B[r] = 0; }
      else { for (var z = 0; z < 24; z++) if (B[z] === 'P') { B[z] = 0; break; } }
      MORRIS.remove = false; MORRIS.turn = 'P';
      return;
    }
    if (MORRIS.phase === 'place') {
      var best = -1;
      for (var i = 0; i < 24; i++) {
        if (B[i]) continue;
        B[i] = 'A';
        var makes = millsAt(B, i);
        B[i] = 0;
        if (makes > 0 && best < 0) { best = i; break; }
      }
      if (best < 0) {
        for (var j = 0; j < 24; j++) {
          if (B[j]) continue;
          B[j] = 'P';
          var blocks = millsAt(B, j);
          B[j] = 0;
          if (blocks > 0) { best = j; break; }
        }
      }
      if (best < 0) { var empties = []; for (var q = 0; q < 24; q++) if (!B[q]) empties.push(q); best = pick(empties); }
      B[best] = 'A';
      if (millsAt(B, best) > 0) MORRIS.remove = true; else MORRIS.turn = 'P';
      if (MORRIS.toPlace <= 0) {}
      return;
    }
    /* movement phase: pick a piece, prefer moves that make a mill, else block, else random */
    var moves = [];
    for (var f = 0; f < 24; f++) {
      if (B[f] !== 'A') continue;
      var adj = ADJ[f];
      for (var t = 0; t < adj.length; t++) if (!B[adj[t]]) moves.push([f, adj[t]]);
    }
    if (!moves.length) return;
    var scored = [];
    for (var m = 0; m < moves.length; m++) {
      var from = moves[m][0], to = moves[m][1];
      B[from] = 0; B[to] = 'A';
      var sc = millsAt(B, to) * 10;
      B[to] = 0; B[from] = 'A';
      B[to] = 'P';
      sc += millsAt(B, to) * 6;
      B[to] = 0;
      scored.push({ mv: moves[m], sc: sc });
    }
    scored.sort(function (a, b) { return b.sc - a.sc; });
    var mv2 = scored[0].mv;
    B[mv2[0]] = 0; B[mv2[1]] = 'A';
    if (millsAt(B, mv2[1]) > 0) MORRIS.remove = true; else MORRIS.turn = 'P';
  }
  function morrisPlayerAction(pos) {
    var B = MORRIS.board, s = rawState();
    if (MORRIS.state !== 'play' || MORRIS.turn !== 'P') return;
    var endOfTurn = function (removedMill) {
      var winner = morrisEndCheck();
      if (winner) {
        MORRIS.state = 'done';
        if (winner === 'P') {
          var prize = MORRIS.stake * 2;
          edit(function (st) { addGold(st, prize); ledgerNote(st, 'personal', 'leisure', prize, 'Nine Men\'s Morris win'); logLine(st, 'You win the morris match — ' + prize + 'g back, ' + (prize - MORRIS.stake) + 'g to the good.'); });
        } else edit(function (st) { logLine(st, 'The house player takes the morris match. Your stake stays on the table.'); });
        return;
      }
      if (!removedMill) MORRIS.turn = 'A';
    };
    if (MORRIS.remove) {
      if (B[pos] === 'A' && millsAt(B, pos) === 0) { B[pos] = 0; MORRIS.remove = false; endOfTurn(true); }
      else if (B[pos] === 'A') {
        var allInMills = true;
        for (var z = 0; z < 24; z++) if (B[z] === 'A' && millsAt(B, z) === 0) allInMills = false;
        if (allInMills) { B[pos] = 0; MORRIS.remove = false; endOfTurn(true); }
      }
      return;
    }
    if (MORRIS.phase === 'place') {
      if (B[pos]) return;
      B[pos] = 'P'; MORRIS.toPlace--;
      if (millsAt(B, pos) > 0) { MORRIS.remove = true; }
      else {
        if (MORRIS.toPlace <= 0) MORRIS.phase = 'move';
        endOfTurn(false);
      }
      return;
    }
    if (MORRIS.selected < 0) {
      if (B[pos] === 'P') MORRIS.selected = pos;
      return;
    }
    if (pos === MORRIS.selected) { MORRIS.selected = -1; return; }
    if (!B[pos] && ADJ[MORRIS.selected].indexOf(pos) >= 0) {
      B[MORRIS.selected] = 0; B[pos] = 'P'; MORRIS.selected = -1;
      if (millsAt(B, pos) > 0) { MORRIS.remove = true; }
      else endOfTurn(false);
    } else if (B[pos] === 'P') MORRIS.selected = pos;
    else MORRIS.selected = -1;
  }
  function morrisAdvanceAi() {
    if (MORRIS.state !== 'play' || MORRIS.turn !== 'A') return;
    morrisAiTurn();
    var winner = morrisEndCheck();
    if (winner) {
      MORRIS.state = 'done';
      if (winner === 'P') {
        var prize = MORRIS.stake * 2;
        edit(function (st) { addGold(st, prize); logLine(st, 'You win the morris match — ' + prize + 'g.'); });
      } else edit(function (st) { logLine(st, 'The house takes the morris match.'); });
    }
  }
  function morrisFinishTime() {
    edit(function (s) { s.slot += 45; spendEnergy(s, 5); logLine(s, 'You step away from the morris board. (' + hhmm(s.slot) + ')'); });
  }

  /* One-and-Twenty play */
  function newCard() { return ri(1, 13); }
  function startCards(stake) {
    var s = rawState();
    var stakes = gameStakes(s, 'card_room');
    stake = clamp(stake, stakes.min, stakes.max);
    if (s.economy.gold < stake) { logLine(s, 'You are short of the stake.'); return; }
    edit(function (st) { addGold(st, -stake); ledgerNote(st, 'personal', 'leisure', -stake, 'One-and-Twenty stake'); });
    CARD_GAME.player = [newCard(), newCard()];
    CARD_GAME.dealer = [newCard()];
    CARD_GAME.stake = stake; CARD_GAME.state = 'play';
    if (cardValue(CARD_GAME.player) === 21) resolveCards('stand');
  }
  function resolveCards(action) {
    if (CARD_GAME.state !== 'play') return;
    if (action === 'hit') CARD_GAME.player.push(newCard());
    var pv = cardValue(CARD_GAME.player);
    if (pv > 21) { CARD_GAME.state = 'done'; cardsPayout(false, 'You bust.'); return; }
    if (action === 'stand') {
      while (cardValue(CARD_GAME.dealer) < 17) CARD_GAME.dealer.push(newCard());
      var dv = cardValue(CARD_GAME.dealer);
      CARD_GAME.state = 'done';
      if (dv > 21 || pv > dv) cardsPayout(true, pv === 21 && CARD_GAME.player.length === 2 ? 'One-and-twenty on the deal!' : 'You outdraw the house.');
      else if (pv === dv) cardsPush('A stand-off. Your stake returns.');
      else cardsPayout(false, 'The house takes it.');
    }
  }
  function cardsPayout(win, text) {
    var stake = CARD_GAME.stake;
    edit(function (s) {
      if (win) {
        var prize = stake * 2 + (text.indexOf('One-and-twenty') === 0 ? Math.ceil(stake / 2) : 0);
        addGold(s, prize);
        logLine(s, text + ' The dealer pays ' + prize + 'g.');
      } else logLine(s, text + ' Your ' + stake + 'g stake stays with the house.');
    });
  }
  function cardsPush(text) {
    edit(function (s) { addGold(s, CARD_GAME.stake); logLine(s, text); });
  }

  /* Dice play */
  function startDice(wager, side) {
    var s = rawState();
    var stakes = gameStakes(s, 'dice_room');
    wager = clamp(wager, stakes.min, stakes.max);
    if (s.economy.gold < wager) { logLine(s, 'You are short of the wager.'); return; }
    DICE_GAME.wager = wager; DICE_GAME.side = side;
    edit(function (st) { addGold(st, -wager); ledgerNote(st, 'personal', 'leisure', -wager, 'Cast the Bones wager'); });
    var d1 = ri(1, 6), d2 = ri(1, 6), sum = d1 + d2;
    DICE_GAME.dice = [d1, d2]; DICE_GAME.state = 'done';
    edit(function (st) {
      var win = 0;
      if (side === 'under' && sum < 7) win = Math.ceil(wager * 2.2);
      else if (side === 'over' && sum > 7) win = Math.ceil(wager * 2.2);
      else if (side === 'seven' && sum === 7) win = wager * 5;
      if (win > 0) { addGold(st, win); logLine(st, 'The bones read ' + d1 + ' and ' + d2 + '. ' + sum + ' — you win ' + win + 'g.'); }
      else logLine(st, 'The bones read ' + d1 + ' and ' + d2 + '. ' + sum + ' — the house keeps your ' + wager + 'g.');
      DICE_GAME.state = 'bet';
    });
  }

  /* ================= 10. UI — Village panel inside the House pane, actions in Actions pane ================= */
  var overlayEl = null, overlayContent = null;

  function ensureOverlay() {
    if (overlayEl && document.body.contains(overlayEl)) return;
    overlayEl = document.createElement('div');
    overlayEl.id = 'wexp-overlay';
    overlayEl.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4';
    overlayEl.style.display = 'none';
    overlayContent = document.createElement('div');
    overlayContent.className = 'w-full max-w-3xl flex flex-col bg-stone-900 border border-stone-700 rounded-lg shadow-2xl';
    overlayContent.style.maxHeight = '88dvh';
    overlayContent.addEventListener('click', function (e) { e.stopPropagation(); });
    overlayEl.appendChild(overlayContent);
    document.body.appendChild(overlayEl);
    overlayEl.addEventListener('click', function () { closeOverlay(); });
  }
  function closeOverlay() { if (overlayEl) overlayEl.style.display = 'none'; }
  function openOverlay(builder) { ensureOverlay(); builder.render(overlayContent); overlayEl.style.display = 'flex'; }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function btn(label, desc, onClick, opts) {
    opts = opts || {};
    var b = el('button', 'w-full min-w-0 select-none text-left px-[0.85rem] py-[0.7rem] desk:p-3 min-h-[2.75rem] desk:min-h-0 flex flex-col justify-center rounded-lg ' +
      (opts.primary ? 'bg-amber-700 hover:bg-amber-600 border-amber-600 border-y desk:border' : 'bg-stone-800 hover:bg-stone-700 border-stone-700 border-y desk:border') +
      ' disabled:opacity-40 disabled:cursor-not-allowed transition-colors');
    var inner = '<span class="text-sm text-stone-100">' + esc(label) + (opts.hotkey ? ' <span class="text-stone-500 text-xs">' + esc(opts.hotkey) + '</span>' : '') + '</span>';
    if (desc) inner += '<span class="text-xs text-stone-400 mt-0.5">' + desc + '</span>';
    b.innerHTML = inner;
    b.disabled = !!opts.disabled;
    b.addEventListener('click', onClick);
    return b;
  }
  function smallBtn(label, onClick, opts) {
    opts = opts || {};
    var b = el('button', 'px-2 py-0.5 rounded text-[0.65rem] border ' +
      (opts.primary ? 'bg-amber-700 border-amber-600 text-stone-100 hover:bg-amber-600' : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700') +
      (opts.dim ? ' opacity-60' : ''));
    b.innerHTML = label;
    if (opts.title) b.title = opts.title;
    b.addEventListener('click', function (e) { e.stopPropagation(); onClick(); });
    return b;
  }
  function goldBadge() {
    var s = rawState();
    return esc(s && s.economy ? Math.floor(s.economy.gold) : 0) + 'g';
  }
  function timeBadge() {
    var s = rawState();
    return s ? ('Day ' + dayOf(s.slot) + ' \u00b7 ' + hhmm(s.slot)) : '';
  }

  /* ---------- screen state (lives in wexp.city.screen, survives reloads) ---------- */
  function cityOf(s) { return (s && s.wexp && s.wexp.city) || { inside: false, screen: 'village', companion: null }; }
  function scrRaw(s) { var c = cityOf(s); return c.screen || 'village'; }
  function scrKind(s) { var sc = scrRaw(s); var i = sc.indexOf(':'); return i < 0 ? sc : sc.slice(0, i); }
  function scrArg(s) { var sc = scrRaw(s); var i = sc.indexOf(':'); return i < 0 ? null : sc.slice(i + 1); }
  function nav(screen) {
    edit(function (st) {
      ensureWexp(st);
      st.wexp.city.screen = screen;
      if (screen && screen.indexOf('shop:') === 0) { var d = SHOP_BY_ID[screen.slice(5)]; if (d) restock(st, d); }
    });
    rerender();
  }
  function rerender() {
    var s = rawState(); if (!s) return;
    ensureWexp(s);
    if (!s.wexp || !s.wexp.city || !s.wexp.city.inside) { hideTownPanel(); if (actionsEl) actionsEl.innerHTML = ''; if (overlayEl) overlayEl.style.display = 'none'; return; }
    if (!renderTownPanel()) renderTownOverlay();
    renderTownActions();
  }

  /* ---------- the panel: absolutely positioned over the house map, React-safe ---------- */
  var panelEl = null, actionsEl = null;
  function houseWrapper() {
    var fold = document.querySelector('button[title="Fold the map"]');
    if (!fold) return null;
    var rootX8 = fold.closest ? fold.closest('.flex.flex-col.h-full.min-h-0') : null;
    var wrap = rootX8 ? rootX8.parentElement : fold.parentElement;
    if (!wrap || wrap === document.body) return null;
    return wrap;
  }
  function ensureTownPanel() {
    var wrap = houseWrapper();
    if (!wrap) return null;
    if (panelEl && wrap.contains(panelEl)) return panelEl;
    hideTownPanel();
    panelEl = document.createElement('div');
    panelEl.id = 'wexp-town-panel';
    panelEl.setAttribute('data-wexp', 'town-panel');
    panelEl.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;overflow-y:auto;background:#1c1917;padding:0.5rem;z-index:5;';
    wrap.style.position = 'relative';
    wrap.appendChild(panelEl);
    return panelEl;
  }
  function hideTownPanel() { if (panelEl) { try { panelEl.remove(); } catch (e) { } panelEl = null; } }

  /* ---------- the Actions pane container: trails the game's own buttons ---------- */
  function ensureTownActions() {
    var btns = document.querySelectorAll('button');
    var goOut = null, i;
    for (i = 0; i < btns.length; i++) {
      if (btns[i].getAttribute('data-wexp')) continue;
      var t = btns[i].textContent || '';
      if (t.indexOf('Go out') >= 0 && !btns[i].disabled) { goOut = btns[i]; break; }
    }
    if (!goOut) { if (actionsEl) { try { actionsEl.remove(); } catch (e) { } actionsEl = null; } return null; }
    var parent = goOut.parentElement;
    if (!parent) return null;
    if (actionsEl && actionsEl.parentElement === parent) return actionsEl;
    if (actionsEl) { try { actionsEl.remove(); } catch (e) { } }
    actionsEl = document.createElement('div');
    actionsEl.id = 'wexp-town-actions';
    actionsEl.setAttribute('data-wexp', 'town-actions');
    actionsEl.className = 'space-y-2 mt-2';
    parent.appendChild(actionsEl);
    return actionsEl;
  }

  /* ---------- shared small pieces ---------- */
  function sectionLabel(text) { return el('div', 'mt-1.5 pt-1.5 border-t border-stone-800 text-[0.55rem] uppercase tracking-widest text-stone-700 mb-1', esc(text)); }
  function chip(inner, tone) {
    var tones = {
      open: 'bg-amber-950/60 border-amber-900/70 text-amber-200',
      dim: 'bg-stone-800 border-stone-700 text-stone-400',
      here: 'bg-blue-900/60 border-blue-700 text-blue-200',
      warn: 'bg-rose-950/60 border-rose-900 text-rose-300'
    };
    return '<span class="px-1 py-0 rounded border text-[0.65rem] ' + (tones[tone] || tones.dim) + '">' + esc(inner) + '</span>';
  }
  function locCard(opts) {
    var cls = 'p-1.5 rounded border text-xs leading-tight min-w-0 flex-1 ';
    if (opts.here) cls += 'border-blue-700 bg-stone-800';
    else if (opts.dim) cls += 'border-dashed border-stone-800 bg-stone-900/30';
    else cls += 'border-stone-800 bg-stone-900/40';
    if (opts.onClick) cls += ' cursor-pointer hover:brightness-125 hover:ring-1 hover:ring-amber-700/70 transition';
    var card = el('div', cls);
    var head = el('div', 'text-[0.65rem] uppercase tracking-wider text-stone-500 mb-0.5 flex items-center justify-between gap-1 flex-wrap',
      '<span>' + esc(opts.title) + '</span>' + (opts.chip || ''));
    card.appendChild(head);
    if (opts.body) card.appendChild(el('div', 'text-[0.7rem] ' + (opts.dim ? 'text-stone-600 italic' : 'text-stone-400'), opts.body));
    if (opts.onClick) card.addEventListener('click', opts.onClick);
    return card;
  }
  function moodLabel(v) { return v > 80 ? 'happy' : v > 60 ? 'content' : v > 35 ? 'okay' : v > 15 ? 'unhappy' : 'miserable'; }
  function energyLabel(v) { return v > 80 ? 'fresh' : v > 55 ? 'steady' : v > 30 ? 'tired' : 'spent'; }
  function statOr(char, k, dflt) { return char && char.stats && char.stats[k] != null ? Math.round(char.stats[k]) : dflt; }
  function companionOf(s) {
    var id = s.wexp.city.companion;
    if (!id) return null;
    if (id === 'wife') {
      var w = wifeOf(s);
      return w ? { id: 'wife', name: w.name, label: 'your wife', mood: statOr(w, 'mood', 60), energy: statOr(w, 'energy', 70) } : null;
    }
    var e = s.wexp.employees[id];
    return e ? { id: id, name: e.name, label: ROLE_BY_ID[e.role] ? ROLE_BY_ID[e.role].label : e.role, mood: e.morale != null ? e.morale : 60, energy: e.energy != null ? e.energy : 70 } : null;
  }
  function setCompanion(id) {
    edit(function (st) {
      ensureWexp(st);
      st.wexp.city.companion = id || null;
      if (id === 'wife') logLine(st, wifeName(st) + ' takes your arm and you step out together.');
      else if (id && st.wexp.employees[id]) logLine(st, 'You head out with ' + st.wexp.employees[id].name + '.');
      else if (!id) logLine(st, 'You go your own way for a while.');
    });
    rerender();
  }
  function companionStrip(s) {
    var c = companionOf(s);
    if (!c) return null;
    var d = el('div', 'mb-1.5 p-1.5 rounded border border-stone-800 bg-stone-900/60 text-xs leading-tight');
    d.innerHTML = '<div class="flex items-center justify-between gap-2 flex-wrap">' +
      '<span class="text-[0.7rem] text-stone-200">' + esc(c.name) + ' <span class="text-stone-500">\u00b7 ' + esc(c.label) + '</span></span>' +
      '<span class="flex gap-1 flex-wrap">' + chip('mood: ' + moodLabel(c.mood), 'here') + chip('energy: ' + energyLabel(c.energy), 'dim') + '</span></div>';
    return d;
  }

  /* ---------- panel frame + screen dispatch ---------- */
  function screenTitle(s) {
    var kind = scrKind(s), arg = scrArg(s);
    if (kind === 'shop' && SHOP_BY_ID[arg]) return SHOP_BY_ID[arg].name;
    if (kind === 'friend') { var f = s.wexp.friend || ensureFriend(s); return f.name + "'s home"; }
    if (kind === 'outing' && OUTING_BY_ID[arg]) return OUTING_BY_ID[arg].name;
    if (kind === 'hiring') return 'Hiring Hall';
    if (kind === 'ledger') return 'The Gilded Lantern \u2014 ledger';
    if (kind === 'casino_buy') return 'The Gilded Lantern \u2014 for sale';
    if (kind === 'game' && casinoRoom(arg)) return casinoRoom(arg).name + ' \u2014 play a hand';
    if (kind === 'casino' && s.wexp.businesses.casino.owned) return s.wexp.businesses.casino.name;
    return 'Village \u2014 Whisperwood';
  }
  function backTarget(s) {
    var kind = scrKind(s);
    if (kind === 'ledger') return 'casino';
    return kind === 'village' ? null : 'village';
  }
  function renderTownPanel() {
    var pane = ensureTownPanel();
    if (!pane) return false;
    var s = rawState(); ensureWexp(s);
    pane.innerHTML = '';
    var kind = scrKind(s), arg = scrArg(s), back = backTarget(s);

    var head = el('div', 'flex items-baseline justify-between gap-2 mb-1.5 px-1 flex-wrap');
    head.appendChild(el('div', 'min-w-0',
      '<div class="text-[0.62rem] font-semibold uppercase tracking-widest text-amber-400">' + esc(screenTitle(s)) + '</div>' +
      '<div class="text-[0.65rem] text-stone-500">' + timeBadge() + ' \u00b7 ' + goldBadge() + '</div>'));
    var right = el('div', 'flex gap-1 shrink-0');
    if (back) right.appendChild(smallBtn('\u2190 ' + (back === 'casino' ? 'The Lantern' : 'Village'), function () { nav(back); }));
    right.appendChild(smallBtn('Head home \u2302', function () { leaveCity(); }, { title: 'End the town trip' }));
    head.appendChild(right);
    pane.appendChild(head);

    var strip = companionStrip(s);
    if (strip) pane.appendChild(strip);

    var body = el('div', 'space-y-1.5');
    pane.appendChild(body);
    if (kind === 'shop') vbShop(body, s, arg);
    else if (kind === 'friend') vbFriend(body, s);
    else if (kind === 'outing') vbOuting(body, s, arg);
    else if (kind === 'hiring') vbHiring(body, s);
    else if (kind === 'casino') vbCasino(body, s);
    else if (kind === 'casino_buy') vbCasinoBuy(body, s);
    else if (kind === 'ledger') vbLedger(body, s);
    else if (kind === 'game') vbGame(body, s, arg);
    else vbVillage(body, s);
    return true;
  }

  /* ---------- Actions pane content (character verbs) ---------- */
  function renderTownActions() {
    var c = ensureTownActions();
    if (!c) return;
    var s = rawState(); ensureWexp(s);
    c.innerHTML = '';
    if (!s.wexp || !s.wexp.city || !s.wexp.city.inside) return;
    var kind = scrKind(s), arg = scrArg(s);
    if (kind === 'shop') abShop(c, s, arg);
    else if (kind === 'friend') abFriend(c, s);
    else if (kind === 'outing') abOuting(c, s, arg);
    else if (kind === 'hiring') abHiring(c, s);
    else if (kind === 'casino') abCasino(c, s);
    else if (kind === 'casino_buy') abCasinoBuy(c, s);
    else if (kind === 'ledger') abLedger(c, s);
    else if (kind === 'game') abGame(c, s, arg);
    else abVillage(c, s);
    var back = backTarget(s);
    if (back) c.appendChild(btn('\u2190 ' + (back === 'casino' ? 'The Lantern' : 'Village'), 'Back to the village map', function () { nav(back); }));
    c.appendChild(btn('Head home', 'End the town trip and walk back up the lane', function () { leaveCity(); }, { primary: !back }));
  }

  /* ================= Village map (rooms-style cards) ================= */
  function vbVillage(body, s) {
    var w = s.wexp, day = dayOf(s.slot), renown = (s.tavernReputation && s.tavernReputation.renown) || 0;
    body.appendChild(sectionLabel('Shops & traders'));
    var grid = el('div', 'flex flex-wrap gap-1.5');
    body.appendChild(grid);
    SHOP_DEFS.forEach(function (def) {
      if (def.id === 'clothier') return;
      var open = openNow(s.slot, def.hours);
      var gated = def.renownGate && renown < def.renownGate;
      var here = scrKind(s) === 'shop' && scrArg(s) === def.id;
      var card = locCard({
        title: def.name,
        chip: gated ? chip('renown ' + def.renownGate + ' needed', 'warn') : (open ? chip('open', 'open') : chip('closed \u00b7 ' + hoursText(def.hours), 'dim')),
        body: open ? esc(def.desc) : esc(def.desc),
        dim: !open || gated,
        here: here,
        onClick: function () {
          if (gated) { alertInline('Cybil serves strangers with renown only \u2014 come back when the tavern is better known.'); return; }
          nav('shop:' + def.id);
        }
      });
      grid.appendChild(card);
    });
    var clothier = locCard({
      title: "The Clothier's Shop",
      chip: chip('via Go out\u2026', 'dim'),
      body: 'Outfits, try-ons and fittings \u2014 use <span class="text-stone-300">Go out\u2026 \u2192 Visit the clothier</span>. The fitting mirror is worth the walk.'
    });
    grid.appendChild(clothier);

    body.appendChild(sectionLabel("Out & about \u2014 with " + wifeName(s)));
    var grid2 = el('div', 'flex flex-wrap gap-1.5');
    body.appendChild(grid2);
    var f = w.friend || ensureFriend(s);
    var fDone = w.outings.cooldown['friend'] != null && w.outings.cooldown['friend'] >= day;
    grid2.appendChild(locCard({
      title: f.name + "'s home",
      chip: fDone ? chip('visited today', 'dim') : chip('ready for a call', 'open'),
      body: esc(f.relation) + ' \u2014 ' + esc(f.homeName),
      here: scrKind(s) === 'friend',
      onClick: function () { nav('friend'); }
    }));
    OUTINGS.forEach(function (o) {
      var done = w.outings.cooldown[o.id] != null && w.outings.cooldown[o.id] >= day;
      grid2.appendChild(locCard({
        title: o.name,
        chip: done ? chip('been today', 'dim') : chip('open \u00b7 ' + hoursText(o.hours), 'open'),
        body: esc(o.desc) + ' <span class="text-stone-500">with ' + esc(wifeName(s)) + '</span>',
        here: scrKind(s) === 'outing' && scrArg(s) === o.id,
        onClick: function () { openOuting(o.id); }
      }));
    });

    body.appendChild(sectionLabel('Town business'));
    var grid3 = el('div', 'flex flex-wrap gap-1.5');
    body.appendChild(grid3);
    grid3.appendChild(locCard({
      title: 'Hiring Hall',
      chip: chip(w.staff.candidates.length + ' looking for work', 'dim'),
      body: 'Hire hands for the tavern or the Lantern. The pool turns over about once a week.',
      here: scrKind(s) === 'hiring',
      onClick: function () { nav('hiring'); }
    }));
    var c = w.businesses.casino;
    grid3.appendChild(locCard({
      title: c.name,
      chip: c.owned ? chip('yours \u00b7 treasury ' + Math.floor(c.treasury) + 'g', 'open') : chip('derelict \u00b7 ' + CASINO_PRICE + 'g', 'warn'),
      body: c.owned
        ? 'Three gaming rooms, the stage, the private lounge, hotel floors and the cellar vault.'
        : 'A burned-out gambling house by the east gate. The agent\u2019s board promises \u201cthree floors of fortune\u201d.',
      dim: !c.owned,
      here: scrKind(s) === 'casino' || scrKind(s) === 'casino_buy' || scrKind(s) === 'game' || scrKind(s) === 'ledger',
      onClick: function () { nav(c.owned ? 'casino' : 'casino_buy'); }
    }));
  }
  function openOuting(id) {
    var s = rawState();
    if (s && s.wexp && s.wexp.city && s.wexp.city.companion == null) setCompanion('wife');
    nav('outing:' + id);
  }
  function abVillage(c, s) {
    var comp = companionOf(s);
    if (comp) {
      c.appendChild(btn('Part ways \u2014 ' + comp.name + ' heads back', 'Walk the rest alone', function () { setCompanion(null); }));
    } else {
      c.appendChild(btn('Walk with ' + wifeName(s), 'Ask her to come along', function () { setCompanion('wife'); }));
      var ids = Object.keys(s.wexp.employees || {}).slice(0, 3);
      ids.forEach(function (id) {
        var e = s.wexp.employees[id];
        c.appendChild(btn('Take ' + e.name + ' along', ROLE_BY_ID[e.role] ? ROLE_BY_ID[e.role].label : '', function () { setCompanion(id); }));
      });
    }
  }

  /* ================= Shop screens ================= */
  function vbShop(body, s, shopId) {
    var def = SHOP_BY_ID[shopId];
    if (!def) { body.appendChild(el('div', 'text-sm text-stone-500', 'This shop is gone.')); return; }
    var ss = s.wexp.shops[shopId];
    body.appendChild(el('div', 'px-1 text-[0.7rem] text-stone-400 italic', esc(def.blurb()) + ' \u2014 ' + esc(def.vendor) + ', ' + hoursText(def.hours)));
    if (ss && ss.sessionDiscount < 1) body.appendChild(el('div', 'px-1 text-[0.7rem] text-amber-300', 'A haggled price holds for this visit (\u2212' + Math.round((1 - ss.sessionDiscount) * 100) + '%).'));

    body.appendChild(sectionLabel('For sale'));
    var lines = shopLines(s, def);
    if (!lines.length) body.appendChild(el('div', 'px-2 py-1.5 rounded border border-dashed border-stone-800 bg-stone-900/30 text-[0.7rem] text-stone-600 italic', 'Empty shelves today. Come back tomorrow.'));
    lines.forEach(function (l) {
      var bundles = l.bundles.map(function (b) { return (b.label || '\u00d7' + b.n) + ' ' + b.total + 'g'; }).join(' \u00b7 ');
      body.appendChild(el('div', 'px-2 py-1.5 rounded border border-stone-800 bg-stone-900/40 flex items-baseline justify-between gap-2 flex-wrap',
        '<span class="text-[0.72rem] text-stone-200">' + esc(l.name) + ' <span class="text-stone-500">\u00d7' + l.qty + '</span></span>' +
        '<span class="text-[0.7rem] text-stone-400">' + l.price + 'g each' + (bundles ? ' <span class="text-stone-500">\u00b7 ' + esc(bundles) + '</span>' : '') + '</span>'));
    });

    var sellables = playerSellables(s, def);
    if (sellables.length) {
      body.appendChild(sectionLabel('They buy from you'));
      sellables.forEach(function (p) {
        body.appendChild(el('div', 'px-2 py-1.5 rounded border border-stone-800 bg-stone-900/40 flex items-baseline justify-between gap-2',
          '<span class="text-[0.72rem] text-stone-200">' + esc(p.name) + ' <span class="text-stone-500">you have ' + p.count + '</span></span>' +
          '<span class="text-[0.7rem] text-amber-300">' + p.each + 'g each</span>'));
      });
    }

    var tried = ss && ss.haggleTried >= 2;
    body.appendChild(el('div', 'px-1 mt-1 text-[0.65rem] text-stone-600', tried ? 'The vendor has heard enough haggling today.' : 'You could try to talk the prices down for this visit.'));

    var recent = el('div', 'px-1 mt-1.5 text-[0.65rem] text-stone-600 space-y-0.5');
    (s.log || []).slice(-3).forEach(function (l) { recent.appendChild(el('div', '', '\u00b7 ' + esc(l.text))); });
    body.appendChild(recent);
  }
  function abShop(c, s, shopId) {
    var def = SHOP_BY_ID[shopId];
    if (!def) return;
    if (!openNow(s.slot, def.hours)) {
      c.appendChild(el('div', 'px-1 text-[0.7rem] text-stone-500 italic', esc(def.vendor) + "'s shutters are closed. Hours: " + hoursText(def.hours) + '.'));
      return;
    }
    var lines = shopLines(s, def);
    lines.forEach(function (l) {
      c.appendChild(btn('Buy 1 \u00b7 ' + l.price + 'g', l.name + ' \u00b7 ' + l.qty + ' on the shelf', function () { buyFromShop(shopId, l.key, 1); rerender(); }, { disabled: s.economy.gold < l.price }));
      l.bundles.forEach(function (b) {
        c.appendChild(btn((b.label || '\u00d7' + b.n) + ' \u00b7 ' + b.total + 'g', l.name, function () { buyFromShop(shopId, l.key, b.n, b.total); rerender(); }, { disabled: s.economy.gold < b.total }));
      });
    });
    var sellables = playerSellables(s, def);
    sellables.forEach(function (p) {
      c.appendChild(btn('Sell 1 \u00b7 ' + p.each + 'g', p.name + ' \u00b7 you have ' + p.count, function () { sellToShop(shopId, p.id, 1); rerender(); }));
      if (p.count > 1) c.appendChild(btn('Sell all \u00b7 ' + round1(p.each * p.count) + 'g', p.name + ' \u00d7' + p.count, function () { sellToShop(shopId, p.id, p.count); rerender(); }));
    });
    var ss = s.wexp.shops[shopId];
    var tried = ss && ss.haggleTried >= 2;
    c.appendChild(btn('Try to haggle', tried ? 'The vendor has heard enough today.' : 'Talk the prices down for this visit', function () { haggle(shopId); rerender(); }, { disabled: tried }));
  }

  /* ================= Friend screen ================= */
  function vbFriend(body, s) {
    var f = friendOf(s);
    body.appendChild(el('div', 'px-1 text-[0.72rem] text-stone-300', esc(f.name) + ' \u2014 ' + esc(f.relation) + '. Her home is ' + esc(f.homeName) + '.'));
    var recent = el('div', 'px-1 mt-1.5 text-[0.65rem] text-stone-600 space-y-0.5');
    (s.log || []).slice(-3).forEach(function (l) { recent.appendChild(el('div', '', '\u00b7 ' + esc(l.text))); });
    body.appendChild(recent);
  }
  function abFriend(c, s) {
    c.appendChild(btn('Stay for tea and talk', '50 min \u00b7 costs nothing', function () { visitFriend('chat'); rerender(); }));
    c.appendChild(btn('Bring wine, stay for supper', '2 hrs \u00b7 6g \u00b7 ' + wifeName(s) + ' lights up', function () { visitFriend('supper'); rerender(); }));
    c.appendChild(btn('Offer a hand around the house', '90 min \u00b7 mending, carrying, small kindnesses', function () { visitFriend('help'); rerender(); }));
  }

  /* ================= Outing screens ================= */
  function vbOuting(body, s, outingId) {
    var o = OUTING_BY_ID[outingId];
    if (!o) { body.appendChild(el('div', 'text-sm text-stone-500', 'That walk is closed off today.')); return; }
    var w = wifeOf(s);
    var mood = statOr(w, 'mood', 60);
    body.appendChild(el('div', 'px-1 text-[0.72rem] text-stone-300', esc(o.desc) + ' ' + esc(wifeName(s)) + ' is <span class="text-stone-100">' + esc(moodLabel(mood)) + '</span> today.'));
    body.appendChild(el('div', 'px-1 text-[0.7rem] text-stone-500', 'Your ease together: ' + s.wexp.outings.bond + '/100'));
    var recent = el('div', 'px-1 mt-1.5 text-[0.65rem] text-stone-600 space-y-0.5');
    (s.log || []).slice(-3).forEach(function (l) { recent.appendChild(el('div', '', '\u00b7 ' + esc(l.text))); });
    body.appendChild(recent);
  }
  function abOuting(c, s, outingId) {
    var o = OUTING_BY_ID[outingId];
    if (!o) return;
    var w = wifeOf(s);
    var mood = statOr(w, 'mood', 60);
    o.actions.forEach(function (a) {
      var cost = a.cost ? ' \u00b7 ' + a.cost + 'g' : '';
      var dis = (a.needMood != null && mood < a.needMood);
      c.appendChild(btn(a.label, a.mins + ' min' + cost + (dis ? ' \u00b7 she is not in the mood' : ''), function () { doOuting(outingId, a.id); rerender(); }, { disabled: dis }));
    });
  }

  /* ================= Hiring Hall ================= */
  function refreshCandidatesInEdit() { edit(function (s) { refreshCandidatesIfNeeded(s); }); }
  function skillSummary(sk) {
    var parts = [];
    Object.keys(sk || {}).forEach(function (k) { if (sk[k] > 0) parts.push(SKILL_NAMES[k] + ' ' + sk[k]); });
    return parts.length ? parts.join(', ') : 'no particular craft';
  }
  function attrSummary(at) {
    var best = ATTRS.slice().sort(function (a, b) { return (at[b] || 0) - (at[a] || 0); })[0];
    return 'best at ' + best;
  }
  function vbHiring(body, s) {
    refreshCandidatesInEdit();
    s = rawState(); ensureWexp(s);
    var w = s.wexp;
    body.appendChild(el('div', 'px-1 text-[0.7rem] text-stone-400', 'Hiring costs a signing wage; then payroll comes due every 7 days. A worker keeps one job at a time.'));
    body.appendChild(sectionLabel('Your people (' + Object.keys(w.employees).length + ')'));
    var eIds = Object.keys(w.employees);
    if (!eIds.length) body.appendChild(el('div', 'px-2 py-1.5 rounded border border-dashed border-stone-800 bg-stone-900/30 text-[0.7rem] text-stone-600 italic', 'No one works for you yet.'));
    eIds.forEach(function (id) {
      var e = w.employees[id], role = ROLE_BY_ID[e.role];
      var row = el('div', 'px-2 py-1.5 rounded border border-stone-800 bg-stone-900/40');
      row.innerHTML = '<div class="flex items-baseline justify-between gap-2 flex-wrap"><span class="text-[0.72rem] text-stone-200">' + esc(e.name) + ' <span class="text-stone-500">\u00b7 ' + e.age + '</span></span>' +
        '<span class="text-[0.7rem] text-stone-400">' + esc(role ? role.label : e.role) + ' \u00b7 ' + esc(e.business === 'casino' ? w.businesses.casino.name : 'tavern') + ' \u00b7 ' + e.wage + 'g/wk</span></div>' +
        '<div class="text-[0.65rem] text-stone-500 mt-0.5">' + esc(e.temperament) + ' \u00b7 morale ' + e.morale + ' \u00b7 ' + esc(skillSummary(e.skills)) + '</div>' +
        (e.privateOk ? '<div class="text-[0.65rem] text-stone-600 mt-0.5">Willing to take private bookings, on her own say-so each time.</div>' : '<div class="text-[0.65rem] text-stone-600 mt-0.5">Will not take private bookings \u2014 keep her to the public floor.</div>');
      var acts = el('div', 'flex gap-1 mt-1 flex-wrap');
      ROLES.forEach(function (r) {
        if (r.id === e.role) return;
        if (r.biz.indexOf(e.business) < 0) return;
        acts.appendChild(smallBtn('\u2192 ' + r.label.split(' /')[0], function () { assignEmployee(id, e.business, r.id); rerender(); }));
      });
      var fire = el('button', 'px-2 py-0.5 rounded text-[0.65rem] border border-rose-900 bg-stone-900 text-rose-300 hover:bg-stone-800', 'Dismiss');
      fire.addEventListener('click', function () { dismissEmployee(id); rerender(); });
      acts.appendChild(fire);
      row.appendChild(acts);
      body.appendChild(row);
    });
    body.appendChild(sectionLabel('Looking for work (' + w.staff.candidates.length + ')'));
    if (!w.staff.candidates.length) body.appendChild(el('div', 'px-2 py-1.5 rounded border border-dashed border-stone-800 bg-stone-900/30 text-[0.7rem] text-stone-600 italic', 'Nobody new today. The pool refreshes weekly.'));
    w.staff.candidates.forEach(function (cd) {
      var row = el('div', 'px-2 py-1.5 rounded border border-stone-800 bg-stone-900/40');
      row.innerHTML = '<div class="flex items-baseline justify-between gap-2 flex-wrap"><span class="text-[0.72rem] text-stone-200">' + esc(cd.name) + ' <span class="text-stone-500">\u00b7 ' + cd.age + '</span></span>' +
        '<span class="text-[0.7rem] text-amber-300">' + cd.wage + 'g/wk expected</span></div>' +
        '<div class="text-[0.65rem] text-stone-500 mt-0.5">' + esc(cd.background) + ' \u00b7 ' + esc(cd.temperament) + '</div>' +
        '<div class="text-[0.65rem] text-stone-400 mt-0.5">' + esc(skillSummary(cd.skills)) + ' \u00b7 ' + esc(attrSummary(cd.attributes)) + '</div>';
      var acts = el('div', 'flex gap-1 mt-1 flex-wrap');
      ROLES.forEach(function (r) {
        acts.appendChild(smallBtn('hire \u00b7 ' + r.label.split(' /')[0], function () { hireCandidate(cd.id, 'tavern', r.id); rerender(); }));
        if (r.biz.indexOf('casino') >= 0 && w.businesses.casino.owned) {
          acts.appendChild(smallBtn('hire \u2192 Lantern \u00b7 ' + r.label.split(' /')[0], function () { hireCandidate(cd.id, 'casino', r.id); rerender(); }, { primary: true }));
        }
      });
      row.appendChild(acts);
      body.appendChild(row);
    });
  }
  function abHiring(c, s) { }

  /* ================= Casino screens ================= */
  function vbCasinoBuy(body, s) {
    body.appendChild(el('div', 'px-1 text-[0.72rem] text-stone-300', 'The agent unlocks the door with a shrug. Dust lies an inch thick on the gaming tables; chandeliers hang like dead spiders. Upstairs: three floors of guest rooms, water-stained. It wants a fortune and a stern will.'));
    var plan = el('div', 'mt-1.5 px-2 py-1.5 rounded border border-stone-800 bg-stone-900/60 text-[0.65rem] text-stone-400 space-y-0.5');
    plan.innerHTML = '<div class="text-stone-300 mb-0.5">Restoration plan (after purchase)</div>';
    CASINO_ROOMS.concat(CASINO_GROUND, CASINO_BASEMENT, CASINO_FUN).forEach(function (r) {
      plan.innerHTML += '<div>\u00b7 ' + esc(r.name) + ' \u2014 ' + r.restoreCost + 'g</div>';
    });
    plan.innerHTML += '<div>\u00b7 8 guest rooms \u2014 400g each \u00b7 The Lantern Suite \u2014 1200g</div>';
    plan.innerHTML += '<div class="text-stone-600 mt-0.5">Operating costs (staff wages, upkeep) recur nightly and weekly once open.</div>';
    body.appendChild(plan);
  }
  function abCasinoBuy(c, s) {
    var afford = s.economy.gold >= CASINO_PRICE;
    c.appendChild(btn('Buy the deed \u2014 ' + CASINO_PRICE + 'g', 'Includes the full fixed layout: basement, ground floor, three guest floors + suite. One guest room is serviceable on day one.', function () { purchaseCasino(); nav('casino'); }, { primary: afford, disabled: !afford }));
  }
  function vbCasino(body, s) {
    var c = s.wexp.businesses.casino;
    if (!c.owned) { body.appendChild(el('div', 'px-1 text-[0.7rem] text-stone-500', 'You do not hold the deed yet.')); return; }
    body.appendChild(el('div', 'px-1 text-[0.72rem] text-stone-200', esc(c.name) + ' <span class="text-amber-300">treasury ' + Math.floor(c.treasury) + 'g</span> <span class="text-stone-500">\u00b7 renown ' + c.reputation + '/100</span>'));
    body.appendChild(sectionLabel('Basement'));
    casinoRoomLines(body, c, CASINO_BASEMENT);
    body.appendChild(sectionLabel('Ground floor'));
    casinoRoomLines(body, c, CASINO_GROUND);
    casinoRoomLines(body, c, CASINO_ROOMS);
    casinoRoomLines(body, c, CASINO_FUN);
    body.appendChild(sectionLabel('Hotel \u2014 3 guest floors + suite (max 10 rooms)'));
    casinoRoomLines(body, c, hotelRoomList(), c.hotel.rooms);
    if (c.stage.ready) body.appendChild(el('div', 'px-1 text-[0.65rem] text-stone-500', 'Stage: shows run most evenings when a singer is on staff. Tips split per contract.'));
    if (c.lounge.ready) body.appendChild(el('div', 'px-1 text-[0.65rem] text-stone-500', 'Private lounge: ' + (c.lounge.enabled ? 'open \u2014 bookings are opt-in for each performer, nightly, and she can decline any night.' : 'closed.')));
  }
  function casinoRoomLines(body, c, defs, store) {
    defs.forEach(function (r) {
      var st = store ? store[r.id] : c.rooms[r.id];
      var ready = st && st.status === 'ready';
      var desc = ready
        ? (store ? 'open \u00b7 quality ' + st.quality + ' \u00b7 ' + st.rate + 'g/night \u00b7 clean ' + Math.round(st.clean) + (st.guest ? ' \u00b7 guest: ' + esc(st.guest.name) + ' (' + st.nightsLeft + 'n left)' : ' \u00b7 empty') : 'open' + (r.game ? ' \u00b7 stakes ' + gameStakes(rawState(), r.id).min + '-' + gameStakes(rawState(), r.id).max + 'g' : ''))
        : 'derelict \u00b7 restore for ' + r.restoreCost + 'g';
      body.appendChild(el('div', 'px-2 py-1.5 rounded border ' + (ready ? 'border-stone-800 bg-stone-900/40' : 'border-dashed border-stone-800 bg-stone-900/30') + ' flex items-baseline justify-between gap-2 flex-wrap',
        '<span class="text-[0.72rem] text-stone-200">' + esc(r.name) + '</span>' +
        '<span class="text-[0.65rem] ' + (ready ? 'text-stone-400' : 'text-stone-600 italic') + '">' + desc + '</span>'));
    });
  }
  function abCasino(c, s) {
    var cs = s.wexp.businesses.casino;
    if (!cs.owned) return;
    c.appendChild(btn('Sweep treasury \u2192 strongbox', 'Move the night\u2019s take to the tavern', function () { sweepTreasury(); rerender(); }, { primary: true }));
    c.appendChild(btn('Deposit 200g', 'Bank coin into the treasury', function () { depositTreasury(200); rerender(); }, { disabled: s.economy.gold < 200 }));
    c.appendChild(btn('Open the ledger', 'Every coin the Lantern has taken or paid', function () { nav('ledger'); }));
    CASINO_ROOMS.concat(CASINO_GROUND, CASINO_BASEMENT, CASINO_FUN).forEach(function (r) {
      var st = cs.rooms[r.id];
      if (!st || st.status !== 'ready') c.appendChild(btn('Restore ' + r.name + ' (' + r.restoreCost + 'g)', 'Put this room back to work', function () { restoreCasinoRoom(r.id); rerender(); }, { disabled: s.economy.gold < r.restoreCost }));
      else if (r.game && st.tier !== 2) c.appendChild(btn('Raise limits \u2014 ' + r.name + ' (500g)', 'Higher stakes at the tables', function () { upgradeStakes(r.id); rerender(); }, { disabled: s.economy.gold < 500 }));
    });
    CASINO_ROOMS.forEach(function (r) {
      var st = cs.rooms[r.id];
      if (st && st.status === 'ready') c.appendChild(btn('Play ' + r.name.replace(' Room', 's'), 'Sit down at your own table', function () { nav('game:' + r.id); }));
    });
    if (cs.lounge.ready) c.appendChild(btn(cs.lounge.enabled ? 'Close the private lounge' : 'Open the private lounge', cs.lounge.enabled ? 'No bookings tonight' : 'Let the dancers take bookings', function () { edit(function (st) { st.wexp.businesses.casino.lounge.enabled = !st.wexp.businesses.casino.lounge.enabled; }); rerender(); }));
  }
  function vbLedger(body, s) {
    var c = s.wexp.businesses.casino;
    var byCat = {};
    c.ledger.forEach(function (e) { byCat[e.cat] = round1((byCat[e.cat] || 0) + e.amount); });
    var sums = el('div', 'px-2 py-1.5 rounded border border-stone-800 bg-stone-900/60 text-[0.7rem] text-stone-300 flex flex-wrap gap-2');
    Object.keys(byCat).forEach(function (cat) {
      sums.innerHTML += '<span>' + esc(cat) + ': <span class="' + (byCat[cat] >= 0 ? 'text-amber-300' : 'text-rose-300') + '">' + byCat[cat] + 'g</span></span>';
    });
    body.appendChild(sums);
    var list = el('div', 'space-y-0.5 text-[0.65rem] px-1');
    body.appendChild(list);
    c.ledger.slice(-60).reverse().forEach(function (e) {
      list.appendChild(el('div', 'flex justify-between border-b border-stone-900 py-0.5',
        '<span class="text-stone-400">D' + e.day + ' \u00b7 ' + esc(e.note || e.cat) + '</span>' +
        '<span class="' + (e.amount >= 0 ? 'text-amber-300' : 'text-rose-300') + '">' + e.amount + 'g</span>'));
    });
  }
  function abLedger(c, s) { }

  /* ================= Game screens (boards in panel, plays in Actions) ================= */
  function vbGame(body, s, roomId) {
    var def = casinoRoom(roomId);
    if (!def) { body.appendChild(el('div', 'text-sm text-stone-500', 'That room is dark.')); return; }
    var stakes = gameStakes(s, roomId);
    if (roomId === 'card_room') renderCardsUI(body, s, stakes, actionsEl);
    else if (roomId === 'dice_room') renderDiceUI(body, s, stakes, actionsEl);
    else renderMorrisUI(body, s, actionsEl);
    var recent = el('div', 'px-1 mt-1.5 text-[0.65rem] text-stone-600 space-y-0.5');
    (s.log || []).slice(-3).forEach(function (l) { recent.appendChild(el('div', '', '\u00b7 ' + esc(l.text))); });
    body.appendChild(recent);
  }
  function abGame(c, s, roomId) {
    var def = casinoRoom(roomId);
    if (!def) return;
    var stakes = gameStakes(s, roomId);
    if (roomId === 'card_room') renderCardsUI(el('div'), s, stakes, c);
    else if (roomId === 'dice_room') renderDiceUI(el('div'), s, stakes, c);
    else renderMorrisUI(el('div'), s, c);
  }

  /* ---------- game UI helpers (info in the panel; buttons routed to the Actions pane) ---------- */
  var MORRIS_XY = [
    [0,0],[50,0],[100,0], [10,10],[50,10],[90,10], [20,20],[50,20],[80,20],
    [0,50],[10,50],[20,50], [80,50],[90,50],[100,50], [20,80],[50,80],[80,80],
    [10,90],[50,90],[90,90], [0,100],[50,100],[100,100]
  ];
  var MORRIS_LINES = [
    [0,1,2],[3,4,5],[6,7,8],[9,10,11],[12,13,14],[15,16,17],[18,19,20],[21,22,23],
    [0,9,21],[3,10,18],[6,11,15],[1,4,7],[16,19,22],[8,12,17],[5,13,20],[2,14,23]
  ];
  function cardName(r) { return r === 1 ? 'A' : r === 11 ? 'J' : r === 12 ? 'Q' : r === 13 ? 'K' : String(r); }
  function renderCardsUI(body, s, stakes, acts) {
    var out = acts || body;
    body.appendChild(el('div', 'px-1 text-[0.7rem] text-stone-400', 'One-and-Twenty. Beat the house to 21 or closer; aces count 11 or 1. Dealer stands on 17. Stakes ' + stakes.min + '\u2013' + stakes.max + 'g.'));
    var hand = el('div', 'flex gap-6 my-2 px-1');
    var pv = cardValue(CARD_GAME.player), dv = cardValue(CARD_GAME.dealer);
    hand.innerHTML = '<div><div class="text-[0.65rem] text-stone-500 mb-1">You</div><div class="text-2xl text-stone-100">' + (CARD_GAME.player.length ? pv : '\u2014') + '</div><div class="text-[0.7rem] text-stone-400">' + CARD_GAME.player.map(cardName).join(', ') + '</div></div>' +
      '<div><div class="text-[0.65rem] text-stone-500 mb-1">House</div><div class="text-2xl text-stone-100">' + (CARD_GAME.state === 'play' ? CARD_GAME.dealer.length + ' card, face down' : (CARD_GAME.dealer.length ? dv : '\u2014')) + '</div><div class="text-[0.7rem] text-stone-400">' + (CARD_GAME.state === 'play' ? '' : CARD_GAME.dealer.map(cardName).join(', ')) + '</div></div>';
    body.appendChild(hand);
    if (CARD_GAME.state !== 'play') {
      [stakes.min, 10, 25, stakes.max].filter(function (v, i, a) { return v >= stakes.min && v <= stakes.max && a.indexOf(v) === i; }).forEach(function (v) {
        out.appendChild(btn('Deal \u00b7 ' + v + 'g', 'One-and-Twenty hand', function () { startCards(v); rerender(); }, { disabled: s.economy.gold < v }));
      });
    } else {
      out.appendChild(btn('Hit', 'Take another card', function () { resolveCards('hit'); rerender(); }, { primary: true }));
      out.appendChild(btn('Stand', 'Hold your total', function () { resolveCards('stand'); rerender(); }));
    }
  }
  function renderDiceUI(body, s, stakes, acts) {
    var out = acts || body;
    body.appendChild(el('div', 'px-1 text-[0.7rem] text-stone-400', 'Cast the Bones. Under/Over 7 pays 2.2\u00d7, a hard seven pays 5\u00d7. Wager ' + stakes.min + '\u2013' + stakes.max + 'g.'));
    body.appendChild(el('div', 'text-3xl my-2 px-1 text-stone-100', DICE_GAME.dice[0] ? DICE_GAME.dice.join(' + ') + ' = ' + (DICE_GAME.dice[0] + DICE_GAME.dice[1]) : '\u2014'));
    [stakes.min, 10, stakes.max].filter(function (v, i, a) { return v >= stakes.min && v <= stakes.max && a.indexOf(v) === i; }).forEach(function (v) {
      [['under', 'Under 7'], ['seven', 'Hard 7'], ['over', 'Over 7']].forEach(function (sd) {
        out.appendChild(btn(sd[1] + ' \u00b7 ' + v + 'g', 'Cast the bones', function () { startDice(v, sd[0]); rerender(); }, { disabled: s.economy.gold < v }));
      });
    });
  }
  function renderMorrisUI(body, s, acts) {
    var out = acts || body;
    body.appendChild(el('div', 'px-1 text-[0.7rem] text-stone-400', "Nine Men's Morris. Place your nine men, then slide them. Three in a row lets you take a man. Stake " + MORRIS.stake + 'g \u2014 winner takes both.'));
    if (MORRIS.state !== 'play') {
      out.appendChild(btn('Sit down and play (stake ' + (MORRIS.stake || 25) + 'g)', "Nine Men's Morris against the house", function () { morrisStart('board_room'); rerender(); }, { disabled: s.economy.gold < (MORRIS.stake || 25) }));
      return;
    }
    var wrap = el('div', 'my-2 px-1');
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '-12 -12 124 124');
    svg.setAttribute('class', 'w-64 h-64');
    function ln(x1, y1, x2, y2) {
      var l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
      l.setAttribute('stroke', '#57534e'); l.setAttribute('stroke-width', '2');
      svg.appendChild(l);
    }
    [[0,0,100,0],[0,100,100,100],[0,0,0,100],[100,0,100,100],[10,10,90,10],[10,90,90,90],[10,10,10,90],[90,10,90,90],[20,20,80,20],[20,80,80,80],[20,20,20,80],[80,20,80,80],[50,0,50,20],[50,80,50,100],[0,50,20,50],[80,50,100,50]].forEach(function (q) { ln(q[0], q[1], q[2], q[3]); });
    for (var i = 0; i < 24; i++) {
      (function (i) {
        var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        c.setAttribute('cx', MORRIS_XY[i][0]); c.setAttribute('cy', MORRIS_XY[i][1]); c.setAttribute('r', MORRIS.selected === i ? 6.5 : 5);
        c.setAttribute('fill', MORRIS.board[i] === 'P' ? '#d6c7a1' : MORRIS.board[i] === 'A' ? '#7f1d1d' : '#1c1917');
        c.setAttribute('stroke', MORRIS.selected === i ? '#fbbf24' : '#78716c');
        c.setAttribute('stroke-width', MORRIS.selected === i ? '2.5' : '1');
        c.style.cursor = 'pointer';
        c.addEventListener('click', function () { morrisPlayerAction(i); rerender(); setTimeout(function () { morrisAdvanceAi(); rerender(); }, 260); });
        svg.appendChild(c);
      })(i);
    }
    wrap.appendChild(svg);
    body.appendChild(wrap);
    var status = MORRIS.remove ? 'You made a mill \u2014 take one of the house\u2019s men.' :
      MORRIS.phase === 'place' ? 'Placing: ' + MORRIS.toPlace + ' men left each. Your move.' :
      MORRIS.turn === 'P' ? (MORRIS.selected < 0 ? 'Pick one of your men to slide.' : 'Now pick an adjacent empty point.') : 'The house is thinking\u2026';
    body.appendChild(el('div', 'px-1 text-[0.72rem] text-stone-300', esc(status)));
    out.appendChild(btn('Walk away (45 min pass)', 'Forfeit the board and let the time go', function () { morrisFinishTime(); rerender(); }));
  }

  /* ---------- overlay fallback (only if the House pane cannot be found) ---------- */
  function renderTownOverlay() {
    var s = rawState(); ensureWexp(s);
    var kind = scrKind(s), arg = scrArg(s);
    openOverlay({ id: 'town', render: function (root) {
      root.innerHTML = '';
      var head = el('div', 'flex items-center justify-between px-5 py-4 border-b border-stone-800 shrink-0',
        '<h2 class="text-lg font-semibold text-stone-100">' + esc(screenTitle(s)) + '</h2>' +
        '<div class="flex items-center gap-3"><span class="text-sm text-stone-300">' + timeBadge() + '</span><span class="text-sm text-amber-400">' + goldBadge() + '</span></div>');
      var closeB = el('button', 'text-stone-400 hover:text-stone-200 text-xl leading-none px-2', '&times;');
      closeB.addEventListener('click', function (e) { e.stopPropagation(); leaveCity(); });
      head.querySelector('div').appendChild(closeB);
      root.appendChild(head);
      var body = el('div', 'overflow-y-auto px-5 py-4 space-y-2');
      var strip = companionStrip(s);
      if (strip) body.appendChild(strip);
      if (kind === 'shop') vbShop(body, s, arg);
      else if (kind === 'friend') vbFriend(body, s);
      else if (kind === 'outing') vbOuting(body, s, arg);
      else if (kind === 'hiring') vbHiring(body, s);
      else if (kind === 'casino') vbCasino(body, s);
      else if (kind === 'casino_buy') vbCasinoBuy(body, s);
      else if (kind === 'ledger') vbLedger(body, s);
      else if (kind === 'game') vbGame(body, s, arg);
      else vbVillage(body, s);
      root.appendChild(body);
      var foot = el('div', 'px-5 py-3 border-t border-stone-800 shrink-0 space-y-2 overflow-y-auto');
      if (kind === 'shop') abShop(foot, s, arg);
      else if (kind === 'friend') abFriend(foot, s);
      else if (kind === 'outing') abOuting(foot, s, arg);
      else if (kind === 'casino') abCasino(foot, s);
      else if (kind === 'casino_buy') abCasinoBuy(foot, s);
      else if (kind === 'game') abGame(foot, s, arg);
      else if (kind === 'village') abVillage(foot, s);
      var back = backTarget(s);
      if (back) foot.appendChild(btn('\u2190 ' + (back === 'casino' ? 'The Lantern' : 'Village'), '', function () { nav(back); }));
      foot.appendChild(btn('Head home', 'End the town trip', function () { leaveCity(); }, { primary: !back }));
      root.appendChild(foot);
    } });
  }

  function isTabButton(b) {
    var parent = b.parentElement;
    return !!(parent && parent.children.length >= 3 && parent.querySelectorAll('button').length === parent.children.length);
  }
  function injectVisitCity() {
    var btns = document.querySelectorAll('button');
    var goOut = null, i;
    for (i = 0; i < btns.length; i++) {
      if (btns[i].getAttribute('data-wexp')) continue;
      var t = btns[i].textContent || '';
      if (t.indexOf('Go out') >= 0 && !btns[i].disabled) { goOut = btns[i]; break; }
    }
    if (!goOut) return;
    var parent = goOut.parentElement;
    if (!parent) return;
    var existing = parent.querySelector('[data-wexp="visit-city"]');
    var s = rawState();
    var inside = !!(s && s.wexp && s.wexp.city && s.wexp.city.inside);
    if (existing) {
      existing.innerHTML = inside
        ? '<span class="text-sm text-amber-300">You are in town</span><span class="text-xs text-stone-400 mt-0.5">the Village map is open in the House section</span>'
        : '<span class="text-sm text-stone-100">Visit City</span><span class="text-xs text-stone-400 mt-0.5">the shops, the hiring hall, outings \u2014 opens in the House section</span>';
      return;
    }
    var b = document.createElement('button');
    b.setAttribute('data-wexp', 'visit-city');
    b.className = goOut.className;
    b.innerHTML = '<span class="text-sm text-stone-100">Visit City</span><span class="text-xs text-stone-400 mt-0.5">the shops, the hiring hall, outings \u2014 opens in the House section</span>';
    b.addEventListener('click', function (e) { e.stopPropagation(); startCityVisit(); });
    parent.appendChild(b);
  }
  function applyHouseTab() {
    var btns = document.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (b.getAttribute('data-wexp-tab')) continue;
      var t = (b.textContent || '').trim().toLowerCase();
      if (t === 'house' && isTabButton(b)) {
        b.setAttribute('data-wexp-tab', 'house');
        var done = false;
        for (var k = 0; k < b.childNodes.length; k++) {
          var nd = b.childNodes[k];
          if (nd.nodeType === 3 && (nd.nodeValue || '').toLowerCase().indexOf('house') >= 0) { nd.nodeValue = 'Village'; done = true; break; }
        }
        if (!done) b.textContent = 'Village';
      }
    }
  }

  /* keep panel + actions in step with React re-renders: rebuild only when missing */
  function syncTownUI() {
    var s = rawState();
    var inside = !!(s && s.wexp && s.wexp.city && s.wexp.city.inside);
    if (!inside) {
      if (panelEl || document.getElementById('wexp-town-panel')) hideTownPanel();
      if (actionsEl || document.getElementById('wexp-town-actions')) { if (actionsEl) { try { actionsEl.remove(); } catch (e) { } actionsEl = null; } }
      return;
    }
    if (!document.getElementById('wexp-town-panel') || !document.getElementById('wexp-town-actions')) rerender();
  }

  var observerScheduled = false;
  function scheduleInjections() {
    if (observerScheduled) return;
    observerScheduled = true;
    requestAnimationFrame(function () {
      observerScheduled = false;
      try { injectVisitCity(); } catch (e) { }
      try { applyHouseTab(); } catch (e) { }
      try { syncTownUI(); } catch (e) { }
    });
  }

  /* ================= 12. Guardian: state upkeep, day ticks ================= */
  var lastSeenDay = null, lastLogLen = 0;
  function inGameDom() {
    try { return !!document.querySelector('[data-wexp="visit-city"],[data-wexp="village-btn"],button[data-wexp-tab="house"]'); } catch (e) { return false; }
  }
  function guardian() {
    var w = W();
    if (!w || !w.state) return;
    scheduleInjections();
    try {
      var s = rawState();
      if (!s || !inGameDom() || typeof s.slot !== 'number' || !s.economy) return;
      var need = ensureWexp(s);
      if (need) { edit(function (st) { ensureWexp(st); }); s = rawState(); }
      if (!s.wexp) return;
      if (!s.wexp.friend) { edit(function (st) { ensureFriend(st); }); }

      var day = dayOf(s.slot);
      if (lastSeenDay == null) lastSeenDay = day;
      if (day !== lastSeenDay) {
        var prevDay = lastSeenDay;
        lastSeenDay = day;
        edit(function (st) {
          ensureWexp(st);
          refreshCandidatesIfNeeded(st);
          weeklyPayrollIfDue(st);
          dailyEmployeeProgress(st);
          casinoNightly(st);
        });
      }

      /* if the player is in town and it gets very late, send them home */
      if (s.wexp.city.inside) {
        var t = tod(s.slot);
        if (t >= CLOSED_AT && t < DAWN) {
          edit(function (st) { ensureWexp(st); st.wexp.city.inside = false; logLine(st, 'The streets empty and the watch eyes you sideways. You make your way home.'); });
        }
      }
    } catch (e) { /* never break the game */ }
  }

  function boot() {
    if (typeof document === 'undefined' || !document.body) { setTimeout(boot, 300); return; }
    var mo = new MutationObserver(scheduleInjections);
    mo.observe(document.body, { childList: true, subtree: true });
    scheduleInjections();
    setInterval(guardian, 2500);
    guardian();
  }

  /* ================= 13. Exports (tests / console) ================= */
  var API = {
    ING: ING, SHOP_DEFS: SHOP_DEFS, ROLES: ROLES, OUTINGS: OUTINGS, RECIPES: RECIPES,
    CASINO_ROOMS: CASINO_ROOMS, hotelRoomList: hotelRoomList, CASINO_PRICE: CASINO_PRICE,
    defaultWexp: defaultWexp, ensureWexp: ensureWexp, dayOf: dayOf, hhmm: hhmm, openNow: openNow,
    shopState: shopState, restock: restock, shopLines: shopLines, unitPrice: unitPrice,
    playerSellables: playerSellables, buyFromShop: buyFromShop, sellToShop: sellToShop, haggle: haggle,
    capacityOf: capacityOf, usedUnits: usedUnits, freeUnits: freeUnits, stillroomOf: stillroomOf,
    canGoCity: canGoCity, refreshCandidatesIfNeeded: refreshCandidatesIfNeeded,
    nav: nav, rerender: rerender, setCompanion: setCompanion, companionOf: companionOf, scrKind: scrKind, scrArg: scrArg,
    hireCandidate: hireCandidate, assignEmployee: assignEmployee, dismissEmployee: dismissEmployee,
    weeklyPayrollIfDue: weeklyPayrollIfDue, payRole: payRole, casinoNightly: casinoNightly,
    purchaseCasino: purchaseCasino, restoreCasinoRoom: restoreCasinoRoom, casinoRoom: casinoRoom,
    sweepTreasury: sweepTreasury, depositTreasury: depositTreasury, gameStakes: gameStakes,
    cardValue: cardValue, morrisPlayerAction: morrisPlayerAction, morrisAdvanceAi: morrisAdvanceAi,
    morrisEndCheck: morrisEndCheck, startDice: startDice, startCards: startCards, doOuting: doOuting,
    visitFriend: visitFriend, ensureFriend: ensureFriend, friendOf: friendOf, isPippa: isPippa,
    _test: { edit: edit, rawState: rawState, logLine: logLine, wifeOf: wifeOf, addGold: addGold, MORRIS: function(){return MORRIS;}, CARD_GAME: function(){return CARD_GAME;}, DICE_GAME: function(){return DICE_GAME;}, MILLS: MILLS, ADJ: ADJ, setMORRIS: function(m){ MORRIS.board=m.board; MORRIS.phase=m.phase; MORRIS.turn=m.turn; MORRIS.toPlace=m.toPlace; MORRIS.remove=m.remove; MORRIS.selected=-1; MORRIS.state='play'; }, setCARD: function(c){CARD_GAME.player=c.player;CARD_GAME.dealer=c.dealer;CARD_GAME.stake=c.stake;CARD_GAME.state=c.state;}, setDICE: function(d){DICE_GAME.state=d.state;} }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.waywardExpansion = API;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})();
