import type { GameState, District, Property, Player, VentureCard, BuildingType, Node, PlayerStats, CasinoGame } from '../shared/types.js';


export const BASE_SALARY = 250;
export const PROMO_BONUS_PER_LEVEL = 150;
export const MAX_INVEST_PER_TURN = 999;
export const STOCK_PRICE_CHANGE_THRESHOLD = 10;
export const DISTRESS_SALE_RATE = 0.75;
export const CASINO_MIN_WAGER = 10;
export const CASINO_MAX_WAGER = 500;

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export function recalcNetWorth(player: Player, state: GameState): number {
  const stockValue = Object.values(state.districts).reduce((sum, d) => {
    return sum + (d.playerHoldings[player.id] ?? 0) * d.stockPrice;
  }, 0);
  const shopValue = player.propertyIds.reduce(
    (sum, pid) => sum + (state.properties[pid]?.currentPrice ?? 0), 0,
  );
  return player.cash + stockValue + shopValue;
}

export function recalcStockPrice(district: District, properties: Record<string, Property>): number {
  const props = district.propertyIds
    .map(pid => properties[pid])
    .filter((p): p is Property => !!p);
  if (props.length === 0) return 0;
  const total = props.reduce((sum, p) => sum + p.currentPrice, 0);
  return Math.floor((total / props.length) * 0.04);
}

export function recalcDistrictMultipliers(
  district: District,
  properties: Record<string, Property>,
  _players: Record<string, Player>,
): Record<string, Property> {
  const ownedCount: Record<string, number> = {};
  let totalShops = 0;
  for (const pid of district.propertyIds) {
    const prop = properties[pid];
    if (!prop) continue;
    const isVacantPlotNonShop = prop.buildingType !== undefined && prop.buildingType !== 'three_star_shop';
    if (isVacantPlotNonShop) continue;

    totalShops++;
    const ownerId = prop.ownerId;
    if (ownerId) ownedCount[ownerId] = (ownedCount[ownerId] ?? 0) + 1;
  }

  // Vanilla Fortune Street tables (derived from the modding district
  // simulator — see docs/research/02-shops-districts.md). Index = shops the
  // owner holds in this district. Values NEVER scale with district count;
  // only the fee and the investment ceiling do.
  void totalShops;

  const updated = { ...properties };
  for (const pid of district.propertyIds) {
    const prop = properties[pid];
    if (!prop) continue;

    const isVacantPlotNonShop = prop.buildingType !== undefined && prop.buildingType !== 'three_star_shop';
    if (isVacantPlotNonShop) {
      let price = prop.basePrice;
      let rent = prop.currentRent;
      if (prop.buildingType === 'circus') {
        const lvl = prop.circusLevel ?? 0;
        const circusPrices = [100, 500, 1000, 2000];
        price = circusPrices[lvl];
        rent = Math.floor(circusPrices[lvl] / 4);  // tier rents 25/125/250/500
      } else if (prop.buildingType === 'checkpoint') {
        price = 200;
        rent = prop.checkpointToll ?? 50;
      } else if (prop.buildingType === 'balloonport') {
        price = 200;
        rent = 200;
      } else if (prop.buildingType === 'tax_office') {
        price = 200;
        rent = 0;
      } else if (prop.buildingType === 'home') {
        price = 200;
        rent = 0;
      } else if (prop.buildingType === 'estate_agency') {
        price = 200;
        rent = 0;
      } else if (prop.buildingType === 'vacant') {
        price = 200;
        rent = 0;
      }

      updated[pid] = {
        ...prop,
        shopMultiplier: 1,
        currentPrice: price,
        currentRent: rent,
        maxCapital: 0,
      };
      continue;
    }

    const count = prop.ownerId ? (ownedCount[prop.ownerId] ?? 0) : 0;
    const idx = Math.min(count, 5);
    const feeMult = FEE_MULTIPLIER[idx];
    const value = prop.basePrice + prop.capitalInvested;
    updated[pid] = {
      ...prop,
      shopMultiplier: feeMult,
      currentPrice: value,
      maxCapital: Math.floor(value * MAX_CAPITAL_MULT[idx]),
      // Fee grows with the district table AND with invested capital: a full
      // shop-value of capital adds +1x to the fee multiplier (Blue Pichu).
      currentRent: Math.floor(prop.baseRent * (feeMult + prop.capitalInvested / prop.basePrice)),
    };
  }
  return updated;
}

// Shops owned in district → fee multiplier / max-capital multiple of value.
const FEE_MULTIPLIER   = [1, 1, 1.25, 2, 3.25, 6];
const MAX_CAPITAL_MULT = [0, 0.5, 1, 3, 9, 11];

export function recalcAllNetWorths(state: GameState): GameState {
  const players = Object.fromEntries(
    Object.entries(state.players).map(([id, player]) => {
      const cappedCash = Math.min(999999, player.cash);
      const p = { ...player, cash: cappedCash };
      return [
        id,
        { ...p, netWorth: recalcNetWorth(p, state) },
      ];
    }),
  );
  return { ...state, players };
}

export const EMPTY_STATS: PlayerStats = {
  lapsCompleted: 0, rentPaid: 0, rentCollected: 0, biggestRentCollected: 0,
  salariesCollected: 0, sharesBought: 0, sharesSold: 0, propertiesBought: 0,
  ventureCardsDrawn: 0, taxesPaid: 0,
};

// Additive update of a player's running stats (biggestRentCollected takes the max).
export function bumpStats(state: GameState, playerId: string, patch: Partial<PlayerStats>): GameState {
  const current = state.stats?.[playerId] ?? EMPTY_STATS;
  const next: PlayerStats = {
    lapsCompleted: current.lapsCompleted + (patch.lapsCompleted ?? 0),
    rentPaid: current.rentPaid + (patch.rentPaid ?? 0),
    rentCollected: current.rentCollected + (patch.rentCollected ?? 0),
    biggestRentCollected: Math.max(current.biggestRentCollected, patch.biggestRentCollected ?? 0),
    salariesCollected: current.salariesCollected + (patch.salariesCollected ?? 0),
    sharesBought: current.sharesBought + (patch.sharesBought ?? 0),
    sharesSold: current.sharesSold + (patch.sharesSold ?? 0),
    propertiesBought: current.propertiesBought + (patch.propertiesBought ?? 0),
    ventureCardsDrawn: current.ventureCardsDrawn + (patch.ventureCardsDrawn ?? 0),
    taxesPaid: current.taxesPaid + (patch.taxesPaid ?? 0),
  };
  return { ...state, stats: { ...state.stats, [playerId]: next } };
}

// ─── Economic actions ─────────────────────────────────────────────────────────

export function buyProperty(state: GameState, playerId: string, propertyId: string): GameState {
  const player = state.players[playerId];
  const prop = state.properties[propertyId];
  if (!player) throw new Error(`Player ${playerId} not found`);
  if (!prop) throw new Error(`Property ${propertyId} not found`);
  if (prop.ownerId !== null) throw new Error(`Property ${propertyId} is already owned`);
  if (player.cash < prop.currentPrice) throw new Error(`Cannot afford property (need ${prop.currentPrice}g)`);

  const district = state.districts[prop.districtId];

  const s1: GameState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        cash: player.cash - prop.currentPrice,
        propertyIds: [...player.propertyIds, propertyId],
      },
    },
    properties: { ...state.properties, [propertyId]: { ...prop, ownerId: playerId } },
    log: [...state.log, `[BUY] ${player.name} bought the shop at ${prop.nodeId} for ${prop.currentPrice}G.`],
  };

  // Pay commissions on property purchase
  for (const [pId, p] of Object.entries(s1.players)) {
    if (pId !== playerId && p.commissionUntilNextTurn && p.commissionUntilNextTurn > 0) {
      const commPct = p.commissionUntilNextTurn;
      const commAmount = Math.floor(prop.currentPrice * (commPct / 100));
      if (commAmount > 0) {
        s1.players[pId] = {
          ...s1.players[pId],
          cash: s1.players[pId].cash + commAmount,
        };
        s1.log.push(`[COMMISSION] ${p.name} received a ${commPct}% bank commission of ${commAmount}G on the property purchase by ${player.name}.`);
      }
    }
  }

  const updatedProps = recalcDistrictMultipliers(district, s1.properties, s1.players);
  const newStockPrice = recalcStockPrice(district, updatedProps);

  const s2: GameState = {
    ...s1,
    properties: updatedProps,
    districts: {
      ...s1.districts,
      [prop.districtId]: { ...district, stockPrice: newStockPrice },
    },
  };

  return recalcAllNetWorths(bumpStats(s2, playerId, { propertiesBought: 1 }));
}

export function buyoutProperty(state: GameState, buyerId: string, propertyId: string): GameState {
  const buyer = state.players[buyerId];
  const prop = state.properties[propertyId];
  if (!buyer) throw new Error(`Player ${buyerId} not found`);
  if (!prop) throw new Error(`Property ${propertyId} not found`);
  if (prop.ownerId === null) throw new Error(`Property ${propertyId} is unowned`);
  if (prop.ownerId === buyerId) throw new Error(`Cannot buyout own property`);

  const sellerId = prop.ownerId;
  const seller = state.players[sellerId];
  if (!seller) throw new Error(`Seller ${sellerId} not found`);

  const buyoutCost = prop.currentPrice * 5;
  if (buyer.cash < buyoutCost) {
    throw new Error(`Cannot afford buyout of ${propertyId} (need ${buyoutCost}g, have ${buyer.cash}g)`);
  }

  const sellerPayout = prop.currentPrice * 3;
  const district = state.districts[prop.districtId];

  const updatedProps = {
    ...state.properties,
    [propertyId]: { ...prop, ownerId: buyerId },
  };

  const s1: GameState = {
    ...state,
    players: {
      ...state.players,
      [buyerId]: {
        ...buyer,
        cash: buyer.cash - buyoutCost,
        propertyIds: [...buyer.propertyIds, propertyId],
      },
      [sellerId]: {
        ...seller,
        cash: seller.cash + sellerPayout,
        propertyIds: seller.propertyIds.filter(id => id !== propertyId),
      },
    },
    properties: updatedProps,
    log: [...state.log, `[BUYOUT] ${buyer.name} bought out ${seller.name}'s shop at ${prop.nodeId} for ${buyoutCost}G (${seller.name} received ${sellerPayout}G).`],
  };

  // Pay commissions on property buyout
  for (const [pId, p] of Object.entries(s1.players)) {
    if (pId !== buyerId && p.commissionUntilNextTurn && p.commissionUntilNextTurn > 0) {
      const commPct = p.commissionUntilNextTurn;
      const commAmount = Math.floor(buyoutCost * (commPct / 100));
      if (commAmount > 0) {
        s1.players[pId] = {
          ...s1.players[pId],
          cash: s1.players[pId].cash + commAmount,
        };
        s1.log.push(`[COMMISSION] ${p.name} received a ${commPct}% bank commission of ${commAmount}G on the property buyout by ${buyer.name}.`);
      }
    }
  }

  const updatedProps2 = recalcDistrictMultipliers(district, s1.properties, s1.players);
  const newStockPrice = recalcStockPrice(district, updatedProps2);

  const s2: GameState = {
    ...s1,
    properties: updatedProps2,
    districts: {
      ...s1.districts,
      [prop.districtId]: { ...district, stockPrice: newStockPrice },
    },
  };

  return recalcAllNetWorths(bumpStats(s2, buyerId, { propertiesBought: 1 }));
}

