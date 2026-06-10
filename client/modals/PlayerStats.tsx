import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../../shared/types';
import { districtColorHex } from '../districtColors';

interface Props {
  state: GameState | null;
  playerId: string;
}

// Visual definitions
const SUIT_CHAR: Record<string, string> = { heart: '♥', diamond: '♦', club: '♣', spade: '♠' };
const SUIT_COLOR: Record<string, string> = { heart: '#f43f5e', diamond: '#f43f5e', club: '#06b6d4', spade: '#a855f7' };
const SUIT_NAME: Record<string, string> = { heart: 'HEART', diamond: 'DIAMOND', club: 'CLUB', spade: 'SPADE' };

const PLAYER_CSS_COLORS = ['#ff4e50', '#00f2fe', '#a855f7', '#facc15'];

function g(n: number) { return `${n}G`; }

// Per-tag styling for engine log entries (entries are prefixed `[TAG] ...`)
const LOG_TAG_STYLE: Record<string, { color: string; icon: string }> = {
  TURN: { color: '#64748b', icon: '⏱' },
  LAND: { color: '#64748b', icon: '📍' },
  BUY: { color: '#06b6d4', icon: '🏪' },
  BUYOUT: { color: '#8b5cf6', icon: '💥' },
  INVEST: { color: '#06b6d4', icon: '🏗' },
  RENT: { color: '#f43f5e', icon: '💸' },
  DIVIDEND: { color: '#10b981', icon: '💰' },
  COMMISSION: { color: '#10b981', icon: '💰' },
  STOCK: { color: '#a855f7', icon: '📈' },
  SALARY: { color: '#10b981', icon: '✨' },
  TAX: { color: '#f43f5e', icon: '🏛' },
  'TAX BONUS': { color: '#10b981', icon: '🏛' },
  BREAK: { color: '#14b8a6', icon: '☕' },
  CHECKPOINT: { color: '#f59e0b', icon: '🛃' },
  TELEPORT: { color: '#facc15', icon: '🎈' },
  'HOME CONGREGATE': { color: '#facc15', icon: '🏠' },
  VENTURE: { color: '#facc15', icon: '🔮' },
  'VENTURE CARD': { color: '#facc15', icon: '🔮' },
  'VENTURE EFFECT': { color: '#facc15', icon: '🔮' },
  'VENTURE LINE': { color: '#facc15', icon: '🎰' },
  CASINO: { color: '#facc15', icon: '🎰' },
  DEBT: { color: '#f43f5e', icon: '⚠️' },
  DISTRESS: { color: '#f43f5e', icon: '🚨' },
  BANKRUPT: { color: '#f43f5e', icon: '💀' },
  WIN: { color: '#facc15', icon: '🏆' },
};

// Feed filter categories: tag prefix → bucket.
type FeedFilter = 'all' | 'money' | 'market' | 'moves';
const MONEY_TAGS = ['BUY', 'BUYOUT', 'INVEST', 'RENT', 'DIVIDEND', 'COMMISSION', 'SALARY', 'TAX', 'TAX BONUS', 'DISTRESS', 'DEBT', 'BANKRUPT'];
const MARKET_TAGS = ['STOCK', 'VENTURE', 'VENTURE CARD', 'VENTURE EFFECT', 'VENTURE LINE', 'CASINO', 'BREAK', 'WIN'];

function feedCategory(msg: string): Exclude<FeedFilter, 'all'> {
  const tag = msg.match(/^\[([^\]]+)\]/)?.[1];
  if (tag) {
    if (MONEY_TAGS.includes(tag)) return 'money';
    if (MARKET_TAGS.includes(tag)) return 'market';
    return 'moves';   // TURN, LAND, CHECKPOINT, TELEPORT, HOME CONGREGATE…
  }
  return 'moves';     // untagged: rolls, suit pickups, lobby notes
}

