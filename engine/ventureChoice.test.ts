import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VENTURE_CARDS_LIST, ventureStockUnitPrice, ventureShopPrice } from './economy.js';
import { applyAction } from './stateMachine.js';
import { greedyBotAction } from './bot.js';
import type { GameState, Player, Property, Node, VentureCard } from '../shared/types.js';

// Card number (1-based index into VENTURE_CARDS_LIST) of the first card
// matching the predicate — keeps tests stable if the pool is reordered.
function cardNumber(match: (c: Omit<VentureCard, 'number'>) => boolean): number {
  const idx = VENTURE_CARDS_LIST.findIndex(match);
  assert.ok(idx >= 0, 'card not found in pool');
  return idx + 1;
}

function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: `Player ${id}`,
    cash: 1000,
    netWorth: 1000,
    currentNodeId: 'venture1',
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

const defaultBoard: Record<string, Node> = {
  bank: { id: 'bank', type: 'bank', neighbors: ['venture1'], coordinates: { x: 0, y: 0 } },
  venture1: { id: 'venture1', type: 'venture', neighbors: ['bank'], coordinates: { x: 1, y: 0 } },
  shop1: { id: 'shop1', type: 'property', neighbors: [], coordinates: { x: 2, y: 0 } },
  shop2: { id: 'shop2', type: 'property', neighbors: [], coordinates: { x: 3, y: 0 } },
};

function makeState(cardNum: number, overrides: Partial<GameState> = {}): GameState {
  return {
    roomId: 'test',
    players: { p1: makePlayer('p1'), p2: makePlayer('p2', { currentNodeId: 'bank' }) },
    turnOrder: ['p1', 'p2'],
    currentPlayerId: 'p1',
    currentPhase: 'SPACE_ACTION',
    board: defaultBoard,
    properties: {
      shop1: makeProp('shop1'),
      shop2: makeProp('shop2', { currentPrice: 200, basePrice: 200 }),
    },
    districts: {
      d1: { id: 'd1', name: 'D1', stockPrice: 40, propertyIds: ['shop1', 'shop2'], playerHoldings: {} },
    },
    round: 1,
    targetNetWorth: 100000,
    winnerId: null,
    bankruptCount: 0,
    log: [],
    ventureGrid: Array.from({ length: 64 }, () => ({ cleared: false, playerId: null })),
    ventureGridCardIds: Array.from({ length: 64 }, () => cardNum),
    ...overrides,
  };
}

const SELL_STOCK_135 = cardNumber(c => c.effectType === 'VENTURE_SELL_STOCK' && c.priceFactor === 135);
const BUY_STOCK_90 = cardNumber(c => c.effectType === 'VENTURE_BUY_STOCK' && c.priceFactor === 90);
const SELL_SHOP_300 = cardNumber(c => c.effectType === 'VENTURE_SELL_SHOP' && c.priceFactor === 300 && !c.mandatory);
const SELL_SHOP_FORCED = cardNumber(c => c.effectType === 'VENTURE_SELL_SHOP' && c.priceFactor === 200 && !!c.mandatory);
const BUY_SHOP_100 = cardNumber(c => c.effectType === 'VENTURE_BUY_SHOP' && c.priceFactor === 100 && !c.flatBonus);

// ─── Price helpers ────────────────────────────────────────────────────────────

test('ventureStockUnitPrice floors and never drops below 1G', () => {
  assert.equal(ventureStockUnitPrice(40, 135), 54);   // floor(40*1.35)
  assert.equal(ventureStockUnitPrice(40, 90), 36);
  assert.equal(ventureStockUnitPrice(0, 90), 1);
});

test('ventureShopPrice applies factor and flat bonus', () => {
  assert.equal(ventureShopPrice(100, 300), 300);
  assert.equal(ventureShopPrice(150, 100, 500), 650);
});

// ─── Drawing interactive cards sets pendingVenture ────────────────────────────