export function invest(
  state: GameState,
  playerId: string,
  propertyId: string,
  amount: number,
): GameState {
  const player = state.players[playerId];
  const prop = state.properties[propertyId];
  if (!player) throw new Error(`Player ${playerId} not found`);
  if (!prop) throw new Error(`Property ${propertyId} not found`);
  if (prop.ownerId !== playerId) throw new Error(`Player does not own property ${propertyId}`);

  if (prop.buildingType === 'circus') {
    const lvl = prop.circusLevel ?? 0;
    if (lvl >= 3) throw new Error(`Circus is already fully expanded`);
    const upgradeCosts = [400, 500, 1000];
    const cost = upgradeCosts[lvl];
    if (player.cash < cost) throw new Error(`Cannot afford to expand circus (need ${cost}g)`);
    if (amount !== cost) throw new Error(`Invalid circus expansion amount (need ${cost}g)`);

    const newLevel = lvl + 1;
    const circusPrices = [100, 500, 1000, 2000];
    const newPrice = circusPrices[newLevel];

    const updatedProp = {
      ...prop,
      circusLevel: newLevel,
      currentPrice: newPrice,
      currentRent: Math.floor(newPrice / 4),  // tier rents 25/125/250/500
    };
    const updatedProps = { ...state.properties, [propertyId]: updatedProp };

    const district = state.districts[prop.districtId];
    const updatedProps2 = recalcDistrictMultipliers(district, updatedProps, state.players);
    const newStockPrice = recalcStockPrice(district, updatedProps2);

    const s1: GameState = {
      ...state,
      players: {
        ...state.players,
        [playerId]: { ...player, cash: player.cash - cost },
      },
      properties: updatedProps2,
      districts: {
        ...state.districts,
        [prop.districtId]: { ...district, stockPrice: newStockPrice },
      },
      log: [...state.log, `${player.name} expanded Circus at ${propertyId} to Tier ${newLevel}! Price & rent increased to ${newPrice}G.`],
    };

    return recalcAllNetWorths(s1);
  }

  if (amount > MAX_INVEST_PER_TURN) throw new Error(`Investment exceeds ${MAX_INVEST_PER_TURN}g cap`);
  if (amount > prop.maxCapital - prop.capitalInvested) throw new Error(`Investment exceeds maxCapital`);
  if (player.cash < amount) throw new Error(`Cannot afford investment`);

  const newCapital = prop.capitalInvested + amount;
  const updatedProp = { ...prop, capitalInvested: newCapital };
  const updatedProps = { ...state.properties, [propertyId]: updatedProp };

  const district = state.districts[prop.districtId];
  const updatedProps2 = recalcDistrictMultipliers(district, updatedProps, state.players);
  const newStockPrice = recalcStockPrice(district, updatedProps2);

  const s1: GameState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...player, cash: player.cash - amount },
    },
    properties: updatedProps2,
    districts: {
      ...state.districts,
      [prop.districtId]: { ...district, stockPrice: newStockPrice },
    },
    log: [...state.log, `[INVEST] ${player.name} invested ${amount}G in ${prop.nodeId} (capital ${newCapital}G, rent now ${updatedProps2[propertyId].currentRent}G).`],
  };

  return recalcAllNetWorths(s1);
}

export function payRent(state: GameState, payerId: string, propertyId: string): GameState {
  const payer = state.players[payerId];
  const prop = state.properties[propertyId];
  if (!payer) throw new Error(`Player ${payerId} not found`);
  if (!prop) throw new Error(`Property ${propertyId} not found`);
  if (prop.ownerId === null) throw new Error(`Property ${propertyId} has no owner`);
  if (prop.ownerId === payerId) throw new Error(`Cannot pay rent on own property`);

  const district = state.districts[prop.districtId];
  const owner = state.players[prop.ownerId];
  if (!owner) throw new Error(`Owner ${prop.ownerId} not found`);

  let rent = prop.currentRent;
  if (prop.buildingType !== undefined) {
    if (prop.buildingType === 'tax_office') {
      rent = Math.floor(payer.netWorth * 0.10);
    } else if (prop.buildingType === 'home') {
      rent = 30 * owner.level;
    } else if (prop.buildingType === 'estate_agency' || prop.buildingType === 'vacant') {
      rent = 0;
    } else if (prop.buildingType === 'checkpoint') {
      rent = prop.checkpointToll ?? 50;
    }
  }

  const isClosed = !!owner.shopsClosedUntilNextTurn;
  const isHalved = !isClosed && !!owner.shopPricesHalvedUntilNextTurn;
  const isDoubled = !isClosed && !isHalved && !!owner.shopRentsDoubledUntilNextTurn;

  if (isClosed) {
    rent = 0;
  } else if (isHalved) {
    rent = Math.floor(rent / 2);
  } else if (isDoubled) {
    rent = rent * 2;
  }

  const updatedPlayers = { ...state.players };

  if (rent > 0) {
    // Payer pays rent; owner receives rent
    updatedPlayers[payerId] = { ...payer, cash: payer.cash - rent };
    updatedPlayers[prop.ownerId] = { ...owner, cash: owner.cash + rent };
  }

  const s1: GameState = { ...state, players: updatedPlayers, log: [...state.log] };

  if (isClosed) {
    s1.log.push(`[RENT] ${owner.name}'s shop at ${propertyId} is temporarily closed! Rent of ${prop.currentRent}g is waived.`);
  } else if (isHalved) {
    s1.log.push(`[RENT] ${payer.name} paid halved rent of ${rent}g (originally ${prop.currentRent}g) to ${owner.name}.`);
  } else if (isDoubled) {
    s1.log.push(`[RENT] ${payer.name} paid doubled rent of ${rent}g (originally ${prop.currentRent}g) to ${owner.name}.`);
  } else if (rent > 0) {
    s1.log.push(`[RENT] ${payer.name} paid ${rent}G rent to ${owner.name} at ${prop.nodeId}.`);
  }

  // Boon/Boom Player commissions on rent
  if (rent > 0) {
    for (const [pId, p] of Object.entries(s1.players)) {
      if (pId !== payerId && p.commissionUntilNextTurn && p.commissionUntilNextTurn > 0) {
        const commPct = p.commissionUntilNextTurn;
        const commAmount = Math.floor(rent * (commPct / 100));
        if (commAmount > 0) {
          s1.players[pId] = {
            ...s1.players[pId],
            cash: s1.players[pId].cash + commAmount,
          };
          s1.log.push(`[COMMISSION] ${p.name} received a ${commPct}% bank commission of ${commAmount}G on the rent payment by ${payer.name}.`);
        }
      }
    }
  }

  let sStats = s1;
  if (rent > 0) {
    sStats = bumpStats(sStats, payerId, { rentPaid: rent });
    sStats = bumpStats(sStats, prop.ownerId, { rentCollected: rent, biggestRentCollected: rent });
  }

  const s2 = checkBankruptcy(sStats, payerId);
  return recalcAllNetWorths(s2);
}

export function buyStock(
  state: GameState,
  playerId: string,
  districtId: string,
  shares: number,
): GameState {
  const player = state.players[playerId];
  const district = state.districts[districtId];
  if (!player) throw new Error(`Player ${playerId} not found`);
  if (!district) throw new Error(`District ${districtId} not found`);
  const cost = shares * district.stockPrice;
  if (!Number.isInteger(shares) || shares < 1) throw new Error(`Shares must be a positive integer`);
  if (shares > 99) throw new Error(`Cannot purchase more than 99 stocks in one district at a time`);
  if (player.cash < cost) throw new Error(`Cannot afford ${shares} shares (need ${cost}g)`);

  let newStockPrice = district.stockPrice;
  if (shares >= STOCK_PRICE_CHANGE_THRESHOLD) {
    newStockPrice = district.stockPrice + Math.floor(district.stockPrice / 16) + 1;
  }

  const s1: GameState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...player, cash: player.cash - cost },
    },
    districts: {
      ...state.districts,
      [districtId]: {
        ...district,
        stockPrice: newStockPrice,
        playerHoldings: {
          ...district.playerHoldings,
          [playerId]: (district.playerHoldings[playerId] ?? 0) + shares,
        },
      },
    },
    log: [...state.log, `[STOCK] ${player.name} bought ${shares} shares of ${district.name} for ${cost}G.`
      + (newStockPrice !== district.stockPrice ? ` Price ${district.stockPrice}G → ${newStockPrice}G.` : '')],
  };

  // Pay commissions on stock purchase
  for (const [pId, p] of Object.entries(s1.players)) {
    if (pId !== playerId && p.commissionUntilNextTurn && p.commissionUntilNextTurn > 0) {
      const commPct = p.commissionUntilNextTurn;
      const commAmount = Math.floor(cost * (commPct / 100));
      if (commAmount > 0) {
        s1.players[pId] = {
          ...s1.players[pId],
          cash: s1.players[pId].cash + commAmount,
        };
        s1.log.push(`[COMMISSION] ${p.name} received a ${commPct}% bank commission of ${commAmount}G on the stock purchase by ${player.name}.`);
      }
    }
  }

  return recalcAllNetWorths(bumpStats(s1, playerId, { sharesBought: shares }));
}

