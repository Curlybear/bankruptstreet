import { findPaths, getPath } from './navigation.js';
import {
  buyProperty, invest, payRent, buyStock, sellStock, collectSalary, checkWinCondition,
  buyoutProperty, resolveVentureCard, resolveVentureChoice, buildPlot, renovatePlot, checkBankruptcy,
  distressSellProperty, playCasino, playArcade, applyArcadeGive, recalcAllNetWorths, bumpStats, richestAlive, canPromote,
  openAuction, applyAuctionBid, applyAuctionPass,
} from './economy.js';
import type { GameState, Action, Node } from '../shared/types.js';

function currentPlayer(state: GameState) {
  return state.players[state.currentPlayerId];
}

function currentNode(state: GameState): Node {
  const player = currentPlayer(state);
  return state.board[player.currentNodeId];
}

function propertyAtNode(state: GameState, nodeId: string) {
  return Object.values(state.properties).find(p => p.nodeId === nodeId) ?? null;
}

function advanceTurn(state: GameState): GameState {
  // A player may not end their turn in debt: they must choose assets to sell
  // (DEBT_SETTLEMENT) until cash >= 0. Asset prices can move between the
  // charge and this moment (other players' trades), so re-check solvency on
  // entry — hopeless debt is bankrupted here, not trapped in the phase.
  const outgoing = state.players[state.currentPlayerId];
  if (outgoing && !outgoing.isBankrupt && outgoing.cash < 0) {
    const checked = checkBankruptcy(state, state.currentPlayerId);
    if (checked.winnerId) return checked;                       // game over
    if (!checked.players[state.currentPlayerId].isBankrupt) {
      return { ...checked, currentPhase: 'DEBT_SETTLEMENT', debtResume: 'ADVANCE_TURN' };
    }
    state = checked;  // eliminated but the game continues — advance past them
  }

  const idx = state.turnOrder.indexOf(state.currentPlayerId);
  // Skip eliminated players. The game ends before everyone is bankrupt, but
  // guard the scan anyway.
  let nextIdx = idx;
  let wrapped = false;
  for (let step = 0; step < state.turnOrder.length; step++) {
    nextIdx = (nextIdx + 1) % state.turnOrder.length;
    if (nextIdx <= idx) wrapped = true;
    if (!state.players[state.turnOrder[nextIdx]]?.isBankrupt) break;
  }
  const nextPlayerId = state.turnOrder[nextIdx];

  const incomingPlayer = state.players[nextPlayerId];
  const updatedPlayer = incomingPlayer ? {
    ...incomingPlayer,
    shopsClosedUntilNextTurn: false,
    shopPricesHalvedUntilNextTurn: false,
    shopRentsDoubledUntilNextTurn: false,
    commissionUntilNextTurn: 0,
  } : undefined;

  const nextRound = wrapped ? state.round + 1 : state.round;
  // The incoming player may owe money from charges made on other players'
  // turns (venture cards). They settle before they can roll.
  const incomingInDebt = !!updatedPlayer && !updatedPlayer.isBankrupt && updatedPlayer.cash < 0;
  const advanced: GameState = {
    ...state,
    currentPlayerId: nextPlayerId,
    currentPhase: 'PRE_ROLL',
    debtResume: undefined,
    round: nextRound,
    pendingDestinations: undefined,
    passedBankThisTurn: false,
    passedBankWindowUsed: false,
    casinoResult: null,
    arcadeResult: null,
    pendingVenture: null,
    // Cap the log so persisted state stays bounded (it grows every action).
    log: [...state.log, `[TURN] Round ${nextRound} — ${incomingPlayer?.name ?? nextPlayerId}'s turn.`].slice(-300),
    players: updatedPlayer ? {
      ...state.players,
      [nextPlayerId]: updatedPlayer,
    } : state.players,
  };

  if (incomingInDebt) {
    const checked = checkBankruptcy(advanced, nextPlayerId);
    if (checked.winnerId) return checked;                       // game over
    if (!checked.players[nextPlayerId].isBankrupt) {
      return { ...checked, currentPhase: 'DEBT_SETTLEMENT', debtResume: 'PRE_ROLL' };
    }
    return advanceTurn(checked);  // eliminated — pass to the next alive seat
  }
  return advanced;
}

