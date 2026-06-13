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

// ─── Alefgard (Dragon Quest I) — the original board ───────────────────────────

const ALEFGARD_BOARD: Record<string, Node> = {
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
  kol_1: { id: 'kol_1', type: 'property', neighbors: ['alley_a1'], coordinates: { x: 7, y: 0 } },
  // Backstreet A (north) — slips across the map to alley_a2 in the southwest.
  alley_a1: { id: 'alley_a1', type: 'backstreet', backstreetGroup: 'A', neighbors: ['kol_2'], coordinates: { x: 7.5, y: -1 } },
  kol_2: { id: 'kol_2', type: 'property', neighbors: ['break_inn'], coordinates: { x: 8, y: 0 } },
  break_inn: { id: 'break_inn', type: 'break', neighbors: ['diamond_suit'], coordinates: { x: 9, y: 0 } },
  diamond_suit: { id: 'diamond_suit', type: 'suit', suit: 'diamond', neighbors: ['kol_3'], coordinates: { x: 10, y: 0 } },
  kol_3: { id: 'kol_3', type: 'boon', neighbors: ['kol_4'], coordinates: { x: 10, y: 1 } },
  kol_4: { id: 'kol_4', type: 'property', neighbors: ['kol_5'], coordinates: { x: 9, y: 1 } },
  kol_5: { id: 'kol_5', type: 'property', neighbors: ['stockbroker_east'], coordinates: { x: 8, y: 1 } },
  stockbroker_east: { id: 'stockbroker_east', type: 'stockbroker', neighbors: ['cantlin_1'], coordinates: { x: 7, y: 1 } },

  // --- Cantlin Area (East / Center Transition) ---
  cantlin_1: { id: 'cantlin_1', type: 'property', neighbors: ['cantlin_2'], coordinates: { x: 7, y: 2 } },
  cantlin_2: { id: 'cantlin_2', type: 'property', neighbors: ['cantlin_3'], coordinates: { x: 8, y: 2 } },
  cantlin_3: { id: 'cantlin_3', type: 'property', neighbors: ['rimuldar_1'], coordinates: { x: 9, y: 2 } },

  // --- Rimuldar Area (Southeast) ---
  rimuldar_1: { id: 'rimuldar_1', type: 'property', neighbors: ['rollon_east'], coordinates: { x: 10, y: 2 } },
  // Roll-on — land here and immediately take another roll.
  rollon_east: { id: 'rollon_east', type: 'roll_on', neighbors: ['rimuldar_2'], coordinates: { x: 11, y: 2.5 } },
  rimuldar_2: { id: 'rimuldar_2', type: 'property', neighbors: ['club_suit'], coordinates: { x: 10, y: 3 } },
  club_suit: { id: 'club_suit', type: 'suit', suit: 'club', cycleSuit: true, neighbors: ['rimuldar_3'], coordinates: { x: 10, y: 4 } },
  rimuldar_3: { id: 'rimuldar_3', type: 'vacant', neighbors: ['rimuldar_4'], coordinates: { x: 9, y: 4 } },
  rimuldar_4: { id: 'rimuldar_4', type: 'property', neighbors: ['rimuldar_5'], coordinates: { x: 9, y: 3 } },
  rimuldar_5: { id: 'rimuldar_5', type: 'property', neighbors: ['rimuldar_6'], coordinates: { x: 8, y: 3 } },
  rimuldar_6: { id: 'rimuldar_6', type: 'property', neighbors: ['bridge_south_2', 'warp_to_charlock_2'], coordinates: { x: 8, y: 4 } },

  // --- Warp south ---
  warp_to_charlock_2: { id: 'warp_to_charlock_2', type: 'warp', pairedNodeId: 'charlock_warp_in_2', neighbors: [], coordinates: { x: 7, y: 4 } },

  // --- South Bridge ---
  bridge_south_2: { id: 'bridge_south_2', type: 'property', neighbors: ['venture_south'], coordinates: { x: 6, y: 4 } },
  venture_south: { id: 'venture_south', type: 'casino', neighbors: ['bridge_south_1'], coordinates: { x: 5, y: 4 } },
  bridge_south_1: { id: 'bridge_south_1', type: 'property', neighbors: ['domdora_1'], coordinates: { x: 4, y: 4 } },

  // --- Domdora Area (Southwest) ---
  domdora_1: { id: 'domdora_1', type: 'property', neighbors: ['cannon_dom'], coordinates: { x: 3, y: 4 } },
  // Cannon — blasts the lander onto a random rival's square.
  cannon_dom: { id: 'cannon_dom', type: 'cannon', neighbors: ['domdora_2'], coordinates: { x: 2.5, y: 5 } },
  domdora_2: { id: 'domdora_2', type: 'property', neighbors: ['domdora_3'], coordinates: { x: 2, y: 4 } },
  domdora_3: { id: 'domdora_3', type: 'vacant', neighbors: ['domdora_4'], coordinates: { x: 1, y: 4 } },
  domdora_4: { id: 'domdora_4', type: 'property', neighbors: ['alley_a2'], coordinates: { x: 0, y: 4 } },
  // Backstreet A (southwest) — the other end of the alley_a1 shortcut.
  alley_a2: { id: 'alley_a2', type: 'backstreet', backstreetGroup: 'A', neighbors: ['domdora_5'], coordinates: { x: -1, y: 3.5 } },
  domdora_5: { id: 'domdora_5', type: 'property', neighbors: ['domdora_6'], coordinates: { x: 0, y: 3 } },
  domdora_6: { id: 'domdora_6', type: 'property', neighbors: ['stockbroker_west'], coordinates: { x: 1, y: 3 } },
  stockbroker_west: { id: 'stockbroker_west', type: 'stockbroker', neighbors: ['domdora_7'], coordinates: { x: 2, y: 3 } },
  domdora_7: { id: 'domdora_7', type: 'property', neighbors: ['bank'], coordinates: { x: 3, y: 3 } },

  // --- Charlock Castle Area (Central Island) ---
  // The island loops internally (no dead-end entrance) and has a taxed land
  // exit east through the Charlock Gate to the stockbroker.
  charlock_warp_in_1: { id: 'charlock_warp_in_1', type: 'property', neighbors: ['charlock_2', 'charlock_1'], coordinates: { x: 4, y: 2 } },
  charlock_2: { id: 'charlock_2', type: 'property', neighbors: ['charlock_1', 'charlock_gate'], coordinates: { x: 5, y: 1 } },
  charlock_gate: { id: 'charlock_gate', type: 'tax_office', neighbors: ['stockbroker_east'], coordinates: { x: 6, y: 1 } },
  charlock_1: { id: 'charlock_1', type: 'property', neighbors: ['charlock_3'], coordinates: { x: 5, y: 2 } },
  charlock_3: { id: 'charlock_3', type: 'property', neighbors: ['charlock_warp_in_2'], coordinates: { x: 5, y: 3 } },
  charlock_warp_in_2: { id: 'charlock_warp_in_2', type: 'property', neighbors: ['charlock_warp_out_1'], coordinates: { x: 6, y: 2 } },
  charlock_warp_out_1: { id: 'charlock_warp_out_1', type: 'warp', pairedNodeId: 'domdora_6', neighbors: [], coordinates: { x: 6, y: 3 } },
};

