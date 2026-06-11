import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from './stateMachine.js';
import type { GameState, Player, Property, District, Node } from '../shared/types.js';

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
  bank: { id: 'bank', type: 'bank', neighbors: ['prop1'], coordinates: { x: 0, y: 0 } },
  prop1: { id: 'prop1', type: 'property', neighbors: ['bank'], coordinates: { x: 1, y: 0 } },
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
    districts: {},
    round: 1,
    targetNetWorth: 10000,
    winnerId: null,
    bankruptCount: 0,
    log: [],
    ...overrides,
  };
}

// ─── Test 1: legal action returns new state object ───────────────────────────

test('legal action succeeds and returns new state object', () => {
  const district: District = {
    id: 'd1', name: 'D1', stockPrice: 50, propertyIds: [],
    playerHoldings: { p1: 5 },
  };
  const state = makeState({ districts: { d1: district } });

  const next = applyAction(state, { type: 'SELL_STOCK', districtId: 'd1', shares: 5 });

  assert.notStrictEqual(next, state);
  assert.equal(next.players.p1.cash, 1250);           // 1000 + 5×50
  assert.equal(next.districts.d1.playerHoldings.p1, 0);
  assert.equal(next.currentPhase, 'PRE_ROLL');         // phase unchanged
});

// ─── Test 2: illegal action throws naming phase + action type ─────────────────

test('illegal action throws with message naming phase and action type', () => {
  const state = makeState({ currentPhase: 'CHOOSING_PATH' });

  assert.throws(
    () => applyAction(state, { type: 'ROLL_DICE' }),
    (err: Error) => {
      assert.ok(err.message.includes('ROLL_DICE'),      'message must name action type');
      assert.ok(err.message.includes('CHOOSING_PATH'),  'message must name current phase');
      return true;
    },
  );
});

// ─── Test 3: END_TURN illegal on opponent shop ────────────────────────────────

test('END_TURN throws when on opponent shop in SPACE_ACTION', () => {
  const prop: Property = {
    id: 'prop1', nodeId: 'prop1', districtId: 'd1', ownerId: 'p2',
    basePrice: 100, currentPrice: 100, baseRent: 20, currentRent: 20,
    capitalInvested: 0, maxCapital: 300, shopMultiplier: 1,
  };
  const state = makeState({
    currentPhase: 'SPACE_ACTION',
    players: {
      p1: makePlayer('p1', { currentNodeId: 'prop1' }),   // on p2's shop
      p2: makePlayer('p2', { propertyIds: ['prop1'] }),
    },
    properties: { prop1: prop },
  });

  assert.throws(
    () => applyAction(state, { type: 'END_TURN' }),
    /END_TURN/,
  );
});

// ─── Test 4: SELL_STOCK callable multiple times in PRE_ROLL ───────────────────

test('SELL_STOCK callable multiple times in PRE_ROLL before ROLL_DICE', () => {
  const district: District = {
    id: 'd1', name: 'D1', stockPrice: 40, propertyIds: [],
    playerHoldings: { p1: 20 },
  };
  let state = makeState({ districts: { d1: district } });

  state = applyAction(state, { type: 'SELL_STOCK', districtId: 'd1', shares: 5 });
  assert.equal(state.currentPhase, 'PRE_ROLL');
  assert.equal(state.players.p1.cash, 1200);   // +5×40

  state = applyAction(state, { type: 'SELL_STOCK', districtId: 'd1', shares: 5 });
  assert.equal(state.currentPhase, 'PRE_ROLL');
  assert.equal(state.players.p1.cash, 1400);   // +10×40 total

  assert.equal(state.currentPlayerId, 'p1');   // still p1's turn
});

// ─── Test 5: TURN_END wraps last player → first, increments round ─────────────

test('TURN_END wraps from last player to first and increments round', () => {
  const state = makeState({
    currentPhase: 'SPACE_ACTION',
    currentPlayerId: 'p2',
    players: {
      p1: makePlayer('p1'),
      p2: makePlayer('p2', { currentNodeId: 'bank' }),  // at bank, END_TURN is legal
    },
    round: 3,
  });

  const next = applyAction(state, { type: 'END_TURN' });

  assert.equal(next.currentPlayerId, 'p1');
  assert.equal(next.round, 4);
  assert.equal(next.currentPhase, 'PRE_ROLL');
});

// ─── Test 6: suit node auto-collects and transitions to SPACE_ACTION for venture card ─

test('suit node auto-collects suit and transitions to SPACE_ACTION for venture card', () => {
  // Board: start(bank) → suitNode(heart suit) → start
  // Roll 1 lands on suitNode; auto-collected, transitions to SPACE_ACTION to select a venture card.
  const board: Record<string, Node> = {
    start: { id: 'start', type: 'bank', neighbors: ['suitNode'], coordinates: { x: 0, y: 0 } },
    suitNode: { id: 'suitNode', type: 'suit', suit: 'heart', neighbors: ['start'], coordinates: { x: 1, y: 0 } },
  };
  const state = makeState({
    board,
    currentPhase: 'PRE_ROLL',
    players: {
      p1: makePlayer('p1', { currentNodeId: 'start' }),
      p2: makePlayer('p2', { currentNodeId: 'start' }),
    },
  });

  // Force roll = 1 (Math.floor(0 * 6) + 1)
  const origRandom = Math.random;
  Math.random = () => 0;
  try {
    const next = applyAction(state, { type: 'ROLL_DICE' });

    assert.equal(next.players.p1.suits.heart, true);   // suit collected
    assert.equal(next.currentPhase, 'SPACE_ACTION');    // transitioned to SPACE_ACTION
    assert.equal(next.currentPlayerId, 'p1');           // still p1's turn
  } finally {
    Math.random = origRandom;
  }
});

// ─── Test 7: BUYOUT_PROPERTY action in state machine ──────────────────────────

test('stateMachine: BUYOUT_PROPERTY works in SPACE_ACTION on opponent shop and advances turn', () => {
  const prop: Property = {
    id: 'prop1', nodeId: 'prop1', districtId: 'd1', ownerId: 'p2',
    basePrice: 100, currentPrice: 100, baseRent: 20, currentRent: 20,
    capitalInvested: 0, maxCapital: 300, shopMultiplier: 1,
  };
  const district: District = {
    id: 'd1', name: 'D1', stockPrice: 40, propertyIds: ['prop1'], playerHoldings: {},
  };
  const state = makeState({
    currentPhase: 'SPACE_ACTION',
    players: {
      p1: makePlayer('p1', { cash: 1000, currentNodeId: 'prop1', propertyIds: [] }),
      p2: makePlayer('p2', { cash: 1000, currentNodeId: 'bank', propertyIds: ['prop1'] }),
    },
    properties: { prop1: prop },
    districts: { d1: district },
  });

  const next = applyAction(state, { type: 'BUYOUT_PROPERTY', propertyId: 'prop1' });

  assert.equal(next.properties.prop1.ownerId, 'p1');
  assert.equal(next.players.p1.cash, 500);
  assert.equal(next.players.p2.cash, 1300);
  assert.equal(next.currentPlayerId, 'p2');
  assert.equal(next.currentPhase, 'PRE_ROLL');
});

