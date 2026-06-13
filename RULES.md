# Bankrupt Street — Game Rules

A multiplayer board game of property, stocks, and timing — branching boards, a district stock market, suits and promotions, all in a fantasy setting with its own house rules.

---

## Goal

Be the first player to reach the **target net worth** (set when the room is created — each board suggests its own: **Eldermoor 5,000G**, **Aldoria 7,000G**, **Mistral 9,000G**, adjustable to 5k–15k) and then **return to the bank** — landing on it or passing it both count.

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
| ♻️ **Change-of-suit** | A suit square whose suit rotates (♥→♦→♣→♠) each time a player passes |
| ❓ **Venture** | Draw a venture card from the 8×8 grid |
| 🏛️ **Tax office** | Pay 5% of your net worth to the bank |
| ☕ **Take-a-break** | All YOUR shops shut until your next turn |
| 🍀 **Boon** | Collect 20% of every payment anyone makes until your next turn |
| 💰 **Boom** | Same, but 50% |
| 🎰 **Casino** | Play a minigame (one per visit) — free arcade or wager game — or walk away. See The Casino |
| 🎲 **Roll-on** | Immediately roll again and keep moving |
| 🔀 **Backstreet** | Slip down the alley to the matching-letter alley across the board |
| 💥 **Cannon** | Get blasted onto a random rival's square — and resolve whatever you land on |
| 🌀 **Warp** | Teleport to the paired square and keep moving |
| 🏗️ **Vacant plot** | Unowned: build on it. See Buildings |

## Shops, Rent & Investment

- A shop's **value** = base value + invested capital. District ownership never changes a shop's value — only its rent.
- **Rent** = base rent × (district multiplier + capital ÷ base value). Investing a full base-value's worth of capital adds +1× to the rent multiplier.
- **District multiplier** (the original game's table): 1 shop **×1**, 2 shops **×1.25**, 3 shops **×2**, 4 shops **×3.25**, 5+ shops **×6**.
- **Max capital** scales with district ownership too: 1 shop → ½× value, 2 → 1×, 3 → 3×, 4 → 9×, 5+ → 11×.
- **Investing**: when you land on your own shop you may invest up to **999G per turn**, capped by the shop's max capital. Investment raises the shop's value, its rent, and the district's stock price.
- **Buyouts**: landing on an opponent's shop, you may buy it out for **5× its value**. The owner receives 3× (the bank keeps the difference). The AI does this when it completes their district, breaks your monopoly, or they're simply rich.

## The Stock Market

- Each district has a stock with price `floor(average shop value × 0.04)` — investing and buying shops in a district pushes its stock up.
- **Buy** at the bank or a stockbroker (or after passing the bank), 1–99 shares per purchase, unlimited holdings.
- **Sell** only at the start of your turn, before rolling.
- **Price impact**: trades of **10+ shares** move the price by `price/16 + 1` — up when buying, down when selling. Smaller trades don't move it. The price never falls below its shop-value floor.

## Suits, Salary & Promotion

Collect all four suits (♥ ♦ ♣ ♠), then reach the bank (landing or passing).
**Suit Yourself cards** (🃏, max 9) are wildcards from venture cards — they
fill in for any missing suits at promotion time and are spent doing so:

> **Salary = 250G + 10% of your total shop value + 150G × your level**

Your suits reset, your level rises. Salaries grow as your empire does.

## Venture Cards

Landing on a venture or suit square: pick a face-down card from the shared 8×8 grid (64 cards drawn from a 124-card pool, reshuffled when exhausted). Most effects resolve instantly — cash gains/losses, stock moves and dividends, free suits, warps, extra rolls, shop boosts, temporary effects (shops closed, rents halved or doubled, bank commissions), Suit Yourself cards, and more.

**Interactive cards** hand you a decision instead: buy or sell stock at a premium/discount, buy any unowned shop, or sell one of your shops to the bank above its value — you pick the district/shares/shop and confirm. A few are **forced** (the bank buys you out): you must sell, but at a generous price.

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

Land on a 🎰 **Casino** square to play one game, once per visit — three free arcade games or two wager games — or walk away.

**Free arcade** (no stake; prizes scale with your level):

- **🎰 Lucky Reels** — a slot pull. Three-of-a-kind pays out: 500G × level (7s), 50G × level (mushrooms), free shares, a Suit Yourself card, or a warp.
- **📦 Memory Match** — open one of nine boxes for a coin (10G × level), shares, a shop boost, a Suit Yourself card, or a Bandit (−5% to your shops).
- **🎯 Golden Darts** — throw at the prize wheel; the prize **or penalty** lands on a random player (could be you).

**Wager games** (stake 10–500G):

- **🏁 Slime Derby** — back one of four racing slimes. Your pick wins 1 time in 4; victory pays **4× your wager**.
- **🃏 High-Low** — a card is dealt; call whether the next is **higher** or **lower**. Right pays **2× your wager**. A tie goes to the house.

## Debt & Bankruptcy

If your cash drops below zero, you enter **debt settlement**: choose any mix of your stocks (sold at market price) and shops to sell until the debt is covered — nothing is sold automatically on your behalf. **Shops sold in debt go to auction**: the other players bid (opening bid just above the bank's offer), the winning bid is paid to you in full — and if nobody bids, the bank buys at **75% of value**. You may sell more than you owe if you want out of a position entirely. If even selling everything couldn't cover the debt, you're **bankrupt and eliminated**.

**When the game ends** is set at room creation (*Ends After*): after **1 bankruptcy** (default, the classic rule), **2 bankruptcies**, or **last player standing**. When the limit is reached — or a player reaches the target — the game ends; on a bankruptcy ending, the richest surviving player wins.

**The end-game vote**: if a bankruptcy *doesn't* end the game, all surviving players are asked whether to stop anyway. The vote must be **unanimous** (AI players don't vote); a single "keep playing" continues the game. If the vote passes, the current standings become final.

## Idle & disconnected players

The game never stalls waiting on someone who's gone. If the player whose turn it is doesn't act within **5 minutes** (or **2 minutes** after a dropped connection), a bot takes over their seat and play continues. A countdown banner shows everyone who's holding things up and how long is left. If a dropped player reconnects in time — or before the bot has finished their seat — they resume control.

## Characters

| Character | Style |
|---|---|
| ⚔️ **Aldric** — Balanced Hero | Steady all-rounder |
| 🐉 **The Tyrant** — Property Tycoon | Spends big on shops, buys opponents out aggressively |
| 👸 **Lady Mirelle** — Stock Baroness | Trades in large blocks, holds through dips, heads for brokers |
| 🟢 **The Miser** — Cautious Hoarder | Keeps the biggest cash reserve, builds shops steadily and rarely overextends |
| 🛒 **Merrick** — Merchant Prince | Builder and shrewd buyer |
| ✨ **The Oracle** — Opportunist | Stock-leaning generalist |

Humans play however they like — the character is your avatar. AI players genuinely play these styles.

## Boards

- 🗺 **Eldermoor** — the classic: twin warp pipes into the lucrative Blackspire island at the center, now with a taxed land exit through the **Blackspire Gate** and an inn on the Fenwick road.
- 🗺 **Mistral** — outer ring with an inner pass, a one-way **River Rapids** shortcut (cheap shops, brutal rent, no way back), and a royal tax office on the north road.
- 🗺 **Aldoria** — twin loops crossing at the bank (every lap passes the Temple Shrine, the bank, and the Crown tax house). The Sunspire desert wind blows the northern caravan one-way east; premium **Farisle** island is warp-in from the Gold Road, warp-out to Aldoria.
