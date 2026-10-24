# Tiệm Bánh Mây / Cloud Bakery — design notes

An original game (no reference recording, so no RE_NOTES): a portrait bakery
sim, designed with the owner before any code. These are the decisions that were
locked; the numbers live in `config.ts` and are checked by `logic.test.ts`.

## The day

| Phase | Hours                                  | Clock                                                                                                                                                                                           | What the player does                                              |
| ----- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Night | 16:30 → 9:00                           | runs by itself at `NIGHT_SPEED` (1 game minute a real second, ▶▶ for ×8) in the kitchen and while baking, holds in menus; the market trip and a nap jump 30 minutes; going to bed jumps to 5:30 | read tomorrow's forecast, shop, buy recipes/upgrades, bake, sleep |
| Open  | from 9:00 (9:30 at the latest) → 16:30 | real time, `SELL_SECONDS`                                                                                                                                                                       | sell only, **no baking**; then the day's books                    |

Cakes keep for the day only: whatever is left at 16:30 is binned and shows as a
loss in the report. Fresh ingredients (eggs, milk, cream, strawberries) spoil
after 3 closings (5 with the fridge); dry goods keep.

### The running clock

Ovens, proofing and cooling run in the background: at a timed step the baker
can **step out** and the batch keeps going on the night clock, shown on the
kitchen worktop with a countdown; a bell rings when it is done and leaving it
too long in the oven burns it (sleeping with something in the oven burns it
too). One oven, two with the upgrade. "Open shop" works only from 9:00; at
9:30 the shop opens by itself and customers from before the doors opened are
lost. Anything still in an oven at closing time is gone. Saves happen on
events and every ~15 s while the clock runs.

### Sleep, energy and mood

- **Sleep** is 22:00 → 5:30 (7.5 h). At 22:00 the game asks: bed, or stay up
  (at most until 1:00, then bed is forced). Going to bed early sleeps longer;
  opening the shop while still up sleeps first. Less than 7.5 h means a tired,
  gloomier morning.
- **Energy** (0–100): every minute awake costs some, a day at the counter
  costs `SELL_ENERGY`, sleep gives it back (scaled by mood, minus any coffee
  that night). Below 50 the hands shake: pours surge, stirring drifts, taps on
  the stove and oven land late, the oven dial can jump two notches, and picking
  at the counter takes a beat. At 0 there is no new work until the baker rests.
  A **coffee** (bought at the market) gives energy now and costs sleep; a
  **nap** gives a little back for 30 minutes.
- **Mood** (0–100): up with a full night, 3★ batches and a profitable day;
  down with short nights, failed batches, losses and customers walking off.
  It sets customers' patience (0.8×–1.2×), nudges tips (±1), changes how well
  sleep restores energy, and adds or takes a little reputation each day.

### Dev switches

`CHANGE_MAKING` in `config.ts` (default **off**): counting change by hand at
the till. Off, customers who pay with a note get their change automatically.

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

**Three bakeries per account** (`saveSlots: 3`, D1 `game_save.slot`). The game
opens on "Chọn tiệm": one card per slot (day, coins, reputation, or empty). The
gear by the clock opens Settings: sound (the portal's shared mute), music (this
device), switch bakery, and start over. Starting over erases only the current
slot and asks twice; the leaderboard keeps the player's best of all slots, so
nothing is lost there. Each slot has its own local backup (`backup:<player>` for
slot 0, as before slots, then `backup:<player>:<slot>`).

## Art

Two looks for the world, plus the interface:
- **Cakes and ingredients** were redrawn rounder and cuter (2026-10-24, the
  owner chose style "D" over game-icon and watercolour samples): the same
  broken brown line below, but plump bouncy shapes, oversized toppings, a rosy
  blush on the edges, plated sweets on a cream plate with a mint rim. Anchors:
  `art-src/.../anchors-v3/`.
- **Tools, rooms, key art** (bitmaps in `img/`): cosy
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
- **Interface** (`art.ts`): light and hand-made, after a reference settings
  screen the owner picked (2026-10-24): thin dark-brown outlines (`LINE`);
  pill buttons on a darker base of their own colour with a broken "stitched"
  line along the bottom; dialogs as big rounded cream panels with a stitched
  inner border and the title on a pale-blue pill over the top edge; a salmon
  round close button with a white cross; pale-green triangle page arrows;
  Mali (soft handwriting, full Vietnamese; the owner's pick, 2026-10-24) at 600–700 weight (800 in code falls back to 700). The recipe book is a two-page menu (recipes,
  upgrades).

History: the first pass was pastel pink/lavender with flat items; a glossy
attempt looked like two games; the owner then moved everything but the
customers to the cosy hand-drawn style above, first with a terracotta
clipboard UI, then the lighter stitched dialogs.

### The market

