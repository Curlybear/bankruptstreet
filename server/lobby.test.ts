import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'socket.io';
import { io as ioclient, type Socket } from 'socket.io-client';
import { GameManager } from './gameManager.js';
import { attachHandlers } from './index.js';

const TEST_PORT = 3299;
const ROOM = 'lobby-test-room';

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
});

after(async () => {
  if (c1?.connected) c1.disconnect();
  if (c2?.connected) c2.disconnect();
  await new Promise<void>(res => ioServer.close(() => res()));
});

test('Lobby lifecycle: creator joins lobby, player2 joins lobby, creator starts game with bots completion', async () => {
  // 1. Creator joins
  c1 = ioclient(`http://localhost:${TEST_PORT}`);
  const sync1Promise = nextEvent<any>(c1, 'state_sync');
  c1.once('connect', () => c1.emit('join_room', { roomId: ROOM, playerId: 'creator', targetNetWorth: 20000 }));
  const state1 = await sync1Promise;

  assert.equal(state1.status, 'LOBBY');
  assert.equal(state1.creatorId, 'creator');
  assert.equal(state1.targetNetWorth, 20000);
  assert.deepEqual(state1.turnOrder, ['creator']);

  // 2. Player 2 joins
  c2 = ioclient(`http://localhost:${TEST_PORT}`);
  const sync2Promise = nextEvent<any>(c2, 'state_sync');
  c2.once('connect', () => c2.emit('join_room', { roomId: ROOM, playerId: 'player2' }));
  const state2 = await sync2Promise;

  assert.equal(state2.status, 'LOBBY');
  assert.deepEqual(state2.turnOrder, ['creator', 'player2']);

  // 3. Non-creator try to start game (should fail)
  const errPromise = nextEvent<{ code: string; message: string }>(c2, 'error');
  c2.emit('start_game');
  const err = await errPromise;
  assert.equal(err.code, 'UNAUTHORIZED');
  assert.equal(err.message, 'Only the room creator can start the game');

  // 4. Creator starts game -> completed with bots up to exactly 4 players
  const startPromise = nextEvent<any>(c1, 'state_sync');
  c1.emit('start_game');
  const activeState = await startPromise;

  assert.equal(activeState.status, 'ACTIVE');
  assert.equal(activeState.turnOrder.length, 4);
  assert.equal(activeState.turnOrder[0], 'creator');
  assert.equal(activeState.turnOrder[1], 'player2');
  assert.equal(activeState.turnOrder[2], 'bot1');
  assert.equal(activeState.turnOrder[3], 'bot2');
});