// Local getPath function removed; now imported from `./navigation.js`

function collectSuitsAlongPath(state: GameState, playerId: string, path: string[]): GameState {
  let s = state;
  const p = s.players[playerId];
  if (!p) return s;

  const collectedSuits = { ...p.suits };
  const newLogs: string[] = [];
  let suitsChanged = false;

  for (const nodeId of path.slice(1)) {
    const node = s.board[nodeId];
    if (node && node.type === 'suit' && node.suit) {
      if (!collectedSuits[node.suit]) {
        collectedSuits[node.suit] = true;
        newLogs.push(`${p.name} collected ${node.suit} at ${node.id}`);
        suitsChanged = true;
      }
    }
  }

  if (suitsChanged) {
    s = {
      ...s,
      log: [...s.log, ...newLogs],
      players: {
        ...s.players,
        [playerId]: {
          ...p,
          suits: collectedSuits,
        }
      }
    };
  }

  return s;
}

function processPathMovement(state: GameState, playerId: string, path: string[]): GameState {
  let s = state;
  const player = s.players[playerId];
  if (!player) return s;

  const walkedPath = path.slice(1);
  const passedBank = walkedPath.includes('bank');

  // 1. Process suit collections
  s = collectSuitsAlongPath(s, playerId, path);

  // 2. Process Bank pass-through salary
  if (passedBank) {
    s = { ...s, passedBankThisTurn: true };
    s = bumpStats(s, playerId, { lapsCompleted: 1 });
    const p = s.players[playerId];
    if (canPromote(p)) {
      s = collectSalary(s, playerId, false);  // pass-through: player is past the bank
    }
  }

  // 3. Process Checkpoint pass-through tolls
  for (const nodeId of walkedPath) {
    const prop = Object.values(s.properties).find(p => p.nodeId === nodeId);
    if (prop && prop.buildingType === 'checkpoint' && prop.ownerId !== null && prop.ownerId !== playerId) {
      const owner = s.players[prop.ownerId];
      if (owner && !owner.shopsClosedUntilNextTurn) {
        const toll = prop.checkpointToll ?? 50;
        const payer = s.players[playerId];
        s = {
          ...s,
          log: [...s.log, `[CHECKPOINT] ${player.name} passed through ${owner.name}'s Checkpoint at ${nodeId} and paid ${toll}G toll!`],
          players: {
            ...s.players,
            [playerId]: { ...payer, cash: payer.cash - toll },
            [prop.ownerId]: { ...owner, cash: owner.cash + toll },
          },
          properties: {
            ...s.properties,
            // Tolls inflate +10G per pass but cap at 250G — toll growth was
            // the #1 cause of bankruptcies in balance sims.
            [prop.id]: { ...prop, checkpointToll: Math.min(toll + 10, 250), currentRent: Math.min(toll + 10, 250) },
          },
        };

        s = bumpStats(s, playerId, { rentPaid: toll });
        s = bumpStats(s, prop.ownerId, { rentCollected: toll, biggestRentCollected: toll });

        // Check bankruptcy immediately
        s = checkBankruptcy(s, playerId);
        if (s.players[playerId].isBankrupt) break;
      }
    }
  }

  const landedNode = s.board[s.players[playerId].currentNodeId];
  s = { ...s, log: [...s.log, `[LAND] ${s.players[playerId].name} landed on ${landedNode.id} (${landedNode.type}).`] };

  // 4. Passing the bank counts as returning to it — win check (after tolls,
  // so net worth is final for this move).
  if (s.passedBankThisTurn && !s.players[playerId].isBankrupt) {
    s = checkWinCondition(s, playerId, false);
  }

  return s;
}

function advanceSpaceResolution(state: GameState): GameState {
  // Passing the bank grants ONE bonus SPACE_ACTION window (chance to buy stock).
  // Skip it if the player landed on a bank/stockbroker — they already had that chance.
  if (state.passedBankThisTurn && !state.passedBankWindowUsed) {
    const player = currentPlayer(state);
    const node = state.board[player.currentNodeId];
    const alreadyHadStockChance = node.type === 'bank' || node.type === 'stockbroker';
    if (!player.isBankrupt && !alreadyHadStockChance) {
      return { ...state, currentPhase: 'SPACE_ACTION', passedBankWindowUsed: true };
    }
  }
  return advanceTurn(state);
}

