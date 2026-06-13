# Bankrupt Street vs. Fortune Street — Systematic Deviation Audit

Comparison of our engine (as of **2026-06-13**) against the researched original.
Classification: **FAITHFUL** (matches), **HOUSE** (deliberate house rule, fine),
**DRIFT** (unintentional divergence worth a decision), **MISSING** (original
mechanic we don't have).

> History: the 2026-06-11 audit found the district economy was the deepest
> divergence and most original content was missing. Since then we adopted the
> original economy wholesale and shipped the alignment plan (see
> `08-alignment-plan.md`), so most former DRIFT/MISSING rows are now FAITHFUL.

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

## District system — adopted from the original (was the big divergence)

The original *Fortune Street* economy is now our single model (commit `ae0b840`,
"Adopt the original Fortune Street economy"). The 2026-06-11 DRIFT rows are
resolved:

| Area | Original | Ours | Verdict |
|---|---|---|---|
| What scales with district count | the FEE only — value untouched | the fee only; value = base + capital | **FAITHFUL** |
| Multiplier curve | fee × 1 / 1.25 / 2 / 3.25 / 6 (1–5 shops) | same table | **FAITHFUL** |
| Max capital | value × 0.5 / 1 / 3 / 9 / 11 by count | same table | **FAITHFUL** |
| Fee (rent) level | 10–22% of value (logistic, value-dependent) | derived at room creation via `rate = 0.24v/(v+85)` (~11–20%) | **FAITHFUL** |
| Investment effect | raises VALUE; fee multiplier grows with capital | rent = baseRent × (mult + capital/basePrice) | **FAITHFUL** |

Derived empirically from the Fortune Street Modding district simulator. The
former "no rent-shareholder dividend" concern is resolved — we removed it (below).

## Income mechanics

| Area | Original | Ours | Verdict |
|---|---|---|---|
| Rent-triggered shareholder dividend | does not exist | **removed** with the economy adoption | **FAITHFUL** |
| Commissions | Boon/Boom SQUARES (20%/50% of all payments) + venture cards | Boon/Boom squares **and** venture-card commissions | **FAITHFUL** |
| Stock dividends | venture cards (10%/20%) | same venture effects | **FAITHFUL** |

## Squares & content

| Area | Original | Ours | Verdict |
|---|---|---|---|
| Take-a-break | YOUR shops close until next turn (penalty) | same | **FAITHFUL** |
| Suit Yourself wildcards | yes, max 9, deep economy (buy/sell/minigames) | `Player.suitYourself` cap 9, spent at promotion; venture + arcade sources | **FAITHFUL** |
| Change-of-suit square | suit cycles as players pass | `cycleSuit` flag, ♥→♦→♣→♠ on pass | **FAITHFUL** |
| Bank direction privilege | landing grants free direction choice next turn | landing clears `arrivedFromNodeId` | **FAITHFUL** |
| Boon / Boom squares | 20% / 50% commission until next turn | same (node types) | **FAITHFUL** |
| Arcade minigames | slots, memory, darts, slime race — level-scaled prizes | Round the Blocks (slots), Memory Block, Dart of Gold (free, level-scaled) + Slime Derby & High-Low (wager) | **FAITHFUL-ish** (extra wager games are HOUSE) |
| Dart of Gold target | thrower **chooses** who gets the prize/penalty | lands on a **random** player | **HOUSE** (deliberate — chance over choice) |
| Roll-on / backstreet (alley) / cannon | per-board gimmicks | implemented (cannon = random rival, our choice) | **FAITHFUL-ish** |
| Switch & lift/magmalice squares | per-board | absent | **MISSING** (deferred) |
| Cameo NPCs (goodybag, healslime, Lakitu) | wander the board | absent | **MISSING** (deferred) |
| Tax office | building only; visitors pay 10% NW to OWNER | building (same) + native squares paying 5% to BANK | **HOUSE** (native squares) |
| Checkpoint toll | +10G per pass, uncapped (documented) | +10G capped at 250G | **HOUSE** (sim-driven cap) |
| Balloonport fee | 40 + 10×level + 1% property value | flat plot rules | **DRIFT** (minor) |

## Transactions

| Area | Original | Ours | Verdict |
|---|---|---|---|
| Buyout of owned shops | only via venture cards (3×/4×/5×) | standing action: 5× cost, seller gets 3× | **HOUSE** |
| Debt sales | auction among players (winning bid to seller), bank floor 75% | same — auction with 75% bank floor | **FAITHFUL** |
| Forced sale to bank (cards) | at 2×–4× value | interactive venture cards (2×/3×/4×/+500; forced 2× & +200) | **FAITHFUL-ish** (custom pool) |
| Buy/sell stock or shop at the bank (cards) | premium/discount venture cards | interactive `VENTURE_CHOICE` cards (90/100/110/120/135%) | **FAITHFUL-ish** |
| Venture pool | 128 canonical cards | 124 custom cards, 64-grid + line bonuses (40/50/60/70/200 — matches!) | **HOUSE** pool, FAITHFUL grid |

## Setup

| Area | Original | Ours | Verdict |
|---|---|---|---|
| Starting cash | board-specific | flat 2,000G | **HOUSE** (original values unknown) |
| Turn order | number machines draw | lobby seat order | **HOUSE** (minor) |
| Target range | 6,000–999,000 custom | presets 5k/7k/9k/12k/15k, per-board suggested | **HOUSE** (minor) |
| Easy rules | exists | deliberately not implemented | decided 2026-06-09 |

## Remaining gaps (all deferred by product decision)

1. **Switch & lift/magmalice squares** — the two board gimmicks we set aside.
2. **Cameo NPCs** (goodybag / healslime / Lakitu) — wandering pieces; pairs
   well with a future board.
3. **Custom target range** (free 6k–999k input) and **per-board starting cash**.
4. **Balloonport fee** — minor formula drift, low priority.

Everything else from the original is implemented or a deliberate house rule.
