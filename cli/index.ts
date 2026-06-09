import { applyAction } from '../engine/stateMachine.js';
import { greedyBotAction } from '../engine/bot.js';
import type { GameState, Node, Property, District, Player } from '../shared/types.js';

// ─── Board definition ─────────────────────────────────────────────────────────
//
//  bank → heart → d1s1 → d1s2 → diamond → stockbroker → d2s1 → d2s2
//   ↑                                                              ↓
//  club ← d1s4 ← d1s3 ← spade ←────────────────── d2s4 ← d2s3 ──┘
//
// Branch at stockbroker: one path continues straight to d2s1, another goes to
// a branch node that rejoins. We model the branch by giving stockbroker two
// outgoing neighbors: d2s1 and branchA; branchA → branchB → d2s2 (both loop
// back to bank eventually). To keep it simple the "branch" is:
//   stockbroker → [d2s1, branch] where branch → d2s2

const board: Record<string, Node> = {
  bank:        { id: 'bank',        type: 'bank',        neighbors: ['heart'],     coordinates: { x: 0,  y: 0  } },
  heart:       { id: 'heart',       type: 'suit',        suit: 'heart',   neighbors: ['d1s1'],     coordinates: { x: 1,  y: 0  } },
  d1s1:        { id: 'd1s1',        type: 'property',    neighbors: ['d1s2'],     coordinates: { x: 2,  y: 0  } },
  d1s2:        { id: 'd1s2',        type: 'property',    neighbors: ['diamond'],  coordinates: { x: 3,  y: 0  } },
  diamond:     { id: 'diamond',     type: 'suit',        suit: 'diamond', neighbors: ['stockbroker'], coordinates: { x: 4, y: 0  } },
  stockbroker: { id: 'stockbroker', type: 'stockbroker', neighbors: ['d2s1', 'branch'], coordinates: { x: 5, y: 0 } },
  branch:      { id: 'branch',      type: 'vacant',      neighbors: ['d2s2'],     coordinates: { x: 5,  y: 1  } },
  d2s1:        { id: 'd2s1',        type: 'property',    neighbors: ['d2s2'],     coordinates: { x: 6,  y: 0  } },
  d2s2:        { id: 'd2s2',        type: 'property',    neighbors: ['d2s3'],     coordinates: { x: 7,  y: 0  } },
  d2s3:        { id: 'd2s3',        type: 'property',    neighbors: ['d2s4'],     coordinates: { x: 7,  y: 1  } },
  d2s4:        { id: 'd2s4',        type: 'property',    neighbors: ['spade'],    coordinates: { x: 6,  y: 1  } },
  spade:       { id: 'spade',       type: 'suit',        suit: 'spade',   neighbors: ['d1s3'],     coordinates: { x: 4,  y: 1  } },
  d1s3:        { id: 'd1s3',        type: 'property',    neighbors: ['d1s4'],     coordinates: { x: 3,  y: 1  } },
  d1s4:        { id: 'd1s4',        type: 'property',    neighbors: ['club'],     coordinates: { x: 2,  y: 1  } },
  club:        { id: 'club',        type: 'suit',        suit: 'club',    neighbors: ['bank'],     coordinates: { x: 1,  y: 1  } },
};

const properties: Record<string, Property> = {
  d1s1: { id: 'd1s1', nodeId: 'd1s1', districtId: 'd1', ownerId: null, basePrice: 100, currentPrice: 100, baseRent: 8,  currentRent: 8,  capitalInvested: 0, maxCapital: 200, shopMultiplier: 1 },
  d1s2: { id: 'd1s2', nodeId: 'd1s2', districtId: 'd1', ownerId: null, basePrice: 120, currentPrice: 120, baseRent: 10, currentRent: 10, capitalInvested: 0, maxCapital: 240, shopMultiplier: 1 },
  d1s3: { id: 'd1s3', nodeId: 'd1s3', districtId: 'd1', ownerId: null, basePrice: 140, currentPrice: 140, baseRent: 12, currentRent: 12, capitalInvested: 0, maxCapital: 280, shopMultiplier: 1 },
  d1s4: { id: 'd1s4', nodeId: 'd1s4', districtId: 'd1', ownerId: null, basePrice: 160, currentPrice: 160, baseRent: 14, currentRent: 14, capitalInvested: 0, maxCapital: 320, shopMultiplier: 1 },
  d2s1: { id: 'd2s1', nodeId: 'd2s1', districtId: 'd2', ownerId: null, basePrice: 200, currentPrice: 200, baseRent: 18, currentRent: 18, capitalInvested: 0, maxCapital: 400, shopMultiplier: 1 },
  d2s2: { id: 'd2s2', nodeId: 'd2s2', districtId: 'd2', ownerId: null, basePrice: 220, currentPrice: 220, baseRent: 20, currentRent: 20, capitalInvested: 0, maxCapital: 440, shopMultiplier: 1 },
  d2s3: { id: 'd2s3', nodeId: 'd2s3', districtId: 'd2', ownerId: null, basePrice: 240, currentPrice: 240, baseRent: 22, currentRent: 22, capitalInvested: 0, maxCapital: 480, shopMultiplier: 1 },
  d2s4: { id: 'd2s4', nodeId: 'd2s4', districtId: 'd2', ownerId: null, basePrice: 260, currentPrice: 260, baseRent: 24, currentRent: 24, capitalInvested: 0, maxCapital: 520, shopMultiplier: 1 },
};

const districts: Record<string, District> = {
  d1: { id: 'd1', name: 'Uptown',   stockPrice: 5,  propertyIds: ['d1s1','d1s2','d1s3','d1s4'], playerHoldings: {} },
  d2: { id: 'd2', name: 'Downtown', stockPrice: 9,  propertyIds: ['d2s1','d2s2','d2s3','d2s4'], playerHoldings: {} },
};

