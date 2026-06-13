# 🎲 Bankrupt Street

A multiplayer, browser-based board game of property, stocks, and timing — branching boards, a district stock market, and a suit/promotion mechanic, set in a fantasy world with its own house rules.

Buy shops, dominate districts, play the stock market, collect suits for promotions, and race to the target net worth before your rivals — or before someone goes bankrupt and ends it all.

📜 **[Full game rules](RULES.md)** (also available in-game via the "How to Play" button)

![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue) ![Node](https://img.shields.io/badge/Node-20+-green) ![Tests](https://img.shields.io/badge/tests-181%20passing-brightgreen)

## Features

- **Full game engine** — branching board movement, a deep district economy (fees scale ×1/1.25/2/3.25/6 with ownership, capital-driven rent, 4%-of-value stock pricing with price impact), suit/promotion salaries, Suit Yourself wildcards, seven buildable structures, a 124-card venture deck on a shared 8×8 grid with line bonuses, buyouts, and bankruptcy liquidation
- **Interactive venture cards** — beyond the auto-resolving effects, cards that let you buy/sell stock or shops at the bank on your terms (and forced buy-outs you can't refuse)
- **Player debt auctions** — going broke puts your shops up for live auction among the other players, with the bank's 75% offer as the floor
- **Casino & free arcade** — wager games (Slime Derby, High-Low) plus three level-scaled minigames (Lucky Reels slots, Memory Match, Golden Darts)
- **Board gimmicks** — roll-on (extra roll), backstreet alleys (paired warps), cannons (blast onto a rival), change-of-suit squares, plus Boon/Boom commission squares and take-a-break penalties
- **Three boards** — *Eldermoor* (warp pipes into a lucrative central island), *Mistral* (one-way River Rapids shortcut, royal tax office), and *Aldoria* (twin loops crossing at the bank, desert wind, the Farisle warp island)
- **Six AI characters with real personalities** — from the buyout-hungry 🐉 The Tyrant to the stock-trading 👸 Lady Mirelle; empty seats are auto-filled with distinct AI opponents, balance-tuned over thousands of simulated games
- **Online multiplayer** — lobby system with room browser, board/character selection, reconnection support, and rooms that survive server restarts
- **End-game rankings** — per-player stat breakdown: laps, rent flows, biggest payday, shares traded, promotions
- **PixiJS board renderer** — animated tokens, camera follow, warp effects

## Tech Stack

| Layer | Technology |
|---|---|
| Engine & server | TypeScript (strict), Node.js 20+, Socket.io |
| Frontend | React 18 + PixiJS 8, Vite |
| State | Pure-function engine (`applyAction`), JSON-serializable game state |
| Currency | Integers only — no floats, ever |

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Install

```bash
# Root (engine + server)
npm install

# Client
cd client && npm install && cd ..
```

### Run

One command — installs dependencies if needed, builds, and starts both servers (Ctrl+C stops everything):

```bash
./start.sh
```

Or manually, two processes — server and client:

```bash
# Terminal 1: game server (Socket.io on :3001)
npm run server

# Terminal 2: client dev server (Vite on :5173)
cd client && npm run dev
```

Open **http://localhost:5173**, enter a username, pick a character and a board, create a room — then either invite friends to join from the room browser, or just hit *Start Game* and the empty seats fill with AI opponents.

Local two-player testing: open two tabs with different usernames.

Rooms are persisted to `data/rooms.json` — restarting the server keeps games alive; players reconnect by rejoining with the same username.

### Headless simulation

Watch two AI personalities play a full game in the terminal:

```bash
npm run cli
```

### Tests

```bash
npm test                                          # full suite (engine + server)
node --import tsx/esm --test engine/economy.test.ts   # single file
```

### Production build

```bash
npm run build              # engine + server → dist/
cd client && npm run build # client → client/dist/
```

## Project Structure

```
shared/      Types + character roster (used by engine, server, and client)
engine/      Game logic: state machine, economy, navigation, AI bot
server/      Socket.io server, room manager, board definitions, persistence
client/      React + PixiJS frontend (separate npm package)
cli/         Headless 2-bot simulation harness
```

The engine is the single source of truth: `applyAction(state, action) → newState` is a pure function, the server is a thin validated wrapper around it, and the client renders whatever the server broadcasts. Dice rolls only happen server-side.

## Architecture Notes

- **Boards are data** — a board is nodes + properties + districts + an optional one-way edge list in `server/boards.ts`. Adding a board requires no engine changes.
- **AI personalities are parameters** — all six characters share one decision algorithm (`engine/bot.ts`); their personalities are just different thresholds in `shared/characters.ts`.
- **State serializes cleanly** — `JSON.stringify`/`parse` round-trips the entire game, which is what makes room persistence a one-liner.
