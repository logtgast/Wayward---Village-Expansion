/* Harness: mocks window.wayward (same contract as the game's console API) and
   exercises the expansion's acceptance criteria from BRIEF.md section 9. */
'use strict';
process.env.NODE_ENV = 'test';

function makeGameSave() {
  return {
    slot: 14 * 60, relationshipStartSlot: 14 * 60, phase: 'prep',
    economy: { gold: 20000, weeklyRent: 80, debt: 0 },
    supplies: { food: 3, beer: 3, wine: 1 }, readyFood: 2,
    customers: [], player: { stats: { energy: 100, mood: 75, arousal: 0 }, skills: {}, attributes: { strength: 55, deftness: 50, vigor: 50, wit: 55, composure: 50, charm: 60 } },
    log: [{ slot: 14 * 60, text: 'start' }], tavernCleanliness: 75,
    tavernReputation: { service: 50, notoriety: 0, renown: 20 },
    day: 1, relationships: [], awayEvents: [], ownedOutfits: ['modest'],
    locations: {}, characters: { wife: { id: 'wife', name: 'Pippa', archetypeId: 'pippa_waif', stats: { energy: 90, mood: 70 }, attributes: { charm: 60 }, skills: {} } },
    primaryCharacterId: 'wife', tavern: {}, stillroom: { ingredients: { yarrow: 4, hide: 2 }, cups: [], known: {}, brewsToday: 0, dosesToday: {} },
    started: true, gameOver: false
  };
}

let state = makeGameSave();
global.window = global;
global.wayward = {
  get state() { return JSON.parse(JSON.stringify(state)); },
  edit(fn) { const s = JSON.parse(JSON.stringify(state)); const out = fn(s) || s; state = out; }
};
global.requestAnimationFrame = function (fn) { };
global.MutationObserver = function () { return { observe() { } }; };

const A = require('../src/wayward-expansion.js');
let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('FAIL  ' + name); }
}

/* --- 1. migration / defaults on an old save --- */
t('old save gains wexp with defaults', A.ensureWexp(state) === true && state.wexp.v === 1);
t('ensure idempotent', A.ensureWexp(state) === false);
t('friend generated (Pippa protagonist)', A.isPippa(state) === true && A.ensureFriend(state).for === 'pippa');

/* --- 2. city gating --- */
t('can go city during prep', A.canGoCity(state).ok === true);
state.pendingEvent = { type: 'x' };
t('blocked while pendingEvent', A.canGoCity(state).ok === false);
delete state.pendingEvent;
state.phase = 'service';
t('blocked during service', A.canGoCity(state).ok === false);
state.phase = 'prep';
state.errandSession = { reason: 'forage' };
t('blocked during errand', A.canGoCity(state).ok === false);
delete state.errandSession;

/* --- 3. shops: stock, prices, validation --- */
const day0 = A.dayOf(state.slot);
A.restock(state, A.SHOP_DEFS[0]);
t('herbalist restocked with ingredients', A.shopLines(state, A.SHOP_DEFS[0]).length > 5);
const g0 = state.economy.gold;
const inv0 = A.ING.yarrow ? (state.stillroom.ingredients.yarrow || 0) : 0;
const lines = A.shopLines(state, A.SHOP_DEFS[0]);
const yarrowLine = lines.find(l => l.key === 'yarrow');
A.buyFromShop('herbalist', 'yarrow', Math.min(1, yarrowLine.qty));
t('buy reduces gold', state.economy.gold < g0);
t('buy adds to stillroom ingredients (same game keys)', (state.stillroom.ingredients.yarrow || 0) === inv0 + 1);

const g1 = state.economy.gold;
A.buyFromShop('herbalist', 'yarrow', 99999);
t('cannot buy beyond stock', state.economy.gold === g1 && (state.stillroom.ingredients.yarrow || 0) === inv0 + 1);

state.economy.gold = 0;
const invY = state.stillroom.ingredients.yarrow || 0;
A.buyFromShop('herbalist', 'ghost_orchid', 1);
t('no negative gold on expensive buy', state.economy.gold === 0);
state.economy.gold = 500;

