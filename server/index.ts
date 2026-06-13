import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { createServer } from 'http';
import { existsSync, statSync, createReadStream } from 'fs';
import { join, extname, normalize } from 'path';
import { Server } from 'socket.io';
import { GameManager, computeDeltas, makePlayer, pickUnusedCharacter } from './gameManager.js';
import { BOARDS, DEFAULT_BOARD_ID } from './boards.js';
import { CHARACTERS } from '../shared/characters.js';
import { greedyBotAction } from '../engine/bot.js';
import type { Action } from '../shared/types.js';

const PORT = Number(process.env.PORT ?? 3001);

// Allowed CORS origins for the socket handshake. Prod is same-origin (the
// server serves the client), so a same-origin browser needs no match; this
// only blocks *other* websites from driving the server. Set CORS_ORIGIN
// (comma-separated) for any cross-origin setup; defaults cover local dev.
const CORS_ORIGIN = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:4173'];

const MAX_ROOMS = Number(process.env.MAX_ROOMS ?? 100);       // cap total rooms (memory DoS)
const RATE_WINDOW_MS = 5000;                                  // per-socket flood guard
const RATE_MAX_EVENTS = 80;                                   // events allowed per window

// Reserved usernames: object-key hazards + the server's own bot seats.
const RESERVED_IDS = new Set(['__proto__', 'constructor', 'prototype']);

// In production the same process serves the built client (single container,
// same-origin websockets). In dev Vite serves the client and this is unused.
const CLIENT_DIST = process.env.CLIENT_DIST ?? 'client/dist';
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};

function serveStatic(req: { url?: string }, res: import('http').ServerResponse): void {
  const urlPath = (req.url ?? '/').split('?')[0];
  // Resolve inside CLIENT_DIST only — reject traversal.
  const safe = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(CLIENT_DIST, safe);
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    filePath = join(CLIENT_DIST, 'index.html');  // SPA fallback
  }
  if (!existsSync(filePath)) {
    res.writeHead(404).end('client build not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' });
  createReadStream(filePath).pipe(res);
}
const CLEANUP_DELAY_MS = 30 * 60 * 1000;

const KNOWN_ACTION_TYPES = new Set([
  'SELL_STOCK', 'ROLL_DICE', 'CHOOSE_PATH', 'BUY_PROPERTY',
  'INVEST', 'PAY_RENT', 'BUY_STOCK', 'COLLECT_SALARY', 'BUYOUT_PROPERTY', 'END_TURN',
  'CHOOSE_VENTURE_CARD', 'VENTURE_CHOICE', 'BUILD_PLOT', 'RENOVATE_PLOT', 'TELEPORT', 'SELL_PROPERTY',
  'CASINO_BET', 'ARCADE_PLAY', 'VOTE_END', 'AUCTION_BID', 'AUCTION_PASS',
]);

const KNOWN_BUILDING_TYPES = new Set([
  'vacant', 'checkpoint', 'circus', 'balloonport',
  'tax_office', 'home', 'estate_agency', 'three_star_shop',
]);

function log(roomId: string, msg: string) {
  console.log(`[${new Date().toISOString()}] [${roomId}] ${msg}`);
}

function getRoomsList(manager: GameManager) {
  return Array.from(manager.getRooms().entries()).map(([roomId, state]) => ({
    roomId,
    status: state.status ?? 'LOBBY',
    playerCount: state.turnOrder.length,
    maxPlayers: 4,
    boardId: state.boardId ?? DEFAULT_BOARD_ID,
    boardName: BOARDS[state.boardId ?? DEFAULT_BOARD_ID]?.name ?? state.boardId,
  }));
}

