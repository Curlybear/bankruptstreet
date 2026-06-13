import type { Node, Property, District } from '../shared/types.js';

export interface BoardDef {
  id: string;
  name: string;
  suggestedTarget: number;      // default target net worth for this board
  board: Record<string, Node>;          // forward edges only; symmetrized at game start
  properties: Record<string, Property>;
  districts: Record<string, District>;
  oneWayEdges: ReadonlyArray<readonly [string, string]>;  // [from, to] edges that stay directed
}

// ─── Eldermoor — the original board ───────────────────────────

const ELDERMOOR_BOARD: Record<string, Node> = {
  // --- Bank (Eldermoor Keep/Kingsford Castle) ---
  bank: { id: 'bank', type: 'bank', neighbors: ['kingsford_1'], coordinates: { x: 0, y: 2 } },

  // --- Kingsford Area ---
  kingsford_1: { id: 'kingsford_1', type: 'property', neighbors: ['kingsford_2'], coordinates: { x: 1, y: 2 } },
  kingsford_2: { id: 'kingsford_2', type: 'vacant', neighbors: ['heart_suit'], coordinates: { x: 2, y: 2 } },
  heart_suit: { id: 'heart_suit', type: 'suit', suit: 'heart', neighbors: ['greendale_1', 'dunmoor_7'], coordinates: { x: 3, y: 2 } },

  // --- Greendale Area (Northwest) ---
  greendale_1: { id: 'greendale_1', type: 'property', neighbors: ['greendale_2'], coordinates: { x: 3, y: 1 } },
  greendale_2: { id: 'greendale_2', type: 'property', neighbors: ['greendale_3'], coordinates: { x: 2, y: 1 } },
  greendale_3: { id: 'greendale_3', type: 'property', neighbors: ['greendale_4'], coordinates: { x: 1, y: 1 } },
  greendale_4: { id: 'greendale_4', type: 'property', neighbors: ['spade_suit'], coordinates: { x: 0, y: 1 } },
  spade_suit: { id: 'spade_suit', type: 'suit', suit: 'spade', neighbors: ['greendale_5'], coordinates: { x: 0, y: 0 } },
  greendale_5: { id: 'greendale_5', type: 'property', neighbors: ['greendale_6'], coordinates: { x: 1, y: 0 } },
  greendale_6: { id: 'greendale_6', type: 'property', neighbors: ['bridge_north_1', 'warp_to_blackspire_1'], coordinates: { x: 2, y: 0 } },

  // --- Warp north ---
  warp_to_blackspire_1: { id: 'warp_to_blackspire_1', type: 'warp', pairedNodeId: 'blackspire_warp_in_1', neighbors: [], coordinates: { x: 3, y: 0 } },

  // --- North Bridge ---
  bridge_north_1: { id: 'bridge_north_1', type: 'property', neighbors: ['venture_north'], coordinates: { x: 4, y: 0 } },
  venture_north: { id: 'venture_north', type: 'venture', neighbors: ['bridge_north_2'], coordinates: { x: 5, y: 0 } },
  bridge_north_2: { id: 'bridge_north_2', type: 'property', neighbors: ['fenwick_1'], coordinates: { x: 6, y: 0 } },

  // --- Fenwick Area (Northeast) ---
  fenwick_1: { id: 'fenwick_1', type: 'property', neighbors: ['alley_a1'], coordinates: { x: 7, y: 0 } },
  // Backstreet A (north) — slips across the map to alley_a2 in the southwest.
  alley_a1: { id: 'alley_a1', type: 'backstreet', backstreetGroup: 'A', neighbors: ['fenwick_2'], coordinates: { x: 7.5, y: -1 } },
  fenwick_2: { id: 'fenwick_2', type: 'property', neighbors: ['break_inn'], coordinates: { x: 8, y: 0 } },
  break_inn: { id: 'break_inn', type: 'break', neighbors: ['diamond_suit'], coordinates: { x: 9, y: 0 } },
  diamond_suit: { id: 'diamond_suit', type: 'suit', suit: 'diamond', neighbors: ['fenwick_3'], coordinates: { x: 10, y: 0 } },
  fenwick_3: { id: 'fenwick_3', type: 'boon', neighbors: ['fenwick_4'], coordinates: { x: 10, y: 1 } },
  fenwick_4: { id: 'fenwick_4', type: 'property', neighbors: ['fenwick_5'], coordinates: { x: 9, y: 1 } },
  fenwick_5: { id: 'fenwick_5', type: 'property', neighbors: ['stockbroker_east'], coordinates: { x: 8, y: 1 } },
  stockbroker_east: { id: 'stockbroker_east', type: 'stockbroker', neighbors: ['cresthill_1'], coordinates: { x: 7, y: 1 } },

  // --- Cresthill Area (East / Center Transition) ---
  cresthill_1: { id: 'cresthill_1', type: 'property', neighbors: ['cresthill_2'], coordinates: { x: 7, y: 2 } },
  cresthill_2: { id: 'cresthill_2', type: 'property', neighbors: ['cresthill_3'], coordinates: { x: 8, y: 2 } },
  cresthill_3: { id: 'cresthill_3', type: 'property', neighbors: ['rivermouth_1'], coordinates: { x: 9, y: 2 } },

  // --- Rivermouth Area (Southeast) ---
  rivermouth_1: { id: 'rivermouth_1', type: 'property', neighbors: ['rollon_east'], coordinates: { x: 10, y: 2 } },
  // Roll-on — land here and immediately take another roll.
  rollon_east: { id: 'rollon_east', type: 'roll_on', neighbors: ['rivermouth_2'], coordinates: { x: 11, y: 2.5 } },
  rivermouth_2: { id: 'rivermouth_2', type: 'property', neighbors: ['club_suit'], coordinates: { x: 10, y: 3 } },
  club_suit: { id: 'club_suit', type: 'suit', suit: 'club', cycleSuit: true, neighbors: ['rivermouth_3'], coordinates: { x: 10, y: 4 } },
  rivermouth_3: { id: 'rivermouth_3', type: 'vacant', neighbors: ['rivermouth_4'], coordinates: { x: 9, y: 4 } },
  rivermouth_4: { id: 'rivermouth_4', type: 'property', neighbors: ['rivermouth_5'], coordinates: { x: 9, y: 3 } },
  rivermouth_5: { id: 'rivermouth_5', type: 'property', neighbors: ['rivermouth_6'], coordinates: { x: 8, y: 3 } },
  rivermouth_6: { id: 'rivermouth_6', type: 'property', neighbors: ['bridge_south_2', 'warp_to_blackspire_2'], coordinates: { x: 8, y: 4 } },

  // --- Warp south ---
  warp_to_blackspire_2: { id: 'warp_to_blackspire_2', type: 'warp', pairedNodeId: 'blackspire_warp_in_2', neighbors: [], coordinates: { x: 7, y: 4 } },

  // --- South Bridge ---
  bridge_south_2: { id: 'bridge_south_2', type: 'property', neighbors: ['venture_south'], coordinates: { x: 6, y: 4 } },
  venture_south: { id: 'venture_south', type: 'casino', neighbors: ['bridge_south_1'], coordinates: { x: 5, y: 4 } },
  bridge_south_1: { id: 'bridge_south_1', type: 'property', neighbors: ['dunmoor_1'], coordinates: { x: 4, y: 4 } },

  // --- Dunmoor Area (Southwest) ---
  dunmoor_1: { id: 'dunmoor_1', type: 'property', neighbors: ['cannon_dunmoor'], coordinates: { x: 3, y: 4 } },
  // Cannon — blasts the lander onto a random rival's square.
  cannon_dunmoor: { id: 'cannon_dunmoor', type: 'cannon', neighbors: ['dunmoor_2'], coordinates: { x: 2.5, y: 5 } },
  dunmoor_2: { id: 'dunmoor_2', type: 'property', neighbors: ['dunmoor_3'], coordinates: { x: 2, y: 4 } },
  dunmoor_3: { id: 'dunmoor_3', type: 'vacant', neighbors: ['dunmoor_4'], coordinates: { x: 1, y: 4 } },
  dunmoor_4: { id: 'dunmoor_4', type: 'property', neighbors: ['alley_a2'], coordinates: { x: 0, y: 4 } },
  // Backstreet A (southwest) — the other end of the alley_a1 shortcut.
  alley_a2: { id: 'alley_a2', type: 'backstreet', backstreetGroup: 'A', neighbors: ['dunmoor_5'], coordinates: { x: -1, y: 3.5 } },
  dunmoor_5: { id: 'dunmoor_5', type: 'property', neighbors: ['dunmoor_6'], coordinates: { x: 0, y: 3 } },
  dunmoor_6: { id: 'dunmoor_6', type: 'property', neighbors: ['stockbroker_west'], coordinates: { x: 1, y: 3 } },
  stockbroker_west: { id: 'stockbroker_west', type: 'stockbroker', neighbors: ['dunmoor_7'], coordinates: { x: 2, y: 3 } },
  dunmoor_7: { id: 'dunmoor_7', type: 'property', neighbors: ['bank'], coordinates: { x: 3, y: 3 } },

  // --- Blackspire Castle Area (Central Island) ---
  // The island loops internally (no dead-end entrance) and has a taxed land
  // exit east through the Blackspire Gate to the stockbroker.
  blackspire_warp_in_1: { id: 'blackspire_warp_in_1', type: 'property', neighbors: ['blackspire_2', 'blackspire_1'], coordinates: { x: 4, y: 2 } },
  blackspire_2: { id: 'blackspire_2', type: 'property', neighbors: ['blackspire_1', 'blackspire_gate'], coordinates: { x: 5, y: 1 } },
  blackspire_gate: { id: 'blackspire_gate', type: 'tax_office', neighbors: ['stockbroker_east'], coordinates: { x: 6, y: 1 } },
  blackspire_1: { id: 'blackspire_1', type: 'property', neighbors: ['blackspire_3'], coordinates: { x: 5, y: 2 } },
  blackspire_3: { id: 'blackspire_3', type: 'property', neighbors: ['blackspire_warp_in_2'], coordinates: { x: 5, y: 3 } },
  blackspire_warp_in_2: { id: 'blackspire_warp_in_2', type: 'property', neighbors: ['blackspire_warp_out_1'], coordinates: { x: 6, y: 2 } },
  blackspire_warp_out_1: { id: 'blackspire_warp_out_1', type: 'warp', pairedNodeId: 'dunmoor_6', neighbors: [], coordinates: { x: 6, y: 3 } },
};