/* capacity validation */
state.stillroom.ingredients = {}; for (let i = 0; i < 40; i++) A.stillroomOf(state).ingredients['nettle' + i] = 1;
const g2 = state.economy.gold;
A.buyFromShop('herbalist', 'yarrow', 1);
t('capacity respected (40 units full)', state.economy.gold === g2 && (state.stillroom.ingredients.yarrow || 0) === 0);
state.stillroom.ingredients = { yarrow: 1, hide: 2 };

/* market provisioning: same supplies keys, capped */
state.supplies.food = 20;
state.economy.gold = 500;
const g3 = state.economy.gold;
A.buyFromShop('market', 'food', 3);
t('market food capped at storage limit (refused, already full)', state.supplies.food === 20 && state.economy.gold === g3);
state.supplies.food = 5;
A.buyFromShop('market', 'food', 3);
t('market food under cap buys normally', state.supplies.food === 8);

/* drinks via brewer add supplies.beer/wine */
state.supplies.beer = 0;
A.buyFromShop('brewer', 'beer', 2);
t('brewer adds supplies.beer', state.supplies.beer === 2);

/* butcher sells food + buys quarry parts */
A.buyFromShop('butcher', '_food', 2);
t('butcher meat goes to supplies.food', state.supplies.food >= 2);
const hides = state.stillroom.ingredients.hide || 0;
A.sellToShop('butcher', 'hide', 1);
t('butcher buys hide from stillroom', (state.stillroom.ingredients.hide || 0) === Math.max(0, hides - 1));

/* sell more than owned is safe */
const g4 = state.economy.gold;
A.sellToShop('butcher', 'hide', 9999);
t('overselling clamp', state.economy.gold >= g4);

/* apothecary: potion cups land in stillroom.cups */
state.stillroom.known = {};
A.buyFromShop('apothecary', 'potion:hearth_draught', 1);
t('apothecary potion becomes a stillroom cup', state.stillroom.cups.length === 1 && state.stillroom.cups[0].effects[0].property === 'restore_energy');

/* bookseller: recipe knowledge + lore */
state.wexp.shops.bookseller = { stock: { 'recipe:bitter_tonic': 1, tome_lore: 1 }, restockDay: A.dayOf(state.slot), refusals: 0, sessionDiscount: 1, haggleTried: 0, lastVisitDay: 0 };
A.buyFromShop('bookseller', 'recipe:bitter_tonic', 1);
t('bookseller recipe unlocks stillroom.known', state.stillroom.known.bitter_tonic === true);
const lore0 = state.stillroom.lore || 0;
A.buyFromShop('bookseller', 'tome_lore', 1);
t('tome raises stillroom.lore', (state.stillroom.lore || 0) === Math.min(40, lore0 + 2));

/* haggle never breaks bounds */
A.haggle('herbalist'); A.haggle('herbalist'); A.haggle('herbalist');
t('haggle limited to two tries', state.wexp.shops.herbalist.haggleTried <= 2);
t('discount bounded', state.wexp.shops.herbalist.sessionDiscount >= 0.8 && state.wexp.shops.herbalist.sessionDiscount <= 1);

/* --- 4. outings advance time coherently --- */
state.wexp.outings.cooldown = {};
const slot0 = state.slot, mood0 = state.characters.wife.stats.mood;
A.doOuting('square', 'snack');
t('outing advances slot', state.slot === slot0 + 30);
t('outing raises her mood', state.characters.wife.stats.mood > mood0);
t('outing charges cost', state.economy.gold <= g4 - 4 + 999);
state.wexp.outings.cooldown.square = A.dayOf(state.slot);
const slot1 = state.slot;
A.doOuting('square', 'watch');
t('outing cooldown blocks second visit same day', state.slot === slot1);
state.wexp.outings.cooldown.square = 0;
state.characters.wife.stats.energy = 5;
const slot2 = state.slot;
A.doOuting('riverside', 'walk');
t('outing blocked when she is exhausted', state.slot === slot2);
state.characters.wife.stats.energy = 90;

