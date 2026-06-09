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

// Buy 10 shares in the district where the bot owns the most shops, if affordable.
function pickStockBuy(state: GameState, botPlayerId: string): Action | null {
  const player = state.players[botPlayerId];
  if (player.cash <= 200) return null;

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
  const cost = 10 * district.stockPrice;
  if (district.stockPrice > 0 && player.cash >= cost) {
    purchasePrices.set(`${botPlayerId}:${bestDistrictId}`, district.stockPrice);
    return { type: 'BUY_STOCK', districtId: bestDistrictId, shares: 10 };
  }
  return null;
}

export function greedyBotAction(state: GameState, botPlayerId: string): Action {
  const player = state.players[botPlayerId];
  const phase = state.currentPhase;

  // 1 & 2 — PRE_ROLL
  if (phase === 'PRE_ROLL') {
    for (const [districtId, district] of Object.entries(state.districts)) {
      const held = district.playerHoldings[botPlayerId] ?? 0;
      const pricePaid = purchasePrices.get(`${botPlayerId}:${districtId}`);
      if (held > 0 && pricePaid !== undefined && district.stockPrice < pricePaid) {
        return { type: 'SELL_STOCK', districtId, shares: held };
      }
    }
    return { type: 'ROLL_DICE' };
  }

  // 3 — CHOOSING_PATH: head to bank if all suits held, otherwise nearest unowned shop
  if (phase === 'CHOOSING_PATH') {
    const destinations = state.pendingDestinations ?? [];
    const { suits } = player;
    const distFn = (suits.heart && suits.diamond && suits.club && suits.spade)
      ? nearestBankDist
      : nearestUnownedShopDist;
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
      return pickStockBuy(state, botPlayerId) ?? { type: 'END_TURN' };
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
          if (player.cash >= 1000) {
            return { type: 'BUILD_PLOT', propertyId: prop.id, buildingType: 'three_star_shop' };
          } else if (player.cash >= 200) {
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
            if (myShops.length > 0 && player.cash > 200) {
              const target = myShops[0];
              const amount = Math.min(100, target.maxCapital - target.capitalInvested);
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
            if (player.cash >= buyoutCost * 2.5) {
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
        // 5. Own shop, cash > 200, room to invest
        if (prop.ownerId === botPlayerId && player.cash > 200 && prop.capitalInvested < prop.maxCapital) {
          const amount = Math.min(100, prop.maxCapital - prop.capitalInvested);
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

            const hasMassiveCash = player.cash >= buyoutCost * 2.5;

            if (completesDomination || breaksMonopoly || hasMassiveCash) {
              return { type: 'BUYOUT_PROPERTY', propertyId: prop.id };
            }
          }
          return { type: 'PAY_RENT', propertyId: prop.id };
        }
      }
    }

    if (node.type === 'bank' || node.type === 'stockbroker' || state.passedBankThisTurn) {
      // Salary is auto-collected by resolveSpace on bank landing — no explicit action needed here.

      // 7. Cash > 200 → buy stock in district where bot owns most shops
      const stockBuy = pickStockBuy(state, botPlayerId);
      if (stockBuy) return stockBuy;
    }

    // 9. Fallback
    return { type: 'END_TURN' };
  }

  return { type: 'ROLL_DICE' };
}