export function sellStock(
  state: GameState,
  playerId: string,
  districtId: string,
  shares: number,
): GameState {
  const player = state.players[playerId];
  const district = state.districts[districtId];
  if (!player) throw new Error(`Player ${playerId} not found`);
  if (!district) throw new Error(`District ${districtId} not found`);
  if (!Number.isInteger(shares) || shares < 1) throw new Error(`Shares must be a positive integer`);
  const held = district.playerHoldings[playerId] ?? 0;
  if (held < shares) throw new Error(`Player holds ${held} shares, cannot sell ${shares}`);

  const proceeds = shares * district.stockPrice;

  let newStockPrice = district.stockPrice;
  if (shares >= STOCK_PRICE_CHANGE_THRESHOLD) {
    const priceFloor = recalcStockPrice(district, state.properties);
    newStockPrice = Math.max(
      priceFloor,
      district.stockPrice - (Math.floor(district.stockPrice / 16) + 1),
    );
  }

  const s1: GameState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...player, cash: player.cash + proceeds },
    },
    districts: {
      ...state.districts,
      [districtId]: {
        ...district,
        stockPrice: newStockPrice,
        playerHoldings: { ...district.playerHoldings, [playerId]: held - shares },
      },
    },
    log: [...state.log, `[STOCK] ${player.name} sold ${shares} shares of ${district.name} for ${proceeds}G.`
      + (newStockPrice !== district.stockPrice ? ` Price ${district.stockPrice}G → ${newStockPrice}G.` : '')],
  };

  return recalcAllNetWorths(bumpStats(s1, playerId, { sharesSold: shares }));
}

// requireBankNode=false is used for pass-through salary: the player walked past
// the bank mid-move and now stands on a different node.
// True when the player's suits plus their Suit Yourself wildcards cover all
// four suits — the promotion condition.
export function canPromote(player: Player): boolean {
  const { suits } = player;
  const missing = [suits.heart, suits.diamond, suits.club, suits.spade].filter(h => !h).length;
  return missing <= (player.suitYourself ?? 0);
}

export function collectSalary(state: GameState, playerId: string, requireBankNode = true): GameState {
  const player = state.players[playerId];
  if (!player) throw new Error(`Player ${playerId} not found`);

  if (requireBankNode) {
    const node = state.board[player.currentNodeId];
    if (!node || node.type !== 'bank') throw new Error(`Player must be at a bank node`);
  }

  if (!canPromote(player)) {
    throw new Error(`Player must hold all 4 suits (or wildcards) to collect salary`);
  }
  const { suits } = player;
  const missing = [suits.heart, suits.diamond, suits.club, suits.spade].filter(h => !h).length;

  const shopValue = player.propertyIds.reduce(
    (sum, pid) => sum + (state.properties[pid]?.currentPrice ?? 0), 0,
  );
  const salary = BASE_SALARY + Math.floor(shopValue * 0.10) + (player.level * PROMO_BONUS_PER_LEVEL);
  const newLevel = player.level + 1;

  const s1: GameState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        cash: player.cash + salary,
        level: newLevel,
        suits: { heart: false, diamond: false, club: false, spade: false },
        // Wildcards are spent to cover the missing suits
        suitYourself: (player.suitYourself ?? 0) - missing,
      },
    },
    log: [...state.log, `[SALARY] ${player.name} collected ${salary}g (level ${newLevel})`],
  };

  return recalcAllNetWorths(bumpStats(s1, playerId, { salariesCollected: 1 }));
}

// ─── Casino minigames ─────────────────────────────────────────────────────────

const CARD_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export function cardLabel(n: number): string {
  return CARD_LABELS[n - 1] ?? String(n);
}

export const DERBY_SLIME_NAMES = ['Azure Streak', 'Ember Dash', 'Rose Bounce', 'Metal Bullet'];

// One bet per casino visit. Derby: pick 1 of 4 slimes, win pays 4x the wager.
// High-Low: see a card, call the next one higher or lower (tie loses), pays 2x.
export function playCasino(
  state: GameState,
  playerId: string,
  game: CasinoGame,
  wager: number,
  choice: string,
): GameState {
  const player = state.players[playerId];
  if (!player) throw new Error(`Player ${playerId} not found`);
  if (!Number.isInteger(wager)) throw new Error(`Wager must be an integer`);
  if (wager < CASINO_MIN_WAGER || wager > CASINO_MAX_WAGER) {
    throw new Error(`Wager must be between ${CASINO_MIN_WAGER} and ${CASINO_MAX_WAGER}`);
  }
  if (player.cash < wager) throw new Error(`Cannot afford a ${wager}G wager`);

  let won: boolean;
  let payout: number;
  let winnerSlime: number | undefined;
  let card1: number | undefined;
  let card2: number | undefined;
  let logLine: string;

  if (game === 'derby') {
    const pick = Number(choice);
    if (!Number.isInteger(pick) || pick < 0 || pick > 3) throw new Error(`Derby choice must be '0'-'3'`);
    winnerSlime = Math.floor(Math.random() * 4);
    won = winnerSlime === pick;
    payout = won ? wager * 4 : 0;
    logLine = `[CASINO] ${player.name} wagered ${wager}G on ${DERBY_SLIME_NAMES[pick]} — ${DERBY_SLIME_NAMES[winnerSlime]} wins the derby! ${won ? `Paid ${payout}G.` : 'Wager lost.'}`;
  } else if (game === 'highlow') {
    if (choice !== 'high' && choice !== 'low') throw new Error(`High-Low choice must be 'high' or 'low'`);
    card1 = 1 + Math.floor(Math.random() * 13);
    card2 = 1 + Math.floor(Math.random() * 13);
    won = choice === 'high' ? card2 > card1 : card2 < card1;
    payout = won ? wager * 2 : 0;
    logLine = `[CASINO] ${player.name} wagered ${wager}G on ${choice} after ${cardLabel(card1)} — drew ${cardLabel(card2)}. ${won ? `Paid ${payout}G.` : 'Wager lost.'}`;
  } else {
    throw new Error(`Unknown casino game: ${String(game)}`);
  }

  const s1: GameState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...player, cash: player.cash - wager + payout },
    },
    casinoResult: { playerId, game, wager, choice, won, payout, winnerSlime, card1, card2 },
    log: [...state.log, logLine],
  };

  return recalcAllNetWorths(s1);
}

// requireBankNode=false is used for pass-through wins: walking past the bank
// counts as returning to it, even though the player stops on a later node.
export function checkWinCondition(state: GameState, playerId: string, requireBankNode = true): GameState {
  if (state.winnerId) return state;
  const player = state.players[playerId];
  if (!player) return state;
  if (player.netWorth < state.targetNetWorth) return state;
  if (requireBankNode) {
    const node = state.board[player.currentNodeId];
    if (!node || node.type !== 'bank') return state;
  }
  return {
    ...state,
    winnerId: playerId,
    log: [...state.log, `[WIN] ${player.name} reached ${player.netWorth}G net worth and returned to the bank — victory!`],
  };
}

// Distress sale: the bank buys one shop at 75% of currentPrice. Used by the
// player's own choice in DEBT_SETTLEMENT and by forced liquidation below.
export function distressSellProperty(state: GameState, playerId: string, propertyId: string): GameState {
  const player = state.players[playerId];
  const prop = state.properties[propertyId];
  if (!player) throw new Error(`Player ${playerId} not found`);
  if (!prop) throw new Error(`Property ${propertyId} not found`);
  if (prop.ownerId !== playerId) throw new Error(`Player does not own property ${propertyId}`);

  const proceeds = Math.floor(prop.currentPrice * DISTRESS_SALE_RATE);
  const district = state.districts[prop.districtId];

  const s1: GameState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        cash: player.cash + proceeds,
        propertyIds: player.propertyIds.filter(id => id !== propertyId),
      },
    },
    properties: { ...state.properties, [propertyId]: { ...prop, ownerId: null } },
    log: [...state.log, `[DISTRESS] ${player.name} sold the shop at ${prop.nodeId} to the bank for ${proceeds}G (75% of value).`],
  };

  const updatedProps = recalcDistrictMultipliers(district, s1.properties, s1.players);
  const newStockPrice = recalcStockPrice(district, updatedProps);
  return recalcAllNetWorths({
    ...s1,
    properties: updatedProps,
    districts: {
      ...s1.districts,
      [prop.districtId]: { ...district, stockPrice: newStockPrice },
    },
  });
}

// Max gold a player could raise by selling everything: stock at current
// prices plus shops at the 75% distress rate.
export function maxRaisable(state: GameState, playerId: string): number {
  const player = state.players[playerId];
  if (!player) return 0;
  let total = 0;
  for (const d of Object.values(state.districts)) {
    total += (d.playerHoldings[playerId] ?? 0) * d.stockPrice;
  }
  for (const pid of player.propertyIds) {
    const prop = state.properties[pid];
    if (prop) total += Math.floor(prop.currentPrice * DISTRESS_SALE_RATE);
  }
  return total;
}

export function checkBankruptcy(state: GameState, playerId: string): GameState {
  const player = state.players[playerId];
  if (player.cash >= 0) return state;

  // Salvageable debt: the player chooses what to sell in the DEBT_SETTLEMENT
  // phase — never auto-sell on their behalf.
  if (player.cash + maxRaisable(state, playerId) >= 0) {
    return {
      ...state,
      log: [...state.log, `[DEBT] ${player.name} is ${-player.cash}G in debt and must sell assets to cover it.`],
    };
  }

  // Hopeless: even full liquidation cannot cover the debt. Forced
  // liquidation, then bankruptcy ends the game.
  let s = state;

  for (const districtId of Object.keys(s.districts)) {
    const shares = s.districts[districtId].playerHoldings[playerId] ?? 0;
    if (shares <= 0) continue;
    s = sellStock(s, playerId, districtId, shares);
  }

  for (const pid of [...s.players[playerId].propertyIds]) {
    if (!s.properties[pid]) continue;
    s = distressSellProperty(s, playerId, pid);
  }

  // Mark bankrupt on the recalculated state — callers may pass stale
  // netWorth values (e.g. a toll deducted cash without a recalc), and with
  // zero assets the liquidation loops above never refresh anything.
  s = recalcAllNetWorths(s);
  const finalPlayer = s.players[playerId];
  if (finalPlayer.netWorth < 0) {
    s = {
      ...s,
      players: { ...s.players, [playerId]: { ...finalPlayer, isBankrupt: true } },
      bankruptCount: s.bankruptCount + 1,
      log: [...s.log],
    };

    const alive = s.turnOrder.filter(pid => !s.players[pid].isBankrupt);
    const aliveHumans = alive.filter(pid => !s.players[pid].isBot);
    const limit = s.bankruptcyLimit ?? 1;

    if (s.bankruptCount >= limit || alive.length <= 1 || aliveHumans.length === 0) {
      // Bankruptcy limit met (or no human left to play on): game over,
      // richest survivor wins.
      s.log.push(`[BANKRUPT] ${finalPlayer.name} is bankrupt! The game is over.`);
      s.winnerId = richestAlive(s);
    } else {
      // Eliminated, but the table plays on — open a unanimous end-game
      // vote among the surviving humans.
      s.log.push(`[ELIMINATED] ${finalPlayer.name} is bankrupt and out of the game! (${s.bankruptCount}/${limit === 99 ? 'last standing' : limit})`);
      s.log.push(`[VOTE] End the game now? All remaining players must agree.`);
      s.endVote = { reason: `${finalPlayer.name} went bankrupt`, votes: {} };
    }
  }

  return s;
}