// ─── Test 8: suit node: passing over a suit space collects it ─────────────────

test('suit node: passing over a suit space collects it', () => {
  // Board: start(bank) → suitNode(heart suit) → endNode(vacant)
  // Roll 2 moves from start to endNode, passing over suitNode.
  // The heart suit should be collected.
  const board: Record<string, Node> = {
    start: { id: 'start', type: 'bank', neighbors: ['suitNode'], coordinates: { x: 0, y: 0 } },
    suitNode: { id: 'suitNode', type: 'suit', suit: 'heart', neighbors: ['endNode'], coordinates: { x: 1, y: 0 } },
    endNode: { id: 'endNode', type: 'vacant', neighbors: ['start'], coordinates: { x: 2, y: 0 } },
  };
  const state = makeState({
    board,
    currentPhase: 'PRE_ROLL',
    players: {
      p1: makePlayer('p1', { currentNodeId: 'start' }),
      p2: makePlayer('p2', { currentNodeId: 'start' }),
    },
  });

  // Force roll = 2 (Math.floor(0.25 * 6) + 1 = 2)
  const origRandom = Math.random;
  Math.random = () => 0.25;
  try {
    const next = applyAction(state, { type: 'ROLL_DICE' });

    assert.equal(next.players.p1.suits.heart, true);   // suit collected
    assert.equal(next.players.p1.currentNodeId, 'endNode');
    assert.equal(next.currentPhase, 'PRE_ROLL');        // vacant node auto-advances turn to p2
    assert.equal(next.currentPlayerId, 'p2');
  } finally {
    Math.random = origRandom;
  }
});

// ─── Test 9: suit node: landing on suit space requires venture card selection ─

test('suit node: landing on suit space requires venture card selection and fails END_TURN', () => {
  const board: Record<string, Node> = {
    start: { id: 'start', type: 'bank', neighbors: ['suitNode'], coordinates: { x: 0, y: 0 } },
    suitNode: { id: 'suitNode', type: 'suit', suit: 'heart', neighbors: ['start'], coordinates: { x: 1, y: 0 } },
  };
  const state = makeState({
    board,
    currentPhase: 'SPACE_ACTION',
    players: {
      p1: makePlayer('p1', { currentNodeId: 'suitNode' }),
      p2: makePlayer('p2', { currentNodeId: 'start' }),
    },
    ventureGrid: Array.from({ length: 64 }, () => ({ cleared: false, playerId: null })),
    ventureGridCardIds: Array.from({ length: 64 }, (_, i) => i + 1),
  });

  // Try to END_TURN without selecting a card
  assert.throws(() => {
    applyAction(state, { type: 'END_TURN' });
  }, /Must choose a venture card before ending turn/);

  const next = applyAction(state, { type: 'CHOOSE_VENTURE_CARD', cardIndex: 5 });
  assert.ok(next.ventureGrid);
  assert.equal(next.ventureGrid?.[5]?.cleared, true);
  assert.equal(next.ventureGrid?.[5]?.playerId, 'p1');
  assert.ok(next.activeVentureCard);
});


// ─── Post-bank stock window ────────────────────────────────────────────────────

function makeWindowState(overrides: Partial<GameState> = {}): GameState {
  const prop: Property = {
    id: 'prop1', nodeId: 'prop1', districtId: 'd1', ownerId: null,
    basePrice: 100, currentPrice: 100, baseRent: 20, currentRent: 20,
    capitalInvested: 0, maxCapital: 300, shopMultiplier: 1,
  };
  const district: District = {
    id: 'd1', name: 'D1', stockPrice: 10, propertyIds: ['prop1'], playerHoldings: {},
  };
  return makeState({
    currentPhase: 'SPACE_ACTION',
    passedBankThisTurn: true,
    players: {
      p1: makePlayer('p1', { currentNodeId: 'prop1' }),
      p2: makePlayer('p2'),
    },
    properties: { prop1: prop },
    districts: { d1: district },
    ...overrides,
  });
}

test('passing bank grants exactly one bonus SPACE_ACTION window, then END_TURN advances turn', () => {
  const state = makeWindowState();

  // Declined to buy the shop, END_TURN opens the stock window once
  const s1 = applyAction(state, { type: 'END_TURN' });
  assert.equal(s1.currentPhase, 'SPACE_ACTION');
  assert.equal(s1.currentPlayerId, 'p1');
  assert.equal(s1.passedBankWindowUsed, true);

  // Second END_TURN must actually end the turn (no infinite window)
  const s2 = applyAction(s1, { type: 'END_TURN' });
  assert.equal(s2.currentPhase, 'PRE_ROLL');
  assert.equal(s2.currentPlayerId, 'p2');
  assert.equal(s2.passedBankWindowUsed, false);
});

test('BUY_STOCK is legal in the stock window away from bank; turn ends on END_TURN', () => {
  const state = makeWindowState({ passedBankWindowUsed: true });

  const next = applyAction(state, { type: 'BUY_STOCK', districtId: 'd1', shares: 5 });
  assert.equal(next.districts.d1.playerHoldings.p1, 5);
  assert.equal(next.players.p1.cash, 1000 - 50);
  assert.equal(next.currentPlayerId, 'p1');           // player may keep trading…
  assert.equal(next.currentPhase, 'SPACE_ACTION');

  const more = applyAction(next, { type: 'BUY_STOCK', districtId: 'd1', shares: 5 });
  assert.equal(more.districts.d1.playerHoldings.p1, 10);

  const done = applyAction(more, { type: 'END_TURN' }); // …and finishes explicitly
  assert.equal(done.currentPlayerId, 'p2');
});

test('space actions other than BUY_STOCK/END_TURN are illegal in the stock window', () => {
  const state = makeWindowState({ passedBankWindowUsed: true });

  assert.throws(
    () => applyAction(state, { type: 'BUY_PROPERTY', propertyId: 'prop1' }),
    /stock window/,
  );
  assert.throws(
    () => applyAction(state, { type: 'PAY_RENT', propertyId: 'prop1' }),
    /stock window/,
  );
});

