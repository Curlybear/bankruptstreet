# Claude Code — Prompt Sequence
# Fortune Street Engine: Phase 1 → Phase 2 → Phase 3

Feed these prompts to Claude Code **in order**.
Wait for each step to compile and its tests to pass before moving on.

---

## STEP 1 — Project scaffold & shared types

```
Scaffold a new TypeScript project:
- package.json with "type": "module", scripts: { "cli": "node --import tsx/esm cli/index.ts", "build": "tsc" }
- tsconfig.json: strict true, target ES2022, moduleResolution NodeNext, outDir dist
- Install: typescript, tsx, @types/node as devDependencies

Create shared/types.ts with these exact interfaces (copy from CLAUDE.md):
  Node, Property, District, Player, TurnPhase, Action, GameState

Key things the AI often gets wrong here:
- TurnPhase must include PRE_ROLL (not IDLE) — selling stock happens before rolling
- There is NO POST_ACTION phase — stock selling is PRE_ROLL
- District.playerHoldings has no fixed share cap — the bank has unlimited shares
- Player has a `level` field (promotion level), not just suits
- GameState needs: targetNetWorth, winnerId, bankruptCount

No logic in types.ts — interfaces only. Verify with: npx tsc --noEmit
```

---

## STEP 2 — Navigation engine

```
Create engine/navigation.ts.

  interface PathResult {
    destinations: string[];
    decisionPoints: string[];
  }

  function findPaths(
    board: Record<string, Node>,
    startNodeId: string,
    diceRoll: number
  ): PathResult

Rules:
- BFS only — no for-loop step counting
- A decisionPoint is any mid-move node with more than 1 neighbor
- Warp nodes: teleport to node.pairedNodeId and continue counting remaining steps
- Return ALL valid final destinations

Tests (engine/navigation.test.ts):
1. Straight path → single destination, no decision points
2. Branch mid-path → multiple destinations, decision point identified
3. Warp node → player teleports and continues stepping correctly
4. Roll of 0 → starting node is the only destination
```

---

## STEP 3 — Turn state machine

```
Create engine/stateMachine.ts.

  function applyAction(state: GameState, action: Action): GameState

Pure function — never mutate input. Throw on illegal actions.

Legal action map (from CLAUDE.md — node type matters inside SPACE_ACTION):

  PRE_ROLL      → SELL_STOCK (repeatable), ROLL_DICE
  CHOOSING_PATH → CHOOSE_PATH
  SPACE_ACTION (unowned shop)   → BUY_PROPERTY, END_TURN
  SPACE_ACTION (own shop)       → INVEST, END_TURN
  SPACE_ACTION (opponent shop)  → PAY_RENT only — END_TURN is ILLEGAL here
  SPACE_ACTION (bank/broker)    → BUY_STOCK, COLLECT_SALARY (if all suits + bank), END_TURN
  SPACE_ACTION (suit node)      → auto-collect suit, transition to TURN_END (no player input)

After SPACE_ACTION resolves → TURN_END → reset to PRE_ROLL for next player
There is NO POST_ACTION phase.

SELL_STOCK in PRE_ROLL may be called multiple times before ROLL_DICE.

Tests:
1. Legal action succeeds, returns new state object (not the same reference)
2. Illegal action throws with message naming phase + action type
3. PAY_RENT: END_TURN throws when on opponent shop in SPACE_ACTION
4. SELL_STOCK: callable multiple times in PRE_ROLL before ROLL_DICE
5. TURN_END wraps from last player to first, increments round
6. Suit node: auto-collects, no player action needed
```

---

## STEP 4 — Economic rules

