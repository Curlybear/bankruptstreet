import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  recalcStockPrice,
  recalcDistrictMultipliers,
  buyStock,
  sellStock,
  payRent,
  collectSalary,
  checkWinCondition,
  checkBankruptcy,
  buyoutProperty,
  BASE_SALARY,
  PROMO_BONUS_PER_LEVEL,
} from './economy.js';
import type { GameState, Player, Property, District, Node } from '../shared/types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    players: { p1: makePlayer('p1'), p2: makePlayer('p2') },
    turnOrder: ['p1', 'p2'],
    currentPlayerId: 'p1',
    currentPhase: 'PRE_ROLL',
    board: { bank: bankNode, other: otherNode },
    properties: {},
    districts: {},
    round: 1, targetNetWorth: 10000, winnerId: null, bankruptCount: 0, log: [],
    ...overrides,
  };
}

// ─── recalcStockPrice ─────────────────────────────────────────────────────────

test('recalcStockPrice: floor(avg currentPrice * 0.04)', () => {
  // avg(100, 200) = 150; floor(150 * 0.04) = floor(6) = 6
  const district = makeDistrict({ propertyIds: ['a', 'b'] });
  const properties = {
    a: makeProp('a', { currentPrice: 100 }),
    b: makeProp('b', { currentPrice: 200 }),
  };
  assert.equal(recalcStockPrice(district, properties), 6);
});

test('recalcStockPrice: updates when shop prices change', () => {
  const district = makeDistrict({ propertyIds: ['a', 'b'] });
  const before = {
    a: makeProp('a', { currentPrice: 100 }),
    b: makeProp('b', { currentPrice: 100 }),
  };
  const after = {
    a: makeProp('a', { currentPrice: 200 }),
    b: makeProp('b', { currentPrice: 200 }),
  };
  // floor(100 * 0.04) = 4 → floor(200 * 0.04) = 8
  assert.equal(recalcStockPrice(district, before), 4);
  assert.equal(recalcStockPrice(district, after), 8);
});

// ─── recalcDistrictMultipliers ────────────────────────────────────────────────

test('recalcDistrictMultipliers: 1 shop owned → multiplier 1', () => {
  const district = makeDistrict({ propertyIds: ['a', 'b', 'c', 'd'] });
  const properties = {
    a: makeProp('a', { ownerId: 'p1' }),
    b: makeProp('b'),
    c: makeProp('c'),
    d: makeProp('d'),
  };
  const updated = recalcDistrictMultipliers(district, properties, {});
  assert.equal(updated['a'].shopMultiplier, 1);
  assert.equal(updated['a'].currentPrice, 100); // basePrice * 1
});

test('recalcDistrictMultipliers: 2 shops owned → multiplier 2', () => {
  const district = makeDistrict({ propertyIds: ['a', 'b', 'c', 'd'] });
  const properties = {
    a: makeProp('a', { ownerId: 'p1' }),
    b: makeProp('b', { ownerId: 'p1' }),
    c: makeProp('c'),
    d: makeProp('d'),
  };
  const updated = recalcDistrictMultipliers(district, properties, {});
  assert.equal(updated['a'].shopMultiplier, 2);
  assert.equal(updated['b'].shopMultiplier, 2);
  assert.equal(updated['a'].currentPrice, 200); // basePrice * 2
  // Unowned shops stay at multiplier 1
  assert.equal(updated['c'].shopMultiplier, 1);
});

test('recalcDistrictMultipliers: full district (4/4) → multiplier 5', () => {
  const district = makeDistrict({ propertyIds: ['a', 'b', 'c', 'd'] });
  const properties = {
    a: makeProp('a', { ownerId: 'p1' }),
    b: makeProp('b', { ownerId: 'p1' }),
    c: makeProp('c', { ownerId: 'p1' }),
    d: makeProp('d', { ownerId: 'p1' }),
  };
  const updated = recalcDistrictMultipliers(district, properties, {});
  for (const id of ['a', 'b', 'c', 'd']) {
    assert.equal(updated[id].shopMultiplier, 5);
    assert.equal(updated[id].currentPrice, 500);
  }
});

