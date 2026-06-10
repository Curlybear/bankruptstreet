import { useState, useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { GameState, Action } from '../shared/types';

export const SOCKET_URL = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:3001`
  : 'http://localhost:3001';

export interface ActiveRoom {
  roomId: string;
  status: 'LOBBY' | 'ACTIVE' | 'FINISHED';
  playerCount: number;
  maxPlayers: number;
  boardId?: string;
  boardName?: string;
}

export function useGameSocket(): {
  state: GameState | null;
  socket: Socket | null;
  roomsList: ActiveRoom[];
  playerId: string | null;
  roomId: string | null;
  joinRoom: (roomId: string, playerId: string, characterId?: string) => void;
  createRoom: (roomId: string, playerId: string, targetNetWorth: number, boardId: string, characterId?: string, bankruptcyLimit?: number) => void;
  startGame: () => void;
  leaveLobby: () => void;
  emitAction: (action: Action) => void;
} {
  const [state, setState] = useState<GameState | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [roomsList, setRoomsList] = useState<ActiveRoom[]>([]);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);

  useEffect(() => {
    const s = io(SOCKET_URL);
    setSocket(s);

    s.on('rooms_list', setRoomsList);
    s.on('state_sync', setState);
    s.on('room_disbanded', (data: { message: string }) => {
      alert(data.message);
      setState(null);
      setRoomId(null);
    });

    return () => {
      s.off('rooms_list');
      s.off('state_sync');
      s.off('room_disbanded');
      s.disconnect();
    };
  }, []);

  function joinRoom(rId: string, pId: string, characterId?: string) {
    if (socket) {
      setPlayerId(pId);
      setRoomId(rId);
      socket.emit('join_room', { roomId: rId, playerId: pId, characterId });
    }
  }

  function createRoom(rId: string, pId: string, targetNetWorth: number, boardId: string, characterId?: string, bankruptcyLimit?: number) {
    if (socket) {
      setPlayerId(pId);
      setRoomId(rId);
      socket.emit('join_room', { roomId: rId, playerId: pId, targetNetWorth, boardId, characterId, bankruptcyLimit });
    }
  }

  function startGame() {
    if (socket) {
      socket.emit('start_game');
    }
  }

  function leaveLobby() {
    if (socket) {
      socket.emit('leave_lobby');
      setState(null);
      setRoomId(null);
    }
  }

  function emitAction(action: Action) {
    if (socket && roomId && playerId) {
      socket.emit('request_action', { roomId, playerId, action });
    }
  }

  // Handle live state delta syncs statefully
  useEffect(() => {
    if (!socket) return;

    const onDelta = () => {
      if (roomId && playerId) {
        socket.emit('join_room', { roomId, playerId });
      }
    };

    socket.on('state_delta', onDelta);
    return () => {
      socket.off('state_delta', onDelta);
    };
  }, [socket, roomId, playerId]);

  return {
    state,
    socket,
    roomsList,
    playerId,
    roomId,
    joinRoom,
    createRoom,
    startGame,
    leaveLobby,
    emitAction,
  };
}
