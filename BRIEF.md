# Wayward — Village, Commerce, Staff & Casino Expansion

**Project brief / technical handoff**  
**Status:** planning and source audit only. No game code has been modified.  
**Baseline reviewed:** `wayward-2026-11-09(2).html` (uploaded 26 November 2026).

## 1. Project objective

Expand the late-game loop of Wayward beyond optimizing the tavern. The player should be able to visit a larger town, buy existing game resources from specialist shops, take their wife on outings with contextual interactions, recruit and employ suitable existing or generated characters, and eventually purchase and restore a ruined casino with gaming rooms, hotel accommodation, entertainment and staff management.

The expansion should feel like part of the existing medieval sandbox. Reuse existing items, character data, skills, time progression, economy, scenes, trade and save systems wherever practical. Avoid creating parallel item or character systems.

## 2. Firm design constraints

1. Add a **Visit City** option to the player's existing outside-town/out-of-village interface. The player already uses **Go out…** for destinations that need not be drawn as rooms on the map. Keep that interaction model.
2. Rename/re-purpose the current top-level **House** panel as **Village** for the town experience. Preserve access to the existing home-room map as a secondary **Home** view inside that panel (or an equally compact sub-view). Do not delete home navigation: the current panel is used to see occupants and move between rooms.
3. Town shops and stroll destinations are single destinations/scenes. They must **not** become multi-room navigable interiors or add one map room per counter, stockroom or shop department.
4. Keep the existing **Clothier's Shop** and its outfit-preview/purchase flow.
5. Add at least six non-clothing shop locations, one home visit associated with Pippa's friend, and at least two places for outings with the wife.
6. The casino is the only large property with an internal business-management floor plan. Its internal rooms are managed in the casino interface; they are not added to the domestic House map.
7. Preserve current gameplay and all existing saves. New save fields need safe defaults and a versioned migration.

## 3. Village interface and town locations

### 3.1 Navigation

- Add **Visit City** to the existing outside-town area. It starts a city trip/session and opens the Village panel.
- The Village panel is a catalogue of named town destinations. Each destination opens a focused shop, visit or outing interaction. A destination is a single scene/panel, not a room graph.
- Add a compact **Home** switch within Village so the old home-room/occupant view remains usable.
- Keep the existing **Go out…** actions for foraging, hunting, work, family visits and other errands unless they are deliberately relocated without loss of functionality.

### 3.2 Proposed six general/specialist shops

These are six non-clothing destinations. The existing Clothier remains a separate additional destination.

1. **Herbalist / Plant Seller**
   - Sells existing forageable herbs and plant ingredients.
   - Single units, small bundles and wholesale bundles.
   - Common plants are normally available; rarer plants have limited stock, higher prices and lower appearance/restock chances.
   - Prices carry a town-shop markup over gathering/trader values. Bulk deals can lower the per-unit price without making bulk buying cheaper than gathering in every case.
   - Add a lower-than-travelling-merchant negotiation success baseline, adjusted by player/vendor attributes and previous refusals.
   - Respect freshness, storage and the existing herb-wilting rules. Do not create duplicate versions of current ingredients unless a genuinely new preserved item is designed.

2. **Butcher / Tanner**
   - Sells meat and existing animal by-products from hunting: hides, sinew, antlers, tusks, tallow, musk, marrow and related catalogued materials.
   - Supports retail quantities and bundles/wholesale quantities.
   - Can buy surplus hunting products from the player using the existing item definitions and inventory keys.

3. **Brewer & Wine Merchant**
   - One combined drinks shop for beer and wine rather than separate vendors for each drink.
   - Uses the current `supplies.beer`, `supplies.wine` and existing drink economy where applicable.
   - Offers normal quantities, casks/bulk purchases, fluctuating prices and optional stock limits.

4. **Apothecary / Potion Seller**
   - Sells already-supported potion types/effects and selected ingredients.
   - Potions must remain compatible with the current potion use/offer/sell systems.
   - Rare or arcane stock may be limited, expensive or unlocked through knowledge/reputation. Do not make currently forbidden/rare effects universally available by default.

5. **General Market / Provisions**
   - Expands the current abstract Market/Stock Up flow into a visible town destination.
   - Continues to cover food, beer and wine provisioning and any existing supply targets/price limits.
   - Reuse daily market price variation and automatic stock-up logic where compatible. Avoid charging twice when Stock Up and shop purchases refer to the same goods.

6. **Bookseller & Curiosities / Travelling Wares**
   - Groups miscellaneous products rather than creating a vendor for every item.
   - Can offer existing ingredient knowledge pages, recipe/knowledge items, selected rare ingredients, oddments and rotating merchant stock.
   - Reuses the current travelling-merchant pack/trade concepts where practical.