// ─── buyStock ─────────────────────────────────────────────────────────────────

test('buyStock: fewer than 10 shares → no price change', () => {
  const district = makeDistrict({ stockPrice: 40, playerHoldings: {} });
  const state = makeState({ districts: { d1: district } });

  const next = buyStock(state, 'p1', 'd1', 5);

  assert.equal(next.districts.d1.stockPrice, 40); // unchanged
  assert.equal(next.players.p1.cash, 1000 - 5 * 40); // 800
  assert.equal(next.districts.d1.playerHoldings.p1, 5);
});

test('buyStock: 10+ shares → price increases by floor(price/16)+1', () => {
  // price=40: change = floor(40/16)+1 = 2+1 = 3 → new price = 43
  const district = makeDistrict({ stockPrice: 40, playerHoldings: {} });
  const state = makeState({ districts: { d1: district } });

  const next = buyStock(state, 'p1', 'd1', 10);

  assert.equal(next.districts.d1.stockPrice, 43);
  assert.equal(next.players.p1.cash, 1000 - 10 * 40); // 600
});

test('buyStock: throws when player cannot afford', () => {
  const district = makeDistrict({ stockPrice: 200, playerHoldings: {} });
  const state = makeState({ districts: { d1: district } });

  assert.throws(() => buyStock(state, 'p1', 'd1', 10), /afford/);
});

// ─── sellStock ────────────────────────────────────────────────────────────────

test('sellStock: fewer than 10 shares → no price change', () => {
  const district = makeDistrict({ stockPrice: 40, playerHoldings: { p1: 20 } });
  const state = makeState({ districts: { d1: district } });

  const next = sellStock(state, 'p1', 'd1', 5);

  assert.equal(next.districts.d1.stockPrice, 40);
  assert.equal(next.players.p1.cash, 1000 + 5 * 40); // 1200
});

test('sellStock: 10+ shares → price decreases, never below shop-value floor', () => {
  // District has 2 props at currentPrice 100 each → floor = floor(100 * 0.04) = 4
  // stockPrice = 40: change = floor(40/16)+1 = 3 → new = max(4, 37) = 37
  const district = makeDistrict({
    stockPrice: 40, propertyIds: ['prop1', 'prop2'],
    playerHoldings: { p1: 20 },
  });
  const properties = {
    prop1: makeProp('prop1', { currentPrice: 100 }),
    prop2: makeProp('prop2', { currentPrice: 100 }),
  };
  const state = makeState({ districts: { d1: district }, properties });

  const next = sellStock(state, 'p1', 'd1', 10);

  assert.equal(next.districts.d1.stockPrice, 37);
});

test('sellStock: price clamped to shop-value floor when delta would exceed it', () => {
  // floor = 4, stockPrice = 5: change = floor(5/16)+1 = 0+1 = 1 → new = max(4, 4) = 4
  const district = makeDistrict({
    stockPrice: 5, propertyIds: ['prop1', 'prop2'],
    playerHoldings: { p1: 20 },
  });
  const properties = {
    prop1: makeProp('prop1', { currentPrice: 100 }),
    prop2: makeProp('prop2', { currentPrice: 100 }),
  };
  const state = makeState({ districts: { d1: district }, properties });

  const next = sellStock(state, 'p1', 'd1', 10);

  // floor(100 * 0.04) = 4; max(4, 5-1) = max(4, 4) = 4
  assert.equal(next.districts.d1.stockPrice, 4);
});

// ─── payRent ─────────────────────────────────────────────────────────────────

