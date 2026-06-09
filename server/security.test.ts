import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'socket.io';
import { io as ioclient, type Socket } from 'socket.io-client';
import { GameManager } from './gameManager.js';
import { attachHandlers } from './index.js';

const TEST_PORT = 3199;
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

  // c1 connects first and creates the room
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

test('impersonation prevention: c2 cannot send actions claiming to be alice', async () => {
  const errPromise = nextEvent<{ code: string; message: string }>(c2, 'error');
  // c2 attempts to send ROLL_DICE claiming to be 'alice'
  c2.emit('request_action', {
    roomId: ROOM,
    playerId: 'alice',
    action: { type: 'ROLL_DICE' }
  });

  const err = await errPromise;
  assert.equal(err.code, 'UNAUTHORIZED');
  assert.equal(err.message, 'Unauthorized action request');
});

test('negative investment cash exploit check', async () => {
  const errPromise = nextEvent<{ code: string; message: string }>(c1, 'error');
  // alice attempts to invest a negative amount
  c1.emit('request_action', {
    roomId: ROOM,
    playerId: 'alice',
    action: { type: 'INVEST', propertyId: 'tantegel_1', amount: -500 }
  });

  const err = await errPromise;
  assert.equal(err.code, 'BAD_REQUEST');
  assert.ok(err.message.includes('amount must be a positive integer'));
});

test('out-of-bounds/invalid venture card index validation checks', async () => {
  // Check index > 63
  let errPromise = nextEvent<{ code: string; message: string }>(c1, 'error');
  c1.emit('request_action', {
    roomId: ROOM,
    playerId: 'alice',
    action: { type: 'CHOOSE_VENTURE_CARD', cardIndex: 64 }
  });
  let err = await errPromise;
  assert.equal(err.code, 'BAD_REQUEST');
  assert.ok(err.message.includes('cardIndex must be an integer between 0 and 63'));

  // Check negative index
  errPromise = nextEvent<{ code: string; message: string }>(c1, 'error');
  c1.emit('request_action', {
    roomId: ROOM,
    playerId: 'alice',
    action: { type: 'CHOOSE_VENTURE_CARD', cardIndex: -1 }
  });
  err = await errPromise;
  assert.equal(err.code, 'BAD_REQUEST');

  // Check fractional index
  errPromise = nextEvent<{ code: string; message: string }>(c1, 'error');
  c1.emit('request_action', {
    roomId: ROOM,
    playerId: 'alice',
    action: { type: 'CHOOSE_VENTURE_CARD', cardIndex: 2.5 }
  });
  err = await errPromise;
  assert.equal(err.code, 'BAD_REQUEST');
});

test('invalid stock shares or malformed stock actions validation checks', async () => {
  // Check buy stock with non-integer shares
  let errPromise = nextEvent<{ code: string; message: string }>(c1, 'error');
  c1.emit('request_action', {
    roomId: ROOM,
    playerId: 'alice',
    action: { type: 'BUY_STOCK', districtId: 'tantegel', shares: 5.5 }
  });
  let err = await errPromise;
  assert.equal(err.code, 'BAD_REQUEST');
  assert.ok(err.message.includes('shares must be a positive integer'));

  // Check buy stock with negative shares
  errPromise = nextEvent<{ code: string; message: string }>(c1, 'error');
  c1.emit('request_action', {
    roomId: ROOM,
    playerId: 'alice',
    action: { type: 'BUY_STOCK', districtId: 'tantegel', shares: -10 }
  });
  err = await errPromise;
  assert.equal(err.code, 'BAD_REQUEST');

  // Check buy stock with missing districtId
  errPromise = nextEvent<{ code: string; message: string }>(c1, 'error');
  c1.emit('request_action', {
    roomId: ROOM,
    playerId: 'alice',
    action: { type: 'BUY_STOCK', districtId: '', shares: 10 }
  });
  err = await errPromise;
  assert.equal(err.code, 'BAD_REQUEST');
});
