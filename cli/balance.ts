// Balance harness: batch headless bot games across all boards and report
// win rates per personality and seat, game length, and end conditions.
//
//   node --import tsx/esm cli/balance.ts [gamesPerBoard] [targetNetWorth] [bankruptcyLimit]

import { GameManager, makePlayer } from '../server/gameManager.js';
import { applyAction } from '../engine/stateMachine.js';
import { greedyBotAction } from '../engine/bot.js';
import { BOARDS } from '../server/boards.js';
import { CHARACTER_IDS } from '../shared/characters.js';
import type { GameState } from '../shared/types.js';

const GAMES_PER_BOARD = Number(process.argv[2] ?? 200);
const TARGET = Number(process.argv[3] ?? 15000);
const BANKRUPTCY_LIMIT = Number(process.argv[4] ?? 1);
const ROUND_CAP = 100;
const ACTION_CAP = 30000;

interface Tally { games: number; wins: number; }
function bump(map: Map<string, Tally>, key: string, won: boolean) {
  const t = map.get(key) ?? { games: 0, wins: 0 };
  t.games += 1;
  if (won) t.wins += 1;
  map.set(key, t);
}


// During an auction, actions come from undecided bidders, not the current player.
function nextActorId(state: GameState): string {
  if (state.auction) {
    const a = state.auction;
    const undecided = state.turnOrder.find(pid =>
      pid !== a.sellerId && !state.players[pid].isBankrupt
      && !a.passed[pid] && a.highBid?.playerId !== pid,
    );
    if (undecided) return undecided;
  }
  return state.currentPlayerId;
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const charWins = new Map<string, Tally>();
const charBankrupts = new Map<string, number>();
const seatWins = new Map<string, Tally>();
const perBoard: Record<string, { rounds: number[]; bankruptEnds: number; capped: number; winnerWorth: number[]; lastWorth: number[]; targetWins: number }> = {};

let gameSeq = 0;
for (const boardId of Object.keys(BOARDS)) {
  const stats = { rounds: [] as number[], bankruptEnds: 0, capped: 0, winnerWorth: [] as number[], lastWorth: [] as number[], targetWins: 0 };
  perBoard[boardId] = stats;

  for (let g = 0; g < GAMES_PER_BOARD; g++) {
    gameSeq++;
    const chars = shuffled([...CHARACTER_IDS]).slice(0, 4);
    const ids = chars.map((_, i) => `g${gameSeq}s${i}`);

    const m = new GameManager();
    let state: GameState = m.createRoom(`bal${gameSeq}`, [ids[0]], TARGET, boardId, BANKRUPTCY_LIMIT);
    state.players[ids[0]] = makePlayer(ids[0], chars[0]);
    for (let i = 1; i < 4; i++) {
      state.players[ids[i]] = makePlayer(ids[i], chars[i]);
      state.turnOrder.push(ids[i]);
    }
    state.status = 'ACTIVE';

    let actions = 0;
    while (!state.winnerId && state.round <= ROUND_CAP && actions++ < ACTION_CAP) {
      const actor = nextActorId(state);
      state = applyAction(state, greedyBotAction(state, actor));
    }

    if (!state.winnerId) {
      stats.capped++;
      continue;
    }

    const winnerIdx = state.turnOrder.indexOf(state.winnerId);
    const winnerChar = state.players[state.winnerId].characterId ?? '?';
    for (let i = 0; i < 4; i++) {
      bump(charWins, chars[i], chars[i] === winnerChar && i === winnerIdx);
      bump(seatWins, `seat${i + 1}`, i === winnerIdx);
    }
    stats.rounds.push(state.round);
    if (state.bankruptCount > 0) {
      stats.bankruptEnds++;
      for (const [pid, pl] of Object.entries(state.players)) {
        if (pl.isBankrupt) {
          const c = pl.characterId ?? '?';
          charBankrupts.set(c, (charBankrupts.get(c) ?? 0) + 1);
        }
        void pid;
      }
    } else {
      stats.targetWins++;
    }
    stats.winnerWorth.push(state.players[state.winnerId].netWorth);
    const worths = state.turnOrder.map(pid => state.players[pid].netWorth).sort((a, b) => a - b);
    stats.lastWorth.push(worths[0]);
  }
}

function pct(t: Tally) { return ((t.wins / t.games) * 100).toFixed(1).padStart(5); }
function avg(a: number[]) { return a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : 'n/a'; }

console.log(`\n=== ${GAMES_PER_BOARD} games/board · target ${TARGET}G · bankruptcy limit ${BANKRUPTCY_LIMIT} · round cap ${ROUND_CAP} ===\n`);

console.log('Personality win rates (expected 25.0%) and bankruptcy rates:');
for (const [c, t] of [...charWins.entries()].sort((a, b) => b[1].wins / b[1].games - a[1].wins / a[1].games)) {
  const br = (((charBankrupts.get(c) ?? 0) / t.games) * 100).toFixed(1).padStart(5);
  console.log(`  ${c.padEnd(11)} win ${pct(t)}%  bankrupt ${br}%  (${t.wins}/${t.games})`);
}

console.log('\nSeat win rates (expected 25.0%):');
for (const [s, t] of [...seatWins.entries()].sort()) {
  console.log(`  ${s.padEnd(11)} ${pct(t)}%  (${t.wins}/${t.games})`);
}

console.log('\nPer board:');
for (const [b, s] of Object.entries(perBoard)) {
  const n = s.rounds.length;
  console.log(`  ${b.padEnd(9)} avgRounds=${avg(s.rounds)}  targetWins=${s.targetWins}  bankruptcyEnds=${s.bankruptEnds}/${n} (${((s.bankruptEnds / Math.max(1, n)) * 100).toFixed(0)}%)  capped=${s.capped}  avgWinnerWorth=${avg(s.winnerWorth)}  avgLoserWorth=${avg(s.lastWorth)}`);
}
console.log();
