# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Commands

**Root (engine + server):**
```bash
npm test                          # run all tests (engine + server)
npm run cli                       # run 2-bot simulation in terminal
npm run server                    # start Socket.io server on :3001
npm run build                     # tsc type-check + compile to dist/
```

Run a single test file:
```bash
node --import tsx/esm --test engine/economy.test.ts
node --import tsx/esm --test engine/navigation.test.ts
node --import tsx/esm --test engine/stateMachine.test.ts
node --import tsx/esm --test server/server.test.ts
```

**Client (separate package in `client/`):**
```bash
cd client && npm run dev          # Vite dev server on :5173
cd client && npm run build        # tsc + vite build to client/dist/
```

Two-tab local multiplayer: open `http://localhost:5173?player=alice` and `http://localhost:5173?player=bob`.

---

## Architecture

All three phases are fully implemented. The engine is the source of truth — the server and client are thin wrappers around it.

### State flow
`applyAction(state, action) → GameState` is a **pure function** in `engine/stateMachine.ts`. No mutation anywhere. The server calls it, broadcasts deltas, and re-emits `state_sync` on reconnect.

### Two separate TypeScript projects
- Root `tsconfig.json` covers `shared/`, `engine/`, `server/`, `cli/` (Node + ESM imports with `.js` extensions).
- `client/tsconfig.json` covers `client/**` + `../shared/**` (bundler resolution via Vite).
- Imports within the root project must use `.js` extensions (e.g. `'../shared/types.js'`).

### Key files
| File | Role |
|---|---|
| `shared/types.ts` | All interfaces — `GameState`, `Player`, `Property`, `District`, `Node`, `Action`, `TurnPhase`, `VentureCard` |
| `engine/stateMachine.ts` | `applyAction` — phase gating, movement, `resolveSpace`, `advanceTurn` |
| `engine/economy.ts` | All money functions: `buyProperty`, `payRent`, `buyStock`, `sellStock`, `collectSalary`, `checkBankruptcy`, `checkWinCondition`, `resolveVentureCard`, vacant plot building |
| `engine/navigation.ts` | `findPaths` (BFS destinations + decision points), `getPath` (animation path) |
| `engine/bot.ts` | `greedyBotAction` — stateless greedy AI; uses `purchasePrices` Map for sell-on-drop |
| `server/gameManager.ts` | `GameManager` (Map of roomId→GameState), board definition, `makePlayer`, `computeDeltas` |
| `server/index.ts` | Socket.io server; validates payloads, calls `applyAction`, drives bots, broadcasts `state_delta` + `state_sync` |
| `client/useGameSocket.ts` | React hook: connects socket, listens to `state_sync`/`state_delta`, emits `request_action` |
| `client/Board.tsx` | PixiJS canvas renderer — nodes, edges, player tokens, animation |
| `client/App.tsx` | Phase-driven overlay: `PRE_ROLL` → StockExchange, `SPACE_ACTION` → shop/property modals, `CHOOSING_PATH` → direction picker |

### Vacant plots (premium rules)
`vacant` nodes hold a `Property` with optional `buildingType`. `BUILD_PLOT` (in `SPACE_ACTION`) and `RENOVATE_PLOT` (in `PRE_ROLL`) let players construct buildings. Building types: `checkpoint`, `circus`, `balloonport`, `tax_office`, `home`, `estate_agency`, `three_star_shop`. Each has custom rent/price logic in `recalcDistrictMultipliers` and `payRent`.

### Venture card grid
`GameState.ventureGrid` is a 64-cell grid (8×8). Landing on a `venture` or `suit` node triggers `CHOOSE_VENTURE_CARD`. Lines of 4+ cleared cells pay bonuses. The card pool (`VENTURE_CARDS_LIST`, 96 cards) is larger than the grid — each game seeds a random 64-card subset via `seedVentureGridCardIds()`; depletion reshuffles with a fresh subset.

### Board authoring
Boards are authored with forward edges only; `symmetrizeBoard(board, oneWayEdges?)` (server/gameManager.ts) fills in reverse edges, skipping any `[from, to]` pairs listed as one-way. Native `tax_office` squares charge 5% of net worth to the bank on landing (auto-resolve).

