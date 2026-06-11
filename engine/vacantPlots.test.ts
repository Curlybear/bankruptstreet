import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from './stateMachine.js';
import type { GameState, Player, Property, District, Node } from '../shared/types.js';

function makePlayer(id: string, overrides: Partial<Player> = {}): Player {
  return {
    id,
    name: `Player ${id}`,
    cash: 2000,
    netWorth: 2000,
    currentNodeId: 'bank',
    level: 1,
    suits: { heart: false, diamond: false, club: false, spade: false },
    propertyIds: [],
    isBankrupt: false,
    ...overrides,
  };
}

const defaultBoard: Record<string, Node> = {
  bank: { id: 'bank', type: 'bank', neighbors: ['plot1'], coordinates: { x: 0, y: 0 } },
  plot1: { id: 'plot1', type: 'vacant', neighbors: ['shop1'], coordinates: { x: 1, y: 0 } },
  shop1: { id: 'shop1', type: 'property', neighbors: ['bank'], coordinates: { x: 2, y: 0 } },
};

function makeState(overrides: Partial<GameState> = {}): GameState {
  const d1: District = {
    id: 'd1',
    name: 'District 1',
    stockPrice: 10,
    propertyIds: ['plot1', 'shop1'],
    playerHoldings: {},
  };

  const plotProp: Property = {
    id: 'plot1',
    nodeId: 'plot1',
    districtId: 'd1',
    ownerId: null,
    basePrice: 200,
    currentPrice: 200,
    baseRent: 0,
    currentRent: 0,
    capitalInvested: 0,
    maxCapital: 0,
    shopMultiplier: 1,
    buildingType: 'vacant',
    checkpointToll: 200,
    circusLevel: 0,
  };

  const shopProp: Property = {
    id: 'shop1',
    nodeId: 'shop1',
    districtId: 'd1',
    ownerId: null,
    basePrice: 150,
    currentPrice: 150,
    baseRent: 12,
    currentRent: 12,
    capitalInvested: 0,
    maxCapital: 300,
    shopMultiplier: 1,
  };

  return {
    roomId: 'test',
    players: { p1: makePlayer('p1'), p2: makePlayer('p2') },
    turnOrder: ['p1', 'p2'],
    currentPlayerId: 'p1',
    currentPhase: 'PRE_ROLL',
    board: defaultBoard,
    properties: { plot1: plotProp, shop1: shopProp },
    districts: { d1 },
    round: 1,
    targetNetWorth: 10000,
    winnerId: null,
    bankruptCount: 0,
    log: [],
    ...overrides,
  };
}

// ─── Test 1: BUILD_PLOT on unowned vacant plot ───────────────────────────────
test('BUILD_PLOT successfully purchases and develops vacant plot', () => {
  const state = makeState({
    currentPhase: 'SPACE_ACTION',
    players: {
      p1: makePlayer('p1', { currentNodeId: 'plot1', cash: 2000, netWorth: 2000 }),
      p2: makePlayer('p2'),
    },
  });

  // Build a checkpoint (toll booth) for 200G
  const next = applyAction(state, { type: 'BUILD_PLOT', propertyId: 'plot1', buildingType: 'checkpoint' });

  assert.equal(next.properties.plot1.ownerId, 'p1');
  assert.equal(next.properties.plot1.buildingType, 'checkpoint');
  assert.equal(next.properties.plot1.checkpointToll, 50);   // tolls start small (+10/pass, cap 250)
  assert.equal(next.properties.plot1.currentRent, 50);
  assert.equal(next.properties.plot1.currentPrice, 200);
  
  // Cash deducted (2000 - 200 = 1800G)
  assert.equal(next.players.p1.cash, 1800);
  // Net worth conserved (200G asset + 1800G cash = 2000G)
  assert.equal(next.players.p1.netWorth, 2000);
});

// ─── Test 2: RENOVATE_PLOT during PRE_ROLL ───────────────────────────────────
test('RENOVATE_PLOT renovates owned plot with surcharge', () => {
  const state = makeState({
    currentPhase: 'PRE_ROLL',
    players: {
      p1: makePlayer('p1', { currentNodeId: 'bank', cash: 2000, netWorth: 2000, propertyIds: ['plot1'] }),
      p2: makePlayer('p2'),
    },
    properties: {
      ...makeState().properties,
      plot1: {
        ...makeState().properties.plot1,
        ownerId: 'p1',
        buildingType: 'checkpoint',
        basePrice: 200,
        currentPrice: 200,
        checkpointToll: 200,
      },
    },
  });

  // Renovate checkpoint to circus. Cost: 200G build + 150G surcharge = 350G
  const next = applyAction(state, { type: 'RENOVATE_PLOT', propertyId: 'plot1', buildingType: 'circus' });

  assert.equal(next.properties.plot1.buildingType, 'circus');
  assert.equal(next.properties.plot1.circusLevel, 0);
  assert.equal(next.properties.plot1.currentRent, 25); // Circus rent = value/4 (tier 0: 100G value)
  assert.equal(next.properties.plot1.currentPrice, 100); // Circus tier 0 base price is 100G

  // Cash deducted: 2000 - 350 = 1650G
  assert.equal(next.players.p1.cash, 1650);
  // Net worth recalculated (1650G cash + 100G plot asset = 1750G)
  assert.equal(next.players.p1.netWorth, 1750);
});

