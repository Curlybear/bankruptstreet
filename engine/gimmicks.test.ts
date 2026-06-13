import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from './stateMachine.js';
import type { GameState, Player, Property, Node } from '../shared/types.js';

function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id, name: id, cash: 1000, netWorth: 1000,
    currentNodeId: 'start', level: 1,
    suits: { heart: false, diamond: false, club: false, spade: false },
    propertyIds: [], isBankrupt: false,
    ...overrides,
  };
}

function makeState(board: Record<string, Node>, overrides: Partial<GameState> = {}): GameState {
  return {
    roomId: 'test',
    players: { p1: makePlayer('p1'), p2: makePlayer('p2', { currentNodeId: 'p2home' }) },
    turnOrder: ['p1', 'p2'],
    currentPlayerId: 'p1',
    currentPhase: 'PRE_ROLL',
    board,
    properties: {},
    districts: {},
    round: 1, targetNetWorth: 100000, winnerId: null, bankruptCount: 0, log: [],
    ...overrides,
  };
}

const N = (id: string, type: Node['type'], neighbors: string[], extra: Partial<Node> = {}): Node =>
  ({ id, type, neighbors, coordinates: { x: 0, y: 0 }, ...extra });

// ─── Roll-on ──────────────────────────────────────────────────────────────────

test('roll-on square: landing returns the same player to PRE_ROLL for another roll', () => {
  const board: Record<string, Node> = {
    start: N('start', 'property', ['rollon']),
    rollon: N('rollon', 'roll_on', ['exit']),
    exit: N('exit', 'property', []),
  };
  const state = makeState(board, {
    players: { p1: makePlayer('p1', { forcedRoll: 1 }), p2: makePlayer('p2', { currentNodeId: 'p2home' }) },
  });
  const next = applyAction(state, { type: 'ROLL_DICE' });
  assert.equal(next.players.p1.currentNodeId, 'rollon');
  assert.equal(next.currentPlayerId, 'p1');         // same player, not advanced
  assert.equal(next.currentPhase, 'PRE_ROLL');      // rolls again
  assert.ok(next.log.some(l => l.includes('Roll-On')));
});

// ─── Backstreet ─────────────────────────────────────────────────────────────────

test('backstreet square: landing warps to the paired matching-letter alley', () => {
  const board: Record<string, Node> = {
    start: N('start', 'property', ['alleyA1']),
    alleyA1: N('alleyA1', 'backstreet', ['mid'], { backstreetGroup: 'A' }),
    mid: N('mid', 'property', ['alleyA2']),
    alleyA2: N('alleyA2', 'backstreet', ['far'], { backstreetGroup: 'A' }),
    far: N('far', 'property', []),
  };
  const state = makeState(board, {
    players: { p1: makePlayer('p1', { forcedRoll: 1 }), p2: makePlayer('p2', { currentNodeId: 'far' }) },
  });
  const next = applyAction(state, { type: 'ROLL_DICE' });
  assert.equal(next.players.p1.currentNodeId, 'alleyA2');   // warped to the pair
  assert.equal(next.currentPlayerId, 'p2');                 // turn advanced (dead landing)
  assert.ok(next.log.some(l => l.includes('BACKSTREET A')));
});

// ─── Cannon ─────────────────────────────────────────────────────────────────────

test('cannon square: blasts the player onto another player and resolves that square', () => {
  const board: Record<string, Node> = {
    start: N('start', 'property', ['cannon']),
    cannon: N('cannon', 'cannon', ['onward']),
    onward: N('onward', 'property', []),
    p2shop: N('p2shop', 'property', []),
  };
  const prop: Property = {
    id: 'p2shop', nodeId: 'p2shop', districtId: 'd1', ownerId: 'p2',
    basePrice: 100, currentPrice: 100, baseRent: 20, currentRent: 20,
    capitalInvested: 0, maxCapital: 200, shopMultiplier: 1,
  };
  const state = makeState(board, {
    players: {
      p1: makePlayer('p1', { forcedRoll: 1 }),
      p2: makePlayer('p2', { currentNodeId: 'p2shop', propertyIds: ['p2shop'] }),
    },
    properties: { p2shop: prop },
    districts: { d1: { id: 'd1', name: 'D1', stockPrice: 4, propertyIds: ['p2shop'], playerHoldings: {} } },
  });
  const next = applyAction(state, { type: 'ROLL_DICE' });
  assert.equal(next.players.p1.currentNodeId, 'p2shop');    // blasted onto p2
  assert.equal(next.currentPlayerId, 'p1');                 // must resolve the shop
  assert.equal(next.currentPhase, 'SPACE_ACTION');
  assert.ok(next.log.some(l => l.includes('CANNON')));
  // The opponent shop is now payable
  const pay = applyAction(next, { type: 'PAY_RENT', propertyId: 'p2shop' });
  assert.equal(pay.players.p1.cash, 1000 - 20);
});

test('cannon square: misfires when no other player is on a different square', () => {
  const board: Record<string, Node> = {
    start: N('start', 'property', ['cannon']),
    cannon: N('cannon', 'cannon', ['onward']),
    onward: N('onward', 'property', []),
  };
  const state = makeState(board, {
    players: {
      p1: makePlayer('p1', { forcedRoll: 1 }),
      p2: makePlayer('p2', { currentNodeId: 'cannon' }),  // same square → not a target
    },
  });
  const next = applyAction(state, { type: 'ROLL_DICE' });
  assert.equal(next.players.p1.currentNodeId, 'cannon');    // stays put
  assert.equal(next.currentPlayerId, 'p2');                 // turn advances
  assert.ok(next.log.some(l => l.includes('misfires')));
});

// ─── Change-of-suit ─────────────────────────────────────────────────────────────

test('change-of-suit square: grants the current suit and cycles to the next', () => {
  const board: Record<string, Node> = {
    start: N('start', 'property', ['cyc']),
    cyc: N('cyc', 'suit', ['exit'], { suit: 'heart', cycleSuit: true }),
    exit: N('exit', 'vacant', []),
  };
  const state = makeState(board, {
    players: { p1: makePlayer('p1', { forcedRoll: 2 }), p2: makePlayer('p2', { currentNodeId: 'p2home' }) },
  });
  const next = applyAction(state, { type: 'ROLL_DICE' });
  assert.equal(next.players.p1.suits.heart, true);          // collected the current suit
  assert.equal(next.board.cyc.suit, 'diamond');             // cycled for the next passer
  assert.ok(next.log.some(l => l.includes('change-of-suit')));
});

test('change-of-suit square: wraps spade back to heart', () => {
  const board: Record<string, Node> = {
    start: N('start', 'property', ['cyc']),
    cyc: N('cyc', 'suit', ['exit'], { suit: 'spade', cycleSuit: true }),
    exit: N('exit', 'vacant', []),
  };
  const state = makeState(board, {
    players: { p1: makePlayer('p1', { forcedRoll: 2 }), p2: makePlayer('p2', { currentNodeId: 'p2home' }) },
  });
  const next = applyAction(state, { type: 'ROLL_DICE' });
  assert.equal(next.players.p1.suits.spade, true);
  assert.equal(next.board.cyc.suit, 'heart');              // spade → heart wrap
});