### Socket protocol
Client emits `join_room` / `request_action`. Server responds with `state_sync` (full state, on join/reconnect) or `state_delta` (minimal diff, on every action). Client re-joins after each delta to get a fresh `state_sync` — this is intentional (see feedback memory).

---

# Fortune Street — Game Engine Project Brief

> This file is the authoritative project brief for Claude Code.
> Read it fully before writing any code.

---

## Project Overview

Build a multiplayer, browser-based board game engine inspired by *Fortune Street* (Itadaki Street series). The game is **not Monopoly** — it has branching board paths, a district stock market, and a suit/promotion mechanic that must all be implemented correctly.

The project is split into three phases:

- **Phase 1 — Headless Engine:** Core game logic running in the terminal (no UI)
- **Phase 2 — Multiplayer Server:** Real-time synchronisation over WebSockets
- **Phase 3 — Frontend:** React + PixiJS renderer

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (strict mode) |
| Runtime | Node.js 20+ |
| Realtime | Socket.io |
| State cache | In-memory `Map` (Redis optional later) |
| Currency math | **Integers only (gold coins)** — no floats ever |
| Module system | ESM (`"type": "module"` in package.json) |
| Frontend | React + PixiJS (Phase 3) |

---

## Fortune Street Rules — Read Before Writing Any Code

This section contains the actual game rules reverse-engineered from the Wii game. Every formula here is verified. Do not invent alternatives.

### Board & movement
- The board is a **directed graph**, not a linear loop. Nodes have multiple neighbors at intersections.
- Players roll one die per turn and move that many spaces.
- At branch nodes, movement pauses and the player must choose a direction.
- **Passing the bank** (not just landing) allows the player to buy stock. Landing on the bank also grants a salary if all 4 suits are held.

### Shop (property) prices and rent
- Each shop has a `basePrice` set at game start.
- `currentPrice = basePrice × shopMultiplier`
- `shopMultiplier` is an integer that increases with district ownership:
  - 1 shop in district → multiplier = 1
  - 2 shops → multiplier = 2 for all owned shops in that district
  - Full district ownership (domination) → multiplier jumps significantly higher (exact value is board-specific; use 3 as default for domination of a 4-shop district)
- `maxCapital` (investment cap) also scales with `shopMultiplier`
- Rent scales with capital invested. The price multiplier on the shop's `currentPrice` is re-applied when calculating rent.

### Investing in shops
- When a player **lands on their own shop**, they may invest up to **999 gold per turn** (hard cap).
- There is no per-investment tier system — it is a continuous investment up to `maxCapital`.
- Investing increases `capitalInvested` and raises `currentRent`.
- Investing also raises the district's `stockPrice` (see stock price formula below).

### District stock price
The stock price is derived from shop values, not a fixed multiplier. The verified formula is:

```
stockPrice = floor(average(currentPrice of all shops in district) * 0.04)
```

- Recalculate this whenever any shop's `currentPrice` changes (ownership change, investment, district bonus).
- Stock price can also change from bulk buy/sell transactions (see below).
- Stock price never falls below its shop-value floor.

### Buying and selling stock
- Stock can be bought at: **bank square** (passing or landing), **stockbroker square** (landing only).
- Players can buy **1 to 99 shares per transaction** in a single district.
- **Selling stock happens at the start of a turn (PRE_ROLL phase)**, before rolling the die. Players may sell from multiple districts before rolling.
- There is **no fixed total share count** — the bank has unlimited shares to sell.

**Price impact of transactions (only triggers at 10+ shares):**
- Buying or selling fewer than 10 shares → **no price change**
- Buying or selling 10+ shares → price changes by: `floor(stockPrice / 16) + 1`
  - Buying 10+: price **increases** by that amount
  - Selling 10+: price **decreases** by that amount
- Price cannot fall below the shop-value floor: `floor(averageCurrentPrice * 0.04)`

### Dividends / commission
- When any player lands on an opponent's shop, the shop owner collects rent.
- Additionally, **all players who hold stock in that district earn a commission** equal to 10% of the rent amount, split proportionally by share count.
- Commission = `floor(rent * 0.10 * (playerShares / totalSharesInDistrict))`
- The owner also gets their proportional 10% commission on top of the rent if they hold shares in the district.
- This 10% comes from the bank — it is NOT deducted from the payer's rent. The renter pays full rent; the commission is a separate bank payout.

