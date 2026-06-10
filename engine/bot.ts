import { CHARACTERS, DEFAULT_PERSONALITY, type BotPersonality } from '../shared/characters.js';
import type { GameState, Action } from '../shared/types.js';

// Purchase price tracking for sell-on-drop logic (rule 1).
// Key: `${playerId}:${districtId}`, value: stockPrice at time of last purchase.
const purchasePrices = new Map<string, number>();

function bfsDistTo(
  state: GameState,
  fromNodeId: string,
  match: (nodeId: string) => boolean,
): number {
  const queue: Array<{ nodeId: string; dist: number }> = [{ nodeId: fromNodeId, dist: 0 }];
  const visited = new Set<string>([fromNodeId]);

  while (queue.length > 0) {
    const { nodeId, dist } = queue.shift()!;
    const node = state.board[nodeId];
    if (!node) continue;

    if (match(nodeId)) return dist;

    for (const neighborId of node.neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        const neighbor = state.board[neighborId];
        if (neighbor?.type === 'warp' && neighbor.pairedNodeId && !visited.has(neighbor.pairedNodeId)) {
          visited.add(neighbor.pairedNodeId);
          queue.push({ nodeId: neighbor.pairedNodeId, dist: dist + 1 });
        } else {
          queue.push({ nodeId: neighborId, dist: dist + 1 });
        }
      }
    }
  }
  return Infinity;
}

function nearestUnownedShopDist(state: GameState, fromNodeId: string): number {
  return bfsDistTo(state, fromNodeId, nodeId => {
    if (state.board[nodeId]?.type !== 'property') return false;
    const prop = Object.values(state.properties).find(p => p.nodeId === nodeId);
    return !!prop && prop.ownerId === null;
  });
}

function nearestBankDist(state: GameState, fromNodeId: string): number {
  return bfsDistTo(state, fromNodeId, nodeId => state.board[nodeId]?.type === 'bank');
}

function nearestStockVenueDist(state: GameState, fromNodeId: string): number {
  return bfsDistTo(state, fromNodeId, nodeId => {
    const t = state.board[nodeId]?.type;
    return t === 'stockbroker' || t === 'bank';
  });
}

function personalityOf(state: GameState, playerId: string): BotPersonality {
  const charId = state.players[playerId]?.characterId;
  return (charId && CHARACTERS[charId]?.personality) || DEFAULT_PERSONALITY;
}

// Buy a personality-sized batch in the district where the bot owns the most shops.
function pickStockBuy(state: GameState, botPlayerId: string, personality: BotPersonality): Action | null {
  const player = state.players[botPlayerId];
  if (player.cash <= personality.cashReserve) return null;

  let bestDistrictId: string | null = null;
  let bestCount = 0;
  for (const [districtId, district] of Object.entries(state.districts)) {
    const count = district.propertyIds.filter(
      pid => state.properties[pid]?.ownerId === botPlayerId,
    ).length;
    if (count > bestCount) { bestCount = count; bestDistrictId = districtId; }
  }
  if (!bestDistrictId) return null;

  const district = state.districts[bestDistrictId];
  if (district.stockPrice <= 0) return null;

  // One aggregated transaction: spend down to the cash reserve in a single
  // buy (engine caps 99/transaction). stockBatch is the minimum position
  // worth opening — drip-buying batch by batch spammed the feed and dodged
  // the 10+ share price-impact rule.
  const shares = Math.min(99, Math.floor((player.cash - personality.cashReserve) / district.stockPrice));
  if (shares < personality.stockBatch) return null;

  purchasePrices.set(`${botPlayerId}:${bestDistrictId}`, district.stockPrice);
  return { type: 'BUY_STOCK', districtId: bestDistrictId, shares };
}

