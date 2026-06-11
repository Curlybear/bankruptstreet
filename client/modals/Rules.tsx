// In-game rules reference. Content mirrors RULES.md — update both together.

interface Props {
  onClose: () => void;
}

const h2: React.CSSProperties = {
  fontSize: 14, fontWeight: 800, color: '#facc15', letterSpacing: '1px',
  textTransform: 'uppercase', margin: '18px 0 8px',
};
const p: React.CSSProperties = { fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.55, margin: '6px 0' };
const td: React.CSSProperties = { padding: '5px 10px', fontSize: 12, color: '#cbd5e1', borderBottom: '1px solid rgba(255,255,255,0.05)', verticalAlign: 'top' };
const tdKey: React.CSSProperties = { ...td, fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap' };
const hl: React.CSSProperties = { color: '#10b981', fontWeight: 700 };

export function Rules({ onClose }: Props) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(3, 3, 8, 0.85)',
      backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)',
      zIndex: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: 'rgba(12, 12, 26, 0.97)',
        border: '1px solid rgba(250, 204, 21, 0.2)',
        borderRadius: 20, padding: '24px 30px',
        width: '100%', maxWidth: 760, maxHeight: '88vh', overflowY: 'auto',
        color: '#f8fafc', fontFamily: "'Outfit', sans-serif",
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 30px rgba(250, 204, 21, 0.08)',
      }} className="animate-slide-up">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, letterSpacing: '1px', color: '#facc15' }}>
            📜 HOW TO PLAY
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '50%', width: 32, height: 32, display: 'flex',
              alignItems: 'center', justifyContent: 'center', color: '#94a3b8',
              cursor: 'pointer', fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>

        <div style={h2}>Goal</div>
        <div style={p}>
          Reach the <span style={hl}>target net worth</span> (cash + stocks + shop values), then{' '}
          <span style={hl}>return to the bank</span> — landing on it or walking past it both count.
          The game also ends instantly if anyone goes bankrupt: richest survivor wins.
        </div>

        <div style={h2}>Your Turn</div>
        <div style={p}>
          <strong>1.</strong> Before rolling: sell stock, renovate your plots.{' '}
          <strong>2.</strong> Roll and move — you pick the direction at forks; no reversing mid-move,
          and no starting back the way you came last turn (unless trapped).{' '}
          <strong>3.</strong> Resolve the square you land on.
          Suits you walk over are collected automatically; passing the bank earns a stock-buying
          chance, your salary (with all 4 suits), and the win check.
        </div>

        <div style={h2}>Squares</div>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}><tbody>
          <tr><td style={tdKey}>🏪 Shop</td><td style={td}>Unowned: buy it. Yours: invest up to 999G/turn. Opponent's: pay rent — or buy them out for 5× value (owner gets 3×)</td></tr>
          <tr><td style={tdKey}>🏦 Bank</td><td style={td}>Salary with all 4 suits; win check; buy stock</td></tr>
          <tr><td style={tdKey}>📈 Stockbroker</td><td style={td}>Buy stock</td></tr>
          <tr><td style={tdKey}>♥ Suit</td><td style={td}>Gain the suit and draw a venture card</td></tr>
          <tr><td style={tdKey}>❓ Venture</td><td style={td}>Draw a venture card from the 8×8 grid</td></tr>
          <tr><td style={tdKey}>🏛️ Tax office</td><td style={td}>Pay 5% of your net worth to the bank</td></tr>
          <tr><td style={tdKey}>☕ Take-a-break</td><td style={td}>All YOUR shops shut until your next turn</td></tr>
          <tr><td style={tdKey}>🍀 Boon</td><td style={td}>Collect 20% of every payment anyone makes until your next turn</td></tr>
          <tr><td style={tdKey}>💰 Boom</td><td style={td}>Same, but a whopping 50%</td></tr>
          <tr><td style={tdKey}>🎰 Casino</td><td style={td}>Wager 10–500G: Slime Derby (pick 1 of 4, pays 4×) or High-Low (call the next card, pays 2×, tie loses). One bet per visit</td></tr>
          <tr><td style={tdKey}>🌀 Warp</td><td style={td}>Teleport to the paired square, keep moving</td></tr>
          <tr><td style={tdKey}>🏗️ Vacant plot</td><td style={td}>Build: three-star shop (1000G), checkpoint, circus, balloonport, tax office, home, or estate agency (200G each)</td></tr>
        </tbody></table>

        <div style={h2}>Shops & Districts</div>
        <div style={p}>
          Shop value = base × multiplier + invested capital; rent grows with both. Owning more shops
          in a district multiplies <em>all</em> of yours: ×2, ×3… <span style={hl}>full domination ×5</span>.
          Investing also pushes the district's stock price up.
        </div>

        <div style={h2}>The Stock Market</div>
        <div style={p}>
          Each district's stock tracks its shop values (4% of the average). Buy at the bank or a
          broker, 1–99 shares per purchase; sell only <span style={hl}>before rolling</span>.
          Trades of <span style={hl}>10+ shares</span> move the price (price/16 + 1) — up on buys,
          down on sells, never below the shop-value floor. When rent is paid in a district, all
          shareholders split a <span style={hl}>10% dividend, paid by the bank</span>.
        </div>

        <div style={h2}>Suits & Salary</div>
        <div style={p}>
          Collect ♥ ♦ ♣ ♠, then reach the bank:{' '}
          <span style={hl}>salary = 250G + 10% of your shop value + 150G × level</span>.
          Suits reset, level rises — salaries scale with your empire.{' '}
          <span style={hl}>Suit Yourself cards</span> (🃏, max 9, from venture cards) are
          wildcards spent to fill any missing suits at promotion.
        </div>

        <div style={h2}>Venture Cards</div>
        <div style={p}>
          Pick a face-down card from the shared 8×8 grid (64 cards seeded from a 96-card pool).
          Cash, stock moves, free suits, warps, extra rolls, temporary effects and more.{' '}
          <span style={hl}>Line bonus</span>: completing 4+ in a row, column or diagonal pays
          40–200G.
        </div>

        <div style={h2}>Buildings</div>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}><tbody>
          <tr><td style={tdKey}>⭐ Three-star</td><td style={td}>1000G — high-end shop, 2000G max capital</td></tr>
          <tr><td style={tdKey}>🚧 Checkpoint</td><td style={td}>Toll on pass-through: 200G, +10G every time (max 250G)</td></tr>
          <tr><td style={tdKey}>🎪 Circus</td><td style={td}>Upgrade in tiers (400/500/1000G) to 2000G value; rent is ¼ of value</td></tr>
          <tr><td style={tdKey}>🎈 Balloonport</td><td style={td}>Land on it: teleport anywhere</td></tr>
          <tr><td style={tdKey}>🏛️ Tax office</td><td style={td}>Visitors pay 10% of their net worth; landing yourself pays you a 5% bonus</td></tr>
          <tr><td style={tdKey}>🏠 Home</td><td style={td}>Visitors pay 30G × your level; landing summons everyone to you</td></tr>
          <tr><td style={tdKey}>🏢 Estate agency</td><td style={td}>Land on it: buy any unowned shop remotely</td></tr>
        </tbody></table>
        <div style={p}>Renovate a plot you own at the start of your turn (building cost + 150G).</div>

        <div style={h2}>Debt &amp; Bankruptcy</div>
        <div style={p}>
          Cash below zero? You enter <span style={hl}>debt settlement</span>: choose any mix of
          your stocks (at market price) and shops (distress sale at{' '}
          <span style={hl}>75% value</span>) to sell until the debt is covered — nothing is sold
          for you. If even selling everything couldn't cover it, you're{' '}
          <span style={hl}>bankrupt and eliminated</span>.
        </div>
        <div style={p}>
          The room's <span style={hl}>Ends After</span> setting decides when bankruptcies end the
          game: after 1 (classic), 2, or last player standing — richest survivor wins. If a
          bankruptcy doesn't end the game, survivors vote whether to stop anyway:{' '}
          <span style={hl}>unanimous to end</span>, one "keep playing" continues (AI players don't
          vote).
        </div>

        <div style={h2}>Characters</div>
        <div style={p}>
          Your character is your avatar — but AI players truly play their style:
          ⚔️ Erdrick (balanced) · 🐉 Dragonlord (property tycoon) · 👸 Gwaelin (stock baroness) ·
          🟢 Slime (cautious hoarder) · 🛒 Torneko (merchant prince) · ✨ Healslime (opportunist).
        </div>
      </div>
    </div>
  );
}