### Salary / promotion
Collecting all 4 suits and reaching the bank earns a **promotion**. Salary formula:
```
salary = baseSalary + floor(totalOwnedShopValue * 0.10) + promotionalBonus(level)
```
- `baseSalary` is a fixed constant (e.g. 100g)
- `totalOwnedShopValue` = sum of `currentPrice` for all shops the player owns
- `promotionalBonus` increases with each level (e.g. level × 50g)
- After collecting, reset all 4 suits to false and increment `player.level`

### Win condition
- A player wins by reaching `targetNetWorth` AND then **returning to the bank square**.
- Net worth = `player.cash + Σ(shares × stockPrice) + Σ(currentPrice of owned shops)`
- The game also ends immediately if a player goes bankrupt (net worth < 0); the player with the highest net worth at that point wins.

### Bankruptcy
- If a player's `cash` goes below 0, they must sell stocks or shops to cover the debt.
- Bank buys shops at 75% of `currentPrice` when the player is in debt (distress sale).
- If net worth drops below 0 after liquidation, the player is bankrupt and eliminated.

---

## Phase 1 — Headless Engine

### 1. Shared Types (`shared/types.ts`)

```ts
interface Node {
  id: string;
  type: 'property' | 'bank' | 'stockbroker' | 'suit' | 'warp' | 'venture' | 'vacant' | 'tax_office';
  neighbors: string[];
  coordinates: { x: number; y: number };
  pairedNodeId?: string;   // warp/pipe nodes only
}

interface Property {
  id: string;
  nodeId: string;
  districtId: string;
  ownerId: string | null;
  basePrice: number;        // fixed at game start
  currentPrice: number;     // basePrice * shopMultiplier; update on district changes
  baseRent: number;         // rent with no investment, single ownership
  currentRent: number;      // actual rent charged to visitors
  capitalInvested: number;  // total gold invested so far
  maxCapital: number;       // investment cap; scales with shopMultiplier
  shopMultiplier: number;   // 1, 2, or 3+ based on district ownership count
}

interface District {
  id: string;
  name: string;
  stockPrice: number;       // floor(avg currentPrice * 0.04); recalc on any price change
  propertyIds: string[];
  playerHoldings: Record<string, number>;  // playerId -> shares (no cap on total)
}

interface Player {
  id: string;
  name: string;
  cash: number;
  netWorth: number;         // cash + Σ(shares*stockPrice) + Σ(currentPrice of owned shops)
  currentNodeId: string;
  level: number;            // starts at 1, increments on each salary collection
  suits: { heart: boolean; diamond: boolean; club: boolean; spade: boolean };
  propertyIds: string[];
  isBankrupt: boolean;
}

type TurnPhase =
  | 'PRE_ROLL'        // player may sell stock, then must roll
  | 'ROLLING'         // internal
  | 'MOVING'          // internal
  | 'CHOOSING_PATH'   // player picks direction at branch
  | 'SPACE_ACTION'    // resolving the landed square
  | 'TURN_END';       // internal cleanup

type Action =
  | { type: 'SELL_STOCK'; districtId: string; shares: number }
  | { type: 'ROLL_DICE' }
  | { type: 'CHOOSE_PATH'; nodeId: string }
  | { type: 'BUY_PROPERTY'; propertyId: string }
  | { type: 'INVEST'; propertyId: string; amount: number }
  | { type: 'PAY_RENT'; propertyId: string }
  | { type: 'BUY_STOCK'; districtId: string; shares: number }
  | { type: 'COLLECT_SALARY' }
  | { type: 'END_TURN' }

interface GameState {
  roomId: string;
  players: Record<string, Player>;
  turnOrder: string[];
  currentPlayerId: string;
  currentPhase: TurnPhase;
  board: Record<string, Node>;
  properties: Record<string, Property>;
  districts: Record<string, District>;
  round: number;
  targetNetWorth: number;
  winnerId: string | null;
  bankruptCount: number;
  log: string[];
}
```

---

### 2. Navigation Engine (`engine/navigation.ts`)

