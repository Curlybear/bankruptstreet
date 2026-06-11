import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from './stateMachine.js';
import { greedyBotAction } from './bot.js';
import type { GameState, Player, Property, Node } from '../shared/types.js';

function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: `Player ${id}`,
    cash: 1000,
    netWorth: 1000,
    currentNodeId: 'casino1',
    level: 1,
    suits: { heart: false, diamond: false, club: false, spade: false },
    propertyIds: [],
    isBankrupt: false,
    ...overrides,
  };
}

function makeProp(id: string, overrides: Partial<Property> = {}): Property {
  return {
    id, nodeId: id, districtId: 'd1', ownerId: null,
    basePrice: 100, currentPrice: 100, baseRent: 20, currentRent: 20,
    capitalInvested: 0, maxCapital: 200, shopMultiplier: 1,
    ...overrides,
  };
}

const board: Record<string, Node> = {
  bank: { id: 'bank', type: 'bank', neighbors: ['casino1'], coordinates: { x: 0, y: 0 } },
  casino1: { id: 'casino1', type: 'casino', neighbors: ['bank'], coordinates: { x: 1, y: 0 } },
  shop1: { id: 'shop1', type: 'property', neighbors: [], coordinates: { x: 2, y: 0 } },
};

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    roomId: 'test',
    players: { p1: makePlayer('p1'), p2: makePlayer('p2', { currentNodeId: 'bank' }) },
    turnOrder: ['p1', 'p2'],
    currentPlayerId: 'p1',
    currentPhase: 'SPACE_ACTION',
    board,
    properties: { shop1: makeProp('shop1') },
    districts: {
      d1: { id: 'd1', name: 'D1', stockPrice: 40, propertyIds: ['shop1'], playerHoldings: {} },
    },
    round: 1,
    targetNetWorth: 100000,
    winnerId: null,
    bankruptCount: 0,
    log: [],
    ...overrides,
  };
}

function withRandom<T>(value: number, fn: () => T): T {
  const orig = Math.random;
  Math.random = () => value;
  try { return fn(); } finally { Math.random = orig; }
}

// ─── Round the Blocks (slots) ─────────────────────────────────────────────────

test('slots jackpot pays 500G x level and lines up three 7s', () => {
  const state = makeState({
    players: {
      p1: makePlayer('p1', { level: 2 }),
      p2: makePlayer('p2', { currentNodeId: 'bank' }),
    },
  });
  const next = withRandom(0, () => applyAction(state, { type: 'ARCADE_PLAY', game: 'slots' }));
  assert.equal(next.players.p1.cash, 1000 + 1000); // 500 x level 2
  assert.deepEqual(next.arcadeResult?.reels, ['7️⃣', '7️⃣', '7️⃣']);
  assert.equal(next.arcadeResult?.prize.kind, 'cash');
  assert.equal(next.currentPhase, 'SPACE_ACTION');
});

test('one game per casino visit: second play and wagers are blocked', () => {
  const state = makeState();
  const played = withRandom(0, () => applyAction(state, { type: 'ARCADE_PLAY', game: 'slots' }));
  assert.throws(
    () => applyAction(played, { type: 'ARCADE_PLAY', game: 'memory', pick: 0 }),
    /one game per casino stop/
  );
  assert.throws(
    () => applyAction(played, { type: 'CASINO_BET', game: 'derby', wager: 100, choice: '0' }),
    /one game per casino stop/
  );
  // END_TURN works and clears the result
  const done = applyAction(played, { type: 'END_TURN' });
  assert.equal(done.arcadeResult ?? null, null);
  assert.equal(done.currentPlayerId, 'p2');
});

test('ARCADE_PLAY requires a casino node', () => {
  const state = makeState({
    players: {
      p1: makePlayer('p1', { currentNodeId: 'bank' }),
      p2: makePlayer('p2', { currentNodeId: 'bank' }),
    },
  });
  assert.throws(
    () => applyAction(state, { type: 'ARCADE_PLAY', game: 'slots' }),
    /requires a casino node/
  );
});

