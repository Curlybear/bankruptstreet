import { useState } from 'react';
import type { GameState, Property, Action } from '../../shared/types';

interface Props {
  state: GameState;
  property: Property;
  emitAction: (action: Action) => void;
  playerId: string;
}

function g(n: number) { return `${n}G`; }

const MAX_INVEST = 999;

function projectedRent(prop: Property, extra: number): number {
  const newCapital = prop.capitalInvested + extra;
  return Math.floor((prop.baseRent + Math.floor(newCapital / 10)) * prop.shopMultiplier);
}

export function ShopManagement({ state, property, emitAction, playerId }: Props) {
  const [amount, setAmount] = useState('');

  const isActive = playerId === state.currentPlayerId;
  const remaining = property.maxCapital - property.capitalInvested;
  const maxInput = Math.min(Math.min(MAX_INVEST, remaining), state.players[playerId]?.cash ?? 0);
  const district = state.districts[property.districtId];
  const fullyDone = remaining <= 0;
  const canInvest = isActive && !fullyDone && maxInput > 0;

  const parsed = parseInt(amount, 10);
  const validAmt = !isNaN(parsed) && parsed >= 1 && parsed <= maxInput;
  const projected = validAmt ? projectedRent(property, parsed) : null;

  const progressPct = Math.min(100, (property.capitalInvested / property.maxCapital) * 100);

  function handleInvest() {
    if (!validAmt) return;
    emitAction({ type: 'INVEST', propertyId: property.id, amount: parsed });
    setAmount('');
  }

  function handleQuickAdd(val: number) {
    if (!isActive) return;
    const current = parseInt(amount, 10) || 0;
    const next = Math.max(1, Math.min(maxInput, current + val));
    setAmount(String(next));
  }

  function handleSetMax() {
    if (!isActive) return;
    setAmount(String(maxInput));
  }

  function handleChange(v: string) {
    if (v === '') { setAmount(''); return; }
    const n = parseInt(v, 10);
    if (isNaN(n)) return;
    setAmount(String(Math.max(1, Math.min(maxInput, n))));
  }

  return (
    <div style={{
      width: '100%',
      maxWidth: '520px',
      background: 'rgba(10, 10, 22, 0.65)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(16, 185, 129, 0.25)',
      borderRadius: 16,
      padding: '20px 24px',
      color: '#f1f5f9',
      fontFamily: "'Outfit', sans-serif",
      boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }} className="animate-slide-up glow-border-success">
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        paddingBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: 18,
            fontWeight: 800,
            color: '#10b981',
            textShadow: '0 0 10px rgba(16, 185, 129, 0.3)',
          }}>
            {property.id.toUpperCase()}
          </span>
          {district && (
            <span style={{ 
              fontWeight: 600, 
              color: '#64748b', 
              fontSize: 12
            }}>
              {district.name.toUpperCase()} DISTRICT
            </span>
          )}
        </div>
        <span style={{
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: '1px',
          color: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          padding: '3px 8px',
          borderRadius: 6,
          border: '1px solid rgba(16, 185, 129, 0.2)'
        }}>
          OWN UPGRADE PORTAL
        </span>
      </div>

      {/* Grid of Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
      }}>
        {/* Current Rent Card */}
        <div style={statBoxStyle('rgba(255,255,255,0.01)')}>
          <div style={labelStyle}>CURRENT RENT</div>
          <div style={{ 
            fontFamily: "'JetBrains Mono', monospace", 
            fontSize: 16, 
            fontWeight: 700, 
            color: '#38bdf8' 
          }}>
            {g(property.currentRent)}
          </div>
        </div>

        {/* Projected Rent Card */}
        <div style={statBoxStyle(projected ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255,255,255,0.01)')}>
          <div style={labelStyle}>PROJECTED RENT</div>
          {projected !== null && projected !== property.currentRent ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <div style={{ 
                fontFamily: "'JetBrains Mono', monospace", 
                fontSize: 16, 
                fontWeight: 700, 
                color: '#34d399',
                textShadow: '0 0 10px rgba(52, 211, 153, 0.2)'
              }}>
                {g(projected)}
              </div>
              <span style={{ fontSize: 10, color: '#10b981', fontWeight: 700 }}>
                (+{g(projected - property.currentRent)})
              </span>
            </div>
          ) : (
            <div style={{ 
              fontFamily: "'JetBrains Mono', monospace", 
              fontSize: 16, 
              fontWeight: 700, 
              color: '#475569' 
            }}>
              —
            </div>
          )}
        </div>

        {/* Capital Invested Card */}
        <div style={statBoxStyle('rgba(255,255,255,0.01)')}>
          <div style={labelStyle}>CAPITAL INVESTED</div>
          <div style={{ 
            fontFamily: "'JetBrains Mono', monospace", 
            fontSize: 13, 
            fontWeight: 700, 
            color: '#cbd5e1' 
          }}>
            {g(property.capitalInvested)} / {g(property.maxCapital)}
          </div>
        </div>

        {/* Remaining Investment Room */}
        <div style={statBoxStyle('rgba(255,255,255,0.01)')}>
          <div style={labelStyle}>REMAINING ROOM</div>
          <div style={{ 
            fontFamily: "'JetBrains Mono', monospace", 
            fontSize: 13, 
            fontWeight: 700, 
            color: fullyDone ? '#475569' : '#10b981' 
          }}>
            {fullyDone ? 'FULLY MAXED' : g(remaining)}
          </div>
        </div>
      </div>

      {/* Capital Capacity Progress Bar */}
      <div>
        <div style={{ 
          height: 6, 
          background: 'rgba(255, 255, 255, 0.05)', 
          borderRadius: 3, 
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.02)',
        }}>
          <div style={{
            height: '100%',
            borderRadius: 3,
            background: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)',
            width: `${progressPct}%`,
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 0 8px rgba(16, 185, 129, 0.3)',
          }} />
        </div>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          fontSize: 9, 
          color: '#475569', 
          marginTop: 4,
          fontWeight: 600,
        }}>
          <span>SHOP CAPACITY LIMITS</span>
          <span style={{ color: fullyDone ? '#10b981' : '#64748b' }}>
            {Math.round(progressPct)}%
          </span>
        </div>
      </div>

      {/* Capital investment controls */}
      {fullyDone ? (
        <div style={{
          textAlign: 'center',
          padding: '10px 0',
          color: '#34d399',
          fontSize: 12.5,
          fontWeight: 700,
          background: 'rgba(16, 185, 129, 0.05)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: 8,
        }}>
          ✨ This property has reached its maximum capital capacity.
        </div>
      ) : maxInput <= 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '10px 0',
          color: '#f87171',
          fontSize: 12,
          fontWeight: 600,
          background: 'rgba(239, 68, 68, 0.05)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: 8,
        }}>
          ❌ Out of cash! (Cash: {g(state.players[playerId]?.cash ?? 0)})
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Quick Increment Buttons */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => handleQuickAdd(50)} disabled={!canInvest} style={quickBtnStyle(canInvest)}>
              +50G
            </button>
            <button onClick={() => handleQuickAdd(100)} disabled={!canInvest} style={quickBtnStyle(canInvest)}>
              +100G
            </button>
            <button onClick={() => handleQuickAdd(500)} disabled={!canInvest} style={quickBtnStyle(canInvest)}>
              +500G
            </button>
            <button onClick={handleSetMax} disabled={!canInvest} style={quickBtnStyle(canInvest)}>
              Max ({g(maxInput)})
            </button>
          </div>

          {/* Input field + Invest action */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              min="1"
              max={maxInput}
              value={amount}
              onChange={e => handleChange(e.target.value)}
              disabled={!canInvest}
              placeholder={`Amount to invest…`}
              style={{
                flex: 1,
                background: 'rgba(0, 0, 0, 0.4)',
                color: '#f8fafc',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 12.5,
                fontFamily: "'JetBrains Mono', monospace",
                outline: 'none',
                transition: 'border 0.2s',
              }}
            />
            <button
              onClick={handleInvest}
              disabled={!canInvest || !validAmt}
              style={{
                background: canInvest && validAmt 
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                  : 'rgba(255,255,255,0.02)',
                color: canInvest && validAmt ? '#ffffff' : '#475569',
                border: 'none',
                borderRadius: 8,
                padding: '0 16px',
                cursor: canInvest && validAmt ? 'pointer' : 'default',
                fontWeight: 700,
                fontSize: 13,
                boxShadow: canInvest && validAmt ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              Invest
            </button>
          </div>
        </div>
      )}

      {/* Done / Skip button */}
      <button
        onClick={() => emitAction({ type: 'END_TURN' })}
        disabled={!isActive}
        style={{
          width: '100%',
          padding: '10px 0',
          background: 'rgba(255, 255, 255, 0.02)',
          color: isActive ? '#94a3b8' : '#475569',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: 8,
          cursor: isActive ? 'pointer' : 'default',
          fontWeight: 600,
          fontSize: 12.5,
          transition: 'all 0.2s ease',
        }}
      >
        Skip (End Turn)
      </button>
    </div>
  );
}

// Styling helpers
function statBoxStyle(bg: string): React.CSSProperties {
  return {
    background: bg,
    border: '1px solid rgba(255, 255, 255, 0.03)',
    padding: '8px 12px',
    borderRadius: 8,
  };
}

const labelStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  color: '#64748b',
  letterSpacing: '0.5px',
  marginBottom: 4,
};

function quickBtnStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    background: active ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.01)',
    color: active ? '#cbd5e1' : '#475569',
    border: active ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(255, 255, 255, 0.02)',
    borderRadius: 6,
    padding: '4px 6px',
    fontSize: 10.5,
    fontWeight: 600,
    cursor: active ? 'pointer' : 'default',
    transition: 'all 0.2s ease',
  };
}