const ELDERMOOR_PROPERTIES: Record<string, Property> = {
  kingsford_1: { id: 'kingsford_1', nodeId: 'kingsford_1', districtId: 'kingsford', ownerId: null, basePrice: 150, currentPrice: 150, baseRent: 12, currentRent: 12, capitalInvested: 0, maxCapital: 300, shopMultiplier: 1 },
  kingsford_2: { id: 'kingsford_2', nodeId: 'kingsford_2', districtId: 'kingsford', ownerId: null, basePrice: 200, currentPrice: 200, baseRent: 0, currentRent: 0, capitalInvested: 0, maxCapital: 0, shopMultiplier: 1, buildingType: 'vacant', checkpointToll: 50, circusLevel: 0 },

  greendale_1: { id: 'greendale_1', nodeId: 'greendale_1', districtId: 'greendale', ownerId: null, basePrice: 200, currentPrice: 200, baseRent: 16, currentRent: 16, capitalInvested: 0, maxCapital: 400, shopMultiplier: 1 },
  greendale_2: { id: 'greendale_2', nodeId: 'greendale_2', districtId: 'greendale', ownerId: null, basePrice: 220, currentPrice: 220, baseRent: 18, currentRent: 18, capitalInvested: 0, maxCapital: 440, shopMultiplier: 1 },
  greendale_3: { id: 'greendale_3', nodeId: 'greendale_3', districtId: 'greendale', ownerId: null, basePrice: 240, currentPrice: 240, baseRent: 20, currentRent: 20, capitalInvested: 0, maxCapital: 480, shopMultiplier: 1 },
  greendale_4: { id: 'greendale_4', nodeId: 'greendale_4', districtId: 'greendale', ownerId: null, basePrice: 250, currentPrice: 250, baseRent: 21, currentRent: 21, capitalInvested: 0, maxCapital: 500, shopMultiplier: 1 },
  greendale_5: { id: 'greendale_5', nodeId: 'greendale_5', districtId: 'greenway', ownerId: null, basePrice: 260, currentPrice: 260, baseRent: 22, currentRent: 22, capitalInvested: 0, maxCapital: 520, shopMultiplier: 1 },
  greendale_6: { id: 'greendale_6', nodeId: 'greendale_6', districtId: 'greenway', ownerId: null, basePrice: 280, currentPrice: 280, baseRent: 24, currentRent: 24, capitalInvested: 0, maxCapital: 560, shopMultiplier: 1 },

  bridge_north_1: { id: 'bridge_north_1', nodeId: 'bridge_north_1', districtId: 'bridges', ownerId: null, basePrice: 180, currentPrice: 180, baseRent: 15, currentRent: 15, capitalInvested: 0, maxCapital: 360, shopMultiplier: 1 },
  bridge_north_2: { id: 'bridge_north_2', nodeId: 'bridge_north_2', districtId: 'bridges', ownerId: null, basePrice: 180, currentPrice: 180, baseRent: 15, currentRent: 15, capitalInvested: 0, maxCapital: 360, shopMultiplier: 1 },

  fenwick_1: { id: 'fenwick_1', nodeId: 'fenwick_1', districtId: 'fenwick', ownerId: null, basePrice: 220, currentPrice: 220, baseRent: 18, currentRent: 18, capitalInvested: 0, maxCapital: 440, shopMultiplier: 1 },
  fenwick_2: { id: 'fenwick_2', nodeId: 'fenwick_2', districtId: 'fenwick', ownerId: null, basePrice: 240, currentPrice: 240, baseRent: 20, currentRent: 20, capitalInvested: 0, maxCapital: 480, shopMultiplier: 1 },
  fenwick_4: { id: 'fenwick_4', nodeId: 'fenwick_4', districtId: 'fenwick', ownerId: null, basePrice: 280, currentPrice: 280, baseRent: 24, currentRent: 24, capitalInvested: 0, maxCapital: 560, shopMultiplier: 1 },
  fenwick_5: { id: 'fenwick_5', nodeId: 'fenwick_5', districtId: 'fenwick', ownerId: null, basePrice: 300, currentPrice: 300, baseRent: 26, currentRent: 26, capitalInvested: 0, maxCapital: 600, shopMultiplier: 1 },

  cresthill_1: { id: 'cresthill_1', nodeId: 'cresthill_1', districtId: 'cresthill', ownerId: null, basePrice: 300, currentPrice: 300, baseRent: 26, currentRent: 26, capitalInvested: 0, maxCapital: 600, shopMultiplier: 1 },
  cresthill_2: { id: 'cresthill_2', nodeId: 'cresthill_2', districtId: 'cresthill', ownerId: null, basePrice: 320, currentPrice: 320, baseRent: 28, currentRent: 28, capitalInvested: 0, maxCapital: 640, shopMultiplier: 1 },
  cresthill_3: { id: 'cresthill_3', nodeId: 'cresthill_3', districtId: 'cresthill', ownerId: null, basePrice: 340, currentPrice: 340, baseRent: 30, currentRent: 30, capitalInvested: 0, maxCapital: 680, shopMultiplier: 1 },

  rivermouth_1: { id: 'rivermouth_1', nodeId: 'rivermouth_1', districtId: 'rivermouth', ownerId: null, basePrice: 320, currentPrice: 320, baseRent: 28, currentRent: 28, capitalInvested: 0, maxCapital: 640, shopMultiplier: 1 },
  rivermouth_2: { id: 'rivermouth_2', nodeId: 'rivermouth_2', districtId: 'rivermouth', ownerId: null, basePrice: 340, currentPrice: 340, baseRent: 30, currentRent: 30, capitalInvested: 0, maxCapital: 680, shopMultiplier: 1 },
  rivermouth_3: { id: 'rivermouth_3', nodeId: 'rivermouth_3', districtId: 'rivermouth', ownerId: null, basePrice: 200, currentPrice: 200, baseRent: 0, currentRent: 0, capitalInvested: 0, maxCapital: 0, shopMultiplier: 1, buildingType: 'vacant', checkpointToll: 50, circusLevel: 0 },
  rivermouth_4: { id: 'rivermouth_4', nodeId: 'rivermouth_4', districtId: 'stonehollow', ownerId: null, basePrice: 380, currentPrice: 380, baseRent: 34, currentRent: 34, capitalInvested: 0, maxCapital: 760, shopMultiplier: 1 },
  rivermouth_5: { id: 'rivermouth_5', nodeId: 'rivermouth_5', districtId: 'stonehollow', ownerId: null, basePrice: 400, currentPrice: 400, baseRent: 36, currentRent: 36, capitalInvested: 0, maxCapital: 800, shopMultiplier: 1 },
  rivermouth_6: { id: 'rivermouth_6', nodeId: 'rivermouth_6', districtId: 'stonehollow', ownerId: null, basePrice: 420, currentPrice: 420, baseRent: 38, currentRent: 38, capitalInvested: 0, maxCapital: 840, shopMultiplier: 1 },

  bridge_south_1: { id: 'bridge_south_1', nodeId: 'bridge_south_1', districtId: 'bridges', ownerId: null, basePrice: 180, currentPrice: 180, baseRent: 15, currentRent: 15, capitalInvested: 0, maxCapital: 360, shopMultiplier: 1 },
  bridge_south_2: { id: 'bridge_south_2', nodeId: 'bridge_south_2', districtId: 'bridges', ownerId: null, basePrice: 180, currentPrice: 180, baseRent: 15, currentRent: 15, capitalInvested: 0, maxCapital: 360, shopMultiplier: 1 },

  dunmoor_1: { id: 'dunmoor_1', nodeId: 'dunmoor_1', districtId: 'dunmoor', ownerId: null, basePrice: 240, currentPrice: 240, baseRent: 20, currentRent: 20, capitalInvested: 0, maxCapital: 480, shopMultiplier: 1 },
  dunmoor_2: { id: 'dunmoor_2', nodeId: 'dunmoor_2', districtId: 'dunmoor', ownerId: null, basePrice: 260, currentPrice: 260, baseRent: 22, currentRent: 22, capitalInvested: 0, maxCapital: 520, shopMultiplier: 1 },
  dunmoor_3: { id: 'dunmoor_3', nodeId: 'dunmoor_3', districtId: 'dunmoor', ownerId: null, basePrice: 200, currentPrice: 200, baseRent: 0, currentRent: 0, capitalInvested: 0, maxCapital: 0, shopMultiplier: 1, buildingType: 'vacant', checkpointToll: 50, circusLevel: 0 },
  dunmoor_4: { id: 'dunmoor_4', nodeId: 'dunmoor_4', districtId: 'dunmoor', ownerId: null, basePrice: 300, currentPrice: 300, baseRent: 26, currentRent: 26, capitalInvested: 0, maxCapital: 600, shopMultiplier: 1 },
  dunmoor_5: { id: 'dunmoor_5', nodeId: 'dunmoor_5', districtId: 'harrowmere', ownerId: null, basePrice: 320, currentPrice: 320, baseRent: 28, currentRent: 28, capitalInvested: 0, maxCapital: 640, shopMultiplier: 1 },
  dunmoor_6: { id: 'dunmoor_6', nodeId: 'dunmoor_6', districtId: 'harrowmere', ownerId: null, basePrice: 340, currentPrice: 340, baseRent: 30, currentRent: 30, capitalInvested: 0, maxCapital: 680, shopMultiplier: 1 },
  dunmoor_7: { id: 'dunmoor_7', nodeId: 'dunmoor_7', districtId: 'harrowmere', ownerId: null, basePrice: 360, currentPrice: 360, baseRent: 32, currentRent: 32, capitalInvested: 0, maxCapital: 720, shopMultiplier: 1 },

  blackspire_warp_in_1: { id: 'blackspire_warp_in_1', nodeId: 'blackspire_warp_in_1', districtId: 'blackspire', ownerId: null, basePrice: 400, currentPrice: 400, baseRent: 34, currentRent: 34, capitalInvested: 0, maxCapital: 800, shopMultiplier: 1 },
  blackspire_2: { id: 'blackspire_2', nodeId: 'blackspire_2', districtId: 'blackspire', ownerId: null, basePrice: 600, currentPrice: 600, baseRent: 51, currentRent: 51, capitalInvested: 0, maxCapital: 1200, shopMultiplier: 1 },
  blackspire_1: { id: 'blackspire_1', nodeId: 'blackspire_1', districtId: 'blackspire', ownerId: null, basePrice: 500, currentPrice: 500, baseRent: 43, currentRent: 43, capitalInvested: 0, maxCapital: 1000, shopMultiplier: 1 },
  blackspire_3: { id: 'blackspire_3', nodeId: 'blackspire_3', districtId: 'blackspire', ownerId: null, basePrice: 700, currentPrice: 700, baseRent: 60, currentRent: 60, capitalInvested: 0, maxCapital: 1400, shopMultiplier: 1 },
  blackspire_warp_in_2: { id: 'blackspire_warp_in_2', nodeId: 'blackspire_warp_in_2', districtId: 'blackspire', ownerId: null, basePrice: 450, currentPrice: 450, baseRent: 38, currentRent: 38, capitalInvested: 0, maxCapital: 900, shopMultiplier: 1 },
};