// Highest net worth among non-bankrupt players; later turnOrder seat wins ties.
export function richestAlive(state: GameState): string | null {
  let bestPlayerId: string | null = null;
  let bestNetWorth = -Infinity;
  for (const [pId, p] of Object.entries(state.players)) {
    if (p.isBankrupt) continue;
    if (p.netWorth > bestNetWorth) {
      bestNetWorth = p.netWorth;
      bestPlayerId = pId;
    } else if (p.netWorth === bestNetWorth && bestPlayerId !== null) {
      const idxCurrent = state.turnOrder.indexOf(pId);
      const idxBest = state.turnOrder.indexOf(bestPlayerId);
      if (idxCurrent > idxBest) {
        bestPlayerId = pId;
      }
    }
  }
  return bestPlayerId;
}

// ─── Venture Cards & Grid System ──────────────────────────────────────────────

export const VENTURE_CARDS_LIST: Omit<VentureCard, 'number'>[] = [
  {
    title: 'Lucky Break',
    text: 'You found a sack of gold coins! Gain 200G cash.',
    payout: 200,
    effectType: 'CASH_GAIN'
  },
  {
    title: 'Income Tax',
    text: 'The kingdom demands taxes! Pay 100G cash.',
    payout: 100,
    effectType: 'CASH_LOSS'
  },
  {
    title: 'Stock Split',
    text: 'Stock split! Receive 5 bonus shares in a district where you own the most shops.',
    payout: 0,
    effectType: 'STOCK_GAIN'
  },
  {
    title: 'Bull Market',
    text: 'Market optimism spreads! Stock price in all districts increases by 10%.',
    payout: 0,
    effectType: 'STOCK_BUFF'
  },
  {
    title: 'Bear Market',
    text: 'Market slump! Stock price in a random district decreases by 10%.',
    payout: 0,
    effectType: 'STOCK_SLUMP'
  },
  {
    title: 'Suit Giveaway',
    text: 'A wandering merchant gifts you a missing suit card!',
    payout: 0,
    effectType: 'SUIT_GIFT'
  },
  {
    title: 'Warp to Bank',
    text: 'Dimensional rift! You are teleported directly to the Bank node.',
    payout: 0,
    effectType: 'WARP_BANK'
  },
  {
    title: 'Warp to Vacant Node',
    text: 'Winds of opportunity! Warp to the nearest vacant node.',
    payout: 0,
    effectType: 'WARP_VACANT'
  },
  {
    title: 'Fast Steps',
    text: 'You feel energetic! Roll again immediately after this turn ends.',
    payout: 0,
    effectType: 'ROLL_AGAIN'
  },
  {
    title: 'Grand Opening',
    text: 'Grand opening! One of your properties boosts base value and rent by 20%.',
    payout: 0,
    effectType: 'PROP_BUFF'
  },
  {
    title: 'Uptown Development',
    text: 'District Development! Uptown stock price rises by 15%.',
    payout: 0,
    effectType: 'STOCK_BUFF',
    targetId: 'd1'
  },
  {
    title: 'Downtown Development',
    text: 'District Development! Downtown stock price rises by 15%.',
    payout: 0,
    effectType: 'STOCK_BUFF',
    targetId: 'd2'
  },
  {
    title: 'Bountiful Harvest',
    text: 'Bountiful harvest! Gain 300G cash.',
    payout: 300,
    effectType: 'CASH_GAIN'
  },
  {
    title: 'Charity Tax',
    text: 'Supporting the community! Pay 150G cash.',
    payout: 150,
    effectType: 'CASH_LOSS'
  },
  {
    title: 'Double Time',
    text: 'Time warp! Roll again immediately after this turn ends.',
    payout: 0,
    effectType: 'ROLL_AGAIN'
  },
  {
    title: 'Warp to Bank',
    text: 'Dimensional rift! You are teleported directly to the Bank node.',
    payout: 0,
    effectType: 'WARP_BANK'
  },
  {
    title: 'Shop Owner Bonus',
    text: 'Special bonus! You receive 27 times the number of shops you own in gold coins from the bank!',
    payout: 0,
    effectType: 'SHOP_MULTIPLIER_BONUS'
  },
  {
    title: 'Free Heart',
    text: 'Freebie! Take a heart! (If you already have a heart, you get 100G instead.)',
    payout: 0,
    effectType: 'SUIT_HEART_OR_CASH'
  },
  {
    title: 'Drop Wallet',
    text: 'Misadventure! You drop your wallet and lose 10% of your ready cash!',
    payout: 0,
    effectType: 'CASH_PERCENT_LOSS'
  },
  {
    title: '10% Stock Dividend',
    text: 'Special bonus! You receive a 10% dividend on your stocks!',
    payout: 0,
    effectType: 'STOCK_DIVIDEND_10'
  },
  {
    title: '20% Stock Dividend',
    text: 'Special bonus! You receive a 20% dividend on your stocks!',
    payout: 0,
    effectType: 'STOCK_DIVIDEND_20'
  },
  {
    title: 'Dicey Adventure',
    text: 'Roll a die. If odd, your shops close until your next turn. If even, all other players\' shops close!',
    payout: 0,
    effectType: 'DICEY_CLOSED'
  },
  {
    title: 'Half-Price Special',
    text: 'Clearance sale! Your shop rents are halved until your next turn.',
    payout: 0,
    effectType: 'HALF_RENT_TEMP'
  },
  {
    title: 'Big Commission',
    text: 'Boon times! Receive a 50% commission funded by the bank on all other players\' payments until your next turn.',
    payout: 50,
    effectType: 'COMMISSION_TEMP'
  },
  // ── Cards 25-64: expanded pool modeled on the original game's venture deck ──
  {
    title: 'Venture On!',
    text: 'Adventure calls! Roll the die again after this turn ends.',
    payout: 0,
    effectType: 'ROLL_AGAIN'
  },
  {
    title: 'Roadside Coins',
    text: 'You spot coins glinting in the dirt! Gain 100G cash.',
    payout: 100,
    effectType: 'CASH_GAIN'
  },
  {
    title: 'Hidden Treasure Chest',
    text: 'You pry open a forgotten chest! Gain 500G cash.',
    payout: 500,
    effectType: 'CASH_GAIN'
  },
  {
    title: 'Highway Robbery',
    text: 'Bandits ambush you on the road! Pay 200G cash.',
    payout: 200,
    effectType: 'CASH_LOSS'
  },
  {
    title: 'Seniority Bonus',
    text: 'Experience pays! Receive 40G for each promotion level you hold.',
    payout: 40,
    effectType: 'CASH_GAIN_PER_LEVEL'
  },
  {
    title: 'Suit Collector\'s Purse',
    text: 'Style rewarded! Receive 50G for each suit symbol you hold.',
    payout: 50,
    effectType: 'CASH_GAIN_PER_SUIT'
  },
  {
    title: 'Birthday Celebration',
    text: 'It\'s your birthday! Every other player gives you 30G.',
    payout: 30,
    effectType: 'CASH_FROM_EACH_PLAYER'
  },
  {
    title: 'Round of Drinks',
    text: 'Generosity strikes! Pay every other player 20G.',
    payout: 20,
    effectType: 'CASH_TO_EACH_PLAYER'
  },
  {
    title: 'Capital Gains Levy',
    text: 'The taxman eyes your portfolio! Pay 10% of your total stock value.',
    payout: 0,
    effectType: 'STOCK_TAX_10'
  },
  {
    title: 'Free Renovation',
    text: 'A master builder volunteers! 100G of free capital is invested into your most valuable shop.',
    payout: 100,
    effectType: 'FREE_CAPITAL'
  },
  {
    title: 'Property Boom',
    text: 'Land values soar! All your shops increase base value and rent by 10%.',
    payout: 0,
    effectType: 'ALL_SHOPS_PRICE_UP'
  },
  {
    title: 'Express Carriage',
    text: 'A carriage whisks you away to the nearest stockbroker!',
    payout: 0,
    effectType: 'WARP_BROKER'
  },
  {
    title: 'Insider Tip',
    text: 'A friendly broker slips you 5 bonus shares in your strongest district.',
    payout: 0,
    effectType: 'STOCK_GAIN'
  },
  {
    title: 'Trading Frenzy',
    text: 'The exchange erupts! Stock price in all districts increases by 10%.',
    payout: 0,
    effectType: 'STOCK_BUFF'
  },
  {
    title: 'Market Correction',
    text: 'Panicked selling! Stock price in a random district decreases by 10%.',
    payout: 0,
    effectType: 'STOCK_SLUMP'
  },
  {
    title: 'Generous Traveler',
    text: 'A kindly stranger gifts you a missing suit card!',
    payout: 0,
    effectType: 'SUIT_GIFT'
  },
  {
    title: 'Heartfelt Gift',
    text: 'Freebie! Take a heart! (If you already have a heart, you get 100G instead.)',
    payout: 0,
    effectType: 'SUIT_HEART_OR_CASH'
  },
  {
    title: 'Royal Summons',
    text: 'The king demands your presence! You are teleported directly to the Bank.',
    payout: 0,
    effectType: 'WARP_BANK'
  },
  {
    title: 'Land Rush',
    text: 'Opportunity knocks! Warp to the nearest vacant shop.',
    payout: 0,
    effectType: 'WARP_VACANT'
  },
  {
    title: 'Pickpocketed',
    text: 'A cutpurse strikes! You lose 10% of your ready cash.',
    payout: 0,
    effectType: 'CASH_PERCENT_LOSS'
  },
  {
    title: 'Quarterly Dividend',
    text: 'Special bonus! You receive a 10% dividend on your stocks!',
    payout: 0,
    effectType: 'STOCK_DIVIDEND_10'
  },
  {
    title: 'Annual Dividend',
    text: 'Special bonus! You receive a 20% dividend on your stocks!',
    payout: 0,
    effectType: 'STOCK_DIVIDEND_20'
  },
  {
    title: 'Dicey Gamble',
    text: 'Roll a die. If odd, your shops close until your next turn. If even, all other players\' shops close!',
    payout: 0,
    effectType: 'DICEY_CLOSED'
  },
  {
    title: 'Clearance Sale',
    text: 'Stock must go! Your shop rents are halved until your next turn.',
    payout: 0,
    effectType: 'HALF_RENT_TEMP'
  },
  {
    title: 'Sales Frenzy',
    text: 'Customers flood in! Your shop rents are doubled until your next turn.',
    payout: 0,
    effectType: 'DOUBLE_RENT_TEMP'
  },
  {
    title: 'Broker\'s Cut',
    text: 'Boon times! Receive a 25% commission funded by the bank on all other players\' payments until your next turn.',
    payout: 25,
    effectType: 'COMMISSION_TEMP'
  },
  {
    title: 'Renovation Award',
    text: 'Recognition! One of your properties boosts base value and rent by 20%.',
    payout: 0,
    effectType: 'PROP_BUFF'
  },
  {
    title: 'Franchise Bonus',
    text: 'Special bonus! You receive 35 times the number of shops you own in gold coins from the bank!',
    payout: 35,
    effectType: 'SHOP_MULTIPLIER_BONUS'
  },
  {
    title: 'Lucky Find',
    text: 'Fortune smiles! Gain 150G cash.',
    payout: 150,
    effectType: 'CASH_GAIN'
  },
  {
    title: 'Royal Reward',
    text: 'The crown honors your service! Gain 250G cash.',
    payout: 250,
    effectType: 'CASH_GAIN'
  },
  {
    title: 'Toll Road',
    text: 'An unexpected toll gate! Pay 50G cash.',
    payout: 50,
    effectType: 'CASH_LOSS'
  },
  {
    title: 'Executive Bonus',
    text: 'Rank has its privileges! Receive 60G for each promotion level you hold.',
    payout: 60,
    effectType: 'CASH_GAIN_PER_LEVEL'
  },
  {
    title: 'Victory Parade',
    text: 'The crowd showers you with gifts! Every other player gives you 50G.',
    payout: 50,
    effectType: 'CASH_FROM_EACH_PLAYER'
  },
  {
    title: 'Second Wind',
    text: 'Energy surges through you! Roll the die again after this turn ends.',
    payout: 0,
    effectType: 'ROLL_AGAIN'
  },
  {
    title: 'District Speculation',
    text: 'Rumors spread fast! Stock price in all districts increases by 10%.',
    payout: 0,
    effectType: 'STOCK_BUFF'
  },
  {
    title: 'Bubble Burst',
    text: 'Confidence wavers! Stock price in a random district decreases by 10%.',
    payout: 0,
    effectType: 'STOCK_SLUMP'
  },
  {
    title: 'Guild Sponsorship',
    text: 'The merchants\' guild backs you! 100G of free capital is invested into your most valuable shop.',
    payout: 100,
    effectType: 'FREE_CAPITAL'
  },
  {
    title: 'Urban Renewal',
    text: 'The whole street prospers! All your shops increase base value and rent by 10%.',
    payout: 0,
    effectType: 'ALL_SHOPS_PRICE_UP'
  },
  {
    title: 'Windfall',
    text: 'A grateful merchant repays an old debt! Gain 300G cash.',
    payout: 300,
    effectType: 'CASH_GAIN'
  },
  {
    title: 'Royal Audience',
    text: 'The court admires your finery! Receive 75G for each suit symbol you hold.',
    payout: 75,
    effectType: 'CASH_GAIN_PER_SUIT'
  },
  // ── Cards 65-96: extended pool. Each game's grid seeds a random 64-card
  //    subset (seedVentureGridCardIds), so decks vary between matches. ──
  {
    title: 'Slime Stampede',
    text: 'A herd of slimes trample your stall! Pay 120G cash.',
    payout: 120,
    effectType: 'CASH_LOSS'
  },
  {
    title: 'Metal Slime Bounty',
    text: 'You corner a metal slime! Gain 400G cash.',
    payout: 400,
    effectType: 'CASH_GAIN'
  },
  {
    title: 'Pilgrim\'s Alms',
    text: 'Travelers leave offerings! Gain 80G cash.',
    payout: 80,
    effectType: 'CASH_GAIN'
  },
  {
    title: 'Royal Pension',
    text: 'The treasury honors seniority! Receive 50G for each promotion level you hold.',
    payout: 50,
    effectType: 'CASH_GAIN_PER_LEVEL'
  },
  {
    title: 'Tailor\'s Commission',
    text: 'Your fine suits inspire fashion! Receive 60G for each suit symbol you hold.',
    payout: 60,
    effectType: 'CASH_GAIN_PER_SUIT'
  },
  {
    title: 'Festival Tribute',
    text: 'The town celebrates you! Every other player gives you 40G.',
    payout: 40,
    effectType: 'CASH_FROM_EACH_PLAYER'
  },
  {
    title: 'Charity Gala',
    text: 'You host a grand feast! Pay every other player 30G.',
    payout: 30,
    effectType: 'CASH_TO_EACH_PLAYER'
  },
  {
    title: 'Audit Season',
    text: 'The exchequer reviews your books! Pay 10% of your total stock value.',
    payout: 0,
    effectType: 'STOCK_TAX_10'
  },
  {
    title: 'Artisan Guild Grant',
    text: 'Master craftsmen pitch in! 100G of free capital is invested into your most valuable shop.',
    payout: 100,
    effectType: 'FREE_CAPITAL'
  },
  {
    title: 'Trade Route Opens',
    text: 'New caravans arrive! All your shops increase base value and rent by 10%.',
    payout: 0,
    effectType: 'ALL_SHOPS_PRICE_UP'
  },
  {
    title: 'Chimaera Wing',
    text: 'The wing flutters! You are whisked to the nearest stockbroker.',
    payout: 0,
    effectType: 'WARP_BROKER'
  },
  {
    title: 'Return Spell',
    text: 'Zoom! You are teleported directly to the Bank node.',
    payout: 0,
    effectType: 'WARP_BANK'
  },
  {
    title: 'Pioneer\'s Calling',
    text: 'Unclaimed land beckons! Warp to the nearest vacant shop.',
    payout: 0,
    effectType: 'WARP_VACANT'
  },
  {
    title: 'Haste Spell',
    text: 'Accelerated! Roll the die again after this turn ends.',
    payout: 0,
    effectType: 'ROLL_AGAIN'
  },
  {
    title: 'Broker\'s Favor',
    text: 'A grateful broker slips you 5 bonus shares in your strongest district.',
    payout: 0,
    effectType: 'STOCK_GAIN'
  },
  {
    title: 'Merchant Optimism',
    text: 'Confidence sweeps the exchange! Stock price in all districts increases by 10%.',
    payout: 0,
    effectType: 'STOCK_BUFF'
  },
  {
    title: 'Caravan Raid',
    text: 'Bandits hit the trade routes! Stock price in a random district decreases by 10%.',
    payout: 0,
    effectType: 'STOCK_SLUMP'
  },
  {
    title: 'Fairy\'s Blessing',
    text: 'A fairy takes pity! She gifts you a missing suit card.',
    payout: 0,
    effectType: 'SUIT_GIFT'
  },
  {
    title: 'Heart of Gold',
    text: 'Freebie! Take a heart! (If you already have a heart, you get 100G instead.)',
    payout: 0,
    effectType: 'SUIT_HEART_OR_CASH'
  },
  {
    title: 'Leaky Coin Purse',
    text: 'A hole in your pocket! You lose 10% of your ready cash.',
    payout: 0,
    effectType: 'CASH_PERCENT_LOSS'
  },
  {
    title: 'Modest Dividend',
    text: 'Special bonus! You receive a 10% dividend on your stocks!',
    payout: 0,
    effectType: 'STOCK_DIVIDEND_10'
  },
  {
    title: 'Bumper Dividend',
    text: 'Special bonus! You receive a 20% dividend on your stocks!',
    payout: 0,
    effectType: 'STOCK_DIVIDEND_20'
  },
  {
    title: 'Coin Toss of Fate',
    text: 'Roll a die. If odd, your shops close until your next turn. If even, all other players\' shops close!',
    payout: 0,
    effectType: 'DICEY_CLOSED'
  },
  {
    title: 'Renovation Closure',
    text: 'Dust everywhere! Your shop rents are halved until your next turn.',
    payout: 0,
    effectType: 'HALF_RENT_TEMP'
  },
  {
    title: 'Market Day',
    text: 'The whole town shops at your stalls! Your shop rents are doubled until your next turn.',
    payout: 0,
    effectType: 'DOUBLE_RENT_TEMP'
  },
  {
    title: 'Banker\'s Patronage',
    text: 'Boon times! Receive a 30% commission funded by the bank on all other players\' payments until your next turn.',
    payout: 30,
    effectType: 'COMMISSION_TEMP'
  },
  {
    title: 'Award-Winning Storefront',
    text: 'Recognition! One of your properties boosts base value and rent by 20%.',
    payout: 0,
    effectType: 'PROP_BUFF'
  },
  {
    title: 'Chain Store Royalties',
    text: 'Special bonus! You receive 30 times the number of shops you own in gold coins from the bank!',
    payout: 30,
    effectType: 'SHOP_MULTIPLIER_BONUS'
  },
  {
    title: 'Dragon\'s Hoard Scraps',
    text: 'You sweep up after a dragon! Gain 350G cash.',
    payout: 350,
    effectType: 'CASH_GAIN'
  },
  {
    title: 'Bridge Toll Evasion Fine',
    text: 'Caught skipping the toll! Pay 80G cash.',
    payout: 80,
    effectType: 'CASH_LOSS'
  },
  {
    title: 'Crowdfunded Venture',
    text: 'Supporters rally to you! Every other player gives you 25G.',
    payout: 25,
    effectType: 'CASH_FROM_EACH_PLAYER'
  },
  {
    title: 'Royal Treasury Bond',
    text: 'Your investment matures! Gain 200G cash.',
    payout: 200,
    effectType: 'CASH_GAIN'
  },
  {
    title: 'Suit Yourself',
    text: 'Freebie! Take a Suit Yourself card — a wildcard for any missing suit. (Max 9.)',
    payout: 0,
    effectType: 'SUIT_YOURSELF_GAIN'
  },
  {
    title: 'Suits All Round',
    text: 'Freebie! All players take a Suit Yourself card!',
    payout: 0,
    effectType: 'SUIT_YOURSELF_ALL'
  },
  {
    title: 'Suit Merchant',
    text: 'Suit venture! Buy a Suit Yourself card for 100G.',
    payout: 100,
    effectType: 'SUIT_YOURSELF_BUY'
  },
  {
    title: 'Suit Bargain',
    text: 'Suit venture! Buy a Suit Yourself card for 50G.',
    payout: 50,
    effectType: 'SUIT_YOURSELF_BUY'
  },
  {
    title: 'Suit Scramble',
    text: 'Freebie! Roll the die and get half the number shown of Suit Yourself cards (rounded down).',
    payout: 0,
    effectType: 'SUIT_YOURSELF_ROLL'
  },
  {
    title: 'Assets Tax',
    text: 'Misadventure! You pay an assets tax of two gold coins per share of stock you own!',
    payout: 2,
    effectType: 'STOCK_TAX_PER_SHARE'
  },
  {
    title: 'Musical Squares',
    text: 'Misadventure! All other players swap places!',
    payout: 0,
    effectType: 'SWAP_OTHERS'
  },
  {
    title: 'Go-Slow Order',
    text: 'Misadventure! All other players can only move forward 1 on their next turn.',
    payout: 1,
    effectType: 'MOVE_RESTRICTION'
  },
  {
    title: 'Forced March',
    text: 'Misadventure! All other players must move exactly 7 on their next turn.',
    payout: 7,
    effectType: 'MOVE_RESTRICTION'
  },
  {
    title: 'Advance Payday',
    text: 'Special bonus! You receive half of your salary!',
    payout: 0,
    effectType: 'HALF_SALARY'
  },
  {
    title: 'Sudden Promotion',
    text: 'Special bonus! You get a sudden promotion and receive a salary! (You lose any suits you have.)',
    payout: 0,
    effectType: 'SUDDEN_PROMOTION'
  },
  {
    title: 'Patron of Industry',
    text: 'Capital venture! The bank invests 200G of its own money in your shops.',
    payout: 200,
    effectType: 'FREE_CAPITAL'
  },
  {
    title: 'Royal Grant',
    text: 'Capital venture! The bank invests 400G of its own money in your shops.',
    payout: 400,
    effectType: 'FREE_CAPITAL'
  }
];