test('END_TURN is legal on an opponent shop during the stock window (rent already paid)', () => {
  const base = makeWindowState({ passedBankWindowUsed: true });
  const state: GameState = {
    ...base,
    properties: { prop1: { ...base.properties.prop1, ownerId: 'p2' } },
    players: { ...base.players, p2: makePlayer('p2', { propertyIds: ['prop1'] }) },
  };

  const next = applyAction(state, { type: 'END_TURN' });
  assert.equal(next.currentPlayerId, 'p2');
  assert.equal(next.currentPhase, 'PRE_ROLL');
});

test('no bonus window when standing on a bank node (already had the stock chance)', () => {
  const state = makeState({
    currentPhase: 'SPACE_ACTION',
    passedBankThisTurn: true,
    players: { p1: makePlayer('p1'), p2: makePlayer('p2') },  // p1 at bank
  });

  const next = applyAction(state, { type: 'END_TURN' });
  assert.equal(next.currentPlayerId, 'p2');
  assert.equal(next.currentPhase, 'PRE_ROLL');
});

// ─── Purity: applyAction must not mutate its input ────────────────────────────

test('CHOOSE_VENTURE_CARD does not mutate the input state', () => {
  const board: Record<string, Node> = {
    bank: { id: 'bank', type: 'bank', neighbors: ['v1'], coordinates: { x: 0, y: 0 } },
    v1: { id: 'v1', type: 'venture', neighbors: ['bank'], coordinates: { x: 1, y: 0 } },
  };
  const state = makeState({
    board,
    currentPhase: 'SPACE_ACTION',
    players: { p1: makePlayer('p1', { currentNodeId: 'v1' }), p2: makePlayer('p2') },
    ventureGrid: Array.from({ length: 64 }, () => ({ cleared: false, playerId: null })),
    // All cells map to card #1 (Lucky Break, deterministic CASH_GAIN)
    ventureGridCardIds: Array.from({ length: 64 }, () => 1),
  });

  const snapshot = JSON.stringify(state);
  const next = applyAction(state, { type: 'CHOOSE_VENTURE_CARD', cardIndex: 0 });

  assert.equal(JSON.stringify(state), snapshot, 'input state was mutated');
  assert.equal(next.players.p1.cash, 1200);  // Lucky Break +200
});

test('CHOOSE_PATH over an opponent checkpoint does not mutate the input state', () => {
  const board: Record<string, Node> = {
    bank: { id: 'bank', type: 'bank', neighbors: ['cp'], coordinates: { x: 0, y: 0 } },
    cp: { id: 'cp', type: 'vacant', neighbors: ['bank', 'end'], coordinates: { x: 1, y: 0 } },
    end: { id: 'end', type: 'property', neighbors: ['cp'], coordinates: { x: 2, y: 0 } },
  };
  const checkpoint: Property = {
    id: 'cp', nodeId: 'cp', districtId: 'd1', ownerId: 'p2',
    basePrice: 200, currentPrice: 200, baseRent: 0, currentRent: 200,
    capitalInvested: 0, maxCapital: 0, shopMultiplier: 1,
    buildingType: 'checkpoint', checkpointToll: 200,
  };
  const endProp: Property = {
    id: 'end', nodeId: 'end', districtId: 'd1', ownerId: null,
    basePrice: 100, currentPrice: 100, baseRent: 20, currentRent: 20,
    capitalInvested: 0, maxCapital: 300, shopMultiplier: 1,
  };
  const state = makeState({
    board,
    currentPhase: 'CHOOSING_PATH',
    pendingDestinations: ['end'],
    lastRoll: { p1: 2 },
    players: {
      p1: makePlayer('p1'),
      p2: makePlayer('p2', { propertyIds: ['cp'] }),
    },
    properties: { cp: checkpoint, end: endProp },
    districts: { d1: { id: 'd1', name: 'D1', stockPrice: 10, propertyIds: ['cp', 'end'], playerHoldings: {} } },
  });

  const snapshot = JSON.stringify(state);
  const next = applyAction(state, { type: 'CHOOSE_PATH', nodeId: 'end' });

  assert.equal(JSON.stringify(state), snapshot, 'input state was mutated');
  assert.equal(next.players.p1.cash, 1000 - 200);   // toll paid
  assert.equal(next.players.p2.cash, 1000 + 200);   // toll received
  assert.equal(next.properties.cp.checkpointToll, 210);  // toll incremented
});

// ─── Win on passing the bank ──────────────────────────────────────────────────

test('passing the bank with target net worth met wins immediately', () => {
  const board: Record<string, Node> = {
    a: { id: 'a', type: 'property', neighbors: ['bank'], coordinates: { x: 0, y: 0 } },
    bank: { id: 'bank', type: 'bank', neighbors: ['b'], coordinates: { x: 1, y: 0 } },
    b: { id: 'b', type: 'property', neighbors: ['a'], coordinates: { x: 2, y: 0 } },
  };
  const state = makeState({
    board,
    targetNetWorth: 500,  // already exceeded (cash 1000)
    players: {
      p1: makePlayer('p1', { currentNodeId: 'a' }),
      p2: makePlayer('p2', { currentNodeId: 'a' }),
    },
  });

  // Force roll = 2: a → bank → b (passes bank, lands on b)
  const origRandom = Math.random;
  Math.random = () => 1 / 6;  // floor(1/6 * 6) + 1 = 2
  try {
    const next = applyAction(state, { type: 'ROLL_DICE' });
    assert.equal(next.players.p1.currentNodeId, 'b');
    assert.equal(next.winnerId, 'p1');
  } finally {
    Math.random = origRandom;
  }
});

test('passing the bank below target net worth does not win', () => {
  const board: Record<string, Node> = {
    a: { id: 'a', type: 'property', neighbors: ['bank'], coordinates: { x: 0, y: 0 } },
    bank: { id: 'bank', type: 'bank', neighbors: ['b'], coordinates: { x: 1, y: 0 } },
    b: { id: 'b', type: 'property', neighbors: ['a'], coordinates: { x: 2, y: 0 } },
  };
  const state = makeState({
    board,
    targetNetWorth: 10000,
    players: {
      p1: makePlayer('p1', { currentNodeId: 'a' }),
      p2: makePlayer('p2', { currentNodeId: 'a' }),
    },
  });

  const origRandom = Math.random;
  Math.random = () => 1 / 6;
  try {
    const next = applyAction(state, { type: 'ROLL_DICE' });
    assert.equal(next.players.p1.currentNodeId, 'b');
    assert.equal(next.winnerId, null);
  } finally {
    Math.random = origRandom;
  }
});