export function greedyBotAction(state: GameState, botPlayerId: string): Action {
  const player = state.players[botPlayerId];
  const phase = state.currentPhase;
  const personality = personalityOf(state, botPlayerId);

  // 1 & 2 — PRE_ROLL
  if (phase === 'PRE_ROLL') {
    if (personality.sellOnDip) {
      for (const [districtId, district] of Object.entries(state.districts)) {
        const held = district.playerHoldings[botPlayerId] ?? 0;
        const pricePaid = purchasePrices.get(`${botPlayerId}:${districtId}`);
        if (held > 0 && pricePaid !== undefined && district.stockPrice < pricePaid) {
          return { type: 'SELL_STOCK', districtId, shares: held };
        }
      }
    }
    return { type: 'ROLL_DICE' };
  }

  // DEBT_SETTLEMENT — sell stock to cover the deficit (largest holding first),
  // then distress-sell shops; confirm with END_TURN once covered.
  if (phase === 'DEBT_SETTLEMENT') {
    const deficit = -player.cash;
    if (deficit <= 0) return { type: 'END_TURN' };

    let bestDistrictId: string | null = null;
    let bestValue = 0;
    for (const [districtId, district] of Object.entries(state.districts)) {
      const held = district.playerHoldings[botPlayerId] ?? 0;
      const value = held * district.stockPrice;
      if (value > bestValue) { bestValue = value; bestDistrictId = districtId; }
    }
    if (bestDistrictId) {
      const district = state.districts[bestDistrictId];
      const held = district.playerHoldings[botPlayerId] ?? 0;
      const needed = Math.ceil(deficit / district.stockPrice);
      return { type: 'SELL_STOCK', districtId: bestDistrictId, shares: Math.min(held, needed) };
    }
    if (player.propertyIds.length > 0) {
      return { type: 'SELL_PROPERTY', propertyId: player.propertyIds[0] };
    }
    return { type: 'END_TURN' };
  }

  // 3 — CHOOSING_PATH: head to bank if all suits held, otherwise nearest unowned shop
  if (phase === 'CHOOSING_PATH') {
    const destinations = state.pendingDestinations ?? [];
    const { suits } = player;
    const allSuits = suits.heart && suits.diamond && suits.club && suits.spade;
    const preferredFn =
      personality.pathPreference === 'bank' ? nearestBankDist :
      personality.pathPreference === 'stocks' ? nearestStockVenueDist :
      nearestUnownedShopDist;
    const distFn = allSuits ? nearestBankDist : preferredFn;
    let bestDest = destinations[0];
    let bestDist = distFn(state, bestDest);
    for (let i = 1; i < destinations.length; i++) {
      const d = distFn(state, destinations[i]);
      if (d < bestDist) { bestDist = d; bestDest = destinations[i]; }
    }
    return { type: 'CHOOSE_PATH', nodeId: bestDest };
  }

  // 4–9 — SPACE_ACTION
  if (phase === 'SPACE_ACTION') {
    if (state.activeVentureCard) {
      return { type: 'END_TURN' };
    }

    // Post-bank stock window: only BUY_STOCK or END_TURN are legal.
    if (state.passedBankWindowUsed) {
      return pickStockBuy(state, botPlayerId, personality) ?? { type: 'END_TURN' };
    }

    const node = state.board[player.currentNodeId];

    if (node?.type === 'venture' || node?.type === 'suit') {
      const grid = state.ventureGrid ?? Array.from({ length: 64 }, () => ({ cleared: false, playerId: null }));
      let bestIndex = -1;
      let highestScore = -1;
      for (let i = 0; i < 64; i++) {
        if (grid[i]?.cleared) continue;

        const row = Math.floor(i / 8);
        const col = i % 8;
        let score = 0;

        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const r = row + dr;
            const c = col + dc;
            if (r >= 0 && r < 8 && c >= 0 && c < 8) {
              const neighborIdx = r * 8 + c;
              if (grid[neighborIdx]?.cleared) {
                score++;
              }
            }
          }
        }

        if (score > highestScore) {
          highestScore = score;
          bestIndex = i;
        }
      }

      if (bestIndex === -1) {
        bestIndex = grid.findIndex(cell => !cell.cleared);
      }

      return { type: 'CHOOSE_VENTURE_CARD', cardIndex: bestIndex };
    }
    if (node.type === 'vacant') {
      const prop = Object.values(state.properties).find(p => p.nodeId === node.id);
      if (prop) {
        if (prop.ownerId === null) {
          if (personality.preferThreeStar && player.cash >= 1000) {
            return { type: 'BUILD_PLOT', propertyId: prop.id, buildingType: 'three_star_shop' };
          } else if (player.cash >= 200 + personality.cashReserve) {
            return { type: 'BUILD_PLOT', propertyId: prop.id, buildingType: 'checkpoint' };
          }
          return { type: 'END_TURN' };
        }

        if (prop.ownerId === botPlayerId) {
          if (prop.buildingType === 'circus') {
            const lvl = prop.circusLevel ?? 0;
            if (lvl < 3) {
              const upgradeCosts = [400, 500, 1000];
              const cost = upgradeCosts[lvl];
              if (player.cash >= cost) {
                return { type: 'INVEST', propertyId: prop.id, amount: cost };
              }
            }
          }

          if (prop.buildingType === 'checkpoint' || prop.buildingType === 'three_star_shop') {
            const myShops = Object.values(state.properties).filter(
              p => p.ownerId === botPlayerId && p.maxCapital > p.capitalInvested
            );
            if (myShops.length > 0 && player.cash > personality.cashReserve) {
              const target = myShops[0];
              const amount = Math.min(personality.investAmount, target.maxCapital - target.capitalInvested, player.cash);
              return { type: 'INVEST', propertyId: target.id, amount };
            }
          }

          if (prop.buildingType === 'balloonport') {
            return { type: 'TELEPORT', nodeId: 'bank' };
          }

          if (prop.buildingType === 'estate_agency') {
            const unowned = Object.values(state.properties).filter(
              p => p.ownerId === null && (p.buildingType === undefined || p.buildingType === 'vacant')
            );
            const affordable = unowned.filter(p => player.cash >= p.currentPrice);
            if (affordable.length > 0) {
              return { type: 'BUY_PROPERTY', propertyId: affordable[0].id };
            }
          }

          return { type: 'END_TURN' };
        } else {
          const buyoutCost = prop.currentPrice * 5;
          if (player.cash >= buyoutCost && prop.buildingType !== 'estate_agency' && prop.buildingType !== 'vacant') {
            if (player.cash >= buyoutCost * personality.buyoutCashMultiplier) {
              return { type: 'BUYOUT_PROPERTY', propertyId: prop.id };
            }
          }
          return { type: 'PAY_RENT', propertyId: prop.id };
        }
      }
    }

    // 4. Unowned shop, can afford
    if (node.type === 'property') {
      const prop = Object.values(state.properties).find(p => p.nodeId === node.id);
      if (prop) {
        if (prop.ownerId === null && player.cash >= prop.currentPrice) {
          return { type: 'BUY_PROPERTY', propertyId: prop.id };
        }
        // 5. Own shop, cash above reserve, room to invest
        if (prop.ownerId === botPlayerId && player.cash > personality.cashReserve && prop.capitalInvested < prop.maxCapital) {
          const amount = Math.min(personality.investAmount, prop.maxCapital - prop.capitalInvested, player.cash);
          return { type: 'INVEST', propertyId: prop.id, amount };
        }
        // 6. Opponent shop — consider buyout before paying rent
        if (prop.ownerId !== null && prop.ownerId !== botPlayerId) {
          const buyoutCost = prop.currentPrice * 5;
          if (player.cash >= buyoutCost) {
            const district = state.districts[prop.districtId];
            const siblingProps = district.propertyIds.map(pid => state.properties[pid]).filter(Boolean);

            const botOwnedOthers = siblingProps.filter(p => p.id !== prop.id && p.ownerId === botPlayerId).length;
            const completesDomination = botOwnedOthers === siblingProps.length - 1 && siblingProps.length > 1;

            const opponentId = prop.ownerId;
            const opponentOwnedOthers = siblingProps.filter(p => p.id !== prop.id && p.ownerId === opponentId).length;
            const breaksMonopoly = opponentOwnedOthers === siblingProps.length - 1 && siblingProps.length > 1;

            const hasMassiveCash = player.cash >= buyoutCost * personality.buyoutCashMultiplier;

            if (completesDomination || breaksMonopoly || hasMassiveCash) {
              return { type: 'BUYOUT_PROPERTY', propertyId: prop.id };
            }
          }
          return { type: 'PAY_RENT', propertyId: prop.id };
        }
      }
    }

    // Casino: one modest flutter when cash is comfortable, then walk away.
    if (node.type === 'casino') {
      if (!state.casinoResult && player.cash > personality.cashReserve + 200) {
        return Math.random() < 0.5
          ? { type: 'CASINO_BET', game: 'derby', wager: 100, choice: String(Math.floor(Math.random() * 4)) }
          : { type: 'CASINO_BET', game: 'highlow', wager: 100, choice: Math.random() < 0.5 ? 'high' : 'low' };
      }
      return { type: 'END_TURN' };
    }

    if (node.type === 'bank' || node.type === 'stockbroker' || state.passedBankThisTurn) {
      // Salary is auto-collected by resolveSpace on bank landing — no explicit action needed here.

      // 7. Cash above reserve → buy stock in district where bot owns most shops
      const stockBuy = pickStockBuy(state, botPlayerId, personality);
      if (stockBuy) return stockBuy;
    }

    // 9. Fallback
    return { type: 'END_TURN' };
  }

  return { type: 'ROLL_DICE' };
}