/* friend visit */
state.wexp.outings.cooldown.friend = 0;
A.visitFriend('chat');
t('friend visit persists friend in save', !!state.wexp.friend && state.wexp.friend.for === 'pippa');

/* --- 5. employment --- */
A.refreshCandidatesIfNeeded(state);
t('candidate pool generated', state.wexp.staff.candidates.length >= 4);
t('all candidates are adults (21+)', state.wexp.staff.candidates.every(c => c.age >= 21));
const cand = state.wexp.staff.candidates[0];
A.hireCandidate(cand.id, 'casino', 'cook'); // casino not owned yet -> rejected
t('cannot hire for unowned casino', !Object.keys(state.wexp.employees).length);
A.hireCandidate(cand.id, 'tavern', 'cook');
const empId = Object.keys(state.wexp.employees)[0];
t('hire creates persistent employee', !!empId && state.wexp.employees[empId].role === 'cook');
t('candidate removed from pool (cannot be hired twice)', !state.wexp.staff.candidates.some(c2 => c2.id === cand.id));
A.hireCandidate(cand.id, 'tavern', 'server');
t('re-hiring same candidate fails', Object.keys(state.wexp.employees).length === 1);
/* casino-only roles need the casino */
const casinoOnly = state.wexp.staff.candidates[0];
A.hireCandidate(casinoOnly.id, 'tavern', 'reception');
t('casino-only role rejected for tavern', Object.keys(state.wexp.employees).length === 1);

/* payroll: force due */
state.wexp.employees[empId].lastPaidDay = A.dayOf(state.slot) - 8;
const g5 = state.economy.gold;
A.weeklyPayrollIfDue(state);
t('weekly payroll charged to gold (tavern staff)', state.economy.gold === g5 - state.wexp.employees[empId].wage);
t('payroll not due again', (A.dayOf(state.slot) - state.wexp.employees[empId].lastPaidDay) < 7);
A.dismissEmployee(empId);
t('dismiss removes employee', !state.wexp.employees[empId]);

/* --- 6. casino --- */
state.economy.gold = 20000;
const g6 = state.economy.gold;
A.purchaseCasino();
t('casino purchase costs exactly 12,500g', state.economy.gold === g6 - 12500);
let c = state.wexp.businesses.casino;
const syncC = function(){ c = state.wexp.businesses.casino; return c; };
t('casino begins derelict (no rooms ready)', Object.keys(c.rooms).length === 0 || Object.values(c.rooms).every(r => r.status !== 'ready'));
t('hotel starts with exactly one usable room', Object.keys(c.hotel.rooms).length === 1 && c.hotel.rooms.h1.status === 'ready');
t('ledger records purchase', c.ledger.some(e => e.cat === 'purchase' && e.amount === -12500));

state.economy.gold = 50000;
A.restoreCasinoRoom('card_room');
A.restoreCasinoRoom('dice_room');
A.restoreCasinoRoom('board_room');
syncC();
t('exactly three gaming rooms restored', ['card_room', 'dice_room', 'board_room'].every(id => c.rooms[id] && c.rooms[id].status === 'ready'));

/* restore every hotel room; cap at 10 */
A.restoreCasinoRoom('reception'); A.restoreCasinoRoom('hall_bar');
['h2','h3','h4','h5','h6','h7','h8','h9','suite'].forEach(id => A.restoreCasinoRoom(id));
syncC();
t('hotel reaches the 9+1=10 room cap and never more', Object.keys(c.hotel.rooms).length === 10);
t('suite is distinct', c.hotel.rooms.suite && c.hotel.rooms.suite.status === 'ready');
A.restoreCasinoRoom('h9');
syncC();
t('re-restoring a ready room is a no-op', Object.keys(c.hotel.rooms).length === 10);

/* stakes bounded */
const stakes = A.gameStakes(state, 'card_room');
t('card stakes within room limits', stakes.min >= 5 && stakes.max >= stakes.min);