// ─── Memory Block ─────────────────────────────────────────────────────────────

test('memory pays the coin prize (10G x level) and records the picked box', () => {
  const state = makeState({
    players: {
      p1: makePlayer('p1', { level: 3 }),
      p2: makePlayer('p2', { currentNodeId: 'bank' }),
    },
  });
  const next = withRandom(0, () => applyAction(state, { type: 'ARCADE_PLAY', game: 'memory', pick: 4 }));
  assert.equal(next.players.p1.cash, 1000 + 30);
  assert.equal(next.arcadeResult?.pickIndex, 4);
});

test('memory rejects an out-of-range pick', () => {
  const state = makeState();
  assert.throws(
    () => applyAction(state, { type: 'ARCADE_PLAY', game: 'memory', pick: 9 }),
    /pick must be 0-8/i
  );
});

// ─── Dart of Gold ─────────────────────────────────────────────────────────────

test('darts lands on a random player and applies the prize immediately', () => {
  const state = makeState({
    players: {
      p1: makePlayer('p1', { level: 2 }),
      p2: makePlayer('p2', { currentNodeId: 'bank' }),
    },
  });
  // Math.random()=0 → wedge 0 = treasure chest (100G x level), target = alive[0] = p1
  const thrown = withRandom(0, () => applyAction(state, { type: 'ARCADE_PLAY', game: 'darts' }));
  assert.equal(thrown.arcadeResult?.targetPlayerId, 'p1');
  assert.equal(thrown.players.p1.cash, 1000 + 200);
  assert.equal(thrown.players.p2.cash, 1000);
  // No pending step: END_TURN works straight away
  const done = applyAction(thrown, { type: 'END_TURN' });
  assert.equal(done.currentPlayerId, 'p2');
});

test('darts penalty can land on another player and hits their shops', () => {
  const state = makeState({
    players: {
      p1: makePlayer('p1'),
      p2: makePlayer('p2', { currentNodeId: 'bank', propertyIds: ['shop1'] }),
    },
    properties: { shop1: makeProp('shop1', { ownerId: 'p2' }) },
  });
  // Math.random()=0.7 → wedge floor(5.6)=5 = shops_down, target = alive[floor(1.4)] = p2
  const thrown = withRandom(0.7, () => applyAction(state, { type: 'ARCADE_PLAY', game: 'darts' }));
  assert.equal(thrown.arcadeResult?.prize.kind, 'shops_down');
  assert.equal(thrown.arcadeResult?.targetPlayerId, 'p2');
  assert.equal(thrown.properties.shop1.basePrice, 95); // 100 - 5%
});

test('darts never lands on a bankrupt player', () => {
  const state = makeState({
    players: {
      p1: makePlayer('p1'),
      p2: makePlayer('p2', { currentNodeId: 'bank', isBankrupt: true }),
    },
  });
  // target index 0.7 would be p2 among [p1, p2], but bankrupt players are excluded
  const thrown = withRandom(0.7, () => applyAction(state, { type: 'ARCADE_PLAY', game: 'darts' }));
  assert.equal(thrown.arcadeResult?.targetPlayerId, 'p1');
});

// ─── Bot behaviour ────────────────────────────────────────────────────────────

test('bot plays a free arcade game at the casino', () => {
  const state = makeState();
  const action = greedyBotAction(state, 'p1');
  assert.equal(action.type, 'ARCADE_PLAY');
  // Whatever it picked must be legal
  const next = withRandom(0.5, () => applyAction(state, action));
  assert.ok(next.arcadeResult);
});

test('bot ends its visit after an arcade result is shown', () => {
  const state = makeState({
    arcadeResult: { playerId: 'p1', game: 'darts', prize: { kind: 'cash', amount: 100 }, targetPlayerId: 'p1' },
  });
  assert.deepEqual(greedyBotAction(state, 'p1'), { type: 'END_TURN' });
});