**Additional existing destination:** Clothier's Shop. Keep its current outfit browse, try-on, reaction, purchase and leave-shop mechanics.

**Additional social destination:** Pippa's friend's home. The current code has generated character circles/family/friend relationships and a family/friend visit flow, but the uploaded build does not establish a universal, fixed NPC called “Pippa's friend” for every save. Preferred rule: if Pippa is the selected main character, use a persistent friend from Pippa's circle; if another protagonist is selected, either use that protagonist's generated friend or make this specifically Pippa-only. The chosen person's identity and home must persist in the save.

### 3.3 Two couple-outing destinations

1. **Town Square / Market Green** — busier public location: browse stalls, listen to a street performer, have a snack, watch townsfolk, talk, make a small purchase or attend occasional market/festival events.
2. **Riverside Walk / Gardens** — quieter location: sit together, walk, talk privately, enjoy the scenery, exchange affection and trigger personality/relationship-sensitive scenes.

Each outing should have a small set of contextual actions, scene text and possible outcomes based on time, weather, her personality, energy, mood and relationship. Outings advance in-game time and should not be unlimited free stat boosts. They should feel like activities, not merely a travel button.

## 4. Shared town commerce mechanics

- All shops use the existing item IDs and inventory data wherever possible.
- A single reusable shop model should define vendor identity, shop category, stock, restock schedule, markup, bulk sizes, availability, negotiation temperament and optional reputation gates.
- Transactions must validate quantity, stock, available gold, carrying/storage capacity and item compatibility before changing state.
- Use one negotiation implementation with vendor-specific parameters. The herbalist, butcher and permanent shopkeepers should generally be harder to bargain with than a travelling trader, as requested.
- Shop-specific inventories can rotate by day/season/event. Rare plants and unusual items should be uncommon, not permanently purchasable in unlimited quantities.
- General market provisioning and specialist stock must share a consistent accounting path. Avoid duplicate food/beer/wine inventories.
- Player can sell compatible gathered/hunted goods back to appropriate shops; prices and purchase limits should differ by vendor.
- Every transaction should produce a clear log entry and contribute to the right income/expense ledger.

## 5. Recruitment and employment system

Create one reusable employment system before building the casino's full management layer.

### 5.1 Candidate pool

- Reuse eligible named characters, active NPCs, generated town people and character-circle people where identity/state allows.
- The current source contains archetypes and character templates; this does **not** mean every template is already an active, recruitable person in every existing save. Hiring must create or reference a persistent person instance without duplicating a named NPC.
- Candidates have names, age/adult eligibility, background, attributes, skills, wage expectations, availability and a short personality/temperament description.
- Candidate pool refreshes periodically; hiring one removes or marks that candidate as employed so they cannot be hired twice.

### 5.2 Jobs and skills

Reuse existing skills first: `hunting`, `foraging`, `brewing`, `cooking`, `serving`. Use existing attributes (e.g. charm, wit, strength, deftness, composure) to derive suitability for jobs that do not yet have dedicated skills.

Initial roles:
- Cook / kitchen hand
- Server / bartender / host
- Herbalist's assistant / ingredient gatherer
- Butcher / hunter / provisions handler
- Receptionist / hotel attendant
- Housekeeper / cleaner
- Casino cashier
- Card or dice dealer
- Security / doorman
- Manager / supervisor
- Singer / stage performer
- Dancer / private-room entertainer

If a role needs a new dedicated skill (e.g. cleaning or security), add it only when the role mechanics justify it. Do not inflate every character's skill sheet unnecessarily.

### 5.3 Employment lifecycle

- Hire, assign business, assign role, set wage and schedule, reassign, dismiss and review performance.
- Track wages, morale/satisfaction, fatigue/rest, attendance, experience and job efficiency.
- Payroll is charged at a predictable interval (recommended weekly) and recorded per business.
- A character may have only one active primary job at a time unless explicit part-time shifts are implemented.
- Staff improve through work and can become better at their assigned existing skill over time.
- Use an employee registry referencing persistent character/NPC IDs; do not copy characters into separate disconnected employee identities.

## 6. Casino and integrated hotel

### 6.1 Purchase and restoration

- Casino purchase target: **10,000–15,000 gold**. Suggested initial balance point: **12,500 gold**.
- The property is visibly derelict when acquired. Purchase price buys the full building and its fixed layout, but restoration, equipment, furnishing and recruitment are separate progression costs.
- Make it a substantial late-game goal, clearly beyond the starting tavern economy.
- Show a restoration plan and operating costs before committing to each renovation.

