import { test } from 'node:test';
import assert from 'node:assert/strict';
import { greedyBotAction } from './bot.js';
import { CHARACTERS, CHARACTER_IDS } from '../shared/characters.js';
import { makePlayer, pickUnusedCharacter } from '../server/gameManager.js';
import type { GameState, Player, Node, Property, District } from '../shared/types.js';

function makeTestPlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id, name: id, cash: 1000, netWorth: 1000,
    currentNodeId: 'bank', level: 1,
    suits: { heart: false, diamond: false, club: false, spade: false },
    propertyIds: [], isBankrupt: false,
    ...overrides,
  };
}

const board: Record<string, Node> = {
  bank: { id: 'bank', type: 'bank', neighbors: ['shop1'], coordinates: { x: 0, y: 0 } },
  shop1: { id: 'shop1', type: 'property', neighbors: ['bank'], coordinates: { x: 1, y: 0 } },
};

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    roomId: 'test',
    players: { p1: makeTestPlayer('p1'), p2: makeTestPlayer('p2') },
    turnOrder: ['p1', 'p2'],
    currentPlayerId: 'p1',
    currentPhase: 'SPACE_ACTION',
    board,
    properties: {},
    districts: {},
    round: 1, targetNetWorth: 10000, winnerId: null, bankruptCount: 0, log: [],
    ...overrides,
  };
}

const ownShop: Property = {
  id: 'shop1', nodeId: 'shop1', districtId: 'd1', ownerId: 'p1',
  basePrice: 100, currentPrice: 100, baseRent: 20, currentRent: 20,
  capitalInvested: 0, maxCapital: 2000, shopMultiplier: 1,
};
const district: District = { id: 'd1', name: 'D1', stockPrice: 10, propertyIds: ['shop1'], playerHoldings: {} };

test('cashReserve: slime (500) skips investing at 400 cash; erdrick (200) invests', () => {
  const base = makeState({
    properties: { shop1: ownShop },
    districts: { d1: district },
  });

  const slimeState: GameState = {
    ...base,
    players: { ...base.players, p1: makeTestPlayer('p1', { cash: 400, currentNodeId: 'shop1', propertyIds: ['shop1'], characterId: 'slime' }) },
  };
  assert.equal(greedyBotAction(slimeState, 'p1').type, 'END_TURN');

  const erdrickState: GameState = {
    ...base,
    players: { ...base.players, p1: makeTestPlayer('p1', { cash: 400, currentNodeId: 'shop1', propertyIds: ['shop1'], characterId: 'erdrick' }) },
  };
  const action = greedyBotAction(erdrickState, 'p1');
  assert.equal(action.type, 'INVEST');
});

test('investAmount: dragonlord invests 300, erdrick 100', () => {
  const base = makeState({
    properties: { shop1: ownShop },
    districts: { d1: district },
  });

  for (const [charId, expected] of [['dragonlord', 300], ['erdrick', 100]] as const) {
    const s: GameState = {
      ...base,
      players: { ...base.players, p1: makeTestPlayer('p1', { cash: 2000, currentNodeId: 'shop1', propertyIds: ['shop1'], characterId: charId }) },
    };
    const action = greedyBotAction(s, 'p1');
    assert.equal(action.type, 'INVEST');
    assert.equal((action as { amount: number }).amount, expected, `${charId} invest amount`);
  }
});

test('stock buying: one aggregated buy down to the reserve; stockBatch is the minimum position', () => {
  const shop: Property = { ...ownShop, nodeId: 'shop1' };
  const base = makeState({
    properties: { shop1: shop },
    districts: { d1: district },
  });
  const at = (charId: string, cash: number): GameState => ({
    ...base,
    players: { ...base.players, p1: makeTestPlayer('p1', { cash, currentNodeId: 'bank', propertyIds: ['shop1'], characterId: charId }) },
  });

  // gwaelin (reserve 300): 2000 cash at 10G/sh → 170 affordable, one buy capped at 99
  const big = greedyBotAction(at('gwaelin', 2000), 'p1');
  assert.equal(big.type, 'BUY_STOCK');
  assert.equal((big as { shares: number }).shares, 99);

  // gwaelin (batch 20): only 19 affordable above the reserve → not worth opening
  assert.equal(greedyBotAction(at('gwaelin', 490), 'p1').type, 'END_TURN');

  // slime (reserve 500, batch 5): 6 affordable → buys all 6 in one transaction
  const small = greedyBotAction(at('slime', 560), 'p1');
  assert.equal(small.type, 'BUY_STOCK');
  assert.equal((small as { shares: number }).shares, 6);
});

test('buyoutCashMultiplier: dragonlord (1.5x) buys out where slime (4x) pays rent', () => {
  const oppShop: Property = { ...ownShop, ownerId: 'p2' };
  const base = makeState({
    properties: { shop1: oppShop },
    districts: { d1: district },
    players: {
      p1: makeTestPlayer('p1'),
      p2: makeTestPlayer('p2', { propertyIds: ['shop1'] }),
    },
  });

  // buyoutCost = 500; cash 1000 → 2.0× cost: above dragonlord's 1.5, below slime's 4.0
  const dragonState: GameState = {
    ...base,
    players: { ...base.players, p1: makeTestPlayer('p1', { cash: 1000, currentNodeId: 'shop1', characterId: 'dragonlord' }) },
  };
  assert.equal(greedyBotAction(dragonState, 'p1').type, 'BUYOUT_PROPERTY');

  const slimeState: GameState = {
    ...base,
    players: { ...base.players, p1: makeTestPlayer('p1', { cash: 1000, currentNodeId: 'shop1', characterId: 'slime' }) },
  };
  assert.equal(greedyBotAction(slimeState, 'p1').type, 'PAY_RENT');
});

test('unknown/missing characterId falls back to default personality', () => {
  const base = makeState({
    properties: { shop1: ownShop },
    districts: { d1: district },
    players: {
      p1: makeTestPlayer('p1', { cash: 2000, currentNodeId: 'shop1', propertyIds: ['shop1'], characterId: 'not-a-character' }),
      p2: makeTestPlayer('p2'),
    },
  });
  const action = greedyBotAction(base, 'p1');
  assert.equal(action.type, 'INVEST');
  assert.equal((action as { amount: number }).amount, 100);  // DEFAULT_PERSONALITY
});

test('makePlayer assigns character names; pickUnusedCharacter avoids collisions', () => {
  const bot = makePlayer('bot1', 'dragonlord');
  assert.equal(bot.name, '🐉 Dragonlord');
  assert.equal(bot.characterId, 'dragonlord');

  const human = makePlayer('alice', 'slime');
  assert.equal(human.name, '🟢 alice');   // humans keep their own name

  const plain = makePlayer('bob');
  assert.equal(plain.name, 'bob');
  assert.equal(plain.characterId, undefined);

  // Assignment skips taken characters
  const state = {
    players: {
      alice: makePlayer('alice', CHARACTER_IDS[0]),
      bot1: makePlayer('bot1', CHARACTER_IDS[1]),
    },
  } as unknown as GameState;
  const picked = pickUnusedCharacter(state);
  assert.ok(![CHARACTER_IDS[0], CHARACTER_IDS[1]].includes(picked));
  assert.ok(CHARACTERS[picked]);
});
