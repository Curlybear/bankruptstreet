# Bankrupt Street vs. Fortune Street — Systematic Deviation Audit

Comparison of our engine (as of 2026-06-11) against the researched original.
Classification: **FAITHFUL** (matches), **HOUSE** (deliberate house rule, fine),
**DRIFT** (unintentional divergence worth a decision), **MISSING** (original
mechanic we don't have).

## Economy core

| Area | Original | Ours | Verdict |
|---|---|---|---|
| Stock price formula | 4% of avg shop value, floor & start | same | **FAITHFUL** |
| Trade impact | ≥10 shares: ±(floor(p/16)+1), one step regardless of size, floor at 4% | same | **FAITHFUL** |
| Stock buy cap | 99 per purchase | 99 per purchase | **FAITHFUL** |
| Sell timing | before your roll | PRE_ROLL (+ debt settlement) | **FAITHFUL** |
| Salary | 250 + shops/10 + 150×level (pre-promotion level) | same formula | **FAITHFUL** |
| Salary trigger | return to bank (pass or land), suits reset | same | **FAITHFUL** |
| Net worth | cash + shops + stocks | same | **FAITHFUL** |
| Win | target net worth + return to bank | same (incl. win-on-pass) | **FAITHFUL** |
| Bankruptcy limit | Tour: 1; Custom: 2 / last standing | room option 1 / 2 / last standing | **FAITHFUL** |
| Invest cap | 999G/turn, bounded by max capital | same | **FAITHFUL** |

## District system — the big structural divergence

| Area | Original | Ours | Verdict |
|---|---|---|---|
| What scales with district count | the FEE only — value untouched | `currentPrice` (value) scales: base × multiplier | **DRIFT** |
| Multiplier curve | fee × 1 / 1.25 / 2 / 3.25 / 6 (1–5 shops) | ×1/×2/×3/×4 (capped), full district ×5 — applied to value AND rent | **DRIFT** |
| Max capital | value × 0.5 / 1 / 3 / 9 / 11 by count | flat 2 × base price | **DRIFT** |
| Fee (rent) level | 10–22% of value (logistic, value-dependent) | ~8.5% of price, flat | **DRIFT** |
| Investment effect | raises VALUE; fee multiplier +1 per full value invested (approx) | rent += capital/10 × mult; price += capital | **DRIFT** |

Net effect: our economy is *flatter* — original districts escalate fees much
harder at 4–5 shops (×3.25/×6) but don't inflate asset values; ours inflates
values (which feeds net worth and stock price) while capping rent multipliers.
This is the deepest difference between the two games and shapes everything
the balance sims measure. A faithful-mode experiment would be a big refactor;
documenting it is the first step.

## Income mechanics

| Area | Original | Ours | Verdict |
|---|---|---|---|
| Rent-triggered shareholder dividend | does not exist | 10% of rent split among district shareholders, bank-paid | **HOUSE** (from our spec) |
| Commissions | Boon/Boom SQUARES (20%/50% of all payments) + venture cards | venture-card commissions only | **MISSING** (squares) |
| Stock dividends | venture cards 61/62 (10%/20%) | similar venture effects | FAITHFUL-ish |

## Squares & content

| Area | Original | Ours | Verdict |
|---|---|---|---|
| Take-a-break | YOUR shops close until next turn (penalty) | roll × 20G gift (reward) | **HOUSE** (accidental — we misremembered) |
| Tax office | building only; visitors pay 10% NW to OWNER | building (same) + native squares paying 5% to BANK | **HOUSE** (native squares) |
| Casino/Arcade | 4 minigames (slots, memory, darts, slime race), level-scaled prizes, prize-gifting in darts | Slime Derby (4×) + High-Low (2×), wager-based | **HOUSE** (homage; original is level-scaled, not wager-based) |
| Suit Yourself wildcards | yes, max 9, deep economy (buy/sell/minigames) | absent | **MISSING** |
| Change-of-suit square | suit cycles as players pass | absent | **MISSING** |
| Bank direction privilege | landing grants free direction choice next turn | absent | **MISSING** (small) |
| Board gimmicks (switch, cannon, lift, one-way alley) | per-board | one-way edges only | partial |
| Cameo NPCs (goodybag, healslime, Lakitu) | wander the board | absent | **MISSING** |
| Checkpoint toll | +10G per pass, uncapped (documented) | +10G capped at 250G | **HOUSE** (sim-driven cap) |
| Balloonport fee | 40 + 10×level + 1% property value | flat plot rules | **DRIFT** (minor) |

## Transactions

| Area | Original | Ours | Verdict |
|---|---|---|---|
| Buyout of owned shops | only via venture cards (3×/4×/5×) | standing action: 5× cost, seller gets 3× | **HOUSE** |
| Debt sales | auction among players (winning bid to seller), bank floor 75% | distress sale to bank at 75%, player chooses assets | **HOUSE** (auction absent; 75% floor faithful) |
| Forced sale to bank (cards) | at 2×–4× value | venture pool differs | HOUSE pool |
| Venture pool | 128 canonical cards | 96 custom cards, 64-grid + line bonuses (40/50/60/70/200 — matches!) | **HOUSE** pool, FAITHFUL grid |

## Setup

| Area | Original | Ours | Verdict |
|---|---|---|---|
| Starting cash | board-specific | flat 2,000G | **HOUSE** (original values unknown) |
| Turn order | number machines draw | lobby seat order | **HOUSE** (minor) |
| Target range | 6,000–999,000 custom | presets 10k/15k/20k/25k | **HOUSE** (minor) |
| Easy rules | exists | deliberately not implemented | decided 2026-06-09 |

## Suggested follow-ups (each needs a product decision, not just code)

1. **District model**: keep ours, or implement the vanilla fee-multiplier
   table (×1/1.25/2/3.25/6 on fees, values stable, max capital by count) as a
   room option ("Classic economy")? The balance harness can compare them
   head-to-head.
2. **Take-a-break**: our reward version is friendlier; the original penalty
   version is more interesting on rent-heavy boards. Could differ per board.
3. **Suit Yourself cards**: highest-value missing content; touches venture
   pool, salary flow, and UI.
4. **Boon/Boom squares**: cheap to add (commission flag exists from venture
   effects), big strategic texture.
5. **Auctions on debt**: deep multiplayer moment the original had; ours is
   solitary by design (works for bot games).
