import { applyAction } from '../engine/stateMachine.js';
import { seedVentureGridCardIds } from '../engine/economy.js';
import { getPath } from '../engine/navigation.js';
import type { GameState, Action, Node, Property, District, Player } from '../shared/types.js';

export function makePlayer(id: string): Player {
  let name = id;
  if (id === 'bot1') name = '🛡️ Dragonlord';
  else if (id === 'bot2') name = '🧙 Princess Gwaelin';
  else if (id === 'bot3') name = '⚔️ Erdrick';

  return {
    id, name,
    cash: 1500, netWorth: 1500,
    currentNodeId: 'bank',
    level: 1,
    suits: { heart: false, diamond: false, club: false, spade: false },
    propertyIds: [],
    isBankrupt: false,
  };
}

const DEFAULT_BOARD: Record<string, Node> = {
  // --- Bank (Radatome/Tantegel Castle) ---
  bank: { id: 'bank', type: 'bank', neighbors: ['tantegel_1'], coordinates: { x: 0, y: 2 } },

  // --- Tantegel Area ---
  tantegel_1: { id: 'tantegel_1', type: 'property', neighbors: ['tantegel_2'], coordinates: { x: 1, y: 2 } },
  tantegel_2: { id: 'tantegel_2', type: 'vacant', neighbors: ['heart_suit'], coordinates: { x: 2, y: 2 } },
  heart_suit: { id: 'heart_suit', type: 'suit', suit: 'heart', neighbors: ['garinham_1', 'domdora_7'], coordinates: { x: 3, y: 2 } },

  // --- Garinham Area (Northwest) ---
  garinham_1: { id: 'garinham_1', type: 'property', neighbors: ['garinham_2'], coordinates: { x: 3, y: 1 } },
  garinham_2: { id: 'garinham_2', type: 'property', neighbors: ['garinham_3'], coordinates: { x: 2, y: 1 } },
  garinham_3: { id: 'garinham_3', type: 'property', neighbors: ['garinham_4'], coordinates: { x: 1, y: 1 } },
  garinham_4: { id: 'garinham_4', type: 'property', neighbors: ['spade_suit'], coordinates: { x: 0, y: 1 } },
  spade_suit: { id: 'spade_suit', type: 'suit', suit: 'spade', neighbors: ['garinham_5'], coordinates: { x: 0, y: 0 } },
  garinham_5: { id: 'garinham_5', type: 'property', neighbors: ['garinham_6'], coordinates: { x: 1, y: 0 } },
  garinham_6: { id: 'garinham_6', type: 'property', neighbors: ['bridge_north_1', 'warp_to_charlock_1'], coordinates: { x: 2, y: 0 } },

  // --- Warp north ---
  warp_to_charlock_1: { id: 'warp_to_charlock_1', type: 'warp', pairedNodeId: 'charlock_warp_in_1', neighbors: [], coordinates: { x: 3, y: 0 } },

  // --- North Bridge ---
  bridge_north_1: { id: 'bridge_north_1', type: 'property', neighbors: ['venture_north'], coordinates: { x: 4, y: 0 } },
  venture_north: { id: 'venture_north', type: 'venture', neighbors: ['bridge_north_2'], coordinates: { x: 5, y: 0 } },
  bridge_north_2: { id: 'bridge_north_2', type: 'property', neighbors: ['kol_1'], coordinates: { x: 6, y: 0 } },

  // --- Kol Area (Northeast) ---
  kol_1: { id: 'kol_1', type: 'property', neighbors: ['kol_2'], coordinates: { x: 7, y: 0 } },
  kol_2: { id: 'kol_2', type: 'property', neighbors: ['diamond_suit'], coordinates: { x: 8, y: 0 } },
  diamond_suit: { id: 'diamond_suit', type: 'suit', suit: 'diamond', neighbors: ['kol_3'], coordinates: { x: 10, y: 0 } },
  kol_3: { id: 'kol_3', type: 'vacant', neighbors: ['kol_4'], coordinates: { x: 10, y: 1 } },
  kol_4: { id: 'kol_4', type: 'property', neighbors: ['kol_5'], coordinates: { x: 9, y: 1 } },
  kol_5: { id: 'kol_5', type: 'property', neighbors: ['stockbroker_east'], coordinates: { x: 8, y: 1 } },
  stockbroker_east: { id: 'stockbroker_east', type: 'stockbroker', neighbors: ['cantlin_1'], coordinates: { x: 7, y: 1 } },

  // --- Cantlin Area (East / Center Transition) ---
  cantlin_1: { id: 'cantlin_1', type: 'property', neighbors: ['cantlin_2'], coordinates: { x: 7, y: 2 } },
  cantlin_2: { id: 'cantlin_2', type: 'property', neighbors: ['cantlin_3'], coordinates: { x: 8, y: 2 } },
  cantlin_3: { id: 'cantlin_3', type: 'property', neighbors: ['rimuldar_1'], coordinates: { x: 9, y: 2 } },

  // --- Rimuldar Area (Southeast) ---
  rimuldar_1: { id: 'rimuldar_1', type: 'property', neighbors: ['rimuldar_2'], coordinates: { x: 10, y: 2 } },
  rimuldar_2: { id: 'rimuldar_2', type: 'property', neighbors: ['club_suit'], coordinates: { x: 10, y: 3 } },
  club_suit: { id: 'club_suit', type: 'suit', suit: 'club', neighbors: ['rimuldar_3'], coordinates: { x: 10, y: 4 } },
  rimuldar_3: { id: 'rimuldar_3', type: 'vacant', neighbors: ['rimuldar_4'], coordinates: { x: 9, y: 4 } },
  rimuldar_4: { id: 'rimuldar_4', type: 'property', neighbors: ['rimuldar_5'], coordinates: { x: 9, y: 3 } },
  rimuldar_5: { id: 'rimuldar_5', type: 'property', neighbors: ['rimuldar_6'], coordinates: { x: 8, y: 3 } },
  rimuldar_6: { id: 'rimuldar_6', type: 'property', neighbors: ['bridge_south_2', 'warp_to_charlock_2'], coordinates: { x: 8, y: 4 } },

  // --- Warp south ---
  warp_to_charlock_2: { id: 'warp_to_charlock_2', type: 'warp', pairedNodeId: 'charlock_warp_in_2', neighbors: [], coordinates: { x: 7, y: 4 } },

  // --- South Bridge ---
  bridge_south_2: { id: 'bridge_south_2', type: 'property', neighbors: ['venture_south'], coordinates: { x: 6, y: 4 } },
  venture_south: { id: 'venture_south', type: 'venture', neighbors: ['bridge_south_1'], coordinates: { x: 5, y: 4 } },
  bridge_south_1: { id: 'bridge_south_1', type: 'property', neighbors: ['domdora_1'], coordinates: { x: 4, y: 4 } },

  // --- Domdora Area (Southwest) ---
  domdora_1: { id: 'domdora_1', type: 'property', neighbors: ['domdora_2'], coordinates: { x: 3, y: 4 } },
  domdora_2: { id: 'domdora_2', type: 'property', neighbors: ['domdora_3'], coordinates: { x: 2, y: 4 } },
  domdora_3: { id: 'domdora_3', type: 'vacant', neighbors: ['domdora_4'], coordinates: { x: 1, y: 4 } },
  domdora_4: { id: 'domdora_4', type: 'property', neighbors: ['domdora_5'], coordinates: { x: 0, y: 4 } },
  domdora_5: { id: 'domdora_5', type: 'property', neighbors: ['domdora_6'], coordinates: { x: 0, y: 3 } },
  domdora_6: { id: 'domdora_6', type: 'property', neighbors: ['stockbroker_west'], coordinates: { x: 1, y: 3 } },
  stockbroker_west: { id: 'stockbroker_west', type: 'stockbroker', neighbors: ['domdora_7'], coordinates: { x: 2, y: 3 } },
  domdora_7: { id: 'domdora_7', type: 'property', neighbors: ['bank'], coordinates: { x: 3, y: 3 } },

  // --- Charlock Castle Area (Central Island) ---
  charlock_warp_in_1: { id: 'charlock_warp_in_1', type: 'property', neighbors: ['charlock_2'], coordinates: { x: 4, y: 2 } },
  charlock_2: { id: 'charlock_2', type: 'property', neighbors: ['charlock_1'], coordinates: { x: 5, y: 1 } },
  charlock_1: { id: 'charlock_1', type: 'property', neighbors: ['charlock_3'], coordinates: { x: 5, y: 2 } },
  charlock_3: { id: 'charlock_3', type: 'property', neighbors: ['charlock_warp_in_2'], coordinates: { x: 5, y: 3 } },
  charlock_warp_in_2: { id: 'charlock_warp_in_2', type: 'property', neighbors: ['charlock_warp_out_1'], coordinates: { x: 6, y: 2 } },
  charlock_warp_out_1: { id: 'charlock_warp_out_1', type: 'warp', pairedNodeId: 'domdora_6', neighbors: [], coordinates: { x: 6, y: 3 } },
};