function validateJoin(p: unknown): string | null {
  if (!p || typeof p !== 'object') return 'payload must be an object';
  const { roomId, playerId, targetNetWorth } = p as Record<string, unknown>;
  if (typeof roomId !== 'string' || !roomId.trim()) return 'roomId must be a non-empty string';
  if (roomId.trim().length > 20) return 'roomId must be at most 20 characters';
  if (typeof playerId !== 'string' || !playerId.trim()) return 'playerId must be a non-empty string';
  if (playerId.trim().length > 20) return 'playerId must be at most 20 characters';
  if (RESERVED_IDS.has(playerId.trim()) || RESERVED_IDS.has(roomId.trim())) return 'reserved name';
  if (playerId.trim().toLowerCase().startsWith('bot')) return 'names starting with "bot" are reserved';
  const { token } = p as Record<string, unknown>;
  if (token !== undefined && typeof token !== 'string') return 'token must be a string';
  if (targetNetWorth !== undefined) {
    if (!Number.isInteger(targetNetWorth) || (targetNetWorth as number) <= 0) {
      return 'targetNetWorth must be a positive integer';
    }
  }
  const { boardId } = p as Record<string, unknown>;
  if (boardId !== undefined) {
    if (typeof boardId !== 'string' || !(boardId in BOARDS)) {
      return `unknown boardId: ${String(boardId)}`;
    }
  }
  const { bankruptcyLimit } = p as Record<string, unknown>;
  if (bankruptcyLimit !== undefined) {
    if (!Number.isInteger(bankruptcyLimit) || (bankruptcyLimit as number) < 1 || (bankruptcyLimit as number) > 99) {
      return 'bankruptcyLimit must be an integer between 1 and 99';
    }
  }
  const { characterId } = p as Record<string, unknown>;
  if (characterId !== undefined) {
    if (typeof characterId !== 'string' || !(characterId in CHARACTERS)) {
      return `unknown characterId: ${String(characterId)}`;
    }
  }
  return null;
}

function validateAction(p: unknown): string | null {
  if (!p || typeof p !== 'object') return 'payload must be an object';
  const { roomId, playerId, action } = p as Record<string, unknown>;
  if (typeof roomId !== 'string' || !roomId.trim()) return 'roomId must be a non-empty string';
  if (typeof playerId !== 'string' || !playerId.trim()) return 'playerId must be a non-empty string';
  if (!action || typeof action !== 'object') return 'action must be an object';
  
  const act = action as Record<string, unknown>;
  if (typeof act.type !== 'string') return 'action.type must be a string';
  if (!KNOWN_ACTION_TYPES.has(act.type)) return `unknown action type: ${act.type}`;

  if (act.type === 'SELL_STOCK' || act.type === 'BUY_STOCK') {
    if (typeof act.districtId !== 'string' || !act.districtId.trim()) return 'districtId must be a non-empty string';
    if (!Number.isInteger(act.shares) || (act.shares as number) <= 0) {
      return 'shares must be a positive integer';
    }
  }

  if (act.type === 'CHOOSE_PATH') {
    if (typeof act.nodeId !== 'string' || !act.nodeId.trim()) return 'nodeId must be a non-empty string';
  }

  if (act.type === 'BUY_PROPERTY' || act.type === 'PAY_RENT' || act.type === 'BUYOUT_PROPERTY' || act.type === 'SELL_PROPERTY') {
    if (typeof act.propertyId !== 'string' || !act.propertyId.trim()) return 'propertyId must be a non-empty string';
  }

  if (act.type === 'INVEST') {
    if (typeof act.propertyId !== 'string' || !act.propertyId.trim()) return 'propertyId must be a non-empty string';
    if (!Number.isInteger(act.amount) || (act.amount as number) <= 0) {
      return 'amount must be a positive integer';
    }
  }

  if (act.type === 'VOTE_END') {
    if (typeof act.playerId !== 'string' || !act.playerId.trim()) return 'playerId must be a non-empty string';
    if (typeof act.vote !== 'boolean') return 'vote must be a boolean';
  }

  if (act.type === 'AUCTION_BID') {
    if (typeof act.playerId !== 'string' || !act.playerId.trim()) return 'playerId must be a non-empty string';
    if (!Number.isInteger(act.amount) || (act.amount as number) <= 0) return 'amount must be a positive integer';
  }
  if (act.type === 'AUCTION_PASS') {
    if (typeof act.playerId !== 'string' || !act.playerId.trim()) return 'playerId must be a non-empty string';
  }

  if (act.type === 'CASINO_BET') {
    if (act.game !== 'derby' && act.game !== 'highlow') return `unknown casino game: ${String(act.game)}`;
    if (!Number.isInteger(act.wager) || (act.wager as number) <= 0) return 'wager must be a positive integer';
    if (typeof act.choice !== 'string' || !act.choice.trim()) return 'choice must be a non-empty string';
  }

  if (act.type === 'CHOOSE_VENTURE_CARD') {
    if (!Number.isInteger(act.cardIndex) || (act.cardIndex as number) < 0 || (act.cardIndex as number) >= 64) {
      return 'cardIndex must be an integer between 0 and 63';
    }
  }

  if (act.type === 'ARCADE_PLAY') {
    if (act.game !== 'slots' && act.game !== 'memory' && act.game !== 'darts') {
      return `unknown arcade game: ${String(act.game)}`;
    }
    if (act.pick !== undefined && (!Number.isInteger(act.pick) || (act.pick as number) < 0 || (act.pick as number) > 8)) {
      return 'pick must be an integer between 0 and 8';
    }
  }

  if (act.type === 'VENTURE_CHOICE') {
    const kinds = ['buy_stock', 'sell_stock', 'sell_shop', 'buy_shop', 'skip'];
    if (typeof act.kind !== 'string' || !kinds.includes(act.kind)) {
      return `unknown venture choice kind: ${String(act.kind)}`;
    }
    if (act.kind === 'buy_stock' || act.kind === 'sell_stock') {
      if (typeof act.districtId !== 'string' || !act.districtId.trim()) return 'districtId must be a non-empty string';
      if (!Number.isInteger(act.shares) || (act.shares as number) <= 0) return 'shares must be a positive integer';
    }
    if (act.kind === 'buy_shop' || act.kind === 'sell_shop') {
      if (typeof act.propertyId !== 'string' || !act.propertyId.trim()) return 'propertyId must be a non-empty string';
    }
  }

  if (act.type === 'BUILD_PLOT' || act.type === 'RENOVATE_PLOT') {
    if (typeof act.propertyId !== 'string' || !act.propertyId.trim()) return 'propertyId must be a non-empty string';
    if (typeof act.buildingType !== 'string' || !KNOWN_BUILDING_TYPES.has(act.buildingType)) {
      return `unknown buildingType: ${String(act.buildingType)}`;
    }
  }

  if (act.type === 'TELEPORT') {
    if (typeof act.nodeId !== 'string' || !act.nodeId.trim()) return 'nodeId must be a non-empty string';
  }

  return null;
}

