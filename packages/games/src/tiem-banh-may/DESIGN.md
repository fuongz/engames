# Tiệm Bánh Mây / Cloud Bakery — design notes

An original game (no reference recording, so no RE_NOTES): a portrait bakery
sim, designed with the owner before any code. These are the decisions that were
locked; the numbers live in `config.ts` and are checked by `logic.test.ts`.

## The day

| Phase        | Hours        | Clock                                                                                                                          | What the player does                                       |
| ------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Prep (night) | 16:30 → 9:00 | a **budget** of 570 minutes; each job spends some (market trip 30', a batch = its recipe's minutes), bed 22:00–5:00 is skipped | read tomorrow's forecast, shop, buy recipes/upgrades, bake |
| Open         | 9:00 → 16:30 | real time, `SELL_SECONDS` (4 min)                                                                                              | sell only, **no baking**; then the day's books             |

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

Two looks for the world, plus the interface:
- **Cakes, ingredients, tools, rooms, key art** (bitmaps in `img/`): cosy
  hand-drawn 2D, after a reference bakery game the owner picked (2026-10-24).
  Dark warm-brown hand-drawn outline that **breaks where the light hits** (a gap
  on the lit edge with a small cream highlight stroke inside); soft
  coloured-pencil / watercolour fills with one gentle warm gradient per area;
  cream, butter, caramel, toasted brown, terracotta, mint, soft pink. It must
  stay 2D: no 3D-render or "AI CGI" look, no gloss, no volumetric light. No
  text or logos inside images.
- **Customers** (`customer-*.webp`): unchanged from the first art pass, by the
  owner's choice: flat fills, thin wobbly brown outline, dot eyes. They sit
  well next to the new items because the outline colour matches.
- **Interface** (`art.ts`): cream paper pages on a terracotta clipboard with a
  metal clip and the title in white above it, caramel-bordered cards, cream pill
  buttons with a thick brown outline and a lip, mint sunburst tiles for owned
  items, a round orange close button, cream triangle page arrows. The recipe
  book is a two-page menu (recipes, upgrades).

History: the first pass was pastel pink/lavender with flat items; a glossy
attempt looked like two games; the owner then moved everything but the
customers to the cosy hand-drawn style above.

### Making more art

Generated with gpt-image through Codex (`image_generation` feature), about 14k
Codex tokens an image. What keeps a new sprite in style is **attaching approved
sprites as references**:

```sh
cd <scratch dir>   # Codex writes the PNGs here
cat style.txt batch.txt | codex exec --skip-git-repo-check --ephemeral \
  -s workspace-write -C . \
  -i <path>/img/cake-cupcake.webp -i <path>/img/ing-eggs.webp -i <path>/img/tool-bowl.webp -   # "-": prompt from stdin
```

- The prompt is the style block above stated strongly (the broken highlight
  outline is the signature; list the 3D/gloss looks to avoid), plus: "square
  1024x1024, one centred subject filling ~70%, transparent background (else flat
  #FF00FF, no ground shadow); original designs only; no text or logos".
- New customers (if ever) follow the old flat style instead: attach
  `img/customer-bear.webp` and ask to match it in scale, pose and framing.
- Rooms are portrait 1024x1536, fully painted, no characters, with the area the
  game draws on left empty (the kitchen worktop, the shop floor).

Then trim and convert (ImageMagick):

```sh
# items (cakes, ingredients, tools): 256 px; customers 400 px; oven 400, bowl/pan 360, scale 320
magick in.png -trim +repage -bordercolor none -border 6 -resize 256x256 \
  -quality 86 -define webp:alpha-quality=95 -define webp:method=6 img/name.webp
# rooms
magick bg.png -resize 768x1152 -quality 82 -define webp:method=6 img/bg-name.webp
```

`sprites.ts` picks up every `img/*.webp` by file name; nothing else to register.
`poster-art.webp` / `banner-art.webp` (key art, not loaded by the game) feed
`cover.ts`; `bun run art` builds the posters, banner and share card.

**Sources** (gitignored, on the machine that made them): `packages/games/art-src/tiem-banh-may/`
holds the 1024 px originals (`png/`, and the first flat set in `png-flat/`), the
approved samples (`anchors-v2/`, first pass in `anchors/`), the exact prompts
(`prompts-v2/`, `prompts/`) and the owner's style references (`refs-v2/`, `refs/`).
The references are someone else's work, so they stay out of git: use them to
judge the look, never copy a character from them.