// Pick a random 64-card subset of the pool for a fresh venture grid.
// Returns 64 distinct card numbers (1-based indexes into VENTURE_CARDS_LIST).
export function seedVentureGridCardIds(): number[] {
  const all = Array.from({ length: VENTURE_CARDS_LIST.length }, (_, i) => i + 1);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, 64);
}

function getLineLength(grid: { cleared: boolean }[], index: number, dRow: number, dCol: number): number {
  const row = Math.floor(index / 8);
  const col = index % 8;
  let count = 1; // counts the cell itself

  // Go forward
  let r = row + dRow;
  let c = col + dCol;
  while (r >= 0 && r < 8 && c >= 0 && c < 8) {
    const idx = r * 8 + c;
    if (grid[idx]?.cleared) {
      count++;
      r += dRow;
      c += dCol;
    } else {
      break;
    }
  }

  // Go backward
  r = row - dRow;
  c = col - dCol;
  while (r >= 0 && r < 8 && c >= 0 && c < 8) {
    const idx = r * 8 + c;
    if (grid[idx]?.cleared) {
      count++;
      r -= dRow;
      c -= dCol;
    } else {
      break;
    }
  }

  return count;
}

function payoutForLength(len: number): number {
  if (len === 4) return 40;
  if (len === 5) return 50;
  if (len === 6) return 60;
  if (len === 7) return 70;
  if (len >= 8) return 200;
  return 0;
}