test('pass-through salary can push the player over the target and win on the same pass', () => {
  const board: Record<string, Node> = {
    a: { id: 'a', type: 'property', neighbors: ['bank'], coordinates: { x: 0, y: 0 } },
    bank: { id: 'bank', type: 'bank', neighbors: ['b'], coordinates: { x: 1, y: 0 } },
    b: { id: 'b', type: 'property', neighbors: ['a'], coordinates: { x: 2, y: 0 } },
  };
  // cash 1000, salary = 250 base + 1×150 level bonus = 400 → 1400 ≥ 1300 target
  const state = makeState({
    board,
    targetNetWorth: 1300,
    players: {
      p1: makePlayer('p1', {
        currentNodeId: 'a',
        suits: { heart: true, diamond: true, club: true, spade: true },
      }),
      p2: makePlayer('p2', { currentNodeId: 'a' }),
    },
  });

  const origRandom = Math.random;
  Math.random = () => 1 / 6;
  try {
    const next = applyAction(state, { type: 'ROLL_DICE' });
    assert.equal(next.players.p1.cash, 1400);          // salary collected on pass
    assert.equal(next.players.p1.level, 2);
    assert.equal(next.winnerId, 'p1');
  } finally {
    Math.random = origRandom;
  }
});

// ─── Native tax office square (board prep) ────────────────────────────────────

test('landing on a tax_office square pays 5% of net worth to the bank and auto-advances', () => {
  const board: Record<string, Node> = {
    bank: { id: 'bank', type: 'bank', neighbors: ['tax1'], coordinates: { x: 0, y: 0 } },
    tax1: { id: 'tax1', type: 'tax_office', neighbors: ['bank'], coordinates: { x: 1, y: 0 } },
  };
  const state = makeState({
    board,
    players: {
      p1: makePlayer('p1', { cash: 1000, netWorth: 1000 }),
      p2: makePlayer('p2'),
    },
  });

  // Force roll = 1: bank → tax1
  const origRandom = Math.random;
  Math.random = () => 0;
  try {
    const next = applyAction(state, { type: 'ROLL_DICE' });
    assert.equal(next.players.p1.currentNodeId, 'tax1');
    assert.equal(next.players.p1.cash, 950);          // floor(1000 × 0.05) = 50 paid to bank
    assert.equal(next.players.p2.cash, 1000);         // nobody receives it
    assert.equal(next.currentPlayerId, 'p2');         // auto-resolved, turn advanced
    assert.equal(next.currentPhase, 'PRE_ROLL');
    assert.ok(next.log.some(l => l.includes('[TAX]')));
  } finally {
    Math.random = origRandom;
  }
});

// ─── Take-a-break square ──────────────────────────────────────────────────────

test('landing on a break square shuts your shops until your next turn', () => {
  const board: Record<string, Node> = {
    bank: { id: 'bank', type: 'bank', neighbors: ['rest1'], coordinates: { x: 0, y: 0 } },
    rest1: { id: 'rest1', type: 'break', neighbors: ['bank'], coordinates: { x: 1, y: 0 } },
  };
  const state = makeState({
    board,
    players: {
      p1: makePlayer('p1', { cash: 1000 }),
      p2: makePlayer('p2'),
    },
  });

  const origRandom = Math.random;
  Math.random = () => 0;  // movement roll 1
  try {
    const next = applyAction(state, { type: 'ROLL_DICE' });
    assert.equal(next.players.p1.currentNodeId, 'rest1');
    assert.equal(next.players.p1.cash, 1000);                          // no gift — authentic rule
    assert.equal(next.players.p1.shopsClosedUntilNextTurn, true);      // shops shut
    assert.equal(next.currentPlayerId, 'p2');                          // auto-resolved
    assert.ok(next.log.some(l => l.includes('[BREAK]')));

    // The closure lifts when p1's next turn starts
    const back = applyAction({ ...next, currentPhase: 'SPACE_ACTION', players: { ...next.players, p2: { ...next.players.p2, currentNodeId: 'bank' } } }, { type: 'END_TURN' });
    assert.equal(back.currentPlayerId, 'p1');
    assert.equal(back.players.p1.shopsClosedUntilNextTurn, false);
  } finally {
    Math.random = origRandom;
  }
});

test('boon and boom squares grant 20%/50% commission until next turn', () => {
  for (const [type, pct] of [['boon', 20], ['boom', 50]] as const) {
    const board: Record<string, Node> = {
      bank: { id: 'bank', type: 'bank', neighbors: ['c1'], coordinates: { x: 0, y: 0 } },
      c1: { id: 'c1', type, neighbors: ['bank'], coordinates: { x: 1, y: 0 } },
    };
    const state = makeState({ board });
    const origRandom = Math.random;
    Math.random = () => 0;
    try {
      const next = applyAction(state, { type: 'ROLL_DICE' });
      assert.equal(next.players.p1.commissionUntilNextTurn, pct, `${type} commission`);
      assert.equal(next.currentPlayerId, 'p2');  // auto-resolved
      assert.ok(next.log.some(l => l.includes(`[${type.toUpperCase()}]`)));
    } finally {
      Math.random = origRandom;
    }
  }
});

test('landing on the bank clears arrival memory (free direction next turn)', () => {
  const board: Record<string, Node> = {
    a: { id: 'a', type: 'property', neighbors: ['bank'], coordinates: { x: 0, y: 0 } },
    bank: { id: 'bank', type: 'bank', neighbors: ['a', 'c'], coordinates: { x: 1, y: 0 } },
    c: { id: 'c', type: 'property', neighbors: ['bank'], coordinates: { x: 2, y: 0 } },
  };
  const state = makeState({
    board,
    players: {
      p1: makePlayer('p1', { currentNodeId: 'a' }),
      p2: makePlayer('p2', { currentNodeId: 'c' }),
    },
  });
  const origRandom = Math.random;
  Math.random = () => 0;  // roll 1 → land on bank
  try {
    const next = applyAction(state, { type: 'ROLL_DICE' });
    assert.equal(next.players.p1.currentNodeId, 'bank');
    assert.equal(next.players.p1.arrivedFromNodeId, undefined);  // privilege granted
  } finally {
    Math.random = origRandom;
  }
});

// ─── No walking back the way you came ─────────────────────────────────────────