const DEFAULT_PROPERTIES: Record<string, Property> = {
  tantegel_1: { id: 'tantegel_1', nodeId: 'tantegel_1', districtId: 'tantegel', ownerId: null, basePrice: 150, currentPrice: 150, baseRent: 12, currentRent: 12, capitalInvested: 0, maxCapital: 300, shopMultiplier: 1 },
  tantegel_2: { id: 'tantegel_2', nodeId: 'tantegel_2', districtId: 'tantegel', ownerId: null, basePrice: 200, currentPrice: 200, baseRent: 0, currentRent: 0, capitalInvested: 0, maxCapital: 0, shopMultiplier: 1, buildingType: 'vacant', checkpointToll: 200, circusLevel: 0 },

  garinham_1: { id: 'garinham_1', nodeId: 'garinham_1', districtId: 'garinham', ownerId: null, basePrice: 200, currentPrice: 200, baseRent: 16, currentRent: 16, capitalInvested: 0, maxCapital: 400, shopMultiplier: 1 },
  garinham_2: { id: 'garinham_2', nodeId: 'garinham_2', districtId: 'garinham', ownerId: null, basePrice: 220, currentPrice: 220, baseRent: 18, currentRent: 18, capitalInvested: 0, maxCapital: 440, shopMultiplier: 1 },
  garinham_3: { id: 'garinham_3', nodeId: 'garinham_3', districtId: 'garinham', ownerId: null, basePrice: 240, currentPrice: 240, baseRent: 20, currentRent: 20, capitalInvested: 0, maxCapital: 480, shopMultiplier: 1 },
  garinham_4: { id: 'garinham_4', nodeId: 'garinham_4', districtId: 'garinham', ownerId: null, basePrice: 250, currentPrice: 250, baseRent: 21, currentRent: 21, capitalInvested: 0, maxCapital: 500, shopMultiplier: 1 },
  garinham_5: { id: 'garinham_5', nodeId: 'garinham_5', districtId: 'garinham', ownerId: null, basePrice: 260, currentPrice: 260, baseRent: 22, currentRent: 22, capitalInvested: 0, maxCapital: 520, shopMultiplier: 1 },
  garinham_6: { id: 'garinham_6', nodeId: 'garinham_6', districtId: 'garinham', ownerId: null, basePrice: 280, currentPrice: 280, baseRent: 24, currentRent: 24, capitalInvested: 0, maxCapital: 560, shopMultiplier: 1 },

  bridge_north_1: { id: 'bridge_north_1', nodeId: 'bridge_north_1', districtId: 'bridges', ownerId: null, basePrice: 180, currentPrice: 180, baseRent: 15, currentRent: 15, capitalInvested: 0, maxCapital: 360, shopMultiplier: 1 },
  bridge_north_2: { id: 'bridge_north_2', nodeId: 'bridge_north_2', districtId: 'bridges', ownerId: null, basePrice: 180, currentPrice: 180, baseRent: 15, currentRent: 15, capitalInvested: 0, maxCapital: 360, shopMultiplier: 1 },

  kol_1: { id: 'kol_1', nodeId: 'kol_1', districtId: 'kol', ownerId: null, basePrice: 220, currentPrice: 220, baseRent: 18, currentRent: 18, capitalInvested: 0, maxCapital: 440, shopMultiplier: 1 },
  kol_2: { id: 'kol_2', nodeId: 'kol_2', districtId: 'kol', ownerId: null, basePrice: 240, currentPrice: 240, baseRent: 20, currentRent: 20, capitalInvested: 0, maxCapital: 480, shopMultiplier: 1 },
  kol_3: { id: 'kol_3', nodeId: 'kol_3', districtId: 'kol', ownerId: null, basePrice: 200, currentPrice: 200, baseRent: 0, currentRent: 0, capitalInvested: 0, maxCapital: 0, shopMultiplier: 1, buildingType: 'vacant', checkpointToll: 200, circusLevel: 0 },
  kol_4: { id: 'kol_4', nodeId: 'kol_4', districtId: 'kol', ownerId: null, basePrice: 280, currentPrice: 280, baseRent: 24, currentRent: 24, capitalInvested: 0, maxCapital: 560, shopMultiplier: 1 },
  kol_5: { id: 'kol_5', nodeId: 'kol_5', districtId: 'kol', ownerId: null, basePrice: 300, currentPrice: 300, baseRent: 26, currentRent: 26, capitalInvested: 0, maxCapital: 600, shopMultiplier: 1 },

  cantlin_1: { id: 'cantlin_1', nodeId: 'cantlin_1', districtId: 'cantlin', ownerId: null, basePrice: 300, currentPrice: 300, baseRent: 26, currentRent: 26, capitalInvested: 0, maxCapital: 600, shopMultiplier: 1 },
  cantlin_2: { id: 'cantlin_2', nodeId: 'cantlin_2', districtId: 'cantlin', ownerId: null, basePrice: 320, currentPrice: 320, baseRent: 28, currentRent: 28, capitalInvested: 0, maxCapital: 640, shopMultiplier: 1 },
  cantlin_3: { id: 'cantlin_3', nodeId: 'cantlin_3', districtId: 'cantlin', ownerId: null, basePrice: 340, currentPrice: 340, baseRent: 30, currentRent: 30, capitalInvested: 0, maxCapital: 680, shopMultiplier: 1 },

  rimuldar_1: { id: 'rimuldar_1', nodeId: 'rimuldar_1', districtId: 'rimuldar', ownerId: null, basePrice: 320, currentPrice: 320, baseRent: 28, currentRent: 28, capitalInvested: 0, maxCapital: 640, shopMultiplier: 1 },
  rimuldar_2: { id: 'rimuldar_2', nodeId: 'rimuldar_2', districtId: 'rimuldar', ownerId: null, basePrice: 340, currentPrice: 340, baseRent: 30, currentRent: 30, capitalInvested: 0, maxCapital: 680, shopMultiplier: 1 },
  rimuldar_3: { id: 'rimuldar_3', nodeId: 'rimuldar_3', districtId: 'rimuldar', ownerId: null, basePrice: 200, currentPrice: 200, baseRent: 0, currentRent: 0, capitalInvested: 0, maxCapital: 0, shopMultiplier: 1, buildingType: 'vacant', checkpointToll: 200, circusLevel: 0 },
  rimuldar_4: { id: 'rimuldar_4', nodeId: 'rimuldar_4', districtId: 'rimuldar', ownerId: null, basePrice: 380, currentPrice: 380, baseRent: 34, currentRent: 34, capitalInvested: 0, maxCapital: 760, shopMultiplier: 1 },
  rimuldar_5: { id: 'rimuldar_5', nodeId: 'rimuldar_5', districtId: 'rimuldar', ownerId: null, basePrice: 400, currentPrice: 400, baseRent: 36, currentRent: 36, capitalInvested: 0, maxCapital: 800, shopMultiplier: 1 },
  rimuldar_6: { id: 'rimuldar_6', nodeId: 'rimuldar_6', districtId: 'rimuldar', ownerId: null, basePrice: 420, currentPrice: 420, baseRent: 38, currentRent: 38, capitalInvested: 0, maxCapital: 840, shopMultiplier: 1 },

  bridge_south_1: { id: 'bridge_south_1', nodeId: 'bridge_south_1', districtId: 'bridges', ownerId: null, basePrice: 180, currentPrice: 180, baseRent: 15, currentRent: 15, capitalInvested: 0, maxCapital: 360, shopMultiplier: 1 },
  bridge_south_2: { id: 'bridge_south_2', nodeId: 'bridge_south_2', districtId: 'bridges', ownerId: null, basePrice: 180, currentPrice: 180, baseRent: 15, currentRent: 15, capitalInvested: 0, maxCapital: 360, shopMultiplier: 1 },

  domdora_1: { id: 'domdora_1', nodeId: 'domdora_1', districtId: 'domdora', ownerId: null, basePrice: 240, currentPrice: 240, baseRent: 20, currentRent: 20, capitalInvested: 0, maxCapital: 480, shopMultiplier: 1 },
  domdora_2: { id: 'domdora_2', nodeId: 'domdora_2', districtId: 'domdora', ownerId: null, basePrice: 260, currentPrice: 260, baseRent: 22, currentRent: 22, capitalInvested: 0, maxCapital: 520, shopMultiplier: 1 },
  domdora_3: { id: 'domdora_3', nodeId: 'domdora_3', districtId: 'domdora', ownerId: null, basePrice: 200, currentPrice: 200, baseRent: 0, currentRent: 0, capitalInvested: 0, maxCapital: 0, shopMultiplier: 1, buildingType: 'vacant', checkpointToll: 200, circusLevel: 0 },
  domdora_4: { id: 'domdora_4', nodeId: 'domdora_4', districtId: 'domdora', ownerId: null, basePrice: 300, currentPrice: 300, baseRent: 26, currentRent: 26, capitalInvested: 0, maxCapital: 600, shopMultiplier: 1 },
  domdora_5: { id: 'domdora_5', nodeId: 'domdora_5', districtId: 'domdora', ownerId: null, basePrice: 320, currentPrice: 320, baseRent: 28, currentRent: 28, capitalInvested: 0, maxCapital: 640, shopMultiplier: 1 },
  domdora_6: { id: 'domdora_6', nodeId: 'domdora_6', districtId: 'domdora', ownerId: null, basePrice: 340, currentPrice: 340, baseRent: 30, currentRent: 30, capitalInvested: 0, maxCapital: 680, shopMultiplier: 1 },
  domdora_7: { id: 'domdora_7', nodeId: 'domdora_7', districtId: 'domdora', ownerId: null, basePrice: 360, currentPrice: 360, baseRent: 32, currentRent: 32, capitalInvested: 0, maxCapital: 720, shopMultiplier: 1 },

  charlock_warp_in_1: { id: 'charlock_warp_in_1', nodeId: 'charlock_warp_in_1', districtId: 'charlock', ownerId: null, basePrice: 400, currentPrice: 400, baseRent: 40, currentRent: 40, capitalInvested: 0, maxCapital: 800, shopMultiplier: 1 },
  charlock_2: { id: 'charlock_2', nodeId: 'charlock_2', districtId: 'charlock', ownerId: null, basePrice: 600, currentPrice: 600, baseRent: 60, currentRent: 60, capitalInvested: 0, maxCapital: 1200, shopMultiplier: 1 },
  charlock_1: { id: 'charlock_1', nodeId: 'charlock_1', districtId: 'charlock', ownerId: null, basePrice: 500, currentPrice: 500, baseRent: 50, currentRent: 50, capitalInvested: 0, maxCapital: 1000, shopMultiplier: 1 },
  charlock_3: { id: 'charlock_3', nodeId: 'charlock_3', districtId: 'charlock', ownerId: null, basePrice: 700, currentPrice: 700, baseRent: 70, currentRent: 70, capitalInvested: 0, maxCapital: 1400, shopMultiplier: 1 },
  charlock_warp_in_2: { id: 'charlock_warp_in_2', nodeId: 'charlock_warp_in_2', districtId: 'charlock', ownerId: null, basePrice: 450, currentPrice: 450, baseRent: 45, currentRent: 45, capitalInvested: 0, maxCapital: 900, shopMultiplier: 1 },
};