```ts
interface PathResult {
  destinations: string[];     // all possible final node ids for this roll
  decisionPoints: string[];   // branch nodes where player must choose mid-move
}

function findPaths(board: Record<string, Node>, startNodeId: string, diceRoll: number): PathResult
```

**Rules:**
- Use BFS. Never a simple for-loop.
- A `decisionPoint` is a mid-move node with more than 1 neighbor (not the final destination).
- Warp nodes: teleport to `pairedNodeId` and continue counting steps from there.
- Return all valid destinations so the UI can present a choice.

---

### 3. Turn State Machine (`engine/stateMachine.ts`)

```ts
function applyAction(state: GameState, action: Action): GameState
```

Legal action map (node type matters within SPACE_ACTION):

| Phase | Node type | Legal actions |
|---|---|---|
| `PRE_ROLL` | any | `SELL_STOCK` (0 or more times), then `ROLL_DICE` |
| `CHOOSING_PATH` | any | `CHOOSE_PATH` |
| `SPACE_ACTION` | unowned shop | `BUY_PROPERTY`, `END_TURN` (skip) |
| `SPACE_ACTION` | own shop | `INVEST`, `END_TURN` (skip) |
| `SPACE_ACTION` | opponent shop | `PAY_RENT` — mandatory, `END_TURN` is **illegal** |
| `SPACE_ACTION` | bank or stockbroker | `BUY_STOCK`, `COLLECT_SALARY` (if all suits held + bank), `END_TURN` |
| `SPACE_ACTION` | suit node | auto-collect suit → immediately transition to TURN_END (no player input) |
| `SPACE_ACTION` | venture/vacant | draw card / resolve effect → TURN_END |

**Rules:**
- `applyAction` is a pure function — returns new state, never mutates.
- `SELL_STOCK` may be called multiple times in `PRE_ROLL` before `ROLL_DICE`.
- After any `SPACE_ACTION` resolves, transition to `TURN_END` (no POST_ACTION phase — stock selling already happened PRE_ROLL).
- `TURN_END` advances `currentPlayerId` (wrap around `turnOrder`) and resets to `PRE_ROLL`.
- Throw a descriptive error on illegal actions.

---

### 4. Economic Rules (`engine/economy.ts`)

**Constants (define at top of file):**
```ts
const BASE_SALARY = 100
const PROMO_BONUS_PER_LEVEL = 50
const MAX_INVEST_PER_TURN = 999
const STOCK_PRICE_CHANGE_THRESHOLD = 10   // minimum shares for price to move
const DISTRESS_SALE_RATE = 0.75           // bank buys at 75% when player is in debt
```

**Functions:**

