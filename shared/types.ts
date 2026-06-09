export interface VentureCard {
  number: number;
  title: string;
  text: string;
  payout: number;
  effectType:
    | 'CASH_GAIN'
    | 'CASH_LOSS'
    | 'STOCK_GAIN'
    | 'STOCK_BUFF'
    | 'STOCK_SLUMP'
    | 'SUIT_GIFT'
    | 'WARP_BANK'
    | 'WARP_VACANT'
    | 'ROLL_AGAIN'
    | 'PROP_BUFF'
    | 'SHOP_MULTIPLIER_BONUS'
    | 'SUIT_HEART_OR_CASH'
    | 'CASH_PERCENT_LOSS'
    | 'STOCK_DIVIDEND_10'
    | 'STOCK_DIVIDEND_20'
    | 'DICEY_CLOSED'
    | 'HALF_RENT_TEMP'
    | 'COMMISSION_TEMP'
    | 'CASH_GAIN_PER_LEVEL'      // payout × player level
    | 'CASH_GAIN_PER_SUIT'       // payout × suits held
    | 'CASH_FROM_EACH_PLAYER'    // each opponent pays payout to player
    | 'CASH_TO_EACH_PLAYER'      // player pays payout to each opponent
    | 'STOCK_TAX_10'             // pay 10% of stock value
    | 'FREE_CAPITAL'             // 100G free capital into best shop
    | 'ALL_SHOPS_PRICE_UP'       // all owned shops +10% base value & rent
    | 'WARP_BROKER'              // warp to nearest stockbroker
    | 'DOUBLE_RENT_TEMP';        // own shop rents ×2 until next turn
  targetId?: string; // districtId, suit, etc.
}

export interface Node {
  id: string;
  type: 'property' | 'bank' | 'stockbroker' | 'suit' | 'warp' | 'venture' | 'vacant' | 'tax_office' | 'break';
  neighbors: string[];
  coordinates: { x: number; y: number };
  pairedNodeId?: string;
  suit?: 'heart' | 'diamond' | 'club' | 'spade';
}

export type BuildingType =
  | 'vacant'
  | 'checkpoint'
  | 'circus'
  | 'balloonport'
  | 'tax_office'
  | 'home'
  | 'estate_agency'
  | 'three_star_shop';

export interface Property {
  id: string;
  nodeId: string;
  districtId: string;
  ownerId: string | null;
  basePrice: number;
  currentPrice: number;
  baseRent: number;
  currentRent: number;
  capitalInvested: number;
  maxCapital: number;
  shopMultiplier: number;
  buildingType?: BuildingType;
  checkpointToll?: number;
  circusLevel?: number;
}

export interface District {
  id: string;
  name: string;
  stockPrice: number;
  propertyIds: string[];
  playerHoldings: Record<string, number>;
}

export interface Player {
  id: string;
  name: string;
  cash: number;
  netWorth: number;
  currentNodeId: string;
  level: number;
  suits: { heart: boolean; diamond: boolean; club: boolean; spade: boolean };
  propertyIds: string[];
  isBankrupt: boolean;
  shopsClosedUntilNextTurn?: boolean;
  shopPricesHalvedUntilNextTurn?: boolean;
  shopRentsDoubledUntilNextTurn?: boolean;
  commissionUntilNextTurn?: number;
}

export type TurnPhase =
  | 'PRE_ROLL'
  | 'ROLLING'
  | 'MOVING'
  | 'CHOOSING_PATH'
  | 'SPACE_ACTION'
  | 'TURN_END';

export type Action =
  | { type: 'SELL_STOCK'; districtId: string; shares: number }
  | { type: 'ROLL_DICE' }
  | { type: 'CHOOSE_PATH'; nodeId: string }
  | { type: 'BUY_PROPERTY'; propertyId: string }
  | { type: 'INVEST'; propertyId: string; amount: number }
  | { type: 'PAY_RENT'; propertyId: string }
  | { type: 'BUY_STOCK'; districtId: string; shares: number }
  | { type: 'COLLECT_SALARY' }
  | { type: 'BUYOUT_PROPERTY'; propertyId: string }
  | { type: 'CHOOSE_VENTURE_CARD'; cardIndex: number }
  | { type: 'BUILD_PLOT'; propertyId: string; buildingType: BuildingType }
  | { type: 'RENOVATE_PLOT'; propertyId: string; buildingType: BuildingType }
  | { type: 'TELEPORT'; nodeId: string }
  | { type: 'END_TURN' };

export interface GameState {
  roomId: string;
  boardId?: string;
  players: Record<string, Player>;
  turnOrder: string[];
  currentPlayerId: string;
  currentPhase: TurnPhase;
  board: Record<string, Node>;
  properties: Record<string, Property>;
  districts: Record<string, District>;
  round: number;
  targetNetWorth: number;
  winnerId: string | null;
  bankruptCount: number;
  log: string[];
  pendingDestinations?: string[];
  ventureGrid?: { cleared: boolean; playerId: string | null }[]; // Length 64
  ventureGridCardIds?: number[]; // Length 64, seeded card numbers
  activeVentureCard?: VentureCard | null;
  status?: 'LOBBY' | 'ACTIVE' | 'FINISHED';
  creatorId?: string;
  lastRoll?: Record<string, number>;
  passedBankThisTurn?: boolean;
  passedBankWindowUsed?: boolean;  // bonus SPACE_ACTION (stock window) already granted this turn
}