export function attachHandlers(io: Server, manager: GameManager): void {
  // Per-room async queue: chains tasks so concurrent requests are serialised.
  const queues = new Map<string, Promise<void>>();
  // Track which socket IDs are in each game room for cleanup detection.
  const roomSockets = new Map<string, Set<string>>();
  const cleanupTimers = new Map<string, NodeJS.Timeout>();
  const activeBotLoops = new Set<string>();
  // Per-seat secret: roomId → (playerId → token). A name with a token can only
  // be (re)claimed by presenting it — stops seat hijacking by self-declared name.
  const roomTokens = new Map<string, Map<string, string>>();

  // Lightweight per-socket flood guard (sliding window of event timestamps).
  function rateLimited(socket: { data: Record<string, unknown> }): boolean {
    const now = Date.now();
    const hits = ((socket.data.rateHits as number[] | undefined) ?? []).filter(t => now - t < RATE_WINDOW_MS);
    hits.push(now);
    socket.data.rateHits = hits;
    return hits.length > RATE_MAX_EVENTS;
  }

  // During an auction, the next undecided BOT bidder (humans act via the UI).
  function pendingAuctionBot(state: ReturnType<GameManager['getRoom']>): string | null {
    if (!state?.auction) return null;
    const a = state.auction;
    return state.turnOrder.find(pid =>
      pid.startsWith('bot') && pid !== a.sellerId && !state.players[pid].isBankrupt
      && !a.passed[pid] && a.highBid?.playerId !== pid,
    ) ?? null;
  }

  function runBotTurnsIfNeeded(roomId: string): void {
    const state = manager.getRoom(roomId);
    if (!state) return;

    const auctionBot = pendingAuctionBot(state);
    const currentPlayerId = auctionBot ?? state.currentPlayerId;
    const isBot = currentPlayerId.startsWith('bot');
    const hasWinner = state.winnerId !== null;
    const votePending = !!state.endVote;  // humans resolve the vote; bots wait
    const auctionWaitingOnHumans = !!state.auction && !auctionBot;

    if (!isBot || hasWinner || votePending || auctionWaitingOnHumans) {
      activeBotLoops.delete(roomId);
      return;
    }

    if (activeBotLoops.has(roomId)) {
      return;
    }

    activeBotLoops.add(roomId);

    setTimeout(() => {
      enqueue(roomId, () => {
        const currentState = manager.getRoom(roomId);
        const stillSameActor = currentState && (pendingAuctionBot(currentState) === currentPlayerId
          || (!currentState.auction && currentState.currentPlayerId === currentPlayerId));
        if (!currentState || !stillSameActor || currentState.winnerId) {
          activeBotLoops.delete(roomId);
          runBotTurnsIfNeeded(roomId);
          return;
        }

        let action: Action | undefined;
        try {
          action = greedyBotAction(currentState, currentPlayerId);
          const result = manager.applyValidatedAction(roomId, action);
          const deltas = computeDeltas(action, result.before, result.after);
          for (const delta of deltas) {
            io.to(roomId).emit('state_delta', delta);
          }
          log(roomId, `${currentPlayerId} (BOT) → ${action.type} (${deltas.map(d => d.type).join(', ')})`);

          activeBotLoops.delete(roomId);

          runBotTurnsIfNeeded(roomId);
        } catch (e) {
          log(roomId, `BOT ${currentPlayerId} illegal ${action ? action.type : 'ACTION'} error: ${(e as Error).message}`);
          activeBotLoops.delete(roomId);
        }
      });
    }, 1500);
  }

  function enqueue(roomId: string, task: () => void): void {
    const tail = queues.get(roomId) ?? Promise.resolve();
    queues.set(roomId, tail.then(() => { try { task(); } catch { /* handled inside */ } }));
  }

  function scheduleCleanup(roomId: string): void {
    const existing = cleanupTimers.get(roomId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      manager.deleteRoom(roomId);
      cleanupTimers.delete(roomId);
      roomSockets.delete(roomId);
      roomTokens.delete(roomId);
      log(roomId, 'deleted after 30min idle');
    }, CLEANUP_DELAY_MS);
    timer.unref(); // don't block process exit
    cleanupTimers.set(roomId, timer);
  }

  function cancelCleanup(roomId: string): void {
    const timer = cleanupTimers.get(roomId);
    if (timer) { clearTimeout(timer); cleanupTimers.delete(roomId); }
  }

  io.on('connection', (socket) => {
    console.log(`[${new Date().toISOString()}] connected ${socket.id}`);

    // Immediately push the active rooms list to the connected socket
    socket.emit('rooms_list', getRoomsList(manager));

    socket.on('join_room', (payload: unknown) => {
      if (rateLimited(socket)) { socket.emit('error', { code: 'RATE_LIMITED', message: 'Too many requests' }); return; }
      const validErr = validateJoin(payload);
      if (validErr) { socket.emit('error', { code: 'BAD_REQUEST', message: validErr }); return; }

      const { roomId, playerId, targetNetWorth, boardId, characterId, bankruptcyLimit, token } = payload as { roomId: string; playerId: string; targetNetWorth?: number; boardId?: string; characterId?: string; bankruptcyLimit?: number; token?: string };

      // Seat auth: a name that already holds a token must present it. First
      // claim of a name (new seat, or a seeded seat like player2) issues one.
      // Checked before any mutation so a rejected claim can't alter state.
      const existingToken = roomTokens.get(roomId)?.get(playerId);
      if (existingToken && token !== existingToken) {
        socket.emit('error', { code: 'NAME_TAKEN', message: `The name "${playerId}" is already taken in this room` });
        return;
      }

      let state = manager.getRoom(roomId);

      // Cap total rooms — a new room is only created below when none exists.
      if (!state && manager.getRooms().size >= MAX_ROOMS) {
        socket.emit('error', { code: 'AT_CAPACITY', message: 'The server is at room capacity — try again later' });
        return;
      }

      if (!state) {
        if (roomId === 'smoke') {
          state = manager.createRoom(roomId, [playerId, 'player2'], targetNetWorth ?? 15000, boardId, bankruptcyLimit);
          state.status = 'ACTIVE'; // Auto-start smoke room for retrocompatibility tests
          state.log.push(`[SMOKE] Auto-started smoke test room with alice and player2.`);
        } else {
          state = manager.createRoom(roomId, [playerId], targetNetWorth ?? 15000, boardId, bankruptcyLimit);
          state.status = 'LOBBY';
          if (characterId) state.players[playerId] = makePlayer(playerId, characterId);
          log(roomId, `lobby created by ${playerId} on board ${state.boardId} with target net worth ${state.targetNetWorth}`);
        }
      } else if (state.status === 'LOBBY') {
        if (!state.turnOrder.includes(playerId)) {
          if (state.turnOrder.length >= 4) {
            socket.emit('error', { code: 'ROOM_FULL', message: `Room ${roomId} is full` });
            return;
          }
          state.players[playerId] = makePlayer(playerId, characterId);
          state.turnOrder.push(playerId);
          log(roomId, `${playerId} joined lobby`);
        } else {
          log(roomId, `${playerId} reconnected to lobby`);
        }
      } else {
        // ACTIVE or FINISHED
        if (!state.turnOrder.includes(playerId)) {
          socket.emit('error', { code: 'ROOM_FULL', message: `Game in room ${roomId} has already started` });
          return;
        }
        log(roomId, `${playerId} reconnected to active game`);
      }

      cancelCleanup(roomId);
      if (!roomSockets.has(roomId)) roomSockets.set(roomId, new Set());
      roomSockets.get(roomId)!.add(socket.id);

      socket.join(roomId);
      socket.data.playerId = playerId;
      socket.data.roomId = roomId;

      // First claim of this name → mint a session token and hand it back, so
      // only this client can reconnect/act as the name afterward.
      if (!existingToken) {
        let tokens = roomTokens.get(roomId);
        if (!tokens) { tokens = new Map(); roomTokens.set(roomId, tokens); }
        const minted = randomUUID();
        tokens.set(playerId, minted);
        socket.emit('session', { roomId, playerId, token: minted });
      }

      socket.emit('state_sync', state);
      // Broadcast state update to everyone in the room
      io.to(roomId).emit('state_sync', state);
      log(roomId, `state_sync → ${playerId}`);

      // Broadcast updated room list globally
      io.emit('rooms_list', getRoomsList(manager));
      manager.scheduleSave();
      runBotTurnsIfNeeded(roomId);
    });

    socket.on('start_game', () => {
      const { roomId, playerId } = socket.data as { roomId?: string; playerId?: string };
      if (!roomId || !playerId) {
        socket.emit('error', { code: 'UNAUTHORIZED', message: 'Not in a room' });
        return;
      }

      const state = manager.getRoom(roomId);
      if (!state) {
        socket.emit('error', { code: 'ROOM_NOT_FOUND', message: `Room ${roomId} not found` });
        return;
      }

      if (state.creatorId !== playerId) {
        socket.emit('error', { code: 'UNAUTHORIZED', message: 'Only the room creator can start the game' });
        return;
      }

      if (state.status !== 'LOBBY') {
        socket.emit('error', { code: 'BAD_REQUEST', message: 'Game has already started' });
        return;
      }

      // Populate empty slots with bots up to exactly 4
      let botIndex = 1;
      while (state.turnOrder.length < 4) {
        const botId = `bot${botIndex}`;
        if (!state.turnOrder.includes(botId)) {
          state.players[botId] = makePlayer(botId, pickUnusedCharacter(state));
          state.turnOrder.push(botId);
        }
        botIndex++;
      }

      // Shift status to ACTIVE and start turn
      state.status = 'ACTIVE';
      state.currentPlayerId = state.turnOrder[0];
      state.log.push(`[LOBBY] Game started! Roster completed with bots: ${state.turnOrder.map(pid => state.players[pid]?.name ?? pid).join(', ')}`);

      // Broadcast state_sync to room
      io.to(roomId).emit('state_sync', state);
      log(roomId, `game started by creator ${playerId}`);

      // Broadcast updated room list globally
      io.emit('rooms_list', getRoomsList(manager));
      manager.scheduleSave();
      runBotTurnsIfNeeded(roomId);
    });

    socket.on('leave_lobby', () => {
      const { roomId, playerId } = socket.data as { roomId?: string; playerId?: string };
      if (!roomId || !playerId) return;

      const state = manager.getRoom(roomId);
      if (!state) return;

      socket.data.roomId = undefined;
      socket.data.playerId = undefined;
      socket.leave(roomId);

      if (roomSockets.has(roomId)) {
        roomSockets.get(roomId)!.delete(socket.id);
      }

      if (state.status === 'LOBBY') {
        if (state.creatorId === playerId) {
          // Disband room
          manager.deleteRoom(roomId);
          roomTokens.delete(roomId);
          log(roomId, `disbanded because creator left`);
          io.to(roomId).emit('room_disbanded', { message: 'The creator has left. Room disbanded.' });

          const sockets = roomSockets.get(roomId);
          if (sockets) {
            for (const sId of sockets) {
              const s = io.sockets.sockets.get(sId);
              if (s) {
                s.data.roomId = undefined;
                s.data.playerId = undefined;
                s.leave(roomId);
              }
            }
            roomSockets.delete(roomId);
          }
        } else {
          // Just remove player
          state.turnOrder = state.turnOrder.filter(id => id !== playerId);
          delete state.players[playerId];
          log(roomId, `${playerId} left lobby`);
          io.to(roomId).emit('state_sync', state);
        }
      }

      const sockets = roomSockets.get(roomId);
      if (!sockets || sockets.size === 0) {
        scheduleCleanup(roomId);
      }

      io.emit('rooms_list', getRoomsList(manager));
      manager.scheduleSave();
    });

    socket.on('request_action', (payload: unknown) => {
      if (rateLimited(socket)) { socket.emit('error', { code: 'RATE_LIMITED', message: 'Too many requests' }); return; }
      const validErr = validateAction(payload);
      if (validErr) { socket.emit('error', { code: 'BAD_REQUEST', message: validErr }); return; }

      const { roomId, playerId, action } = payload as {
        roomId: string; playerId: string; action: Action;
      };

      if (socket.data.roomId !== roomId || socket.data.playerId !== playerId) {
        socket.emit('error', { code: 'UNAUTHORIZED', message: 'Unauthorized action request' });
        return;
      }

      enqueue(roomId, () => {
        const state = manager.getRoom(roomId);
        if (!state) {
          socket.emit('error', { code: 'ROOM_NOT_FOUND', message: `Room ${roomId} not found` });
          return;
        }
        const isAnyPlayerAction = action.type === 'VOTE_END' || action.type === 'AUCTION_BID' || action.type === 'AUCTION_PASS';
        if (!isAnyPlayerAction && playerId !== state.currentPlayerId) {
          socket.emit('error', { code: 'NOT_YOUR_TURN', message: `It is ${state.currentPlayerId}'s turn` });
          return;
        }
        if (isAnyPlayerAction && action.playerId !== playerId) {
          socket.emit('error', { code: 'UNAUTHORIZED', message: 'You can only act as yourself' });
          return;
        }

        let result: ReturnType<typeof manager.applyValidatedAction>;
        try {
          result = manager.applyValidatedAction(roomId, action);
        } catch (e) {
          log(roomId, `illegal ${action.type} by ${playerId}: ${(e as Error).message}`);
          socket.emit('error', { code: 'ILLEGAL_ACTION', message: (e as Error).message });
          return;
        }

        const deltas = computeDeltas(action, result.before, result.after);
        for (const delta of deltas) io.to(roomId).emit('state_delta', delta);
        log(roomId, `${playerId} → ${action.type} (${deltas.map(d => d.type).join(', ')})`);

        runBotTurnsIfNeeded(roomId);
      });
    });

    socket.on('disconnect', () => {
      console.log(`[${new Date().toISOString()}] disconnected ${socket.id}`);
      const { roomId, playerId } = socket.data as { roomId?: string; playerId?: string };

      for (const [rId, sockets] of roomSockets) {
        if (sockets.delete(socket.id) && sockets.size === 0) {
          scheduleCleanup(rId);
        }
      }

      // If they disconnect during LOBBY phase, trigger leave lobby logic
      if (roomId && playerId) {
        const state = manager.getRoom(roomId);
        if (state && state.status === 'LOBBY') {
          if (state.creatorId === playerId) {
            // Disband room
            manager.deleteRoom(roomId);
            log(roomId, `disbanded because creator disconnected`);
            io.to(roomId).emit('room_disbanded', { message: 'The creator has disconnected. Room disbanded.' });
            roomSockets.delete(roomId);
          } else {
            state.turnOrder = state.turnOrder.filter(id => id !== playerId);
            delete state.players[playerId];
            log(roomId, `${playerId} disconnected from lobby`);
            io.to(roomId).emit('state_sync', state);
          }
          io.emit('rooms_list', getRoomsList(manager));
          manager.scheduleSave();
        }
      }
    });
  });
}

// Only start listening when invoked directly (not imported by tests).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manager = new GameManager('data');  // rooms survive server restarts
  const httpServer = createServer(serveStatic);
  const io = new Server(httpServer, { cors: { origin: CORS_ORIGIN } });
  attachHandlers(io, manager);
  httpServer.listen(PORT, () => {
    const hasClient = existsSync(join(CLIENT_DIST, 'index.html'));
    console.log(`[${new Date().toISOString()}] server listening on port ${PORT}${hasClient ? ` (serving ${CLIENT_DIST})` : ' (socket only — no client build found)'}`);
  });
}