export function checkLineCompletions(grid: { cleared: boolean }[], index: number): number {
  const directions = [
    { dRow: 0, dCol: 1 },  // horizontal
    { dRow: 1, dCol: 0 },  // vertical
    { dRow: 1, dCol: 1 },  // diagonal main (\)
    { dRow: 1, dCol: -1 }  // diagonal anti (/)
  ];

  let totalPayout = 0;

  for (const { dRow, dCol } of directions) {
    const len = getLineLength(grid, index, dRow, dCol);
    if (len >= 4) {
      totalPayout += payoutForLength(len);
    }
  }

  return totalPayout;
}

function findNearestNodeOfType(state: GameState, startNodeId: string, type: Node['type']): string | null {
  const queue: string[] = [startNodeId];
  const visited = new Set<string>([startNodeId]);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const node = state.board[curr];
    if (!node) continue;

    if (node.type === type && curr !== startNodeId) return curr;

    for (const neighborId of node.neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push(neighborId);
      }
    }
  }

  return null;
}

function findNearestVacantProperty(state: GameState, startNodeId: string): string | null {
  const queue: string[] = [startNodeId];
  const visited = new Set<string>([startNodeId]);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const node = state.board[curr];
    if (!node) continue;

    // Is it a property and unowned?
    if (node.type === 'property') {
      const prop = Object.values(state.properties).find(p => p.nodeId === curr);
      if (prop && prop.ownerId === null) {
        return curr;
      }
    }

    for (const neighborId of node.neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push(neighborId);
      }
    }
  }

  return null;
}

