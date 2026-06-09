import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  payRent,
  buyStock,
  buyProperty,
  buyoutProperty,
  resolveVentureCard,
} from './economy.js';
import type { GameState, Player, Property, District, Node } from '../shared/types.js';

// Helpers
function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id, name: id, cash: 1000, netWorth: 1000,
    currentNodeId: 'bank', level: 1,
    suits: { heart: false, diamond: false, club: false, spade: false },
    propertyIds: [], isBankrupt: false,
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

function makeDistrict(overrides: Partial<District> = {}): District {
  return {
    id: 'd1', name: 'D1', stockPrice: 40, propertyIds: ['prop1', 'prop2'],
    playerHoldings: {},
    ...overrides,
  };
}

const bankNode: Node = { id: 'bank', type: 'bank', neighbors: [], coordinates: { x: 0, y: 0 } };
const otherNode: Node = { id: 'other', type: 'vacant', neighbors: [], coordinates: { x: 1, y: 0 } };

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    roomId: 'test',
    players: { p1: makePlayer('p1'), p2: makePlayer('p2'), p3: makePlayer('p3') },
    turnOrder: ['p1', 'p2', 'p3'],
    currentPlayerId: 'p1',
    currentPhase: 'PRE_ROLL',
    board: { bank: bankNode, other: otherNode },
    properties: {
      prop1: makeProp('prop1', { ownerId: 'p1', currentRent: 100 }),
      prop2: makeProp('prop2', { ownerId: 'p2', currentRent: 100 })
    },
    districts: {
      d1: makeDistrict({ propertyIds: ['prop1', 'prop2'] })
    },
    round: 1, targetNetWorth: 10000, winnerId: null, bankruptCount: 0, log: [],
    ...overrides,
  };
}

test('Take-a-break shut shops waive rent payments', () => {
  const state = makeState({
    players: {
      p1: makePlayer('p1', { shopsClosedUntilNextTurn: true, cash: 1000 }),
      p2: makePlayer('p2', { cash: 1000 })
    }
  });

  const nextState = payRent(state, 'p2', 'prop1');
  assert.equal(nextState.players.p2.cash, 1000); // no cash deducted
  assert.equal(nextState.players.p1.cash, 1000); // no cash received
  assert.ok(nextState.log.some(msg => msg.includes('temporarily closed')));
});

test('Price-halving temporarily reduces rent by 50%', () => {
  const state = makeState({
    players: {
      p1: makePlayer('p1', { shopPricesHalvedUntilNextTurn: true, cash: 1000 }),
      p2: makePlayer('p2', { cash: 1000 })
    }
  });

  const nextState = payRent(state, 'p2', 'prop1');
  assert.equal(nextState.players.p2.cash, 950); // paid halved rent (50)
  assert.equal(nextState.players.p1.cash, 1050); // received halved rent (50)
  assert.ok(nextState.log.some(msg => msg.includes('halved rent')));
});

test('Boon/Boom commission payout on rent payment', () => {
  const state = makeState({
    players: {
      p1: makePlayer('p1', { cash: 1000 }),
      p2: makePlayer('p2', { cash: 1000 }),
      p3: makePlayer('p3', { commissionUntilNextTurn: 50, cash: 1000 })
    }
  });

  const nextState = payRent(state, 'p2', 'prop1');
  assert.equal(nextState.players.p2.cash, 900); // paid 100
  assert.equal(nextState.players.p1.cash, 1100); // received 100
  assert.equal(nextState.players.p3.cash, 1050); // received 50% commission (50g) from bank
  assert.ok(nextState.log.some(msg => msg.includes('commission of 50G')));
});

test('Boon/Boom commission payout on property purchase', () => {
  const state = makeState({
    players: {
      p1: makePlayer('p1', { cash: 1000 }),
      p2: makePlayer('p2', { commissionUntilNextTurn: 50, cash: 1000 })
    },
    properties: {
      prop3: makeProp('prop3', { ownerId: null, currentPrice: 200 })
    }
  });

  const nextState = buyProperty(state, 'p1', 'prop3');
  assert.equal(nextState.players.p1.cash, 800); // paid 200
  assert.equal(nextState.players.p2.cash, 1100); // received 50% of 200 = 100 from bank
  assert.ok(nextState.log.some(msg => msg.includes('commission of 100G')));
});