const ELDERMOOR_DISTRICTS: Record<string, District> = {
  kingsford: { id: 'kingsford', name: 'Kingsford', stockPrice: 10, propertyIds: ['kingsford_1', 'kingsford_2'], playerHoldings: {} },
  greendale:   { id: 'greendale',   name: 'Greendale',   stockPrice: 8, propertyIds: ['greendale_1', 'greendale_2', 'greendale_3', 'greendale_4'], playerHoldings: {} },
  greenway: { id: 'greenway', name: 'Greenway', stockPrice: 9, propertyIds: ['greendale_5', 'greendale_6'], playerHoldings: {} },
  fenwick:      { id: 'fenwick',      name: 'Fenwick',      stockPrice: 9, propertyIds: ['fenwick_1', 'fenwick_2', 'fenwick_4', 'fenwick_5'], playerHoldings: {} },
  dunmoor:   { id: 'dunmoor',   name: 'Dunmoor',   stockPrice: 7,  propertyIds: ['dunmoor_1', 'dunmoor_2', 'dunmoor_3', 'dunmoor_4'], playerHoldings: {} },
  harrowmere: { id: 'harrowmere', name: 'Harrowmere', stockPrice: 13, propertyIds: ['dunmoor_5', 'dunmoor_6', 'dunmoor_7'], playerHoldings: {} },
  cresthill:  { id: 'cresthill',  name: 'Cresthill',  stockPrice: 11, propertyIds: ['cresthill_1', 'cresthill_2', 'cresthill_3'], playerHoldings: {} },
  rivermouth:  { id: 'rivermouth',  name: 'Rivermouth',  stockPrice: 9,  propertyIds: ['rivermouth_1', 'rivermouth_2', 'rivermouth_3'], playerHoldings: {} },
  stonehollow: { id: 'stonehollow', name: 'Stonehollow', stockPrice: 16, propertyIds: ['rivermouth_4', 'rivermouth_5', 'rivermouth_6'], playerHoldings: {} },
  blackspire: { id: 'blackspire', name: 'Blackspire', stockPrice: 15, propertyIds: ['blackspire_warp_in_1', 'blackspire_2', 'blackspire_1', 'blackspire_3', 'blackspire_warp_in_2'], playerHoldings: {} },
  bridges:  { id: 'bridges',  name: 'Bridges',  stockPrice: 5, propertyIds: ['bridge_north_1', 'bridge_north_2', 'bridge_south_1', 'bridge_south_2'], playerHoldings: {} },
};