const ALEFGARD_PROPERTIES: Record<string, Property> = {
  tantegel_1: { id: 'tantegel_1', nodeId: 'tantegel_1', districtId: 'tantegel', ownerId: null, basePrice: 150, currentPrice: 150, baseRent: 12, currentRent: 12, capitalInvested: 0, maxCapital: 300, shopMultiplier: 1 },
  tantegel_2: { id: 'tantegel_2', nodeId: 'tantegel_2', districtId: 'tantegel', ownerId: null, basePrice: 200, currentPrice: 200, baseRent: 0, currentRent: 0, capitalInvested: 0, maxCapital: 0, shopMultiplier: 1, buildingType: 'vacant', checkpointToll: 50, circusLevel: 0 },

  garinham_1: { id: 'garinham_1', nodeId: 'garinham_1', districtId: 'garinham', ownerId: null, basePrice: 200, currentPrice: 200, baseRent: 16, currentRent: 16, capitalInvested: 0, maxCapital: 400, shopMultiplier: 1 },
  garinham_2: { id: 'garinham_2', nodeId: 'garinham_2', districtId: 'garinham', ownerId: null, basePrice: 220, currentPrice: 220, baseRent: 18, currentRent: 18, capitalInvested: 0, maxCapital: 440, shopMultiplier: 1 },
  garinham_3: { id: 'garinham_3', nodeId: 'garinham_3', districtId: 'garinham', ownerId: null, basePrice: 240, currentPrice: 240, baseRent: 20, currentRent: 20, capitalInvested: 0, maxCapital: 480, shopMultiplier: 1 },
  garinham_4: { id: 'garinham_4', nodeId: 'garinham_4', districtId: 'garinham', ownerId: null, basePrice: 250, currentPrice: 250, baseRent: 21, currentRent: 21, capitalInvested: 0, maxCapital: 500, shopMultiplier: 1 },
  garinham_5: { id: 'garinham_5', nodeId: 'garinham_5', districtId: 'garin_pass', ownerId: null, basePrice: 260, currentPrice: 260, baseRent: 22, currentRent: 22, capitalInvested: 0, maxCapital: 520, shopMultiplier: 1 },
  garinham_6: { id: 'garinham_6', nodeId: 'garinham_6', districtId: 'garin_pass', ownerId: null, basePrice: 280, currentPrice: 280, baseRent: 24, currentRent: 24, capitalInvested: 0, maxCapital: 560, shopMultiplier: 1 },

  bridge_north_1: { id: 'bridge_north_1', nodeId: 'bridge_north_1', districtId: 'bridges', ownerId: null, basePrice: 180, currentPrice: 180, baseRent: 15, currentRent: 15, capitalInvested: 0, maxCapital: 360, shopMultiplier: 1 },
  bridge_north_2: { id: 'bridge_north_2', nodeId: 'bridge_north_2', districtId: 'bridges', ownerId: null, basePrice: 180, currentPrice: 180, baseRent: 15, currentRent: 15, capitalInvested: 0, maxCapital: 360, shopMultiplier: 1 },

  kol_1: { id: 'kol_1', nodeId: 'kol_1', districtId: 'kol', ownerId: null, basePrice: 220, currentPrice: 220, baseRent: 18, currentRent: 18, capitalInvested: 0, maxCapital: 440, shopMultiplier: 1 },
  kol_2: { id: 'kol_2', nodeId: 'kol_2', districtId: 'kol', ownerId: null, basePrice: 240, currentPrice: 240, baseRent: 20, currentRent: 20, capitalInvested: 0, maxCapital: 480, shopMultiplier: 1 },
  kol_4: { id: 'kol_4', nodeId: 'kol_4', districtId: 'kol', ownerId: null, basePrice: 280, currentPrice: 280, baseRent: 24, currentRent: 24, capitalInvested: 0, maxCapital: 560, shopMultiplier: 1 },
  kol_5: { id: 'kol_5', nodeId: 'kol_5', districtId: 'kol', ownerId: null, basePrice: 300, currentPrice: 300, baseRent: 26, currentRent: 26, capitalInvested: 0, maxCapital: 600, shopMultiplier: 1 },

  cantlin_1: { id: 'cantlin_1', nodeId: 'cantlin_1', districtId: 'cantlin', ownerId: null, basePrice: 300, currentPrice: 300, baseRent: 26, currentRent: 26, capitalInvested: 0, maxCapital: 600, shopMultiplier: 1 },
  cantlin_2: { id: 'cantlin_2', nodeId: 'cantlin_2', districtId: 'cantlin', ownerId: null, basePrice: 320, currentPrice: 320, baseRent: 28, currentRent: 28, capitalInvested: 0, maxCapital: 640, shopMultiplier: 1 },
  cantlin_3: { id: 'cantlin_3', nodeId: 'cantlin_3', districtId: 'cantlin', ownerId: null, basePrice: 340, currentPrice: 340, baseRent: 30, currentRent: 30, capitalInvested: 0, maxCapital: 680, shopMultiplier: 1 },

  rimuldar_1: { id: 'rimuldar_1', nodeId: 'rimuldar_1', districtId: 'rimuldar', ownerId: null, basePrice: 320, currentPrice: 320, baseRent: 28, currentRent: 28, capitalInvested: 0, maxCapital: 640, shopMultiplier: 1 },
  rimuldar_2: { id: 'rimuldar_2', nodeId: 'rimuldar_2', districtId: 'rimuldar', ownerId: null, basePrice: 340, currentPrice: 340, baseRent: 30, currentRent: 30, capitalInvested: 0, maxCapital: 680, shopMultiplier: 1 },
  rimuldar_3: { id: 'rimuldar_3', nodeId: 'rimuldar_3', districtId: 'rimuldar', ownerId: null, basePrice: 200, currentPrice: 200, baseRent: 0, currentRent: 0, capitalInvested: 0, maxCapital: 0, shopMultiplier: 1, buildingType: 'vacant', checkpointToll: 50, circusLevel: 0 },
  rimuldar_4: { id: 'rimuldar_4', nodeId: 'rimuldar_4', districtId: 'galenholm', ownerId: null, basePrice: 380, currentPrice: 380, baseRent: 34, currentRent: 34, capitalInvested: 0, maxCapital: 760, shopMultiplier: 1 },
  rimuldar_5: { id: 'rimuldar_5', nodeId: 'rimuldar_5', districtId: 'galenholm', ownerId: null, basePrice: 400, currentPrice: 400, baseRent: 36, currentRent: 36, capitalInvested: 0, maxCapital: 800, shopMultiplier: 1 },
  rimuldar_6: { id: 'rimuldar_6', nodeId: 'rimuldar_6', districtId: 'galenholm', ownerId: null, basePrice: 420, currentPrice: 420, baseRent: 38, currentRent: 38, capitalInvested: 0, maxCapital: 840, shopMultiplier: 1 },

  bridge_south_1: { id: 'bridge_south_1', nodeId: 'bridge_south_1', districtId: 'bridges', ownerId: null, basePrice: 180, currentPrice: 180, baseRent: 15, currentRent: 15, capitalInvested: 0, maxCapital: 360, shopMultiplier: 1 },
  bridge_south_2: { id: 'bridge_south_2', nodeId: 'bridge_south_2', districtId: 'bridges', ownerId: null, basePrice: 180, currentPrice: 180, baseRent: 15, currentRent: 15, capitalInvested: 0, maxCapital: 360, shopMultiplier: 1 },

  domdora_1: { id: 'domdora_1', nodeId: 'domdora_1', districtId: 'domdora', ownerId: null, basePrice: 240, currentPrice: 240, baseRent: 20, currentRent: 20, capitalInvested: 0, maxCapital: 480, shopMultiplier: 1 },
  domdora_2: { id: 'domdora_2', nodeId: 'domdora_2', districtId: 'domdora', ownerId: null, basePrice: 260, currentPrice: 260, baseRent: 22, currentRent: 22, capitalInvested: 0, maxCapital: 520, shopMultiplier: 1 },
  domdora_3: { id: 'domdora_3', nodeId: 'domdora_3', districtId: 'domdora', ownerId: null, basePrice: 200, currentPrice: 200, baseRent: 0, currentRent: 0, capitalInvested: 0, maxCapital: 0, shopMultiplier: 1, buildingType: 'vacant', checkpointToll: 50, circusLevel: 0 },
  domdora_4: { id: 'domdora_4', nodeId: 'domdora_4', districtId: 'domdora', ownerId: null, basePrice: 300, currentPrice: 300, baseRent: 26, currentRent: 26, capitalInvested: 0, maxCapital: 600, shopMultiplier: 1 },
  domdora_5: { id: 'domdora_5', nodeId: 'domdora_5', districtId: 'hauksness', ownerId: null, basePrice: 320, currentPrice: 320, baseRent: 28, currentRent: 28, capitalInvested: 0, maxCapital: 640, shopMultiplier: 1 },
  domdora_6: { id: 'domdora_6', nodeId: 'domdora_6', districtId: 'hauksness', ownerId: null, basePrice: 340, currentPrice: 340, baseRent: 30, currentRent: 30, capitalInvested: 0, maxCapital: 680, shopMultiplier: 1 },
  domdora_7: { id: 'domdora_7', nodeId: 'domdora_7', districtId: 'hauksness', ownerId: null, basePrice: 360, currentPrice: 360, baseRent: 32, currentRent: 32, capitalInvested: 0, maxCapital: 720, shopMultiplier: 1 },

  charlock_warp_in_1: { id: 'charlock_warp_in_1', nodeId: 'charlock_warp_in_1', districtId: 'charlock', ownerId: null, basePrice: 400, currentPrice: 400, baseRent: 34, currentRent: 34, capitalInvested: 0, maxCapital: 800, shopMultiplier: 1 },
  charlock_2: { id: 'charlock_2', nodeId: 'charlock_2', districtId: 'charlock', ownerId: null, basePrice: 600, currentPrice: 600, baseRent: 51, currentRent: 51, capitalInvested: 0, maxCapital: 1200, shopMultiplier: 1 },
  charlock_1: { id: 'charlock_1', nodeId: 'charlock_1', districtId: 'charlock', ownerId: null, basePrice: 500, currentPrice: 500, baseRent: 43, currentRent: 43, capitalInvested: 0, maxCapital: 1000, shopMultiplier: 1 },
  charlock_3: { id: 'charlock_3', nodeId: 'charlock_3', districtId: 'charlock', ownerId: null, basePrice: 700, currentPrice: 700, baseRent: 60, currentRent: 60, capitalInvested: 0, maxCapital: 1400, shopMultiplier: 1 },
  charlock_warp_in_2: { id: 'charlock_warp_in_2', nodeId: 'charlock_warp_in_2', districtId: 'charlock', ownerId: null, basePrice: 450, currentPrice: 450, baseRent: 38, currentRent: 38, capitalInvested: 0, maxCapital: 900, shopMultiplier: 1 },
};

