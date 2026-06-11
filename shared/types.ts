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
    | 'DOUBLE_RENT_TEMP'         // own shop rents ×2 until next turn
    | 'SUIT_YOURSELF_GAIN'       // +1 wildcard suit (cap 9; 100G if full)
    | 'SUIT_YOURSELF_ALL'        // every player +1 wildcard suit
    | 'SUIT_YOURSELF_BUY'        // pay `payout`G for a wildcard suit (auto if affordable)
    | 'SUIT_YOURSELF_ROLL'       // roll; gain floor(roll/2) wildcard suits
    | 'STOCK_TAX_PER_SHARE'      // pay `payout`G per share held
    | 'SWAP_OTHERS'              // all other players swap places
    | 'MOVE_RESTRICTION'         // all others' next roll is forced to `payout`
    | 'HALF_SALARY'              // receive half a salary (no promotion)
    | 'SUDDEN_PROMOTION'         // full salary + level up; suits reset
    | 'FORCED_AUCTION'           // auction the drawer's best shop, reserve 2x value
    | 'VENTURE_BUY_STOCK'        // interactive: buy stock at priceFactor% of market
    | 'VENTURE_SELL_STOCK'       // interactive: sell held stock at priceFactor% of market
    | 'VENTURE_BUY_SHOP'         // interactive: buy any unowned shop at priceFactor% + flatBonus
    | 'VENTURE_SELL_SHOP';       // interactive: sell a shop to the bank at priceFactor% + flatBonus
  targetId?: string; // districtId, suit, etc.
  priceFactor?: number; // interactive cards: % of market/value (90, 110, 135, 200...)
  flatBonus?: number;    // interactive cards: flat gold added to the unit/shop price
  mandatory?: boolean;   // forced bank sales: skip is not allowed
}

// An interactive venture card waiting on the drawer's decision. END_TURN is
// blocked until it is resolved (or skipped) via VENTURE_CHOICE.
export interface PendingVenture {
  title: string;
  kind: 'buy_stock' | 'sell_stock' | 'sell_shop' | 'buy_shop';
  priceFactor: number;   // % of market/value
  flatBonus?: number;
  mandatory?: boolean;   // forced bank sales (no skip)
}

export interface Node {
  id: string;
  type: 'property' | 'bank' | 'stockbroker' | 'suit' | 'warp' | 'venture' | 'vacant' | 'tax_office' | 'break' | 'casino' | 'boon' | 'boom';
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
  characterId?: string;  // roster character (drives bot personality; cosmetic for humans)
  isBot?: boolean;       // server-driven AI seat (bots don't vote in end-game votes)
  suitYourself?: number; // wildcard suits (max 9) — spent to fill missing suits at promotion
  forcedRoll?: number;   // next roll is forced to this value (venture cards), consumed on use
  arrivedFromNodeId?: string;  // node walked from on arrival — next roll can't start back that way
  shopsClosedUntilNextTurn?: boolean;
  shopPricesHalvedUntilNextTurn?: boolean;
  shopRentsDoubledUntilNextTurn?: boolean;
  commissionUntilNextTurn?: number;
}

export interface PlayerStats {
  lapsCompleted: number;        // bank passes/landings
  rentPaid: number;             // total gold paid in rent and tolls
  rentCollected: number;        // total gold collected in rent and tolls
  biggestRentCollected: number; // single largest rent payout received
  salariesCollected: number;    // promotion count
  sharesBought: number;
  sharesSold: number;
  propertiesBought: number;     // purchases + buyouts + plot builds
  ventureCardsDrawn: number;
  taxesPaid: number;            // gold lost to tax squares
}

export type TurnPhase =
  | 'PRE_ROLL'
  | 'ROLLING'
  | 'MOVING'
  | 'CHOOSING_PATH'
  | 'SPACE_ACTION'
  | 'DEBT_SETTLEMENT'  // cash < 0: player chooses stocks/shops to sell until covered
  | 'TURN_END';

