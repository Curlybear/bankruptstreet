# Bankrupt Street — Game Rules

A multiplayer board game of property, stocks, and timing, inspired by the *Fortune Street* series — with its own house rules.

---

## Goal

Be the first player to reach the **target net worth** (set when the room is created, default 15,000G) and then **return to the bank** — landing on it or passing it both count.

> Net worth = cash + (shares × stock price) + value of all owned shops.

The game also ends immediately if **any player goes bankrupt**: the remaining player with the highest net worth wins.

## Setup

- 2–4 players; empty seats are filled with AI characters when the game starts.
- Everyone starts with **2,000G** at the bank.
- Each player picks a **character** — cosmetic for humans, but it defines an AI player's personality (see Characters below).

## Your Turn

1. **Before rolling** you may **sell stock** (any number of districts) and renovate plots you own.
2. **Roll the die** and move. At branching paths, you choose the direction. You cannot reverse mid-move, and you cannot start your move back the way you came last turn (unless it's your only exit). Teleports reset your direction.
3. **Resolve the square** you land on (see Squares below).
4. Turn passes to the next player.

### Things that happen while moving

- **Suit squares** you walk over grant their suit (♥ ♦ ♣ ♠).
- **Passing the bank** counts as completing a lap: you get a chance to buy stock at the end of your turn, you collect a salary if you hold all 4 suits, and you win if you've reached the target net worth.
- **Opponent checkpoints** you walk through charge their toll (which then increases by 10G).

## Squares

| Square | On landing |
|---|---|
| 🏪 **Shop** | Unowned: may buy it at its current price. Yours: may invest. Opponent's: pay rent (or buy them out — see below) |
| 🏦 **Bank** | Salary if all 4 suits held; win check; buy stock |
| 📈 **Stockbroker** | Buy stock |
| ♥ **Suit** | Gain the suit **and** draw a venture card |
| ❓ **Venture** | Draw a venture card from the 8×8 grid |
| 🏛️ **Tax office** | Pay 5% of your net worth to the bank |
| ☕ **Take-a-break** | All YOUR shops shut until your next turn |
| 🍀 **Boon** | Collect 20% of every payment anyone makes until your next turn |
| 💰 **Boom** | Same, but 50% |
| 🎰 **Casino** | Wager 10–500G on a minigame (one bet per visit), or walk away |
| 🌀 **Warp** | Teleport to the paired square and keep moving |
| 🏗️ **Vacant plot** | Unowned: build on it. See Buildings |

## Shops, Rent & Investment

- A shop's value: `basePrice × multiplier + capital invested`.
- Rent: `(baseRent + capital/10) × multiplier`.
- **District multiplier**: owning more shops in one district multiplies all of yours — 1 shop ×1, 2 shops ×2, up to **×4** … full district domination jumps to **×5**.
- **Investing**: when you land on your own shop you may invest up to **999G per turn**, capped by the shop's max capital (2× its base value × multiplier). Investment raises rent and the district's stock price.
- **Buyouts**: landing on an opponent's shop, you may buy it out for **5× its value**. The owner receives 3× (the bank keeps the difference). The AI does this when it completes their district, breaks your monopoly, or they're simply rich.

## The Stock Market

- Each district has a stock with price `floor(average shop value × 0.04)` — investing and buying shops in a district pushes its stock up.
- **Buy** at the bank or a stockbroker (or after passing the bank), 1–99 shares per purchase, unlimited holdings.
- **Sell** only at the start of your turn, before rolling.
- **Price impact**: trades of **10+ shares** move the price by `price/16 + 1` — up when buying, down when selling. Smaller trades don't move it. The price never falls below its shop-value floor.
- **Dividends**: whenever rent is paid in a district, all shareholders split a bonus equal to 10% of the rent, proportional to shares — **paid by the bank**, not the renter.

## Suits, Salary & Promotion

Collect all four suits (♥ ♦ ♣ ♠), then reach the bank (landing or passing).
**Suit Yourself cards** (🃏, max 9) are wildcards from venture cards — they
fill in for any missing suits at promotion time and are spent doing so:

> **Salary = 250G + 10% of your total shop value + 150G × your level**

Your suits reset, your level rises. Salaries grow as your empire does.

## Venture Cards

Landing on a venture or suit square: pick a face-down card from the shared 8×8 grid (64 cards drawn from a 96-card pool, reshuffled when exhausted). Effects range from cash gains/losses, stock moves and dividends, free suits, warps, extra rolls, shop boosts, temporary effects (shops closed, rents halved or doubled, bank commissions) and more.

**Line bonus**: clearing the 4th-or-more card in a row, column, or diagonal pays a bonus — 40G for 4 in a line, up to 200G for a full line of 8.

## Buildings (Vacant Plots)

Land on an unowned vacant plot to build:

| Building | Cost | Effect |
|---|---|---|
| ⭐ Three-star shop | 1,000G | A high-end shop (80G base rent, 2,000G max capital) |
| 🚧 Checkpoint | 200G | Players passing through pay a toll (200G, +10G each time, capped at 250G) |
| 🎪 Circus | 200G | Upgradeable in tiers (400/500/1,000G) up to 2,000G value (rent is ¼ of value) |
| 🎈 Balloonport | 200G | Land on it to teleport anywhere on the board |
| 🏛️ Tax office | 200G | Visitors pay you 10% of their net worth; you collect a 5% bonus when landing on it |
| 🏠 Home | 200G | Visitors pay 30G × your level; landing on it summons all players to you |
| 🏢 Estate agency | 200G | Land on it to buy any unowned shop on the board, remotely |

You may **renovate** a plot you own into a different building at the start of your turn (building cost + 150G).

## The Casino

Land on a 🎰 **Casino** square to play one of two games, once per visit:

- **🏁 Slime Derby** — back one of four racing slimes. Your pick wins the race 1 time in 4; victory pays **4× your wager**.
- **🃏 High-Low** — a card is dealt; call whether the next is **higher** or **lower**. Right pays **2× your wager**. A tie goes to the house.

Wagers run 10–500G and you can always walk away without betting.

## Debt & Bankruptcy

If your cash drops below zero, you enter **debt settlement**: choose any mix of your stocks (sold at market price) and shops (distress sale at **75% of value**) to sell until the debt is covered — nothing is sold automatically on your behalf. You may sell more than you owe if you want out of a position entirely. If even selling everything couldn't cover the debt, you're **bankrupt and eliminated**.

**When the game ends** is set at room creation (*Ends After*): after **1 bankruptcy** (default, the classic rule), **2 bankruptcies**, or **last player standing**. When the limit is reached — or a player reaches the target — the game ends; on a bankruptcy ending, the richest surviving player wins.

**The end-game vote**: if a bankruptcy *doesn't* end the game, all surviving players are asked whether to stop anyway. The vote must be **unanimous** (AI players don't vote); a single "keep playing" continues the game. If the vote passes, the current standings become final.

