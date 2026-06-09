import { useState, useEffect, useRef } from 'react';
import type { Action } from '../shared/types';
import { Board } from './Board';
import { PlayerStats } from './modals/PlayerStats';
import { StockExchange } from './modals/StockExchange';
import { ShopManagement } from './modals/ShopManagement';
import { useGameSocket } from './useGameSocket';

function g(n: number) { return `${n}G`; }

export default function App() {
  const {
    state,
    socket,
    roomsList,
    playerId,
    roomId,
    joinRoom,
    createRoom,
    startGame,
    leaveLobby,
    emitAction: socketEmitAction
  } = useGameSocket();

  const [pendingAction, setPendingAction] = useState(false);
  const pendingActionRef = useRef(false);
  const [showStockMatrix, setShowStockMatrix] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Main menu inputs
  const [playerNameInput, setPlayerNameInput] = useState(() => localStorage.getItem('playerName') ?? '');
  const [newRoomName, setNewRoomName] = useState('');
  const [targetNetWorth, setTargetNetWorth] = useState(15000);

  useEffect(() => {
    pendingActionRef.current = false;
    setPendingAction(false);
  }, [state]);

  const emitAction = (action: Action) => {
    if (pendingActionRef.current) return;
    pendingActionRef.current = true;
    setPendingAction(true);
    socketEmitAction(action);
    setTimeout(() => {
      pendingActionRef.current = false;
      setPendingAction(false);
    }, 1500);
  };

  const getPlayerColor = (pId: string | null) => {
    if (!pId) return '#64748b';
    const idx = state ? state.turnOrder.indexOf(pId) : -1;
    return ['#ff4e50', '#00f2fe', '#a855f7', '#facc15'][idx >= 0 ? idx % 4 : 0];
  };

  const getPlayerInitials = (pId: string | null) => {
    if (!pId) return '';
    const name = state ? state.players[pId]?.name ?? pId : pId;
    return name.substring(0, 2).toUpperCase();
  };

  // 1. Render Main Menu if not connected to a room
  if (!roomId || !playerId) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'radial-gradient(circle at 50% 10%, #0d0d1e 0%, #06060c 100%)',
        fontFamily: "'Outfit', sans-serif",
        color: '#f8fafc',
        padding: '24px',
        overflowY: 'auto',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{
            fontSize: 48,
            fontWeight: 900,
            letterSpacing: '4px',
            background: 'linear-gradient(135deg, #ffffff 0%, #a855f7 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: '0 0 8px 0',
          }}>
            BANKRUPT STREET
          </h1>
          <p style={{ color: '#64748b', fontSize: 14, fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase' }}>
            Itadaki Street Clone • Dragon Quest Edition
          </p>
        </div>

        <div style={{
          display: 'flex',
          gap: 32,
          width: '100%',
          maxWidth: 1040,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}>
          <div style={{
            flex: '1 1 450px',
            background: 'rgba(8, 8, 16, 0.65)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 24,
            padding: 32,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
          }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>👤</span> Setup Identity
            </h2>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 8, letterSpacing: '1px', textTransform: 'uppercase' }}>
                Your Username
              </label>
              <input
                type="text"
                placeholder="e.g., Hero, Dragonlord, alice..."
                value={playerNameInput}
                onChange={(e) => setPlayerNameInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#f8fafc',
                  fontSize: 14,
                  fontFamily: "'Outfit', sans-serif",
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ height: 1, background: 'rgba(255, 255, 255, 0.08)' }} />

            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🏰</span> Create New Room
            </h2>

            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 8, letterSpacing: '1px', textTransform: 'uppercase' }}>
                  Room Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Alefgard Castle"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#f8fafc',
                    fontSize: 14,
                    fontFamily: "'Outfit', sans-serif",
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ width: 140 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 8, letterSpacing: '1px', textTransform: 'uppercase' }}>
                  Net Worth Limit
                </label>
                <select
                  value={targetNetWorth}
                  onChange={(e) => setTargetNetWorth(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#f8fafc',
                    fontSize: 14,
                    fontFamily: "'Outfit', sans-serif",
                    outline: 'none',
                  }}
                >
                  <option value={10000}>10,000G</option>
                  <option value={15000}>15,000G</option>
                  <option value={20000}>20,000G</option>
                  <option value={25000}>25,000G</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => {
                if (!playerNameInput.trim()) { alert('Please enter a username'); return; }
                if (!newRoomName.trim()) { alert('Please enter a room name'); return; }
                localStorage.setItem('playerName', playerNameInput.trim());
                createRoom(newRoomName.trim(), playerNameInput.trim(), targetNetWorth);
              }}
              style={{
                padding: '14px',
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(139, 92, 246, 0.4)',
                transition: 'all 0.2s',
              }}
            >
              Create & Join Lobby
            </button>
          </div>

          <div style={{
            flex: '1 1 450px',
            background: 'rgba(8, 8, 16, 0.65)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 24,
            padding: 32,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🌐</span> Active Lobbies & Rooms
            </h2>

            <div style={{
              flex: 1,
              overflowY: 'auto',
              maxHeight: 320,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              paddingRight: 4,
            }}>
              {roomsList.length === 0 ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '40px 0',
                  color: '#64748b',
                  gap: 8,
                }}>
                  <span style={{ fontSize: 24 }}>📭</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>NO ACTIVE LOBBIES FOUND</span>
                  <span style={{ fontSize: 11, textAlign: 'center' }}>Create a room to start Alefgard's quest!</span>
                </div>
              ) : (
                roomsList.map((r) => (
                  <div
                    key={r.roomId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16px 20px',
                      borderRadius: 16,
                      background: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid rgba(255, 255, 255, 0.04)',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>{r.roomId}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{
                          fontSize: 9,
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: 6,
                          background: r.status === 'LOBBY' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                          color: r.status === 'LOBBY' ? '#10b981' : '#06b6d4',
                          border: r.status === 'LOBBY' ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(6, 182, 212, 0.25)',
                        }}>
                          {r.status}
                        </span>
                        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                          👥 {r.playerCount}/{r.maxPlayers}
                        </span>
                      </div>
                    </div>

                    {r.status === 'LOBBY' ? (
                      <button
                        onClick={() => {
                          if (!playerNameInput.trim()) { alert('Please enter a username first'); return; }
                          localStorage.setItem('playerName', playerNameInput.trim());
                          joinRoom(r.roomId, playerNameInput.trim());
                        }}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 10,
                          border: 'none',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: '#ffffff',
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: 'pointer',
                          boxShadow: '0 4px 10px rgba(16, 185, 129, 0.2)',
                        }}
                      >
                        Join Game
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (!playerNameInput.trim()) { alert('Please enter a username first'); return; }
                          localStorage.setItem('playerName', playerNameInput.trim());
                          joinRoom(r.roomId, playerNameInput.trim());
                        }}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 10,
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          background: 'rgba(255, 255, 255, 0.04)',
                          color: '#cbd5e1',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Rejoin Game
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Render Loading if selected a room but state is not sync'd
  if (!state) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: '#06060c',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        fontFamily: "'Outfit', sans-serif",
      }}>
        <div style={{
          width: 40,
          height: 40,
          border: '3px solid rgba(139, 92, 246, 0.1)',
          borderTop: '3px solid #8b5cf6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <div style={{
          color: '#64748b',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '2px',
        }}>
          ESTABLISHING COSMIC LINK...
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // 3. Render Lobby Room if status is LOBBY
  if (state.status === 'LOBBY') {
    const isLobbyCreator = state.creatorId === playerId;
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'radial-gradient(circle at 50% 10%, #0d0d1e 0%, #06060c 100%)',
        fontFamily: "'Outfit', sans-serif",
        color: '#f8fafc',
        padding: '24px',
      }}>
        <div style={{
          width: '100%',
          maxWidth: 580,
          background: 'rgba(8, 8, 16, 0.65)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 24,
          padding: '36px 40px',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #8b5cf6 0%, #d946ef 100%)' }} />

          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#a855f7', letterSpacing: '3px', textTransform: 'uppercase' }}>
              🛰 LOBBY STATION
            </span>
            <h2 style={{ fontSize: 26, fontWeight: 900, margin: '6px 0 2px 0', letterSpacing: '0.5px' }}>
              Room: {state.roomId}
            </h2>
            <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
              Target Goal: <strong style={{ color: '#facc15' }}>{state.targetNetWorth}G</strong> Net Worth
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Array.from({ length: 4 }).map((_, index) => {
              const pId = state.turnOrder[index];
              const p = pId ? state.players[pId] : null;

              if (p) {
                return (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16px 20px',
                      borderRadius: 16,
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        backgroundColor: getPlayerColor(pId),
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: 13,
                        boxShadow: `0 0 10px ${getPlayerColor(pId)}40`,
                      }}>
                        {getPlayerInitials(pId)}
                      </div>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>
                        {p.name} {pId === state.creatorId && <span style={{ fontSize: 10, color: '#facc15', marginLeft: 4 }}>👑 Room Owner</span>}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#10b981', letterSpacing: '1px', textTransform: 'uppercase' }}>
                      🟢 Connected
                    </span>
                  </div>
                );
              } else {
                return (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '16px 20px',
                      borderRadius: 16,
                      background: 'rgba(0, 0, 0, 0.2)',
                      border: '1px dashed rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, opacity: 0.4 }}>
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        border: '1.5px dashed #cbd5e1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 12,
                      }}>
                        ?
                      </div>
                      <span style={{ fontSize: 14, fontStyle: 'italic', fontWeight: 600, color: '#cbd5e1' }}>
                        Slot {index + 1}: Waiting for player...
                      </span>
                    </div>
                  </div>
                );
              }
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            {isLobbyCreator ? (
              <>
                <button
                  onClick={startGame}
                  style={{
                    padding: '14px',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
                    color: '#ffffff',
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(168, 85, 247, 0.35)',
                    transition: 'transform 0.2s',
                    animation: 'pulse-purple 2s infinite',
                  }}
                >
                  🚀 START MATCH NOW
                </button>
                <span style={{ fontSize: 11, color: '#64748b', textAlign: 'center', fontStyle: 'italic' }}>
                  Note: Empty slots will automatically complete with Dragon Quest AI bots!
                </span>
                <button
                  onClick={leaveLobby}
                  style={{
                    padding: '12px',
                    borderRadius: 12,
                    border: '1px solid rgba(244, 63, 94, 0.2)',
                    background: 'rgba(244, 63, 94, 0.05)',
                    color: '#f43f5e',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  🚪 DISBAND LOBBY
                </button>
              </>
            ) : (
              <>
                <div style={{
                  padding: '16px',
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.01)',
                  border: '1px solid rgba(255, 255, 255, 0.03)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #a855f7', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 600 }}>
                    Waiting for room creator to launch the game...
                  </span>
                </div>
                <button
                  onClick={leaveLobby}
                  style={{
                    padding: '12px',
                    borderRadius: 12,
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(255, 255, 255, 0.03)',
                    color: '#cbd5e1',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  🚪 LEAVE ROOM
                </button>
              </>
            )}
          </div>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes pulse-purple {
            0% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.4); }
            70% { box-shadow: 0 0 0 10px rgba(168, 85, 247, 0); }
            100% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0); }
          }
        `}</style>
      </div>
    );
  }

  // Bind player identity locally for compat with board game code
  const PLAYER_ID = playerId!;

  const currentPlayer = state.players[state.currentPlayerId];
  const isMyTurn      = PLAYER_ID === state.currentPlayerId && !pendingAction;
  const nodeId        = currentPlayer?.currentNodeId;
  const node          = state.board[nodeId];
  const phase         = state.currentPhase;



  const isVentureSpace = phase === 'SPACE_ACTION' && (node?.type === 'venture' || node?.type === 'suit');
  const showVentureGrid = isVentureSpace && !state.activeVentureCard;
  const showVentureCard = !!state.activeVentureCard;
  const ventureGrid = state.ventureGrid ?? [];

  // Find what property (if any) the current player is standing on.
  const propAtNode    = Object.values(state.properties).find(p => p.nodeId === nodeId) ?? null;
  const ownShop       = phase === 'SPACE_ACTION' && propAtNode?.ownerId === currentPlayer?.id
    ? propAtNode
    : null;
  const unownedShop   = phase === 'SPACE_ACTION' && propAtNode?.ownerId === null
    ? propAtNode
    : null;
  const opponentShop  = phase === 'SPACE_ACTION' && propAtNode?.ownerId !== null && propAtNode?.ownerId !== currentPlayer?.id
    ? propAtNode
    : null;
  const atBroker      = phase === 'SPACE_ACTION' && (node?.type === 'bank' || node?.type === 'stockbroker');

  // Unified overlay button style helper
  function overlayBtn(primary: boolean, danger = false): React.CSSProperties {
    return {
      padding: '10px 24px',
      borderRadius: 10,
      fontFamily: "'Outfit', sans-serif",
      fontWeight: 700,
      fontSize: 12.5,
      cursor: isMyTurn ? 'pointer' : 'default',
      opacity: isMyTurn ? 1 : 0.5,
      background: !isMyTurn
        ? 'rgba(255, 255, 255, 0.02)'
        : danger
          ? 'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)'
          : primary
            ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)'
            : 'rgba(255, 255, 255, 0.04)',
      color: !isMyTurn ? '#475569'
        : (danger || primary) ? '#ffffff'
        : '#cbd5e1',
      border: !isMyTurn 
        ? '1px solid rgba(255,255,255,0.02)' 
        : primary || danger 
          ? 'none' 
          : '1px solid rgba(255, 255, 255, 0.08)',
      boxShadow: isMyTurn && primary 
        ? '0 4px 12px rgba(139, 92, 246, 0.35)' 
        : isMyTurn && danger 
          ? '0 4px 12px rgba(244, 63, 94, 0.3)' 
          : 'none',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    };
  }

  // Renders the inline Action/Operations console content based on game phase
  const renderConsoleContent = () => {
    // 1. Pre-roll: stock selling triggers StockExchange inline
    if (phase === 'PRE_ROLL') {
      return (
        <StockExchange state={state} emitAction={emitAction} playerId={PLAYER_ID} />
      );
    }

    // 2. CHOOSING_PATH: branch direction selectors
    if (phase === 'CHOOSING_PATH') {
      return (
        <div style={consoleInnerPanelStyle} className="animate-slide-up">
          <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '2px', color: '#f59e0b', marginBottom: 4 }}>
            🛰 NAVIGATION BRANCH MODULE
          </div>
          <div style={{ fontWeight: 800, fontSize: 17, color: '#f8fafc', marginBottom: 8 }}>
            Choose a Direction
          </div>
          <div style={{ fontSize: 12.5, color: '#cbd5e1', marginBottom: 16 }}>
            {!isMyTurn 
              ? `Waiting for ${currentPlayer.name} to choose path…` 
              : 'Branching path encountered! Select your destination node:'}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {(state.pendingDestinations ?? []).map(destId => (
              <button
                key={destId}
                onClick={() => {
                  setHoveredNodeId(null);
                  emitAction({ type: 'CHOOSE_PATH', nodeId: destId });
                }}
                onMouseEnter={() => setHoveredNodeId(destId)}
                onMouseLeave={() => setHoveredNodeId(null)}
                disabled={!isMyTurn}
                style={{
                  ...overlayBtn(true),
                  padding: '10px 24px',
                  fontSize: 13,
                  textTransform: 'uppercase',
                }}
              >
                Go to {destId}
              </button>
            ))}
          </div>
        </div>
      );
    }

    // 3. SPACE_ACTION: landing on own property upgrades shop inline
    if (ownShop) {
      const isVacantOwnPlot = ownShop.buildingType !== undefined && ownShop.buildingType !== 'vacant';
      if (isVacantOwnPlot) {
        // Custom panels for owned developed vacant plots
        if (ownShop.buildingType === 'circus') {
          const lvl = ownShop.circusLevel ?? 0;
          const upgradeCosts = [400, 500, 1000];
          const circusPrices = [100, 500, 1000, 2000];
          const cost = upgradeCosts[lvl];
          const canAfford = cost !== undefined && currentPlayer.cash >= cost;
          const isMaxLvl = lvl >= 3;

          return (
            <div style={consoleInnerPanelStyle} className="animate-slide-up glow-border-cyber">
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '2px', color: '#06b6d4', marginBottom: 4 }}>
                🎪 CIRCUS TENT GROUND
              </div>
              <div style={{ fontWeight: 800, fontSize: 17, color: '#f8fafc', marginBottom: 6 }}>
                Expand Your Circus Tent
              </div>
              <div style={{ fontSize: 12.5, color: '#cbd5e1', marginBottom: 12 }}>
                Current Tier: <strong style={{ color: '#06b6d4' }}>{lvl + 1} / 4</strong> · Price & Rent: <strong style={{ color: '#10b981' }}>{circusPrices[lvl]}G</strong>
              </div>
              {!isMaxLvl ? (
                <div style={{ 
                  fontSize: 12.5, 
                  color: '#cbd5e1', 
                  marginBottom: 16,
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid rgba(255,255,255,0.03)',
                  padding: '8px 16px',
                  borderRadius: 8,
                }}>
                  Next Tier Price & Rent: <strong style={{ color: '#10b981' }}>{circusPrices[lvl + 1]}G</strong> · Upgrade Cost: <strong style={{ color: '#f59e0b' }}>{cost}G</strong>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#10b981', fontWeight: 700, marginBottom: 16 }}>
                  ✨ Maximum circus tier reached! Rent is at a flat 2000G.
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                {!isMaxLvl && (
                  <button
                    onClick={() => emitAction({ type: 'INVEST', propertyId: ownShop.id, amount: cost })}
                    disabled={!isMyTurn || !canAfford}
                    style={{
                      ...overlayBtn(true),
                      background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                      boxShadow: '0 4px 12px rgba(6, 182, 212, 0.3)',
                    }}
                  >
                    Upgrade Circus ({cost}G)
                  </button>
                )}
                <button
                  onClick={() => emitAction({ type: 'END_TURN' })}
                  disabled={!isMyTurn}
                  style={overlayBtn(false)}
                >
                  Done (End Turn)
                </button>
              </div>
            </div>
          );
        }

        if (ownShop.buildingType === 'checkpoint' || ownShop.buildingType === 'three_star_shop') {
          // Remote investment!
          const myStandardShops = Object.values(state.properties).filter(
            p => p.ownerId === PLAYER_ID && p.buildingType === undefined
          );

          return (
            <div style={{ ...consoleInnerPanelStyle, maxWidth: 520 }} className="animate-slide-up glow-border-success">
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '2px', color: '#10b981', marginBottom: 4 }}>
                {ownShop.buildingType === 'checkpoint' ? '🛃 CHECKPOINT STATION' : '⭐⭐⭐ 3-STAR SHOP CENTER'}
              </div>
              <div style={{ fontWeight: 800, fontSize: 17, color: '#f8fafc', marginBottom: 6 }}>
                Remote Shop Investment Portal
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>
                Standing on your {ownShop.buildingType === 'checkpoint' ? 'Checkpoint' : '3-Star Shop'} allows you to invest <strong>up to 100G</strong> remotely in any standard shop you own!
              </div>

              {myStandardShops.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', marginBottom: 16, maxHeight: '180px', overflowY: 'auto' }}>
                  {myStandardShops.map(p => {
                    const remaining = p.maxCapital - p.capitalInvested;
                    const maxAmt = Math.min(100, Math.min(remaining, currentPlayer.cash));
                    const canInvest = maxAmt > 0;
                    const progress = Math.min(100, (p.capitalInvested / p.maxCapital) * 100);

                    return (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'rgba(255, 255, 255, 0.01)',
                          border: '1px solid rgba(255, 255, 255, 0.03)',
                          borderRadius: 8,
                          padding: '8px 12px',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 800, fontSize: 12.5, color: '#f8fafc' }}>{p.id.toUpperCase()}</span>
                            <span style={{ fontSize: 10, color: '#64748b' }}>{state.districts[p.districtId]?.name}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
                              <div style={{ width: `${progress}%`, height: '100%', background: '#10b981', borderRadius: 2 }} />
                            </div>
                            <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: "'JetBrains Mono', monospace" }}>
                              {p.capitalInvested}/{p.maxCapital}G (Rent: {p.currentRent}G)
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 4 }}>
                          {canInvest && maxAmt >= 50 && (
                            <button
                              onClick={() => emitAction({ type: 'INVEST', propertyId: p.id, amount: 50 })}
                              disabled={!isMyTurn}
                              style={{ ...overlayBtn(true), padding: '4px 8px', fontSize: 10, background: 'rgba(255,255,255,0.04)', color: '#f8fafc' }}
                            >
                              +50G
                            </button>
                          )}
                          <button
                            onClick={() => emitAction({ type: 'INVEST', propertyId: p.id, amount: maxAmt })}
                            disabled={!isMyTurn || !canInvest}
                            style={{
                              ...overlayBtn(true),
                              padding: '4px 10px',
                              fontSize: 10,
                              background: canInvest ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(255,255,255,0.01)',
                            }}
                          >
                            Invest {maxAmt}G
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', marginBottom: 16, textAlign: 'center' }}>
                  No owned standard shops available for investment.
                </div>
              )}

              <button
                onClick={() => emitAction({ type: 'END_TURN' })}
                disabled={!isMyTurn}
                style={{ ...overlayBtn(false), width: '100%', maxWidth: 200 }}
              >
                Skip (End Turn)
              </button>
            </div>
          );
        }

        if (ownShop.buildingType === 'estate_agency') {
          // Remote property purchase!
          const unownedStandardProps = Object.values(state.properties).filter(
            p => p.ownerId === null && (p.buildingType === undefined || p.buildingType === 'vacant')
          );

          return (
            <div style={{ ...consoleInnerPanelStyle, maxWidth: 520 }} className="animate-slide-up glow-border-cyber">
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '2px', color: '#06b6d4', marginBottom: 4 }}>
                🏢 ESTATE AGENCY CONSOLE
              </div>
              <div style={{ fontWeight: 800, fontSize: 17, color: '#f8fafc', marginBottom: 6 }}>
                Remote Shop Purchase Bureau
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>
                Landed on your Estate Agency! You may remotely purchase **any** unowned property on the board:
              </div>

              {unownedStandardProps.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', marginBottom: 16, maxHeight: '180px', overflowY: 'auto' }}>
                  {unownedStandardProps.map(p => {
                    const cost = p.currentPrice;
                    const canAfford = currentPlayer.cash >= cost;

                    return (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'rgba(255, 255, 255, 0.01)',
                          border: '1px solid rgba(255, 255, 255, 0.03)',
                          borderRadius: 8,
                          padding: '8px 12px',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 800, fontSize: 12.5, color: '#f8fafc' }}>{p.id.toUpperCase()}</span>
                            <span style={{ fontSize: 10, color: '#64748b' }}>{state.districts[p.districtId]?.name}</span>
                          </div>
                          <span style={{ fontSize: 10.5, color: '#94a3b8' }}>
                            Price: <strong style={{ color: '#10b981' }}>{cost}G</strong> {p.buildingType === 'vacant' && <span style={{ color: '#cbd5e1', fontWeight: 600 }}>(Vacant Plot)</span>}
                          </span>
                        </div>

                        <button
                          onClick={() => emitAction({ type: 'BUY_PROPERTY', propertyId: p.id })}
                          disabled={!isMyTurn || !canAfford}
                          style={{
                            ...overlayBtn(true),
                            padding: '6px 12px',
                            fontSize: 10.5,
                            background: canAfford ? 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' : 'rgba(255,255,255,0.01)',
                          }}
                        >
                          Buy ({cost}G)
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic', marginBottom: 16, textAlign: 'center' }}>
                  No unowned properties remaining on the board!
                </div>
              )}

              <button
                onClick={() => emitAction({ type: 'END_TURN' })}
                disabled={!isMyTurn}
                style={{ ...overlayBtn(false), width: '100%', maxWidth: 200 }}
              >
                Skip (End Turn)
              </button>
            </div>
          );
        }

        if (ownShop.buildingType === 'balloonport') {
          // Teleport Grid!
          const allNodes = Object.values(state.board).filter(n => n.id !== nodeId);

          return (
            <div style={{ ...consoleInnerPanelStyle, maxWidth: 520 }} className="animate-slide-up glow-border-cyber">
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '2px', color: '#c084fc', marginBottom: 4 }}>
                🎈 BALLOONPORT FLIGHT DECK
              </div>
              <div style={{ fontWeight: 800, fontSize: 17, color: '#f8fafc', marginBottom: 6 }}>
                Select Your Flight Destination
              </div>
              <div style={{ fontSize: 12.5, color: '#cbd5e1', marginBottom: 14 }}>
                Standing on your Balloonport! You can remotely teleport to **any** location on the board immediately:
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, width: '100%', marginBottom: 16, maxHeight: '180px', overflowY: 'auto', paddingRight: 4 }}>
                {allNodes.map(n => {
                  const nodeLabel = n.id.replace(/_/g, ' ').toUpperCase();
                  let nodeDetails = n.type.toUpperCase();
                  if (n.type === 'property' || n.type === 'vacant') {
                    const prop = Object.values(state.properties).find(p => p.nodeId === n.id);
                    nodeDetails = prop ? `${state.districts[prop.districtId]?.name ?? ''}`.toUpperCase() : 'VACANT';
                  }

                  return (
                    <button
                      key={n.id}
                      onClick={() => emitAction({ type: 'TELEPORT', nodeId: n.id })}
                      disabled={!isMyTurn}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 2,
                        padding: '6px 12px',
                        borderRadius: 8,
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(192, 132, 252, 0.15)';
                        e.currentTarget.style.border = '1px solid rgba(192, 132, 252, 0.4)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                        e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.06)';
                      }}
                    >
                      <span style={{ fontSize: '11px', fontWeight: 800, color: '#f8fafc' }}>{nodeLabel}</span>
                      <span style={{ fontSize: '9px', color: '#64748b' }}>{nodeDetails}</span>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => emitAction({ type: 'END_TURN' })}
                disabled={!isMyTurn}
                style={{ ...overlayBtn(false), width: '100%', maxWidth: 200 }}
              >
                Skip Teleport (End Turn)
              </button>
            </div>
          );
        }
      }

      return (
        <ShopManagement
          state={state}
          property={ownShop}
          emitAction={emitAction}
          playerId={PLAYER_ID}
        />
      );
    }

    // 4. SPACE_ACTION: landing on vacant shop gives buy or skip inline
    if (unownedShop) {
      const isVacantPlotNode = unownedShop.buildingType !== undefined;
      if (isVacantPlotNode) {
        return (
          <div style={{ ...consoleInnerPanelStyle, maxWidth: 580 }} className="animate-slide-up glow-border-cyber">
            <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '2px', color: '#06b6d4', marginBottom: 4 }}>
              🏢 VACANT PLOT DEVELOPMENT
            </div>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#f8fafc', marginBottom: 6 }}>
              Select Structure to Build
            </div>
            <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 12 }}>
              Build cost: <strong>200G</strong> for standard structures, or <strong>1000G</strong> for a premium 3-Star Shop. Your cash: <strong style={{ color: '#10b981' }}>{g(currentPlayer.cash)}</strong>
            </div>

            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: 8, 
              width: '100%', 
              marginBottom: 16,
              maxHeight: '220px',
              overflowY: 'auto',
              paddingRight: 4
            }}>
              {([
                { type: 'checkpoint', name: 'Checkpoint', cost: 200, icon: '🛃', desc: 'Toll booth (charges toll; +10G toll per pass)' },
                { type: 'circus', name: 'Circus', cost: 200, icon: '🎪', desc: 'Flat rent tent (100G-2000G expanded via invest)' },
                { type: 'balloonport', name: 'Balloonport', cost: 200, icon: '🎈', desc: 'Allows owner to teleport to any node on landing' },
                { type: 'tax_office', name: 'Tax Office', cost: 200, icon: '🏛️', desc: 'Levies 10% visitor net worth; pays owner 5% bonus' },
                { type: 'home', name: 'Home', cost: 200, icon: '🏠', desc: 'Congregates all other players to this space' },
                { type: 'estate_agency', name: 'Estate Agency', cost: 200, icon: '🏢', desc: 'Enables remote purchase of unowned shops' },
                { type: 'three_star_shop', name: '3-Star Shop', cost: 1000, icon: '⭐⭐⭐', desc: 'Premium shop (80G rent, district counts, 2k max cap)' }
              ] as const).map(opt => {
                const canAffordOpt = currentPlayer.cash >= opt.cost;
                const buildDisabled = !isMyTurn || !canAffordOpt;

                return (
                  <div
                    key={opt.type}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      background: 'rgba(255, 255, 255, 0.01)',
                      border: '1px solid rgba(255, 255, 255, 0.03)',
                      borderRadius: 10,
                      padding: '10px',
                      justifyContent: 'space-between',
                      gap: 6,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13 }}>{opt.icon}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 800, color: '#f8fafc' }}>{opt.name}</span>
                        <span style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: '10.5px',
                          fontWeight: 700,
                          color: canAffordOpt ? '#10b981' : '#f43f5e',
                        }}>
                          ({opt.cost}G)
                        </span>
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b', marginTop: 2 }}>{opt.desc}</div>
                    </div>

                    <button
                      onClick={() => emitAction({ type: 'BUILD_PLOT', propertyId: unownedShop.id, buildingType: opt.type })}
                      disabled={buildDisabled}
                      style={{
                        width: '100%',
                        background: buildDisabled ? 'rgba(255,255,255,0.01)' : 'linear-gradient(135deg, #06b6d4 0%, #0ea5e9 100%)',
                        color: buildDisabled ? '#475569' : '#ffffff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '5px 0',
                        fontSize: '11px',
                        fontWeight: 800,
                        cursor: buildDisabled ? 'default' : 'pointer',
                        boxShadow: buildDisabled ? 'none' : '0 2px 6px rgba(6, 182, 212, 0.2)',
                        transition: 'all 0.2s',
                      }}
                    >
                      Build {opt.name}
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => emitAction({ type: 'END_TURN' })}
              disabled={!isMyTurn}
              style={{ ...overlayBtn(false), width: '100%', maxWidth: 200 }}
            >
              Skip (End Turn)
            </button>
          </div>
        );
      }

      const canAfford = currentPlayer.cash >= unownedShop.currentPrice;
      return (
        <div style={consoleInnerPanelStyle} className="animate-slide-up glow-border-cyber">
          <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '2px', color: '#06b6d4', marginBottom: 4 }}>
            🏬 VACANT PROPERTY ACQUISITION
          </div>
          <div style={{ fontWeight: 800, fontSize: 18, color: '#f8fafc', marginBottom: 6 }}>
            Shop {unownedShop.id.toUpperCase()}
            <span style={{ fontWeight: 600, color: '#64748b', marginLeft: 10, fontSize: 13 }}>
              {state.districts[unownedShop.districtId]?.name}
            </span>
          </div>
          
          <div style={{ 
            fontSize: 13, 
            color: '#cbd5e1', 
            marginBottom: 16,
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.03)',
            borderRadius: 10,
            padding: '10px 20px',
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div>Purchase Price: <strong style={{ color: '#10b981', fontFamily: "'JetBrains Mono', monospace" }}>{g(unownedShop.currentPrice)}</strong></div>
            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />
            <div>Your Cash Left: <span style={{ fontFamily: "'JetBrains Mono', monospace", color: canAfford ? '#10b981' : '#f43f5e', fontWeight: '700' }}>{g(currentPlayer.cash)}</span></div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={() => emitAction({ type: 'BUY_PROPERTY', propertyId: unownedShop.id })}
              disabled={!isMyTurn || !canAfford}
              style={{
                ...overlayBtn(true),
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
              }}
            >
              Acquire Shop
            </button>
            <button
              onClick={() => emitAction({ type: 'END_TURN' })}
              disabled={!isMyTurn}
              style={overlayBtn(false)}
            >
              Skip
            </button>
          </div>
          {!canAfford && isMyTurn && (
            <div style={{ color: '#f43f5e', fontSize: 11, fontWeight: 700, marginTop: 10, textAlign: 'center' }}>
              ❌ Insufficient cash to purchase property.
            </div>
          )}
        </div>
      );
    }

    // 5. SPACE_ACTION: landing on opponent shop pay rent/buyout inline
    if (opponentShop) {
      const canBuyout = currentPlayer.cash >= opponentShop.currentPrice * 5;
      return (
        <div style={consoleInnerPanelStyle} className="animate-slide-up glow-border-danger">
          <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '2.5px', color: '#f43f5e', marginBottom: 4 }}>
            🚨 OPPONENT LEVY OUTPOST 🚨
          </div>
          <div style={{ fontWeight: 800, fontSize: 16, color: '#f8fafc', marginBottom: 2 }}>
            Shop {opponentShop.id.toUpperCase()}
          </div>
          <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 10 }}>
            Owned by <strong style={{ color: '#cbd5e1' }}>
              {state.players[opponentShop.ownerId!]?.name ?? opponentShop.ownerId}
            </strong>
          </div>
          
          <div style={{ 
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 28, 
            fontWeight: 900, 
            color: '#f43f5e',
            textShadow: '0 0 12px rgba(244, 63, 94, 0.35)',
            marginBottom: 16,
          }}>
            RENT LEVY: {g(opponentShop.currentRent)}
          </div>
          
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={() => emitAction({ type: 'PAY_RENT', propertyId: opponentShop.id })}
              disabled={!isMyTurn}
              style={overlayBtn(false, true)}
            >
              Pay Rent
            </button>
            <button
              onClick={() => emitAction({ type: 'BUYOUT_PROPERTY', propertyId: opponentShop.id })}
              disabled={!isMyTurn || !canBuyout}
              style={{
                ...overlayBtn(true),
                background: canBuyout ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' : 'rgba(255,255,255,0.02)',
                boxShadow: canBuyout ? '0 4px 12px rgba(139, 92, 246, 0.3)' : 'none',
              }}
            >
              Force Buyout ({g(opponentShop.currentPrice * 5)})
            </button>
          </div>
          
          {canBuyout && isMyTurn && (
            <div style={{ color: '#10b981', fontSize: 11, fontWeight: 700, marginTop: 10, textAlign: 'center' }}>
              ✨ Force buyout available! Cleanly buyout this shop for 5x base price.
            </div>
          )}
        </div>
      );
    }

    // 6. SPACE_ACTION: bank/broker trading desk inline
    if (atBroker) {
      return (
        <div style={{ ...consoleInnerPanelStyle, maxWidth: 520 }} className="animate-slide-up">
          <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '2px', color: '#06b6d4', marginBottom: 4 }}>
            🏦 BROKERAGE REGISTRATION DESK
          </div>
          <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: 18, marginBottom: 6 }}>
            {node?.type === 'bank' ? 'Bank Stock Brokerage' : 'District Stockbroker'}
          </div>
          <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 14 }}>
            Buy shares in blocks of 10. Cash Available: <strong style={{ color: '#10b981', fontFamily: "'JetBrains Mono', monospace" }}>{g(currentPlayer.cash)}</strong>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', marginBottom: 16 }}>
            {Object.values(state.districts).map(d => {
              const cost10 = d.stockPrice * 10;
              const canAfford = currentPlayer.cash >= cost10;
              return (
                <div 
                  key={d.id} 
                  style={{
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 10,
                    background: 'rgba(0, 0, 0, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.04)',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: d.id === 'd1' ? '#05f5ce' : '#a855f7',
                      }} />
                      <span style={{ fontWeight: 700, fontSize: 12.5, color: '#f8fafc' }}>{d.name}</span>
                    </div>
                    <span style={{ fontSize: 10, color: '#64748b', fontFamily: "'JetBrains Mono', monospace", marginLeft: 12 }}>{g(d.stockPrice)}/sh</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => emitAction({ type: 'BUY_STOCK', districtId: d.id, shares: 10 })}
                      disabled={!isMyTurn || !canAfford}
                      style={{
                        ...overlayBtn(true),
                        padding: '4px 10px', 
                        fontSize: 10.5,
                      }}
                    >
                      +10 ({g(cost10)})
                    </button>
                    <button
                      onClick={() => emitAction({ type: 'BUY_STOCK', districtId: d.id, shares: 99 })}
                      disabled={!isMyTurn || currentPlayer.cash < d.stockPrice * 99}
                      style={{
                        ...overlayBtn(true),
                        padding: '4px 10px', 
                        fontSize: 10.5,
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.2)',
                      }}
                    >
                      +99 ({g(d.stockPrice * 99)})
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          
          <button
            onClick={() => emitAction({ type: 'END_TURN' })}
            disabled={!isMyTurn}
            style={{ ...overlayBtn(false), width: '100%', maxWidth: 200, padding: '8px 0' }}
          >
            Done Trading
          </button>
        </div>
      );
    }

    // 7. SPACE_ACTION: Venture space 8x8 grid card selection inline
    if (showVentureGrid) {
      return (
        <div style={{ ...consoleInnerPanelStyle, maxWidth: 480 }} className="animate-slide-up">
          <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '2px', color: '#facc15', marginBottom: 4 }}>
            🔮 VENTURE MATRIX BOARD
          </div>
          <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: 17, marginBottom: 4 }}>
            Venture Cards Grid
          </div>
          <div style={{ fontSize: 12, color: '#cbd5e1', marginBottom: 12 }}>
            {!isMyTurn ? (
              <span style={{ color: '#06b6d4', fontWeight: 600 }}>
                Waiting for {state.players[state.currentPlayerId]?.name} to choose card…
              </span>
            ) : (
              'Select a card coordinate from the grid below to reveal a venture telex!'
            )}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8, 1fr)',
            gap: 5,
            justifyContent: 'center',
            alignItems: 'center',
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.04)',
            borderRadius: 10,
            padding: 8,
            marginBottom: 12,
            pointerEvents: isMyTurn ? 'auto' : 'none',
          }}>
            {ventureGrid.map((cell, cardIndex) => {
              const cleared = cell.cleared;
              const cellPlayerId = cell.playerId;

              if (cleared) {
                const cellColor = getPlayerColor(cellPlayerId);
                const cellInitials = getPlayerInitials(cellPlayerId);
                return (
                  <div
                    key={cardIndex}
                    style={{
                      width: 38,
                      height: 38,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 900,
                      backgroundColor: `${cellColor}15`,
                      border: `1px solid ${cellColor}`,
                      color: cellColor,
                      borderRadius: 6,
                    }}
                  >
                    {cellInitials}
                  </div>
                );
              } else {
                return (
                  <button
                    key={cardIndex}
                    onClick={() => emitAction({ type: 'CHOOSE_VENTURE_CARD', cardIndex })}
                    disabled={!isMyTurn}
                    style={{
                      width: 38,
                      height: 38,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'radial-gradient(circle, #1a1a36 0%, #0a0a14 100%)',
                      border: '1px solid rgba(250, 204, 21, 0.25)',
                      borderRadius: 6,
                      color: '#facc15',
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: isMyTurn ? 'pointer' : 'default',
                      outline: 'none',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
                    }}
                    className="venture-grid-card"
                  >
                    ?
                  </button>
                );
              }
            })}
          </div>

          <div style={{
            fontSize: 9.5,
            color: '#64748b',
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%',
            background: 'rgba(255, 255, 255, 0.01)',
            border: '1px solid rgba(255, 255, 255, 0.03)',
            borderRadius: 6,
            padding: '6px 12px',
          }}>
            <span>GRID ROW BONUS (4-8 matches):</span>
            <span style={{ color: '#facc15', fontWeight: 700 }}>40G - 200G</span>
          </div>
        </div>
      );
    }

    // 8. Passive / Waiting / Turn control panel (Default View when no actions are required)
    return (
      <div style={consoleInnerPanelStyle} className="animate-fade-in">
        <div style={{ display: 'flex', gap: 48, alignItems: 'center', justifyContent: 'center', width: '100%', flexWrap: 'wrap' }}>
          {/* Live Ticker Screen */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '1px', color: '#64748b' }}>
              ✦ MARKET INDEX TELEMETRY
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {Object.values(state.districts).map(d => (
                <div 
                  key={d.id} 
                  style={{
                    background: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid rgba(255, 255, 255, 0.04)',
                    borderRadius: 8,
                    padding: '6px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    minWidth: '90px',
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, color: d.id === 'd1' ? '#05f5ce' : '#a855f7' }}>{d.name}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, fontWeight: 700, color: '#f8fafc', marginTop: 2 }}>
                    {g(d.stockPrice)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Turn Status Tracker */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '1px', color: '#64748b' }}>
              ✦ FLIGHT ENGINE STATUS
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255, 255, 255, 0.04)', borderRadius: 8, padding: '7px 16px' }}>
              <div style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                border: '2px solid #8b5cf6',
                borderTopColor: 'transparent',
                animation: 'spin 1.2s linear infinite',
              }} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#cbd5e1', letterSpacing: '0.5px' }}>
                {isMyTurn ? 'RESOLVING PREVIOUS ACTION ENGINE...' : `WAITING FOR ${currentPlayer?.name?.toUpperCase()} TO ACT...`}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      width: '100%', 
      height: '100vh', 
      background: '#06060c',
      overflow: 'hidden'
    }}>
      {/* 1. Header Bar */}
      <header style={{
        height: '55px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        background: 'rgba(8, 8, 16, 0.65)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        zIndex: 40,
        flexShrink: 0,
      }}>
        {/* Game Title Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: '#8b5cf6',
            boxShadow: '0 0 10px #8b5cf6',
          }} />
          <span style={{
            fontSize: '15px',
            fontWeight: 900,
            letterSpacing: '2.5px',
            background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            BANKRUPT STREET
          </span>
        </div>

        {/* Phase Status Banner Ticker */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.05)',
          padding: '4px 12px',
          borderRadius: 20,
        }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b' }}>STATION DESK:</span>
          <span style={{
            fontSize: 10.5,
            fontWeight: 800,
            letterSpacing: '0.8px',
            color: phase === 'SPACE_ACTION' ? '#f43f5e' : '#06b6d4',
            textTransform: 'uppercase',
          }}>
            {phase.replace('_', ' ')}
          </span>
        </div>

        {/* Pulsing Roll Badge */}
        {state.lastRoll && state.lastRoll[state.currentPlayerId] !== undefined && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            padding: '4px 12px',
            borderRadius: 20,
            boxShadow: '0 0 10px rgba(245, 158, 11, 0.15)',
          }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: '#f59e0b' }}>🎲 ROLLED:</span>
            <span style={{
              fontSize: 12,
              fontWeight: 900,
              color: '#ffffff',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {state.lastRoll[state.currentPlayerId]}
            </span>
          </div>
        )}

        {/* Stock Matrix Button */}
        <button
          onClick={() => setShowStockMatrix(true)}
          style={{
            background: 'rgba(139, 92, 246, 0.1)',
            border: '1px solid rgba(139, 92, 246, 0.25)',
            padding: '5px 14px',
            borderRadius: 20,
            cursor: 'pointer',
            fontSize: 10.5,
            fontWeight: 800,
            color: '#c084fc',
            letterSpacing: '0.8px',
            textTransform: 'uppercase',
            boxShadow: '0 0 10px rgba(139, 92, 246, 0.15)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.2)';
            e.currentTarget.style.border = '1px solid rgba(139, 92, 246, 0.4)';
            e.currentTarget.style.boxShadow = '0 0 15px rgba(139, 92, 246, 0.35)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
            e.currentTarget.style.border = '1px solid rgba(139, 92, 246, 0.25)';
            e.currentTarget.style.boxShadow = '0 0 10px rgba(139, 92, 246, 0.15)';
          }}
        >
          📊 Stock Holdings Matrix
        </button>

        {/* User Identity tag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: '#64748b' }}>PILOT CARD:</span>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: `${getPlayerColor(PLAYER_ID)}18`,
            border: `1px solid ${getPlayerColor(PLAYER_ID)}40`,
            padding: '3px 10px',
            borderRadius: 6,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: getPlayerColor(PLAYER_ID), boxShadow: `0 0 6px ${getPlayerColor(PLAYER_ID)}` }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: '#ffffff' }}>
              {state.players[PLAYER_ID]?.name ?? PLAYER_ID}
            </span>
          </div>
        </div>
      </header>

      {/* 2. Main Workspace Row (Board + Controls on Left, Sidebar HUD on Right) */}
      <div style={{ 
        display: 'flex', 
        flex: 1, 
        width: '100%', 
        overflow: 'hidden'
      }}>
        {/* Left Workspace (Board Frame + dynamic Console Area) */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
        }}>
          {/* Board Display Screen (Framed in rich arcade layout) */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.45)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexShrink: 0,
          }}>
            <div style={{
              width: '100%',
              maxWidth: '1040px',
              borderRadius: '16px',
              overflow: 'hidden',
              border: '1px solid rgba(139, 92, 246, 0.15)',
              boxShadow: 'inset 0 0 20px rgba(139, 92, 246, 0.05), 0 4px 30px rgba(0, 0, 0, 0.7)',
            }}>
              <Board socket={socket} state={state} hoveredNodeId={hoveredNodeId} />
            </div>
          </div>

          {/* Operations & Action Console at bottom */}
          <div style={{
            flex: 1,
            background: 'radial-gradient(circle at 50% 10%, #0d0d1e 0%, #06060c 100%)',
            padding: '16px 24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            {renderConsoleContent()}
          </div>
        </div>

        {/* Right HUD Sidebar column (fixed 320px width) */}
        <div style={{
          width: '320px',
          height: '100%',
          flexShrink: 0,
        }}>
          <PlayerStats state={state} playerId={PLAYER_ID} />
        </div>
      </div>
      
      {/* 3. High-Priority Narrative Venture Card Typewriter Overlay */}
      {showVentureCard && state.activeVentureCard && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(3, 3, 8, 0.85)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          zIndex: 150,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            background: 'rgba(12, 12, 26, 0.95)',
            border: '2px solid rgba(250, 204, 21, 0.4)',
            borderRadius: 24,
            padding: '30px 36px',
            maxWidth: 420,
            textAlign: 'center',
            fontFamily: "'Outfit', sans-serif",
            color: '#f1f5f9',
            boxShadow: '0 0 40px rgba(250, 204, 21, 0.15), 0 25px 50px rgba(0, 0, 0, 0.8)',
            position: 'relative',
            overflow: 'hidden',
          }} className="animate-slide-up">
            {/* Elegant glowing top-border bar */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: 'linear-gradient(90deg, #facc15 0%, #eab308 100%)',
            }} />

            {/* Header with Card Number */}
            <div style={{
              fontSize: 10.5,
              fontWeight: 800,
              letterSpacing: '2px',
              color: '#facc15',
              textTransform: 'uppercase',
              marginBottom: 10,
            }}>
              🔮 VENTURE CARD #{state.activeVentureCard.number} 🔮
            </div>

            {/* Card Title */}
            <div style={{
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: '1px',
              background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: 14,
              textTransform: 'uppercase',
            }}>
              {state.activeVentureCard.title}
            </div>

            {/* Narrative / Typewriter Text Box */}
            <div style={{
              background: 'radial-gradient(circle, #090918 0%, #030308 100%)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              borderRadius: 16,
              padding: '16px 20px',
              marginBottom: 16,
              textAlign: 'center',
              boxShadow: 'inset 0 4px 15px rgba(0,0,0,0.6)',
            }}>
              <p style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 13,
                lineHeight: '1.6',
                color: '#cbd5e1',
                margin: 0,
                letterSpacing: '0.2px',
              }}>
                {state.activeVentureCard.text}
              </p>
            </div>

            {/* Payout/Effect Highlight Box */}
            <div style={{
              ...(() => {
                const effectStyle = (() => {
                  const type = state.activeVentureCard!.effectType;
                  if (['CASH_GAIN', 'STOCK_GAIN', 'STOCK_BUFF', 'SUIT_GIFT', 'ROLL_AGAIN', 'PROP_BUFF', 'SHOP_MULTIPLIER_BONUS', 'SUIT_HEART_OR_CASH', 'STOCK_DIVIDEND_10', 'STOCK_DIVIDEND_20', 'COMMISSION_TEMP'].includes(type)) {
                    return {
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      bg: 'rgba(16, 185, 129, 0.05)',
                      shadow: '0 0 12px rgba(16, 185, 129, 0.15)',
                    };
                  } else {
                    return {
                      color: '#f43f5e',
                      border: '1px solid rgba(244, 63, 94, 0.2)',
                      bg: 'rgba(244, 63, 94, 0.05)',
                      shadow: '0 0 12px rgba(244, 63, 94, 0.15)',
                    };
                  }
                })();
                return {
                  padding: '10px 16px',
                  borderRadius: 12,
                  color: effectStyle.color,
                  border: effectStyle.border,
                  background: effectStyle.bg,
                  boxShadow: effectStyle.shadow,
                  fontSize: 12.5,
                  fontWeight: 700,
                  marginBottom: 20,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                };
              })()
            }}>
              <span>✦</span>
              <span>
                {(() => {
                  const type = state.activeVentureCard!.effectType;
                  if (type === 'CASH_GAIN') return `Cash Received: +${state.activeVentureCard!.payout}G`;
                  if (type === 'CASH_LOSS') return `Cash Paid Out: -${state.activeVentureCard!.title === 'Income Tax' ? 100 : 150}G`;
                  if (type === 'STOCK_GAIN') return `District Shares Awarded: +5 Shares`;
                  if (type === 'STOCK_BUFF') return `Stock Boom Triggered!`;
                  if (type === 'STOCK_SLUMP') return `Stock Market Crash!`;
                  if (type === 'SUIT_GIFT') return `Missing Suit Granted!`;
                  if (type === 'WARP_BANK') return `Teleport to Bank Activated`;
                  if (type === 'WARP_VACANT') return `Warp to Vacant Property`;
                  if (type === 'ROLL_AGAIN') return `EXTRA TURN GRANTED! ROLL AGAIN`;
                  if (type === 'PROP_BUFF') return `Shop Base Value Boosted!`;
                  if (type === 'SHOP_MULTIPLIER_BONUS') return `Shop Owner Gold Bonus Paid!`;
                  if (type === 'SUIT_HEART_OR_CASH') return `Gift Received!`;
                  if (type === 'CASH_PERCENT_LOSS') return `Drop Wallet: -10% Cash Paid Out!`;
                  if (type === 'STOCK_DIVIDEND_10') return `10% Stock Dividend Received!`;
                  if (type === 'STOCK_DIVIDEND_20') return `20% Stock Dividend Received!`;
                  if (type === 'DICEY_CLOSED') return `Dicey Adventure Rolled!`;
                  if (type === 'HALF_RENT_TEMP') return `Temporary Shop Clearance Special!`;
                  if (type === 'COMMISSION_TEMP') return `50% Commission Bonus Activated!`;
                  return 'Active Effect Applied';
                })()}
              </span>
              <span>✦</span>
            </div>

            {/* Action button: OK or Waiting */}
            {isMyTurn ? (
              <button
                onClick={() => emitAction({ type: 'END_TURN' })}
                style={{
                  ...overlayBtn(true),
                  width: '100%',
                  padding: '12px 0',
                  fontSize: 13.5,
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  background: 'linear-gradient(135deg, #facc15 0%, #eab308 100%)',
                  color: '#0c0c1a',
                  boxShadow: '0 4px 15px rgba(250, 204, 21, 0.35)',
                }}
              >
                Acknowledge Card
              </button>
            ) : (
              <div style={{
                color: '#64748b',
                fontSize: 12,
                fontStyle: 'italic',
                fontWeight: 600,
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid rgba(255, 255, 255, 0.03)',
                borderRadius: 12,
                padding: '10px 0',
              }}>
                ⏳ Waiting for {state.players[state.currentPlayerId]?.name} to acknowledge…
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Game Over Overlay Screen */}
      {state.winnerId && (
        <div style={{
          position: 'fixed', 
          inset: 0,
          background: 'rgba(3, 3, 8, 0.9)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            background: 'rgba(12, 12, 26, 0.85)',
            border: '2px dashed #facc15',
            borderRadius: 24, 
            padding: '36px 40px', 
            maxWidth: 450,
            textAlign: 'center', 
            fontFamily: "'Outfit', sans-serif", 
            color: '#f1f5f9',
            boxShadow: '0 0 50px rgba(250, 204, 21, 0.25)',
          }} className="animate-slide-up">
            <div style={{ fontSize: 32, marginBottom: 8 }}>👑</div>
            <div style={{ 
              fontSize: 24, 
              fontWeight: 900, 
              background: 'linear-gradient(135deg, #facc15 0%, #eab308 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: 8,
              letterSpacing: '1px',
            }}>
              Victory Achieved
            </div>
            
            <div style={{ fontSize: 15, color: '#94a3b8', marginBottom: 18 }}>
              The district has been thoroughly liquidated.
            </div>

            <div style={{
              background: 'rgba(250, 204, 21, 0.04)',
              border: '1px solid rgba(250, 204, 21, 0.2)',
              borderRadius: 16,
              padding: '14px 20px',
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#facc15', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>WINNER</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#ffffff' }}>
                {state.players[state.winnerId]?.name}
              </div>
              <div style={{ 
                fontFamily: "'JetBrains Mono', monospace", 
                fontSize: 15, 
                fontWeight: 700, 
                color: '#10b981',
                marginTop: 4,
              }}>
                {g(state.players[state.winnerId]?.netWorth)}
              </div>
            </div>

            <div style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>
              Close this window to return to setup room.
            </div>
          </div>
        </div>
      )}

      {/* 5. Stock Holdings Matrix Modal Overlay */}
      {showStockMatrix && state && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(3, 3, 8, 0.8)',
          backdropFilter: 'blur(15px)',
          WebkitBackdropFilter: 'blur(15px)',
          zIndex: 140,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}>
          <div style={{
            background: 'rgba(12, 12, 26, 0.95)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 20,
            padding: '24px 30px',
            width: '100%',
            maxWidth: 680,
            color: '#f8fafc',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(139, 92, 246, 0.1)',
            fontFamily: "'Outfit', sans-serif"
          }} className="animate-slide-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: '1px', background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                📊 DISTRICT STOCK HOLDINGS MATRIX
              </h3>
              <button 
                onClick={() => setShowStockMatrix(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  fontSize: 14,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(244, 63, 94, 0.2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
              >
                ✕
              </button>
            </div>
            
            <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.05)', background: 'rgba(0,0,0,0.2)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <th style={{ padding: '12px 16px', color: '#94a3b8', fontWeight: 700 }}>District (Price)</th>
                    {state.turnOrder.map(pId => {
                      const p = state.players[pId];
                      const idx = state.turnOrder.indexOf(pId);
                      const color = ['#ff4e50', '#00f2fe', '#a855f7', '#facc15'][idx >= 0 ? idx % 4 : 0];
                      return (
                        <th key={pId} style={{ padding: '12px 16px', color: color, fontWeight: 800 }}>
                          {p?.name ?? pId}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {Object.values(state.districts).map((dist, rIdx) => {
                    const getThemeColor = (dId: string) => {
                      const colors: Record<string, string> = {
                        tantegel: '#3b82f6',
                        garinham: '#10b981',
                        kol:      '#06b6d4',
                        domdora:  '#f59e0b',
                        cantlin:  '#ef4444',
                        rimuldar: '#8b5cf6',
                        charlock: '#ec4899',
                        bridges:  '#64748b',
                      };
                      return colors[dId] ?? '#a855f7';
                    };
                    return (
                      <tr key={dist.id} style={{ 
                        borderBottom: rIdx === Object.values(state.districts).length - 1 ? 'none' : '1px solid rgba(255, 255, 255, 0.03)',
                        background: rIdx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent'
                      }}>
                        <td style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: getThemeColor(dist.id) }} />
                          <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{dist.name}</span>
                          <span style={{ color: '#10b981', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: 4, marginLeft: 4 }}>
                            {dist.stockPrice}G
                          </span>
                        </td>
                        {state.turnOrder.map(pId => {
                          const count = dist.playerHoldings[pId] ?? 0;
                          return (
                            <td key={pId} style={{ padding: '14px 16px', fontFamily: "'JetBrains Mono', monospace", fontWeight: count > 0 ? '700' : 'normal', color: count > 0 ? '#f8fafc' : '#475569' }}>
                              {count > 0 ? `${count} sh` : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div style={{ marginTop: 20, fontSize: 11.5, color: '#64748b', textAlign: 'center' }}>
              💡 Stocks pay dividends and boost district capitalization values when properties are upgraded.
            </div>
          </div>
        </div>
      )}

      {/* Retro/Cyber hover and click transitions */}
      <style>{`
        .venture-grid-card:hover {
          transform: translateY(-2px) scale(1.05);
          border-color: rgba(250, 204, 21, 0.8) !important;
          box-shadow: 0 0 12px rgba(250, 204, 21, 0.5) !important;
          text-shadow: 0 0 6px rgba(250, 204, 21, 0.8) !important;
          background: radial-gradient(circle, #252542 0%, #0d0d1e 100%) !important;
        }
        .venture-grid-card:active {
          transform: translateY(0px) scale(0.95);
        }
      `}</style>
    </div>
  );
}

// Visual layout console Inner panel styles
const consoleInnerPanelStyle: React.CSSProperties = {
  background: 'rgba(10, 10, 22, 0.65)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255, 255, 255, 0.05)',
  borderRadius: 16,
  padding: '20px 24px',
  width: '100%',
  maxWidth: '460px',
  textAlign: 'center',
  fontFamily: "'Outfit', sans-serif",
  color: '#f1f5f9',
  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};