const ALEFGARD_DISTRICTS: Record<string, District> = {
  tantegel: { id: 'tantegel', name: 'Tantegel', stockPrice: 10, propertyIds: ['tantegel_1', 'tantegel_2'], playerHoldings: {} },
  garinham:   { id: 'garinham',   name: 'Garinham',   stockPrice: 8, propertyIds: ['garinham_1', 'garinham_2', 'garinham_3', 'garinham_4'], playerHoldings: {} },
  garin_pass: { id: 'garin_pass', name: 'Garin Pass', stockPrice: 9, propertyIds: ['garinham_5', 'garinham_6'], playerHoldings: {} },
  kol:      { id: 'kol',      name: 'Kol',      stockPrice: 9, propertyIds: ['kol_1', 'kol_2', 'kol_4', 'kol_5'], playerHoldings: {} },
  domdora:   { id: 'domdora',   name: 'Domdora',   stockPrice: 7,  propertyIds: ['domdora_1', 'domdora_2', 'domdora_3', 'domdora_4'], playerHoldings: {} },
  hauksness: { id: 'hauksness', name: 'Hauksness', stockPrice: 13, propertyIds: ['domdora_5', 'domdora_6', 'domdora_7'], playerHoldings: {} },
  cantlin:  { id: 'cantlin',  name: 'Cantlin',  stockPrice: 11, propertyIds: ['cantlin_1', 'cantlin_2', 'cantlin_3'], playerHoldings: {} },
  rimuldar:  { id: 'rimuldar',  name: 'Rimuldar',  stockPrice: 9,  propertyIds: ['rimuldar_1', 'rimuldar_2', 'rimuldar_3'], playerHoldings: {} },
  galenholm: { id: 'galenholm', name: 'Galenholm', stockPrice: 16, propertyIds: ['rimuldar_4', 'rimuldar_5', 'rimuldar_6'], playerHoldings: {} },
  charlock: { id: 'charlock', name: 'Charlock', stockPrice: 15, propertyIds: ['charlock_warp_in_1', 'charlock_2', 'charlock_1', 'charlock_3', 'charlock_warp_in_2'], playerHoldings: {} },
  bridges:  { id: 'bridges',  name: 'Bridges',  stockPrice: 5, propertyIds: ['bridge_north_1', 'bridge_north_2', 'bridge_south_1', 'bridge_south_2'], playerHoldings: {} },
};