test('payRent: renter pays full rent; commission is bank-funded on top', () => {
  // p1 is renter (lands on p2's shop), p3 holds shares
  // rent = 100; total shares = 20 (p3 holds 20) → commission = floor(100 * 0.10 * 20/20) = 10
  const prop = makeProp('shop', {
    nodeId: 'shop', ownerId: 'p2', currentRent: 100,
  });
  const district = makeDistrict({
    propertyIds: ['shop'], stockPrice: 40,
    playerHoldings: { p3: 20 },
  });
  const state = makeState({
    board: { bank: bankNode, shop: { id: 'shop', type: 'property', neighbors: [], coordinates: { x: 1, y: 0 } } },
    players: {
      p1: makePlayer('p1', { currentNodeId: 'shop' }),
      p2: makePlayer('p2'),
      p3: makePlayer('p3'),
    },
    properties: { shop: prop },
    districts: { d1: district },
  });

  const next = payRent(state, 'p1', 'shop');

  assert.equal(next.players.p1.cash, 1000 - 100);  // paid exactly 100
  assert.equal(next.players.p2.cash, 1000 + 100);  // received full rent
  assert.equal(next.players.p3.cash, 1000 + 10);   // bank-funded commission
});

test('payRent: owner also receives commission if they hold district shares', () => {
  // p1 rents from p2; p2 holds 5/20 shares → gets rent + commission
  // commission for p2 = floor(100 * 0.10 * 5/20) = floor(2.5) = 2
  const prop = makeProp('shop', { nodeId: 'shop', ownerId: 'p2', currentRent: 100 });
  const district = makeDistrict({
    propertyIds: ['shop'], stockPrice: 40,
    playerHoldings: { p2: 5, p3: 15 },
  });
  const state = makeState({
    board: { bank: bankNode, shop: { id: 'shop', type: 'property', neighbors: [], coordinates: { x: 1, y: 0 } } },
    players: {
      p1: makePlayer('p1', { currentNodeId: 'shop' }),
      p2: makePlayer('p2'),
      p3: makePlayer('p3'),
    },
    properties: { shop: prop },
    districts: { d1: district },
  });

  const next = payRent(state, 'p1', 'shop');

  assert.equal(next.players.p1.cash, 900);         // paid 100, nothing else
  assert.equal(next.players.p2.cash, 1102);        // 100 rent + 2 commission
  // p3: floor(100 * 0.10 * 15/20) = floor(7.5) = 7
  assert.equal(next.players.p3.cash, 1007);
});

// ─── collectSalary ────────────────────────────────────────────────────────────

test('collectSalary: correct formula, increments level, resets suits', () => {
  // level=1, no shops → salary = BASE_SALARY + 0 + 1*PROMO_BONUS = 100+50 = 150
  const state = makeState({
    players: {
      p1: makePlayer('p1', {
        currentNodeId: 'bank', level: 1,
        suits: { heart: true, diamond: true, club: true, spade: true },
      }),
    },
  });

  const next = collectSalary(state, 'p1');

  assert.equal(next.players.p1.cash, 1000 + BASE_SALARY + PROMO_BONUS_PER_LEVEL); // 1150
  assert.equal(next.players.p1.level, 2);
  assert.equal(next.players.p1.suits.heart, false);
  assert.equal(next.players.p1.suits.spade, false);
});

test('collectSalary: shop value included in salary', () => {
  // shop at currentPrice=200 → floor(200*0.10) = 20 added to salary
  // salary = 250 + 20 + 1*150 = 420
  const prop = makeProp('shop1', { currentPrice: 200 });
  const state = makeState({
    players: {
      p1: makePlayer('p1', {
        currentNodeId: 'bank', level: 1, propertyIds: ['shop1'],
        suits: { heart: true, diamond: true, club: true, spade: true },
      }),
    },
    properties: { shop1: prop },
  });

  const next = collectSalary(state, 'p1');

  assert.equal(next.players.p1.cash, 1000 + 420);
});

test('collectSalary: throws if missing a suit', () => {
  const state = makeState({
    players: {
      p1: makePlayer('p1', {
        currentNodeId: 'bank',
        suits: { heart: true, diamond: true, club: false, spade: true },
      }),
    },
  });
  assert.throws(() => collectSalary(state, 'p1'), /suit/i);
});