const DEFAULT_DISTRICTS: Record<string, District> = {
  tantegel: { id: 'tantegel', name: 'Tantegel', stockPrice: 10, propertyIds: ['tantegel_1', 'tantegel_2'], playerHoldings: {} },
  garinham: { id: 'garinham', name: 'Garinham', stockPrice: 8, propertyIds: ['garinham_1', 'garinham_2', 'garinham_3', 'garinham_4', 'garinham_5', 'garinham_6'], playerHoldings: {} },
  kol:      { id: 'kol',      name: 'Kol',      stockPrice: 9, propertyIds: ['kol_1', 'kol_2', 'kol_3', 'kol_4', 'kol_5'], playerHoldings: {} },
  domdora:  { id: 'domdora',  name: 'Domdora',  stockPrice: 7, propertyIds: ['domdora_1', 'domdora_2', 'domdora_3', 'domdora_4', 'domdora_5', 'domdora_6', 'domdora_7'], playerHoldings: {} },
  cantlin:  { id: 'cantlin',  name: 'Cantlin',  stockPrice: 11, propertyIds: ['cantlin_1', 'cantlin_2', 'cantlin_3'], playerHoldings: {} },
  rimuldar: { id: 'rimuldar', name: 'Rimuldar', stockPrice: 9, propertyIds: ['rimuldar_1', 'rimuldar_2', 'rimuldar_3', 'rimuldar_4', 'rimuldar_5', 'rimuldar_6'], playerHoldings: {} },
  charlock: { id: 'charlock', name: 'Charlock', stockPrice: 15, propertyIds: ['charlock_warp_in_1', 'charlock_2', 'charlock_1', 'charlock_3', 'charlock_warp_in_2'], playerHoldings: {} },
  bridges:  { id: 'bridges',  name: 'Bridges',  stockPrice: 5, propertyIds: ['bridge_north_1', 'bridge_north_2', 'bridge_south_1', 'bridge_south_2'], playerHoldings: {} },
};

