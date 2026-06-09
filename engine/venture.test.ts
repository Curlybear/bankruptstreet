import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLineCompletions, resolveVentureCard, VENTURE_CARDS_LIST, seedVentureGridCardIds } from './economy.js';
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


// ─── Expanded card pool (cards 25-64, original-game alignment) ────────────────

test('venture card pool exceeds grid size; seeding picks 64 distinct valid cards', () => {
  assert.ok(VENTURE_CARDS_LIST.length >= 64, `pool has ${VENTURE_CARDS_LIST.length} cards, need >= 64`);

  const seeded = seedVentureGridCardIds();
  assert.equal(seeded.length, 64);
  assert.equal(new Set(seeded).size, 64, 'seeded card numbers must be distinct');
  for (const n of seeded) {
    assert.ok(n >= 1 && n <= VENTURE_CARDS_LIST.length, `card number ${n} out of pool range`);
  }
});

test('CASH_FROM_EACH_PLAYER: every opponent pays the player', () => {
  const state = makeState({
    currentPhase: 'SPACE_ACTION',
    players: {
      p1: makePlayer('p1', { currentNodeId: 'venture1', cash: 1000 }),
      p2: makePlayer('p2', { cash: 1000 }),
    },
    // Card #31 is Birthday Celebration (CASH_FROM_EACH_PLAYER, 30G)
    ventureGridCardIds: Array.from({ length: 64 }, () => 31)
  });

  const next = applyAction(state, { type: 'CHOOSE_VENTURE_CARD', cardIndex: 0 });
  assert.equal(next.activeVentureCard?.effectType, 'CASH_FROM_EACH_PLAYER');
  assert.equal(next.players.p1.cash, 1030);
  assert.equal(next.players.p2.cash, 970);
});

test('STOCK_TAX_10: pays 10% of stock value', () => {
  const state = makeState({
    currentPhase: 'SPACE_ACTION',
    players: {
      p1: makePlayer('p1', { currentNodeId: 'venture1', cash: 1000 }),
      p2: makePlayer('p2'),
    },
    districts: {
      d1: { id: 'd1', name: 'D1', stockPrice: 10, propertyIds: [], playerHoldings: { p1: 50 } }
    },
    // Card #33 is Capital Gains Levy (STOCK_TAX_10)
    ventureGridCardIds: Array.from({ length: 64 }, () => 33)
  });

  const next = applyAction(state, { type: 'CHOOSE_VENTURE_CARD', cardIndex: 0 });
  // stock value 50×10=500, tax = 50
  assert.equal(next.players.p1.cash, 950);
});

test('CASH_GAIN_PER_LEVEL: payout scales with player level', () => {
  const state = makeState({
    currentPhase: 'SPACE_ACTION',
    players: {
      p1: makePlayer('p1', { currentNodeId: 'venture1', cash: 1000, level: 3 }),
      p2: makePlayer('p2'),
    },
    // Card #29 is Seniority Bonus (40G × level)
    ventureGridCardIds: Array.from({ length: 64 }, () => 29)
  });

  const next = applyAction(state, { type: 'CHOOSE_VENTURE_CARD', cardIndex: 0 });
  assert.equal(next.players.p1.cash, 1120);  // 1000 + 40×3
});

test('DOUBLE_RENT_TEMP: opponents pay doubled rent until next turn, flag resets on turn start', () => {
  const board: Record<string, Node> = {
    bank: { id: 'bank', type: 'bank', neighbors: ['shop1'], coordinates: { x: 0, y: 0 } },
    shop1: { id: 'shop1', type: 'property', neighbors: ['bank'], coordinates: { x: 1, y: 0 } },
  };
  const state = makeState({
    board,
    currentPhase: 'SPACE_ACTION',
    currentPlayerId: 'p2',
    players: {
      p1: makePlayer('p1', { propertyIds: ['shop1'], shopRentsDoubledUntilNextTurn: true }),
      p2: makePlayer('p2', { currentNodeId: 'shop1', cash: 1000 }),
    },
    properties: {
      shop1: {
        id: 'shop1', nodeId: 'shop1', districtId: 'd1', ownerId: 'p1',
        basePrice: 100, currentPrice: 100, baseRent: 20, currentRent: 20,
        capitalInvested: 0, maxCapital: 300, shopMultiplier: 1,
      },
    },
  });

  const next = applyAction(state, { type: 'PAY_RENT', propertyId: 'shop1' });
  assert.equal(next.players.p2.cash, 1000 - 40);   // 20 × 2
  assert.equal(next.players.p1.cash, 1000 + 40);
  // turn advanced to p1 — doubled flag must be cleared for their new turn
  assert.equal(next.currentPlayerId, 'p1');
  assert.equal(next.players.p1.shopRentsDoubledUntilNextTurn, false);
});

