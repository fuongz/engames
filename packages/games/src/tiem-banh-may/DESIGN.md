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

## Storefront decor

Decided with the owner on 2026-10-25 (issues #16–#20). The player furnishes
the storefront like a cosy café; the furniture gives a new stat, **Charm**
(_Cuốn hút_, heart icon), and Charm brings more customers.
- **The room** is redrawn in a three-quarter top-down view, straight on (no
  vanishing point, not isometric): the back wall with the arched door at the
  top, a floor of square tiles below that reads as a grid. Wall and floor are
  split on one straight baseboard line, so the player picks each separately.
- **Free placement on the grid.** Tiles on the path from the door to the
  counter, and the queue in front of the counter, can never take furniture,
  so customers never walk through it. Furniture is drawn sorted by its bottom
  row, then customers, then the counter.
- **Decor mode** is a _Trang trí_ tile on the night screen (never while
  open), `decor.ts`: the room with a faint grid, the door and till tiles
  marked; drag a piece (its tiles turn green where it fits, red where it
  doesn't), drop it on the storage drawer to put it away, drag one up from the
  drawer; tap a piece for flip ⇄ and store ▾. The charm chip updates live; a
  layout that blocks the way or a stand's front shows why and "Xong" stays
  shut until it is fixed. "Huỷ" or ✕ leave without saving.
- **The storefront while open** (`storefront.ts`, `shop.ts`): the room stands
  on the counter (its floor ends at the counter's top), furniture and
  customers are drawn back to front, customers walk the shortest free path
  from the door to the till and queue back along it, so nobody stands in a
  piece. Clouds, rain and dusk tint the room; rain falls past the door's and
  the window's glass. The day report still uses the old painted shop.
- **Charm** is the sum of placed pieces' charm. A second copy of the same
  piece counts 50%, a third 25%, more nothing; stored pieces count nothing.
  **Set bonus**: 3 placed pieces of one theme +10%, 5 pieces +25%.
- **Demand**: customers × `1 + 0.5 × (1 − e^(−charm / CHARM_SCALE))`, beside
  weekday × weather, so it never outweighs reputation.
- **Seats**: each placed seat makes queuing customers a little more patient
  (capped), so seating matters beyond charm.
- **Tiers** Giản dị → Ấm cúng → Dễ thương → Nổi tiếng: each new tier puts a
  new theme on sale and raises the VIP chance a little.
- **The Furniture aisle** (_Nội thất_) in the market: one card per piece with
  its picture, price sticker, a ♥+charm chip and how many are owned; a theme
  above the storefront's tier is greyed out with the tier that opens it, and
  the page ends with the current charm and the next tier. Same basket and
  till. A bought piece stands in the first free spot that keeps the layout
  valid (storage only when the floor is full), so it counts at once. Daily
  rotation of rarer pieces waits until there are more themes; walls and floors
  go on sale with their art.
- **Starting set** (free, placed in a default layout; old saves get it too):
  two round tables, four wooden chairs, a potted plant, plain wall and floor.
- **Themes**: Cơ bản (basic), Hồng ngọt (sweet pink), Vườn hoa (flower
  garden), Rừng xanh (forest), Cổ điển (classic). Every piece of a theme shares
  its colours and motifs; every piece of the game shares one camera and scale.
- The leaderboard worth includes furniture value (what was paid beyond the
  free starting set).
- **Numbers** (`config.ts`, logic in `furniture.ts`): a 6×5 grid, the tile
  inside the door and the two queue tiles at the till kept clear, a walkable
  way from the door to the till and a free tile in front of every stand. Tiers
  at charm 0 / 8 / 25 / 55 (the starting set is 6.9; a plant and a table more
  reach Ấm cúng), `CHARM_SCALE` 30, +3% VIP chance per tier, +4%
  patience per seat up to +20%. Basic pieces give 0.5–1.5 charm, Hồng ngọt 3–5,
  the classic glass case and fridge 6–7. Save v5 adds `decor` (owned, placed,
  wall, floor); v4 saves get the starting layout.

### Self-serve stands (2026-10-25)

The player no longer picks pieces for each order: customers serve themselves
and the player works the till.
- **Cake stands** (_quầy bánh_) are furniture placed on the grid, bought in
  the Furniture aisle; each holds 2–3 batches, any recipe the player chooses
  in decor/night prep. They replace the display-case screen. Two basic stands
  come with the starting set; more stands mean more variety and add charm.
- **Customers** walk in, browse the stands, take their pieces and queue at
  the till. A wanted recipe that is missing: they usually take something else
  on display; if the stands are nearly empty they leave a little sad (small
  reputation cost), so a full, varied display still matters.
- **The till** keeps the two skills: boxing (4+ pieces, the snuggest box tips)
  and counting the change.
- **The critic** looks for a 3★ piece on the stands and leaves without one;
  **pre-orders** are taken from the held-back pieces automatically.
- **Built (2026-10-25)**: each batch stands on a shelf (stands back to front,
  left to right, one batch a shelf; three pieces drawn on a wide shelf, two in
  the fridge; batches past the last shelf still sell). The display holds 12
  pieces per shelf (18 with the big-display upgrade), so the starting two
  stands hold 48; a layout needs at least one stand. A customer walks to the
  stand showing what they want (or any with cakes; none at all and they turn
  round at the door), looks for a moment, takes their pieces (best stars
  first; the critic only 3★), then queues along the walkway; at the till
  their pick is on the tray and the player rings it up ("Tính tiền"), boxes
  4+ and counts change. Walking off with a pick puts it back. The case under
  the counter now just shows what is left ("Trên quầy").
- **The checkout counter in the room** (decided 2026-10-25 after the owner's
  reference): the till is furniture (`till-basic`, free; `till-pink` on sale),
  exactly one per shop, two tiles wide with the cashier's row behind it. Mây
  stands behind it; customers pay on the tile in front of its left half and
  queue back along the walkway to the door. Checkout runs on its own
  (`CHECKOUT_SECONDS` 3.2 s, a bubble over the counter with the pieces, the
  total and a progress bar); tapping the counter takes a third off. 4+
  pieces still open the box choice; change is given automatically. The big
  counter, glass case and tray at the bottom are gone: the room fills the
  screen under the bar, with a strip under it showing what is left on the
  stands and the discount / close-early buttons. Stands can be reached from
  any free side. Save v6 lays v5 floors out afresh around the counter (pieces
  bought before wait in storage).
- **Walls and floors**: one wall and one floor show at a time; buying one puts
  it up at once, and the decor drawer has Đồ đạc / Tường / Sàn tabs to switch
  between those owned. Each variant is a full room picture (`room-<id>`,
  edited from the plain room so the door, window and grid stay put); the game
  draws the wall from one picture and the floor from another, split on the
  baseboard. Walls: cream (free), pink stripes, mint gingham, tiny flowers,
  butter stripes; floors: cream checks (free), wood, pink, mint, flower
  tiles, argyle, lemon.
- **More themes** (from the owner's references, described in words, never
  copied): Tiệm hoa (florist, Ấm cúng), Mây (clouds, Dễ thương), Kẹo tím
  (lavender sweets with two stands, Dễ thương), Bánh mì (toast and melon
  buns, Nổi tiếng).
- **Themes in the aisle** (nine to a page, by tier): Cơ bản, then Hồng ngọt,
  Vườn hoa, the bread shelf (Ấm cúng); Rừng xanh, glass case and fridge
  (Dễ thương); Cổ điển clock, lamp, armchair, tea table (Nổi tiếng).

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
- **Customers** (`customer-*.webp`): redrawn on 2026-10-25 with the decor
  (the owner's call): tiny chubby mochi animals, flat pastel fills, dot eyes
  and blush, and the decor's thick broken cocoa line (#765e4c), applied by
  the outline tool in `art-src/.../tools/outline.py` (gitignored with the
  sources) so every customer has the same line.
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

### The market ("Siêu thị")

A little supermarket: shop first, pay once at the till. A little grocery with one page per aisle, picked with tabs: dry goods, a
chilled case (milk, cream, butter, eggs), flavours and fruit. Each page is two
shelves of two products under the shop's awning, and the coffee waits by the
till on every page. Price and amounts never share a line: the price is a round
yellow sticker on the product (just the number; the yellow says "price"); the tag clipped to the
shelf says the name, the pack ("Gói 1 kg") and what is in the pantry. Tapping
a product puts a pack in the basket (a green ×count on its right, a "−" on its
left, the tag turns green); the till shows the basket, its total and the pay
button. Switching aisles keeps the basket. Tapping the basket at the till (a
green count badge on it, nudged each time something goes in) opens its list:
one line per product with picture, pack, pantry stock, − count + and the
line's price, records with a ✕, six lines a page; then the total, "Bỏ hết"
(put it all back) and pay. The list's pay button shares the till's `pay` key,
so the first-day tour points at whichever is showing. Art: `bg-market`,
`shelf-wood`, `shelf-fridge`, `fridge-back` (a 9-slice, see `nine()`), `basket`.

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

### Mây, the mascot

Mây is the bakery's white kitten baker (pink apron with a cupcake pocket, puffy
chef hat, cloud-puff tail), drawn in the customers' style with the game's
broken outline. Turnaround sheet and poses in `art-src/.../png-mascot2/`;
in game: `mascot-wave`, `mascot-point`, `mascot-happy`, `mascot-avatar`.

### First-day tour

`tour.ts`: on day 1 Mây walks a new baker through the market, the first batch
of cookies, the display, bed and the first customers. Each step darkens the
screen except the button it points at (a Ui region key, found with
`ui.find`), with a bobbing hand and Mây's speech bubble; only that button
takes taps. A step ends when the game reaches its goal, so running ahead
skips steps. Skippable from every bubble ("Bỏ qua" on the first, a small ✕ on
the corner of the rest; a toast then says Settings can replay it); progress
is kept per bakery on the device (`tour:<player>:<slot>`).

### Music box and records

The record sits in the kitchen's top bar beside the calendar as a vinyl disc
(`vinyl.webp`, 2026-10-25) and plays the record on the box (tap it to
choose). Playing, it spins and notes drift up; turned off, it slows to a stop
and dims (`hud.ts`). A suitcase record player was tried first but sank into
the bar (its sources stay in `art-src/.../png-r3/player/`).
records go in the supermarket basket from its "Đĩa nhạc" aisle (a green tick; tap again to put one back) and are paid with everything else at the till; the last one bought goes straight on. Each record is a track
from the owner's licensed Cozy Tunes pack, converted to
`audio/music-<record>.mp3` (gitignored, like Sheep): a record whose file is
missing is not offered. A record playing at closing adds `RECORD_MOOD` mood.
Save v4 adds `records` and `playing` (older saves get Sheep, playing).

To restore the tracks on a deploying machine, run the ffmpeg command under
Music for each: sheep, cuddle (Cuddle Clouds), clouds (What Clouds Are Made
Of), floating (Floating Dream), sunlight (Sunlight Through Leaves), breeze
(Gentle Breeze), golden (Golden Gleam), evening (Evening Harmony), wildflowers
(Wildflowers By The River).

### More recipes

Thirteen recipes: the first six, plus sweet milk bread, banana bread, bánh bò
(steamed: a new stove mode), croissants, salted-egg sponge, macarons and
tiramisu (coffee joins the shelf for it), with eight new ingredients (rice
and almond flour, cocoa, bananas, coconut milk, mascarpone, salted eggs, pork
floss) in a new "Đặc sản" aisle and the others. The book shows recipes six to
a page, cheapest first, with Recipes/Upgrades tabs.

Changed with the owner on 2026-10-25: the donut is now **chocolate** (same
`donut` id, so saves keep it; the strawberry glaze is set aside), the starter
cupcake is **blueberry** (30 g of blueberries before the frosting, a cheap
fresh pack so the first week still pays for a recipe), and a fourteenth
recipe, the **matcha roll cake** (1500, sponge with matcha powder, cooled,
spread with cream and rolled: a new `roll` finishing step). Blueberries and
matcha powder are on the flavour aisle.

### UI kit

`kit.ts` is the bakery's component set: `pill`, `roundButton` (settings,
pause), `infoCard`, `weatherCard`, `calendar`, `toolbar`, `tabs`, `statTile`, `priceSticker`, `dialogButtons`, sized by one table `K` (pill
height, stroke, icon slot, gaps, dialog inset). `hud.ts` builds the top bar
from it. New UI should start from the kit; screens move onto it over time.
`toggle` (an on/off switch whose knob slides) and `menuButton` (a wide button
with an icon in a white circle before its label) build the settings, whose
line icons (speaker, notes, shop, restart) are drawn in `art.ts` and give way
to `img/icon-<name>.webp` if one is ever added.

### Motion

`motion.ts`, after Emil Kowalski's rules: one strong ease-out
(`cubic-bezier(0.23, 1, 0.32, 1)`), everything under 300 ms. A dialog's shade
fades in and its paper grows from 0.95 while fading in (220 ms); keyed by
title, so a dialog that appears pops itself. Exits cannot be drawn in an
immediate-mode frame, so the shell copies the canvas just before every tap or
change of screen and, if the next frame shows another screen (220 ms), a page
or tab turned (150 ms) or a dialog gone (160 ms), fades the copy out over it.
Toasts rise with the same ease-out. Counts nudge their badge (200 ms), and
switches slide (160 ms). `prefers-reduced-motion` keeps the fades and drops
scale, slide, spin and drift.

The kitchen's next-step hint is a toast Mây says above the display case: it
rises in, leaves by itself after 8 s or when tapped (✕), and returns when the
advice changes or the player comes back to the kitchen, unless they skipped
that advice. It stays away during the first-day tour.

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