test('collectSalary: throws if not at bank node', () => {
  const state = makeState({
    players: {
      p1: makePlayer('p1', {
        currentNodeId: 'other',
        suits: { heart: true, diamond: true, club: true, spade: true },
      }),
    },
  });
  assert.throws(() => collectSalary(state, 'p1'), /bank/i);
});

// ─── checkWinCondition ───────────────────────────────────────────────────────

test('checkWinCondition: no win when net worth below target', () => {
  const state = makeState({
    players: { p1: makePlayer('p1', { currentNodeId: 'bank', netWorth: 5000 }) },
    targetNetWorth: 10000,
  });
  const next = checkWinCondition(state, 'p1');
  assert.equal(next.winnerId, null);
});

test('checkWinCondition: no win when at non-bank node despite sufficient net worth', () => {
  const state = makeState({
    players: { p1: makePlayer('p1', { currentNodeId: 'other', netWorth: 15000 }) },
    targetNetWorth: 10000,
  });
  const next = checkWinCondition(state, 'p1');
  assert.equal(next.winnerId, null);
});

test('checkWinCondition: win when net worth >= target AND at bank node', () => {
  const state = makeState({
    players: { p1: makePlayer('p1', { currentNodeId: 'bank', netWorth: 10000 }) },
    targetNetWorth: 10000,
  });
  const next = checkWinCondition(state, 'p1');
  assert.equal(next.winnerId, 'p1');
});

// ─── checkBankruptcy ─────────────────────────────────────────────────────────

test('checkBankruptcy: sells stock first to cover debt', () => {
  // p1 has -100 cash, holds 5 shares at price 20 → proceeds = 100 → cash = 0
  // 5 < 10 so no price impact; cash = 0 ≥ 0, survives
  const district = makeDistrict({ stockPrice: 20, playerHoldings: { p1: 5 } });
  const state = makeState({
    players: { p1: makePlayer('p1', { cash: -100, netWorth: 0 }) },
    districts: { d1: district },
  });

  const next = checkBankruptcy(state, 'p1');

  assert.equal(next.players.p1.isBankrupt, false);
  assert.ok(next.players.p1.cash >= 0);
  assert.equal(next.districts.d1.playerHoldings.p1, 0); // shares sold
});

test('checkBankruptcy: sells shops at 75% when stocks insufficient', () => {
  // p1 has -200 cash, no stocks, owns shop worth 400 → distress = 300 → cash = 100
  const prop = makeProp('shop1', { currentPrice: 400, ownerId: 'p1' });
  const district = makeDistrict({ propertyIds: ['shop1'], stockPrice: 4, playerHoldings: {} });
  const state = makeState({
    players: {
      p1: makePlayer('p1', { cash: -200, netWorth: 200, propertyIds: ['shop1'] }),
      p2: makePlayer('p2'),
    },
    properties: { shop1: prop },
    districts: { d1: district },
  });

  const next = checkBankruptcy(state, 'p1');

  assert.equal(next.players.p1.isBankrupt, false);
  assert.ok(next.players.p1.cash >= 0);
  assert.equal(next.properties.shop1.ownerId, null); // shop released
  assert.equal(next.players.p1.propertyIds.length, 0);
});

test('checkBankruptcy: marks bankrupt when net worth negative after full liquidation', () => {
  // p1 has -1000 cash, no stocks, owns shop worth 100 → distress = 75 → cash = -925
  // netWorth = -925 → bankrupt
  const prop = makeProp('shop1', { currentPrice: 100, ownerId: 'p1' });
  const district = makeDistrict({ propertyIds: ['shop1'], stockPrice: 4, playerHoldings: {} });
  const state = makeState({
    players: {
      p1: makePlayer('p1', { cash: -1000, netWorth: -900, propertyIds: ['shop1'] }),
      p2: makePlayer('p2'),
    },
    properties: { shop1: prop },
    districts: { d1: district },
  });

  const next = checkBankruptcy(state, 'p1');

  assert.equal(next.players.p1.isBankrupt, true);
  assert.equal(next.bankruptCount, 1);
});

