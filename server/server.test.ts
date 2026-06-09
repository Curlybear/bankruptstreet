import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'socket.io';
import { io as ioclient, type Socket } from 'socket.io-client';
import { GameManager, computeDeltas, symmetrizeBoard } from './gameManager.js';
import { findPaths } from '../engine/navigation.js';
import type { Node } from '../shared/types.js';
import { attachHandlers } from './index.js';

const TEST_PORT = 3099;
const ROOM = 'smoke';

let ioServer: Server;
let c1: Socket;
let c2: Socket;

function nextEvent<T = unknown>(socket: Socket, event: string, timeout = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for '${event}'`)), timeout);
    socket.once(event, (data: T) => { clearTimeout(t); resolve(data); });
  });
}

before(async () => {
  const manager = new GameManager();
  ioServer = new Server(TEST_PORT, { cors: { origin: '*' } });
  attachHandlers(ioServer, manager);

  // c1 connects first and creates the room (room is seeded with ['alice','player2'])
  c1 = ioclient(`http://localhost:${TEST_PORT}`);
  await new Promise<void>(res => {
    c1.once('connect', () => c1.emit('join_room', { roomId: ROOM, playerId: 'alice' }));
    c1.once('state_sync', () => res());
  });

  // c2 joins the existing room as 'player2'
  c2 = ioclient(`http://localhost:${TEST_PORT}`);
  await new Promise<void>(res => {
    c2.once('connect', () => c2.emit('join_room', { roomId: ROOM, playerId: 'player2' }));
    c2.once('state_sync', () => res());
  });
});

after(async () => {
  if (c1.connected) c1.disconnect();
  if (c2.connected) c2.disconnect();
  await new Promise<void>(res => ioServer.close(() => res()));
});

// ─── Test 1: ROLL_DICE broadcasts state_delta to both clients ─────────────────

test('ROLL_DICE broadcasts state_delta to both clients', async () => {
  // Force roll=2: Math.floor(0.2 × 6)+1 = 2.
  const origRandom = Math.random;
  Math.random = () => 0.2;

  // 1. ROLL_DICE should broadcast CHOICES_AVAILABLE because there is a branching choice at starting bank node
  const rollP1 = nextEvent<{ type: string }>(c1, 'state_delta');
  const rollP2 = nextEvent<{ type: string }>(c2, 'state_delta');
  c1.emit('request_action', { roomId: ROOM, playerId: 'alice', action: { type: 'ROLL_DICE' } });

  const [rd1, rd2] = await Promise.all([rollP1, rollP2]);
  assert.equal(rd1.type, 'CHOICES_AVAILABLE', 'first delta is CHOICES_AVAILABLE');
  assert.deepEqual(rd1, rd2, 'both clients receive identical CHOICES_AVAILABLE delta');

  // 2. alice chooses the path to tantegel_2 (a vacant plot, putting her in SPACE_ACTION)
  const moveP1 = nextEvent<{ type: string }>(c1, 'state_delta');
  const moveP2 = nextEvent<{ type: string }>(c2, 'state_delta');
  c1.emit('request_action', {
    roomId: ROOM,
    playerId: 'alice',
    action: { type: 'CHOOSE_PATH', nodeId: 'tantegel_2' },
  });

  const [d1, d2] = await Promise.all([moveP1, moveP2]);
  Math.random = origRandom;

  assert.equal(d1.type, 'PLAYER_MOVED', 'second delta is PLAYER_MOVED');
  assert.deepEqual(d1, d2, 'both clients receive identical PLAYER_MOVED delta');
});

// ─── Test 2: illegal action emits error to sender only ────────────────────────

test('SELL_STOCK in SPACE_ACTION emits error to sender only, no broadcast', async () => {
  // alice is now in SPACE_ACTION at d1s1 (from previous test).
  // SELL_STOCK is only legal in PRE_ROLL → engine rejects it.
  let c2ReceivedDelta = false;
  const listener = () => { c2ReceivedDelta = true; };
  c2.on('state_delta', listener);

  const errPromise = nextEvent<{ code: string; message: string }>(c1, 'error');
  c1.emit('request_action', {
    roomId: ROOM,
    playerId: 'alice',
    action: { type: 'SELL_STOCK', districtId: 'd1', shares: 1 },
  });

  const err = await errPromise;

  // Let the event loop drain to catch any spurious broadcast to c2.
  await new Promise(res => setTimeout(res, 150));
  c2.removeListener('state_delta', listener);

  assert.equal(err.code, 'ILLEGAL_ACTION');
  assert.ok(err.message.includes('SELL_STOCK'), 'error names the offending action');
  assert.equal(c2ReceivedDelta, false, 'c2 received no state_delta');
});