```
Create engine/economy.ts.

Read the "Fortune Street Rules" section of CLAUDE.md before writing anything.

Constants:
  BASE_SALARY = 100
  PROMO_BONUS_PER_LEVEL = 50
  MAX_INVEST_PER_TURN = 999
  STOCK_PRICE_CHANGE_THRESHOLD = 10
  DISTRESS_SALE_RATE = 0.75

Implement all functions from CLAUDE.md economy section. The most commonly
mis-implemented ones are called out here:

1. recalcStockPrice(district, properties): number
   floor(average(currentPrice of all shops in district) * 0.04)
   This is the FLOOR the stock price cannot drop below.

2. recalcDistrictMultipliers(district, properties, players): Record<string, Property>
   Count per-player shop ownership within the district.
   Update shopMultiplier: 1 shop=1, 2 shops=2, full district=3 (for 4-shop districts).
   Then update currentPrice = basePrice * shopMultiplier for each shop.
   Then call recalcStockPrice.

3. buyStock / sellStock — price change formula:
   change = floor(stockPrice / 16) + 1
   Only applied when shares >= 10.
   Sell cannot push price below recalcStockPrice() floor.

4. payRent — THE COMMISSION IS PAID BY THE BANK:
   Renter pays full currentRent to owner.
   SEPARATELY, bank pays each shareholder:
     floor(currentRent * 0.10 * (holdings / totalSharesInDistrict))
   Do NOT deduct commission from renter. The renter is unaffected by the commission.

5. collectSalary:
   salary = BASE_SALARY + floor(totalOwnedShopValue * 0.10) + (player.level * PROMO_BONUS_PER_LEVEL)
   Increment player.level. Reset suits.

6. checkWinCondition:
   Wins only if netWorth >= targetNetWorth AND player is at a bank node.
   Net worth alone is not enough.

Tests:
- recalcStockPrice: correct formula, updates when shop prices change
- recalcDistrictMultipliers: multipliers update correctly at 1/2/full ownership
- buyStock: price increases by (floor(price/16)+1) only when shares >= 10
- sellStock: price never drops below shop-value floor
- payRent: renter pays full rent; shareholders receive bank-funded commission on top
- collectSalary: throws if suit missing or not at bank; level increments
- checkWinCondition: requires bank node, not just net worth
- checkBankruptcy: forces stock liquidation first, then shop auction at 75%
```

---

## STEP 5 — CLI test harness

```
Create cli/index.ts.

Hardcode a minimal board with:
- At least 8 nodes in a loop with 1 branch
- 1 bank node, 1 stockbroker node, 4 suit nodes (one of each)
- 2 districts, 4 shops each (8 shops total)
- 2 players (Alice, Bob)
- targetNetWorth = 3000

Run using the greedy bot (engine/bot.ts, written next step) for both players.
Run until state.winnerId is set or 20 rounds elapse.

Print format:
  [Round 1 | PRE_ROLL] Alice → ROLL_DICE
  [Round 1 | MOVING] Alice moves: n1 → n2 → n3
  [Round 1 | SPACE_ACTION] Alice lands on unowned shop "Blue Shop" (200g)
  [Round 1 | SPACE_ACTION] Alice → BUY_PROPERTY "Blue Shop"
  [Round 1 | TURN_END] Alice net worth: 890g

After each turn print all player net worths.
On game end print winner and final net worths.

If applyAction throws at any point, print the error and exit code 1.
```

---

## STEP 6 — Greedy AI bot

```
Create engine/bot.ts.

  function greedyBotAction(state: GameState, botPlayerId: string): Action

Priority order (evaluate top to bottom, return first match):
1. PRE_ROLL + holds stock in district where price dropped since last tracked purchase → SELL_STOCK (all shares in that district)
2. PRE_ROLL → ROLL_DICE
3. CHOOSING_PATH → CHOOSE_PATH toward nearest unowned shop (BFS)
4. SPACE_ACTION on unowned shop + can afford → BUY_PROPERTY
5. SPACE_ACTION on own shop + cash > 200 + capitalInvested < maxCapital → INVEST (amount: 100)
6. SPACE_ACTION on opponent shop → PAY_RENT
7. SPACE_ACTION at bank/stockbroker + cash > 500 → BUY_STOCK (10 shares in district where bot has most shops)
8. SPACE_ACTION at bank + all suits held → COLLECT_SALARY
9. Fallback → END_TURN

Rules:
- Must call applyAction — never write state directly.
- For rule 1: track last-purchase price per district on the Player object or as a separate
  bot-state object. Keep it simple — if stockPrice is lower than when bot last bought, sell.
```

---

## Phase 1 checklist — run before Step 7

```bash
npx tsc --noEmit
node --import tsx/esm cli/index.ts
```

Check every item:
- [ ] All arithmetic uses Math.floor — grep for `/ ` not followed by Math.floor, any `toFixed`, any `parseFloat`
- [ ] SELL_STOCK is callable in PRE_ROLL only — test by calling it in SPACE_ACTION (should throw)
- [ ] Stock price never drops below shop-value floor after selling
- [ ] Price only moves on transactions >= 10 shares — test with 9 shares (no change)
- [ ] payRent commission comes from bank: renter's cash change = -currentRent exactly
- [ ] collectSalary throws if not at bank node
- [ ] Win requires bank node return, not just net worth threshold
- [ ] All suits reset to false after salary collection
- [ ] GameState round-trips: JSON.parse(JSON.stringify(state)) deep-equals original
- [ ] Bot never mutates state directly