test('roll cannot start back the way the player arrived', () => {
  // Linear corridor a—b—c (bidirectional). Player at b, arrived from a.
  const board: Record<string, Node> = {
    a: { id: 'a', type: 'property', neighbors: ['b'], coordinates: { x: 0, y: 0 } },
    b: { id: 'b', type: 'property', neighbors: ['a', 'c'], coordinates: { x: 1, y: 0 } },
    c: { id: 'c', type: 'stockbroker', neighbors: ['b'], coordinates: { x: 2, y: 0 } },
  };
  const state = makeState({
    board,
    players: {
      p1: makePlayer('p1', { currentNodeId: 'b', arrivedFromNodeId: 'a' }),
      p2: makePlayer('p2', { currentNodeId: 'c' }),
    },
  });

  // Roll 1: only forward to c is legal (a is the arrival direction) — no branch choice
  const origRandom = Math.random;
  Math.random = () => 0;
  try {
    const next = applyAction(state, { type: 'ROLL_DICE' });
    assert.equal(next.players.p1.currentNodeId, 'c');       // forced forward
    assert.equal(next.players.p1.arrivedFromNodeId, 'b');   // memory updated
  } finally {
    Math.random = origRandom;
  }
});

test('without arrival memory the same roll offers both directions', () => {
  const board: Record<string, Node> = {
    a: { id: 'a', type: 'property', neighbors: ['b'], coordinates: { x: 0, y: 0 } },
    b: { id: 'b', type: 'property', neighbors: ['a', 'c'], coordinates: { x: 1, y: 0 } },
    c: { id: 'c', type: 'bank', neighbors: ['b'], coordinates: { x: 2, y: 0 } },
  };
  const state = makeState({
    board,
    players: {
      p1: makePlayer('p1', { currentNodeId: 'b' }),   // no arrivedFromNodeId
      p2: makePlayer('p2', { currentNodeId: 'c' }),
    },
  });

  const origRandom = Math.random;
  Math.random = () => 0;
  try {
    const next = applyAction(state, { type: 'ROLL_DICE' });
    assert.equal(next.currentPhase, 'CHOOSING_PATH');
    assert.deepEqual([...(next.pendingDestinations ?? [])].sort(), ['a', 'c']);
  } finally {
    Math.random = origRandom;
  }
});

test('dead-end node: backtracking allowed when it is the only way out', () => {
  // cul: only neighbor is b; player arrived from b. Block would strand them.
  const board: Record<string, Node> = {
    b: { id: 'b', type: 'bank', neighbors: ['cul'], coordinates: { x: 0, y: 0 } },
    cul: { id: 'cul', type: 'property', neighbors: ['b'], coordinates: { x: 1, y: 0 } },
  };
  const state = makeState({
    board,
    players: {
      p1: makePlayer('p1', { currentNodeId: 'cul', arrivedFromNodeId: 'b' }),
      p2: makePlayer('p2', { currentNodeId: 'b' }),
    },
  });

  const origRandom = Math.random;
  Math.random = () => 0;
  try {
    const next = applyAction(state, { type: 'ROLL_DICE' });
    assert.equal(next.players.p1.currentNodeId, 'b');   // fallback let them out
  } finally {
    Math.random = origRandom;
  }
});

test('teleport clears arrival memory (free direction choice after warping)', () => {
  const board: Record<string, Node> = {
    bank: { id: 'bank', type: 'bank', neighbors: ['bp'], coordinates: { x: 0, y: 0 } },
    bp: { id: 'bp', type: 'vacant', neighbors: ['bank'], coordinates: { x: 1, y: 0 } },
  };
  const balloonport: Property = {
    id: 'bp', nodeId: 'bp', districtId: 'd1', ownerId: 'p1',
    basePrice: 200, currentPrice: 200, baseRent: 0, currentRent: 200,
    capitalInvested: 0, maxCapital: 0, shopMultiplier: 1, buildingType: 'balloonport',
  };
  const state = makeState({
    currentPhase: 'SPACE_ACTION',
    board,
    players: {
      p1: makePlayer('p1', { currentNodeId: 'bp', arrivedFromNodeId: 'bank', propertyIds: ['bp'] }),
      p2: makePlayer('p2'),
    },
    properties: { bp: balloonport },
    districts: { d1: { id: 'd1', name: 'D1', stockPrice: 8, propertyIds: ['bp'], playerHoldings: {} } },
  });

  const next = applyAction(state, { type: 'TELEPORT', nodeId: 'bank' });
  assert.equal(next.players.p1.currentNodeId, 'bank');
  assert.equal(next.players.p1.arrivedFromNodeId, undefined);
});

// ─── Debt settlement phase ────────────────────────────────────────────────────

test('END_TURN with negative cash enters DEBT_SETTLEMENT instead of advancing', () => {
  const district: District = {
    id: 'd1', name: 'D1', stockPrice: 50, propertyIds: [], playerHoldings: { p1: 5 },
  };
  const state = makeState({
    currentPhase: 'SPACE_ACTION',
    players: {
      p1: makePlayer('p1', { cash: -100, netWorth: 150 }),
      p2: makePlayer('p2'),
    },
    districts: { d1: district },
  });

  const next = applyAction(state, { type: 'END_TURN' });

  assert.equal(next.currentPhase, 'DEBT_SETTLEMENT');
  assert.equal(next.currentPlayerId, 'p1');             // turn NOT advanced
  assert.equal(next.debtResume, 'ADVANCE_TURN');
  assert.equal(next.districts.d1.playerHoldings.p1, 5); // nothing auto-sold
});

test('DEBT_SETTLEMENT: SELL_STOCK covers debt, END_TURN then advances turn', () => {
  const district: District = {
    id: 'd1', name: 'D1', stockPrice: 50, propertyIds: [], playerHoldings: { p1: 5 },
  };
  const state = makeState({
    currentPhase: 'DEBT_SETTLEMENT',
    debtResume: 'ADVANCE_TURN',
    players: {
      p1: makePlayer('p1', { cash: -100, netWorth: 150 }),
      p2: makePlayer('p2'),
    },
    districts: { d1: district },
  });

  const sold = applyAction(state, { type: 'SELL_STOCK', districtId: 'd1', shares: 3 });
  assert.equal(sold.players.p1.cash, 50);               // -100 + 3×50
  assert.equal(sold.currentPhase, 'DEBT_SETTLEMENT');   // still settling until END_TURN

  const next = applyAction(sold, { type: 'END_TURN' });
  assert.equal(next.currentPlayerId, 'p2');
  assert.equal(next.currentPhase, 'PRE_ROLL');
  assert.equal(next.debtResume, undefined);
});