// ─── Test 3: disconnect + reconnect receives full state_sync ──────────────────

test('reconnecting client receives state_sync with current state', async () => {
  c2.disconnect();

  // Brief pause so the server processes the disconnect before we reconnect.
  await new Promise(res => setTimeout(res, 80));

  const c2new = ioclient(`http://localhost:${TEST_PORT}`);
  const syncPromise = nextEvent<{
    currentPhase: string;
    players: Record<string, unknown>;
    currentPlayerId: string;
  }>(c2new, 'state_sync');

  c2new.once('connect', () => c2new.emit('join_room', { roomId: ROOM, playerId: 'player2' }));

  const sync = await syncPromise;
  c2new.disconnect();

  assert.equal(sync.currentPhase, 'SPACE_ACTION', 'reconnected client gets live phase');
  assert.equal(sync.currentPlayerId, 'alice', 'current player preserved');
  assert.ok('alice' in sync.players, 'alice present in state');
  assert.ok('player2' in sync.players, 'player2 present in state');
});

test('computeDeltas for BUYOUT_PROPERTY', () => {
  const beforeState = {
    roomId: 'test',
    players: {
      alice: { id: 'alice', name: 'Alice', cash: 1000, netWorth: 1000, currentNodeId: 'd1s1', level: 1, suits: { heart: false, diamond: false, club: false, spade: false }, propertyIds: [], isBankrupt: false },
      player2: { id: 'player2', name: 'Player 2', cash: 1000, netWorth: 1000, currentNodeId: 'bank', level: 1, suits: { heart: false, diamond: false, club: false, spade: false }, propertyIds: ['d1s1'], isBankrupt: false },
    },
    turnOrder: ['alice', 'player2'],
    currentPlayerId: 'alice',
    currentPhase: 'SPACE_ACTION' as const,
    board: {},
    properties: {
      d1s1: { id: 'd1s1', nodeId: 'd1s1', districtId: 'd1', ownerId: 'player2', basePrice: 100, currentPrice: 100, baseRent: 10, currentRent: 10, capitalInvested: 0, maxCapital: 200, shopMultiplier: 1 },
    },
    districts: {
      d1: { id: 'd1', name: 'Uptown', stockPrice: 5, propertyIds: ['d1s1'], playerHoldings: {} },
    },
    round: 1,
    targetNetWorth: 1500,
    winnerId: null,
    bankruptCount: 0,
    log: [],
  };

  const afterState = {
    ...beforeState,
    players: {
      alice: { ...beforeState.players.alice, cash: 500, netWorth: 1000, propertyIds: ['d1s1'] },
      player2: { ...beforeState.players.player2, cash: 1300, netWorth: 1300, propertyIds: [] },
    },
    properties: {
      d1s1: { ...beforeState.properties.d1s1, ownerId: 'alice' },
    },
  };

  const deltas = computeDeltas({ type: 'BUYOUT_PROPERTY', propertyId: 'd1s1' }, beforeState, afterState);
  assert.equal(deltas.length, 1);
  assert.equal(deltas[0].type, 'PROPERTY_BUYOUT');
  assert.deepEqual(deltas[0].payload, {
    buyerId: 'alice',
    sellerId: 'player2',
    propertyId: 'd1s1',
    price: 100,
  });
});

test('computeDeltas for CHOOSE_VENTURE_CARD', () => {
  const beforeState = {
    roomId: 'test',
    players: {
      alice: { id: 'alice', name: 'Alice', cash: 1000, netWorth: 1000, currentNodeId: 'branch', level: 1, suits: { heart: false, diamond: false, club: false, spade: false }, propertyIds: [], isBankrupt: false },
    },
    turnOrder: ['alice'],
    currentPlayerId: 'alice',
    currentPhase: 'SPACE_ACTION' as const,
    board: {},
    properties: {},
    districts: {},
    round: 1,
    targetNetWorth: 1500,
    winnerId: null,
    bankruptCount: 0,
    log: [],
    activeVentureCard: null,
  };

  const activeCard = { number: 5, title: 'Lucky Day', text: 'Gain 100G', effectType: 'CASH_GAIN' as const, payout: 100 };
  const afterState = {
    ...beforeState,
    activeVentureCard: activeCard,
  };

  const deltas = computeDeltas({ type: 'CHOOSE_VENTURE_CARD', cardIndex: 4 }, beforeState, afterState);
  assert.equal(deltas.length, 1);
  assert.equal(deltas[0].type, 'VENTURE_CARD_CHOSEN');
  assert.deepEqual(deltas[0].payload, {
    playerId: 'alice',
    cardIndex: 4,
    card: activeCard,
  });
});