---

## STEP 7 — Socket.io server

```
Create server/index.ts and server/gameManager.ts.

GameManager class:
  private rooms: Map<string, GameState>
  getRoom(roomId): GameState | undefined
  createRoom(roomId, players): GameState
  applyValidatedAction(roomId, action): GameState  // calls engine applyAction

Socket.io server on port 3001:

On join_room { roomId, playerId }:
  - If room exists and playerId is in it → emit state_sync (full GameState) to that socket only
  - If room doesn't exist → create with 2 default players → emit state_sync

On request_action { roomId, playerId, action }:
  - Validate playerId === state.currentPlayerId (reject others)
  - Call applyValidatedAction
  - Emit state_delta to ALL sockets in room

  Delta format: { type: string; payload: object }
  Examples:
    { type: 'PLAYER_MOVED', payload: { playerId, path: [nodeId,...], finalNodeId } }
    { type: 'STOCK_PRICE_CHANGED', payload: { districtId, newPrice } }
    { type: 'SALARY_COLLECTED', payload: { playerId, amount, newLevel } }

Server generates dice roll — client sends ROLL_DICE with no value.
Never send full GameState on every action.
Log all events with timestamp + roomId.
```

---

## STEP 8 — Reconnection & hardening

```
1. Reconnection: join_room with existing playerId → full state_sync to that socket only.

2. Input validation on all payloads before processing:
   - roomId, playerId: non-empty strings
   - action.type: one of the known Action types
   - shares: positive integer
   Emit error event on failure — never crash.

3. Sequential action processing per room (no concurrent mutations):
   Use a simple per-room async queue. If two actions arrive simultaneously,
   process them one at a time.

4. Room cleanup: if all sockets disconnect, keep state for 30 minutes then delete.

Smoke test (server/server.test.ts):
- Two clients join same room
- Client 1 sends ROLL_DICE in PRE_ROLL, verify state_delta broadcast to both
- Client 1 sends SELL_STOCK in SPACE_ACTION, verify error emitted to client 1 only
- Client 2 disconnects, reconnects, verify state_sync received with current state
```

---

## STEP 9 — React + PixiJS board

```
Scaffold React client with Vite + TypeScript.
Install: pixi.js, socket.io-client, react, react-dom.

Create client/Board.tsx:
- Mount PixiJS Application in useEffect
- On state_sync: render one circle per Node at coordinates (x, y)
- Draw edges between neighbors using PixiJS Graphics
- One coloured token per player at their currentNodeId
- Camera pans to active player's node at start of their turn

On PLAYER_MOVED event:
- Animate token along the path array node-by-node (50ms per node)
- Warp: alpha 1→0 at source, alpha 0→1 at destination
- NEVER move token before PLAYER_MOVED is received

Connect to localhost:3001. On mount emit join_room with hardcoded test roomId/playerId.
```

---

## STEP 10 — UI modals

```
Three React modals overlaid on the PixiJS canvas.

1. client/modals/StockExchange.tsx
   Shown during PRE_ROLL phase.
   For each district: name, current stockPrice, player's holdings, buy/sell input.
   Sell emits SELL_STOCK. Buy emits BUY_STOCK (only available at bank/stockbroker).
   Closes when phase leaves PRE_ROLL.
   Disable sell button for opponent players.

2. client/modals/ShopManagement.tsx
   Shown during SPACE_ACTION on player's own shop.
   Shows: shop name, currentPrice, capitalInvested / maxCapital, invest input (max 999).
   Invest button emits INVEST action.
   Closes when phase changes.

3. client/modals/PlayerStats.tsx
   Always-visible sidebar.
   For each player: name, cash, netWorth, level, suits collected (4 icons), stocks per district.
   Format all gold as integer with 'G' suffix (e.g. "1240G"), not dollars.

Rules:
- All values from GameState received via socket — never compute locally.
- Buttons disabled for non-active player.
```

---

## Final checklist before shipping Phase 3

```bash
npx tsc --noEmit
node --import tsx/esm cli/index.ts   # runs to a winner with no errors
```

- [ ] Stock price floor enforced after every sell
- [ ] Price only moves at 10+ shares
- [ ] Salary formula uses shop value, not a flat number
- [ ] Commission is bank-funded — verified by checking renter cash change equals exactly -currentRent
- [ ] Win condition requires bank node
- [ ] Token never moves before PLAYER_MOVED
- [ ] StockExchange shows during PRE_ROLL, not after movement
- [ ] Gold formatted as integer + 'G' (not dollars)
- [ ] Bot calls applyAction only