// Called after player has been moved to their new node.
// Auto-resolves suit/venture/vacant/bank-salary; puts bank/broker/property into SPACE_ACTION.
function resolveSpace(state: GameState): GameState {
  const player = currentPlayer(state);
  if (player.isBankrupt) return advanceTurn(state);  // eliminated mid-move (tolls)
  const node = state.board[player.currentNodeId];

  if (node.type === 'suit') {
    // Landing on a suit node awards a venture card! Put player in SPACE_ACTION phase.
    return { ...state, currentPhase: 'SPACE_ACTION' };
  }

  if (node.type === 'venture') {
    return { ...state, currentPhase: 'SPACE_ACTION' };
  }

  if (node.type === 'casino') {
    // Player decides at the table: place a bet or walk away.
    return { ...state, currentPhase: 'SPACE_ACTION' };
  }

  if (node.type === 'break') {
    // Take-a-break: your shops shut until your next turn (the authentic rule
    // — landing here is a rest day for your whole empire).
    const s: GameState = {
      ...state,
      players: {
        ...state.players,
        [player.id]: { ...player, shopsClosedUntilNextTurn: true },
      },
      log: [...state.log, `[BREAK] ${player.name} takes a break at ${node.id} — all their shops shut until their next turn!`],
    };
    return advanceSpaceResolution(s);
  }

  if (node.type === 'boon' || node.type === 'boom') {
    // Commission squares: a cut of every payment anyone makes until your
    // next turn — 20% on Boon, 50% on Boom.
    const pct = node.type === 'boom' ? 50 : 20;
    const s: GameState = {
      ...state,
      players: {
        ...state.players,
        [player.id]: { ...player, commissionUntilNextTurn: pct },
      },
      log: [...state.log, `[${node.type.toUpperCase()}] ${player.name} lands on the ${node.type} square — ${pct}% commission on all payments until their next turn!`],
    };
    return advanceSpaceResolution(s);
  }

  if (node.type === 'tax_office') {
    // Native tax square: pay 5% of net worth to the bank, auto-resolve.
    const tax = Math.floor(player.netWorth * 0.05);
    let s: GameState = {
      ...state,
      players: {
        ...state.players,
        [player.id]: { ...player, cash: player.cash - tax },
      },
      log: [...state.log, `[TAX] ${player.name} paid ${tax}G in taxes at ${node.id} (5% of net worth).`],
    };
    s = bumpStats(s, player.id, { taxesPaid: tax });
    s = checkBankruptcy(s, player.id);
    s = recalcAllNetWorths(s);
    return advanceSpaceResolution(s);
  }

  if (node.type === 'vacant') {
    const prop = propertyAtNode(state, node.id);
    if (!prop) {
      return advanceSpaceResolution(state);
    }
    if (prop.ownerId === null) {
      return { ...state, currentPhase: 'SPACE_ACTION' };
    }

    if (prop.ownerId === player.id) {
      if (prop.buildingType === 'tax_office') {
        const bonus = Math.floor(player.netWorth * 0.05);
        const s: GameState = {
          ...state,
          players: {
            ...state.players,
            [player.id]: { ...player, cash: player.cash + bonus },
          },
          log: [...state.log, `[TAX BONUS] ${player.name} landed on their Tax Office at ${node.id} and received a 5% net worth bonus of ${bonus}G!`],
        };
        return advanceSpaceResolution(recalcAllNetWorths(s));
      }

      if (prop.buildingType === 'home') {
        const movedPlayers = { ...state.players };
        for (const pid of state.turnOrder) {
          if (pid !== player.id) {
            movedPlayers[pid] = { ...movedPlayers[pid], currentNodeId: node.id, arrivedFromNodeId: undefined };
          }
        }
        const s: GameState = {
          ...state,
          players: movedPlayers,
          log: [...state.log, `[HOME CONGREGATE] ${player.name} landed on their Home at ${node.id}! All other players are congregated to this square!`],
        };
        return advanceSpaceResolution(s);
      }

      if (prop.buildingType === 'estate_agency' || prop.buildingType === 'checkpoint' || prop.buildingType === 'circus' || prop.buildingType === 'three_star_shop' || prop.buildingType === 'balloonport') {
        return { ...state, currentPhase: 'SPACE_ACTION' };
      }

      return advanceSpaceResolution(state);
    } else {
      if (prop.buildingType === 'estate_agency' || prop.buildingType === 'vacant' || prop.buildingType === 'checkpoint') {
        return advanceSpaceResolution(state);
      }
      return { ...state, currentPhase: 'SPACE_ACTION' };
    }
  }

  if (node.type === 'bank') {
    // Landing on the bank grants a free choice of direction next turn
    // (the no-walk-back rule doesn't apply when leaving the bank).
    let s: GameState = {
      ...state,
      players: {
        ...state.players,
        [player.id]: { ...player, arrivedFromNodeId: undefined },
      },
    };
    // Auto-collect salary if the suits (plus wildcards) are complete —
    // must happen before the win check.
    if (canPromote(player)) {
      s = collectSalary(s, player.id);
    }
    // Win condition check before entering SPACE_ACTION.
    s = checkWinCondition(s, player.id);
    if (s.winnerId) return s;
    return { ...s, currentPhase: 'SPACE_ACTION' };
  }

  // stockbroker, property — wait for player action
  return { ...state, currentPhase: 'SPACE_ACTION' };
}