// ─── Torland (Dragon Quest II) — outer ring, inner pass, one-way rapids ───────
//
// Outer ring is bidirectional. The inner Tuhn pass (west column) is a two-way
// shortcut. The River Rapids flow one-way west→east from Tuhn out to the
// eastern stockbroker — a fast lane you cannot swim back up.

const TORLAND_BOARD: Record<string, Node> = {
  // --- Bank (Midenhall Castle, west side) ---
  bank: { id: 'bank', type: 'bank', neighbors: ['lianport_1'], coordinates: { x: 0, y: 3 } },

  // --- Lianport (west coast, going north) ---
  lianport_1: { id: 'lianport_1', type: 'property', neighbors: ['alley_b1'], coordinates: { x: 0, y: 2 } },
  // Backstreet B (west) — alley shortcut across to alley_b2 in the south-east.
  alley_b1: { id: 'alley_b1', type: 'backstreet', backstreetGroup: 'B', neighbors: ['lianport_2'], coordinates: { x: -1, y: 1.5 } },
  lianport_2: { id: 'lianport_2', type: 'property', neighbors: ['heart_suit'], coordinates: { x: 0, y: 1 } },
  heart_suit: { id: 'heart_suit', type: 'suit', suit: 'heart', neighbors: ['cannock_1'], coordinates: { x: 1, y: 0 } },

  // --- Cannock (north-west) ---
  cannock_1: { id: 'cannock_1', type: 'property', neighbors: ['cannock_2', 'tuhn_1'], coordinates: { x: 2, y: 0 } },
  cannock_2: { id: 'cannock_2', type: 'property', neighbors: ['venture_north'], coordinates: { x: 3, y: 0 } },
  venture_north: { id: 'venture_north', type: 'venture', neighbors: ['cannock_3'], coordinates: { x: 4, y: 0 } },
  cannock_3: { id: 'cannock_3', type: 'property', neighbors: ['tax_north'], coordinates: { x: 5, y: 0 } },

  // --- Royal Tax Office (native tax square, north center) ---
  tax_north: { id: 'tax_north', type: 'tax_office', neighbors: ['hamlin_1'], coordinates: { x: 6, y: 0 } },

  // --- Hamlin (north-east) ---
  hamlin_1: { id: 'hamlin_1', type: 'property', neighbors: ['rollon_hamlin'], coordinates: { x: 7, y: 0 } },
  // Roll-on — land here and immediately take another roll.
  rollon_hamlin: { id: 'rollon_hamlin', type: 'roll_on', neighbors: ['hamlin_2'], coordinates: { x: 7.5, y: -1 } },
  hamlin_2: { id: 'hamlin_2', type: 'property', neighbors: ['diamond_suit'], coordinates: { x: 8, y: 0 } },
  diamond_suit: { id: 'diamond_suit', type: 'suit', suit: 'diamond', neighbors: ['hamlin_3'], coordinates: { x: 9, y: 0 } },
  hamlin_3: { id: 'hamlin_3', type: 'vacant', neighbors: ['beran_1'], coordinates: { x: 10, y: 1 } },

  // --- Beran (east coast, going south) ---
  beran_1: { id: 'beran_1', type: 'property', neighbors: ['stockbroker_east'], coordinates: { x: 10, y: 2 } },
  stockbroker_east: { id: 'stockbroker_east', type: 'stockbroker', neighbors: ['beran_2'], coordinates: { x: 10, y: 3 } },
  beran_2: { id: 'beran_2', type: 'property', neighbors: ['club_suit'], coordinates: { x: 10, y: 4 } },
  club_suit: { id: 'club_suit', type: 'suit', suit: 'club', neighbors: ['zahan_1'], coordinates: { x: 9, y: 5 } },

  // --- Zahan (south-east) ---
  zahan_1: { id: 'zahan_1', type: 'property', neighbors: ['alley_b2'], coordinates: { x: 8, y: 5 } },
  // Backstreet B (south-east) — the other end of the alley_b1 shortcut.
  alley_b2: { id: 'alley_b2', type: 'backstreet', backstreetGroup: 'B', neighbors: ['zahan_2'], coordinates: { x: 7.5, y: 6 } },
  zahan_2: { id: 'zahan_2', type: 'property', neighbors: ['venture_south'], coordinates: { x: 7, y: 5 } },
  venture_south: { id: 'venture_south', type: 'casino', neighbors: ['zahan_3'], coordinates: { x: 6, y: 5 } },
  zahan_3: { id: 'zahan_3', type: 'boon', neighbors: ['moonbrooke_1'], coordinates: { x: 5, y: 5 } },

  // --- Moonbrooke (south-west) ---
  moonbrooke_1: { id: 'moonbrooke_1', type: 'property', neighbors: ['cannon_moon'], coordinates: { x: 4, y: 5 } },
  // Cannon — blasts the lander onto a random rival's square.
  cannon_moon: { id: 'cannon_moon', type: 'cannon', neighbors: ['moonbrooke_2'], coordinates: { x: 3.5, y: 6 } },
  moonbrooke_2: { id: 'moonbrooke_2', type: 'property', neighbors: ['spade_suit'], coordinates: { x: 3, y: 5 } },
  spade_suit: { id: 'spade_suit', type: 'suit', suit: 'spade', cycleSuit: true, neighbors: ['moonbrooke_3', 'tuhn_3'], coordinates: { x: 2, y: 5 } },
  moonbrooke_3: { id: 'moonbrooke_3', type: 'property', neighbors: ['break_oasis'], coordinates: { x: 1, y: 5 } },
  break_oasis: { id: 'break_oasis', type: 'break', neighbors: ['osterfair_1'], coordinates: { x: 0, y: 5 } },
  osterfair_1: { id: 'osterfair_1', type: 'property', neighbors: ['bank'], coordinates: { x: 0, y: 4 } },

  // --- Tuhn Pass (inner west column, two-way shortcut) ---
  tuhn_1: { id: 'tuhn_1', type: 'property', neighbors: ['stockbroker_west'], coordinates: { x: 2, y: 1 } },
  stockbroker_west: { id: 'stockbroker_west', type: 'stockbroker', neighbors: ['tuhn_2'], coordinates: { x: 2, y: 2 } },
  tuhn_2: { id: 'tuhn_2', type: 'property', neighbors: ['tuhn_3', 'rapids_1'], coordinates: { x: 2, y: 3 } },
  tuhn_3: { id: 'tuhn_3', type: 'vacant', neighbors: [], coordinates: { x: 2, y: 4 } },

  // --- River Rapids (one-way west→east; exits at the eastern stockbroker) ---
  rapids_1: { id: 'rapids_1', type: 'property', neighbors: ['venture_mid'], coordinates: { x: 4, y: 3 } },
  venture_mid: { id: 'venture_mid', type: 'venture', neighbors: ['rapids_2'], coordinates: { x: 6, y: 3 } },
  rapids_2: { id: 'rapids_2', type: 'property', neighbors: ['stockbroker_east'], coordinates: { x: 8, y: 3 } },
};

