# Core Rules — Setup, Turns, Movement, Salary, Endgame

## Setup

- 2–4 players. Turn order is decided at game start by **number machines** —
  each player draws a number, highest goes first. **[S]** (Not a plain die
  roll-off; a dedicated start-of-game gadget.)
- Starting ready cash is **board-specific**, set in each board's data rather
  than a global constant. **[V]** (Blue Pichu: "explicitly set in the code".)
  No central table of per-board values was found.
- Net worth = ready cash + total shop value + total stock value. **[V]**

## Turn flow

1. (Standard rules) Stocks may be **sold any time before your roll**. **[V]**
2. Roll the die (standard die, 1–6 — venture card 87 grants a "special
   all-7s-and-8s die", implying the normal one is 1–6). **[V]**
3. Move the full roll; resolve squares passed through (suits, change-of-suit
   cycling, tolls); resolve the landing square.
4. Turn passes on. Several venture cards and squares ("roll-on", "venture on")
   grant immediate re-rolls within the same turn.

## Movement

- Boards are graphs with forks; the player **chooses direction at junctions**
  during movement. **[V]**
- **Reversing/backtracking is not offered** as a normal option — movement is
  forward-progressing; no source documents a 180° turn being allowed
  mid-move. **[U]** (Community consensus, not formally documented.)
- **Landing on the bank lets you choose any direction on your NEXT turn** —
  a unique privilege of the bank square. **[S]**
- Warp-type squares (backstreet, one-way alley, lift, cannon) relocate the
  player; lifts/Magmalice end the turn on arrival. **[S]**

## Suits, salary, promotion

- Collect all four suits (♠ ♥ ♦ ♣), then **return to the bank** (landing or
  passing both count — "you can buy stocks as you pass through" and salary is
  received "each time you return here") to be promoted. **[V]**
- **Salary = 250 + (S ÷ 10, floored) + (150 × L)** where S = total value of
  the player's shops, and **L = the player's level BEFORE the promotion**.
  After payment: suits reset, level +1. **[V]** (Mario Wiki gives the formula
  explicitly.)
- Suits walked over mid-move are collected, not only on landing. **[V]**
- **Suit Yourself cards**: wildcard suits obtained from venture cards and
  minigames; spendable as any missing suit at promotion time; max 9 held;
  drawing a suit you already own pays 100G instead. **[V]**

## Winning and ending

- Win: be the first to reach the board's **target net worth** and then
  **return to the bank**. **[V]**
- Targets are board-specific. Practice boards: 5,000G (Easy) / 8,000G
  (Standard). Custom mode allows 6,000–999,000G in 1,000G steps. **[S]**
- **Bankruptcy ends games by limit**: in Tour mode the game ends when one
  player goes bankrupt; Custom mode offers a bankruptcy limit of two or
  last-man-standing. When the limit is met, **highest net worth wins**. **[V]**

## Debt and bankruptcy

- If ready cash goes below zero, the player must raise money before their
  turn ends: selling stocks, or selling shops. **[V]**
- **Shops sold for cash are AUCTIONED among the other players** — the winning
  bid is paid to the seller. The bank's offer (75% of shop value) is
  effectively the floor when in debt. Venture card 74 forces an auction with
  a starting price of 2× shop value. **[V]**
- If the debt cannot be resolved by end of turn: bankruptcy — all remaining
  assets are sold off and the player is **eliminated**. **[V]**