### 6.2 Fixed building layout

**Basement:** storerooms, inventory reserves, secure treasury/cash office and optional staff/maintenance storage.

**Ground floor:** entrance/reception, three dedicated gaming rooms, public hall/bar or service counter, operational spaces (office, security post, staff facilities and supplies access), stage/show room, and the private entertainment lounge.

**Hotel:** three guest floors, three standard rooms per floor (nine standard rooms total), plus one premium suite to reach the requested **maximum of ten rooms**. The building starts with **one usable guest room**; other rooms require progressive repairs, furnishing and staffing. The additional suite is a distinct upgrade/late-game room.

The arithmetic is deliberate: 3 floors × 3 rooms = 9, plus 1 suite = 10. Ground floor and basement do not count as hotel floors/rooms.

### 6.3 Gaming rooms and minigames

Three dedicated rooms:
1. **Card Room** — reuse and deepen the existing card/ante/pot/payout system.
2. **Dice Room** — new playable dice game with stakes, odds, dealer/house edge and opponent personalities.
3. **Board/Table Game Room** — a medieval strategy or tabletop game (e.g. Nine Men's Morris) with a separate ruleset and tournaments.

Each game has its own equipment, capacity, minimum/maximum stakes, staffing, customer type, operating cost and reputation contribution. Tournament events can become late-game goals.

### 6.4 Hotel operation

- Guests, nightly rates, room quality, occupancy, cleanliness, linen/supply costs, maintenance, complaints, damages, late payment and reputation.
- Reception/housekeeping staff improve check-in, cleaning turnover and guest satisfaction.
- Start with one open room and unlock up to ten. Higher-tier rooms attract richer or more demanding guests.
- The casino and hotel should share a property ledger but have separate income categories so the player can see which activity is profitable.

### 6.5 Stage and private entertainment lounge

- The stage supports hired singers, musicians or performers, scheduled shows, event costs, audience attendance, tips and reputation.
- The private lounge supports hired adult dancers/entertainers and optional paid private services, using explicit opt-in interactions rather than automatic or forced outcomes.
- All participating characters must be adults (18+) and their participation must be voluntary. Each worker has boundaries, a share of earnings/tips, fatigue, satisfaction and the ability to refuse or leave a booking.
- Keep ordinary dancing/show work distinct from optional private services. Make prices, employee share and business share transparent in the management interface.
- Use the game's existing consent/relationship interaction architecture where applicable, but do not make employment itself imply consent to private interactions.

## 7. Technical architecture proposal

Avoid creating one-off hard-coded screens for every store. Prefer data-driven catalogues and shared reducers/actions.

Suggested conceptual state modules (names are provisional and should be aligned with the source project types):
- `cityVisit` / `activeCityVisit`: whether the player is in town, chosen shop/destination, companion, start and return slots.
- `cityShops`: shop stock, vendor identity, restock timing, price modifiers, negotiation history and discovery/unlock state.
- `employees`: persistent employee references, role, business, wages, shifts, morale and skill progress.
- `businesses`: owned properties and their individual operating state.
- `businessLedger`: per-business income, expenses, wages, maintenance and transfers to/from the central player treasury.
- `casino`: purchase state, restoration flags, floor/room status, tables, games, hotel occupancy, stage schedule and lounge availability.
- `coupleOutings`: outing history/cooldowns and any small scene-specific state that cannot be derived.

Design principle: keep the player's existing central gold balance authoritative. Give each business a ledger and optional reserve/treasury balance, but avoid two independent gold totals that can drift out of sync. Basement treasury transfers should be explicit ledger transactions.

### Important existing code structures observed in the uploaded HTML

- `ri`, `ad()`, `Iee`, `An()` and `It()` coordinate location IDs, occupant placement, movement and outside transitions.
- `tKe` and `U0` distinguish domestic and outside locations.
- `Bte` and `ra()` implement timed outings/errands through `errandSession`.
- `activeShoppingSession` and the `try_outfit` / `buy_current_outfit` / `leave_shop` actions implement the Clothier flow.
- The Market uses `supplyTargets`, `supplyPriceLimits`, `marketPriceMult`, current supplies and Stock Up logic.
- The travelling merchant uses pack inventory, a barter screen, transaction checks and a haggle refusal calculation.
- `cm`, `g5e` and related potion/ingredient structures define existing ingredients and effects.
- The current House map component renders room occupants and click-to-move actions; preserve its functionality in a secondary Home view.
- Browser saves use the `tavern-game` persistence key with a versioned migration path. New state needs migration/defaulting and backward-compatibility tests.

A strong implementation choice is to model a visit to a shop as a city-trip/shop session, not as another domestic room in `ri`. The visible shop is a single destination card and transaction panel. Keep actual occupancy locations for places where the game needs characters to be physically present and visible.

## 8. Implementation phases

### Phase 0 — Source project and safety baseline
- Obtain the original React/TypeScript project, package manifest, lockfile, `src/`, public assets and build scripts.
- Run the existing build and tests before edits.
- Identify state types, action/reducer dispatch, UI pane registration, persistence version/migrations and item inventory helpers.
- Make a backup and test a copy of an existing save.

### Phase 1 — Village navigation and shops
- Add Visit City outing and a Village panel.
- Preserve old home-room map under Home.
- Implement the six shop catalogue entries and shared transaction UI.
- Connect items to existing IDs, market price logic, inventory capacity, stock limits and the existing haggle formula.
- Keep Clothier working exactly as before.

### Phase 2 — Couple outings and friend's home
- Add the two public outing scenes and contextual actions.
- Reuse the family/friend circle and visit system for the friend's house.
- Add time, weather, energy, mood and relationship-aware results.

### Phase 3 — Employment foundation
- Candidate generation/selection, hiring, role assignment, wages, shifts, morale and skill progress.
- Reuse persistent NPC identities and existing skills.
- Add employee management UI and a small test business/job loop before casino staffing.

### Phase 4 — Casino purchase and restoration
- Add the 10–15k purchase and restoration progression.
- Add the casino management interface and fixed floor plan.
- Implement basement treasury, three gaming rooms, stage, private lounge and operational rooms.
- Open one hotel room and progressively restore the remaining rooms to the 10-room cap.

### Phase 5 — Games, hotel and entertainment
- Cards, dice and board/table minigames.
- Hotel occupancy, guests, housekeeping and room income.
- Stage performers, shows, dancer contracts, private lounge bookings and consent/boundary rules.
- Staff schedules, payroll, events, incidents and profitability objectives.

## 9. Definition of done / acceptance tests

- Existing saves load without losing gold, supplies, characters, relationships, room upgrades, location occupants or game progress.
- New saves and migrated old saves both show the new Village panel and Visit City option.
- Player can still navigate every current home room and see the current occupants in Home.
- Six non-clothing stores exist, plus the Clothier, Pippa/friend home visit and two couple-outing locations.
- No town shop introduces extra player-navigable rooms.
- Buying/selling plants, meat/animal parts, drinks, potions and miscellaneous goods changes the same inventory keys consumed by existing systems.
- Haggling cannot create negative gold, duplicate stock, bypass stock limits or close a vendor incorrectly.
- Outings advance time coherently, return the player and companion correctly and produce contextual scenes.
- Employees cannot be duplicated or assigned conflicting full-time jobs; wages and performance are recorded.
- Casino purchase costs within the chosen 10–15k range; the building begins derelict; one hotel room is usable; the hotel never exceeds 10 rooms; the three guest floors and the suite follow the 9+1 plan.
- The casino has exactly three designated game rooms and separate stage/private entertainment spaces.
- All adult entertainment workers are adults, voluntarily employed and able to set/refuse boundaries; a job contract never grants consent to a private interaction.
- Business income, expenses, wages and treasury movements reconcile with the player's gold.

## 10. What is needed before implementation

The uploaded HTML is a single compiled 3.6 MB build with a large inline minified JavaScript module and embedded styles. It is useful for auditing the live behavior and keeping a baseline, but it is not a maintainable source tree for a refactor of this size.

For the new ChatGPT Project, upload the original project folder as a ZIP or its repository files, ideally including:
- `package.json` and the lockfile;
- `src/` (components, state/store, game logic, data, types and tests);
- `public/` and relevant assets;
- build/deploy scripts and project documentation;
- a copy of a test save, with personal/private data removed if any.

Keep the reviewed HTML as the baseline reference. Do not replace it with a newer build unless that is intentionally the new baseline.

## 11. Working rules for the implementation project

- Work in small, testable phases; do not implement the entire expansion in one giant patch.
- Before changing a mechanic, locate its source module and identify all callers/consumers.
- Prefer shared data-driven shop, employee and business systems over duplicated code.
- Preserve existing item IDs, character identities, actions and save compatibility unless a migration is explicitly written.
- After each phase: build, run tests, load a migrated save, exercise the relevant UI and inspect the game log/economy for duplication or drift.
- Do not change the existing tavern balance merely to make the casino affordable; the casino should be an earned late-game milestone.