// Make every edge bidirectional, except edges listed in oneWayEdges
// ([from, to] stays traversable from→to only). Boards are authored with
// forward edges; this fills in the reverse direction for normal walking.
// Mutates and returns the given board — pass a clone.
export function symmetrizeBoard(
  board: Record<string, Node>,
  oneWayEdges: ReadonlyArray<readonly [string, string]> = [],
): Record<string, Node> {
  const oneWay = new Set(oneWayEdges.map(([from, to]) => `${from}>${to}`));
  for (const [nodeId, node] of Object.entries(board)) {
    for (const neighborId of node.neighbors) {
      if (oneWay.has(`${nodeId}>${neighborId}`)) continue;
      const neighbor = board[neighborId];
      if (neighbor && !neighbor.neighbors.includes(nodeId)) {
        neighbor.neighbors.push(nodeId);
      }
    }
  }
  return board;
}

function makeDefaultState(roomId: string, playerIds: string[], targetNetWorth = 15000): GameState {
  const players: Record<string, Player> = {};
  for (const id of playerIds) {
    players[id] = makePlayer(id);
  }

  const board = symmetrizeBoard(structuredClone(DEFAULT_BOARD));

  return {
    roomId,
    players,
    turnOrder: [...playerIds],
    currentPlayerId: playerIds[0],
    currentPhase: 'PRE_ROLL',
    board,
    properties: structuredClone(DEFAULT_PROPERTIES),
    districts: structuredClone(DEFAULT_DISTRICTS),
    round: 1,
    targetNetWorth,
    winnerId: null,
    bankruptCount: 0,
    log: [],
    ventureGrid: Array.from({ length: 64 }, () => ({ cleared: false, playerId: null })),
    ventureGridCardIds: seedVentureGridCardIds(),
    activeVentureCard: null,
    status: 'LOBBY',
    creatorId: playerIds[0],
    lastRoll: {},
  };
}

