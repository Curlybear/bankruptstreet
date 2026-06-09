import type { GameState, District, Property, Player, VentureCard, BuildingType } from '../shared/types.js';


export const BASE_SALARY = 250;
export const PROMO_BONUS_PER_LEVEL = 150;
export const MAX_INVEST_PER_TURN = 999;
export const STOCK_PRICE_CHANGE_THRESHOLD = 10;
export const DISTRESS_SALE_RATE = 0.75;

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

  function multiplierFor(count: number): number {
    if (count > 0 && count >= totalShops) return 5;
    return Math.max(1, count);
  }

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
        rent = circusPrices[lvl];
      } else if (prop.buildingType === 'checkpoint') {
        price = 200;
        rent = prop.checkpointToll ?? 200;
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
    const m = multiplierFor(count);
    updated[pid] = {
      ...prop,
      shopMultiplier: m,
      currentPrice: prop.basePrice * m + prop.capitalInvested,
      maxCapital: prop.basePrice * m * 2,
      currentRent: Math.floor((prop.baseRent + Math.floor(prop.capitalInvested / 10)) * m),
    };
  }
  return updated;
}

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
    log: [...state.log],
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

  return recalcAllNetWorths(s2);
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
    log: [...state.log],
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

  return recalcAllNetWorths(s2);
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
      currentRent: newPrice,
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
  const newRent = Math.floor((prop.baseRent + Math.floor(newCapital / 10)) * prop.shopMultiplier);
  const newPrice = prop.basePrice * prop.shopMultiplier + newCapital;

  const updatedProp = { ...prop, capitalInvested: newCapital, currentPrice: newPrice, currentRent: newRent };
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
      rent = prop.checkpointToll ?? 200;
    }
  }

  const isClosed = !!owner.shopsClosedUntilNextTurn;
  const isHalved = !isClosed && !!owner.shopPricesHalvedUntilNextTurn;

  if (isClosed) {
    rent = 0;
  } else if (isHalved) {
    rent = Math.floor(rent / 2);
  }

  const totalShares = Object.values(district.playerHoldings).reduce((s, n) => s + n, 0);
  const updatedPlayers = { ...state.players };

  if (rent > 0) {
    // Payer pays rent; owner receives rent
    updatedPlayers[payerId] = { ...payer, cash: payer.cash - rent };
    updatedPlayers[prop.ownerId] = { ...owner, cash: owner.cash + rent };

    // Bank separately pays commission to each shareholder (does NOT reduce rent paid)
    if (totalShares > 0) {
      for (const [pid, shares] of Object.entries(district.playerHoldings)) {
        if (shares <= 0) continue;
        const commission = Math.floor(rent * 0.10 * (shares / totalShares));
        if (commission > 0) {
          const p = updatedPlayers[pid];
          updatedPlayers[pid] = { ...p, cash: p.cash + commission };
        }
      }
    }
  }

  const s1: GameState = { ...state, players: updatedPlayers, log: [...state.log] };

  if (isClosed) {
    s1.log.push(`[RENT] ${owner.name}'s shop at ${propertyId} is temporarily closed! Rent of ${prop.currentRent}g is waived.`);
  } else if (isHalved) {
    s1.log.push(`[RENT] ${payer.name} paid halved rent of ${rent}g (originally ${prop.currentRent}g) to ${owner.name}.`);
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

  const s2 = checkBankruptcy(s1, payerId);
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
    log: [...state.log],
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

  return recalcAllNetWorths(s1);
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
  };

  return recalcAllNetWorths(s1);
}

// requireBankNode=false is used for pass-through salary: the player walked past
// the bank mid-move and now stands on a different node.
export function collectSalary(state: GameState, playerId: string, requireBankNode = true): GameState {
  const player = state.players[playerId];
  if (!player) throw new Error(`Player ${playerId} not found`);

  if (requireBankNode) {
    const node = state.board[player.currentNodeId];
    if (!node || node.type !== 'bank') throw new Error(`Player must be at a bank node`);
  }

  const { suits } = player;
  if (!suits.heart || !suits.diamond || !suits.club || !suits.spade) {
    throw new Error(`Player must hold all 4 suits to collect salary`);
  }

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
      },
    },
    log: [...state.log, `[SALARY] ${player.name} collected ${salary}g (level ${newLevel})`],
  };

  return recalcAllNetWorths(s1);
}

export function checkWinCondition(state: GameState, playerId: string): GameState {
  if (state.winnerId) return state;
  const player = state.players[playerId];
  if (!player) return state;
  if (player.netWorth < state.targetNetWorth) return state;
  const node = state.board[player.currentNodeId];
  if (!node || node.type !== 'bank') return state;
  return { ...state, winnerId: playerId };
}