// ─── Mistral — outer ring, inner pass, one-way rapids ───────
//
// Outer ring is bidirectional. The inner Thornpass pass (west column) is a two-way
// shortcut. The River Rapids flow one-way west→east from Thornpass out to the
// eastern stockbroker — a fast lane you cannot swim back up.

const MISTRAL_BOARD: Record<string, Node> = {
  // --- Bank (Mistral Keep Castle, west side) ---
  bank: { id: 'bank', type: 'bank', neighbors: ['seaford_1'], coordinates: { x: 0, y: 3 } },

  // --- Seaford (west coast, going north) ---
  seaford_1: { id: 'seaford_1', type: 'property', neighbors: ['alley_b1'], coordinates: { x: 0, y: 2 } },
  // Backstreet B (west) — alley shortcut across to alley_b2 in the south-east.
  alley_b1: { id: 'alley_b1', type: 'backstreet', backstreetGroup: 'B', neighbors: ['seaford_2'], coordinates: { x: -1, y: 1.5 } },
  seaford_2: { id: 'seaford_2', type: 'property', neighbors: ['heart_suit'], coordinates: { x: 0, y: 1 } },
  heart_suit: { id: 'heart_suit', type: 'suit', suit: 'heart', neighbors: ['ashbury_1'], coordinates: { x: 1, y: 0 } },

  // --- Ashbury (north-west) ---
  ashbury_1: { id: 'ashbury_1', type: 'property', neighbors: ['ashbury_2', 'thornpass_1'], coordinates: { x: 2, y: 0 } },
  ashbury_2: { id: 'ashbury_2', type: 'property', neighbors: ['venture_north'], coordinates: { x: 3, y: 0 } },
  venture_north: { id: 'venture_north', type: 'venture', neighbors: ['ashbury_3'], coordinates: { x: 4, y: 0 } },
  ashbury_3: { id: 'ashbury_3', type: 'property', neighbors: ['tax_north'], coordinates: { x: 5, y: 0 } },

  // --- Royal Tax Office (native tax square, north center) ---
  tax_north: { id: 'tax_north', type: 'tax_office', neighbors: ['northgate_1'], coordinates: { x: 6, y: 0 } },

  // --- Northgate (north-east) ---
  northgate_1: { id: 'northgate_1', type: 'property', neighbors: ['rollon_northgate'], coordinates: { x: 7, y: 0 } },
  // Roll-on — land here and immediately take another roll.
  rollon_northgate: { id: 'rollon_northgate', type: 'roll_on', neighbors: ['northgate_2'], coordinates: { x: 7.5, y: -1 } },
  northgate_2: { id: 'northgate_2', type: 'property', neighbors: ['diamond_suit'], coordinates: { x: 8, y: 0 } },
  diamond_suit: { id: 'diamond_suit', type: 'suit', suit: 'diamond', neighbors: ['northgate_3'], coordinates: { x: 9, y: 0 } },
  northgate_3: { id: 'northgate_3', type: 'vacant', neighbors: ['eastport_1'], coordinates: { x: 10, y: 1 } },

  // --- Eastport (east coast, going south) ---
  eastport_1: { id: 'eastport_1', type: 'property', neighbors: ['stockbroker_east'], coordinates: { x: 10, y: 2 } },
  stockbroker_east: { id: 'stockbroker_east', type: 'stockbroker', neighbors: ['eastport_2'], coordinates: { x: 10, y: 3 } },
  eastport_2: { id: 'eastport_2', type: 'property', neighbors: ['club_suit'], coordinates: { x: 10, y: 4 } },
  club_suit: { id: 'club_suit', type: 'suit', suit: 'club', neighbors: ['sunder_1'], coordinates: { x: 9, y: 5 } },

  // --- Sunder (south-east) ---
  sunder_1: { id: 'sunder_1', type: 'property', neighbors: ['alley_b2'], coordinates: { x: 8, y: 5 } },
  // Backstreet B (south-east) — the other end of the alley_b1 shortcut.
  alley_b2: { id: 'alley_b2', type: 'backstreet', backstreetGroup: 'B', neighbors: ['sunder_2'], coordinates: { x: 7.5, y: 6 } },
  sunder_2: { id: 'sunder_2', type: 'property', neighbors: ['venture_south'], coordinates: { x: 7, y: 5 } },
  venture_south: { id: 'venture_south', type: 'casino', neighbors: ['sunder_3'], coordinates: { x: 6, y: 5 } },
  sunder_3: { id: 'sunder_3', type: 'boon', neighbors: ['silverbrook_1'], coordinates: { x: 5, y: 5 } },

  // --- Silverbrook (south-west) ---
  silverbrook_1: { id: 'silverbrook_1', type: 'property', neighbors: ['cannon_moon'], coordinates: { x: 4, y: 5 } },
  // Cannon — blasts the lander onto a random rival's square.
  cannon_moon: { id: 'cannon_moon', type: 'cannon', neighbors: ['silverbrook_2'], coordinates: { x: 3.5, y: 6 } },
  silverbrook_2: { id: 'silverbrook_2', type: 'property', neighbors: ['spade_suit'], coordinates: { x: 3, y: 5 } },
  spade_suit: { id: 'spade_suit', type: 'suit', suit: 'spade', cycleSuit: true, neighbors: ['silverbrook_3', 'thornpass_3'], coordinates: { x: 2, y: 5 } },
  silverbrook_3: { id: 'silverbrook_3', type: 'property', neighbors: ['break_oasis'], coordinates: { x: 1, y: 5 } },
  break_oasis: { id: 'break_oasis', type: 'break', neighbors: ['westvale_1'], coordinates: { x: 0, y: 5 } },
  westvale_1: { id: 'westvale_1', type: 'property', neighbors: ['bank'], coordinates: { x: 0, y: 4 } },

  // --- Thornpass Pass (inner west column, two-way shortcut) ---
  thornpass_1: { id: 'thornpass_1', type: 'property', neighbors: ['stockbroker_west'], coordinates: { x: 2, y: 1 } },
  stockbroker_west: { id: 'stockbroker_west', type: 'stockbroker', neighbors: ['thornpass_2'], coordinates: { x: 2, y: 2 } },
  thornpass_2: { id: 'thornpass_2', type: 'property', neighbors: ['thornpass_3', 'rapids_1'], coordinates: { x: 2, y: 3 } },
  thornpass_3: { id: 'thornpass_3', type: 'vacant', neighbors: [], coordinates: { x: 2, y: 4 } },

  // --- River Rapids (one-way west→east; exits at the eastern stockbroker) ---
  rapids_1: { id: 'rapids_1', type: 'property', neighbors: ['venture_mid'], coordinates: { x: 4, y: 3 } },
  venture_mid: { id: 'venture_mid', type: 'venture', neighbors: ['rapids_2'], coordinates: { x: 6, y: 3 } },
  rapids_2: { id: 'rapids_2', type: 'property', neighbors: ['stockbroker_east'], coordinates: { x: 8, y: 3 } },
};