test('Boon/Boom commission payout on property buyout', () => {
  const state = makeState({
    players: {
      p1: makePlayer('p1', { cash: 1000 }),
      p2: makePlayer('p2', { cash: 1000 }),
      p3: makePlayer('p3', { commissionUntilNextTurn: 50, cash: 1000 })
    }
  });

  const nextState = buyoutProperty(state, 'p1', 'prop2');
  assert.equal(nextState.players.p1.cash, 500); // paid 500
  assert.equal(nextState.players.p2.cash, 1500); // received full 5x buyout price
  assert.equal(nextState.players.p3.cash, 1250); // received 250 commission
  assert.ok(nextState.log.some(msg => msg.includes('commission of 250G')));
});

test('Boon/Boom commission payout on stock purchase', () => {
  const state = makeState({
    players: {
      p1: makePlayer('p1', { cash: 1000 }),
      p2: makePlayer('p2', { commissionUntilNextTurn: 50, cash: 1000 })
    }
  });

  const nextState = buyStock(state, 'p1', 'd1', 10); // cost = 10 * 40 = 400
  assert.equal(nextState.players.p1.cash, 600); // paid 400
  assert.equal(nextState.players.p2.cash, 1200); // received 50% of 400 = 200 commission
  assert.ok(nextState.log.some(msg => msg.includes('commission of 200G')));
});

test('resolveVentureCard resolves DICEY_CLOSED effect (odd roll: own closed)', () => {
  const state = makeState({
    ventureGrid: Array.from({ length: 64 }, () => ({ cleared: false, playerId: null })),
    ventureGridCardIds: Array.from({ length: 64 }, () => 22) // Card #22 is Dicey Adventure
  });

  // Mock Math.random to return a value that generates an odd roll (e.g. 1)
  const origRandom = Math.random;
  Math.random = () => 0.05;
  try {
    const nextState = resolveVentureCard(state, 'p1', 5);
    assert.equal(nextState.players.p1.shopsClosedUntilNextTurn, true);
    assert.notEqual(nextState.players.p2.shopsClosedUntilNextTurn, true);
    assert.notEqual(nextState.players.p3.shopsClosedUntilNextTurn, true);
  } finally {
    Math.random = origRandom;
  }
});

test('resolveVentureCard resolves DICEY_CLOSED effect (even roll: others closed)', () => {
  const state = makeState({
    ventureGrid: Array.from({ length: 64 }, () => ({ cleared: false, playerId: null })),
    ventureGridCardIds: Array.from({ length: 64 }, () => 22) // Card #22 is Dicey Adventure
  });

  // Mock Math.random to return a value that generates an even roll (e.g. 2)
  const origRandom = Math.random;
  Math.random = () => 0.2;
  try {
    const nextState = resolveVentureCard(state, 'p1', 5);
    assert.notEqual(nextState.players.p1.shopsClosedUntilNextTurn, true);
    assert.equal(nextState.players.p2.shopsClosedUntilNextTurn, true);
    assert.equal(nextState.players.p3.shopsClosedUntilNextTurn, true);
  } finally {
    Math.random = origRandom;
  }
});

test('resolveVentureCard resolves HALF_RENT_TEMP effect', () => {
  const state = makeState({
    ventureGrid: Array.from({ length: 64 }, () => ({ cleared: false, playerId: null })),
    ventureGridCardIds: Array.from({ length: 64 }, () => 23) // Card #23 is Half-Price Special
  });

  const nextState = resolveVentureCard(state, 'p1', 10);
  assert.equal(nextState.players.p1.shopPricesHalvedUntilNextTurn, true);
});

test('resolveVentureCard resolves COMMISSION_TEMP effect', () => {
  const state = makeState({
    ventureGrid: Array.from({ length: 64 }, () => ({ cleared: false, playerId: null })),
    ventureGridCardIds: Array.from({ length: 64 }, () => 24) // Card #24 is Big Commission
  });

  const nextState = resolveVentureCard(state, 'p1', 15);
  assert.equal(nextState.players.p1.commissionUntilNextTurn, 50);
});
