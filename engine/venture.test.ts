import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLineCompletions, resolveVentureCard } from './economy.js';
import { applyAction } from './stateMachine.js';
import { greedyBotAction } from './bot.js';
import type { GameState, Player, Node } from '../shared/types.js';

function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: `Player ${id}`,
    cash: 1000,
    netWorth: 1000,
    currentNodeId: 'bank',
    level: 1,
    suits: { heart: false, diamond: false, club: false, spade: false },
    propertyIds: [],
    isBankrupt: false,
    ...overrides,
  };
}

const defaultBoard: Record<string, Node> = {
  bank: { id: 'bank', type: 'bank', neighbors: ['venture1'], coordinates: { x: 0, y: 0 } },
  venture1: { id: 'venture1', type: 'venture', neighbors: ['bank'], coordinates: { x: 1, y: 0 } },
};

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    roomId: 'test',
    players: { p1: makePlayer('p1'), p2: makePlayer('p2') },
    turnOrder: ['p1', 'p2'],
    currentPlayerId: 'p1',
    currentPhase: 'PRE_ROLL',
    board: defaultBoard,
    properties: {},
    districts: {
      d1: { id: 'd1', name: 'D1', stockPrice: 10, propertyIds: [], playerHoldings: {} }
    },
    round: 1,
    targetNetWorth: 10000,
    winnerId: null,
    bankruptCount: 0,
    log: [],
    ventureGrid: Array.from({ length: 64 }, () => ({ cleared: false, playerId: null })),
    ventureGridCardIds: Array.from({ length: 64 }, (_, i) => i + 1),
    ...overrides,
  };
}

// ─── Test 1: checkLineCompletions ─────────────────────────────────────────────

test('checkLineCompletions calculates horizontal line payouts correctly', () => {
  const grid = Array.from({ length: 64 }, () => ({ cleared: false }));
  // Set horizontal line of length 4 (indices 0, 1, 2, 3)
  grid[0].cleared = true;
  grid[1].cleared = true;
  grid[2].cleared = true;
  grid[3].cleared = true;

  // Index 3 completes the line of length 4
  const payout = checkLineCompletions(grid, 3);
  assert.equal(payout, 40); // 40G payout for length 4
});

test('checkLineCompletions calculates diagonal line payouts correctly', () => {
  const grid = Array.from({ length: 64 }, () => ({ cleared: false }));
  // Set main diagonal line of length 5 (indices 0, 9, 18, 27, 36)
  grid[0].cleared = true;
  grid[9].cleared = true;
  grid[18].cleared = true;
  grid[27].cleared = true;
  grid[36].cleared = true;

  const payout = checkLineCompletions(grid, 27);
  assert.equal(payout, 50); // 50G payout for length 5
});

// ─── Test 2: landing on venture transitions to SPACE_ACTION and blocks END_TURN ───

test('landing on venture node transitions to SPACE_ACTION and requires card selection', () => {
  const state = makeState({
    currentPhase: 'PRE_ROLL',
    players: {
      p1: makePlayer('p1', { currentNodeId: 'bank' }),
      p2: makePlayer('p2', { currentNodeId: 'bank' }),
    }
  });

  // Force roll = 1
  const origRandom = Math.random;
  Math.random = () => 0;
  try {
    const next = applyAction(state, { type: 'ROLL_DICE' });
    assert.equal(next.players.p1.currentNodeId, 'venture1');
    assert.equal(next.currentPhase, 'SPACE_ACTION');

    // Attempting to END_TURN before choosing card must throw
    assert.throws(
      () => applyAction(next, { type: 'END_TURN' }),
      /Must choose a venture card before ending turn/
    );
  } finally {
    Math.random = origRandom;
  }
});

// ─── Test 3: CHOOSE_VENTURE_CARD resolves card effects and line payouts ────────────