// All four rapids edges stay directed — the current is too strong to go back.
const MISTRAL_ONE_WAY: ReadonlyArray<readonly [string, string]> = [
  ['thornpass_2', 'rapids_1'],
  ['rapids_1', 'venture_mid'],
  ['venture_mid', 'rapids_2'],
  ['rapids_2', 'stockbroker_east'],
];

const MISTRAL_PROPERTIES: Record<string, Property> = {
  seaford_1: { id: 'seaford_1', nodeId: 'seaford_1', districtId: 'seaford', ownerId: null, basePrice: 160, currentPrice: 160, baseRent: 13, currentRent: 13, capitalInvested: 0, maxCapital: 320, shopMultiplier: 1 },
  seaford_2: { id: 'seaford_2', nodeId: 'seaford_2', districtId: 'seaford', ownerId: null, basePrice: 180, currentPrice: 180, baseRent: 15, currentRent: 15, capitalInvested: 0, maxCapital: 360, shopMultiplier: 1 },

  ashbury_1: { id: 'ashbury_1', nodeId: 'ashbury_1', districtId: 'ashbury', ownerId: null, basePrice: 200, currentPrice: 200, baseRent: 16, currentRent: 16, capitalInvested: 0, maxCapital: 400, shopMultiplier: 1 },
  ashbury_2: { id: 'ashbury_2', nodeId: 'ashbury_2', districtId: 'ashbury', ownerId: null, basePrice: 220, currentPrice: 220, baseRent: 18, currentRent: 18, capitalInvested: 0, maxCapital: 440, shopMultiplier: 1 },
  ashbury_3: { id: 'ashbury_3', nodeId: 'ashbury_3', districtId: 'ashbury', ownerId: null, basePrice: 240, currentPrice: 240, baseRent: 20, currentRent: 20, capitalInvested: 0, maxCapital: 480, shopMultiplier: 1 },

  northgate_1: { id: 'northgate_1', nodeId: 'northgate_1', districtId: 'northgate', ownerId: null, basePrice: 260, currentPrice: 260, baseRent: 22, currentRent: 22, capitalInvested: 0, maxCapital: 520, shopMultiplier: 1 },
  northgate_2: { id: 'northgate_2', nodeId: 'northgate_2', districtId: 'northgate', ownerId: null, basePrice: 280, currentPrice: 280, baseRent: 24, currentRent: 24, capitalInvested: 0, maxCapital: 560, shopMultiplier: 1 },
  northgate_3: { id: 'northgate_3', nodeId: 'northgate_3', districtId: 'northgate', ownerId: null, basePrice: 200, currentPrice: 200, baseRent: 0, currentRent: 0, capitalInvested: 0, maxCapital: 0, shopMultiplier: 1, buildingType: 'vacant', checkpointToll: 50, circusLevel: 0 },

  eastport_1: { id: 'eastport_1', nodeId: 'eastport_1', districtId: 'eastport', ownerId: null, basePrice: 320, currentPrice: 320, baseRent: 28, currentRent: 28, capitalInvested: 0, maxCapital: 640, shopMultiplier: 1 },
  eastport_2: { id: 'eastport_2', nodeId: 'eastport_2', districtId: 'eastport', ownerId: null, basePrice: 340, currentPrice: 340, baseRent: 30, currentRent: 30, capitalInvested: 0, maxCapital: 680, shopMultiplier: 1 },

  sunder_1: { id: 'sunder_1', nodeId: 'sunder_1', districtId: 'sunder', ownerId: null, basePrice: 300, currentPrice: 300, baseRent: 26, currentRent: 26, capitalInvested: 0, maxCapital: 600, shopMultiplier: 1 },
  sunder_2: { id: 'sunder_2', nodeId: 'sunder_2', districtId: 'sunder', ownerId: null, basePrice: 320, currentPrice: 320, baseRent: 28, currentRent: 28, capitalInvested: 0, maxCapital: 640, shopMultiplier: 1 },

  silverbrook_1: { id: 'silverbrook_1', nodeId: 'silverbrook_1', districtId: 'silverbrook', ownerId: null, basePrice: 240, currentPrice: 240, baseRent: 20, currentRent: 20, capitalInvested: 0, maxCapital: 480, shopMultiplier: 1 },
  silverbrook_2: { id: 'silverbrook_2', nodeId: 'silverbrook_2', districtId: 'silverbrook', ownerId: null, basePrice: 260, currentPrice: 260, baseRent: 22, currentRent: 22, capitalInvested: 0, maxCapital: 520, shopMultiplier: 1 },
  silverbrook_3: { id: 'silverbrook_3', nodeId: 'silverbrook_3', districtId: 'silverbrook', ownerId: null, basePrice: 280, currentPrice: 280, baseRent: 24, currentRent: 24, capitalInvested: 0, maxCapital: 560, shopMultiplier: 1 },
  westvale_1: { id: 'westvale_1', nodeId: 'westvale_1', districtId: 'silverbrook', ownerId: null, basePrice: 300, currentPrice: 300, baseRent: 26, currentRent: 26, capitalInvested: 0, maxCapital: 600, shopMultiplier: 1 },

  thornpass_1: { id: 'thornpass_1', nodeId: 'thornpass_1', districtId: 'thornpass', ownerId: null, basePrice: 220, currentPrice: 220, baseRent: 18, currentRent: 18, capitalInvested: 0, maxCapital: 440, shopMultiplier: 1 },
  thornpass_2: { id: 'thornpass_2', nodeId: 'thornpass_2', districtId: 'thornpass', ownerId: null, basePrice: 240, currentPrice: 240, baseRent: 20, currentRent: 20, capitalInvested: 0, maxCapital: 480, shopMultiplier: 1 },
  thornpass_3: { id: 'thornpass_3', nodeId: 'thornpass_3', districtId: 'thornpass', ownerId: null, basePrice: 200, currentPrice: 200, baseRent: 0, currentRent: 0, capitalInvested: 0, maxCapital: 0, shopMultiplier: 1, buildingType: 'vacant', checkpointToll: 50, circusLevel: 0 },

  // Rapids shops: cheap to buy, high rent — risky one-way territory.
  rapids_1: { id: 'rapids_1', nodeId: 'rapids_1', districtId: 'rapids', ownerId: null, basePrice: 180, currentPrice: 180, baseRent: 28, currentRent: 28, capitalInvested: 0, maxCapital: 360, shopMultiplier: 1 },
  rapids_2: { id: 'rapids_2', nodeId: 'rapids_2', districtId: 'rapids', ownerId: null, basePrice: 180, currentPrice: 180, baseRent: 28, currentRent: 28, capitalInvested: 0, maxCapital: 360, shopMultiplier: 1 },
};

