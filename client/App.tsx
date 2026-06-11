import { useState, useEffect, useRef } from 'react';
import type { Action } from '../shared/types';
import { Board } from './Board';
import { PlayerStats } from './modals/PlayerStats';
import { StockExchange } from './modals/StockExchange';
import { ShopManagement } from './modals/ShopManagement';
import { CHARACTERS } from '../shared/characters';
import { Rules } from './modals/Rules';
import { districtColorHex } from './districtColors';
import { sfx, isMuted, setMuted } from './sfx';
import type { CasinoResult } from '../shared/types';
import { useGameSocket } from './useGameSocket';

function g(n: number) { return `${n}G`; }

// ─── Dice overlay ─────────────────────────────────────────────────────────────

// Pip positions on a 3x3 grid for each die face.
const PIP_MAP: Record<number, number[]> = {
  1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

function DiceOverlay({ roll }: { roll: number }) {
  const [face, setFace] = useState(1 + Math.floor(Math.random() * 6));
  const [phase, setPhase] = useState<'rolling' | 'settled' | 'gone'>('rolling');

  useEffect(() => {
    const iv = setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 75);
    const t1 = setTimeout(() => { clearInterval(iv); setFace(roll); setPhase('settled'); }, 700);
    const t2 = setTimeout(() => setPhase('gone'), 2100);
    return () => { clearInterval(iv); clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === 'gone') return null;
  return (
    <div style={{
      position: 'fixed',
      top: 86,
      left: 'calc(50% - 160px)',
      transform: 'translateX(-50%)',
      zIndex: 90,
      pointerEvents: 'none',
      animation: phase === 'settled' ? 'dice-fade 0.4s ease-in 1s forwards' : undefined,
    }}>
      <div style={{
        width: 62,
        height: 62,
        borderRadius: 14,
        background: 'linear-gradient(160deg, #ffffff 0%, #dbe3ee 100%)',
        boxShadow: phase === 'settled'
          ? '0 0 0 3px rgba(253, 224, 71, 0.85), 0 0 28px rgba(253, 224, 71, 0.5), 0 10px 24px rgba(0,0,0,0.55)'
          : '0 10px 24px rgba(0,0,0,0.55)',
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'repeat(3, 1fr)',
        padding: 9,
        gap: 2,
        animation: phase === 'rolling' ? 'dice-shake 0.22s linear infinite' : 'dice-settle 0.35s ease-out',
      }}>
        {face <= 6 ? Array.from({ length: 9 }).map((_, i) => (
          <span key={i} style={{
            borderRadius: '50%',
            background: PIP_MAP[face]?.includes(i) ? '#101426' : 'transparent',
            margin: 1,
          }} />
        )) : (
          <span style={{
            gridColumn: '1 / -1', gridRow: '1 / -1', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 900, color: '#101426',
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {face}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Casino ───────────────────────────────────────────────────────────────────

const SLIMES = [
  { emoji: '💧', name: 'Azure Streak', color: '#38bdf8' },
  { emoji: '🔥', name: 'Ember Dash', color: '#fb923c' },
  { emoji: '🌸', name: 'Rose Bounce', color: '#f472b6' },
  { emoji: '🤖', name: 'Metal Bullet', color: '#94a3b8' },
];

const CARD_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const cardLabel = (n?: number) => (n ? CARD_LABELS[n - 1] ?? String(n) : '?');

// Deterministic lane finish times: the winner crosses first, the rest straggle.
function derbyLaneDuration(lane: number, winner: number): number {
  if (lane === winner) return 2.0;
  return 2.45 + ((lane * 7 + winner * 3) % 4) * 0.22;
}

function CasinoResultView({ result, canAct, onEndTurn }: {
  result: CasinoResult;
  canAct: boolean;
  onEndTurn: () => void;
}) {
  const [go, setGo] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setGo(true), 200);
    const t2 = setTimeout(() => setRevealed(true), result.game === 'derby' ? 2700 : 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // Run once per result (parent keys this component by the result signature)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const banner = revealed && (
    <div style={{
      marginTop: 12,
      padding: '10px 24px',
      borderRadius: 12,
      textAlign: 'center',
      fontWeight: 900,
      fontSize: 16,
      letterSpacing: '1px',
      color: result.won ? '#0c0a02' : '#fecaca',
      background: result.won
        ? 'linear-gradient(135deg, #fde047 0%, #f59e0b 100%)'
        : 'rgba(127, 29, 29, 0.55)',
      border: result.won ? 'none' : '1px solid rgba(248, 113, 113, 0.4)',
      animation: result.won ? 'casino-win-flash 0.7s ease-out forwards' : 'casino-lose-thud 0.5s ease-out forwards',
    }}>
      {result.won ? `🏆 JACKPOT! +${g(result.payout - result.wager)}` : `💸 House wins — ${g(result.wager)} gone`}
    </div>
  );

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {result.game === 'derby' ? (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SLIMES.map((s, i) => {
            const picked = Number(result.choice) === i;
            const isWinner = result.winnerSlime === i;
            return (
              <div key={i} style={{
                position: 'relative',
                height: 30,
                borderRadius: 8,
                background: picked ? 'rgba(250, 204, 21, 0.06)' : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${picked ? 'rgba(250, 204, 21, 0.35)' : 'rgba(255, 255, 255, 0.05)'}`,
                overflow: 'hidden',
              }}>
                {/* Finish line */}
                <div style={{
                  position: 'absolute', right: 34, top: 0, bottom: 0, width: 3,
                  background: 'repeating-linear-gradient(0deg, #f8fafc 0 4px, #0f172a 4px 8px)',
                  opacity: 0.5,
                }} />
                <span style={{
                  position: 'absolute',
                  top: 2,
                  left: go ? 'calc(100% - 30px)' : '4px',
                  transition: `left ${derbyLaneDuration(i, result.winnerSlime ?? 0)}s cubic-bezier(0.3, 0.6, 0.6, 1)`,
                  fontSize: 17,
                  display: 'inline-block',
                  animation: !revealed ? 'slime-hop 0.4s ease-in-out infinite' : undefined,
                }}>
                  {s.emoji}{revealed && isWinner ? '👑' : ''}
                </span>
                <span style={{
                  position: 'absolute', left: 8, top: 8, fontSize: 9, fontWeight: 800,
                  letterSpacing: '0.5px', color: s.color, opacity: 0.85,
                }}>
                  {s.name.toUpperCase()}{picked ? ' ★' : ''}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', padding: '6px 0' }}>
          {/* Dealt card */}
          <div style={{
            width: 64, height: 88, borderRadius: 10, background: '#f8fafc',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30, fontWeight: 900, color: '#0f172a',
            boxShadow: '0 6px 16px rgba(0,0,0,0.5)',
          }}>
            {cardLabel(result.card1)}
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#94a3b8', letterSpacing: '1px' }}>
            {result.choice === 'high' ? '⬆ HIGHER' : '⬇ LOWER'}
          </div>
          {/* Flipping card */}
          <div style={{ width: 64, height: 88, perspective: 400 }}>
            <div className={`casino-card-flip${go ? ' flipped' : ''}`} style={{ position: 'relative', width: '100%', height: '100%' }}>
              <div style={{
                position: 'absolute', inset: 0, borderRadius: 10, backfaceVisibility: 'hidden',
                background: 'linear-gradient(135deg, #581c87 0%, #86198f 100%)',
                border: '2px solid rgba(250, 204, 21, 0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
              }}>
                🎰
              </div>
              <div style={{
                position: 'absolute', inset: 0, borderRadius: 10, backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)', background: '#f8fafc',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 30, fontWeight: 900, color: result.won ? '#15803d' : '#b91c1c',
                boxShadow: '0 6px 16px rgba(0,0,0,0.5)',
              }}>
                {cardLabel(result.card2)}
              </div>
            </div>
          </div>
        </div>
      )}

      {banner}

      <button
        onClick={onEndTurn}
        disabled={!canAct}
        style={{
          marginTop: 12,
          padding: '8px 28px',
          borderRadius: 10,
          fontFamily: "'Outfit', sans-serif",
          fontWeight: 700,
          fontSize: 12.5,
          cursor: canAct ? 'pointer' : 'default',
          opacity: canAct ? 1 : 0.5,
          background: revealed && result.won
            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
            : 'rgba(255, 255, 255, 0.06)',
          color: '#ffffff',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        {revealed ? (result.won ? 'Collect & Continue' : 'Shuffle Out') : 'Skip — End Turn'}
      </button>
    </div>
  );
}

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
  const [stockQty, setStockQty] = useState<Record<string, number>>({});
  const [debtSellQty, setDebtSellQty] = useState<Record<string, number>>({});
  const [casinoWager, setCasinoWager] = useState(100);
  const [diceAnim, setDiceAnim] = useState<{ roll: number; key: number } | null>(null);
  const [sfxOn, setSfxOn] = useState(!isMuted());
  const prevRollSigRef = useRef('');
  const lastLogLineRef = useRef<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Main menu inputs
  const [playerNameInput, setPlayerNameInput] = useState(() => localStorage.getItem('playerName') ?? '');
  const [newRoomName, setNewRoomName] = useState('');
  const [targetNetWorth, setTargetNetWorth] = useState(15000);
  const [boardChoice, setBoardChoice] = useState('alefgard');
  const [characterChoice, setCharacterChoice] = useState('erdrick');
  const [bankruptcyChoice, setBankruptcyChoice] = useState(1);

  useEffect(() => {
    pendingActionRef.current = false;
    setPendingAction(false);
  }, [state]);

  // Dice overlay: animate whenever the active player's roll changes.
  useEffect(() => {
    if (!state?.lastRoll) return;
    const pid = state.currentPlayerId;
    const roll = state.lastRoll[pid];
    if (roll === undefined) return;
    const sig = `${pid}:${roll}:${state.round}`;
    const first = prevRollSigRef.current === '';
    if (prevRollSigRef.current === sig) return;
    prevRollSigRef.current = sig;
    if (first) return;  // don't animate a stale roll on reconnect
    setDiceAnim({ roll, key: Date.now() });
    sfx.dice();
  }, [state?.lastRoll, state?.currentPlayerId, state?.round]);

  // Sound effects: play one cue per state update based on fresh log entries.
  useEffect(() => {
    const log = state?.log;
    if (!log || log.length === 0) return;
    const last = log[log.length - 1];
    if (lastLogLineRef.current === null) { lastLogLineRef.current = last; return; }
    if (lastLogLineRef.current === last) return;
    // Entries appended since the previously seen tail (log is trim-capped, so
    // search from the end; fall back to just the newest entry).
    let from = log.lastIndexOf(lastLogLineRef.current);
    if (from === -1) from = log.length - 2;
    const fresh = log.slice(from + 1);
    lastLogLineRef.current = last;

    const pick = (tests: Array<[(l: string) => boolean, () => void]>): (() => void) | null => {
      for (const [match, play] of tests) {
        if (fresh.some(match)) return play;
      }
      return null;
    };
    const cue = pick([
      [l => l.startsWith('[WIN]'), sfx.jackpot],
      [l => l.startsWith('[BANKRUPT]') || l.startsWith('[DEBT]') || l.startsWith('[DISTRESS]'), sfx.alert],
      [l => l.startsWith('[CASINO]') && l.includes('Paid'), sfx.jackpot],
      [l => l.startsWith('[CASINO]'), sfx.lose],
      [l => l.startsWith('[SALARY]'), sfx.salary],
      [l => l.includes('collected') && l.includes('suit'), sfx.salary],
      [l => l.startsWith('[RENT]') || l.startsWith('[TAX]') || l.startsWith('[CHECKPOINT]'), sfx.pay],
      [l => l.startsWith('[BUY') || l.startsWith('[STOCK]') || l.startsWith('[INVEST]') || l.startsWith('[DIVIDEND]') || l.startsWith('[BREAK]'), sfx.coin],
    ]);
    cue?.();
  }, [state?.log]);

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
    const stakes = [8000, 10000, 12000, 15000, 20000];
    const boards = [
      { id: 'alefgard', name: 'Alefgard', icon: '🏰', blurb: 'The classic loop — warp pipes to Charlock island', target: 8000 },
      { id: 'torland', name: 'Torland', icon: '🌊', blurb: 'One-way river rapids, tax office, the seaside oasis', target: 15000 },
      { id: 'aliahan', name: 'Aliahan', icon: '⚔️', blurb: 'Twin loops crossing at the bank — desert wind, Jipang warp island', target: 12000 },
    ];
    const tickerItems = [
      'TANTEGEL ▲ 7G', 'GARINHAM ▲ 9G', 'KOL ▲ 9G', 'DOMDORA ▼ 11G', 'CANTLIN ▲ 12G',
      'RIMULDAR ▲ 13G', 'CHARLOCK ▲ 21G', 'BRIDGES ▼ 7G', '🎰 THE HOUSE ALWAYS PAYS',
      'LIANPORT ▲ 6G', 'CANNOCK ▲ 8G', 'HAMLIN ▲ 9G', 'BERAN ▲ 13G', 'MOONBROOKE ▲ 10G',
      '♠ ♥ ♦ ♣ COLLECT ALL FOUR', 'SALARY DAY AT THE BANK',
      'JIPANG ▲ 22G', 'ROMALY ▲ 10G', 'BAHARATA ▲ 14G', 'DESERT WIND BLOWS EAST',
    ];
    const tickerText = tickerItems.join('   ·   ');
    const inputStyle: React.CSSProperties = {
      width: '100%',
      padding: '12px 16px',
      borderRadius: 10,
      background: 'rgba(0, 0, 0, 0.45)',
      border: '1px solid rgba(253, 224, 71, 0.12)',
      color: '#f8fafc',
      fontSize: 14,
      fontFamily: "'Outfit', sans-serif",
      outline: 'none',
    };
    const labelStyle: React.CSSProperties = {
      display: 'block',
      fontSize: 10,
      fontWeight: 700,
      color: '#8b8fa3',
      marginBottom: 8,
      letterSpacing: '2.5px',
      textTransform: 'uppercase',
      fontFamily: "'Unbounded', sans-serif",
    };

    return (
      <div style={{
        minHeight: '100vh',
        background: `
          radial-gradient(ellipse 80% 50% at 15% -10%, rgba(134, 25, 143, 0.22) 0%, transparent 60%),
          radial-gradient(ellipse 70% 45% at 85% 0%, rgba(8, 145, 178, 0.16) 0%, transparent 55%),
          radial-gradient(ellipse 90% 60% at 50% 110%, rgba(250, 204, 21, 0.07) 0%, transparent 60%),
          #05050b
        `,
        fontFamily: "'Outfit', sans-serif",
        color: '#f8fafc',
        overflowY: 'auto',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}>
        <div className="lobby-stars" />

        {/* ── Marquee header ── */}
        <div className="lobby-rise" style={{ textAlign: 'center', padding: '52px 24px 26px', position: 'relative' }}>
          <h1 className="marquee-wordmark" style={{ fontSize: 'clamp(40px, 6vw, 72px)', margin: 0 }}>
            <span style={{ color: '#fde047', textShadow: '0 0 18px rgba(253, 224, 71, 0.55), 0 0 60px rgba(245, 158, 11, 0.25)' }}>BANKRUPT</span>
            <span style={{ color: '#22d3ee', textShadow: '0 0 18px rgba(34, 211, 238, 0.55), 0 0 60px rgba(8, 145, 178, 0.3)', marginLeft: 22 }}>STREET</span>
          </h1>
          <p style={{
            color: '#8b8fa3', fontSize: 11, fontWeight: 400, letterSpacing: '6px', textTransform: 'uppercase',
            fontFamily: "'Unbounded', sans-serif", margin: '14px 0 0',
          }}>
            Roll · Buy · Invest · Bankrupt your friends
          </p>
        </div>

        {/* ── Stock ticker strip ── */}
        <div className="lobby-rise" style={{
          animationDelay: '0.12s',
          overflow: 'hidden',
          borderTop: '1px solid rgba(253, 224, 71, 0.14)',
          borderBottom: '1px solid rgba(253, 224, 71, 0.14)',
          background: 'rgba(0, 0, 0, 0.45)',
          padding: '7px 0',
          whiteSpace: 'nowrap',
          marginBottom: 38,
        }}>
          <div style={{ display: 'inline-block', animation: 'ticker-scroll 45s linear infinite' }}>
            {[0, 1].map(i => (
              <span key={i} style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '1px',
                color: '#a5b4cf', paddingRight: 24,
              }}>
                {tickerText}   ·   
              </span>
            ))}
          </div>
        </div>

        {/* ── Main composition ── */}
        <div style={{
          display: 'flex',
          gap: 26,
          width: '100%',
          maxWidth: 1180,
          margin: '0 auto',
          padding: '0 24px 60px',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          position: 'relative',
        }}>
          {/* New venture (create) */}
          <div className="lobby-rise" style={{
            animationDelay: '0.22s',
            flex: '1 1 580px',
            background: 'linear-gradient(160deg, rgba(20, 16, 36, 0.85) 0%, rgba(8, 8, 16, 0.9) 100%)',
            border: '1px solid rgba(253, 224, 71, 0.14)',
            borderRadius: 18,
            padding: '26px 28px',
            boxShadow: '0 18px 50px rgba(0, 0, 0, 0.55)',
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}>
            <h2 style={{
              fontFamily: "'Unbounded', sans-serif", fontSize: 15, fontWeight: 900, color: '#fde047',
              margin: 0, letterSpacing: '2px', textTransform: 'uppercase',
            }}>
              ◇ Open a New Venture
            </h2>

            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Your Name</label>
                <input
                  type="text"
                  placeholder="Hero, Dragonlord, alice…"
                  value={playerNameInput}
                  onChange={(e) => setPlayerNameInput(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Room Name</label>
                <input
                  type="text"
                  placeholder="Alefgard Castle…"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Pick Your Character</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {Object.values(CHARACTERS).map(c => {
                  const selected = characterChoice === c.id;
                  return (
                    <button
                      key={c.id}
                      className="character-card"
                      onClick={() => setCharacterChoice(c.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '9px 12px',
                        borderRadius: 12,
                        cursor: 'pointer',
                        textAlign: 'left',
                        background: selected ? 'rgba(253, 224, 71, 0.09)' : 'rgba(255, 255, 255, 0.02)',
                        border: selected ? '1px solid rgba(253, 224, 71, 0.55)' : '1px solid rgba(255, 255, 255, 0.06)',
                        boxShadow: selected ? '0 0 18px rgba(253, 224, 71, 0.12)' : 'none',
                      }}
                    >
                      <span style={{ fontSize: 22 }}>{c.emoji}</span>
                      <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: selected ? '#fde047' : '#f8fafc' }}>{c.name}</span>
                        <span style={{ fontSize: 9.5, color: '#8b8fa3', fontWeight: 600 }}>{c.title}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 280px' }}>
                <label style={labelStyle}>Board</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {boards.map(b => {
                    const selected = boardChoice === b.id;
                    return (
                      <button
                        key={b.id}
                        className="character-card"
                        onClick={() => { setBoardChoice(b.id); setTargetNetWorth(b.target); }}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 12,
                          cursor: 'pointer',
                          textAlign: 'left',
                          background: selected ? 'rgba(34, 211, 238, 0.07)' : 'rgba(255, 255, 255, 0.02)',
                          border: selected ? '1px solid rgba(34, 211, 238, 0.5)' : '1px solid rgba(255, 255, 255, 0.06)',
                          boxShadow: selected ? '0 0 18px rgba(34, 211, 238, 0.1)' : 'none',
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 800, color: selected ? '#22d3ee' : '#f8fafc' }}>
                          {b.icon} {b.name}
                        </div>
                        <div style={{ fontSize: 9.5, color: '#8b8fa3', marginTop: 3, lineHeight: 1.4 }}>{b.blurb}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ flex: '0 1 auto' }}>
                <label style={labelStyle}>Target Net Worth</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {stakes.map(s => {
                    const selected = targetNetWorth === s;
                    return (
                      <button
                        key={s}
                        onClick={() => setTargetNetWorth(s)}
                        style={{
                          padding: '9px 12px',
                          borderRadius: 16,
                          fontSize: 11,
                          fontWeight: 800,
                          fontFamily: "'JetBrains Mono', monospace",
                          cursor: 'pointer',
                          background: selected ? 'linear-gradient(135deg, #fde047 0%, #f59e0b 100%)' : 'rgba(255, 255, 255, 0.03)',
                          color: selected ? '#0c0a02' : '#fde68a',
                          border: selected ? 'none' : '1px solid rgba(250, 204, 21, 0.22)',
                        }}
                      >
                        {s / 1000}K
                      </button>
                    );
                  })}
                </div>
                <label style={{ ...labelStyle, marginTop: 12 }}>Ends After</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {([[1, '1 💀'], [2, '2 💀'], [99, 'Last standing']] as const).map(([n, label]) => {
                    const selected = bankruptcyChoice === n;
                    return (
                      <button
                        key={n}
                        onClick={() => setBankruptcyChoice(n)}
                        title={n === 99 ? 'Play until one player remains' : `Game ends after ${n} bankruptc${n === 1 ? 'y' : 'ies'}`}
                        style={{
                          padding: '9px 12px',
                          borderRadius: 16,
                          fontSize: 11,
                          fontWeight: 800,
                          fontFamily: "'JetBrains Mono', monospace",
                          cursor: 'pointer',
                          background: selected ? 'rgba(244, 63, 94, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                          color: selected ? '#fb7185' : '#8b8fa3',
                          border: selected ? '1px solid rgba(244, 63, 94, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                if (!playerNameInput.trim()) { alert('Please enter a username'); return; }
                if (!newRoomName.trim()) { alert('Please enter a room name'); return; }
                localStorage.setItem('playerName', playerNameInput.trim());
                createRoom(newRoomName.trim(), playerNameInput.trim(), targetNetWorth, boardChoice, characterChoice, bankruptcyChoice);
              }}
              style={{
                padding: '15px',
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg, #fde047 0%, #f59e0b 55%, #d97706 100%)',
                color: '#190f00',
                fontSize: 13,
                fontWeight: 900,
                letterSpacing: '3px',
                textTransform: 'uppercase',
                fontFamily: "'Unbounded', sans-serif",
                cursor: 'pointer',
                boxShadow: '0 6px 26px rgba(245, 158, 11, 0.35)',
              }}
            >
              Open the Doors ➜
            </button>
          </div>

          {/* Open tables (rooms) */}
          <div className="lobby-rise" style={{
            animationDelay: '0.32s',
            flex: '1 1 380px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}>
            <div style={{
              background: 'linear-gradient(160deg, rgba(10, 18, 28, 0.85) 0%, rgba(8, 8, 16, 0.9) 100%)',
              border: '1px solid rgba(34, 211, 238, 0.14)',
              borderRadius: 18,
              padding: '24px 24px',
              boxShadow: '0 18px 50px rgba(0, 0, 0, 0.55)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}>
              <h2 style={{
                fontFamily: "'Unbounded', sans-serif", fontSize: 15, fontWeight: 900, color: '#22d3ee',
                margin: 0, letterSpacing: '2px', textTransform: 'uppercase',
              }}>
                ◆ Open Tables
              </h2>

              <div style={{
                overflowY: 'auto',
                maxHeight: 430,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                paddingRight: 4,
              }}>
                {roomsList.length === 0 ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '36px 0',
                    color: '#5b6478',
                    gap: 8,
                  }}>
                    <span style={{ fontSize: 26 }}>🌙</span>
                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '1.5px' }}>THE FLOOR IS QUIET</span>
                    <span style={{ fontSize: 11 }}>Open a venture to deal the first hand.</span>
                  </div>
                ) : (
                  roomsList.map((r) => (
                    <div
                      key={r.roomId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '13px 16px',
                        borderRadius: 12,
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        borderLeft: r.status === 'LOBBY' ? '3px solid #10b981' : '3px solid #22d3ee',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc' }}>{r.roomId}</span>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 10.5, color: '#8b8fa3', fontWeight: 600 }}>
                          <span style={{ color: r.status === 'LOBBY' ? '#10b981' : '#22d3ee', fontWeight: 800, letterSpacing: '0.5px' }}>
                            {r.status === 'LOBBY' ? '● SEATING' : '● IN PLAY'}
                          </span>
                          <span>👥 {r.playerCount}/{r.maxPlayers}</span>
                          {r.boardName && <span style={{ color: '#a78bfa' }}>🗺 {r.boardName}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if (!playerNameInput.trim()) { alert('Please enter a username first'); return; }
                          localStorage.setItem('playerName', playerNameInput.trim());
                          joinRoom(r.roomId, playerNameInput.trim(), characterChoice);
                        }}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 10,
                          border: r.status === 'LOBBY' ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                          background: r.status === 'LOBBY'
                            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                            : 'rgba(255, 255, 255, 0.04)',
                          color: r.status === 'LOBBY' ? '#ffffff' : '#cbd5e1',
                          fontSize: 11.5,
                          fontWeight: 800,
                          cursor: 'pointer',
                          boxShadow: r.status === 'LOBBY' ? '0 4px 10px rgba(16, 185, 129, 0.2)' : 'none',
                        }}
                      >
                        {r.status === 'LOBBY' ? 'Take a Seat' : 'Rejoin'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={() => setShowRules(true)}
              style={{
                padding: '13px',
                borderRadius: 14,
                background: 'rgba(250, 204, 21, 0.05)',
                border: '1px dashed rgba(250, 204, 21, 0.3)',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 800,
                color: '#fde68a',
                letterSpacing: '2.5px',
                textTransform: 'uppercase',
                fontFamily: "'Unbounded', sans-serif",
              }}
            >
              📜 House Rules
            </button>
          </div>
        </div>

        {showRules && <Rules onClose={() => setShowRules(false)} />}
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
          border: '3px solid rgba(250, 204, 21, 0.1)',
          borderTop: '3px solid #fde047',
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
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #fde047 0%, #22d3ee 100%)' }} />

          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#fde047', letterSpacing: '3px', textTransform: 'uppercase', fontFamily: "'Unbounded', sans-serif" }}>
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



  // Post-bank stock window: the landed space is already resolved; only
  // BUY_STOCK / END_TURN are legal, so show the trading desk instead of
  // whatever panel the node type would normally trigger.
  const inStockWindow = phase === 'SPACE_ACTION' && !!state.passedBankWindowUsed;

  const isVentureSpace = phase === 'SPACE_ACTION' && !inStockWindow && (node?.type === 'venture' || node?.type === 'suit');
  const showVentureGrid = isVentureSpace && !state.activeVentureCard;
  const showVentureCard = !!state.activeVentureCard;
  const ventureGrid = state.ventureGrid ?? [];

  // Find what property (if any) the current player is standing on.
  const propAtNode    = Object.values(state.properties).find(p => p.nodeId === nodeId) ?? null;
  const ownShop       = phase === 'SPACE_ACTION' && !inStockWindow && propAtNode?.ownerId === currentPlayer?.id
    ? propAtNode
    : null;
  const unownedShop   = phase === 'SPACE_ACTION' && !inStockWindow && propAtNode?.ownerId === null
    ? propAtNode
    : null;
  const opponentShop  = phase === 'SPACE_ACTION' && !inStockWindow && propAtNode?.ownerId !== null && propAtNode?.ownerId !== currentPlayer?.id
    ? propAtNode
    : null;
  const atBroker      = phase === 'SPACE_ACTION' && (node?.type === 'bank' || node?.type === 'stockbroker' || inStockWindow);
  const atCasino      = phase === 'SPACE_ACTION' && !inStockWindow && node?.type === 'casino';

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
            ? 'linear-gradient(135deg, #fde047 0%, #f59e0b 100%)'
            : 'rgba(255, 255, 255, 0.04)',
      color: !isMyTurn ? '#475569'
        : danger ? '#ffffff'
        : primary ? '#190f00'
        : '#cbd5e1',
      border: !isMyTurn
        ? '1px solid rgba(255,255,255,0.02)'
        : primary || danger
          ? 'none'
          : '1px solid rgba(255, 255, 255, 0.08)',
      boxShadow: isMyTurn && primary
        ? '0 4px 14px rgba(245, 158, 11, 0.35)'
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

    // 1b. DEBT_SETTLEMENT: cash is negative — the player chooses which stocks
    // (and shops, at 75%) to sell until the debt is covered. No auto-selling.
    if (phase === 'DEBT_SETTLEMENT') {
      const deficit = Math.max(0, -currentPlayer.cash);
      const covered = deficit === 0;
      const myShops = currentPlayer.propertyIds
        .map(id => state.properties[id])
        .filter((p): p is NonNullable<typeof p> => !!p);
      const holdings = Object.values(state.districts)
        .filter(d => (d.playerHoldings[currentPlayer.id] ?? 0) > 0);

      return (
        <div style={{ ...consoleInnerPanelStyle, maxWidth: 560 }} className="animate-slide-up">
          <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '2px', fontFamily: "'Unbounded', sans-serif", color: '#f43f5e', marginBottom: 4 }}>
            ⚠ DEBT SETTLEMENT OFFICE
          </div>
          <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: 18, marginBottom: 6 }}>
            Debt Settlement
          </div>
          <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 8 }}>
            {!isMyTurn
              ? `Waiting for ${currentPlayer.name} to settle their debts…`
              : covered
                ? 'Debt covered! You may keep selling, or settle to continue.'
                : 'Sell any mix of your stocks (or shops at 75% value) to cover the debt.'}
          </div>
          <div style={{
            fontSize: 13,
            fontWeight: 800,
            fontFamily: "'JetBrains Mono', monospace",
            color: covered ? '#10b981' : '#f43f5e',
            marginBottom: 14,
          }}>
            Cash: {g(currentPlayer.cash)}{!covered && ` — ${deficit}G short`}
          </div>

          {holdings.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', marginBottom: 12, maxHeight: '36vh', overflowY: 'auto' }}>
              {holdings.map(d => {
                const price = d.stockPrice;
                const held = d.playerHoldings[currentPlayer.id] ?? 0;
                const toCover = price > 0 ? Math.min(held, Math.max(1, Math.ceil(deficit / price))) : held;
                const qty = Math.max(1, Math.min(held, debtSellQty[d.id] ?? toCover));
                const proceeds = qty * price;
                // Mirror sellStock in engine/economy.ts: 10+ shares drop the price
                // by floor(price/16)+1, floored at floor(avgShopPrice * 0.04).
                const shopPrices = d.propertyIds.map(pid => state.properties[pid]?.currentPrice ?? 0);
                const priceFloor = shopPrices.length > 0
                  ? Math.floor(shopPrices.reduce((a, b) => a + b, 0) / shopPrices.length * 0.04)
                  : 0;
                const newPrice = qty >= 10
                  ? Math.max(priceFloor, price - (Math.floor(price / 16) + 1))
                  : price;
                const setQty = (n: number) => setDebtSellQty(q => ({ ...q, [d.id]: Math.max(1, Math.min(held, n)) }));
                return (
                  <div
                    key={d.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: 'rgba(0, 0, 0, 0.2)',
                      border: '1px solid rgba(255, 255, 255, 0.04)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: districtColorHex(d.id, state.districts),
                        }} />
                        <span style={{ fontWeight: 700, fontSize: 12.5, color: '#f8fafc' }}>{d.name}</span>
                      </div>
                      <span style={{ fontSize: 10, color: '#64748b', fontFamily: "'JetBrains Mono', monospace" }}>
                        {g(price)}/sh · own {held}sh
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input
                        type="number"
                        min={1}
                        max={held}
                        value={qty}
                        onChange={e => setQty(parseInt(e.target.value, 10) || 1)}
                        disabled={!isMyTurn}
                        style={{
                          width: 52,
                          padding: '4px 6px',
                          borderRadius: 6,
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          background: 'rgba(0, 0, 0, 0.3)',
                          color: '#f8fafc',
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 12,
                        }}
                      />
                      <button
                        onClick={() => setQty(toCover)}
                        disabled={!isMyTurn || covered}
                        style={{ ...overlayBtn(false), padding: '3px 8px', fontSize: 10 }}
                      >
                        Cover ({toCover})
                      </button>
                      <button
                        onClick={() => setQty(held)}
                        disabled={!isMyTurn}
                        style={{ ...overlayBtn(false), padding: '3px 8px', fontSize: 10 }}
                      >
                        All ({held})
                      </button>
                    </div>

                    <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.5 }}>
                      Proceeds: <span style={{ color: '#10b981' }}>{g(proceeds)}</span>
                      {' · '}Price: {qty >= 10
                        ? <span style={{ color: '#f43f5e' }}>{g(price)} → {g(newPrice)} ({newPrice - price})</span>
                        : <span>{g(price)} (no impact)</span>}
                    </div>

                    <button
                      onClick={() => emitAction({ type: 'SELL_STOCK', districtId: d.id, shares: qty })}
                      disabled={!isMyTurn}
                      style={{ ...overlayBtn(true), padding: '6px 10px', fontSize: 11 }}
                    >
                      Sell {qty} ({g(proceeds)})
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {myShops.length > 0 && (
            <div style={{ width: '100%', marginBottom: 12 }}>
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '1px', color: '#64748b', marginBottom: 6 }}>
                DISTRESS SALE — BANK PAYS 75%
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {myShops.map(p => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 12px',
                      borderRadius: 8,
                      background: 'rgba(0, 0, 0, 0.2)',
                      border: '1px solid rgba(255, 255, 255, 0.04)',
                    }}
                  >
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#f8fafc' }}>
                      {p.nodeId} <span style={{ color: '#64748b', fontWeight: 400 }}>(worth {g(p.currentPrice)})</span>
                    </span>
                    <button
                      onClick={() => emitAction({ type: 'SELL_PROPERTY', propertyId: p.id })}
                      disabled={!isMyTurn}
                      style={{ ...overlayBtn(false, true), padding: '4px 10px', fontSize: 10.5 }}
                    >
                      Sell ({g(Math.floor(p.currentPrice * 0.75))})
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => emitAction({ type: 'END_TURN' })}
            disabled={!isMyTurn || !covered}
            style={{
              ...overlayBtn(covered),
              width: '100%',
              maxWidth: 240,
              padding: '8px 0',
              background: covered && isMyTurn ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : undefined,
            }}
          >
            {covered ? 'Settle & Continue' : `Still ${deficit}G short`}
          </button>
        </div>
      );
    }

    // 2. CHOOSING_PATH: branch direction selectors
    if (phase === 'CHOOSING_PATH') {
      return (
        <div style={consoleInnerPanelStyle} className="animate-slide-up">
          <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '2px', fontFamily: "'Unbounded', sans-serif", color: '#f59e0b', marginBottom: 4 }}>
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
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '2px', fontFamily: "'Unbounded', sans-serif", color: '#06b6d4', marginBottom: 4 }}>
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
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '2px', fontFamily: "'Unbounded', sans-serif", color: '#10b981', marginBottom: 4 }}>
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
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '2px', fontFamily: "'Unbounded', sans-serif", color: '#06b6d4', marginBottom: 4 }}>
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
              <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '2px', fontFamily: "'Unbounded', sans-serif", color: '#22d3ee', marginBottom: 4 }}>
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
            <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '2px', fontFamily: "'Unbounded', sans-serif", color: '#06b6d4', marginBottom: 4 }}>
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
          <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '2px', fontFamily: "'Unbounded', sans-serif", color: '#06b6d4', marginBottom: 4 }}>
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
                background: canBuyout ? 'linear-gradient(135deg, #ec4899 0%, #86198f 100%)' : 'rgba(255,255,255,0.02)',
                boxShadow: canBuyout ? '0 4px 12px rgba(236, 72, 153, 0.3)' : 'none',
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

    // 5b. SPACE_ACTION: casino floor — wager on a minigame or walk away
    if (atCasino) {
      const result = state.casinoResult;
      const wager = Math.max(10, Math.min(casinoWager, 500, currentPlayer.cash));
      const canBet = isMyTurn && !result && currentPlayer.cash >= 10;
      const resultSig = result
        ? `${result.playerId}-${result.game}-${result.wager}-${result.winnerSlime ?? ''}-${result.card1 ?? ''}-${result.card2 ?? ''}`
        : '';
      const chipStyle = (amount: number): React.CSSProperties => ({
        padding: '5px 13px',
        borderRadius: 16,
        fontSize: 11,
        fontWeight: 800,
        fontFamily: "'JetBrains Mono', monospace",
        cursor: canBet && amount <= currentPlayer.cash ? 'pointer' : 'default',
        opacity: amount <= currentPlayer.cash ? 1 : 0.35,
        background: wager === amount ? 'linear-gradient(135deg, #fde047 0%, #f59e0b 100%)' : 'rgba(255, 255, 255, 0.04)',
        color: wager === amount ? '#0c0a02' : '#fde68a',
        border: wager === amount ? 'none' : '1px solid rgba(250, 204, 21, 0.25)',
      });

      return (
        <div style={{ ...consoleInnerPanelStyle, maxWidth: 560, border: '1px solid rgba(250, 204, 21, 0.18)' }} className="animate-slide-up">
          <div style={{
            fontSize: 9.5, fontWeight: 800, letterSpacing: '2px', fontFamily: "'Unbounded', sans-serif", color: '#facc15', marginBottom: 4,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {['#fde047', '#f472b6', '#38bdf8'].map((c, i) => (
              <span key={i} style={{
                width: 5, height: 5, borderRadius: '50%', background: c,
                animation: `marquee-blink 1s ease-in-out ${i * 0.33}s infinite`,
              }} />
            ))}
            🎰 GOLDEN SLIME CASINO
            {['#38bdf8', '#f472b6', '#fde047'].map((c, i) => (
              <span key={i} style={{
                width: 5, height: 5, borderRadius: '50%', background: c,
                animation: `marquee-blink 1s ease-in-out ${i * 0.33}s infinite`,
              }} />
            ))}
          </div>

          {result ? (
            <>
              <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: 17, marginBottom: 10 }}>
                {result.game === 'derby' ? '🏁 Slime Derby' : '🃏 High-Low'}
                <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: 12, marginLeft: 8 }}>
                  {state.players[result.playerId]?.name} wagered {g(result.wager)}
                </span>
              </div>
              <CasinoResultView
                key={resultSig}
                result={result}
                canAct={isMyTurn}
                onEndTurn={() => emitAction({ type: 'END_TURN' })}
              />
            </>
          ) : (
            <>
              <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: 18, marginBottom: 4 }}>
                Place Your Bet
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
                {!isMyTurn
                  ? `Waiting for ${currentPlayer.name} at the tables…`
                  : 'One bet per visit. The house honors all payouts — in gold, on the spot.'}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '1px', color: '#64748b' }}>WAGER</span>
                {[50, 100, 200, 500].map(amount => (
                  <button
                    key={amount}
                    onClick={() => setCasinoWager(amount)}
                    disabled={!canBet || amount > currentPlayer.cash}
                    style={chipStyle(amount)}
                  >
                    {amount}G
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%', marginBottom: 14 }}>
                {/* Slime Derby */}
                <div style={{
                  borderRadius: 12,
                  padding: '12px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(56, 189, 248, 0.15)',
                }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#f8fafc', marginBottom: 2 }}>🏁 Slime Derby</div>
                  <div style={{ fontSize: 10.5, color: '#64748b', marginBottom: 10 }}>
                    Back a racer · win pays <strong style={{ color: '#fde68a' }}>4×</strong> ({g(wager * 4)})
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {SLIMES.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => emitAction({ type: 'CASINO_BET', game: 'derby', wager, choice: String(i) })}
                        disabled={!canBet}
                        style={{
                          padding: '7px 4px',
                          borderRadius: 8,
                          fontSize: 10.5,
                          fontWeight: 700,
                          cursor: canBet ? 'pointer' : 'default',
                          opacity: canBet ? 1 : 0.5,
                          background: 'rgba(255, 255, 255, 0.03)',
                          color: s.color,
                          border: `1px solid ${s.color}44`,
                        }}
                      >
                        {s.emoji} {s.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* High-Low */}
                <div style={{
                  borderRadius: 12,
                  padding: '12px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(244, 114, 182, 0.15)',
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#f8fafc', marginBottom: 2 }}>🃏 High-Low</div>
                  <div style={{ fontSize: 10.5, color: '#64748b', marginBottom: 10 }}>
                    Call the next card · win pays <strong style={{ color: '#fde68a' }}>2×</strong> ({g(wager * 2)}) · tie loses
                  </div>
                  <div style={{ display: 'flex', gap: 6, flex: 1, alignItems: 'center' }}>
                    <button
                      onClick={() => emitAction({ type: 'CASINO_BET', game: 'highlow', wager, choice: 'high' })}
                      disabled={!canBet}
                      style={{
                        flex: 1, padding: '12px 4px', borderRadius: 8, fontSize: 12, fontWeight: 800,
                        cursor: canBet ? 'pointer' : 'default', opacity: canBet ? 1 : 0.5,
                        background: 'rgba(16, 185, 129, 0.08)', color: '#34d399',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                      }}
                    >
                      ⬆ HIGHER
                    </button>
                    <button
                      onClick={() => emitAction({ type: 'CASINO_BET', game: 'highlow', wager, choice: 'low' })}
                      disabled={!canBet}
                      style={{
                        flex: 1, padding: '12px 4px', borderRadius: 8, fontSize: 12, fontWeight: 800,
                        cursor: canBet ? 'pointer' : 'default', opacity: canBet ? 1 : 0.5,
                        background: 'rgba(244, 63, 94, 0.08)', color: '#fb7185',
                        border: '1px solid rgba(244, 63, 94, 0.3)',
                      }}
                    >
                      ⬇ LOWER
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={() => emitAction({ type: 'END_TURN' })}
                disabled={!isMyTurn}
                style={{ ...overlayBtn(false), padding: '8px 28px' }}
              >
                Walk Away
              </button>
            </>
          )}
        </div>
      );
    }

    // 6. SPACE_ACTION: bank/broker trading desk inline (also shown during the
    // post-bank stock window, where BUY_STOCK / END_TURN are the only legal actions)
    if (atBroker) {
      return (
        <div style={{ ...consoleInnerPanelStyle, maxWidth: 560 }} className="animate-slide-up">
          <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '2px', fontFamily: "'Unbounded', sans-serif", color: '#06b6d4', marginBottom: 4 }}>
            🏦 BROKERAGE REGISTRATION DESK
          </div>
          <div style={{ fontWeight: 800, color: '#f8fafc', fontSize: 18, marginBottom: 6 }}>
            {node?.type === 'bank' ? 'Bank Stock Brokerage'
              : node?.type === 'stockbroker' ? 'District Stockbroker'
              : 'Bank Pass — Stock Window'}
          </div>
          <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 14 }}>
            Buy 1–99 shares per district. Trades of 10+ shares move the price. Cash Available: <strong style={{ color: '#10b981', fontFamily: "'JetBrains Mono', monospace" }}>{g(currentPlayer.cash)}</strong>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', marginBottom: 16, maxHeight: '36vh', overflowY: 'auto' }}>
            {Object.values(state.districts).map(d => {
              const price = d.stockPrice;
              const maxAffordable = price > 0 ? Math.min(99, Math.floor(currentPlayer.cash / price)) : 0;
              const qty = Math.max(1, Math.min(99, stockQty[d.id] ?? 10));
              const cost = qty * price;
              const canAfford = maxAffordable >= 1 && qty <= maxAffordable;
              // Mirror buyStock in engine/economy.ts: 10+ shares raise price by floor(price/16)+1
              const newPrice = qty >= 10 ? price + Math.floor(price / 16) + 1 : price;
              const held = d.playerHoldings[currentPlayer.id] ?? 0;
              const holdingsGain = held * (newPrice - price);
              const setQty = (n: number) => setStockQty(q => ({ ...q, [d.id]: Math.max(1, Math.min(99, n)) }));
              const presetBtn = (active: boolean): React.CSSProperties => ({
                ...overlayBtn(false),
                padding: '3px 8px',
                fontSize: 10,
                background: active ? 'rgba(250, 204, 21, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                border: active ? '1px solid rgba(250, 204, 21, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
              });
              return (
                <div
                  key={d.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'rgba(0, 0, 0, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.04)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: districtColorHex(d.id, state.districts),
                      }} />
                      <span style={{ fontWeight: 700, fontSize: 12.5, color: '#f8fafc' }}>{d.name}</span>
                    </div>
                    <span style={{ fontSize: 10, color: '#64748b', fontFamily: "'JetBrains Mono', monospace" }}>
                      {g(price)}/sh{held > 0 ? ` · own ${held}sh` : ''}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={qty}
                      onChange={e => setQty(parseInt(e.target.value, 10) || 1)}
                      disabled={!isMyTurn}
                      style={{
                        width: 52,
                        padding: '4px 6px',
                        borderRadius: 6,
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        background: 'rgba(0, 0, 0, 0.3)',
                        color: '#f8fafc',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 12,
                      }}
                    />
                    <button onClick={() => setQty(10)} disabled={!isMyTurn} style={presetBtn(qty === 10)}>10</button>
                    <button
                      onClick={() => setQty(maxAffordable)}
                      disabled={!isMyTurn || maxAffordable < 1}
                      style={presetBtn(maxAffordable >= 1 && qty === maxAffordable)}
                    >
                      Max ({maxAffordable})
                    </button>
                  </div>

                  <div style={{ fontSize: 10, color: '#94a3b8', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.5 }}>
                    Cost: <span style={{ color: canAfford ? '#10b981' : '#f43f5e' }}>{g(cost)}</span>
                    {' · '}Price: {qty >= 10
                      ? <span style={{ color: '#facc15' }}>{g(price)} → {g(newPrice)} (+{newPrice - price})</span>
                      : <span>{g(price)} (no impact)</span>}
                    {held > 0 && newPrice !== price && (
                      <> · Your {held}sh: <span style={{ color: '#10b981' }}>+{holdingsGain}G</span></>
                    )}
                  </div>

                  <button
                    onClick={() => emitAction({ type: 'BUY_STOCK', districtId: d.id, shares: qty })}
                    disabled={!isMyTurn || !canAfford}
                    style={{
                      ...overlayBtn(true),
                      padding: '6px 10px',
                      fontSize: 11,
                    }}
                  >
                    Buy {qty} ({g(cost)})
                  </button>
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
          <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '2px', fontFamily: "'Unbounded', sans-serif", color: '#facc15', marginBottom: 4 }}>
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
                  <span style={{ fontSize: 11, fontWeight: 700, color: districtColorHex(d.id, state.districts) }}>{d.name}</span>
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
                border: '2px solid #22d3ee',
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
            backgroundColor: '#fde047',
            boxShadow: '0 0 10px rgba(253, 224, 71, 0.7)',
          }} />
          <span style={{ fontFamily: "'Monoton', cursive", fontSize: '14px', letterSpacing: '2px' }}>
            <span style={{ color: '#fde047', textShadow: '0 0 8px rgba(253, 224, 71, 0.4)' }}>BANKRUPT</span>
            <span style={{ color: '#22d3ee', textShadow: '0 0 8px rgba(34, 211, 238, 0.4)', marginLeft: 6 }}>STREET</span>
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
            background: 'rgba(34, 211, 238, 0.08)',
            border: '1px solid rgba(34, 211, 238, 0.25)',
            padding: '5px 14px',
            borderRadius: 20,
            cursor: 'pointer',
            fontSize: 10.5,
            fontWeight: 800,
            color: '#22d3ee',
            letterSpacing: '0.8px',
            textTransform: 'uppercase',
            boxShadow: '0 0 10px rgba(34, 211, 238, 0.12)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(34, 211, 238, 0.16)';
            e.currentTarget.style.border = '1px solid rgba(34, 211, 238, 0.4)';
            e.currentTarget.style.boxShadow = '0 0 15px rgba(34, 211, 238, 0.3)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(34, 211, 238, 0.08)';
            e.currentTarget.style.border = '1px solid rgba(34, 211, 238, 0.25)';
            e.currentTarget.style.boxShadow = '0 0 10px rgba(34, 211, 238, 0.12)';
          }}
        >
          📊 Stock Holdings Matrix
        </button>

        {/* Rules Button */}
        <button
          onClick={() => setShowRules(true)}
          style={{
            background: 'rgba(250, 204, 21, 0.08)',
            border: '1px solid rgba(250, 204, 21, 0.25)',
            padding: '5px 14px',
            borderRadius: 20,
            cursor: 'pointer',
            fontSize: 10.5,
            fontWeight: 800,
            color: '#facc15',
            letterSpacing: '0.8px',
            textTransform: 'uppercase',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          📜 Rules
        </button>

        {/* Sound toggle */}
        <button
          onClick={() => {
            const next = !sfxOn;
            setMuted(!next);
            setSfxOn(next);
            if (next) sfx.coin();
          }}
          title={sfxOn ? 'Mute sounds' : 'Unmute sounds'}
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '5px 10px',
            borderRadius: 20,
            cursor: 'pointer',
            fontSize: 12,
            opacity: sfxOn ? 1 : 0.55,
          }}
        >
          {sfxOn ? '🔊' : '🔇'}
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
          {/* Board Display Screen — takes all height the console doesn't need */}
          <div style={{
            flex: 1,
            minHeight: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
            padding: '10px 12px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'stretch',
          }}>
            <div style={{
              width: '100%',
              borderRadius: '16px',
              overflow: 'hidden',
              border: '1px solid rgba(250, 204, 21, 0.12)',
              boxShadow: 'inset 0 0 20px rgba(250, 204, 21, 0.04), 0 4px 30px rgba(0, 0, 0, 0.7)',
            }}>
              <Board socket={socket} state={state} hoveredNodeId={hoveredNodeId} />
            </div>
          </div>

          {/* Operations & Action Console at bottom — sized to its content */}
          <div style={{
            flexShrink: 0,
            maxHeight: '48vh',
            background: 'radial-gradient(circle at 50% 10%, #0d0d1e 0%, #06060c 100%)',
            padding: '12px 24px',
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
      {diceAnim && <DiceOverlay key={diceAnim.key} roll={diceAnim.roll} />}

      {/* End-game vote: a bankruptcy didn't end the game — unanimous call to stop */}
      {state.endVote && !state.winnerId && (() => {
        const eligible = state.turnOrder.filter(pid => !state.players[pid].isBankrupt && !state.players[pid].isBot);
        const me = state.players[PLAYER_ID];
        const canVote = me && !me.isBankrupt && !me.isBot && !state.endVote!.votes[PLAYER_ID];
        const standings = [...state.turnOrder]
          .map(pid => state.players[pid])
          .sort((a, b) => Number(a.isBankrupt) - Number(b.isBankrupt) || b.netWorth - a.netWorth);
        return (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(3, 3, 8, 0.88)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            zIndex: 150,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{
              background: 'rgba(12, 12, 26, 0.9)',
              border: '1px solid rgba(244, 63, 94, 0.35)',
              borderRadius: 20,
              padding: '28px 32px',
              maxWidth: 520,
              width: '100%',
              textAlign: 'center',
              fontFamily: "'Outfit', sans-serif",
              color: '#f1f5f9',
              boxShadow: '0 0 50px rgba(244, 63, 94, 0.15)',
            }} className="animate-slide-up">
              <div style={{
                fontSize: 10, fontWeight: 800, letterSpacing: '2.5px', color: '#fb7185',
                textTransform: 'uppercase', fontFamily: "'Unbounded', sans-serif", marginBottom: 8,
              }}>
                💀 {state.endVote.reason}
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>End the game now?</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>
                All remaining players must agree. One vote to continue keeps the game alive.
              </div>

              <div style={{ textAlign: 'left', marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 6 }}>
                  Standings if you stop
                </div>
                {standings.map((p, rank) => (
                  <div key={p.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '7px 12px',
                    borderRadius: 10,
                    marginBottom: 5,
                    opacity: p.isBankrupt ? 0.45 : 1,
                    background: rank === 0 && !p.isBankrupt ? 'rgba(250, 204, 21, 0.07)' : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${rank === 0 && !p.isBankrupt ? 'rgba(250, 204, 21, 0.3)' : 'rgba(255, 255, 255, 0.05)'}`,
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>
                      {p.isBankrupt ? '💀' : ['🥇', '🥈', '🥉', '4.'][rank] ?? `${rank + 1}.`} {p.name}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: p.isBankrupt ? '#64748b' : '#10b981' }}>
                        {g(p.netWorth)}
                      </span>
                      {!p.isBankrupt && !p.isBot && (
                        <span style={{ fontSize: 10, color: state.endVote!.votes[p.id] ? '#fb7185' : '#64748b', fontWeight: 800 }}>
                          {state.endVote!.votes[p.id] ? 'END ✓' : 'waiting…'}
                        </span>
                      )}
                      {p.isBot && !p.isBankrupt && (
                        <span style={{ fontSize: 10, color: '#475569', fontWeight: 700 }}>bot</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>

              {canVote ? (
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button
                    onClick={() => emitAction({ type: 'VOTE_END', playerId: PLAYER_ID, vote: true })}
                    style={{
                      padding: '11px 26px', borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: 'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)',
                      color: '#ffffff', fontSize: 13, fontWeight: 800,
                      boxShadow: '0 4px 14px rgba(244, 63, 94, 0.3)',
                    }}
                  >
                    🏁 End the Game
                  </button>
                  <button
                    onClick={() => emitAction({ type: 'VOTE_END', playerId: PLAYER_ID, vote: false })}
                    style={{
                      padding: '11px 26px', borderRadius: 12, cursor: 'pointer',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      border: 'none', color: '#ffffff', fontSize: 13, fontWeight: 800,
                      boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    ▶ Keep Playing
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
                  {me && state.endVote.votes[PLAYER_ID]
                    ? `Vote cast — waiting for the others (${Object.keys(state.endVote.votes).length}/${eligible.length})…`
                    : 'Waiting for the survivors to decide…'}
                </div>
              )}
            </div>
          </div>
        );
      })()}

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
          overflow: 'hidden',
        }}>
          {/* Confetti rain */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {Array.from({ length: 56 }).map((_, i) => (
              <span key={i} style={{
                position: 'absolute',
                top: '-4vh',
                left: `${(i * 37 + 11) % 100}%`,
                width: i % 3 === 0 ? 6 : 8,
                height: i % 3 === 0 ? 12 : 9,
                background: ['#fde047', '#22d3ee', '#ec4899', '#10b981', '#a855f7'][i % 5],
                borderRadius: 2,
                opacity: 0,
                animation: `confetti-fall ${2.8 + (i % 5) * 0.55}s linear ${(i % 9) * 0.45}s infinite`,
              }} />
            ))}
          </div>

          <div style={{
            background: 'rgba(12, 12, 26, 0.85)',
            border: '2px dashed #facc15',
            borderRadius: 24,
            padding: '32px 36px',
            maxWidth: 640,
            width: '100%',
            textAlign: 'center',
            fontFamily: "'Outfit', sans-serif",
            color: '#f1f5f9',
            boxShadow: '0 0 50px rgba(250, 204, 21, 0.25)',
            maxHeight: '90vh',
            overflowY: 'auto',
            position: 'relative',
          }} className="animate-slide-up">
            <div style={{ fontSize: 32, marginBottom: 6 }}>👑</div>
            <div className="marquee-wordmark" style={{
              fontSize: 34,
              marginBottom: 10,
              color: '#fde047',
              textShadow: '0 0 16px rgba(253, 224, 71, 0.55), 0 0 50px rgba(245, 158, 11, 0.3)',
            }}>
              CHAMPION
            </div>

            <div style={{
              background: 'rgba(250, 204, 21, 0.04)',
              border: '1px solid rgba(250, 204, 21, 0.2)',
              borderRadius: 16,
              padding: '12px 20px',
              marginBottom: 18,
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

            {/* Final rankings with stat breakdown */}
            <div style={{ textAlign: 'left', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
                Final Rankings
              </div>
              {[...state.turnOrder]
                .map(pid => state.players[pid])
                .sort((a, b) => b.netWorth - a.netWorth)
                .map((p, rank) => {
                  const st = state.stats?.[p.id];
                  return (
                    <div key={p.id} style={{
                      background: rank === 0 ? 'rgba(250, 204, 21, 0.06)' : 'rgba(255, 255, 255, 0.02)',
                      border: `1px solid ${rank === 0 ? 'rgba(250, 204, 21, 0.25)' : 'rgba(255, 255, 255, 0.06)'}`,
                      borderRadius: 12,
                      padding: '10px 14px',
                      marginBottom: 8,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: st ? 6 : 0 }}>
                        <span style={{ fontSize: 14, fontWeight: 800 }}>
                          {['🥇', '🥈', '🥉', '4.'][rank] ?? `${rank + 1}.`} {p.name}{p.isBankrupt ? ' 💀' : ''}
                        </span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: '#10b981' }}>
                          {g(p.netWorth)}
                        </span>
                      </div>
                      {st && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2px 12px', fontSize: 10.5, color: '#94a3b8' }}>
                          <span>🔁 Laps: <strong style={{ color: '#cbd5e1' }}>{st.lapsCompleted}</strong></span>
                          <span>💼 Promotions: <strong style={{ color: '#cbd5e1' }}>{st.salariesCollected}</strong></span>
                          <span>🏪 Shops: <strong style={{ color: '#cbd5e1' }}>{st.propertiesBought}</strong></span>
                          <span>💰 Rent in: <strong style={{ color: '#cbd5e1' }}>{g(st.rentCollected)}</strong></span>
                          <span>💸 Rent out: <strong style={{ color: '#cbd5e1' }}>{g(st.rentPaid)}</strong></span>
                          <span>🏆 Best rent: <strong style={{ color: '#cbd5e1' }}>{g(st.biggestRentCollected)}</strong></span>
                          <span>📈 Bought: <strong style={{ color: '#cbd5e1' }}>{st.sharesBought}sh</strong></span>
                          <span>📉 Sold: <strong style={{ color: '#cbd5e1' }}>{st.sharesSold}sh</strong></span>
                          <span>❓ Ventures: <strong style={{ color: '#cbd5e1' }}>{st.ventureCardsDrawn}</strong></span>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            <div style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>
              Close this window to return to setup room.
            </div>
          </div>
        </div>
      )}

      {/* 4b. Rules Modal Overlay */}
      {showRules && <Rules onClose={() => setShowRules(false)} />}

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
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(250, 204, 21, 0.08)',
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
                    return (
                      <tr key={dist.id} style={{
                        borderBottom: rIdx === Object.values(state.districts).length - 1 ? 'none' : '1px solid rgba(255, 255, 255, 0.03)',
                        background: rIdx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent'
                      }}>
                        <td style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: districtColorHex(dist.id, state.districts) }} />
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