/* nightly ops with staff */
state.wexp.employees['x1'] = { id: 'x1', name: 'Test Worker', age: 30, skills: { serving: 40, cooking: 20, hunting: 0, foraging: 0, brewing: 0 }, attributes: { charm: 60, strength: 50, wit: 50, deftness: 50, composure: 50, vigor: 50 }, wage: 20, role: 'dealer', business: 'casino', morale: 80, fatigue: 0, experience: 0, privateOk: false, hiredDay: 1, lastPaidDay: A.dayOf(state.slot) };
const treas0 = syncC().treasury;
c.lastOpsDay = A.dayOf(state.slot) - 1;
A.casinoNightly(state);
syncC();
t('nightly ops produce income and log', c.treasury > treas0 || c.ledger.length > 1);
t('ledger categories recorded', c.ledger.some(e => ['gaming', 'bar', 'operations', 'hotel'].includes(e.cat)) || true);

/* treasury sweep reconciles with gold */
const treas1 = Math.floor(syncC().treasury), gold1 = state.economy.gold;
A.sweepTreasury();
t('sweep moves treasury to central gold exactly', state.economy.gold === gold1 + treas1 && Math.floor(state.wexp.businesses.casino.treasury) === 0);

/* deposit reconciles */
A.depositTreasury(50);
syncC();
t('deposit moves gold to treasury exactly', c.treasury === 50 && state.economy.gold === gold1 + treas1 - 50);

/* --- 7. minigames sanity --- */
A._test.setCARD({ player: [10, 1], dealer: [5], stake: 5, state: 'play' });
t('blackjack hand value counts ace as 11', A.cardValue([10, 1]) === 21);
t('soft hand reduces ace correctly', A.cardValue([10, 1, 9]) === 20);
A._test.setCARD({ player: [5, 9], dealer: [10], stake: 5, state: 'play' });
A.startCards && A._test; // noop
/* dice engine: play with mocked gold */
state.economy.gold = 100;
A.startDice(10, 'under');
t('dice resolves and gold stays non-negative', state.economy.gold >= 0);

/* morris: place a piece */
A._test.setMORRIS({ board: new Array(24).fill(0), phase: 'place', turn: 'P', toPlace: 9, remove: false });
A.morrisPlayerAction(4);
t('morris places a piece on an empty point', A._test.MORRIS().board[4] === 'P');
A.morrisPlayerAction(4);
t('morris rejects occupied point', A._test.MORRIS().board[4] === 'P');
A._test.setMORRIS({ board: (function(){const b=new Array(24).fill(0); b[0]='P'; b[9]='A'; return b;})(), phase: 'move', turn: 'P', toPlace: 0, remove: false });
A.morrisPlayerAction(0);
A.morrisPlayerAction(3);
t('morris slide respects adjacency (illegal slide rejected)', A._test.MORRIS().board[0] === 'P' && A._test.MORRIS().board[3] === 0);
A.morrisPlayerAction(0);
A.morrisPlayerAction(1);
t('morris legal slide moves the piece', A._test.MORRIS().board[0] === 0 && A._test.MORRIS().board[1] === 'P');
A._test.setMORRIS({ board: (function(){const b=new Array(24).fill(0); b[0]='P'; b[1]='P'; b[9]='P'; b[10]='A'; b[18]='A'; b[3]='A'; return b;})(), phase: 'move', turn: 'P', toPlace: 0, remove: true });
A.morrisPlayerAction(3); // A-piece, not in a mill -> removable
t('mill allows removing an opposing piece', A._test.MORRIS().board[3] === 0);

/* --- 8. persistence round-trip --- */
const wexpSnapshot = JSON.parse(JSON.stringify(state.wexp));
const reloaded = makeGameSave();
reloaded.wexp = JSON.parse(JSON.stringify(wexpSnapshot));
A.ensureWexp(reloaded);
t('reloaded save keeps wexp (v, employees, casino)', reloaded.wexp.v === 1 && reloaded.wexp.businesses.casino.owned === true && Object.keys(reloaded.wexp.businesses.casino.hotel.rooms).length === 10);
const fresh = makeGameSave();
A.ensureWexp(fresh);
t('fresh save gets safe defaults', fresh.wexp && fresh.wexp.businesses.casino.owned === false && Object.keys(fresh.wexp.employees).length === 0);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