const MISTRAL_DISTRICTS: Record<string, District> = {
  seaford:   { id: 'seaford',   name: 'Seaford',   stockPrice: 6,  propertyIds: ['seaford_1', 'seaford_2'], playerHoldings: {} },
  ashbury:    { id: 'ashbury',    name: 'Ashbury',    stockPrice: 8,  propertyIds: ['ashbury_1', 'ashbury_2', 'ashbury_3'], playerHoldings: {} },
  northgate:     { id: 'northgate',     name: 'Northgate',     stockPrice: 9,  propertyIds: ['northgate_1', 'northgate_2', 'northgate_3'], playerHoldings: {} },
  eastport:      { id: 'eastport',      name: 'Eastport',      stockPrice: 13, propertyIds: ['eastport_1', 'eastport_2'], playerHoldings: {} },
  sunder:      { id: 'sunder',      name: 'Sunder',      stockPrice: 10, propertyIds: ['sunder_1', 'sunder_2'], playerHoldings: {} },
  silverbrook: { id: 'silverbrook', name: 'Silverbrook', stockPrice: 10, propertyIds: ['silverbrook_1', 'silverbrook_2', 'silverbrook_3', 'westvale_1'], playerHoldings: {} },
  thornpass:       { id: 'thornpass',       name: 'Thornpass',       stockPrice: 8,  propertyIds: ['thornpass_1', 'thornpass_2', 'thornpass_3'], playerHoldings: {} },
  rapids:     { id: 'rapids',     name: 'Rapids',     stockPrice: 7,  propertyIds: ['rapids_1', 'rapids_2'], playerHoldings: {} },
};

// ─── Aldoria — twin loops crossing at the bank ──────────────
//
// A figure-eight: the west and east loops share the central spine
// (Temple Shrine ☕ → Bank → Crown Tax 🏛), so every lap crosses the bank.
// The Gold Road chord cuts across the west loop through the western broker.
// Desert wind blows the eastern caravan one-way west→east along the top.
// Farisle is a premium island inside the east loop: warp in from the Roma
// Road, walk its shops, warp out to Aldoria.