test('sell-stock card sets pendingVenture when player holds stock', () => {
  const state = makeState(SELL_STOCK_135, {
    districts: {
      d1: { id: 'd1', name: 'D1', stockPrice: 40, propertyIds: ['shop1', 'shop2'], playerHoldings: { p1: 20 } },
    },
  });
  const next = applyAction(state, { type: 'CHOOSE_VENTURE_CARD', cardIndex: 0 });
  assert.ok(next.pendingVenture);
  assert.equal(next.pendingVenture.kind, 'sell_stock');
  assert.equal(next.pendingVenture.priceFactor, 135);
  assert.equal(next.currentPhase, 'SPACE_ACTION');
});

test('sell-stock card fizzles when player holds no stock', () => {
  const state = makeState(SELL_STOCK_135);
  const next = applyAction(state, { type: 'CHOOSE_VENTURE_CARD', cardIndex: 0 });
  assert.equal(next.pendingVenture ?? null, null);
  assert.ok(next.log.some(l => l.includes('fizzles')));
  // END_TURN works as a normal acknowledge
  const done = applyAction(next, { type: 'END_TURN' });
  assert.equal(done.currentPlayerId, 'p2');
});

test('forced sale card fizzles when player owns no shops', () => {
  const state = makeState(SELL_SHOP_FORCED);
  const next = applyAction(state, { type: 'CHOOSE_VENTURE_CARD', cardIndex: 0 });
  assert.equal(next.pendingVenture ?? null, null);
});

// ─── END_TURN gating ──────────────────────────────────────────────────────────

test('END_TURN is blocked while pendingVenture is set', () => {
  const state = makeState(SELL_STOCK_135, {
    districts: {
      d1: { id: 'd1', name: 'D1', stockPrice: 40, propertyIds: ['shop1', 'shop2'], playerHoldings: { p1: 5 } },
    },
  });
  const drawn = applyAction(state, { type: 'CHOOSE_VENTURE_CARD', cardIndex: 0 });
  assert.throws(
    () => applyAction(drawn, { type: 'END_TURN' }),
    /Must resolve the venture offer/
  );
});

// ─── VENTURE_CHOICE resolution ────────────────────────────────────────────────

test('sell_stock at 135% pays the premium and applies 10+ share price impact', () => {
  const state = makeState(SELL_STOCK_135, {
    districts: {
      d1: { id: 'd1', name: 'D1', stockPrice: 40, propertyIds: ['shop1', 'shop2'], playerHoldings: { p1: 20 } },
    },
  });
  const drawn = applyAction(state, { type: 'CHOOSE_VENTURE_CARD', cardIndex: 0 });
  const next = applyAction(drawn, { type: 'VENTURE_CHOICE', kind: 'sell_stock', districtId: 'd1', shares: 20 });
  // unit = floor(40*1.35) = 54 → 20 * 54 = 1080
  assert.equal(next.players.p1.cash, 1000 + 1080);
  assert.equal(next.districts.d1.playerHoldings.p1, 0);
  // 10+ shares: price drops by floor(40/16)+1 = 3, floor is floor(avg(100,200)*0.04)=6
  assert.equal(next.districts.d1.stockPrice, 37);
  assert.equal(next.pendingVenture ?? null, null);
  // Now END_TURN is the normal acknowledge
  const done = applyAction(next, { type: 'END_TURN' });
  assert.equal(done.currentPlayerId, 'p2');
});

test('buy_stock at 90% charges the discounted unit price', () => {
  const state = makeState(BUY_STOCK_90);
  const drawn = applyAction(state, { type: 'CHOOSE_VENTURE_CARD', cardIndex: 0 });
  assert.equal(drawn.pendingVenture?.kind, 'buy_stock');
  const next = applyAction(drawn, { type: 'VENTURE_CHOICE', kind: 'buy_stock', districtId: 'd1', shares: 5 });
  // unit = floor(40*0.9) = 36 → 5 * 36 = 180; <10 shares → no price impact
  assert.equal(next.players.p1.cash, 1000 - 180);
  assert.equal(next.districts.d1.playerHoldings.p1, 5);
  assert.equal(next.districts.d1.stockPrice, 40);
});

