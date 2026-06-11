# Shops, Districts, Investment, Buildings

## Terminology (critical for reading any FS source)

- **Shop value** — the asset value: what the shop is worth (buy price,
  net-worth contribution, the base for percentage effects).
- **Shop price** — what a visitor PAYS when landing (the fee/rent).

These are different numbers with different formulas. Many wiki passages blur
them; the modding simulator displays both.

## The fee curve (shop price from shop value)

- Base shop price ≈ **10%–22% of shop value**, following a curve that rises
  with value toward ~20–22%. **[V]** (Blue Pichu part 1: range 11.11%–21.92%,
  "logistic curve with carrying capacity near 20"; simulator examples:
  90G shop → 11G fee (12.2%), 240G → 43G (17.9%), 360G → 72G (20%).)
- So cheap shops charge proportionally lower fees — small shops are gentler
  than a flat percentage would make them.

## District multipliers — the vanilla tables

Derived empirically from the Fortune Street Modding **district simulator**
("Vanilla" multiplier table), cross-checked across five shops of different
values with exact floor matches. **[V]**

Owning N shops in one district multiplies **each owned shop's PRICE (fee)**:

| Shops owned | Fee multiplier |
|---|---|
| 1 | ×1.00 |
| 2 | ×1.25 |
| 3 | ×2.00 |
| 4 | ×3.25 |
| 5 | ×6.00 |
| 6 | (not probed — simulator district had 5 shops) **[U]** |

…and sets **max capital** (investment ceiling) as a multiple of shop VALUE:

| Shops owned | Max capital |
|---|---|
| 1 | 0.5 × value |
| 2 | 1 × value |
| 3 | 3 × value |
| 4 | 9 × value |
| 5 | 11 × value |

Key subtleties:

- **Shop VALUE does not change with district ownership count** — only the fee
  and the max capital scale. (Value changes only via investment and venture
  cards.) **[V]** (Simulator: values stayed 240/90/210/300/360 at every
  ownership level.)
- The multiplier applies to the count owned **by one player** in that
  district; "domination" (owning all) is just the top row of the table.
- The fee jump from 3→4→5 shops is enormous (×2 → ×3.25 → ×6) — domination
  matters far more than the early steps.

## Investment

- Landing on your own shop lets you invest in **any** of your shops
  (mariowiki) up to **999G per turn**, bounded by each shop's max capital. **[V]**
- Investing increases the shop's **value** (and therefore the district's
  stock price via the 4% rule, and the fee through recalculation).
- Blue Pichu (part 2, images not fully recoverable): "the price's multiplier
  would increase by 1 every time the shop's value was invested" — i.e.
  investing a full shop-value's worth of capital adds roughly +1× to the fee
  multiplier. **[S]** Exact investment→fee formula not recovered.

## Vacant plot buildings (Standard rules only)

Build cost 200G (renovating an existing building: +150G surcharge;
3-Star Shop costs 1,000G). **[V]**

| Building | Visitor effect | Owner effect |
|---|---|---|
| Checkpoint | Pays toll; toll +10G per pass (no cap documented) | May invest in other shops |
| Circus | Pays fee; tiers 100→500→1000→2000G | Expands it (max 3 upgrades) |
| Balloonport | Pays **40 + 10×owner level + 1% of owner's total property value** **[V]** | Travels anywhere free |
| Tax Office | Pays **10% of their net worth to the owner** | Gains 5% net-worth bonus on landing |
| Home | Pays 30G × owner's level; all players congregate | — |
| Estate Agency | Acts as a take-a-break square for visitors | May buy any unowned shop |
| 3-Star Shop | Normal shop, starting value 1,000G | May invest in any shop |