const ALDORIA_BOARD: Record<string, Node> = {
  // --- Central spine ---
  temple_break: { id: 'temple_break', type: 'break', neighbors: ['bank', 'goldvale_1', 'sunspire_1'], coordinates: { x: 6, y: 1 } },
  bank: { id: 'bank', type: 'bank', neighbors: ['crown_tax'], coordinates: { x: 6, y: 2 } },
  crown_tax: { id: 'crown_tax', type: 'tax_office', neighbors: [], coordinates: { x: 6, y: 3 } },

  // --- West loop (Goldvale north, Aldoria south) ---
  goldvale_1: { id: 'goldvale_1', type: 'property', neighbors: ['goldvale_casino'], coordinates: { x: 5, y: 0 } },
  goldvale_casino: { id: 'goldvale_casino', type: 'casino', neighbors: ['goldvale_2'], coordinates: { x: 4, y: 0 } },
  goldvale_2: { id: 'goldvale_2', type: 'property', neighbors: ['heart_suit'], coordinates: { x: 3, y: 0 } },
  heart_suit: { id: 'heart_suit', type: 'suit', suit: 'heart', neighbors: ['frostmere_1'], coordinates: { x: 2, y: 0 } },
  frostmere_1: { id: 'frostmere_1', type: 'property', neighbors: ['alley_c1'], coordinates: { x: 1, y: 0 } },
  // Backstreet C (north-west) — alley shortcut across to alley_c2 in the east loop.
  alley_c1: { id: 'alley_c1', type: 'backstreet', backstreetGroup: 'C', neighbors: ['frostmere_2'], coordinates: { x: 0, y: 0 } },
  frostmere_2: { id: 'frostmere_2', type: 'property', neighbors: ['stonereach_vac'], coordinates: { x: 0, y: 1 } },
  stonereach_vac: { id: 'stonereach_vac', type: 'vacant', neighbors: ['stonereach_1', 'stockbroker_west'], coordinates: { x: 0, y: 2 } },
  stonereach_1: { id: 'stonereach_1', type: 'property', neighbors: ['spade_suit'], coordinates: { x: 0, y: 3 } },
  spade_suit: { id: 'spade_suit', type: 'suit', suit: 'spade', neighbors: ['aldoria_1'], coordinates: { x: 1, y: 4 } },
  aldoria_1: { id: 'aldoria_1', type: 'property', neighbors: ['aldoria_2'], coordinates: { x: 2, y: 4 } },
  aldoria_2: { id: 'aldoria_2', type: 'property', neighbors: ['cannon_aldoria'], coordinates: { x: 3, y: 4 } },
  // Cannon — blasts the lander onto a random rival's square.
  cannon_aldoria: { id: 'cannon_aldoria', type: 'cannon', neighbors: ['aldoria_3'], coordinates: { x: 3.5, y: 5 } },
  aldoria_3: { id: 'aldoria_3', type: 'property', neighbors: ['venture_west'], coordinates: { x: 4, y: 4 } },
  venture_west: { id: 'venture_west', type: 'venture', neighbors: ['crown_tax'], coordinates: { x: 5, y: 4 } },

  // --- Gold Road (west chord through the broker) ---
  stockbroker_west: { id: 'stockbroker_west', type: 'stockbroker', neighbors: ['gold_road_1'], coordinates: { x: 1, y: 2 } },
  gold_road_1: { id: 'gold_road_1', type: 'property', neighbors: ['gold_road_2'], coordinates: { x: 2, y: 2 } },
  gold_road_2: { id: 'gold_road_2', type: 'property', neighbors: ['bank', 'warp_to_farisle'], coordinates: { x: 4, y: 2 } },
  warp_to_farisle: { id: 'warp_to_farisle', type: 'warp', pairedNodeId: 'farisle_in', neighbors: [], coordinates: { x: 5, y: 1 } },

  // --- East loop (Sunspire desert north, Spicewell south) ---
  sunspire_1: { id: 'sunspire_1', type: 'property', neighbors: ['sunspire_2'], coordinates: { x: 7, y: 0 } },
  sunspire_2: { id: 'sunspire_2', type: 'property', neighbors: ['diamond_suit'], coordinates: { x: 8, y: 0 } },
  diamond_suit: { id: 'diamond_suit', type: 'suit', suit: 'diamond', neighbors: ['sunspire_3'], coordinates: { x: 9, y: 0 } },
  sunspire_3: { id: 'sunspire_3', type: 'property', neighbors: ['porthaven_1'], coordinates: { x: 10, y: 0 } },
  porthaven_1: { id: 'porthaven_1', type: 'property', neighbors: ['rollon_porthaven'], coordinates: { x: 11, y: 0 } },
  // Roll-on — land here and immediately take another roll.
  rollon_porthaven: { id: 'rollon_porthaven', type: 'roll_on', neighbors: ['porthaven_2'], coordinates: { x: 12, y: 0 } },
  porthaven_2: { id: 'porthaven_2', type: 'property', neighbors: ['stockbroker_east'], coordinates: { x: 12, y: 1 } },
  stockbroker_east: { id: 'stockbroker_east', type: 'stockbroker', neighbors: ['spicewell_1'], coordinates: { x: 12, y: 2 } },
  spicewell_1: { id: 'spicewell_1', type: 'property', neighbors: ['alley_c2'], coordinates: { x: 12, y: 3 } },
  // Backstreet C (east) — the other end of the alley_c1 shortcut.
  alley_c2: { id: 'alley_c2', type: 'backstreet', backstreetGroup: 'C', neighbors: ['spicewell_2'], coordinates: { x: 12, y: 4 } },
  spicewell_2: { id: 'spicewell_2', type: 'property', neighbors: ['club_suit'], coordinates: { x: 11, y: 4 } },
  club_suit: { id: 'club_suit', type: 'suit', suit: 'club', cycleSuit: true, neighbors: ['spicewell_3'], coordinates: { x: 10, y: 4 } },
  spicewell_3: { id: 'spicewell_3', type: 'property', neighbors: ['venture_east'], coordinates: { x: 9, y: 4 } },
  venture_east: { id: 'venture_east', type: 'venture', neighbors: ['mirador_vac'], coordinates: { x: 8, y: 4 } },
  mirador_vac: { id: 'mirador_vac', type: 'boom', neighbors: ['crown_tax'], coordinates: { x: 7, y: 4 } },

  // --- Farisle island (inside the east loop; warp in, warp out) ---
  farisle_in: { id: 'farisle_in', type: 'property', neighbors: ['farisle_1'], coordinates: { x: 8, y: 2 } },
  farisle_1: { id: 'farisle_1', type: 'property', neighbors: ['farisle_2'], coordinates: { x: 9, y: 2 } },
  farisle_2: { id: 'farisle_2', type: 'property', neighbors: ['farisle_warp_out'], coordinates: { x: 10, y: 2 } },
  farisle_warp_out: { id: 'farisle_warp_out', type: 'warp', pairedNodeId: 'aldoria_1', neighbors: [], coordinates: { x: 11, y: 2 } },
};

// Desert wind: the Sunspire caravan only travels west→east along the top row.
const ALDORIA_ONE_WAY: ReadonlyArray<readonly [string, string]> = [
  ['sunspire_1', 'sunspire_2'],
  ['sunspire_2', 'diamond_suit'],
];