// ─── buyoutProperty ──────────────────────────────────────────────────────────

test('buyoutProperty: successful buyout deducts 5x cash from buyer, pays 3x cash to seller, and shifts ownership', () => {
  const prop = makeProp('shop1', { currentPrice: 100, ownerId: 'p2' });
  const district = makeDistrict({ propertyIds: ['shop1'], stockPrice: 4, playerHoldings: {} });
  const state = makeState({
    players: {
      p1: makePlayer('p1', { cash: 1000, propertyIds: [] }),
      p2: makePlayer('p2', { cash: 1000, propertyIds: ['shop1'] }),
    },
    properties: { shop1: prop },
    districts: { d1: district },
  });

  const next = buyoutProperty(state, 'p1', 'shop1');

  assert.equal(next.players.p1.cash, 500);
  assert.equal(next.players.p2.cash, 1300);
  assert.equal(next.properties.shop1.ownerId, 'p1');
  assert.deepEqual(next.players.p1.propertyIds, ['shop1']);
  assert.deepEqual(next.players.p2.propertyIds, []);
});

test('buyoutProperty: throws when buyer cannot afford 5x cost', () => {
  const prop = makeProp('shop1', { currentPrice: 200, ownerId: 'p2' });
  const district = makeDistrict({ propertyIds: ['shop1'], stockPrice: 8, playerHoldings: {} });
  const state = makeState({
    players: {
      p1: makePlayer('p1', { cash: 500, propertyIds: [] }),
      p2: makePlayer('p2', { cash: 1000, propertyIds: ['shop1'] }),
    },
    properties: { shop1: prop },
    districts: { d1: district },
  });

  assert.throws(() => buyoutProperty(state, 'p1', 'shop1'), /Cannot afford buyout/);
});

test('buyoutProperty: throws when property is unowned or owned by buyer', () => {
  const prop = makeProp('shop1', { currentPrice: 100, ownerId: null });
  const district = makeDistrict({ propertyIds: ['shop1'], stockPrice: 4, playerHoldings: {} });
  const state = makeState({
    players: {
      p1: makePlayer('p1', { cash: 1000, propertyIds: [] }),
    },
    properties: { shop1: prop },
    districts: { d1: district },
  });

  assert.throws(() => buyoutProperty(state, 'p1', 'shop1'), /unowned/);

  const propSelf = makeProp('shop1', { currentPrice: 100, ownerId: 'p1' });
  const stateSelf = makeState({
    players: {
      p1: makePlayer('p1', { cash: 1000, propertyIds: ['shop1'] }),
    },
    properties: { shop1: propSelf },
    districts: { d1: district },
  });

  assert.throws(() => buyoutProperty(stateSelf, 'p1', 'shop1'), /Cannot buyout own property/);
});

test('checkBankruptcy: ends game and chooses correct winner with turnOrder tiebreaker', () => {
  // p1 goes bankrupt
  // p2 has 2000 net worth
  // p3 has 2000 net worth
  // turnOrder is ['p1', 'p2', 'p3']. p3 goes later than p2, so p3 wins!
  const state = makeState({
    turnOrder: ['p1', 'p2', 'p3'],
    players: {
      p1: makePlayer('p1', { cash: -1000, netWorth: -500, propertyIds: [] }),
      p2: makePlayer('p2', { cash: 2000, netWorth: 2000, propertyIds: [] }),
      p3: makePlayer('p3', { cash: 2000, netWorth: 2000, propertyIds: [] }),
    },
  });

  const next = checkBankruptcy(state, 'p1');

  assert.equal(next.players.p1.isBankrupt, true);
  assert.equal(next.winnerId, 'p3'); // p3 wins due to turnOrder index tiebreaker (index 2 > index 1)
});