export function resolveVentureCard(state: GameState, playerId: string, cardIndex: number): GameState {
  const player = state.players[playerId];
  if (!player) throw new Error(`Player ${playerId} not found`);

  if (!state.ventureGridCardIds || !state.ventureGrid) {
    throw new Error(`Venture grid not initialized`);
  }

  const cardNumber = state.ventureGridCardIds[cardIndex];
  if (cardNumber === undefined) throw new Error(`Invalid cardIndex ${cardIndex}`);

  // 1. Mark cleared
  const updatedGrid = [...state.ventureGrid];
  updatedGrid[cardIndex] = { cleared: true, playerId };

  // 2. Check line completions
  const linePayout = checkLineCompletions(updatedGrid, cardIndex);

  // Get template
  const cardListIndex = (cardNumber - 1) % VENTURE_CARDS_LIST.length;
  const cardTemplate = VENTURE_CARDS_LIST[cardListIndex];
  const card: VentureCard = {
    number: cardNumber,
    ...cardTemplate
  };

  // Copy all containers the case handlers below assign into, so in-place
  // writes never leak into the caller's state (deltas diff old vs new).
  let s: GameState = {
    ...state,
    players: { ...state.players },
    districts: { ...state.districts },
    properties: { ...state.properties },
    log: [...state.log],
    ventureGrid: updatedGrid,
    activeVentureCard: card
  };

  // Pay line payout
  if (linePayout > 0) {
    const p = s.players[playerId];
    s.players[playerId] = { ...p, cash: p.cash + linePayout };
    s.log.push(`[VENTURE LINE] ${p.name} completed a line! Received ${linePayout}G bonus.`);
  }

  s.log.push(`[VENTURE CARD] ${player.name} drew Card #${card.number}: ${card.title} - ${card.text}`);
  s = bumpStats(s, playerId, { ventureCardsDrawn: 1 });

  // Apply card effect
  switch (card.effectType) {
    case 'CASH_GAIN': {
      const p = s.players[playerId];
      s.players[playerId] = { ...p, cash: p.cash + card.payout };
      break;
    }

    case 'CASH_LOSS': {
      const p = s.players[playerId];
      const loss = card.payout > 0 ? card.payout : 100;
      s.players[playerId] = { ...p, cash: p.cash - loss };
      s = checkBankruptcy(s, playerId);
      break;
    }

    case 'STOCK_GAIN': {
      let bestDistrictId = Object.keys(s.districts)[0];
      let maxShops = -1;
      for (const [dId, district] of Object.entries(s.districts)) {
        const count = district.propertyIds.filter(pid => s.properties[pid]?.ownerId === playerId).length;
        if (count > maxShops) {
          maxShops = count;
          bestDistrictId = dId;
        }
      }
      const dist = s.districts[bestDistrictId];
      s.districts[bestDistrictId] = {
        ...dist,
        playerHoldings: {
          ...dist.playerHoldings,
          [playerId]: (dist.playerHoldings[playerId] ?? 0) + 5
        }
      };
      s.log.push(`[VENTURE EFFECT] ${player.name} received 5 shares of ${dist.name}.`);
      break;
    }

    case 'STOCK_BUFF': {
      const updatedDistricts = { ...s.districts };
      if (card.targetId && updatedDistricts[card.targetId]) {
        const d = updatedDistricts[card.targetId];
        updatedDistricts[card.targetId] = {
          ...d,
          stockPrice: Math.floor(d.stockPrice * 1.15)
        };
        s.log.push(`[VENTURE EFFECT] Stock price of ${d.name} increased by 15%.`);
      } else {
        for (const [dId, d] of Object.entries(updatedDistricts)) {
          updatedDistricts[dId] = {
            ...d,
            stockPrice: Math.floor(d.stockPrice * 1.10)
          };
        }
        s.log.push(`[VENTURE EFFECT] Stock prices of all districts increased by 10%.`);
      }
      s.districts = updatedDistricts;
      break;
    }

    case 'STOCK_SLUMP': {
      const updatedDistricts = { ...s.districts };
      const slumpId = card.targetId || Object.keys(s.districts)[Math.floor(Math.random() * Object.keys(s.districts).length)];
      const d = updatedDistricts[slumpId];
      if (d) {
        const priceFloor = recalcStockPrice(d, s.properties);
        const slumpPct = card.targetId ? 0.85 : 0.90;
        updatedDistricts[slumpId] = {
          ...d,
          stockPrice: Math.max(priceFloor, Math.floor(d.stockPrice * slumpPct))
        };
        s.log.push(`[VENTURE EFFECT] Stock price of ${d.name} slumped.`);
      }
      s.districts = updatedDistricts;
      break;
    }

    case 'SUIT_GIFT': {
      const p = s.players[playerId];
      const missingSuits = (['heart', 'diamond', 'club', 'spade'] as const).filter(suit => !p.suits[suit]);
      if (missingSuits.length > 0) {
        const suitToGift = missingSuits[0];
        s.players[playerId] = {
          ...p,
          suits: {
            ...p.suits,
            [suitToGift]: true
          }
        };
        s.log.push(`[VENTURE EFFECT] ${p.name} was gifted the missing ${suitToGift} suit.`);
      } else {
        s.log.push(`[VENTURE EFFECT] ${p.name} already holds all suits.`);
      }
      break;
    }

    case 'WARP_BANK': {
      const p = s.players[playerId];
      s.players[playerId] = { ...p, currentNodeId: 'bank', arrivedFromNodeId: undefined };
      s.log.push(`[VENTURE EFFECT] ${p.name} teleported to the Bank!`);
      break;
    }

    case 'WARP_VACANT': {
      const p = s.players[playerId];
      const vacantNodeId = findNearestVacantProperty(s, p.currentNodeId);
      if (vacantNodeId) {
        s.players[playerId] = { ...p, currentNodeId: vacantNodeId, arrivedFromNodeId: undefined };
        s.log.push(`[VENTURE EFFECT] ${p.name} warped to nearest vacant node ${vacantNodeId}!`);
      } else {
        s.log.push(`[VENTURE EFFECT] No vacant properties available to warp to.`);
      }
      break;
    }

    case 'PROP_BUFF': {
      const p = s.players[playerId];
      if (p.propertyIds.length > 0) {
        const propId = p.propertyIds[0];
        const prop = s.properties[propId];
        if (prop) {
          const newBasePrice = Math.floor(prop.basePrice * 1.20);
          const newBaseRent = Math.floor(prop.baseRent * 1.20);
          const updatedProp = {
            ...prop,
            basePrice: newBasePrice,
            baseRent: newBaseRent
          };
          s.properties[propId] = updatedProp;
          const dist = s.districts[prop.districtId];
          s.properties = recalcDistrictMultipliers(dist, s.properties, s.players);
          s.log.push(`[VENTURE EFFECT] ${p.name}'s shop ${propId} got a 20% value & rent boost!`);
        }
      } else {
        s.log.push(`[VENTURE EFFECT] ${p.name} owns no properties to buff.`);
      }
      break;
    }

    case 'SHOP_MULTIPLIER_BONUS': {
      const p = s.players[playerId];
      const perShop = card.payout > 0 ? card.payout : 27;
      const bonus = p.propertyIds.length * perShop;
      s.players[playerId] = { ...p, cash: p.cash + bonus };
      s.log.push(`[VENTURE EFFECT] ${p.name} owns ${p.propertyIds.length} shops and receives a bonus of ${bonus}G!`);
      break;
    }

    case 'SUIT_HEART_OR_CASH': {
      const p = s.players[playerId];
      if (!p.suits.heart) {
        s.players[playerId] = {
          ...p,
          suits: { ...p.suits, heart: true }
        };
        s.log.push(`[VENTURE EFFECT] ${p.name} was gifted a heart suit!`);
      } else {
        s.players[playerId] = { ...p, cash: p.cash + 100 };
        s.log.push(`[VENTURE EFFECT] ${p.name} already has a heart suit. Gained 100G cash instead!`);
      }
      break;
    }

    case 'CASH_PERCENT_LOSS': {
      const p = s.players[playerId];
      const loss = Math.floor(Math.max(0, p.cash) * 0.10);
      s.players[playerId] = { ...p, cash: p.cash - loss };
      
      // Find player with the lowest net worth (excluding bankrupt ones)
      let lastPlayerId: string | null = null;
      let lowestNetWorth = Infinity;
      for (const [pId, otherP] of Object.entries(s.players)) {
        if (otherP.isBankrupt) continue;
        if (otherP.netWorth < lowestNetWorth) {
          lowestNetWorth = otherP.netWorth;
          lastPlayerId = pId;
        }
      }
      
      if (lastPlayerId && lastPlayerId !== playerId && loss > 0) {
        const lastP = s.players[lastPlayerId];
        s.players[lastPlayerId] = { ...lastP, cash: lastP.cash + loss };
        s.log.push(`[VENTURE EFFECT] ${p.name} gave away 10% of their cash (${loss}G) to player in last place (${lastP.name})!`);
      } else {
        s.log.push(`[VENTURE EFFECT] ${p.name} lost 10% of their cash (${loss}G)!`);
      }
      s = checkBankruptcy(s, playerId);
      break;
    }

    case 'STOCK_DIVIDEND_10': {
      const p = s.players[playerId];
      let stockValue = 0;
      for (const district of Object.values(s.districts)) {
        const shares = district.playerHoldings[playerId] ?? 0;
        stockValue += shares * district.stockPrice;
      }
      const dividend = Math.floor(stockValue * 0.10);
      s.players[playerId] = { ...p, cash: p.cash + dividend };
      s.log.push(`[VENTURE EFFECT] ${p.name} received a 10% stock dividend of ${dividend}G!`);
      break;
    }

    case 'STOCK_DIVIDEND_20': {
      const p = s.players[playerId];
      let stockValue = 0;
      for (const district of Object.values(s.districts)) {
        const shares = district.playerHoldings[playerId] ?? 0;
        stockValue += shares * district.stockPrice;
      }
      const dividend = Math.floor(stockValue * 0.20);
      s.players[playerId] = { ...p, cash: p.cash + dividend };
      s.log.push(`[VENTURE EFFECT] ${p.name} received a 20% stock dividend of ${dividend}G!`);
      break;
    }

    case 'ROLL_AGAIN': {
      s.log.push(`[VENTURE EFFECT] ${player.name} gets a free extra turn!`);
      break;
    }

    case 'DICEY_CLOSED': {
      const roll = Math.floor(Math.random() * 6) + 1;
      s.log.push(`[VENTURE EFFECT] ${player.name} rolled a ${roll}!`);
      if (roll % 2 !== 0) {
        // Odd roll: own shops closed
        s.players[playerId] = {
          ...s.players[playerId],
          shopsClosedUntilNextTurn: true
        };
        s.log.push(`[VENTURE EFFECT] Odd roll! ${player.name}'s shops are closed until their next turn.`);
      } else {
        // Even roll: others' shops closed
        for (const pId of Object.keys(s.players)) {
          if (pId !== playerId) {
            s.players[pId] = {
              ...s.players[pId],
              shopsClosedUntilNextTurn: true
            };
            s.log.push(`[VENTURE EFFECT] Even roll! ${s.players[pId].name}'s shops are closed until their next turn.`);
          }
        }
      }
      break;
    }

    case 'HALF_RENT_TEMP': {
      s.players[playerId] = {
        ...s.players[playerId],
        shopPricesHalvedUntilNextTurn: true
      };
      s.log.push(`[VENTURE EFFECT] ${player.name}'s shop rents are halved until their next turn!`);
      break;
    }

    case 'COMMISSION_TEMP': {
      const pct = card.payout > 0 ? card.payout : 50;
      s.players[playerId] = {
        ...s.players[playerId],
        commissionUntilNextTurn: pct
      };
      s.log.push(`[VENTURE EFFECT] ${player.name} gets a ${pct}% commission on all other players' transactions until their next turn!`);
      break;
    }

    case 'CASH_GAIN_PER_LEVEL': {
      const p = s.players[playerId];
      const gain = card.payout * p.level;
      s.players[playerId] = { ...p, cash: p.cash + gain };
      s.log.push(`[VENTURE EFFECT] ${p.name} (level ${p.level}) received ${gain}G!`);
      break;
    }

    case 'CASH_GAIN_PER_SUIT': {
      const p = s.players[playerId];
      const suitCount = (['heart', 'diamond', 'club', 'spade'] as const)
        .filter(suit => p.suits[suit]).length;
      const gain = card.payout * suitCount;
      s.players[playerId] = { ...p, cash: p.cash + gain };
      s.log.push(`[VENTURE EFFECT] ${p.name} holds ${suitCount} suits and received ${gain}G!`);
      break;
    }

    case 'CASH_FROM_EACH_PLAYER': {
      let collected = 0;
      const payers: string[] = [];
      for (const pId of Object.keys(s.players)) {
        if (pId === playerId || s.players[pId].isBankrupt) continue;
        const payer = s.players[pId];
        s.players[pId] = { ...payer, cash: payer.cash - card.payout };
        collected += card.payout;
        payers.push(pId);
      }
      const p = s.players[playerId];
      s.players[playerId] = { ...p, cash: p.cash + collected };
      s.log.push(`[VENTURE EFFECT] Every player paid ${p.name} ${card.payout}G (${collected}G total)!`);
      for (const pId of payers) {
        s = checkBankruptcy(s, pId);
      }
      break;
    }

    case 'CASH_TO_EACH_PLAYER': {
      let paid = 0;
      for (const pId of Object.keys(s.players)) {
        if (pId === playerId || s.players[pId].isBankrupt) continue;
        const receiver = s.players[pId];
        s.players[pId] = { ...receiver, cash: receiver.cash + card.payout };
        paid += card.payout;
      }
      const p = s.players[playerId];
      s.players[playerId] = { ...p, cash: p.cash - paid };
      s.log.push(`[VENTURE EFFECT] ${p.name} paid every player ${card.payout}G (${paid}G total)!`);
      s = checkBankruptcy(s, playerId);
      break;
    }

    case 'STOCK_TAX_10': {
      const p = s.players[playerId];
      let stockValue = 0;
      for (const district of Object.values(s.districts)) {
        const shares = district.playerHoldings[playerId] ?? 0;
        stockValue += shares * district.stockPrice;
      }
      const tax = Math.floor(stockValue * 0.10);
      s.players[playerId] = { ...p, cash: p.cash - tax };
      s.log.push(`[VENTURE EFFECT] ${p.name} paid a capital gains levy of ${tax}G (10% of stock value)!`);
      s = checkBankruptcy(s, playerId);
      break;
    }

    case 'FREE_CAPITAL': {
      const p = s.players[playerId];
      // Best = highest-value owned shop that still has capital headroom
      const candidates = p.propertyIds
        .map(pid => s.properties[pid])
        .filter((prop): prop is Property => !!prop && prop.maxCapital > prop.capitalInvested)
        .sort((a, b) => b.currentPrice - a.currentPrice);
      if (candidates.length === 0) {
        s.log.push(`[VENTURE EFFECT] ${p.name} has no shop with room for free capital.`);
        break;
      }
      const target = candidates[0];
      const amount = Math.min(card.payout > 0 ? card.payout : 100, target.maxCapital - target.capitalInvested);
      s.properties[target.id] = { ...target, capitalInvested: target.capitalInvested + amount };
      const dist = s.districts[target.districtId];
      s.properties = recalcDistrictMultipliers(dist, s.properties, s.players);
      s.districts[target.districtId] = { ...dist, stockPrice: recalcStockPrice(dist, s.properties) };
      s.log.push(`[VENTURE EFFECT] ${p.name}'s shop ${target.id} received ${amount}G of free capital!`);
      break;
    }

    case 'ALL_SHOPS_PRICE_UP': {
      const p = s.players[playerId];
      const shopIds = p.propertyIds.filter(pid => {
        const prop = s.properties[pid];
        return prop && prop.buildingType === undefined;
      });
      if (shopIds.length === 0) {
        s.log.push(`[VENTURE EFFECT] ${p.name} owns no shops to boost.`);
        break;
      }
      const affectedDistricts = new Set<string>();
      for (const pid of shopIds) {
        const prop = s.properties[pid];
        s.properties[pid] = {
          ...prop,
          basePrice: Math.floor(prop.basePrice * 1.10),
          baseRent: Math.floor(prop.baseRent * 1.10),
        };
        affectedDistricts.add(prop.districtId);
      }
      for (const dId of affectedDistricts) {
        const dist = s.districts[dId];
        s.properties = recalcDistrictMultipliers(dist, s.properties, s.players);
        s.districts[dId] = { ...dist, stockPrice: recalcStockPrice(dist, s.properties) };
      }
      s.log.push(`[VENTURE EFFECT] All ${shopIds.length} of ${p.name}'s shops boosted base value & rent by 10%!`);
      break;
    }

    case 'WARP_BROKER': {
      const p = s.players[playerId];
      const brokerNodeId = findNearestNodeOfType(s, p.currentNodeId, 'stockbroker');
      if (brokerNodeId) {
        s.players[playerId] = { ...p, currentNodeId: brokerNodeId, arrivedFromNodeId: undefined };
        s.log.push(`[VENTURE EFFECT] ${p.name} was carried to the stockbroker at ${brokerNodeId}!`);
      } else {
        s.log.push(`[VENTURE EFFECT] No stockbroker on this board — the carriage goes nowhere.`);
      }
      break;
    }

    case 'DOUBLE_RENT_TEMP': {
      s.players[playerId] = {
        ...s.players[playerId],
        shopRentsDoubledUntilNextTurn: true
      };
      s.log.push(`[VENTURE EFFECT] ${player.name}'s shop rents are doubled until their next turn!`);
      break;
    }
    case 'SUIT_YOURSELF_GAIN': {
      const p = s.players[playerId];
      const held = p.suitYourself ?? 0;
      if (held >= 9) {
        s.players[playerId] = { ...p, cash: p.cash + 100 };
        s.log.push(`[VENTURE EFFECT] ${p.name} already holds 9 Suit Yourself cards — 100G instead!`);
      } else {
        s.players[playerId] = { ...p, suitYourself: held + 1 };
        s.log.push(`[VENTURE EFFECT] ${p.name} takes a Suit Yourself card! (${held + 1}/9)`);
      }
      break;
    }

    case 'SUIT_YOURSELF_ALL': {
      for (const pid of s.turnOrder) {
        const p = s.players[pid];
        if (p.isBankrupt) continue;
        const held = p.suitYourself ?? 0;
        if (held >= 9) continue;
        s.players[pid] = { ...p, suitYourself: held + 1 };
      }
      s.log.push(`[VENTURE EFFECT] Every player takes a Suit Yourself card!`);
      break;
    }

    case 'SUIT_YOURSELF_BUY': {
      const p = s.players[playerId];
      const held = p.suitYourself ?? 0;
      const price = card.payout > 0 ? card.payout : 100;
      if (held >= 9) {
        s.log.push(`[VENTURE EFFECT] ${p.name} already holds 9 Suit Yourself cards — no sale.`);
      } else if (p.cash < price) {
        s.log.push(`[VENTURE EFFECT] ${p.name} can't afford the ${price}G Suit Yourself card.`);
      } else {
        s.players[playerId] = { ...p, cash: p.cash - price, suitYourself: held + 1 };
        s.log.push(`[VENTURE EFFECT] ${p.name} buys a Suit Yourself card for ${price}G! (${held + 1}/9)`);
      }
      break;
    }

    case 'SUIT_YOURSELF_ROLL': {
      const p = s.players[playerId];
      const roll = Math.floor(Math.random() * 6) + 1;
      const gain = Math.floor(roll / 2);
      const next = Math.min(9, (p.suitYourself ?? 0) + gain);
      s.players[playerId] = { ...p, suitYourself: next };
      s.log.push(`[VENTURE EFFECT] ${p.name} rolled a ${roll} and gains ${gain} Suit Yourself card${gain === 1 ? '' : 's'}!`);
      break;
    }

    case 'STOCK_TAX_PER_SHARE': {
      const p = s.players[playerId];
      const shares = Object.values(s.districts).reduce((sum, d) => sum + (d.playerHoldings[playerId] ?? 0), 0);
      const tax = shares * (card.payout > 0 ? card.payout : 2);
      s.players[playerId] = { ...p, cash: p.cash - tax };
      s.log.push(`[VENTURE EFFECT] ${p.name} pays an assets tax of ${tax}G (${shares} shares)!`);
      if (tax > 0) s = checkBankruptcy(s, playerId);
      break;
    }

    case 'SWAP_OTHERS': {
      const others = s.turnOrder.filter(pid => pid !== playerId && !s.players[pid].isBankrupt);
      if (others.length >= 2) {
        // Rotate the others' positions by one seat
        const positions = others.map(pid => s.players[pid].currentNodeId);
        others.forEach((pid, i) => {
          const from = positions[(i + 1) % positions.length];
          s.players[pid] = { ...s.players[pid], currentNodeId: from, arrivedFromNodeId: undefined };
        });
        s.log.push(`[VENTURE EFFECT] All other players swap places!`);
      } else {
        s.log.push(`[VENTURE EFFECT] Not enough players to swap places.`);
      }
      break;
    }

    case 'MOVE_RESTRICTION': {
      const steps = card.payout > 0 ? card.payout : 1;
      for (const pid of s.turnOrder) {
        if (pid === playerId || s.players[pid].isBankrupt) continue;
        s.players[pid] = { ...s.players[pid], forcedRoll: steps };
      }
      s.log.push(`[VENTURE EFFECT] All other players can only move ${steps} on their next turn!`);
      break;
    }

    case 'HALF_SALARY': {
      const p = s.players[playerId];
      const shopValue = p.propertyIds.reduce((sum, pid) => sum + (s.properties[pid]?.currentPrice ?? 0), 0);
      const half = Math.floor((BASE_SALARY + Math.floor(shopValue * 0.10) + (p.level * PROMO_BONUS_PER_LEVEL)) / 2);
      s.players[playerId] = { ...p, cash: p.cash + half };
      s.log.push(`[VENTURE EFFECT] ${p.name} receives half a salary: ${half}G!`);
      break;
    }

    case 'SUDDEN_PROMOTION': {
      const p = s.players[playerId];
      const shopValue = p.propertyIds.reduce((sum, pid) => sum + (s.properties[pid]?.currentPrice ?? 0), 0);
      const salary = BASE_SALARY + Math.floor(shopValue * 0.10) + (p.level * PROMO_BONUS_PER_LEVEL);
      s.players[playerId] = {
        ...p,
        cash: p.cash + salary,
        level: p.level + 1,
        suits: { heart: false, diamond: false, club: false, spade: false },
      };
      s.log.push(`[SALARY] ${p.name} gets a sudden promotion and receives ${salary}G! (Suits reset.)`);
      break;
    }
  }

  // Shuffle grid if all 64 cleared
  if (updatedGrid.every(cell => cell.cleared)) {
    s.log.push(`[VENTURE] All grid cards cleared! Re-seeding and shuffling grid.`);
    s.ventureGrid = Array.from({ length: 64 }, () => ({ cleared: false, playerId: null }));
    s.ventureGridCardIds = seedVentureGridCardIds();
  }

  return recalcAllNetWorths(s);
}

