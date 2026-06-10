import { useState } from 'react';
import type { GameState, Action, Property, BuildingType } from '../../shared/types';
import { districtColorHex } from '../districtColors';

interface Props {
  state: GameState;
  emitAction: (action: Action) => void;
  playerId: string;
}

function g(n: number) { return `${n}G`; }

export function StockExchange({ state, emitAction, playerId }: Props) {
  const [inputs, setInputs] = useState<Record<string, string>>({});

  const myVacantPlots = Object.values(state.properties).filter(
    p => p.ownerId === playerId && p.buildingType !== undefined
  );
  const [selectedPlotId, setSelectedPlotId] = useState<string>(myVacantPlots[0]?.id ?? '');

  const activePlotId = myVacantPlots.some(p => p.id === selectedPlotId)
    ? selectedPlotId
    : (myVacantPlots[0]?.id ?? '');

  const activePlot = state.properties[activePlotId];

  const isActive = playerId === state.currentPlayerId;
  const currentPlayer = state.players[playerId];

  // Only districts with holdings get full sell cards; the rest collapse to
  // compact price pills so the desk doesn't waste rows on unsellable stock.
  const allDistricts = Object.values(state.districts);
  const heldDistricts = allDistricts.filter(d => (d.playerHoldings[playerId] ?? 0) > 0);
  const unheldDistricts = allDistricts.filter(d => (d.playerHoldings[playerId] ?? 0) === 0);

  function val(did: string) {
    return inputs[did] ?? '';
  }

  function setVal(did: string, v: string) {
    setInputs(prev => ({ ...prev, [did]: v }));
  }

  function handleSell(did: string, max: number) {
    const raw = parseInt(val(did), 10);
    const shares = Math.max(1, Math.min(max, raw));
    if (!shares) return;
    emitAction({ type: 'SELL_STOCK', districtId: did, shares });
    setVal(did, '');
  }

  function handleQuickSell(did: string, amount: number, max: number) {
    const shares = Math.min(max, amount);
    if (shares <= 0) return;
    emitAction({ type: 'SELL_STOCK', districtId: did, shares });
  }

  function handleRoll() {
    emitAction({ type: 'ROLL_DICE' });
  }

  return (
    <div style={{
      width: '100%',
      maxWidth: '680px',
      background: 'rgba(10, 10, 22, 0.65)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(250, 204, 21, 0.12)',
      borderRadius: 16,
      padding: '16px 20px',
      color: '#f1f5f9',
      fontFamily: "'Outfit', sans-serif",
      boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }} className="animate-slide-up">
      {/* Title / Header Block */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        paddingBottom: '8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '15px',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #fde047 0%, #22d3ee 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '0.5px',
          }}>
            PORTFOLIO & STOCK DESK
          </span>
          {!isActive && (
            <span style={{ 
              fontSize: '11px', 
              color: '#64748b', 
              fontWeight: 600
            }}>
              (Waiting for {state.players[state.currentPlayerId]?.name})
            </span>
          )}
        </div>
        <div style={{
          fontSize: '9px',
          fontWeight: 800,
          letterSpacing: '1px',
          color: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.1)',
          padding: '3px 8px',
          borderRadius: '4px',
          border: '1px solid rgba(6, 182, 212, 0.2)',
        }}>
          PRE-ROLL PHASE
        </div>
      </div>

      {/* Mini Tip */}
      <div style={{
        fontSize: '11px',
        color: '#94a3b8',
        lineHeight: '1.4',
        background: 'rgba(255,255,255,0.01)',
        border: '1px solid rgba(255,255,255,0.03)',
        padding: '6px 10px',
        borderRadius: '6px',
      }}>
        💡 <strong>Liquidation:</strong> Sell shares to convert stock equity to liquid cash. Selling <strong>10+ shares</strong> triggers a market drop: <code>-{g(Math.floor((Object.values(state.districts)[0]?.stockPrice ?? 10) / 16) + 1)}/sh</code>.
      </div>

      {/* Grid of Districts - 2 column layout for console compactness */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '10px',
      }}>
        {heldDistricts.map(d => {
          const held = d.playerHoldings[playerId] ?? 0;
          const sellQty = parseInt(val(d.id), 10) || 0;
          const sellable = isActive && held > 0;
          const showWarn = sellable && sellQty >= 10;

          return (
            <div 
              key={d.id} 
              style={{
                borderRadius: '10px',
                padding: '10px',
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid rgba(255, 255, 255, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                justifyContent: 'space-between',
              }}
            >
              {/* Internal title/price line */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: districtColorHex(d.id, state.districts),
                  }} />
                  <strong style={{ fontSize: '12px', color: '#f8fafc' }}>{d.name}</strong>
                </div>
                <div style={{ display: 'flex', gap: '8px', fontSize: '10px' }}>
                  <span style={{ color: '#64748b' }}>
                    VAL: <strong style={{ color: '#06b6d4' }}>{g(d.stockPrice)}</strong>
                  </span>
                  <span style={{ color: '#64748b' }}>
                    HELD: <strong style={{ color: held > 0 ? '#cbd5e1' : '#475569' }}>{held}</strong>
                  </span>
                </div>
              </div>

              {/* Action area */}
              {held > 0 ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  paddingTop: '6px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.02)',
                }}>
                  {/* Quick Buttons */}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => handleQuickSell(d.id, 10, held)}
                      disabled={!sellable}
                      style={quickBtnStyle(sellable && held >= 10)}
                    >
                      Sell 10
                    </button>
                    <button
                      onClick={() => handleQuickSell(d.id, 50, held)}
                      disabled={!sellable}
                      style={quickBtnStyle(sellable && held >= 50)}
                    >
                      Sell 50
                    </button>
                    <button
                      onClick={() => handleQuickSell(d.id, held, held)}
                      disabled={!sellable}
                      style={quickBtnStyle(sellable)}
                    >
                      Max
                    </button>
                  </div>

                  {/* Manual input */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number"
                      min="1"
                      max={held}
                      value={val(d.id)}
                      onChange={e => {
                        const clamped = Math.max(1, Math.min(held, parseInt(e.target.value, 10) || 1));
                        setVal(d.id, e.target.value === '' ? '' : String(clamped));
                      }}
                      disabled={!sellable}
                      placeholder={`1–${held}`}
                      style={{
                        flex: 1,
                        background: 'rgba(0, 0, 0, 0.3)',
                        color: '#f8fafc',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '4px',
                        padding: '3px 6px',
                        fontSize: '11px',
                        fontFamily: "'JetBrains Mono', monospace",
                        textAlign: 'center',
                      }}
                    />
                    <button
                      onClick={() => handleSell(d.id, held)}
                      disabled={!sellable || sellQty <= 0}
                      style={actionBtnStyle(sellable && sellQty > 0)}
                    >
                      Sell
                    </button>
                  </div>

                  {/* Profit yield warning */}
                  {sellQty > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginTop: '2px' }}>
                      <span style={{ color: '#10b981' }}>Yield: +{g(sellQty * d.stockPrice)}</span>
                      {showWarn && <span style={{ color: '#f59e0b' }}>⚠ Price Drop</span>}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '10px', color: '#475569', fontStyle: 'italic', paddingTop: '2px' }}>
                  No district shares held in assets.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Districts without holdings: compact price pills instead of empty cards */}
      {unheldDistricts.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          {heldDistricts.length === 0 && (
            <span style={{ fontSize: '10px', color: '#475569', fontStyle: 'italic', marginRight: '4px' }}>
              No shares held — buy at the Bank or a Stockbroker. Prices:
            </span>
          )}
          {unheldDistricts.map(d => (
            <span
              key={d.id}
              style={{
                fontSize: '10px',
                color: districtColorHex(d.id, state.districts),
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.04)',
                borderRadius: '10px',
                padding: '2px 8px',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {d.name} <strong style={{ color: '#cbd5e1' }}>{g(d.stockPrice)}</strong>
            </span>
          ))}
        </div>
      )}

      {/* 🏗️ Plot Renovation Portal */}
      {myVacantPlots.length > 0 && (
        <div style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          paddingTop: '12px',
          marginTop: '4px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '12px',
              fontWeight: 800,
              color: '#c084fc',
              textShadow: '0 0 10px rgba(168, 85, 247, 0.25)',
              letterSpacing: '0.5px',
            }}>
              🏗️ PLOT RENOVATION CENTER
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>SELECT PLOT:</span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {myVacantPlots.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlotId(p.id)}
                  disabled={!isActive}
                  style={{
                    background: activePlotId === p.id ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.02)',
                    border: activePlotId === p.id ? '1px solid #22d3ee' : '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '6px',
                    padding: '3px 8px',
                    fontSize: '10.5px',
                    fontWeight: 700,
                    color: activePlotId === p.id ? '#f8fafc' : '#cbd5e1',
                    cursor: isActive ? 'pointer' : 'default',
                    transition: 'all 0.2s',
                  }}
                >
                  {p.id.toUpperCase()} ({p.buildingType?.toUpperCase()})
                </button>
              ))}
            </div>
          </div>

          {activePlot && (
            <div style={{
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255,255,255,0.03)',
              borderRadius: '12px',
              padding: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <div style={{ fontSize: '11px', color: '#cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div>
                  Currently: <strong style={{ color: '#22d3ee' }}>{activePlot.buildingType?.toUpperCase()}</strong> in <strong style={{ color: '#06b6d4' }}>{state.districts[activePlot.districtId]?.name}</strong>
                </div>
                <span style={{ fontSize: '9px', color: '#64748b' }}>
                  Renovation includes <span style={{ color: '#f59e0b', fontWeight: 600 }}>150G surcharge</span>
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                {([
                  { type: 'checkpoint', name: 'Checkpoint', cost: 350, icon: '🛃', desc: 'Toll booth (200G+; increases +10G per pass)' },
                  { type: 'circus', name: 'Circus', cost: 350, icon: '🎪', desc: 'Flat rent tent (100G-2000G expanded via investments)' },
                  { type: 'balloonport', name: 'Balloonport', cost: 350, icon: '🎈', desc: 'Teleport square + flat 200G rent payout' },
                  { type: 'tax_office', name: 'Tax Office', cost: 350, icon: '🏛️', desc: 'Levies 10% visitor net worth; pays owner 5% bonus' },
                  { type: 'home', name: 'Home', cost: 350, icon: '🏠', desc: 'Congregates all other players to this space' },
                  { type: 'estate_agency', name: 'Estate Agency', cost: 350, icon: '🏢', desc: 'Enables remote purchase of unowned shops' },
                  { type: 'three_star_shop', name: '3-Star Shop', cost: 1150, icon: '⭐⭐⭐', desc: 'Premium shop (80G base, district counts, 2k cap)' }
                ] as const)
                  .filter(opt => opt.type !== activePlot.buildingType)
                  .map(opt => {
                    const canAfford = currentPlayer.cash >= opt.cost;
                    const renovateDisabled = !isActive || !canAfford;

                    return (
                      <div
                        key={opt.type}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'rgba(255, 255, 255, 0.01)',
                          border: '1px solid rgba(255, 255, 255, 0.03)',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          gap: '6px',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '11px' }}>{opt.icon}</span>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#f8fafc' }}>{opt.name}</span>
                            <span style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: '10px',
                              fontWeight: 700,
                              color: canAfford ? '#10b981' : '#f43f5e',
                            }}>
                              ({opt.cost}G)
                            </span>
                          </div>
                          <span style={{ fontSize: '9.5px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.desc}</span>
                        </div>
                        <button
                          onClick={() => emitAction({ type: 'RENOVATE_PLOT', propertyId: activePlot.id, buildingType: opt.type })}
                          disabled={renovateDisabled}
                          style={{
                            background: renovateDisabled ? 'rgba(255, 255, 255, 0.01)' : 'linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)',
                            color: renovateDisabled ? '#475569' : '#ffffff',
                            boxShadow: renovateDisabled ? 'none' : '0 2px 6px rgba(168, 85, 247, 0.25)',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '4px 10px',
                            fontSize: '10px',
                            fontWeight: 800,
                            cursor: renovateDisabled ? 'default' : 'pointer',
                            transition: 'all 0.2s',
                          }}
                        >
                          Renovate
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Done - Roll Dice Launcher */}
      <button
        onClick={handleRoll}
        disabled={!isActive}
        style={{
          width: '100%',
          padding: '10px 0',
          background: isActive
            ? 'linear-gradient(135deg, #fde047 0%, #f59e0b 100%)'
            : 'rgba(255, 255, 255, 0.02)',
          color: isActive ? '#190f00' : '#475569',
          border: isActive ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: 8,
          cursor: isActive ? 'pointer' : 'default',
          fontSize: '13px',
          fontWeight: 800,
          letterSpacing: '1px',
          boxShadow: isActive ? '0 4px 14px rgba(245, 158, 11, 0.35)' : 'none',
          textTransform: 'uppercase',
          transition: 'all 0.2s ease',
        }}
      >
        Done — Launch Die →
      </button>
    </div>
  );
}

// Styling Helpers
function quickBtnStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    background: active ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.01)',
    color: active ? '#cbd5e1' : '#475569',
    border: active ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(255, 255, 255, 0.02)',
    borderRadius: 4,
    padding: '2px 4px',
    fontSize: '9.5px',
    fontWeight: 600,
    cursor: active ? 'pointer' : 'default',
    transition: 'all 0.2s ease',
  };
}

function actionBtnStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? '#f43f5e' : 'rgba(255, 255, 255, 0.02)',
    color: active ? '#ffffff' : '#475569',
    border: 'none',
    borderRadius: 4,
    padding: '3px 10px',
    fontSize: '11px',
    fontWeight: 700,
    cursor: active ? 'pointer' : 'default',
    boxShadow: active ? '0 2px 6px rgba(244, 63, 94, 0.2)' : 'none',
    transition: 'all 0.2s ease',
  };
}