// All four rapids edges stay directed — the current is too strong to go back.
const TORLAND_ONE_WAY: ReadonlyArray<readonly [string, string]> = [
  ['tuhn_2', 'rapids_1'],
  ['rapids_1', 'venture_mid'],
  ['venture_mid', 'rapids_2'],
  ['rapids_2', 'stockbroker_east'],
];

const TORLAND_PROPERTIES: Record<string, Property> = {
  lianport_1: { id: 'lianport_1', nodeId: 'lianport_1', districtId: 'lianport', ownerId: null, basePrice: 160, currentPrice: 160, baseRent: 13, currentRent: 13, capitalInvested: 0, maxCapital: 320, shopMultiplier: 1 },
  lianport_2: { id: 'lianport_2', nodeId: 'lianport_2', districtId: 'lianport', ownerId: null, basePrice: 180, currentPrice: 180, baseRent: 15, currentRent: 15, capitalInvested: 0, maxCapital: 360, shopMultiplier: 1 },

  cannock_1: { id: 'cannock_1', nodeId: 'cannock_1', districtId: 'cannock', ownerId: null, basePrice: 200, currentPrice: 200, baseRent: 16, currentRent: 16, capitalInvested: 0, maxCapital: 400, shopMultiplier: 1 },
  cannock_2: { id: 'cannock_2', nodeId: 'cannock_2', districtId: 'cannock', ownerId: null, basePrice: 220, currentPrice: 220, baseRent: 18, currentRent: 18, capitalInvested: 0, maxCapital: 440, shopMultiplier: 1 },
  cannock_3: { id: 'cannock_3', nodeId: 'cannock_3', districtId: 'cannock', ownerId: null, basePrice: 240, currentPrice: 240, baseRent: 20, currentRent: 20, capitalInvested: 0, maxCapital: 480, shopMultiplier: 1 },

  hamlin_1: { id: 'hamlin_1', nodeId: 'hamlin_1', districtId: 'hamlin', ownerId: null, basePrice: 260, currentPrice: 260, baseRent: 22, currentRent: 22, capitalInvested: 0, maxCapital: 520, shopMultiplier: 1 },
  hamlin_2: { id: 'hamlin_2', nodeId: 'hamlin_2', districtId: 'hamlin', ownerId: null, basePrice: 280, currentPrice: 280, baseRent: 24, currentRent: 24, capitalInvested: 0, maxCapital: 560, shopMultiplier: 1 },
  hamlin_3: { id: 'hamlin_3', nodeId: 'hamlin_3', districtId: 'hamlin', ownerId: null, basePrice: 200, currentPrice: 200, baseRent: 0, currentRent: 0, capitalInvested: 0, maxCapital: 0, shopMultiplier: 1, buildingType: 'vacant', checkpointToll: 50, circusLevel: 0 },

  beran_1: { id: 'beran_1', nodeId: 'beran_1', districtId: 'beran', ownerId: null, basePrice: 320, currentPrice: 320, baseRent: 28, currentRent: 28, capitalInvested: 0, maxCapital: 640, shopMultiplier: 1 },
  beran_2: { id: 'beran_2', nodeId: 'beran_2', districtId: 'beran', ownerId: null, basePrice: 340, currentPrice: 340, baseRent: 30, currentRent: 30, capitalInvested: 0, maxCapital: 680, shopMultiplier: 1 },

  zahan_1: { id: 'zahan_1', nodeId: 'zahan_1', districtId: 'zahan', ownerId: null, basePrice: 300, currentPrice: 300, baseRent: 26, currentRent: 26, capitalInvested: 0, maxCapital: 600, shopMultiplier: 1 },
  zahan_2: { id: 'zahan_2', nodeId: 'zahan_2', districtId: 'zahan', ownerId: null, basePrice: 320, currentPrice: 320, baseRent: 28, currentRent: 28, capitalInvested: 0, maxCapital: 640, shopMultiplier: 1 },

  moonbrooke_1: { id: 'moonbrooke_1', nodeId: 'moonbrooke_1', districtId: 'moonbrooke', ownerId: null, basePrice: 240, currentPrice: 240, baseRent: 20, currentRent: 20, capitalInvested: 0, maxCapital: 480, shopMultiplier: 1 },
  moonbrooke_2: { id: 'moonbrooke_2', nodeId: 'moonbrooke_2', districtId: 'moonbrooke', ownerId: null, basePrice: 260, currentPrice: 260, baseRent: 22, currentRent: 22, capitalInvested: 0, maxCapital: 520, shopMultiplier: 1 },
  moonbrooke_3: { id: 'moonbrooke_3', nodeId: 'moonbrooke_3', districtId: 'moonbrooke', ownerId: null, basePrice: 280, currentPrice: 280, baseRent: 24, currentRent: 24, capitalInvested: 0, maxCapital: 560, shopMultiplier: 1 },
  osterfair_1: { id: 'osterfair_1', nodeId: 'osterfair_1', districtId: 'moonbrooke', ownerId: null, basePrice: 300, currentPrice: 300, baseRent: 26, currentRent: 26, capitalInvested: 0, maxCapital: 600, shopMultiplier: 1 },

  tuhn_1: { id: 'tuhn_1', nodeId: 'tuhn_1', districtId: 'tuhn', ownerId: null, basePrice: 220, currentPrice: 220, baseRent: 18, currentRent: 18, capitalInvested: 0, maxCapital: 440, shopMultiplier: 1 },
  tuhn_2: { id: 'tuhn_2', nodeId: 'tuhn_2', districtId: 'tuhn', ownerId: null, basePrice: 240, currentPrice: 240, baseRent: 20, currentRent: 20, capitalInvested: 0, maxCapital: 480, shopMultiplier: 1 },
  tuhn_3: { id: 'tuhn_3', nodeId: 'tuhn_3', districtId: 'tuhn', ownerId: null, basePrice: 200, currentPrice: 200, baseRent: 0, currentRent: 0, capitalInvested: 0, maxCapital: 0, shopMultiplier: 1, buildingType: 'vacant', checkpointToll: 50, circusLevel: 0 },

  // Rapids shops: cheap to buy, high rent — risky one-way territory.
  rapids_1: { id: 'rapids_1', nodeId: 'rapids_1', districtId: 'rapids', ownerId: null, basePrice: 180, currentPrice: 180, baseRent: 28, currentRent: 28, capitalInvested: 0, maxCapital: 360, shopMultiplier: 1 },
  rapids_2: { id: 'rapids_2', nodeId: 'rapids_2', districtId: 'rapids', ownerId: null, basePrice: 180, currentPrice: 180, baseRent: 28, currentRent: 28, capitalInvested: 0, maxCapital: 360, shopMultiplier: 1 },
};