function makePlayer(id: string, name: string): Player {
  return {
    id, name,
    cash: 1000,
    netWorth: 1000,
    currentNodeId: 'bank',
    level: 1,
    suits: { heart: false, diamond: false, club: false, spade: false },
    propertyIds: [],
    isBankrupt: false,
  };
}

let state: GameState = {
  roomId: 'cli',
  players: {
    alice: makePlayer('alice', 'Alice'),
    bob:   makePlayer('bob',   'Bob'),
  },
  turnOrder: ['alice', 'bob'],
  currentPlayerId: 'alice',
  currentPhase: 'PRE_ROLL',
  board,
  properties,
  districts,
  round: 1,
  targetNetWorth: 1800,
  winnerId: null,
  bankruptCount: 0,
  log: [],
  ventureGrid: Array.from({ length: 64 }, () => ({ cleared: false, playerId: null })),
  ventureGridCardIds: Array.from({ length: 64 }, (_, i) => i + 1).sort(() => Math.random() - 0.5),
  activeVentureCard: null,
};

// ─── Run loop ─────────────────────────────────────────────────────────────────

function suitStr(p: Player) {
  return `H${p.suits.heart?'✓':'·'} D${p.suits.diamond?'✓':'·'} S${p.suits.spade?'✓':'·'} C${p.suits.club?'✓':'·'}`;
}

function printNetWorths(s: GameState) {
  for (const pid of s.turnOrder) {
    const p = s.players[pid];
    const active = pid === s.currentPlayerId ? '▶' : ' ';
    console.log(`  ${active} ${p.name}: ${p.netWorth}g (cash ${p.cash}g) @ ${p.currentNodeId} [${suitStr(p)}]`);
  }
}

function actionLabel(action: ReturnType<typeof greedyBotAction>): string {
  switch (action.type) {
    case 'SELL_STOCK':    return `SELL_STOCK ${action.shares}sh in ${action.districtId}`;
    case 'ROLL_DICE':     return 'ROLL_DICE';
    case 'CHOOSE_PATH':   return `CHOOSE_PATH → ${action.nodeId}`;
    case 'BUY_PROPERTY':  return `BUY_PROPERTY ${action.propertyId}`;
    case 'INVEST':        return `INVEST ${action.amount}g in ${action.propertyId}`;
    case 'PAY_RENT':      return `PAY_RENT ${action.propertyId}`;
    case 'BUY_STOCK':     return `BUY_STOCK ${action.shares}sh in ${action.districtId}`;
    case 'COLLECT_SALARY':return 'COLLECT_SALARY';
    case 'BUYOUT_PROPERTY':return `BUYOUT_PROPERTY ${action.propertyId}`;
    case 'CHOOSE_VENTURE_CARD': return `CHOOSE_VENTURE_CARD cardIndex ${action.cardIndex}`;
    case 'BUILD_PLOT':    return `BUILD_PLOT ${action.buildingType} on ${action.propertyId}`;
    case 'RENOVATE_PLOT': return `RENOVATE_PLOT ${action.buildingType} on ${action.propertyId}`;
    case 'TELEPORT':      return `TELEPORT to ${action.nodeId}`;
    case 'END_TURN':      return 'END_TURN';
  }
}

const MAX_ROUNDS = 20;
const MAX_ACTIONS = 10_000; // safety against infinite loops
let actionCount = 0;
let lastRound = 0;
let logLength = 0;

while (!state.winnerId && state.round <= MAX_ROUNDS && actionCount < MAX_ACTIONS) {
  if (state.round !== lastRound) {
    lastRound = state.round;
    console.log(`\n═══ Round ${state.round} ═══`);
  }

  const pid = state.currentPlayerId;
  const player = state.players[pid];
  const phase = state.currentPhase;

  // Log bank visits before the bot acts.
  if (phase === 'SPACE_ACTION' && state.board[player.currentNodeId]?.type === 'bank') {
    console.log(`  [BANK] ${player.name} @ bank | suits: ${suitStr(player)} | cash: ${player.cash}g`);
  }

  let action: ReturnType<typeof greedyBotAction>;
  try {
    action = greedyBotAction(state, pid);
  } catch (err) {
    console.error(`Bot error (${player.name}, ${phase}):`, err);
    process.exit(1);
  }

  const prevRound = state.round;
  const prevPlayerId = pid;

  try {
    state = applyAction(state, action);
  } catch (err) {
    console.error(`[Round ${state.round} | ${phase}] ${player.name} → ${actionLabel(action)}`);
    console.error(`ERROR: ${(err as Error).message}`);
    process.exit(1);
  }

  console.log(`[Round ${prevRound} | ${phase}] ${player.name} → ${actionLabel(action)}`);

  // Print any new state.log entries (suit collections, etc.).
  if (state.log.length > logLength) {
    for (const entry of state.log.slice(logLength)) {
      console.log(`  [✦] ${entry}`);
    }
    logLength = state.log.length;
  }

  // Print net worths after each player's turn completes (when the next player starts PRE_ROLL).
  if (state.currentPlayerId !== prevPlayerId && state.currentPhase === 'PRE_ROLL') {
    printNetWorths(state);
  }

  actionCount++;
}

console.log('\n─── Game Over ───');
if (state.winnerId) {
  const winner = state.players[state.winnerId];
  console.log(`Winner: ${winner.name} with net worth ${winner.netWorth}g`);
} else {
  console.log(`No winner after ${MAX_ROUNDS} rounds.`);
}
console.log('\nFinal standings:');
const sorted = Object.values(state.players).sort((a, b) => b.netWorth - a.netWorth);
for (const p of sorted) {
  console.log(`  ${p.name}: ${p.netWorth}g`);
}