A little grocery with one page per aisle, picked with tabs: dry goods, a
chilled case (milk, cream, butter, eggs), flavours and fruit. Each page is two
shelves of two products under the shop's awning, and the coffee waits by the
till on every page. Price and amounts never share a line: the price is a round
yellow sticker on the product (just the number; the yellow says "price"); the tag clipped to the
shelf says the name, the pack ("Gói 1 kg") and what is in the pantry. Tapping
a product puts a pack in the basket (a green ×count on its right, a "−" on its
left, the tag turns green); the till shows the basket, its total and the pay
button. Switching aisles keeps the basket. Art: `bg-market`, `shelf-wood`,
`shelf-fridge`, `fridge-back` (a 9-slice, see `nine()`), `basket`.

### The kitchen, the display case and the forecast

The worktop is pinned to the counter painted in `bg-kitchen` (`coverY`), so the
bowl, scale and ovens stand on it on every screen shape, each with a soft
contact shadow (`onTable`). Inside an oven only the raw batch shows, going
golden as it bakes (`baked()`); the finished picture sits on a plate, so the
oven never fades into it. The forecast card leads with the weather (big icon
on a tinted disc, the weather in large type); the weekday lives on the HUD's
little desk calendar. The display case has its own screen (`display.ts`): a
glass cabinet (`display-case`, shelves measured at 31/53/77 % of its height)
over `bg-shopfront`, three batches to a shelf with a tag each, and a footer
with the spaces used and the one-day reminder.

### Recipes: pictures, not paragraphs

The goal everywhere is as few words as possible. A recipe's page is blocks of
pictures: the dish on a watercolour splash with four icon facts (time, pieces,
price per piece, takings per batch) and its mastery as a chef's hat with three
dots; the ingredients as tiles with the amount, green when the pantry has
enough and red when it does not; the steps as a strip of numbered picture
tiles (the ingredient, the whisk with its turns, the oven with its heat and
minutes, the pot, the piping bag). Buying a recipe opens a "learned" moment: a
doodle wallpaper (`bg-doodle`), the dish popping onto its splash, its name on
a taped ribbon, tap to continue. Recipe upgrades are not designed yet.

### The bowl

The bowl only ever shows what has gone in. Its base is the empty bowl or what
the last mixing made (`bowlBefore`); every ingredient added since lies in it as
a pile (`addedSinceMix`, `PILE`, `img/pile-*`): liquids pool underneath, solids
sit side by side. Mixing fades the piles into the mixed bowl. All bowl
pictures share one framing (cropped to the bowl, 340×256), so they line up and
the picture's bottom is the bowl's foot; the bowl stands on the counter with a
shadow in every step. Prices show on a yellow sticker in the market and on each
batch in the display case; the coin carries a little fish.

### UI kit

`kit.ts` is the bakery's component set: `pill`, `roundButton` (settings,
pause), `infoCard`, `weatherCard`, `calendar`, `toolbar`, `tabs`, `dialogButtons`, sized by one table `K` (pill
height, stroke, icon slot, gaps, dialog inset). `hud.ts` builds the top bar
from it. New UI should start from the kit; screens move onto it over time.

### Step pictures and animation

Each baking step has its own picture (`bakeart.ts` maps steps to sprites):
the bowl changes with what is in it (`bowl-lumpy` → `creamed` / `batter` /
`dough` / `custard` / `whipped` / `choux`, all the same bowl at the same
360×300 frame so they crossfade cleanly), eggs drop and crack (`egg-whole`,
`egg-cracked`), a teaspoon tips (`tool-spoon`), each recipe has a raw tray
that turns into the baked one in the oven window (`raw-*` → `plain-*` or the
cake itself), donuts fry from `raw-donut` to `plain-donut` on the `stove-hob`,
the decoration is revealed bottom-up over the bare bake (`plain-*`), dough
proofs (`bowl-dough` → `dough-proofed`) and the sponge cools with steam
(`sponge-cooling`). Steps ease in, perfect grades and finished batches throw
sparkles, the oven lets out steam, and the result card pops in with its stars
landing one by one. Sources: `art-src/tiem-banh-may/png-steps/` and
`prompts-steps/`.

### Music

Background music is "Sheep" from the **Cozy Tunes** pack by Pizza Doggy
(https://pizzadoggy.itch.io/), under the Pizza Doggy licence: fine in a game,
commercial or not, attribution optional ("Game Assets by Pizza Doggy"), but the
files must **not** be redistributed, shared in an open-source project, offered
for download, or fed to AI tools.

So the track is **not in git** (`audio/` is gitignored). On the machine that
deploys, put it back before building:

```sh
mkdir -p packages/games/src/tiem-banh-may/audio
ffmpeg -i "Cozy Tunes/Audio/ogg/Sheep.ogg" -codec:a libmp3lame -b:a 96k \
  packages/games/src/tiem-banh-may/audio/music-sheep.mp3
```

`game.ts` picks up any `audio/*.mp3` at build time; without one the game is
silent but otherwise identical. It loops through `AudioBus.loop` (core), under
the portal's mute, starts after the first tap, and fades out while the game is
held. MP3 rather than the pack's OGG so Safari plays it.

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