test('DEBT_SETTLEMENT: END_TURN throws while still in debt', () => {
  const district: District = {
    id: 'd1', name: 'D1', stockPrice: 50, propertyIds: [], playerHoldings: { p1: 5 },
  };
  const state = makeState({
    currentPhase: 'DEBT_SETTLEMENT',
    debtResume: 'ADVANCE_TURN',
    players: {
      p1: makePlayer('p1', { cash: -100, netWorth: 150 }),
      p2: makePlayer('p2'),
    },
    districts: { d1: district },
  });

  assert.throws(() => applyAction(state, { type: 'END_TURN' }), /debt/);
  assert.throws(() => applyAction(state, { type: 'ROLL_DICE' }), /DEBT_SETTLEMENT/);
});

test('DEBT_SETTLEMENT: SELL_PROPERTY opens an auction; bank floor applies when all pass', () => {
  const prop: Property = {
    id: 'prop1', nodeId: 'prop1', districtId: 'd1', ownerId: 'p1',
    basePrice: 100, currentPrice: 100, baseRent: 20, currentRent: 20,
    capitalInvested: 0, maxCapital: 300, shopMultiplier: 1,
  };
  const district: District = {
    id: 'd1', name: 'D1', stockPrice: 4, propertyIds: ['prop1'], playerHoldings: {},
  };
  const state = makeState({
    currentPhase: 'DEBT_SETTLEMENT',
    debtResume: 'ADVANCE_TURN',
    players: {
      p1: makePlayer('p1', { cash: -50, netWorth: 50, propertyIds: ['prop1'] }),
      p2: makePlayer('p2'),
    },
    properties: { prop1: prop },
    districts: { d1: district },
  });

  const opened = applyAction(state, { type: 'SELL_PROPERTY', propertyId: 'prop1' });
  assert.ok(opened.auction, 'an auction must open');
  assert.equal(opened.auction!.bankFloor, 75);
  assert.equal(opened.players.p1.cash, -50);            // nothing sold yet

  // Other actions are paused while the auction runs
  assert.throws(() => applyAction(opened, { type: 'END_TURN' }), /auction is in progress/);

  // p2 passes → bank takes it at the 75% floor
  const resolved = applyAction(opened, { type: 'AUCTION_PASS', playerId: 'p2' });
  assert.equal(resolved.auction ?? null, null);
  assert.equal(resolved.players.p1.cash, 25);           // -50 + 75
  assert.equal(resolved.properties.prop1.ownerId, null);
  assert.equal(resolved.players.p1.propertyIds.length, 0);
});

test('debt auction: a rival bid beats the bank floor and transfers the shop', () => {
  const prop: Property = {
    id: 'prop1', nodeId: 'prop1', districtId: 'd1', ownerId: 'p1',
    basePrice: 100, currentPrice: 100, baseRent: 20, currentRent: 20,
    capitalInvested: 0, maxCapital: 300, shopMultiplier: 1,
  };
  const district: District = {
    id: 'd1', name: 'D1', stockPrice: 4, propertyIds: ['prop1'], playerHoldings: {},
  };
  const state = makeState({
    currentPhase: 'DEBT_SETTLEMENT',
    debtResume: 'ADVANCE_TURN',
    players: {
      p1: makePlayer('p1', { cash: -50, netWorth: 50, propertyIds: ['prop1'] }),
      p2: makePlayer('p2'),
      p3: makePlayer('p3'),
    },
    turnOrder: ['p1', 'p2', 'p3'],
    properties: { prop1: prop },
    districts: { d1: district },
  });

  const opened = applyAction(state, { type: 'SELL_PROPERTY', propertyId: 'prop1' });
  assert.ok(opened.auction);

  // Bids below the reserve are rejected
  assert.throws(() => applyAction(opened, { type: 'AUCTION_BID', playerId: 'p2', amount: 50 }), /at least/);

  const bid = applyAction(opened, { type: 'AUCTION_BID', playerId: 'p2', amount: 95 });
  assert.equal(bid.auction!.highBid?.amount, 95);

  const done = applyAction(bid, { type: 'AUCTION_PASS', playerId: 'p3' });
  assert.equal(done.auction ?? null, null);
  assert.equal(done.players.p1.cash, 45);               // -50 + 95 (full bid to seller)
  assert.equal(done.players.p2.cash, 1000 - 95);
  assert.equal(done.properties.prop1.ownerId, 'p2');
  assert.ok(done.players.p2.propertyIds.includes('prop1'));
});

test('SELL_PROPERTY is illegal outside DEBT_SETTLEMENT', () => {
  const prop: Property = {
    id: 'prop1', nodeId: 'prop1', districtId: 'd1', ownerId: 'p1',
    basePrice: 100, currentPrice: 100, baseRent: 20, currentRent: 20,
    capitalInvested: 0, maxCapital: 300, shopMultiplier: 1,
  };
  const state = makeState({
    players: {
      p1: makePlayer('p1', { propertyIds: ['prop1'] }),
      p2: makePlayer('p2'),
    },
    properties: { prop1: prop },
    districts: { d1: { id: 'd1', name: 'D1', stockPrice: 4, propertyIds: ['prop1'], playerHoldings: {} } },
  });

  assert.throws(
    () => applyAction(state, { type: 'SELL_PROPERTY', propertyId: 'prop1' }),
    /SELL_PROPERTY/,
  );
});

test('incoming player in debt starts their turn in DEBT_SETTLEMENT, resumes to PRE_ROLL', () => {
  const district: District = {
    id: 'd1', name: 'D1', stockPrice: 50, propertyIds: [], playerHoldings: { p2: 5 },
  };
  const state = makeState({
    currentPhase: 'SPACE_ACTION',
    players: {
      p1: makePlayer('p1'),
      p2: makePlayer('p2', { cash: -50, netWorth: 200 }), // charged during p1's turn
    },
    districts: { d1: district },
  });

  const next = applyAction(state, { type: 'END_TURN' });
  assert.equal(next.currentPlayerId, 'p2');
  assert.equal(next.currentPhase, 'DEBT_SETTLEMENT');
  assert.equal(next.debtResume, 'PRE_ROLL');

  const sold = applyAction(next, { type: 'SELL_STOCK', districtId: 'd1', shares: 1 });
  const settled = applyAction(sold, { type: 'END_TURN' });
  assert.equal(settled.currentPlayerId, 'p2');          // still p2's turn
  assert.equal(settled.currentPhase, 'PRE_ROLL');       // now free to roll
});

// ─── Casino ───────────────────────────────────────────────────────────────────

const casinoBoard: Record<string, Node> = {
  bank:   { id: 'bank', type: 'bank', neighbors: ['casino1'], coordinates: { x: 0, y: 0 } },
  casino1: { id: 'casino1', type: 'casino', neighbors: ['bank'], coordinates: { x: 1, y: 0 } },
};