test('computeDeltas for END_TURN', () => {
  const beforeState = {
    roomId: 'test',
    players: {
      alice: { id: 'alice', name: 'Alice', cash: 1000, netWorth: 1000, currentNodeId: 'branch', level: 1, suits: { heart: false, diamond: false, club: false, spade: false }, propertyIds: [], isBankrupt: false },
      player2: { id: 'player2', name: 'Player 2', cash: 1000, netWorth: 1000, currentNodeId: 'bank', level: 1, suits: { heart: false, diamond: false, club: false, spade: false }, propertyIds: [], isBankrupt: false },
    },
    turnOrder: ['alice', 'player2'],
    currentPlayerId: 'alice',
    currentPhase: 'SPACE_ACTION' as const,
    board: {},
    properties: {},
    districts: {},
    round: 1,
    targetNetWorth: 1500,
    winnerId: null,
    bankruptCount: 0,
    log: [],
  };

  const afterState = {
    ...beforeState,
    currentPlayerId: 'player2',
    currentPhase: 'PRE_ROLL' as const,
  };

  const deltas = computeDeltas({ type: 'END_TURN' }, beforeState, afterState);
  // It should contain at least TURN_ENDED and TURN_ADVANCED
  const types = deltas.map(d => d.type);
  assert.ok(types.includes('TURN_ENDED'));
  assert.ok(types.includes('TURN_ADVANCED'));
});

// ─── symmetrizeBoard: one-way edge support (board prep) ───────────────────────

test('symmetrizeBoard makes edges bidirectional except listed one-way edges', () => {
  const board: Record<string, Node> = {
    a: { id: 'a', type: 'property', neighbors: ['b'], coordinates: { x: 0, y: 0 } },
    b: { id: 'b', type: 'property', neighbors: ['c'], coordinates: { x: 1, y: 0 } },
    c: { id: 'c', type: 'property', neighbors: ['a'], coordinates: { x: 2, y: 0 } },
  };

  symmetrizeBoard(board, [['b', 'c']]);

  assert.ok(board.b.neighbors.includes('a'), 'a→b becomes bidirectional');
  assert.ok(board.a.neighbors.includes('c'), 'c→a becomes bidirectional');
  assert.ok(!board.c.neighbors.includes('b'), 'b→c stays one-way');

  // Movement respects the direction: from c with roll 1 you can only reach a or b? — only a (and back along c→a reverse... a is bidirectional)
  const { destinations } = findPaths(board, 'c', 1);
  assert.ok(!destinations.includes('b') || board.c.neighbors.includes('b') === false, 'cannot step backward along one-way edge');
  assert.deepEqual([...destinations].sort(), ['a']);
});

// ─── Board registry & Torland integrity ───────────────────────────────────────

test('GameManager creates rooms on the requested board', () => {
  const manager = new GameManager();
  const state = manager.createRoom('t1', ['alice'], 15000, 'torland');
  assert.equal(state.boardId, 'torland');
  assert.ok(state.board.rapids_1);
  assert.ok(state.properties.moonbrooke_1);
  assert.equal(state.players.alice.currentNodeId, 'bank');

  const fallback = manager.createRoom('t2', ['alice']);
  assert.equal(fallback.boardId, 'alefgard');
  assert.ok(fallback.board.tantegel_1);
});

test('Torland: every node is reachable from the bank', () => {
  const manager = new GameManager();
  const { board } = manager.createRoom('t3', ['alice'], 15000, 'torland');

  const visited = new Set<string>(['bank']);
  const queue = ['bank'];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const n of board[id].neighbors) {
      if (!visited.has(n)) { visited.add(n); queue.push(n); }
    }
  }
  const all = Object.keys(board);
  const unreachable = all.filter(id => !visited.has(id));
  assert.deepEqual(unreachable, [], `unreachable nodes: ${unreachable.join(', ')}`);
});