## Characters

| Character | Style |
|---|---|
| ⚔️ **Erdrick** — Balanced Hero | Steady all-rounder |
| 🐉 **Dragonlord** — Property Tycoon | Spends big on shops, buys opponents out aggressively |
| 👸 **Princess Gwaelin** — Stock Baroness | Trades in large blocks, holds through dips, heads for brokers |
| 🟢 **Slime** — Cautious Hoarder | Keeps a fat cash reserve, chases salaries |
| 🛒 **Torneko** — Merchant Prince | Builder and shrewd buyer |
| ✨ **Healslime** — Opportunist | Stock-leaning generalist |

Humans play however they like — the character is your avatar. AI players genuinely play these styles.

## Boards

- 🗺 **Alefgard** — the classic: twin warp pipes into the lucrative Charlock island at the center, now with a taxed land exit through the **Charlock Gate** and an inn on the Kol road.
- 🗺 **Torland** — outer ring with an inner pass, a one-way **River Rapids** shortcut (cheap shops, brutal rent, no way back), and a royal tax office on the north road.
- 🗺 **Aliahan** — twin loops crossing at the bank (every lap passes the Dharma Shrine, the bank, and the Edinbear tax house). The Isis desert wind blows the northern caravan one-way east; premium **Jipang** island is warp-in from the Roma Road, warp-out to Aliahan.