// ─── Test 3: Opponent landing on Circus pays rent ────────────────────────────
test('Opponent pays rent on landing on Circus', () => {
  const state = makeState({
    currentPhase: 'SPACE_ACTION',
    currentPlayerId: 'p2',
    players: {
      p1: makePlayer('p1', { propertyIds: ['plot1'] }),
      p2: makePlayer('p2', { currentNodeId: 'plot1', cash: 1000 }),
    },
    properties: {
      ...makeState().properties,
      plot1: {
        ...makeState().properties.plot1,
        ownerId: 'p1',
        buildingType: 'circus',
        circusLevel: 0,
        currentRent: 100,
        currentPrice: 100,
      },
    },
  });

  const next = applyAction(state, { type: 'PAY_RENT', propertyId: 'plot1' });

  assert.equal(next.players.p2.cash, 900); // Rent paid
  assert.equal(next.players.p1.cash, 2100); // Rent received
});

// ─── Test 4: Circus upgrades / expansions via INVEST ─────────────────────────
test('Owned Circus expands level-by-level via INVEST', () => {
  const state = makeState({
    currentPhase: 'SPACE_ACTION',
    players: {
      p1: makePlayer('p1', { currentNodeId: 'plot1', cash: 2000, propertyIds: ['plot1'] }),
      p2: makePlayer('p2'),
    },
    properties: {
      ...makeState().properties,
      plot1: {
        ...makeState().properties.plot1,
        ownerId: 'p1',
        buildingType: 'circus',
        circusLevel: 0,
        currentRent: 100,
        currentPrice: 100,
      },
    },
  });

  // Level up Circus (lvl 0 -> 1 costs 400G)
  const next = applyAction(state, { type: 'INVEST', propertyId: 'plot1', amount: 400 });

  assert.equal(next.properties.plot1.circusLevel, 1);
  assert.equal(next.properties.plot1.currentRent, 125); // Circus rent = value/4 (tier 1: 500G value)
  assert.equal(next.properties.plot1.currentPrice, 500);
  assert.equal(next.players.p1.cash, 1600); // 2000 - 400
});

// ─── Test 5: Checkpoint remote investment ────────────────────────────────────
test('Checkpoint station owner can remotely invest in standard shops', () => {
  const state = makeState({
    currentPhase: 'SPACE_ACTION',
    players: {
      p1: makePlayer('p1', { currentNodeId: 'plot1', cash: 1000, propertyIds: ['plot1', 'shop1'] }),
      p2: makePlayer('p2'),
    },
    properties: {
      ...makeState().properties,
      plot1: {
        ...makeState().properties.plot1,
        ownerId: 'p1',
        buildingType: 'checkpoint',
        checkpointToll: 200,
      },
      shop1: {
        ...makeState().properties.shop1,
        ownerId: 'p1',
        capitalInvested: 0,
        maxCapital: 300,
      },
    },
  });

  // Standing on checkpoint, remotely invest 100G in shop1
  const next = applyAction(state, { type: 'INVEST', propertyId: 'shop1', amount: 100 });

  assert.equal(next.properties.shop1.capitalInvested, 100);
  assert.equal(next.players.p1.cash, 900); // 1000 - 100
});

// ─── Test 6: Checkpoint pass-through toll and increments ──────────────────────
test('Checkpoint charges pass-through toll on the fly', () => {
  // Let's verify that movement past a checkpoint calls processPathMovement and charges toll
  const state = makeState({
    currentPhase: 'PRE_ROLL',
    players: {
      p1: makePlayer('p1', { currentNodeId: 'bank', cash: 2000 }),
      p2: makePlayer('p2'),
    },
    properties: {
      ...makeState().properties,
      plot1: {
        ...makeState().properties.plot1,
        ownerId: 'p2',
        buildingType: 'checkpoint',
        checkpointToll: 200,
      },
    },
  });

  const originalRandom = Math.random;
  try {
    // Mock Math.random to return 0.2 (which yields a roll of exactly 2)
    Math.random = () => 0.2;

    const finalState = applyAction(state, { type: 'ROLL_DICE' });

    // Player p1 walked through p2's checkpoint at plot1 and landed on shop1
    assert.equal(finalState.players.p1.currentNodeId, 'shop1');
    assert.equal(finalState.players.p1.cash, 1800); // Paid 200G toll
    assert.equal(finalState.players.p2.cash, 2200); // Received 200G toll
    
    // Checkpoint toll increments by 10G
    assert.equal(finalState.properties.plot1.checkpointToll, 210);
  } finally {
    Math.random = originalRandom;
  }
});