test('Torland: rapids edges are one-way (no backward traversal)', () => {
  const manager = new GameManager();
  const { board } = manager.createRoom('t4', ['alice'], 15000, 'torland');

  assert.ok(!board.rapids_1.neighbors.includes('tuhn_2'), 'rapids_1 must not flow back to tuhn_2');
  assert.ok(!board.venture_mid.neighbors.includes('rapids_1'), 'venture_mid must not flow back');
  assert.ok(!board.rapids_2.neighbors.includes('venture_mid'), 'rapids_2 must not flow back');
  assert.ok(!board.stockbroker_east.neighbors.includes('rapids_2'), 'broker must not enter the rapids backward');

  // Forward flow works: from tuhn_2 a roll of 4 can exit the rapids at the broker
  const { destinations } = findPaths(board, 'tuhn_2', 4);
  assert.ok(destinations.includes('stockbroker_east'), `expected broker exit, got: ${destinations.join(', ')}`);
});

test('Torland: no movement traps — every node yields destinations for every roll', () => {
  const manager = new GameManager();
  const { board } = manager.createRoom('t5', ['alice'], 15000, 'torland');

  for (const nodeId of Object.keys(board)) {
    if (board[nodeId].type === 'warp') continue;  // players never rest on warp nodes
    for (let roll = 1; roll <= 6; roll++) {
      const { destinations } = findPaths(board, nodeId, roll);
      assert.ok(
        destinations.length > 0,
        `node ${nodeId} with roll ${roll} has no destinations — movement trap`,
      );
    }
  }
});

test('Torland: districts and properties are consistent', () => {
  const manager = new GameManager();
  const { board, properties, districts } = manager.createRoom('t6', ['alice'], 15000, 'torland');

  for (const district of Object.values(districts)) {
    for (const pid of district.propertyIds) {
      assert.ok(properties[pid], `district ${district.id} references missing property ${pid}`);
      assert.equal(properties[pid].districtId, district.id);
    }
  }
  for (const prop of Object.values(properties)) {
    assert.ok(board[prop.nodeId], `property ${prop.id} sits on missing node ${prop.nodeId}`);
    assert.ok(districts[prop.districtId], `property ${prop.id} references missing district`);
    const nodeType = board[prop.nodeId].type;
    assert.ok(nodeType === 'property' || nodeType === 'vacant',
      `property ${prop.id} on non-shop node type ${nodeType}`);
  }
});

test('join_room rejects unknown boardId', async () => {
  const c = ioclient(`http://localhost:${TEST_PORT}`);
  await new Promise<void>(res => c.once('connect', () => res()));
  const errPromise = nextEvent<{ code: string; message: string }>(c, 'error');
  c.emit('join_room', { roomId: 'badboard', playerId: 'alice', boardId: 'mordor' });
  const err = await errPromise;
  assert.equal(err.code, 'BAD_REQUEST');
  assert.ok(err.message.includes('unknown boardId'));
  c.disconnect();
});

// ─── Room persistence ─────────────────────────────────────────────────────────

test('rooms persist to disk and restore into a fresh GameManager', async () => {
  const { mkdtempSync, rmSync, writeFileSync } = await import('fs');
  const { tmpdir } = await import('os');
  const { join } = await import('path');
  const dir = mkdtempSync(join(tmpdir(), 'bankrupt-persist-'));

  const m1 = new GameManager(dir);
  const state = m1.createRoom('proom', ['alice', 'bob'], 9000, 'torland');
  state.status = 'ACTIVE';
  state.log.push('[TEST] marker entry');
  m1.saveNow();

  const m2 = new GameManager(dir);
  const restored = m2.getRoom('proom');
  assert.ok(restored, 'room must be restored');
  assert.equal(restored.boardId, 'torland');
  assert.equal(restored.targetNetWorth, 9000);
  assert.equal(restored.status, 'ACTIVE');
  assert.deepEqual(restored.turnOrder, ['alice', 'bob']);
  assert.ok(restored.log.includes('[TEST] marker entry'));
  // Full structural equality through JSON round-trip
  assert.deepEqual(JSON.parse(JSON.stringify(restored)), JSON.parse(JSON.stringify(m1.getRoom('proom'))));

  // Corrupt file must not crash construction
  writeFileSync(join(dir, 'rooms.json'), '{not json!');
  const m3 = new GameManager(dir);
  assert.equal(m3.getRooms().size, 0);

  rmSync(dir, { recursive: true, force: true });
});

test('GameManager without persistDir neither loads nor saves', () => {
  const m = new GameManager();
  m.createRoom('volatile', ['alice']);
  m.saveNow();         // no-op, must not throw
  m.scheduleSave();    // no-op, must not throw
  assert.ok(m.getRoom('volatile'));
});
