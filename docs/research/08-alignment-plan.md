# Alignment Plan — Acting on the Research

Goal: fix unintentional **DRIFT**, adopt the highest-value **MISSING**
mechanics, and keep deliberate **HOUSE** rules. Phased so every step ships
green (tests + balance sims + browser pass) and the game stays playable
throughout.

## Standing decisions honored (NOT changing)

- No Easy rules (decided 2026-06-09)
- Standing buyout action at 5× (seller 3×) — beloved house rule; canonical
  forced-buyout cards may coexist in the pool
- Casino wager minigames (Slime Derby / High-Low) stay — the original's
  level-scaled arcade can join later as additional games, not a replacement
- Checkpoint toll cap 250G, native tax squares, win-on-pass — house, keep
- Flat 2,000G starting cash — keep until data argues otherwise

## Phase 1 — Faithful fixes (small, immediate)

1. **Take-a-break becomes the real penalty**: landing closes YOUR shops until
   your next turn (engine flag `shopsClosedUntilNextTurn` already exists).
   Replaces the roll×20G gift on all three boards. Bots: nothing to do.
2. **Bank direction privilege**: landing on the bank clears
   `arrivedFromNodeId` → free direction choice next roll. One line + test.
3. **Venture text touch-ups**: adopt canonical numbers/texts for cards whose
   effects we already implement (e.g. dividends 10/20%, expansions, freebies
   pay 100G on duplicates — already true).

## Phase 2 — Missing content (additive)

4. **Boon & Boom squares**: new node type(s) granting 20% / 50% commission on
   all payments until next turn — `commissionUntilNextTurn` already powers
   venture cards 26/118; this just adds squares. Place 1 Boon per board,
   Boom only on Aliahan (spicy). Board tile art + integrity tests are free.
5. **Suit Yourself wildcards**: `Player.suitYourselfCards` (cap 9); salary
   check spends them to fill missing suits; venture effects (take 1, all
   players take 1, roll for half, buy for 50G/100G); duplicates → 100G
   already matches. UI: chip next to suits. Medium.
6. **Venture pool growout 96 → ~120**: add canonical effect types we lack —
   assets tax per stock (#43), everyone-swaps (#88), movement restriction
   (#81/#115), half salary (#17), sudden promotion (#70), bank-money invest
   (#71/#121), buy/sell stock at premium/discount (#35/38/59/69), forced
   bank-sale at 2× (#18/#24, generous flavor). Incremental batches; grid and
   line bonuses already faithful.

## Phase 3 — The economy decision (structural)

7. **"Classic economy" as a room option** (default stays Bankrupt until data
   says otherwise):
   - fees = value × logistic rate (≈11–22%, rising with value)
   - district scaling on FEES: ×1 / 1.25 / 2 / 3.25 / 6 — values fixed
   - max capital = value × 0.5 / 1 / 3 / 9 / 11 by shops owned
   - investment raises VALUE (stock price follows via the 4% rule);
     fee multiplier +1 per full shop-value invested (best-known model)
   - **no rent-shareholder dividend** in Classic (it doesn't exist in the
     original; Boon/Boom carry that role)
   - Bankrupt mode keeps today's model including the dividend
   Implementation: a `economyModel: 'bankrupt' | 'classic'` switch inside
   `recalcDistrictMultipliers` / `payRent` / `invest` / maxCapital; room
   option chip; balance harness gets a mode argument.
8. **Head-to-head balance report**: 200 games/board × both modes × limits
   1 and 2 — decide the default with data, not vibes.

## Phase 4 — Later / optional

9. **Debt auctions** between players (winning bid pays the seller; 75% bank
   floor as reserve). Real multiplayer drama; significant UI + bot bidding
   logic. Park until after Phase 3 settles the economy.
10. **Board gimmicks** for future boards: change-of-suit square, cannon,
    switch, lift. Cameo NPCs (goodybag/healslime/Lakitu) pair well with this.
11. **Custom target range** (6k–999k free input) and per-board starting cash.

## Sequencing & verification

Each phase: engine + tests → bot sanity (sims) → client UI → browser pass →
balance batch where economy-relevant → commit/push. Phases 1–2 are
independent of Phase 3 and can ship immediately.