export type Action =
  | { type: 'SELL_STOCK'; districtId: string; shares: number }
  | { type: 'SELL_PROPERTY'; propertyId: string }  // distress sale at 75%, DEBT_SETTLEMENT only
  | { type: 'CASINO_BET'; game: CasinoGame; wager: number; choice: string }  // casino node, one bet per visit
  | { type: 'ARCADE_PLAY'; game: ArcadeGame; pick?: number }  // casino node, free play, shares the one-game-per-visit gate
  | { type: 'VOTE_END'; playerId: string; vote: boolean }  // end-game vote (any alive human, any time during a vote)
  | { type: 'AUCTION_BID'; playerId: string; amount: number }  // any eligible bidder during an auction
  | { type: 'AUCTION_PASS'; playerId: string }
  | { type: 'ROLL_DICE' }
  | { type: 'CHOOSE_PATH'; nodeId: string }
  | { type: 'BUY_PROPERTY'; propertyId: string }
  | { type: 'INVEST'; propertyId: string; amount: number }
  | { type: 'PAY_RENT'; propertyId: string }
  | { type: 'BUY_STOCK'; districtId: string; shares: number }
  | { type: 'COLLECT_SALARY' }
  | { type: 'BUYOUT_PROPERTY'; propertyId: string }
  | { type: 'CHOOSE_VENTURE_CARD'; cardIndex: number }
  | { type: 'VENTURE_CHOICE'; kind: 'buy_stock' | 'sell_stock' | 'sell_shop' | 'buy_shop' | 'skip'; districtId?: string; shares?: number; propertyId?: string }
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
  pendingVenture?: PendingVenture | null;  // interactive venture card awaiting VENTURE_CHOICE
  status?: 'LOBBY' | 'ACTIVE' | 'FINISHED';
  creatorId?: string;
  lastRoll?: Record<string, number>;
  passedBankThisTurn?: boolean;
  passedBankWindowUsed?: boolean;  // bonus SPACE_ACTION (stock window) already granted this turn
  debtResume?: 'ADVANCE_TURN' | 'PRE_ROLL';  // where to go when DEBT_SETTLEMENT clears
  casinoResult?: CasinoResult | null;  // set after CASINO_BET, cleared on turn advance
  arcadeResult?: ArcadeResult | null;  // set after ARCADE_PLAY, cleared on turn advance
  bankruptcyLimit?: number;  // bankruptcies that end the game (default 1; 99 = last player standing)
  endVote?: EndVote | null;  // pending unanimous vote to end the game early
  auction?: Auction | null;  // pending shop auction (pauses all other actions)
  stats?: Record<string, PlayerStats>;  // playerId -> running counters (initialized lazily)
}


export type CasinoGame = 'derby' | 'highlow';

// Outcome of a casino bet — kept on GameState until the turn advances so the
// client can animate the result (race / card flip) before the player ends
// their visit.
export interface CasinoResult {
  playerId: string;
  game: CasinoGame;
  wager: number;
  choice: string;       // derby: slime index '0'-'3' · highlow: 'high' | 'low'
  won: boolean;
  payout: number;       // total gold returned (0 on a loss)
  // derby
  winnerSlime?: number;
  // highlow
  card1?: number;       // 1-13
  card2?: number;
}

export type ArcadeGame = 'slots' | 'memory' | 'darts';

// What an arcade game pays out. Cash amounts are level-scaled at play time.
export type ArcadePrize =
  | { kind: 'cash'; amount: number }
  | { kind: 'shops_up'; pct: number }     // all recipient's shops: base value & rent +pct%
  | { kind: 'shops_down'; pct: number }   // ...or -pct% (Bowser)
  | { kind: 'stock'; shares: number }     // shares in the recipient's strongest district
  | { kind: 'suit_yourself' }             // +1 wildcard (cap 9 → 100G instead)
  | { kind: 'warp'; nodeId: string }      // slots only: teleport, turn continues there
  | { kind: 'nothing' };

// Outcome of an arcade game — kept on GameState until the turn advances so the
// client can animate it. Darts: the prize (or penalty) lands on a random
// alive player, recorded in targetPlayerId.
export interface ArcadeResult {
  playerId: string;
  game: ArcadeGame;
  prize: ArcadePrize;
  reels?: string[];          // slots: 3 displayed symbols
  pickIndex?: number;        // memory: which box was opened
  targetPlayerId?: string;   // darts: who the dart landed on
}

// Opened when a bankruptcy doesn't end the game: every surviving human must
// agree to stop early; any "continue" vote cancels it instantly.
export interface EndVote {
  reason: string;                    // e.g. "Slime went bankrupt (1/2)"
  votes: Record<string, boolean>;    // playerId -> wants to end
}

// A live shop auction. Opened by debt sales (other players bid; the bank's
// 75% offer is the floor) and by the forced-auction venture card (reserve
// 2x value). All other actions pause until it resolves.
export interface Auction {
  propertyId: string;
  sellerId: string;
  reservePrice: number;              // minimum opening bid
  bankFloor?: number;                // debt sales: bank buys at this if nobody bids
  highBid?: { playerId: string; amount: number };
  passed: Record<string, boolean>;   // folded bidders (folding is final)
  context: 'debt' | 'venture';
}