```ts
// Recalculate district stock price from shop values (call after any shop price change)
function recalcStockPrice(district: District, properties: Record<string, Property>): number
// floor(average(currentPrice of all shops in district) * 0.04)
// This is the floor the price cannot drop below.

// Update shopMultiplier for all properties in a district when ownership changes
function recalcDistrictMultipliers(
  district: District,
  properties: Record<string, Property>,
  players: Record<string, Player>
): Record<string, Property>
// Count how many shops in the district each player owns.
// The player with the most shops sets the multiplier for their shops:
//   1 shop → multiplier 1, 2 shops → 2, full district → 3 (for 4-shop districts)
// After updating multipliers, recalc currentPrice and maxCapital for each shop,
// then call recalcStockPrice.

// Player buys an unowned shop
function buyProperty(state: GameState, playerId: string, propertyId: string): GameState
// - Cost = property.currentPrice
// - Throw if player can't afford it or property already owned
// - Set ownerId, add to player.propertyIds
// - Call recalcDistrictMultipliers (ownership changed)
// - Recalc net worth

// Player invests in their own shop (landed on it)
function invest(state: GameState, playerId: string, propertyId: string, amount: number): GameState
// - amount must be <= MAX_INVEST_PER_TURN and <= (maxCapital - capitalInvested)
// - Deduct from player.cash, add to property.capitalInvested
// - Increase currentRent proportionally
// - Call recalcStockPrice (investment raises shop value which drives stock price)
// - Recalc net worth for all players (stock price change affects everyone)

// Player pays rent on opponent's shop
function payRent(state: GameState, payerId: string, propertyId: string): GameState
// - Charge currentRent from payer
// - Pay currentRent to shop owner
// - Pay 10% commission from the BANK (not from payer) to all district shareholders:
//     commission per player = floor(currentRent * 0.10 * (holdings / totalSharesInDistrict))
//     where totalSharesInDistrict = sum of all playerHoldings values
// - Check bankruptcy for payer after payment
// - Recalc net worth for all affected players

// Player buys stock (at bank or stockbroker)
function buyStock(state: GameState, playerId: string, districtId: string, shares: number): GameState
// - Cost = shares * district.stockPrice
// - Deduct from player.cash, add to playerHoldings[playerId]
// - If shares >= STOCK_PRICE_CHANGE_THRESHOLD:
//     newPrice = stockPrice + floor(stockPrice / 16) + 1
//     newPrice must not exceed any reasonable cap (no artificial cap needed)
// - Recalc net worth for all players
// - Throw if player can't afford it

// Player sells stock (PRE_ROLL only)
function sellStock(state: GameState, playerId: string, districtId: string, shares: number): GameState
// - Proceeds = shares * district.stockPrice
// - Add to player.cash, remove from playerHoldings[playerId]
// - If shares >= STOCK_PRICE_CHANGE_THRESHOLD:
//     priceFloor = recalcStockPrice(district, properties)
//     newPrice = max(priceFloor, stockPrice - (floor(stockPrice / 16) + 1))
// - Recalc net worth for all players
// - Throw if player doesn't hold enough shares

// Player collects salary at bank (all 4 suits held)
function collectSalary(state: GameState, playerId: string): GameState
// - Throw if any suit is false or player is not at a bank node
// - salary = BASE_SALARY + floor(totalOwnedShopValue * 0.10) + (player.level * PROMO_BONUS_PER_LEVEL)
//   where totalOwnedShopValue = sum of currentPrice for all shops in player.propertyIds
// - Add salary to player.cash
// - Reset all 4 suits to false
// - Increment player.level
// - Recalc net worth

// Check if player has won (call after any net worth change)
function checkWinCondition(state: GameState, playerId: string): GameState
// - If player.netWorth >= state.targetNetWorth AND player is at a bank node:
//     set state.winnerId = playerId

// Check and handle bankruptcy (call after any cash reduction)
function checkBankruptcy(state: GameState, playerId: string): GameState
// - If player.cash < 0, trigger forced liquidation:
//     sell stocks at current price until cash >= 0 or no stocks remain
//     if still cash < 0, sell shops at DISTRESS_SALE_RATE (75%) until cash >= 0
//     if net worth < 0 after all liquidation, set player.isBankrupt = true
//     increment state.bankruptCount

// Recalculate net worth for a player
function recalcNetWorth(player: Player, state: GameState): number
// cash + Σ(playerHoldings[districtId] * district.stockPrice) + Σ(property.currentPrice for owned shops)
```

**Rules:**
- `Math.floor()` on every calculation. Zero fractional gold.
- Always call `recalcNetWorth` after any economic action.
- Always call `recalcStockPrice` after any investment or district ownership change.
- `PAY_RENT` commission is paid **by the bank**, not deducted from the renter.

---

### 5. CLI Test Harness (`cli/index.ts`)

Simulate a 2-player game using the greedy bot for both players. Run until a winner or 20 rounds. Print every action and state transition. Validate that no illegal state is ever reached.

---

## Phase 2 — Multiplayer Server

### 1. Server Setup (`server/index.ts`)

- Node.js + Socket.io
- `GameManager` holds `Map<roomId, GameState>`
- All events pass through a `Validator` before touching state

### 2. Socket Event Protocol

| Client → Server | Payload | Description |
|---|---|---|
| `join_room` | `{ roomId, playerId }` | Connect to a room |
| `request_action` | `{ roomId, playerId, action: Action }` | Request any game action |

| Server → Client | Payload | Description |
|---|---|---|
| `state_sync` | `GameState` | Full state dump (join/reconnect) |
| `state_delta` | `{ type, payload }` | Minimal update per action |
| `error` | `{ code, message }` | Validation failure |