export function applyAction(state: GameState, action: Action): GameState {
  const { currentPhase, currentPlayerId } = state;
  const player = currentPlayer(state);

  // A live auction pauses everything until it resolves.
  if (state.auction && action.type !== 'AUCTION_BID' && action.type !== 'AUCTION_PASS') {
    throw new Error(`An auction is in progress — only bids and passes are legal`);
  }

  // A pending end-game vote pauses everything until it resolves.
  if (state.endVote && action.type !== 'VOTE_END') {
    throw new Error(`An end-game vote is in progress — only VOTE_END is legal`);
  }

  // Post-bank stock window: the landed space was already resolved; only a
  // stock purchase or ending the turn are legal (prevents double rent/invest).
  if (currentPhase === 'SPACE_ACTION' && state.passedBankWindowUsed
      && action.type !== 'BUY_STOCK' && action.type !== 'END_TURN') {
    throw new Error(`Only BUY_STOCK or END_TURN are legal in the post-bank stock window`);
  }

  switch (action.type) {
    case 'AUCTION_BID': {
      return applyAuctionBid(state, action.playerId, action.amount);
    }

    case 'AUCTION_PASS': {
      return applyAuctionPass(state, action.playerId);
    }

    case 'VOTE_END': {
      if (!state.endVote) throw new Error(`No end-game vote in progress`);
      const voter = state.players[action.playerId];
      if (!voter) throw new Error(`Player ${action.playerId} not found`);
      if (voter.isBankrupt) throw new Error(`Eliminated players don't vote`);
      if (voter.isBot) throw new Error(`Bots don't vote`);

      if (!action.vote) {
        // Any "continue" kills the vote instantly — unanimity is impossible.
        return {
          ...state,
          endVote: null,
          log: [...state.log, `[VOTE] ${voter.name} voted to keep playing — the game goes on!`],
        };
      }

      const votes = { ...state.endVote.votes, [action.playerId]: true };
      const eligible = state.turnOrder.filter(
        pid => !state.players[pid].isBankrupt && !state.players[pid].isBot,
      );
      const everyoneAgreed = eligible.every(pid => votes[pid]);

      if (everyoneAgreed) {
        return {
          ...state,
          endVote: null,
          winnerId: richestAlive(state),
          log: [...state.log, `[VOTE] ${voter.name} voted to end the game.`, `[VOTE] Unanimous — the game ends by agreement!`],
        };
      }
      return {
        ...state,
        endVote: { ...state.endVote, votes },
        log: [...state.log, `[VOTE] ${voter.name} voted to end the game. (${Object.keys(votes).length}/${eligible.length})`],
      };
    }

    case 'SELL_STOCK': {
      if (currentPhase !== 'PRE_ROLL' && currentPhase !== 'DEBT_SETTLEMENT') {
        throw new Error(`Illegal action SELL_STOCK in phase ${currentPhase}`);
      }
      const { districtId, shares } = action;
      const sold = sellStock(state, currentPlayerId, districtId, shares);
      // Settling debt: re-check after each sale — price impact of the sale
      // itself can make a borderline debt hopeless.
      return currentPhase === 'DEBT_SETTLEMENT' ? checkBankruptcy(sold, currentPlayerId) : sold;
    }

    case 'SELL_PROPERTY': {
      if (currentPhase !== 'DEBT_SETTLEMENT') {
        throw new Error(`Illegal action SELL_PROPERTY in phase ${currentPhase}`);
      }
      // Authentic debt sale: the shop goes to auction among the other
      // players, with the bank's 75% offer as the floor. If everyone is
      // eliminated/uninterested it resolves instantly at the floor.
      const opened = openAuction(state, action.propertyId, currentPlayerId, 'debt');
      return opened.auction ? opened : checkBankruptcy(opened, currentPlayerId);
    }

    case 'CASINO_BET': {
      if (currentPhase !== 'SPACE_ACTION') {
        throw new Error(`Illegal action CASINO_BET in phase ${currentPhase}`);
      }
      const node = currentNode(state);
      if (node.type !== 'casino') {
        throw new Error(`CASINO_BET requires a casino node, got ${node.type}`);
      }
      if (state.casinoResult || state.arcadeResult) {
        throw new Error(`Already played this visit — one game per casino stop`);
      }
      // Stay in SPACE_ACTION: the client animates the result, then END_TURN.
      return playCasino(state, currentPlayerId, action.game, action.wager, action.choice);
    }

    case 'ARCADE_PLAY': {
      if (currentPhase !== 'SPACE_ACTION') {
        throw new Error(`Illegal action ARCADE_PLAY in phase ${currentPhase}`);
      }
      const node = currentNode(state);
      if (node.type !== 'casino') {
        throw new Error(`ARCADE_PLAY requires a casino node, got ${node.type}`);
      }
      if (state.casinoResult || state.arcadeResult) {
        throw new Error(`Already played this visit — one game per casino stop`);
      }
      // Stay in SPACE_ACTION: the client animates the result, then END_TURN.
      return playArcade(state, currentPlayerId, action.game, action.pick);
    }

    case 'ARCADE_GIVE': {
      if (currentPhase !== 'SPACE_ACTION') {
        throw new Error(`Illegal action ARCADE_GIVE in phase ${currentPhase}`);
      }
      return applyArcadeGive(state, currentPlayerId, action.targetPlayerId);
    }

    case 'ROLL_DICE': {
      if (currentPhase !== 'PRE_ROLL') {
        throw new Error(`Illegal action ROLL_DICE in phase ${currentPhase}`);
      }
      // Venture cards can force the next roll (move exactly 1 / exactly 7).
      const roll = player.forcedRoll ?? (Math.floor(Math.random() * 6) + 1);
      const forced = player.forcedRoll !== undefined;
      // The first step may not go back the way the player arrived. If that
      // leaves no legal move (dead-end node), allow backtracking as fallback.
      const blocked = player.arrivedFromNodeId;
      let result = findPaths(state.board, player.currentNodeId, roll, blocked);
      if (result.destinations.length === 0) {
        result = findPaths(state.board, player.currentNodeId, roll);
      }
      const { destinations, decisionPoints } = result;
      const logMsg = `${player.name} rolled a ${roll}!`;
      const nextLastRoll = { ...state.lastRoll, [currentPlayerId]: roll };

      if (decisionPoints.length > 0 || destinations.length > 1) {
        return {
          ...state,
          currentPhase: 'CHOOSING_PATH',
          pendingDestinations: destinations,
          lastRoll: nextLastRoll,
          players: forced ? { ...state.players, [currentPlayerId]: { ...player, forcedRoll: undefined } } : state.players,
          log: [...state.log, logMsg],
        };
      }

      const path = getPath(state.board, player.currentNodeId, destinations[0], roll, blocked);
      const nextState = {
        ...state,
        players: {
          ...state.players,
          [currentPlayerId]: {
            ...player,
            currentNodeId: destinations[0],
            arrivedFromNodeId: path.length >= 2 ? path[path.length - 2] : undefined,
            forcedRoll: undefined,
          },
        },
        lastRoll: nextLastRoll,
        log: [...state.log, logMsg],
      };

      const stateWithSuits = processPathMovement(nextState, currentPlayerId, path);
      if (stateWithSuits.winnerId) return stateWithSuits;

      return resolveSpace(stateWithSuits);
    }

    case 'CHOOSE_PATH': {
      if (currentPhase !== 'CHOOSING_PATH') {
        throw new Error(`Illegal action CHOOSE_PATH in phase ${currentPhase}`);
      }
      const validDests = state.pendingDestinations ?? [];
      if (!validDests.includes(action.nodeId)) {
        throw new Error(`Node ${action.nodeId} is not a valid destination`);
      }
      const roll = state.lastRoll?.[currentPlayerId] ?? 0;
      const path = getPath(state.board, player.currentNodeId, action.nodeId, roll, player.arrivedFromNodeId);
      const nextState = {
        ...state,
        players: {
          ...state.players,
          [currentPlayerId]: {
            ...player,
            currentNodeId: action.nodeId,
            arrivedFromNodeId: path.length >= 2 ? path[path.length - 2] : undefined,
          },
        },
        pendingDestinations: undefined,
      };

      const stateWithSuits = processPathMovement(nextState, currentPlayerId, path);
      if (stateWithSuits.winnerId) return stateWithSuits;

      return resolveSpace(stateWithSuits);
    }

    case 'BUY_PROPERTY': {
      if (currentPhase !== 'SPACE_ACTION') {
        throw new Error(`Illegal action BUY_PROPERTY in phase ${currentPhase}`);
      }
      const node = currentNode(state);
      const { propertyId } = action;
      const targetProp = state.properties[propertyId];
      if (!targetProp) throw new Error(`Property ${propertyId} not found`);

      const standingProp = propertyAtNode(state, node.id);
      const isEstateAgencyBuy = node.type === 'vacant' && standingProp && standingProp.buildingType === 'estate_agency' && standingProp.ownerId === currentPlayerId;

      if (!isEstateAgencyBuy && node.type !== 'property') {
        throw new Error(`BUY_PROPERTY requires a property node, got ${node.type}`);
      }
      if (!isEstateAgencyBuy && targetProp.nodeId !== node.id) {
        throw new Error(`Can only buy the property you are standing on`);
      }

      const s = buyProperty(state, currentPlayerId, targetProp.id);
      return advanceSpaceResolution(checkWinCondition(s, currentPlayerId));
    }

    case 'BUYOUT_PROPERTY': {
      if (currentPhase !== 'SPACE_ACTION') {
        throw new Error(`Illegal action BUYOUT_PROPERTY in phase ${currentPhase}`);
      }
      const node = currentNode(state);
      const prop = propertyAtNode(state, node.id);
      if (!prop) throw new Error(`No property at node ${node.id}`);
      if (prop.ownerId === null) throw new Error(`Cannot buyout unowned property`);
      if (prop.ownerId === currentPlayerId) throw new Error(`Cannot buyout own property`);

      const s = buyoutProperty(state, currentPlayerId, prop.id);
      return advanceSpaceResolution(checkWinCondition(s, currentPlayerId));
    }

    case 'INVEST': {
      if (currentPhase !== 'SPACE_ACTION') {
        throw new Error(`Illegal action INVEST in phase ${currentPhase}`);
      }
      const { propertyId, amount } = action;
      const prop = state.properties[propertyId];
      if (!prop) throw new Error(`Property ${propertyId} not found`);
      
      const node = currentNode(state);
      const standingProp = propertyAtNode(state, node.id);
      
      // Stand on Checkpoint/3-Star/Circus owned by self OR standing directly on the property
      const canInvestRemote = standingProp && standingProp.ownerId === currentPlayerId && 
        (standingProp.buildingType === 'checkpoint' || standingProp.buildingType === 'three_star_shop');
      const isDirectInvest = prop.nodeId === node.id && prop.ownerId === currentPlayerId;

      if (!isDirectInvest && !canInvestRemote) {
        throw new Error(`Player cannot invest in property ${propertyId} at this time`);
      }
      if (prop.ownerId !== currentPlayerId) {
        throw new Error(`Player does not own property ${propertyId}`);
      }

      const s = invest(state, currentPlayerId, propertyId, amount);
      return advanceSpaceResolution(checkWinCondition(s, currentPlayerId));
    }

    case 'PAY_RENT': {
      if (currentPhase !== 'SPACE_ACTION') {
        throw new Error(`Illegal action PAY_RENT in phase ${currentPhase}`);
      }
      const node = currentNode(state);
      const prop = propertyAtNode(state, node.id);
      if (!prop) throw new Error(`No property at node ${node.id}`);
      if (prop.ownerId === null) throw new Error(`Property has no owner`);
      if (prop.ownerId === currentPlayerId) throw new Error(`Cannot pay rent on own property`);
      const s = payRent(state, currentPlayerId, prop.id);
      return advanceSpaceResolution(checkWinCondition(s, prop.ownerId));
    }

    case 'BUY_STOCK': {
      if (currentPhase !== 'SPACE_ACTION') {
        throw new Error(`Illegal action BUY_STOCK in phase ${currentPhase}`);
      }
      const node = currentNode(state);
      if (node.type !== 'bank' && node.type !== 'stockbroker' && !state.passedBankThisTurn) {
        throw new Error(`BUY_STOCK requires bank or stockbroker node, got ${node.type}`);
      }
      const { districtId, shares } = action;
      const s = buyStock(state, currentPlayerId, districtId, shares);
      // Stay in SPACE_ACTION: the player may keep trading (other districts,
      // more shares) and finishes the visit with END_TURN ("Done Trading").
      return checkWinCondition(s, currentPlayerId);
    }

    case 'COLLECT_SALARY': {
      if (currentPhase !== 'SPACE_ACTION') {
        throw new Error(`Illegal action COLLECT_SALARY in phase ${currentPhase}`);
      }
      const node = currentNode(state);
      if (node.type !== 'bank') throw new Error(`COLLECT_SALARY requires bank node`);
      const s = collectSalary(state, currentPlayerId);
      // Stay in SPACE_ACTION: collecting salary shouldn't forfeit the
      // chance to trade stock at the bank.
      return checkWinCondition(s, currentPlayerId);
    }

    case 'BUILD_PLOT': {
      if (currentPhase !== 'SPACE_ACTION') {
        throw new Error(`Illegal action BUILD_PLOT in phase ${currentPhase}`);
      }
      const node = currentNode(state);
      if (node.type !== 'vacant') {
        throw new Error(`BUILD_PLOT requires a vacant node, got ${node.type}`);
      }
      const prop = propertyAtNode(state, node.id);
      if (!prop) throw new Error(`No property at vacant node ${node.id}`);
      if (prop.ownerId !== null) throw new Error(`Plot is already owned`);

      const { buildingType } = action;
      const s = buildPlot(state, currentPlayerId, prop.id, buildingType);
      return advanceSpaceResolution(checkWinCondition(s, currentPlayerId));
    }

    case 'RENOVATE_PLOT': {
      if (currentPhase !== 'PRE_ROLL') {
        throw new Error(`Illegal action RENOVATE_PLOT in phase ${currentPhase}`);
      }
      const { propertyId, buildingType } = action;
      const s = renovatePlot(state, currentPlayerId, propertyId, buildingType);
      return checkWinCondition(s, currentPlayerId);
    }

    case 'TELEPORT': {
      if (currentPhase !== 'SPACE_ACTION') {
        throw new Error(`Illegal action TELEPORT in phase ${currentPhase}`);
      }
      const node = currentNode(state);
      const prop = propertyAtNode(state, node.id);
      if (!prop || prop.buildingType !== 'balloonport' || prop.ownerId !== currentPlayerId) {
        throw new Error(`Must stand on owned Balloonport to teleport`);
      }
      
      const { nodeId } = action;
      const destNode = state.board[nodeId];
      if (!destNode) throw new Error(`Destination node ${nodeId} not found`);

      const nextState = {
        ...state,
        log: [...state.log, `[TELEPORT] ${player.name} traveled from ${node.id} to ${nodeId} via Balloonport!`],
        players: {
          ...state.players,
          [currentPlayerId]: { ...player, currentNodeId: nodeId, arrivedFromNodeId: undefined },
        },
      };

      return resolveSpace(nextState);
    }

    case 'CHOOSE_VENTURE_CARD': {
      if (currentPhase !== 'SPACE_ACTION') {
        throw new Error(`Illegal action CHOOSE_VENTURE_CARD in phase ${currentPhase}`);
      }
      const node = currentNode(state);
      if (node.type !== 'venture' && node.type !== 'suit') {
        throw new Error(`CHOOSE_VENTURE_CARD requires a venture or suit node, got ${node.type}`);
      }
      if (state.activeVentureCard) {
        throw new Error(`Venture card already active`);
      }
      const { cardIndex } = action;
      if (cardIndex < 0 || cardIndex >= 64) {
        throw new Error(`Invalid cardIndex ${cardIndex}`);
      }
      if (!state.ventureGrid) {
        throw new Error(`Venture grid not initialized`);
      }
      if (state.ventureGrid[cardIndex]?.cleared) {
        throw new Error(`Venture card at index ${cardIndex} is already cleared`);
      }
      return resolveVentureCard(state, currentPlayerId, cardIndex);
    }

    case 'VENTURE_CHOICE': {
      if (currentPhase !== 'SPACE_ACTION') {
        throw new Error(`Illegal action VENTURE_CHOICE in phase ${currentPhase}`);
      }
      if (!state.pendingVenture) {
        throw new Error(`No pending venture to resolve`);
      }
      // Stay in SPACE_ACTION: the player confirms the card with END_TURN.
      return checkWinCondition(resolveVentureChoice(state, currentPlayerId, action), currentPlayerId);
    }

    case 'END_TURN': {
      if (currentPhase === 'DEBT_SETTLEMENT') {
        if (player.cash < 0) {
          throw new Error(`Cannot end debt settlement: still ${-player.cash}G in debt`);
        }
        const settled: GameState = { ...state, debtResume: undefined };
        return state.debtResume === 'PRE_ROLL'
          ? { ...settled, currentPhase: 'PRE_ROLL' }
          : advanceTurn(settled);
      }
      if (currentPhase !== 'SPACE_ACTION') {
        throw new Error(`Illegal action END_TURN in phase ${currentPhase}`);
      }
      const node = currentNode(state);
      // During the bonus stock window the space was already resolved (rent paid,
      // card drawn) — END_TURN must be legal then or the player is stuck.
      const inStockWindow = !!state.passedBankWindowUsed;
      if (node.type === 'property' && !inStockWindow) {
        const prop = propertyAtNode(state, node.id);
        if (prop?.ownerId !== null && prop?.ownerId !== currentPlayerId) {
          throw new Error(`Illegal action END_TURN in phase ${currentPhase}: must PAY_RENT on opponent shop`);
        }
      }
      if (state.pendingVenture) {
        // Mandatory sales would otherwise be freely declinable via END_TURN.
        throw new Error(`Must resolve the venture offer (VENTURE_CHOICE) before ending turn`);
      }
      if (state.arcadeResult?.needsTarget) {
        throw new Error(`Must assign the dart prize (ARCADE_GIVE) before ending turn`);
      }
      if (state.activeVentureCard) {
        const isRollAgain = state.activeVentureCard.effectType === 'ROLL_AGAIN';
        const effect = state.activeVentureCard.effectType;
        const isWarp = effect === 'WARP_BANK' || effect === 'WARP_VACANT' || effect === 'WARP_BROKER';
        const clearedState = {
          ...state,
          activeVentureCard: null
        };
        if (isRollAgain) {
          return {
            ...clearedState,
            currentPhase: 'PRE_ROLL'
          };
        }
        if (isWarp) {
          const destNode = clearedState.board[currentPlayer(clearedState).currentNodeId];
          if (destNode.type !== 'venture' && destNode.type !== 'suit') {
            return resolveSpace(clearedState);
          }
        }
        return advanceSpaceResolution(checkWinCondition(clearedState, currentPlayerId));
      }
      if ((node.type === 'venture' || node.type === 'suit') && !inStockWindow) {
        throw new Error(`Must choose a venture card before ending turn`);
      }
      return advanceSpaceResolution(checkWinCondition(state, currentPlayerId));
    }

    default: {
      const _exhaustive: never = action;
      throw new Error(`Unknown action: ${(_exhaustive as Action).type}`);
    }
  }
}