test('CHOOSE_VENTURE_CARD resolves CASH_GAIN effect (Lucky Break)', () => {
  const state = makeState({
    currentPhase: 'SPACE_ACTION',
    players: {
      p1: makePlayer('p1', { currentNodeId: 'venture1', cash: 1000 }),
      p2: makePlayer('p2', { currentNodeId: 'bank' }),
    },
    // seeded card IDs: Card #1 is 'Lucky Break' (+200G)
    ventureGridCardIds: Array.from({ length: 64 }, () => 1)
  });

  const next = applyAction(state, { type: 'CHOOSE_VENTURE_CARD', cardIndex: 12 });
  assert.ok(next.activeVentureCard);
  assert.equal(next.activeVentureCard.title, 'Lucky Break');
  assert.equal(next.players.p1.cash, 1200); // 1000 + 200
  assert.ok(next.ventureGrid);
  assert.equal(next.ventureGrid[12].cleared, true);
  assert.equal(next.ventureGrid[12].playerId, 'p1');

  // Dismissing card advances turn
  const finalState = applyAction(next, { type: 'END_TURN' });
  assert.equal(finalState.activeVentureCard, null);
  assert.equal(finalState.currentPlayerId, 'p2');
  assert.equal(finalState.currentPhase, 'PRE_ROLL');
});

test('CHOOSE_VENTURE_CARD resolves ROLL_AGAIN effect (Fast Steps)', () => {
  const state = makeState({
    currentPhase: 'SPACE_ACTION',
    players: {
      p1: makePlayer('p1', { currentNodeId: 'venture1' }),
      p2: makePlayer('p2', { currentNodeId: 'bank' }),
    },
    // seeded card IDs: Card #9 is 'Fast Steps' (ROLL_AGAIN)
    ventureGridCardIds: Array.from({ length: 64 }, () => 9)
  });

  const next = applyAction(state, { type: 'CHOOSE_VENTURE_CARD', cardIndex: 15 });
  assert.ok(next.activeVentureCard);
  assert.equal(next.activeVentureCard.effectType, 'ROLL_AGAIN');

  // Dismissing card lets p1 roll again (currentPlayerId remains p1, phase returns to PRE_ROLL)
  const finalState = applyAction(next, { type: 'END_TURN' });
  assert.equal(finalState.activeVentureCard, null);
  assert.equal(finalState.currentPlayerId, 'p1');
  assert.equal(finalState.currentPhase, 'PRE_ROLL');
});

test('CHOOSE_VENTURE_CARD resolves WARP_BANK effect and END_TURN resolves space instead of advancing turn', () => {
  const state = makeState({
    currentPhase: 'SPACE_ACTION',
    players: {
      p1: makePlayer('p1', { currentNodeId: 'venture1' }),
      p2: makePlayer('p2', { currentNodeId: 'bank' }),
    },
    // seeded card IDs: Card #7 is 'Warp to Bank' (WARP_BANK)
    ventureGridCardIds: Array.from({ length: 64 }, () => 7)
  });

  const next = applyAction(state, { type: 'CHOOSE_VENTURE_CARD', cardIndex: 12 });
  assert.ok(next.activeVentureCard);
  assert.equal(next.activeVentureCard.effectType, 'WARP_BANK');
  // Check that the player is indeed warped to 'bank'
  assert.equal(next.players.p1.currentNodeId, 'bank');

  // Dismissing card keeps p1's turn and puts them in SPACE_ACTION at the bank
  const intermediateState = applyAction(next, { type: 'END_TURN' });
  assert.equal(intermediateState.activeVentureCard, null);
  assert.equal(intermediateState.currentPlayerId, 'p1');
  assert.equal(intermediateState.currentPhase, 'SPACE_ACTION');

  // Second END_TURN advances the turn to p2 at phase PRE_ROLL
  const finalState = applyAction(intermediateState, { type: 'END_TURN' });
  assert.equal(finalState.currentPlayerId, 'p2');
  assert.equal(finalState.currentPhase, 'PRE_ROLL');
});