// ─── Delta computation ────────────────────────────────────────────────────────

export type DeltaEvent = { type: string; payload: Record<string, unknown> };

export function computeDeltas(action: Action, before: GameState, after: GameState): DeltaEvent[] {
  const deltas: DeltaEvent[] = [];
  const pid = before.currentPlayerId;
  const bPlayer = before.players[pid];
  const aPlayer = after.players[pid];

  // Player movement (ROLL_DICE auto-resolve, or CHOOSE_PATH)
  if (bPlayer.currentNodeId !== aPlayer.currentNodeId) {
    const roll = after.lastRoll?.[pid];
    const path = getPath(after.board, bPlayer.currentNodeId, aPlayer.currentNodeId, roll);
    deltas.push({ type: 'PLAYER_MOVED', payload: { playerId: pid, path, finalNodeId: aPlayer.currentNodeId } });
  }

  // Branch choice pending
  if (before.currentPhase !== 'CHOOSING_PATH' && after.currentPhase === 'CHOOSING_PATH') {
    deltas.push({ type: 'CHOICES_AVAILABLE', payload: { playerId: pid, destinations: after.pendingDestinations ?? [] } });
  }

  switch (action.type) {
    case 'BUY_PROPERTY': {
      for (const [propId, prop] of Object.entries(after.properties)) {
        if (before.properties[propId]?.ownerId !== prop.ownerId && prop.ownerId === pid) {
          deltas.push({ type: 'PROPERTY_BOUGHT', payload: { playerId: pid, propertyId: propId, price: prop.currentPrice } });
          const { districtId } = prop;
          if (before.districts[districtId]?.stockPrice !== after.districts[districtId]?.stockPrice) {
            deltas.push({ type: 'STOCK_PRICE_CHANGED', payload: { districtId, newPrice: after.districts[districtId].stockPrice } });
          }
        }
      }
      break;
    }

    case 'INVEST': {
      const prop = after.properties[action.propertyId];
      deltas.push({ type: 'PROPERTY_INVESTED', payload: { playerId: pid, propertyId: action.propertyId, amount: action.amount, newRent: prop?.currentRent } });
      break;
    }

    case 'PAY_RENT': {
      const rent = bPlayer.cash - aPlayer.cash;
      const prop = Object.values(before.properties).find(p => p.nodeId === bPlayer.currentNodeId);
      deltas.push({ type: 'RENT_PAID', payload: { payerId: pid, ownerId: prop?.ownerId ?? null, propertyId: prop?.id ?? null, amount: rent } });
      break;
    }

    case 'BUY_STOCK': {
      deltas.push({ type: 'STOCK_BOUGHT', payload: { playerId: pid, districtId: action.districtId, shares: action.shares } });
      if (before.districts[action.districtId]?.stockPrice !== after.districts[action.districtId]?.stockPrice) {
        deltas.push({ type: 'STOCK_PRICE_CHANGED', payload: { districtId: action.districtId, newPrice: after.districts[action.districtId].stockPrice } });
      }
      break;
    }

    case 'SELL_STOCK': {
      deltas.push({ type: 'STOCK_SOLD', payload: { playerId: pid, districtId: action.districtId, shares: action.shares } });
      if (before.districts[action.districtId]?.stockPrice !== after.districts[action.districtId]?.stockPrice) {
        deltas.push({ type: 'STOCK_PRICE_CHANGED', payload: { districtId: action.districtId, newPrice: after.districts[action.districtId].stockPrice } });
      }
      break;
    }

    case 'COLLECT_SALARY': {
      const salary = aPlayer.cash - bPlayer.cash;
      deltas.push({ type: 'SALARY_COLLECTED', payload: { playerId: pid, amount: salary, newLevel: aPlayer.level } });
      break;
    }

    case 'BUYOUT_PROPERTY': {
      const prop = after.properties[action.propertyId];
      const oldProp = before.properties[action.propertyId];
      deltas.push({
        type: 'PROPERTY_BUYOUT',
        payload: {
          buyerId: pid,
          sellerId: oldProp?.ownerId ?? null,
          propertyId: action.propertyId,
          price: oldProp?.currentPrice ?? 0,
        }
      });
      const { districtId } = prop;
      if (before.districts[districtId]?.stockPrice !== after.districts[districtId]?.stockPrice) {
        deltas.push({ type: 'STOCK_PRICE_CHANGED', payload: { districtId, newPrice: after.districts[districtId].stockPrice } });
      }
      break;
    }

    case 'CHOOSE_VENTURE_CARD': {
      deltas.push({
        type: 'VENTURE_CARD_CHOSEN',
        payload: {
          playerId: pid,
          cardIndex: action.cardIndex,
          card: after.activeVentureCard,
        }
      });
      break;
    }

    case 'BUILD_PLOT': {
      const prop = after.properties[action.propertyId];
      deltas.push({
        type: 'PLOT_BUILT',
        payload: {
          playerId: pid,
          propertyId: action.propertyId,
          buildingType: action.buildingType,
          price: prop?.currentPrice ?? 200,
        }
      });
      break;
    }

    case 'RENOVATE_PLOT': {
      const prop = after.properties[action.propertyId];
      deltas.push({
        type: 'PLOT_RENOVATED',
        payload: {
          playerId: pid,
          propertyId: action.propertyId,
          buildingType: action.buildingType,
          price: prop?.currentPrice ?? 200,
        }
      });
      break;
    }

    case 'TELEPORT': {
      deltas.push({
        type: 'PLAYER_TELEPORTED',
        payload: {
          playerId: pid,
          fromNodeId: before.players[pid].currentNodeId,
          toNodeId: action.nodeId,
        }
      });
      break;
    }

    case 'END_TURN': {
      deltas.push({
        type: 'TURN_ENDED',
        payload: {
          playerId: pid,
        }
      });
      break;
    }
  }

  // Cross-action: auto-salary (resolveSpace collects salary on bank landing — not an explicit action)
  if (action.type !== 'COLLECT_SALARY') {
    for (const [pId, aP] of Object.entries(after.players)) {
      const bP = before.players[pId];
      if (bP && aP.level > bP.level) {
        const salary = aP.cash - bP.cash;
        deltas.push({ type: 'SALARY_COLLECTED', payload: { playerId: pId, amount: salary, newLevel: aP.level } });
      }
    }
  }

  // Cross-action: turn advance
  if (before.currentPlayerId !== after.currentPlayerId) {
    deltas.push({ type: 'TURN_ADVANCED', payload: { nextPlayerId: after.currentPlayerId, round: after.round } });
  }

  // Cross-action: bankruptcy
  for (const [pId, player] of Object.entries(after.players)) {
    if (!before.players[pId]?.isBankrupt && player.isBankrupt) {
      deltas.push({ type: 'PLAYER_BANKRUPT', payload: { playerId: pId } });
    }
  }

  // Cross-action: win
  if (!before.winnerId && after.winnerId) {
    deltas.push({ type: 'GAME_WON', payload: { winnerId: after.winnerId } });
  }

  return deltas;
}

// ─── GameManager ──────────────────────────────────────────────────────────────

export class GameManager {
  private rooms = new Map<string, GameState>();

  getRoom(roomId: string): GameState | undefined {
    return this.rooms.get(roomId);
  }

  getRooms(): Map<string, GameState> {
    return this.rooms;
  }

  createRoom(roomId: string, players: string[], targetNetWorth?: number): GameState {
    const state = makeDefaultState(roomId, players, targetNetWorth);
    this.rooms.set(roomId, state);
    return state;
  }

  applyValidatedAction(roomId: string, action: Action): { before: GameState; after: GameState } {
    const before = this.rooms.get(roomId);
    if (!before) throw new Error(`Room ${roomId} not found`);
    const after = applyAction(before, action);
    this.rooms.set(roomId, after);
    return { before, after };
  }

  deleteRoom(roomId: string): void {
    this.rooms.delete(roomId);
  }
}
