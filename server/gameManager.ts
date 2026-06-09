import { writeFileSync, readFileSync, existsSync, mkdirSync, renameSync } from 'fs';
import { join } from 'path';
import { applyAction } from '../engine/stateMachine.js';
import { seedVentureGridCardIds } from '../engine/economy.js';
import { BOARDS, DEFAULT_BOARD_ID } from './boards.js';
import { getPath } from '../engine/navigation.js';
import { CHARACTERS, CHARACTER_IDS } from '../shared/characters.js';
import type { GameState, Action, Node, Property, District, Player } from '../shared/types.js';

export function makePlayer(id: string, characterId?: string): Player {
  const character = characterId ? CHARACTERS[characterId] : undefined;
  // Bots take the character's name; humans keep their own with the emoji as avatar.
  const isBot = id.startsWith('bot');
  const name = character
    ? (isBot ? `${character.emoji} ${character.name}` : `${character.emoji} ${id}`)
    : id;

  return {
    id, name,
    characterId: character?.id,
    cash: 1500, netWorth: 1500,
    currentNodeId: 'bank',
    level: 1,
    suits: { heart: false, diamond: false, club: false, spade: false },
    propertyIds: [],
    isBankrupt: false,
  };
}

// Pick a character not already used by anyone in the room (bots get distinct
// personalities; falls back to the first roster entry if all are taken).
export function pickUnusedCharacter(state: GameState): string {
  const taken = new Set(Object.values(state.players).map(p => p.characterId).filter(Boolean));
  return CHARACTER_IDS.find(cid => !taken.has(cid)) ?? CHARACTER_IDS[0];
}

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

function makeDefaultState(roomId: string, playerIds: string[], targetNetWorth = 15000, boardId = DEFAULT_BOARD_ID): GameState {
  const players: Record<string, Player> = {};
  for (const id of playerIds) {
    players[id] = makePlayer(id);
  }

  const def = BOARDS[boardId] ?? BOARDS[DEFAULT_BOARD_ID];
  const board = symmetrizeBoard(structuredClone(def.board), def.oneWayEdges);

  return {
    roomId,
    boardId: def.id,
    players,
    turnOrder: [...playerIds],
    currentPlayerId: playerIds[0],
    currentPhase: 'PRE_ROLL',
    board,
    properties: structuredClone(def.properties),
    districts: structuredClone(def.districts),
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
    const path = getPath(after.board, bPlayer.currentNodeId, aPlayer.currentNodeId, roll, bPlayer.arrivedFromNodeId);
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
  private persistDir: string | null;
  private saveTimer: NodeJS.Timeout | null = null;

  // When persistDir is given, rooms are restored from it on construction and
  // saved back (debounced) after every change. GameState is JSON-clean by design.
  constructor(persistDir?: string) {
    this.persistDir = persistDir ?? null;
    if (this.persistDir) this.loadRooms();
  }

  private persistFile(): string {
    return join(this.persistDir!, 'rooms.json');
  }

  private loadRooms(): void {
    try {
      if (!existsSync(this.persistFile())) return;
      const entries: [string, GameState][] = JSON.parse(readFileSync(this.persistFile(), 'utf8'));
      this.rooms = new Map(entries);
      console.log(`[persistence] restored ${this.rooms.size} room(s) from ${this.persistFile()}`);
    } catch (e) {
      console.error(`[persistence] failed to load rooms: ${(e as Error).message}`);
    }
  }

  // Immediate atomic write (tmp file + rename).
  saveNow(): void {
    if (!this.persistDir) return;
    try {
      mkdirSync(this.persistDir, { recursive: true });
      const tmp = this.persistFile() + '.tmp';
      writeFileSync(tmp, JSON.stringify([...this.rooms]));
      renameSync(tmp, this.persistFile());
    } catch (e) {
      console.error(`[persistence] failed to save rooms: ${(e as Error).message}`);
    }
  }

  // Debounced save — call after any state change. No-op without persistDir.
  scheduleSave(): void {
    if (!this.persistDir || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.saveNow();
    }, 500);
    this.saveTimer.unref();
  }

  getRoom(roomId: string): GameState | undefined {
    return this.rooms.get(roomId);
  }

  getRooms(): Map<string, GameState> {
    return this.rooms;
  }

  createRoom(roomId: string, players: string[], targetNetWorth?: number, boardId?: string): GameState {
    const state = makeDefaultState(roomId, players, targetNetWorth, boardId);
    this.rooms.set(roomId, state);
    this.scheduleSave();
    return state;
  }

  applyValidatedAction(roomId: string, action: Action): { before: GameState; after: GameState } {
    const before = this.rooms.get(roomId);
    if (!before) throw new Error(`Room ${roomId} not found`);
    const after = applyAction(before, action);
    this.rooms.set(roomId, after);
    this.scheduleSave();
    return { before, after };
  }

  deleteRoom(roomId: string): void {
    this.rooms.delete(roomId);
    this.scheduleSave();
  }
}