// ─── Test 7: Balloonport owner teleportation ──────────────────────────────────
test('Balloonport owner can teleport to any node', () => {
  const state = makeState({
    currentPhase: 'SPACE_ACTION',
    players: {
      p1: makePlayer('p1', { currentNodeId: 'plot1', cash: 2000, propertyIds: ['plot1'] }),
      p2: makePlayer('p2'),
    },
    properties: {
      ...makeState().properties,
      plot1: {
        ...makeState().properties.plot1,
        ownerId: 'p1',
        buildingType: 'balloonport',
      },
    },
  });

  // Teleport to bank
  const next = applyAction(state, { type: 'TELEPORT', nodeId: 'bank' });

  assert.equal(next.players.p1.currentNodeId, 'bank');
  // Teleport resolves bank landing (collect salary ifsuits held, or enters SPACE_ACTION for Bank trading)
  assert.equal(next.currentPhase, 'SPACE_ACTION');
});

// ─── Test 8: Tax Office 10% opponent levy ────────────────────────────────────
test('Tax office levies 10% of visiting opponent net worth', () => {
  const state = makeState({
    currentPhase: 'SPACE_ACTION',
    currentPlayerId: 'p2',
    players: {
      p1: makePlayer('p1', { propertyIds: ['plot1'], cash: 1000 }),
      p2: makePlayer('p2', { currentNodeId: 'plot1', cash: 2000, netWorth: 2000 }),
    },
    properties: {
      ...makeState().properties,
      plot1: {
        ...makeState().properties.plot1,
        ownerId: 'p1',
        buildingType: 'tax_office',
      },
    },
  });

  const next = applyAction(state, { type: 'PAY_RENT', propertyId: 'plot1' });

  // 10% of 2000G net worth = 200G
  assert.equal(next.players.p2.cash, 1800);
  assert.equal(next.players.p1.cash, 1200);
});

// ─── Test 9: Home Congregation ───────────────────────────────────────────────
test('Landing on own Home congregates all other players', () => {
  const state = makeState({
    currentPhase: 'SPACE_ACTION',
    players: {
      p1: makePlayer('p1', { currentNodeId: 'plot1', propertyIds: ['plot1'] }),
      p2: makePlayer('p2', { currentNodeId: 'shop1' }),
    },
    properties: {
      ...makeState().properties,
      plot1: {
        ...makeState().properties.plot1,
        ownerId: 'p1',
        buildingType: 'home',
      },
    },
  });

  // Emulate landing on owned plot (which auto-triggers Home congregate in resolveSpace)
  // Let's call a mock roll/movement that ends on plot1 to trigger it
  const rolledState = makeState({
    currentPhase: 'PRE_ROLL',
    players: {
      p1: makePlayer('p1', { currentNodeId: 'bank', cash: 2000 }),
      p2: makePlayer('p2', { currentNodeId: 'shop1' }),
    },
    properties: {
      ...makeState().properties,
      plot1: {
        ...makeState().properties.plot1,
        ownerId: 'p1',
        buildingType: 'home',
      },
    },
  });

  // Force path to plot1
  const chooseState: GameState = {
    ...rolledState,
    currentPhase: 'CHOOSING_PATH',
    pendingDestinations: ['plot1'],
  };

  const next = applyAction(chooseState, { type: 'CHOOSE_PATH', nodeId: 'plot1' });

  // Owner p1 landed on Home at plot1. Other players (p2) must congregate to plot1
  assert.equal(next.players.p2.currentNodeId, 'plot1');
  assert.equal(next.players.p1.currentNodeId, 'plot1');
});

// ─── Test 10: Estate Agency remote purchase ──────────────────────────────────
test('Estate Agency owner can purchase unowned shop remotely', () => {
  const state = makeState({
    currentPhase: 'SPACE_ACTION',
    players: {
      p1: makePlayer('p1', { currentNodeId: 'plot1', cash: 2000, propertyIds: ['plot1'] }),
      p2: makePlayer('p2'),
    },
    properties: {
      ...makeState().properties,
      plot1: {
        ...makeState().properties.plot1,
        ownerId: 'p1',
        buildingType: 'estate_agency',
      },
      shop1: {
        ...makeState().properties.shop1,
        ownerId: null,
        currentPrice: 150,
      },
    },
  });

  // Standing on Estate Agency, remotely purchase shop1
  const next = applyAction(state, { type: 'BUY_PROPERTY', propertyId: 'shop1' });

  assert.equal(next.properties.shop1.ownerId, 'p1');
  assert.equal(next.players.p1.cash, 1850); // 2000 - 150
});