export function buildPlot(
  state: GameState,
  playerId: string,
  propertyId: string,
  buildingType: BuildingType,
): GameState {
  const player = state.players[playerId];
  const prop = state.properties[propertyId];
  if (!player) throw new Error(`Player ${playerId} not found`);
  if (!prop) throw new Error(`Property ${propertyId} not found`);
  if (prop.ownerId !== null) throw new Error(`Plot ${propertyId} is already owned`);

  const buildCost = buildingType === 'three_star_shop' ? 1000 : 200;
  if (player.cash < buildCost) {
    throw new Error(`Cannot afford to build ${buildingType} (need ${buildCost}g)`);
  }

  let baseRent = 0;
  let currentRent = 0;
  let checkpointToll = undefined;
  let circusLevel = undefined;

  if (buildingType === 'three_star_shop') {
    baseRent = 80;
    currentRent = 80;
  } else if (buildingType === 'checkpoint') {
    checkpointToll = 50;
    currentRent = 200;
  } else if (buildingType === 'circus') {
    circusLevel = 0;
    currentRent = 100;
  } else if (buildingType === 'balloonport') {
    currentRent = 200;
  }

  const updatedProp: Property = {
    ...prop,
    ownerId: playerId,
    buildingType,
    basePrice: buildCost,
    currentPrice: buildCost,
    baseRent,
    currentRent,
    capitalInvested: 0,
    maxCapital: buildingType === 'three_star_shop' ? 2000 : 0,
    checkpointToll,
    circusLevel,
  };

  const updatedProps = { ...state.properties, [propertyId]: updatedProp };
  const district = state.districts[prop.districtId];

  const updatedProps2 = recalcDistrictMultipliers(district, updatedProps, state.players);
  const newStockPrice = recalcStockPrice(district, updatedProps2);

  const s1: GameState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        cash: player.cash - buildCost,
        propertyIds: [...player.propertyIds, propertyId],
      },
    },
    properties: updatedProps2,
    districts: {
      ...state.districts,
      [prop.districtId]: {
        ...district,
        stockPrice: newStockPrice,
      },
    },
    log: [...state.log, `${player.name} built a ${buildingType} on plot ${propertyId} for ${buildCost}G!`],
  };

  return recalcAllNetWorths(bumpStats(s1, playerId, { propertiesBought: 1 }));
}

export function renovatePlot(
  state: GameState,
  playerId: string,
  propertyId: string,
  buildingType: BuildingType,
): GameState {
  const player = state.players[playerId];
  const prop = state.properties[propertyId];
  if (!player) throw new Error(`Player ${playerId} not found`);
  if (!prop) throw new Error(`Property ${propertyId} not found`);
  if (prop.ownerId !== playerId) throw new Error(`Player does not own plot ${propertyId}`);

  const buildCost = buildingType === 'three_star_shop' ? 1000 : 200;
  const renovateCost = buildCost + 150;
  if (player.cash < renovateCost) {
    throw new Error(`Cannot afford renovation surcharge of ${renovateCost}g`);
  }

  let baseRent = 0;
  let currentRent = 0;
  let checkpointToll = undefined;
  let circusLevel = undefined;

  if (buildingType === 'three_star_shop') {
    baseRent = 80;
    currentRent = 80;
  } else if (buildingType === 'checkpoint') {
    checkpointToll = 50;
    currentRent = 200;
  } else if (buildingType === 'circus') {
    circusLevel = 0;
    currentRent = 100;
  } else if (buildingType === 'balloonport') {
    currentRent = 200;
  }

  const updatedProp: Property = {
    ...prop,
    buildingType,
    basePrice: buildCost,
    currentPrice: buildCost,
    baseRent,
    currentRent,
    capitalInvested: 0,
    maxCapital: buildingType === 'three_star_shop' ? 2000 : 0,
    checkpointToll,
    circusLevel,
  };

  const updatedProps = { ...state.properties, [propertyId]: updatedProp };
  const district = state.districts[prop.districtId];

  const updatedProps2 = recalcDistrictMultipliers(district, updatedProps, state.players);
  const newStockPrice = recalcStockPrice(district, updatedProps2);

  const s1: GameState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        cash: player.cash - renovateCost,
      },
    },
    properties: updatedProps2,
    districts: {
      ...state.districts,
      [prop.districtId]: {
        ...district,
        stockPrice: newStockPrice,
      },
    },
    log: [...state.log, `${player.name} renovated plot ${propertyId} to a ${buildingType} for ${renovateCost}G!`],
  };

  return recalcAllNetWorths(s1);
}