function makeCasinoState(): GameState {
  return makeState({
    currentPhase: 'SPACE_ACTION',
    board: casinoBoard,
    players: {
      p1: makePlayer('p1', { currentNodeId: 'casino1' }),
      p2: makePlayer('p2'),
    },
  });
}

test('CASINO_BET: derby win pays 4x, one bet per visit, END_TURN leaves the table', () => {
  const state = makeCasinoState();
  const origRandom = Math.random;
  Math.random = () => 0.6; // floor(0.6 * 4) = slime 2
  try {
    const next = applyAction(state, { type: 'CASINO_BET', game: 'derby', wager: 100, choice: '2' });
    assert.equal(next.players.p1.cash, 1300);          // 1000 - 100 + 400
    assert.equal(next.casinoResult?.won, true);
    assert.equal(next.casinoResult?.winnerSlime, 2);
    assert.equal(next.currentPhase, 'SPACE_ACTION');   // stays for the result animation

    assert.throws(
      () => applyAction(next, { type: 'CASINO_BET', game: 'derby', wager: 100, choice: '0' }),
      /one game per casino stop/,
    );

    const done = applyAction(next, { type: 'END_TURN' });
    assert.equal(done.currentPlayerId, 'p2');
    assert.equal(done.casinoResult, null);             // cleared on turn advance
  } finally {
    Math.random = origRandom;
  }
});

test('CASINO_BET: derby loss forfeits the wager', () => {
  const state = makeCasinoState();
  const origRandom = Math.random;
  Math.random = () => 0.6; // winner slime 2
  try {
    const next = applyAction(state, { type: 'CASINO_BET', game: 'derby', wager: 100, choice: '0' });
    assert.equal(next.players.p1.cash, 900);
    assert.equal(next.casinoResult?.won, false);
    assert.equal(next.casinoResult?.payout, 0);
  } finally {
    Math.random = origRandom;
  }
});

test('CASINO_BET: highlow tie loses (house edge), win pays 2x', () => {
  const origRandom = Math.random;
  try {
    Math.random = () => 0.5; // both cards = 1 + floor(0.5 * 13) = 7 → tie
    const tied = applyAction(makeCasinoState(), { type: 'CASINO_BET', game: 'highlow', wager: 50, choice: 'high' });
    assert.equal(tied.players.p1.cash, 950);
    assert.equal(tied.casinoResult?.won, false);

    let calls = 0;
    Math.random = () => (calls++ === 0 ? 0.0 : 0.9); // card1 = A(1), card2 = K(12+1)
    const won = applyAction(makeCasinoState(), { type: 'CASINO_BET', game: 'highlow', wager: 50, choice: 'high' });
    assert.equal(won.players.p1.cash, 1050);           // 1000 - 50 + 100
    assert.equal(won.casinoResult?.won, true);
  } finally {
    Math.random = origRandom;
  }
});

test('CASINO_BET: validation — off-node, wager bounds, unaffordable', () => {
  const offNode = makeState({ currentPhase: 'SPACE_ACTION' }); // player at bank
  assert.throws(
    () => applyAction(offNode, { type: 'CASINO_BET', game: 'derby', wager: 100, choice: '0' }),
    /casino node/,
  );

  const state = makeCasinoState();
  assert.throws(() => applyAction(state, { type: 'CASINO_BET', game: 'derby', wager: 5, choice: '0' }), /between/);
  assert.throws(() => applyAction(state, { type: 'CASINO_BET', game: 'derby', wager: 9999, choice: '0' }), /between/);

  const broke = makeState({
    currentPhase: 'SPACE_ACTION',
    board: casinoBoard,
    players: { p1: makePlayer('p1', { currentNodeId: 'casino1', cash: 20 }), p2: makePlayer('p2') },
  });
  assert.throws(() => applyAction(broke, { type: 'CASINO_BET', game: 'derby', wager: 100, choice: '0' }), /afford/);
});

test('hopeless debt at turn end bankrupts instead of trapping in DEBT_SETTLEMENT', () => {
  // p1 ends their turn 200G in debt with NO assets — must go bankrupt
  // (game over), never enter an unwinnable settlement phase.
  const state = makeState({
    currentPhase: 'SPACE_ACTION',
    players: {
      p1: makePlayer('p1', { cash: -200, netWorth: -200 }),
      p2: makePlayer('p2'),
    },
  });

  const next = applyAction(state, { type: 'END_TURN' });

  assert.equal(next.players.p1.isBankrupt, true);
  assert.equal(next.bankruptCount, 1);
  assert.equal(next.winnerId, 'p2');                    // bankruptcy ends the game
  assert.notEqual(next.currentPhase, 'DEBT_SETTLEMENT');
});

test('hopeless debt on an incoming player bankrupts at turn handoff', () => {
  // p2 was charged during p1's turn and has nothing to sell.
  const state = makeState({
    currentPhase: 'SPACE_ACTION',
    players: {
      p1: makePlayer('p1'),
      p2: makePlayer('p2', { cash: -75, netWorth: -75 }),
    },
  });

  const next = applyAction(state, { type: 'END_TURN' });

  assert.equal(next.players.p2.isBankrupt, true);
  assert.equal(next.winnerId, 'p1');
  assert.notEqual(next.currentPhase, 'DEBT_SETTLEMENT');
});

// ─── Bankruptcy limit & end-game vote ─────────────────────────────────────────

function makeLimitState(limit: number, players: Record<string, Player>, order: string[]): GameState {
  return makeState({
    currentPhase: 'SPACE_ACTION',
    bankruptcyLimit: limit,
    players,
    turnOrder: order,
  });
}

test('bankruptcy below the limit eliminates the player and opens an end-game vote', () => {
  const state = makeLimitState(2, {
    p1: makePlayer('p1', { cash: -200, netWorth: -200 }),   // hopeless
    p2: makePlayer('p2', { netWorth: 900 }),
    p3: makePlayer('p3', { netWorth: 1500 }),
  }, ['p1', 'p2', 'p3']);

  const next = applyAction(state, { type: 'END_TURN' });

  assert.equal(next.players.p1.isBankrupt, true);
  assert.equal(next.winnerId, null);                       // game continues
  assert.ok(next.endVote, 'an end-game vote must open');
  assert.ok(next.log.some(l => l.startsWith('[ELIMINATED]')));
});

