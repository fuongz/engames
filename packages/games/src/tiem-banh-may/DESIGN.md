# Tiệm Bánh Mây / Cloud Bakery — design notes

An original game (no reference recording, so no RE_NOTES): a portrait bakery
sim, designed with the owner before any code. These are the decisions that were
locked; the numbers live in `config.ts` and are checked by `logic.test.ts`.

## The day

| Phase | Hours | Clock | What the player does |
| --- | --- | --- | --- |
| Prep (night) | 16:30 → 9:00 | a **budget** of 570 minutes; each job spends some (market trip 30', a batch = its recipe's minutes), bed 22:00–5:00 is skipped | read tomorrow's forecast, shop, buy recipes/upgrades, bake |
| Open | 9:00 → 16:30 | real time, `SELL_SECONDS` (4 min) | sell only, **no baking**; then the day's books |

Cakes keep for the day only: whatever is left at 16:30 is binned and shows as a
loss in the report. Fresh ingredients (eggs, milk, cream, strawberries) spoil
after 3 closings (5 with the fridge); dry goods keep.

## Baking by hand

A recipe is an ordered list of steps (`Step` in config.ts), shown as a card:
pick the right ingredient off the shelf and measure it (scale, eggs one by one,
teaspoons), stir round the bowl, take a pan off the heat at the right colour, set
the oven dial and take it out on the minute, pipe the decoration. Each step is
graded on the spot (`grade*` in logic.ts):

- a **major** slip (wrong ingredient, far off on an amount, burnt, raw) ruins the
  batch: it ends at once with a burnt / raw / flat cake;
- otherwise each **minor** slip, and every third **good** one, costs a star (3★ → 1★).

Three good hand-made batches of a recipe unlock **Làm nhanh** (quick bake): no
steps, always 2★, same time and ingredients.

## Selling

Customers are animals (sprite style: the owner's second reference, flat fills and
a thin hand-drawn outline). They queue, ask for 1–2 lines, and lose patience.
Picking, boxing (4+ pieces: the snuggest box tips) and counting change
(short-change angers them, over-change loses coins) are the skill. Extras:
pre-orders placed at the previous closing and held at opening; a food critic who
only accepts 3★; a 30% discount from 15:30 that draws a late rush; "close early"
once the display is empty.

## Money and saves

Start with 250 coins and two free recipes; recipes cost 500–2000, upgrades
600–1500. No game over: a broke bakery that can't bake anything gets a 100-coin
loan, at most every 5 days. Progress is saved to the player's account
(`requiresAccount`, `ctx.cloud`, D1 `game_save`), checked on the server by
`save.ts`; the leaderboard ranks the bakery's worth (coins + recipes + equipment),
computed from the save itself.

## Art

Bitmap sprites in `img/` were generated with gpt-image (via Codex) from two
references the owner chose: a pastel shop UI (the interface is drawn in code in
that style, see art.ts) and an animal character sheet (customers, cakes,
ingredients and rooms follow it). Sprites were trimmed and converted with
ImageMagick; `poster-art.webp` / `banner-art.webp` feed cover.ts.