test('FREE_CAPITAL: invests free capital into highest-value shop with headroom', () => {
  const state = makeState({
    currentPhase: 'SPACE_ACTION',
    players: {
      p1: makePlayer('p1', { currentNodeId: 'venture1', cash: 1000, propertyIds: ['shopA', 'shopB'] }),
      p2: makePlayer('p2'),
    },
    properties: {
      shopA: {
        id: 'shopA', nodeId: 'shopA', districtId: 'd1', ownerId: 'p1',
        basePrice: 100, currentPrice: 100, baseRent: 10, currentRent: 10,
        capitalInvested: 0, maxCapital: 200, shopMultiplier: 1,
      },
      shopB: {
        id: 'shopB', nodeId: 'shopB', districtId: 'd1', ownerId: 'p1',
        basePrice: 300, currentPrice: 300, baseRent: 30, currentRent: 30,
        capitalInvested: 0, maxCapital: 600, shopMultiplier: 1,
      },
    },
    districts: {
      d1: { id: 'd1', name: 'D1', stockPrice: 10, propertyIds: ['shopA', 'shopB'], playerHoldings: {} }
    },
    // Card #34 is Free Renovation (FREE_CAPITAL 100G)
    ventureGridCardIds: Array.from({ length: 64 }, () => 34)
  });

  const next = applyAction(state, { type: 'CHOOSE_VENTURE_CARD', cardIndex: 0 });
  // shopB is highest value → gets the capital; player cash unchanged (free)
  assert.equal(next.properties.shopB.capitalInvested, 100);
  assert.equal(next.players.p1.cash, 1000);
  assert.equal(next.properties.shopA.capitalInvested, 0);
});

test('WARP_BROKER: warps player to nearest stockbroker and space resolves there', () => {
  const board: Record<string, Node> = {
    bank: { id: 'bank', type: 'bank', neighbors: ['venture1', 'broker'], coordinates: { x: 0, y: 0 } },
    venture1: { id: 'venture1', type: 'venture', neighbors: ['bank'], coordinates: { x: 1, y: 0 } },
    broker: { id: 'broker', type: 'stockbroker', neighbors: ['bank'], coordinates: { x: 2, y: 0 } },
  };
  const state = makeState({
    board,
    currentPhase: 'SPACE_ACTION',
    players: {
      p1: makePlayer('p1', { currentNodeId: 'venture1' }),
      p2: makePlayer('p2'),
    },
    // Card #36 is Express Carriage (WARP_BROKER)
    ventureGridCardIds: Array.from({ length: 64 }, () => 36)
  });

  const next = applyAction(state, { type: 'CHOOSE_VENTURE_CARD', cardIndex: 0 });
  assert.equal(next.players.p1.currentNodeId, 'broker');

  // Dismiss card → space resolves at broker (SPACE_ACTION, can buy stock)
  const after = applyAction(next, { type: 'END_TURN' });
  assert.equal(after.currentPlayerId, 'p1');
  assert.equal(after.currentPhase, 'SPACE_ACTION');
});

test('ALL_SHOPS_PRICE_UP: boosts base value of all owned standard shops by 10%', () => {
  const state = makeState({
    currentPhase: 'SPACE_ACTION',
    players: {
      p1: makePlayer('p1', { currentNodeId: 'venture1', propertyIds: ['shopA'] }),
      p2: makePlayer('p2'),
    },
    properties: {
      shopA: {
        id: 'shopA', nodeId: 'shopA', districtId: 'd1', ownerId: 'p1',
        basePrice: 200, currentPrice: 200, baseRent: 20, currentRent: 20,
        capitalInvested: 0, maxCapital: 400, shopMultiplier: 1,
      },
      // Second unowned shop so p1 doesn't dominate the district (multiplier stays 1)
      shopB: {
        id: 'shopB', nodeId: 'shopB', districtId: 'd1', ownerId: null,
        basePrice: 200, currentPrice: 200, baseRent: 20, currentRent: 20,
        capitalInvested: 0, maxCapital: 400, shopMultiplier: 1,
      },
    },
    districts: {
      d1: { id: 'd1', name: 'D1', stockPrice: 8, propertyIds: ['shopA', 'shopB'], playerHoldings: {} }
    },
    // Card #35 is Property Boom (ALL_SHOPS_PRICE_UP)
    ventureGridCardIds: Array.from({ length: 64 }, () => 35)
  });

  const next = applyAction(state, { type: 'CHOOSE_VENTURE_CARD', cardIndex: 0 });
  assert.equal(next.properties.shopA.basePrice, 220);   // 200 × 1.10
  assert.equal(next.properties.shopA.currentPrice, 220);
  assert.equal(next.properties.shopB.basePrice, 200);   // unowned shop untouched
  assert.equal(next.districts.d1.stockPrice, 8);        // floor(avg(220,200) × 0.04) = 8
});