test('any vote to continue cancels the vote; play resumes skipping the eliminated seat', () => {
  const base = makeLimitState(2, {
    p1: makePlayer('p1', { cash: -200, netWorth: -200 }),
    p2: makePlayer('p2', { netWorth: 900 }),
    p3: makePlayer('p3', { netWorth: 1500 }),
  }, ['p1', 'p2', 'p3']);
  const voting = applyAction(base, { type: 'END_TURN' });

  // Non-vote actions are blocked while the vote is pending
  assert.throws(() => applyAction(voting, { type: 'ROLL_DICE' }), /vote is in progress/);

  const resumed = applyAction(voting, { type: 'VOTE_END', playerId: 'p3', vote: false });
  assert.equal(resumed.endVote, null);
  assert.equal(resumed.winnerId, null);
  // p1 is eliminated: the turn that ended belonged to p1, so play passed on
  assert.notEqual(resumed.currentPlayerId, 'p1');

  // Eliminated seats stay skipped on future turn advances
  const afterTurn = applyAction({ ...resumed, currentPhase: 'SPACE_ACTION', players: { ...resumed.players, [resumed.currentPlayerId]: { ...resumed.players[resumed.currentPlayerId], currentNodeId: 'bank' } } }, { type: 'END_TURN' });
  assert.notEqual(afterTurn.currentPlayerId, 'p1');
});

test('a unanimous vote ends the game with the richest survivor as winner', () => {
  const base = makeLimitState(3, {
    p1: makePlayer('p1', { cash: -100, netWorth: -100 }),
    p2: makePlayer('p2', { netWorth: 900 }),
    p3: makePlayer('p3', { netWorth: 1500 }),
  }, ['p1', 'p2', 'p3']);
  const voting = applyAction(base, { type: 'END_TURN' });

  const oneVote = applyAction(voting, { type: 'VOTE_END', playerId: 'p2', vote: true });
  assert.ok(oneVote.endVote, 'still waiting for p3');
  assert.equal(oneVote.winnerId, null);

  const done = applyAction(oneVote, { type: 'VOTE_END', playerId: 'p3', vote: true });
  assert.equal(done.endVote, null);
  assert.equal(done.winnerId, 'p3');                       // richest alive
});

test('bots are ineligible: their absence does not block unanimity and their vote is rejected', () => {
  const base = makeLimitState(2, {
    p1: makePlayer('p1', { cash: -100, netWorth: -100 }),
    p2: makePlayer('p2', { netWorth: 900 }),
    bot1: { ...makePlayer('bot1', { netWorth: 2000 }), isBot: true },
  }, ['p1', 'p2', 'bot1']);
  const voting = applyAction(base, { type: 'END_TURN' });

  assert.throws(() => applyAction(voting, { type: 'VOTE_END', playerId: 'bot1', vote: true }), /Bots don't vote/);

  // p2 is the only eligible voter — their single yes is unanimous
  const done = applyAction(voting, { type: 'VOTE_END', playerId: 'p2', vote: true });
  assert.equal(done.winnerId, 'bot1');                     // richest alive still wins
});

test('the bankruptcy limit ends the game when reached', () => {
  // limit 2, second bankruptcy → game over, no vote
  const state = makeState({
    currentPhase: 'SPACE_ACTION',
    bankruptcyLimit: 2,
    bankruptCount: 1,
    players: {
      p1: makePlayer('p1', { cash: -50, netWorth: -50 }),
      p2: makePlayer('p2', { netWorth: 700 }),
      p3: makePlayer('p3', { isBankrupt: true, cash: 0, netWorth: 0 }),
    },
    turnOrder: ['p1', 'p2', 'p3'],
  });

  const next = applyAction(state, { type: 'END_TURN' });
  assert.equal(next.players.p1.isBankrupt, true);
  assert.equal(next.winnerId, 'p2');
  assert.equal(next.endVote ?? null, null);
});

test('last-standing limit (99) ends only when one player remains', () => {
  const state = makeState({
    currentPhase: 'SPACE_ACTION',
    bankruptcyLimit: 99,
    bankruptCount: 1,
    players: {
      p1: makePlayer('p1', { cash: -50, netWorth: -50 }),
      p2: makePlayer('p2', { netWorth: 700 }),
      p3: makePlayer('p3', { isBankrupt: true, cash: 0, netWorth: 0 }),
    },
    turnOrder: ['p1', 'p2', 'p3'],
  });

  const next = applyAction(state, { type: 'END_TURN' });
  assert.equal(next.winnerId, 'p2');                       // only one left standing
});

// ─── Suit Yourself wildcards & forced rolls ───────────────────────────────────

test('Suit Yourself wildcards complete a promotion and are spent', () => {
  // p1 has 2 suits + 2 wildcards → lands on bank → salary, wildcards consumed
  const board: Record<string, Node> = {
    a: { id: 'a', type: 'property', neighbors: ['bank'], coordinates: { x: 0, y: 0 } },
    bank: { id: 'bank', type: 'bank', neighbors: ['a'], coordinates: { x: 1, y: 0 } },
  };
  const state = makeState({
    board,
    players: {
      p1: makePlayer('p1', {
        currentNodeId: 'a',
        suits: { heart: true, diamond: true, club: false, spade: false },
        suitYourself: 3,
        level: 1,
      }),
      p2: makePlayer('p2', { currentNodeId: 'bank' }),
    },
  });

  const origRandom = Math.random;
  Math.random = () => 0;  // roll 1 → land on bank
  try {
    const next = applyAction(state, { type: 'ROLL_DICE' });
    assert.equal(next.players.p1.level, 2);                       // promoted
    assert.equal(next.players.p1.suitYourself, 1);                // 2 of 3 spent
    assert.equal(next.players.p1.suits.heart, false);             // suits reset
    assert.equal(next.players.p1.cash, 1000 + 250 + 150);         // base + level bonus
  } finally {
    Math.random = origRandom;
  }
});

test('forced roll overrides the die and is consumed', () => {
  // Corridor long enough that a forced 1 is distinguishable from random 1-6
  const board: Record<string, Node> = {};
  const ids = ['n0', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7'];
  ids.forEach((id, i) => {
    board[id] = {
      id,
      type: i === 0 ? 'bank' : 'stockbroker',
      neighbors: i < ids.length - 1 ? [ids[i + 1]] : [],
      coordinates: { x: i, y: 0 },
    };
  });
  const state = makeState({
    board,
    players: {
      p1: makePlayer('p1', { currentNodeId: 'n0', forcedRoll: 7 }),
      p2: makePlayer('p2', { currentNodeId: 'n0' }),
    },
  });

  const origRandom = Math.random;
  Math.random = () => 0.99;  // would roll 6 if random were used
  try {
    const next = applyAction(state, { type: 'ROLL_DICE' });
    assert.equal(next.players.p1.currentNodeId, 'n7');            // moved exactly 7
    assert.equal(next.players.p1.forcedRoll, undefined);          // consumed
  } finally {
    Math.random = origRandom;
  }
});