export function PlayerStats({ state, playerId }: Props) {
  const logEndRef = useRef<HTMLDivElement>(null);
  const [feedOpen, setFeedOpen] = useState(true);
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');

  // Auto-scroll logs to bottom on new updates
  useEffect(() => {
    if (feedOpen) logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state?.log, feedOpen]);

  if (!state) return null;

  // Helper to colorize log lines based on action types
  const renderLogMessage = (msg: string, key: number) => {
    let color = '#94a3b8'; // default cool slate grey
    let icon = '✦';

    const tagMatch = msg.match(/^\[([^\]]+)\]/);
    const tagStyle = tagMatch ? LOG_TAG_STYLE[tagMatch[1]] : undefined;
    if (tagStyle) {
      ({ color, icon } = tagStyle);
    } else if (msg.includes('rolled')) {
      color = '#e2e8f0';
      icon = '🎲';
    } else if (msg.includes('bought') || msg.includes('invested')) {
      color = '#06b6d4';
      icon = '📈';
    } else if (msg.includes('paid') || msg.includes('rent') || msg.includes('bankrupt')) {
      color = '#f43f5e';
      icon = '🚨';
    } else if (msg.includes('salary') || msg.includes('promotion') || msg.includes('suit')) {
      color = '#10b981';
      icon = '✨';
    } else if (msg.includes('Venture') || msg.includes('WARP')) {
      color = '#facc15';
      icon = '🔮';
    }

    return (
      <div
        key={key}
        style={{
          fontSize: '11px', 
          lineHeight: '1.4', 
          color, 
          fontFamily: "'JetBrains Mono', monospace",
          padding: '4px 8px',
          background: 'rgba(255, 255, 255, 0.01)',
          borderLeft: `2px solid ${color}88`,
          borderRadius: '0 4px 4px 0',
          display: 'flex',
          gap: '6px',
          alignItems: 'flex-start',
          animation: 'fade-in 0.2s ease-out'
        }}
      >
        <span style={{ fontSize: '10px', opacity: 0.8 }}>{icon}</span>
        <span>{msg}</span>
      </div>
    );
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'rgba(8, 8, 16, 0.45)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderLeft: '1px solid rgba(255, 255, 255, 0.06)',
      display: 'flex',
      flexDirection: 'column',
      color: '#f1f5f9',
      fontFamily: "'Outfit', sans-serif",
      overflow: 'hidden',
    }}>
      {/* 1. Scrollable Player Info Panel (hugs content; feed absorbs leftover space) */}
      <div style={{
        flex: '0 1 auto',
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}>
        {/* Header Panel */}
        <div style={{
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          paddingBottom: '10px',
          marginBottom: '2px',
        }}>
          <div style={{
            fontSize: '10px',
            fontWeight: 800,
            letterSpacing: '2.5px',
            color: '#64748b',
            textTransform: 'uppercase',
            marginBottom: '4px',
            fontFamily: "'Unbounded', sans-serif",
          }}>
            SYSTEM MONITOR
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}>
            <span style={{
              fontSize: '20px',
              fontWeight: 800,
              background: 'linear-gradient(135deg, #fde047 0%, #22d3ee 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Round {state.round}
            </span>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              color: '#facc15',
              textShadow: '0 0 8px rgba(250, 204, 21, 0.25)',
              fontWeight: 700,
            }}>
              TARGET: {g(state.targetNetWorth)}
            </span>
          </div>
        </div>

        {/* Players List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {state.turnOrder.map((pid, idx) => {
            const player   = state.players[pid];
            const isActive = pid === state.currentPlayerId;
            const isSelf   = pid === playerId;
            const playerColor = PLAYER_CSS_COLORS[idx % PLAYER_CSS_COLORS.length];
            
            const pct      = Math.min(1, Math.max(0, player.netWorth / state.targetNetWorth));
            const near     = pct >= 0.8;

            return (
              <div
                key={pid}
                style={{
                  position: 'relative',
                  borderRadius: '12px',
                  padding: '12px',
                  background: isActive 
                    ? 'linear-gradient(135deg, rgba(26, 21, 44, 0.75) 0%, rgba(10, 10, 22, 0.9) 100%)' 
                    : 'rgba(255, 255, 255, 0.02)',
                  border: isActive
                    ? `1px solid ${playerColor}88`
                    : '1px solid rgba(255, 255, 255, 0.04)',
                  boxShadow: isActive 
                    ? `0 0 15px ${playerColor}20` 
                    : 'none',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                {/* Active Pulsing Indicator Badge */}
                {isActive && (
                  <div style={{
                    position: 'absolute',
                    top: '-6px',
                    left: '12px',
                    background: playerColor,
                    color: '#06060c',
                    fontSize: '8px',
                    fontWeight: 900,
                    padding: '2px 8px',
                    borderRadius: '20px',
                    letterSpacing: '0.8px',
                    boxShadow: `0 0 8px ${playerColor}`,
                    animation: 'pulse-purple 2s infinite',
                  }}>
                    ACTIVE TURN
                  </div>
                )}

                {/* Name Row */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px',
                  marginTop: isActive ? '2px' : '0px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: playerColor,
                      boxShadow: `0 0 8px ${playerColor}`,
                    }} />
                    <span style={{ 
                      fontWeight: 700, 
                      fontSize: '13px',
                      color: isActive ? '#ffffff' : '#cbd5e1',
                    }}>
                      {player.name}
                      {isSelf && (
                        <span style={{ 
                          fontSize: '8px', 
                          fontWeight: 500, 
                          color: 'rgba(255,255,255,0.35)', 
                          marginLeft: '4px',
                          verticalAlign: 'middle',
                          border: '1px solid rgba(255,255,255,0.1)',
                          padding: '1px 3px',
                          borderRadius: '3px',
                        }}>
                          YOU
                        </span>
                      )}
                    </span>
                    {player.isBankrupt && (
                      <span style={{ 
                        backgroundColor: 'rgba(244, 63, 94, 0.15)', 
                        color: '#f43f5e', 
                        fontSize: '7.5px',
                        fontWeight: 800,
                        padding: '1px 5px',
                        borderRadius: '4px',
                        border: '1px solid rgba(244, 63, 94, 0.3)'
                      }}>
                        BANKRUPT
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {state.lastRoll && state.lastRoll[pid] !== undefined && (
                      <span style={{ 
                        fontSize: '9.5px', 
                        fontWeight: 800, 
                        color: '#facc15',
                        backgroundColor: 'rgba(250, 204, 21, 0.1)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        border: '1px solid rgba(250, 204, 21, 0.25)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        boxShadow: '0 0 6px rgba(250, 204, 21, 0.15)',
                      }}>
                        🎲 {state.lastRoll[pid]}
                      </span>
                    )}
                    <span style={{ 
                      fontSize: '9px', 
                      fontWeight: 700, 
                      color: '#64748b',
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      padding: '2px 5px',
                      borderRadius: '4px',
                      border: '1px solid rgba(255, 255, 255, 0.02)',
                    }}>
                      LVL {player.level}
                    </span>
                  </div>
                </div>

                {/* Cash & Net Worth Row */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr', 
                  gap: '8px', 
                  marginBottom: '10px',
                }}>
                  {/* Cash Box */}
                  <div style={{
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.03)',
                    padding: '6px 8px',
                    borderRadius: '8px',
                  }}>
                    <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>CASH</div>
                    <div style={{ 
                      fontFamily: "'JetBrains Mono', monospace", 
                      fontSize: '12px', 
                      fontWeight: 700,
                      color: '#10b981',
                    }}>
                      {g(player.cash)}
                    </div>
                  </div>

                  {/* Net Worth Box */}
                  <div style={{
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.03)',
                    padding: '6px 8px',
                    borderRadius: '8px',
                  }}>
                    <div style={{ fontSize: '8px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '2px' }}>NET WORTH</div>
                    <div style={{ 
                      fontFamily: "'JetBrains Mono', monospace", 
                      fontSize: '12px', 
                      fontWeight: 700,
                      color: near ? '#10b981' : '#e2e8f0',
                      textShadow: near ? '0 0 6px rgba(16, 185, 129, 0.3)' : 'none',
                    }}>
                      {g(player.netWorth)}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ 
                    height: '5px', 
                    background: 'rgba(255, 255, 255, 0.03)', 
                    borderRadius: '3px', 
                    overflow: 'hidden',
                    border: '1px solid rgba(255, 255, 255, 0.01)',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${pct * 100}%`,
                      background: near 
                        ? 'linear-gradient(90deg, #10b981 0%, #34d399 100%)' 
                        : `linear-gradient(90deg, #fde047 0%, ${playerColor} 100%)`,
                      borderRadius: '3px',
                      transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: near ? '0 0 6px rgba(16, 185, 129, 0.4)' : 'none',
                    }} />
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    fontSize: '8.5px', 
                    color: '#475569', 
                    marginTop: '4px',
                    fontWeight: 600,
                  }}>
                    <span>TARGET METER</span>
                    <span style={{ color: near ? '#10b981' : '#64748b' }}>
                      {Math.round(pct * 100)}%
                    </span>
                  </div>
                </div>

                {/* Suits Collected Row */}
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  paddingTop: '8px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.03)',
                  marginBottom: '4px',
                }}>
                  <span style={{ fontSize: '8.5px', fontWeight: 700, color: '#475569', letterSpacing: '0.5px' }}>SUITS:</span>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {(['heart', 'diamond', 'club', 'spade'] as const).map(suit => {
                      const collected = player.suits[suit];
                      const sColor = SUIT_COLOR[suit];

                      return (
                        <div
                          key={suit}
                          title={`${SUIT_NAME[suit]} ${collected ? 'Collected' : 'Missing'}`}
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: collected ? '11px' : '10px',
                            backgroundColor: collected ? `${sColor}18` : 'rgba(255, 255, 255, 0.01)',
                            border: collected 
                              ? `1px solid ${sColor}60` 
                              : '1px solid rgba(255, 255, 255, 0.06)',
                            color: collected ? sColor : 'rgba(255, 255, 255, 0.1)',
                            boxShadow: collected ? `0 0 6px ${sColor}20` : 'none',
                            transition: 'all 0.3s ease',
                          }}
                        >
                          {SUIT_CHAR[suit]}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Stock Holdings breakdown */}
                {Object.values(state.districts).some(d => (d.playerHoldings[pid] ?? 0) > 0) && (
                  <div style={{ 
                    marginTop: '6px',
                    paddingTop: '6px', 
                    borderTop: '1px solid rgba(255, 255, 255, 0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}>
                    <div style={{ fontSize: '8px', fontWeight: 800, color: '#475569', marginBottom: '2px' }}>STOCK HOLDINGS</div>
                    {Object.values(state.districts)
                      .filter(d => (d.playerHoldings[pid] ?? 0) > 0)
                      .map(d => (
                        <div 
                          key={d.id} 
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            fontSize: '10px', 
                            color: '#94a3b8',
                            background: 'rgba(255, 255, 255, 0.01)',
                            padding: '3px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: districtColorHex(d.id, state.districts),
                              flexShrink: 0,
                            }} />
                            {d.name}
                          </span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                            <strong style={{ color: '#cbd5e1' }}>{d.playerHoldings[pid]}sh</strong> · {g(d.stockPrice)}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Bottom Activity logs Feed (collapsible; grows into unused sidebar space) */}
      <div style={{
        flex: feedOpen ? '1 1 240px' : '0 0 auto',
        minHeight: feedOpen ? 180 : undefined,
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(5, 5, 10, 0.4)',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        overflow: 'hidden',
      }}>
        {/* Logs title header (click to collapse/expand) */}
        <div
          onClick={() => setFeedOpen(o => !o)}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '2px',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <div style={{
            fontSize: '9.5px',
            fontWeight: 800,
            letterSpacing: '1px',
            color: '#22d3ee',
            textTransform: 'uppercase',
            fontFamily: "'Unbounded', sans-serif",
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#22d3ee',
              boxShadow: '0 0 6px rgba(34, 211, 238, 0.8)',
              animation: 'spin 4s linear infinite',
            }} />
            TACTICAL ANALYSIS FEED
            <span style={{ color: '#64748b', fontSize: '9px' }}>{feedOpen ? '▾' : '▸'}</span>
          </div>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '8.5px',
            color: '#475569'
          }}>
            {state.log.length} EVENTS
          </span>
        </div>

        {/* Filter chips */}
        {feedOpen && (
          <div style={{ display: 'flex', gap: '4px' }}>
            {([['all', 'All'], ['money', '💰 Money'], ['market', '📈 Market'], ['moves', '🎲 Moves']] as const).map(([f, label]) => (
              <button
                key={f}
                onClick={() => setFeedFilter(f)}
                style={{
                  padding: '2px 9px',
                  borderRadius: 10,
                  fontSize: '9px',
                  fontWeight: 800,
                  letterSpacing: '0.5px',
                  cursor: 'pointer',
                  background: feedFilter === f ? 'rgba(34, 211, 238, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  color: feedFilter === f ? '#22d3ee' : '#64748b',
                  border: feedFilter === f ? '1px solid rgba(34, 211, 238, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Scrolling logs container */}
        {feedOpen && (
          <div style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            paddingRight: '2px',
          }}>
            {state.log
              .map((line, i) => [line, i] as const)
              .filter(([line]) => feedFilter === 'all' || feedCategory(line) === feedFilter)
              .map(([line, i]) => renderLogMessage(line, i))}
            <div ref={logEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