test('CHOOSE_VENTURE_CARD resolves WARP_VACANT effect and END_TURN resolves space instead of advancing turn', () => {
  const board: Record<string, Node> = {
    bank: { id: 'bank', type: 'bank', neighbors: ['venture1', 'prop1'], coordinates: { x: 0, y: 0 } },
    venture1: { id: 'venture1', type: 'venture', neighbors: ['bank'], coordinates: { x: 1, y: 0 } },
    prop1: { id: 'prop1', type: 'property', neighbors: ['bank'], coordinates: { x: 2, y: 0 } },
  };

  const prop = {
    id: 'prop1', nodeId: 'prop1', districtId: 'd1', ownerId: null,
    basePrice: 100, currentPrice: 100, baseRent: 20, currentRent: 20,
    capitalInvested: 0, maxCapital: 300, shopMultiplier: 1,
  };

  const state = makeState({
    currentPhase: 'SPACE_ACTION',
    players: {
      p1: makePlayer('p1', { currentNodeId: 'venture1' }),
      p2: makePlayer('p2', { currentNodeId: 'bank' }),
    },
    board,
    properties: { prop1: prop },
    // Seeded card IDs: Card #8 is 'Warp to Vacant' (WARP_VACANT)
    ventureGridCardIds: Array.from({ length: 64 }, () => 8)
  });

  const next = applyAction(state, { type: 'CHOOSE_VENTURE_CARD', cardIndex: 12 });
  assert.ok(next.activeVentureCard);
  assert.equal(next.activeVentureCard.effectType, 'WARP_VACANT');
  // Check that the player is indeed warped to 'prop1'
  assert.equal(next.players.p1.currentNodeId, 'prop1');

  // Dismissing card keeps p1's turn and puts them in SPACE_ACTION at prop1
  const intermediateState = applyAction(next, { type: 'END_TURN' });
  assert.equal(intermediateState.activeVentureCard, null);
  assert.equal(intermediateState.currentPlayerId, 'p1');
  assert.equal(intermediateState.currentPhase, 'SPACE_ACTION');

  // p1 can buy the property now!
  const finalState = applyAction(intermediateState, { type: 'BUY_PROPERTY', propertyId: 'prop1' });
  assert.equal(finalState.properties.prop1.ownerId, 'p1');
  assert.equal(finalState.currentPlayerId, 'p2');
  assert.equal(finalState.currentPhase, 'PRE_ROLL');
});



// ─── Test 4: Bot greedy heuristic choice ─────────────────────────────────────

test('greedyBotAction makes an intelligent adjacent choice in venture grid', () => {
  const state = makeState({
    currentPhase: 'SPACE_ACTION',
    players: {
      p1: makePlayer('p1', { currentNodeId: 'venture1' }),
      p2: makePlayer('p2', { currentNodeId: 'bank' }),
    }
  });

  // Pre-clear index 0
  assert.ok(state.ventureGrid);
  state.ventureGrid[0].cleared = true;
  state.ventureGrid[0].playerId = 'p2';

  const action = greedyBotAction(state, 'p1');
  assert.equal(action.type, 'CHOOSE_VENTURE_CARD');
  
  // Heuristic should choose an uncleared card that has the highest number of cleared neighbors.
  // Index 1, 8, 9 are direct neighbors of 0. Heuristic should prefer one of these!
  const chosenIndex = (action as { cardIndex: number }).cardIndex;
  assert.ok([1, 8, 9].includes(chosenIndex), `Bot should choose adjacent neighbor of cleared index 0, got ${chosenIndex}`);
});

test('greedyBotAction returns END_TURN when activeVentureCard is set, even if bot was warped to bank', () => {
  const state = makeState({
    currentPhase: 'SPACE_ACTION',
    currentPlayerId: 'bot1',
    players: {
      bot1: makePlayer('bot1', { currentNodeId: 'bank', cash: 1000 }),
    },
    activeVentureCard: {
      number: 7,
      title: 'Warp to Bank',
      text: 'Teleport to the Bank!',
      effectType: 'WARP_BANK',
      payout: 0,
    }
  });

  const action = greedyBotAction(state, 'bot1');
  assert.equal(action.type, 'END_TURN');
});