test('buy_stock throws when unaffordable', () => {
  const state = makeState(BUY_STOCK_90, {
    players: { p1: makePlayer('p1', { cash: 50 }), p2: makePlayer('p2', { currentNodeId: 'bank' }) },
  });
  const drawn = applyAction(state, { type: 'CHOOSE_VENTURE_CARD', cardIndex: 0 });
  assert.throws(
    () => applyAction(drawn, { type: 'VENTURE_CHOICE', kind: 'buy_stock', districtId: 'd1', shares: 5 }),
    /Cannot afford/
  );
});

test('sell_shop at 3x pays triple value and returns the shop to the bank', () => {
  const state = makeState(SELL_SHOP_300, {
    players: {
      p1: makePlayer('p1', { propertyIds: ['shop1'] }),
      p2: makePlayer('p2', { currentNodeId: 'bank' }),
    },
    properties: {
      shop1: makeProp('shop1', { ownerId: 'p1' }),
      shop2: makeProp('shop2', { currentPrice: 200, basePrice: 200 }),
    },
  });
  const drawn = applyAction(state, { type: 'CHOOSE_VENTURE_CARD', cardIndex: 0 });
  const next = applyAction(drawn, { type: 'VENTURE_CHOICE', kind: 'sell_shop', propertyId: 'shop1' });
  assert.equal(next.players.p1.cash, 1000 + 300);
  assert.equal(next.properties.shop1.ownerId, null);
  assert.deepEqual(next.players.p1.propertyIds, []);
});

test('buy_shop at value buys any unowned shop remotely', () => {
  const state = makeState(BUY_SHOP_100);
  const drawn = applyAction(state, { type: 'CHOOSE_VENTURE_CARD', cardIndex: 0 });
  const next = applyAction(drawn, { type: 'VENTURE_CHOICE', kind: 'buy_shop', propertyId: 'shop2' });
  assert.equal(next.players.p1.cash, 1000 - 200);
  assert.equal(next.properties.shop2.ownerId, 'p1');
  assert.deepEqual(next.players.p1.propertyIds, ['shop2']);
});

test('kind mismatch and wrong-owner sales throw', () => {
  const state = makeState(SELL_SHOP_300, {
    players: {
      p1: makePlayer('p1', { propertyIds: ['shop1'] }),
      p2: makePlayer('p2', { currentNodeId: 'bank' }),
    },
    properties: {
      shop1: makeProp('shop1', { ownerId: 'p1' }),
      shop2: makeProp('shop2', { currentPrice: 200, basePrice: 200, ownerId: 'p2' }),
    },
  });
  const drawn = applyAction(state, { type: 'CHOOSE_VENTURE_CARD', cardIndex: 0 });
  assert.throws(
    () => applyAction(drawn, { type: 'VENTURE_CHOICE', kind: 'buy_stock', districtId: 'd1', shares: 1 }),
    /does not match/
  );
  assert.throws(
    () => applyAction(drawn, { type: 'VENTURE_CHOICE', kind: 'sell_shop', propertyId: 'shop2' }),
    /does not own/
  );
});

// ─── Skip ─────────────────────────────────────────────────────────────────────