const TORLAND_DISTRICTS: Record<string, District> = {
  lianport:   { id: 'lianport',   name: 'Lianport',   stockPrice: 6,  propertyIds: ['lianport_1', 'lianport_2'], playerHoldings: {} },
  cannock:    { id: 'cannock',    name: 'Cannock',    stockPrice: 8,  propertyIds: ['cannock_1', 'cannock_2', 'cannock_3'], playerHoldings: {} },
  hamlin:     { id: 'hamlin',     name: 'Hamlin',     stockPrice: 9,  propertyIds: ['hamlin_1', 'hamlin_2', 'hamlin_3'], playerHoldings: {} },
  beran:      { id: 'beran',      name: 'Beran',      stockPrice: 13, propertyIds: ['beran_1', 'beran_2'], playerHoldings: {} },
  zahan:      { id: 'zahan',      name: 'Zahan',      stockPrice: 10, propertyIds: ['zahan_1', 'zahan_2'], playerHoldings: {} },
  moonbrooke: { id: 'moonbrooke', name: 'Moonbrooke', stockPrice: 10, propertyIds: ['moonbrooke_1', 'moonbrooke_2', 'moonbrooke_3', 'osterfair_1'], playerHoldings: {} },
  tuhn:       { id: 'tuhn',       name: 'Tuhn',       stockPrice: 8,  propertyIds: ['tuhn_1', 'tuhn_2', 'tuhn_3'], playerHoldings: {} },
  rapids:     { id: 'rapids',     name: 'Rapids',     stockPrice: 7,  propertyIds: ['rapids_1', 'rapids_2'], playerHoldings: {} },
};

// ─── Aliahan (Dragon Quest III) — twin loops crossing at the bank ──────────────
//
// A figure-eight: the west and east loops share the central spine
// (Dharma Shrine ☕ → Bank → Edinbear Tax 🏛), so every lap crosses the bank.
// The Roma Road chord cuts across the west loop through the western broker.
// Desert wind blows the eastern caravan one-way west→east along the top.
// Jipang is a premium island inside the east loop: warp in from the Roma
// Road, walk its shops, warp out to Aliahan.