const ALDORIA_PROPERTIES: Record<string, Property> = {
  aldoria_1: { id: 'aldoria_1', nodeId: 'aldoria_1', districtId: 'aldoria', ownerId: null, basePrice: 140, currentPrice: 140, baseRent: 12, currentRent: 12, capitalInvested: 0, maxCapital: 280, shopMultiplier: 1 },
  aldoria_2: { id: 'aldoria_2', nodeId: 'aldoria_2', districtId: 'aldoria', ownerId: null, basePrice: 160, currentPrice: 160, baseRent: 14, currentRent: 14, capitalInvested: 0, maxCapital: 320, shopMultiplier: 1 },
  aldoria_3: { id: 'aldoria_3', nodeId: 'aldoria_3', districtId: 'aldoria', ownerId: null, basePrice: 180, currentPrice: 180, baseRent: 15, currentRent: 15, capitalInvested: 0, maxCapital: 360, shopMultiplier: 1 },

  frostmere_1: { id: 'frostmere_1', nodeId: 'frostmere_1', districtId: 'frostmere', ownerId: null, basePrice: 190, currentPrice: 190, baseRent: 16, currentRent: 16, capitalInvested: 0, maxCapital: 380, shopMultiplier: 1 },
  frostmere_2: { id: 'frostmere_2', nodeId: 'frostmere_2', districtId: 'frostmere', ownerId: null, basePrice: 210, currentPrice: 210, baseRent: 18, currentRent: 18, capitalInvested: 0, maxCapital: 420, shopMultiplier: 1 },

  stonereach_vac: { id: 'stonereach_vac', nodeId: 'stonereach_vac', districtId: 'stonereach', ownerId: null, basePrice: 200, currentPrice: 200, baseRent: 0, currentRent: 0, capitalInvested: 0, maxCapital: 0, shopMultiplier: 1, buildingType: 'vacant', checkpointToll: 50, circusLevel: 0 },
  stonereach_1: { id: 'stonereach_1', nodeId: 'stonereach_1', districtId: 'stonereach', ownerId: null, basePrice: 220, currentPrice: 220, baseRent: 18, currentRent: 18, capitalInvested: 0, maxCapital: 440, shopMultiplier: 1 },

  goldvale_1: { id: 'goldvale_1', nodeId: 'goldvale_1', districtId: 'goldvale', ownerId: null, basePrice: 240, currentPrice: 240, baseRent: 20, currentRent: 20, capitalInvested: 0, maxCapital: 480, shopMultiplier: 1 },
  goldvale_2: { id: 'goldvale_2', nodeId: 'goldvale_2', districtId: 'goldvale', ownerId: null, basePrice: 260, currentPrice: 260, baseRent: 22, currentRent: 22, capitalInvested: 0, maxCapital: 520, shopMultiplier: 1 },
  gold_road_1: { id: 'gold_road_1', nodeId: 'gold_road_1', districtId: 'goldvale', ownerId: null, basePrice: 280, currentPrice: 280, baseRent: 24, currentRent: 24, capitalInvested: 0, maxCapital: 560, shopMultiplier: 1 },
  gold_road_2: { id: 'gold_road_2', nodeId: 'gold_road_2', districtId: 'goldvale', ownerId: null, basePrice: 300, currentPrice: 300, baseRent: 26, currentRent: 26, capitalInvested: 0, maxCapital: 600, shopMultiplier: 1 },

  sunspire_1: { id: 'sunspire_1', nodeId: 'sunspire_1', districtId: 'sunspire', ownerId: null, basePrice: 260, currentPrice: 260, baseRent: 22, currentRent: 22, capitalInvested: 0, maxCapital: 520, shopMultiplier: 1 },
  sunspire_2: { id: 'sunspire_2', nodeId: 'sunspire_2', districtId: 'sunspire', ownerId: null, basePrice: 280, currentPrice: 280, baseRent: 24, currentRent: 24, capitalInvested: 0, maxCapital: 560, shopMultiplier: 1 },
  sunspire_3: { id: 'sunspire_3', nodeId: 'sunspire_3', districtId: 'sunspire', ownerId: null, basePrice: 300, currentPrice: 300, baseRent: 26, currentRent: 26, capitalInvested: 0, maxCapital: 600, shopMultiplier: 1 },

  porthaven_1: { id: 'porthaven_1', nodeId: 'porthaven_1', districtId: 'porthaven', ownerId: null, basePrice: 340, currentPrice: 340, baseRent: 29, currentRent: 29, capitalInvested: 0, maxCapital: 680, shopMultiplier: 1 },
  porthaven_2: { id: 'porthaven_2', nodeId: 'porthaven_2', districtId: 'porthaven', ownerId: null, basePrice: 360, currentPrice: 360, baseRent: 31, currentRent: 31, capitalInvested: 0, maxCapital: 720, shopMultiplier: 1 },

  spicewell_1: { id: 'spicewell_1', nodeId: 'spicewell_1', districtId: 'spicewell', ownerId: null, basePrice: 380, currentPrice: 380, baseRent: 32, currentRent: 32, capitalInvested: 0, maxCapital: 760, shopMultiplier: 1 },
  spicewell_2: { id: 'spicewell_2', nodeId: 'spicewell_2', districtId: 'spicewell', ownerId: null, basePrice: 400, currentPrice: 400, baseRent: 34, currentRent: 34, capitalInvested: 0, maxCapital: 800, shopMultiplier: 1 },
  spicewell_3: { id: 'spicewell_3', nodeId: 'spicewell_3', districtId: 'spicewell', ownerId: null, basePrice: 420, currentPrice: 420, baseRent: 36, currentRent: 36, capitalInvested: 0, maxCapital: 840, shopMultiplier: 1 },

  farisle_in: { id: 'farisle_in', nodeId: 'farisle_in', districtId: 'farisle', ownerId: null, basePrice: 450, currentPrice: 450, baseRent: 38, currentRent: 38, capitalInvested: 0, maxCapital: 900, shopMultiplier: 1 },
  farisle_1: { id: 'farisle_1', nodeId: 'farisle_1', districtId: 'farisle', ownerId: null, basePrice: 550, currentPrice: 550, baseRent: 47, currentRent: 47, capitalInvested: 0, maxCapital: 1100, shopMultiplier: 1 },
  farisle_2: { id: 'farisle_2', nodeId: 'farisle_2', districtId: 'farisle', ownerId: null, basePrice: 650, currentPrice: 650, baseRent: 55, currentRent: 55, capitalInvested: 0, maxCapital: 1300, shopMultiplier: 1 },
};

const ALDORIA_DISTRICTS: Record<string, District> = {
  aldoria:  { id: 'aldoria',  name: 'Aldoria',  stockPrice: 6,  propertyIds: ['aldoria_1', 'aldoria_2', 'aldoria_3'], playerHoldings: {} },
  frostmere: { id: 'frostmere', name: 'Frostmere', stockPrice: 8,  propertyIds: ['frostmere_1', 'frostmere_2'], playerHoldings: {} },
  stonereach:   { id: 'stonereach',   name: 'Stonereach',   stockPrice: 8,  propertyIds: ['stonereach_vac', 'stonereach_1'], playerHoldings: {} },
  goldvale:   { id: 'goldvale',   name: 'Goldvale',   stockPrice: 10, propertyIds: ['goldvale_1', 'goldvale_2', 'gold_road_1', 'gold_road_2'], playerHoldings: {} },
  sunspire:     { id: 'sunspire',     name: 'Sunspire',     stockPrice: 11, propertyIds: ['sunspire_1', 'sunspire_2', 'sunspire_3'], playerHoldings: {} },
  porthaven:  { id: 'porthaven',  name: 'Porthaven',  stockPrice: 14, propertyIds: ['porthaven_1', 'porthaven_2'], playerHoldings: {} },
  spicewell: { id: 'spicewell', name: 'Spicewell', stockPrice: 14, propertyIds: ['spicewell_1', 'spicewell_2', 'spicewell_3'], playerHoldings: {} },
  farisle:   { id: 'farisle',   name: 'Farisle',   stockPrice: 22, propertyIds: ['farisle_in', 'farisle_1', 'farisle_2'], playerHoldings: {} },
};

// ─── Registry ──────────────────────────────────────────────────────────────────

export const BOARDS: Record<string, BoardDef> = {
  eldermoor: {
    id: 'eldermoor',
    name: 'Eldermoor',
    suggestedTarget: 5000,
    board: ELDERMOOR_BOARD,
    properties: ELDERMOOR_PROPERTIES,
    districts: ELDERMOOR_DISTRICTS,
    oneWayEdges: [],
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral',
    suggestedTarget: 9000,
    board: MISTRAL_BOARD,
    properties: MISTRAL_PROPERTIES,
    districts: MISTRAL_DISTRICTS,
    oneWayEdges: MISTRAL_ONE_WAY,
  },
  aldoria: {
    id: 'aldoria',
    name: 'Aldoria',
    suggestedTarget: 7000,
    board: ALDORIA_BOARD,
    properties: ALDORIA_PROPERTIES,
    districts: ALDORIA_DISTRICTS,
    oneWayEdges: ALDORIA_ONE_WAY,
  },
};

export const DEFAULT_BOARD_ID = 'eldermoor';