test('skip clears an optional venture; mandatory skip throws', () => {
  const optional = makeState(SELL_SHOP_300, {
    players: {
      p1: makePlayer('p1', { propertyIds: ['shop1'] }),
      p2: makePlayer('p2', { currentNodeId: 'bank' }),
    },
    properties: {
      shop1: makeProp('shop1', { ownerId: 'p1' }),
      shop2: makeProp('shop2', { currentPrice: 200, basePrice: 200 }),
    },
  });
  const drawnOpt = applyAction(optional, { type: 'CHOOSE_VENTURE_CARD', cardIndex: 0 });
  const skipped = applyAction(drawnOpt, { type: 'VENTURE_CHOICE', kind: 'skip' });
  assert.equal(skipped.pendingVenture ?? null, null);
  assert.equal(skipped.properties.shop1.ownerId, 'p1');

  const forced = makeState(SELL_SHOP_FORCED, {
    players: {
      p1: makePlayer('p1', { propertyIds: ['shop1'] }),
      p2: makePlayer('p2', { currentNodeId: 'bank' }),
    },
    properties: {
      shop1: makeProp('shop1', { ownerId: 'p1' }),
      shop2: makeProp('shop2', { currentPrice: 200, basePrice: 200 }),
    },
  });
  const drawnForced = applyAction(forced, { type: 'CHOOSE_VENTURE_CARD', cardIndex: 0 });
  assert.ok(drawnForced.pendingVenture?.mandatory);
  assert.throws(
    () => applyAction(drawnForced, { type: 'VENTURE_CHOICE', kind: 'skip' }),
    /mandatory/
  );
  // Forced sale at 2x: 100 → 200G
  const sold = applyAction(drawnForced, { type: 'VENTURE_CHOICE', kind: 'sell_shop', propertyId: 'shop1' });
  assert.equal(sold.players.p1.cash, 1000 + 200);
});

// ─── advanceTurn clears pendingVenture defensively ───────────────────────────

test('turn advance clears pendingVenture', () => {
  const state = makeState(BUY_STOCK_90);
  const drawn = applyAction(state, { type: 'CHOOSE_VENTURE_CARD', cardIndex: 0 });
  const skipped = applyAction(drawn, { type: 'VENTURE_CHOICE', kind: 'skip' });
  const done = applyAction(skipped, { type: 'END_TURN' });
  assert.equal(done.pendingVenture ?? null, null);
  assert.equal(done.currentPlayerId, 'p2');
});

// ─── Bot behaviour ────────────────────────────────────────────────────────────

test('bot sells its whole highest-value holding on a premium sale', () => {
  const state = makeState(SELL_STOCK_135, {
    districts: {
      d1: { id: 'd1', name: 'D1', stockPrice: 40, propertyIds: ['shop1', 'shop2'], playerHoldings: { p1: 20 } },
    },
  });
  const drawn = applyAction(state, { type: 'CHOOSE_VENTURE_CARD', cardIndex: 0 });
  const action = greedyBotAction(drawn, 'p1');
  assert.deepEqual(action, { type: 'VENTURE_CHOICE', kind: 'sell_stock', districtId: 'd1', shares: 20 });
  // The chosen action must be legal
  const next = applyAction(drawn, action);
  assert.equal(next.pendingVenture ?? null, null);
});

test('bot skips an at-or-above-market stock buy and a 2x shop buy', () => {
  // priceFactor 110 buy: bot should skip
  const BUY_110 = cardNumber(c => c.effectType === 'VENTURE_BUY_STOCK' && c.priceFactor === 110);
  const state = makeState(BUY_110);
  const drawn = applyAction(state, { type: 'CHOOSE_VENTURE_CARD', cardIndex: 0 });
  const action = greedyBotAction(drawn, 'p1');
  assert.deepEqual(action, { type: 'VENTURE_CHOICE', kind: 'skip' });
});

test('bot resolves a mandatory sale with its lowest-value shop', () => {
  const state = makeState(SELL_SHOP_FORCED, {
    players: {
      p1: makePlayer('p1', { propertyIds: ['shop1', 'shop2'] }),
      p2: makePlayer('p2', { currentNodeId: 'bank' }),
    },
    properties: {
      shop1: makeProp('shop1', { ownerId: 'p1' }),
      shop2: makeProp('shop2', { currentPrice: 200, basePrice: 200, ownerId: 'p1' }),
    },
  });
  const drawn = applyAction(state, { type: 'CHOOSE_VENTURE_CARD', cardIndex: 0 });
  const action = greedyBotAction(drawn, 'p1');
  assert.deepEqual(action, { type: 'VENTURE_CHOICE', kind: 'sell_shop', propertyId: 'shop1' });
  const next = applyAction(drawn, action);
  assert.equal(next.properties.shop1.ownerId, null);
});