**Rules:**
- Server is the only source of truth for dice rolls.
- Never send full state on every action — only on join/reconnect.
- Process actions sequentially per room (no concurrent mutations).

### 3. Reconnection

On `join_room` with an existing `playerId`, send full `state_sync` to that socket only.

---

## Phase 3 — Frontend (React + PixiJS)

Build only after the CLI harness runs cleanly.

### Board Renderer (`client/Board.tsx`)
- PixiJS canvas: nodes at their `coordinates`, edges from `neighbors`.
- Camera follows active player's piece.
- Tokens animate along the `path` array node-by-node after `PLAYER_MOVED` event — never before.
- Warp animation: fade out → fade in at destination.

### Required Modals

| Modal | Trigger | Contents |
|---|---|---|
| Stock Exchange | `PRE_ROLL` phase | All districts, stockPrice, player holdings, buy/sell controls |
| Shop Management | `SPACE_ACTION` on own shop | capitalInvested, maxCapital, invest input (max 999) |
| Player Stats | Always visible sidebar | Cash, net worth, level, suits collected, stocks held |

---

## Greedy AI Bot (`engine/bot.ts`)

```ts
function greedyBotAction(state: GameState, botPlayerId: string): Action
```

Priority order:
1. `PRE_ROLL`: if holding stock in a district where stockPrice dropped below purchase cost → `SELL_STOCK`; otherwise → `ROLL_DICE`
2. `CHOOSING_PATH`: BFS toward nearest unowned shop → `CHOOSE_PATH`
3. `SPACE_ACTION` on unowned shop, can afford → `BUY_PROPERTY`
4. `SPACE_ACTION` on own shop, has cash > 200 and below maxCapital → `INVEST` (invest 100g)
5. `SPACE_ACTION` on opponent shop → `PAY_RENT`
6. `SPACE_ACTION` at bank/stockbroker, cash > 500, bank has a district with multiple owned shops → `BUY_STOCK` (10 shares)
7. `SPACE_ACTION` at bank, all suits held → `COLLECT_SALARY`
8. Anything else → `END_TURN`

**Rules:**
- Bot must call `applyAction` — never mutate state directly.

---

## Known Pitfalls — Do Not Ignore

1. **No for-loop movement.** BFS only. Movement halts at branch points in `CHOOSING_PATH`.

2. **Track suits.** Update `player.suits` on every suit node pass-through. Silent failure if forgotten.

3. **No floats.** `Math.floor()` on every single calculation. Test: `199 + 1 === 200`, not `0.199 + 0.001`.

4. **SELL_STOCK is PRE_ROLL, not post.** Players sell before rolling. There is no POST_ACTION phase.

5. **Stock price has a floor.** Selling can never push price below `floor(avgCurrentPrice * 0.04)`.

6. **Price moves only at 10+ shares.** Transactions under 10 shares don't move the price at all.

7. **Commission is paid by the bank.** The 10% dividend shareholders receive does not reduce the renter's payment. It is a separate bank payout.

8. **Win requires returning to bank.** Reaching targetNetWorth mid-board does not win. The player must then reach a bank square.

9. **Salary is not a flat bonus.** It is `baseSalary + 10% of owned shop value + level bonus`. It grows as the player builds up shops.

10. **Passing the bank allows stock purchase.** The player does not need to land on it — passing is enough to buy stock.

11. **Bot must use the state machine.** `applyAction` only. No direct state writes.

---

## Directory Structure

```
/
├── shared/
│   └── types.ts
├── engine/
│   ├── navigation.ts
│   ├── stateMachine.ts
│   ├── economy.ts
│   └── bot.ts
├── server/
│   ├── index.ts
│   └── gameManager.ts
├── client/
│   ├── Board.tsx
│   ├── modals/
│   │   ├── StockExchange.tsx
│   │   ├── ShopManagement.tsx
│   │   └── PlayerStats.tsx
│   └── App.tsx
├── cli/
│   └── index.ts
├── package.json
└── tsconfig.json
```

---

## First Task for Claude Code

> Define all TypeScript interfaces in `shared/types.ts` exactly as specified above. Ensure the entire state tree serialises cleanly with `JSON.stringify` / `JSON.parse`. No game logic in this file.