const ALIAHAN_BOARD: Record<string, Node> = {
  // --- Central spine ---
  dharma_break: { id: 'dharma_break', type: 'break', neighbors: ['bank', 'romaly_1', 'isis_1'], coordinates: { x: 6, y: 1 } },
  bank: { id: 'bank', type: 'bank', neighbors: ['edinbear_tax'], coordinates: { x: 6, y: 2 } },
  edinbear_tax: { id: 'edinbear_tax', type: 'tax_office', neighbors: [], coordinates: { x: 6, y: 3 } },

  // --- West loop (Romaly north, Aliahan south) ---
  romaly_1: { id: 'romaly_1', type: 'property', neighbors: ['romaly_casino'], coordinates: { x: 5, y: 0 } },
  romaly_casino: { id: 'romaly_casino', type: 'casino', neighbors: ['romaly_2'], coordinates: { x: 4, y: 0 } },
  romaly_2: { id: 'romaly_2', type: 'property', neighbors: ['heart_suit'], coordinates: { x: 3, y: 0 } },
  heart_suit: { id: 'heart_suit', type: 'suit', suit: 'heart', neighbors: ['noaniels_1'], coordinates: { x: 2, y: 0 } },
  noaniels_1: { id: 'noaniels_1', type: 'property', neighbors: ['alley_c1'], coordinates: { x: 1, y: 0 } },
  // Backstreet C (north-west) — alley shortcut across to alley_c2 in the east loop.
  alley_c1: { id: 'alley_c1', type: 'backstreet', backstreetGroup: 'C', neighbors: ['noaniels_2'], coordinates: { x: 0, y: 0 } },
  noaniels_2: { id: 'noaniels_2', type: 'property', neighbors: ['kazave_vac'], coordinates: { x: 0, y: 1 } },
  kazave_vac: { id: 'kazave_vac', type: 'vacant', neighbors: ['kazave_1', 'stockbroker_west'], coordinates: { x: 0, y: 2 } },
  kazave_1: { id: 'kazave_1', type: 'property', neighbors: ['spade_suit'], coordinates: { x: 0, y: 3 } },
  spade_suit: { id: 'spade_suit', type: 'suit', suit: 'spade', neighbors: ['aliahan_1'], coordinates: { x: 1, y: 4 } },
  aliahan_1: { id: 'aliahan_1', type: 'property', neighbors: ['aliahan_2'], coordinates: { x: 2, y: 4 } },
  aliahan_2: { id: 'aliahan_2', type: 'property', neighbors: ['cannon_aliahan'], coordinates: { x: 3, y: 4 } },
  // Cannon — blasts the lander onto a random rival's square.
  cannon_aliahan: { id: 'cannon_aliahan', type: 'cannon', neighbors: ['aliahan_3'], coordinates: { x: 3.5, y: 5 } },
  aliahan_3: { id: 'aliahan_3', type: 'property', neighbors: ['venture_west'], coordinates: { x: 4, y: 4 } },
  venture_west: { id: 'venture_west', type: 'venture', neighbors: ['edinbear_tax'], coordinates: { x: 5, y: 4 } },

  // --- Roma Road (west chord through the broker) ---
  stockbroker_west: { id: 'stockbroker_west', type: 'stockbroker', neighbors: ['roma_road_1'], coordinates: { x: 1, y: 2 } },
  roma_road_1: { id: 'roma_road_1', type: 'property', neighbors: ['roma_road_2'], coordinates: { x: 2, y: 2 } },
  roma_road_2: { id: 'roma_road_2', type: 'property', neighbors: ['bank', 'warp_to_jipang'], coordinates: { x: 4, y: 2 } },
  warp_to_jipang: { id: 'warp_to_jipang', type: 'warp', pairedNodeId: 'jipang_in', neighbors: [], coordinates: { x: 5, y: 1 } },

  // --- East loop (Isis desert north, Baharata south) ---
  isis_1: { id: 'isis_1', type: 'property', neighbors: ['isis_2'], coordinates: { x: 7, y: 0 } },
  isis_2: { id: 'isis_2', type: 'property', neighbors: ['diamond_suit'], coordinates: { x: 8, y: 0 } },
  diamond_suit: { id: 'diamond_suit', type: 'suit', suit: 'diamond', neighbors: ['isis_3'], coordinates: { x: 9, y: 0 } },
  isis_3: { id: 'isis_3', type: 'property', neighbors: ['portoga_1'], coordinates: { x: 10, y: 0 } },
  portoga_1: { id: 'portoga_1', type: 'property', neighbors: ['rollon_portoga'], coordinates: { x: 11, y: 0 } },
  // Roll-on — land here and immediately take another roll.
  rollon_portoga: { id: 'rollon_portoga', type: 'roll_on', neighbors: ['portoga_2'], coordinates: { x: 12, y: 0 } },
  portoga_2: { id: 'portoga_2', type: 'property', neighbors: ['stockbroker_east'], coordinates: { x: 12, y: 1 } },
  stockbroker_east: { id: 'stockbroker_east', type: 'stockbroker', neighbors: ['baharata_1'], coordinates: { x: 12, y: 2 } },
  baharata_1: { id: 'baharata_1', type: 'property', neighbors: ['alley_c2'], coordinates: { x: 12, y: 3 } },
  // Backstreet C (east) — the other end of the alley_c1 shortcut.
  alley_c2: { id: 'alley_c2', type: 'backstreet', backstreetGroup: 'C', neighbors: ['baharata_2'], coordinates: { x: 12, y: 4 } },
  baharata_2: { id: 'baharata_2', type: 'property', neighbors: ['club_suit'], coordinates: { x: 11, y: 4 } },
  club_suit: { id: 'club_suit', type: 'suit', suit: 'club', cycleSuit: true, neighbors: ['baharata_3'], coordinates: { x: 10, y: 4 } },
  baharata_3: { id: 'baharata_3', type: 'property', neighbors: ['venture_east'], coordinates: { x: 9, y: 4 } },
  venture_east: { id: 'venture_east', type: 'venture', neighbors: ['samanao_vac'], coordinates: { x: 8, y: 4 } },
  samanao_vac: { id: 'samanao_vac', type: 'boom', neighbors: ['edinbear_tax'], coordinates: { x: 7, y: 4 } },

  // --- Jipang island (inside the east loop; warp in, warp out) ---
  jipang_in: { id: 'jipang_in', type: 'property', neighbors: ['jipang_1'], coordinates: { x: 8, y: 2 } },
  jipang_1: { id: 'jipang_1', type: 'property', neighbors: ['jipang_2'], coordinates: { x: 9, y: 2 } },
  jipang_2: { id: 'jipang_2', type: 'property', neighbors: ['jipang_warp_out'], coordinates: { x: 10, y: 2 } },
  jipang_warp_out: { id: 'jipang_warp_out', type: 'warp', pairedNodeId: 'aliahan_1', neighbors: [], coordinates: { x: 11, y: 2 } },
};

// Desert wind: the Isis caravan only travels west→east along the top row.
const ALIAHAN_ONE_WAY: ReadonlyArray<readonly [string, string]> = [
  ['isis_1', 'isis_2'],
  ['isis_2', 'diamond_suit'],
];