export function checkBankruptcy(state: GameState, playerId: string): GameState {
  if (state.players[playerId].cash >= 0) return state;

  let s = state;

  // Phase 1: liquidate stock holdings, cheapest-last isn't specified so iterate in order
  for (const districtId of Object.keys(s.districts)) {
    if (s.players[playerId].cash >= 0) break;
    const shares = s.districts[districtId].playerHoldings[playerId] ?? 0;
    if (shares <= 0) continue;
    s = sellStock(s, playerId, districtId, shares);
  }

  // Phase 2: sell shops at 75% distress rate
  const propsToSell = [...s.players[playerId].propertyIds];
  for (const pid of propsToSell) {
    if (s.players[playerId].cash >= 0) break;
    const prop = s.properties[pid];
    if (!prop) continue;

    const proceeds = Math.floor(prop.currentPrice * DISTRESS_SALE_RATE);
    const currPlayer = s.players[playerId];
    const district = s.districts[prop.districtId];

    const s1: GameState = {
      ...s,
      players: {
        ...s.players,
        [playerId]: {
          ...currPlayer,
          cash: currPlayer.cash + proceeds,
          propertyIds: currPlayer.propertyIds.filter(id => id !== pid),
        },
      },
      properties: { ...s.properties, [pid]: { ...prop, ownerId: null } },
    };

    const updatedProps = recalcDistrictMultipliers(district, s1.properties, s1.players);
    const newStockPrice = recalcStockPrice(district, updatedProps);
    s = recalcAllNetWorths({
      ...s1,
      properties: updatedProps,
      districts: {
        ...s1.districts,
        [prop.districtId]: { ...district, stockPrice: newStockPrice },
      },
    });
  }

  // Mark bankrupt if net worth still negative after full liquidation
  const finalPlayer = s.players[playerId];
  if (finalPlayer.netWorth < 0) {
    s = {
      ...s,
      players: { ...s.players, [playerId]: { ...finalPlayer, isBankrupt: true } },
      bankruptCount: s.bankruptCount + 1,
    };
    // Bankruptcy ends the match immediately. Find non-bankrupt player with highest net worth.
    let bestPlayerId: string | null = null;
    let bestNetWorth = -Infinity;
    for (const [pId, p] of Object.entries(s.players)) {
      if (p.isBankrupt) continue;
      if (p.netWorth > bestNetWorth) {
        bestNetWorth = p.netWorth;
        bestPlayerId = pId;
      } else if (p.netWorth === bestNetWorth && bestPlayerId !== null) {
        // Tiebreaker: player who is later in the turnOrder list wins
        const idxCurrent = s.turnOrder.indexOf(pId);
        const idxBest = s.turnOrder.indexOf(bestPlayerId);
        if (idxCurrent > idxBest) {
          bestPlayerId = pId;
        }
      }
    }
    s.winnerId = bestPlayerId;
  }

  return s;
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
    payout: 0,
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
    payout: 0,
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
    payout: 0,
    effectType: 'COMMISSION_TEMP'
  }
];

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

  // Apply card effect
  switch (card.effectType) {
    case 'CASH_GAIN': {
      const p = s.players[playerId];
      s.players[playerId] = { ...p, cash: p.cash + card.payout };
      break;
    }

    case 'CASH_LOSS': {
      const p = s.players[playerId];
      const loss = card.title === 'Income Tax' ? 100 : 150;
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
      s.players[playerId] = { ...p, currentNodeId: 'bank' };
      s.log.push(`[VENTURE EFFECT] ${p.name} teleported to the Bank!`);
      break;
    }

    case 'WARP_VACANT': {
      const p = s.players[playerId];
      const vacantNodeId = findNearestVacantProperty(s, p.currentNodeId);
      if (vacantNodeId) {
        s.players[playerId] = { ...p, currentNodeId: vacantNodeId };
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
      const bonus = p.propertyIds.length * 27;
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
      s.players[playerId] = {
        ...s.players[playerId],
        commissionUntilNextTurn: 50
      };
      s.log.push(`[VENTURE EFFECT] ${player.name} gets a 50% commission on all other players' transactions until their next turn!`);
      break;
    }
  }

  // Shuffle grid if all 64 cleared
  if (updatedGrid.every(cell => cell.cleared)) {
    s.log.push(`[VENTURE] All grid cards cleared! Re-seeding and shuffling grid.`);
    s.ventureGrid = Array.from({ length: 64 }, () => ({ cleared: false, playerId: null }));
    s.ventureGridCardIds = Array.from({ length: 64 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
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
    checkpointToll = 200;
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

  return recalcAllNetWorths(s1);
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
    checkpointToll = 200;
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