const ALIAHAN_PROPERTIES: Record<string, Property> = {
  aliahan_1: { id: 'aliahan_1', nodeId: 'aliahan_1', districtId: 'aliahan', ownerId: null, basePrice: 140, currentPrice: 140, baseRent: 12, currentRent: 12, capitalInvested: 0, maxCapital: 280, shopMultiplier: 1 },
  aliahan_2: { id: 'aliahan_2', nodeId: 'aliahan_2', districtId: 'aliahan', ownerId: null, basePrice: 160, currentPrice: 160, baseRent: 14, currentRent: 14, capitalInvested: 0, maxCapital: 320, shopMultiplier: 1 },
  aliahan_3: { id: 'aliahan_3', nodeId: 'aliahan_3', districtId: 'aliahan', ownerId: null, basePrice: 180, currentPrice: 180, baseRent: 15, currentRent: 15, capitalInvested: 0, maxCapital: 360, shopMultiplier: 1 },

  noaniels_1: { id: 'noaniels_1', nodeId: 'noaniels_1', districtId: 'noaniels', ownerId: null, basePrice: 190, currentPrice: 190, baseRent: 16, currentRent: 16, capitalInvested: 0, maxCapital: 380, shopMultiplier: 1 },
  noaniels_2: { id: 'noaniels_2', nodeId: 'noaniels_2', districtId: 'noaniels', ownerId: null, basePrice: 210, currentPrice: 210, baseRent: 18, currentRent: 18, capitalInvested: 0, maxCapital: 420, shopMultiplier: 1 },

  kazave_vac: { id: 'kazave_vac', nodeId: 'kazave_vac', districtId: 'kazave', ownerId: null, basePrice: 200, currentPrice: 200, baseRent: 0, currentRent: 0, capitalInvested: 0, maxCapital: 0, shopMultiplier: 1, buildingType: 'vacant', checkpointToll: 50, circusLevel: 0 },
  kazave_1: { id: 'kazave_1', nodeId: 'kazave_1', districtId: 'kazave', ownerId: null, basePrice: 220, currentPrice: 220, baseRent: 18, currentRent: 18, capitalInvested: 0, maxCapital: 440, shopMultiplier: 1 },

  romaly_1: { id: 'romaly_1', nodeId: 'romaly_1', districtId: 'romaly', ownerId: null, basePrice: 240, currentPrice: 240, baseRent: 20, currentRent: 20, capitalInvested: 0, maxCapital: 480, shopMultiplier: 1 },
  romaly_2: { id: 'romaly_2', nodeId: 'romaly_2', districtId: 'romaly', ownerId: null, basePrice: 260, currentPrice: 260, baseRent: 22, currentRent: 22, capitalInvested: 0, maxCapital: 520, shopMultiplier: 1 },
  roma_road_1: { id: 'roma_road_1', nodeId: 'roma_road_1', districtId: 'romaly', ownerId: null, basePrice: 280, currentPrice: 280, baseRent: 24, currentRent: 24, capitalInvested: 0, maxCapital: 560, shopMultiplier: 1 },
  roma_road_2: { id: 'roma_road_2', nodeId: 'roma_road_2', districtId: 'romaly', ownerId: null, basePrice: 300, currentPrice: 300, baseRent: 26, currentRent: 26, capitalInvested: 0, maxCapital: 600, shopMultiplier: 1 },

  isis_1: { id: 'isis_1', nodeId: 'isis_1', districtId: 'isis', ownerId: null, basePrice: 260, currentPrice: 260, baseRent: 22, currentRent: 22, capitalInvested: 0, maxCapital: 520, shopMultiplier: 1 },
  isis_2: { id: 'isis_2', nodeId: 'isis_2', districtId: 'isis', ownerId: null, basePrice: 280, currentPrice: 280, baseRent: 24, currentRent: 24, capitalInvested: 0, maxCapital: 560, shopMultiplier: 1 },
  isis_3: { id: 'isis_3', nodeId: 'isis_3', districtId: 'isis', ownerId: null, basePrice: 300, currentPrice: 300, baseRent: 26, currentRent: 26, capitalInvested: 0, maxCapital: 600, shopMultiplier: 1 },

  portoga_1: { id: 'portoga_1', nodeId: 'portoga_1', districtId: 'portoga', ownerId: null, basePrice: 340, currentPrice: 340, baseRent: 29, currentRent: 29, capitalInvested: 0, maxCapital: 680, shopMultiplier: 1 },
  portoga_2: { id: 'portoga_2', nodeId: 'portoga_2', districtId: 'portoga', ownerId: null, basePrice: 360, currentPrice: 360, baseRent: 31, currentRent: 31, capitalInvested: 0, maxCapital: 720, shopMultiplier: 1 },

  baharata_1: { id: 'baharata_1', nodeId: 'baharata_1', districtId: 'baharata', ownerId: null, basePrice: 380, currentPrice: 380, baseRent: 32, currentRent: 32, capitalInvested: 0, maxCapital: 760, shopMultiplier: 1 },
  baharata_2: { id: 'baharata_2', nodeId: 'baharata_2', districtId: 'baharata', ownerId: null, basePrice: 400, currentPrice: 400, baseRent: 34, currentRent: 34, capitalInvested: 0, maxCapital: 800, shopMultiplier: 1 },
  baharata_3: { id: 'baharata_3', nodeId: 'baharata_3', districtId: 'baharata', ownerId: null, basePrice: 420, currentPrice: 420, baseRent: 36, currentRent: 36, capitalInvested: 0, maxCapital: 840, shopMultiplier: 1 },

  jipang_in: { id: 'jipang_in', nodeId: 'jipang_in', districtId: 'jipang', ownerId: null, basePrice: 450, currentPrice: 450, baseRent: 38, currentRent: 38, capitalInvested: 0, maxCapital: 900, shopMultiplier: 1 },
  jipang_1: { id: 'jipang_1', nodeId: 'jipang_1', districtId: 'jipang', ownerId: null, basePrice: 550, currentPrice: 550, baseRent: 47, currentRent: 47, capitalInvested: 0, maxCapital: 1100, shopMultiplier: 1 },
  jipang_2: { id: 'jipang_2', nodeId: 'jipang_2', districtId: 'jipang', ownerId: null, basePrice: 650, currentPrice: 650, baseRent: 55, currentRent: 55, capitalInvested: 0, maxCapital: 1300, shopMultiplier: 1 },
};

const ALIAHAN_DISTRICTS: Record<string, District> = {
  aliahan:  { id: 'aliahan',  name: 'Aliahan',  stockPrice: 6,  propertyIds: ['aliahan_1', 'aliahan_2', 'aliahan_3'], playerHoldings: {} },
  noaniels: { id: 'noaniels', name: 'Noaniels', stockPrice: 8,  propertyIds: ['noaniels_1', 'noaniels_2'], playerHoldings: {} },
  kazave:   { id: 'kazave',   name: 'Kazave',   stockPrice: 8,  propertyIds: ['kazave_vac', 'kazave_1'], playerHoldings: {} },
  romaly:   { id: 'romaly',   name: 'Romaly',   stockPrice: 10, propertyIds: ['romaly_1', 'romaly_2', 'roma_road_1', 'roma_road_2'], playerHoldings: {} },
  isis:     { id: 'isis',     name: 'Isis',     stockPrice: 11, propertyIds: ['isis_1', 'isis_2', 'isis_3'], playerHoldings: {} },
  portoga:  { id: 'portoga',  name: 'Portoga',  stockPrice: 14, propertyIds: ['portoga_1', 'portoga_2'], playerHoldings: {} },
  baharata: { id: 'baharata', name: 'Baharata', stockPrice: 14, propertyIds: ['baharata_1', 'baharata_2', 'baharata_3'], playerHoldings: {} },
  jipang:   { id: 'jipang',   name: 'Jipang',   stockPrice: 22, propertyIds: ['jipang_in', 'jipang_1', 'jipang_2'], playerHoldings: {} },
};

// ─── Registry ──────────────────────────────────────────────────────────────────

export const BOARDS: Record<string, BoardDef> = {
  alefgard: {
    id: 'alefgard',
    name: 'Alefgard',
    suggestedTarget: 8000,
    board: ALEFGARD_BOARD,
    properties: ALEFGARD_PROPERTIES,
    districts: ALEFGARD_DISTRICTS,
    oneWayEdges: [],
  },
  torland: {
    id: 'torland',
    name: 'Torland',
    suggestedTarget: 15000,
    board: TORLAND_BOARD,
    properties: TORLAND_PROPERTIES,
    districts: TORLAND_DISTRICTS,
    oneWayEdges: TORLAND_ONE_WAY,
  },
  aliahan: {
    id: 'aliahan',
    name: 'Aliahan',
    suggestedTarget: 12000,
    board: ALIAHAN_BOARD,
    properties: ALIAHAN_PROPERTIES,
    districts: ALIAHAN_DISTRICTS,
    oneWayEdges: ALIAHAN_ONE_WAY,
  },
};

export const DEFAULT_BOARD_ID = 'alefgard';
