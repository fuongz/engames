# Xu Vũ Trụ — notes

**Reference:** the coin-shooter + coin-pusher redemption cabinet genre (you shoot
tokens at a moving target under a prize wheel; a hit spins the wheel for tickets,
and the tokens fall onto a pusher shelf with special pieces that trigger a bonus).
This is an original take: robots and outer space, six energy cores, a cat-card
album, our own wheel, gate, art and names. Nothing from any licensed machine (no
characters, logos, sounds or layouts).

## The machine

| Part | What it does |
| --- | --- |
| SHOOT | 1 coin up the chute; hold (or Auto) to fire every 0.25 s (FIRE_INTERVAL 0.24, rounded up to whole 1/60 steps) |
| Wheel | 11 slots, turning ~0.12 rev/s as decoration. It does not pay by where it stands: a prize spin picks the slot (below). Every slot is drawn exactly as wide as its weight, so its share of the circle is its chance, and none is under MIN_SLOT_WEIGHT = 7.5% so its tile fits whole (art.ts `tileFit`: never cropped, never squashed) |
| Gate | A rail under the hub with a cup in it. The cup swings on a sine, ±GATE_AMP = 40 px, one swing per GATE_PERIOD = 1.7 s, the speed drifting ±10 % over 5.9 s so a held button can't lock onto it |
| Landing | Every shot coin lands on the same spot, LAND_X = 0 (the gate's centre), FLIGHT_UP = 0.42 s after the press. A dotted guide runs from the chute's mouth to it and a target ring marks it |
| Ready cue | When a shot fired now would drop into the hole (`readyToShoot`, from `onArrival`: the swing, the coins already in the air and the prize spins stepped forward exactly as `update` will, ceil(FLIGHT_UP / dt) steps), the cup glows green with a green ring, a ring pulses out and a green arrow points at the target. It stays off while the lid will be shut when the coin arrives |
| Hole | The hole's centre within ±HOLE_HALF = 18 px of the landing spot: swallowed, +1 prize spin in the stock. Otherwise it bounces off and falls onto the shelf as one coin at a seeded x |
| Lid (1.2.0) | While the stock is full (`lidShut`: all PRIZE_QUEUE_MAX = 4 lamps lit) a terracotta lid plugs the cup (drawn in code, art.ts `drawLid`, dropping in over 0.18 s). A coin that arrives over the hole then knocks on the lid and bounces onto the shelf exactly like a miss (`gate` event `lid: true`, `hit: false`). Nothing is swallowed for nothing and no "Spins full" pop shows; the lamps blink |
| Prize spin | A weighted pick of a slot (seeded). A light chases round the slots for PRIZE_SPIN_TIME = 1.7 s, braking onto the picked slot, which blinks for PRIZE_HOLD = 0.45 s; it pays when it stops |
| Ticket slot (5/10/20/50/100) | tickets straight to the counter |
| Coin slot (2/4) | that many coins rain onto the shelf, one per equal band of its width |
| Core slot | an energy capsule drops onto the shelf + a **Mini spin**: tickets 20/30/40/50 or coins 20/25/30/35 |
| Card slot | a cat card drops onto the shelf, picked by CARD_WEIGHTS (below) |
| Shelf | walls on both sides the whole way; only the front edge drops things: +1 coin and +1 ticket per coin, except into the jar |
| Robot jar (1.2.0) | A glass jar with a robot face stands on the middle of the front lip (art.ts `drawJar`, drawn in code). A coin whose centre leaves the front within JAR_W / 2 = 22 world units of JAR_X = 220 (the middle 44 of the shelf's 440, **10.0 %** of the front edge, ~46 px on screen) drops into it and is kept: no coin back, no ticket (`fall` event `jar: true`, `State.eaten`). The jar munches (squash, happy eyes, chewing, "Măm!/Yum!", antenna lit) and its coins pile up inside. Its lane is marked over the coins: a terracotta tint, dashed cream rails at the section's exact edges and chevrons running toward it. Capsules and cards are never eaten: in the jar's section they count like anywhere else |
| Core meter | 6 slots; only a capsule pushed off the **front** fills one. The sixth earns a **Super spin** (80/100/150/200/250/300/500 tickets), played on the full-screen Super wheel (1.4.0, below) |
| Cards | a card pushed off the **front** goes into the card inventory (`State.cards`, a count per cat: duplicates stack) and pays nothing by itself. `State.seen` marks cats ever collected. The player exchanges cards for tickets when they choose (below) |
| Out of coins | coins at 0 and nothing in the air, on the wheel, in the stock or on the reels, and nothing has fallen for ~5.7 s: the machine **idles** (`State.idle`). There is no end state and no blocking panel: a strip over the shelf shows the next daily coins (the streak's next amount; for a guest, a sign-in hint) and the code button, and, signed in, a line pointing at the Prize Counter. `grantCoins` or a coin pushed off the shelf (not into the jar) wakes it where it stood |

## 1.4.0: the Super wheel

The Super spin left the reels for a full-screen wheel the player sits and
watches. The genre's mobile coin pushers stage it this way (a giant wheel rising
from the bottom of the screen); only the staging is borrowed, the art, colours
and names are the game's own, all drawn in code (art.ts `drawSuperBackdrop`,
`drawSuperWheel`, `drawSuperNeedle`, `drawSuperCrest`, `drawSuperButton`,
`drawSparkles`).

- **Earning it.** Every sixth core pushed off the front (logic.ts `collectCore`)
  adds one to `State.superPending`: twelve cores, two waiting. Nothing goes on
  the reels any more; they run Mini spins only. `update` runs on as usual while
  one waits (a pending Super spin does not keep the machine from idling: it
  never changes the coins).
- **Spinning it.** `spinSuper(s)` (pure, seeded) picks the prize by
  SUPER_WEIGHTS and pays it at once: tickets earned, `supers` + 1, `cores` −
  CORE_COUNT, `superPending` − 1 (+ 1 again if the cores left still cover a
  meter). It returns the events the reels used to send, in the same order
  (`spinStart`, `spinWin` kind super, `tickets` source super, `superReset`), so
  jackpot.ts and the stats read them unchanged. Paying at the pick means a
  reload between SPIN and the pointer stopping neither loses the prize nor pays
  it twice (save.test.ts).
- **The screen** (game.ts overlay `superWheel`). It opens 0.9 s after a Super
  spin is earned, once no other overlay, Lucky Jar line or set celebration is
  up (so it waits behind the start card and What's new), and the machine is
  frozen behind it. Phases: ready → spin → lit → prize → (jar) → close. No close
  button, and no tap skips the spin.
  - **Layout** (logical px, checked first at 390×844 where the view is 540×1169
    from y −104): the wheel's centre sits 20 px under the view's bottom edge,
    rim radius SUPER_R = 560, so only its top shows. 18 equal slots
    (config.ts SUPER_SLOTS, each prize at least twice, never side by side), so
    three fill the game's width. The crest on the top of the rim: the six core
    orbs over a violet "SUPER" plate in rainbow letters, "6/6 lõi" above. The
    pointer is a terracotta triangle standing on the hub, tip up at the pegs on
    the ring's inner edge. "SUPER SPIN!" floats in the sky. The SPIN button
    ("QUAY!" / "Nhận Vé thưởng!") sits under the pointer, its foot at least 70
    px above the view's bottom (the home indicator).
  - **Ready.** A tap anywhere (after a 0.5 s guard, so taps meant for SHOOT
    don't spin it) or Space spins. With Auto on when it opened, it spins itself
    after 1.5 s ("Tự động quay…" under the label).
  - **Spin.** 5.6 s, six whole turns plus the way to the picked slot, a little
    off its middle; position 1 − (1 − u)³: about 3 turns a second at first,
    the last second crawling under one slot. While fast the face smears: ghost
    copies trail the turn, the colours run into rainbow bands with cream
    streaks, the numbers fade, sparkles wink over the ring. Each slot edge that
    passes flicks the pointer (a damped spring) and ticks (`sfx.tick`).
  - **Lit.** The pointer stops: the held events go to the Lucky Jar feed and
    `onEvent` now (so the roll starts here), the slot lights up and its border
    blinks for 1.1 s.
  - **Prize.** The backdrop glows, the wheel sinks away, a big ticket flies in
    and lands with a bounce, the amount counts up, coins rain and confetti
    bursts (`sfx.superBonus`). "Chạm để nhận" after 0.8 s (with Auto, it
    collects itself after 3.6 s).
  - **Jar** (signed in, a roll out): the Lucky Jar's suspense plays on this
    screen (the jar trembling, lamps racing round it, at least 1.8 s), then
    "not this time" or the jar's win (the 1.3.0 `drawJarWin`). A tap closes it
    once it has shown; a failed roll just closes. Then the wheel fades out and
    the machine plays on. A guest gets the old sign-in toast instead.
- **Saves**: schema 5 (below).

## 1.3.0: the Lucky Jar

The machine joins the shared Lucky Jar (Hũ may mắn, `manifest.jackpot`,
docs/standards/jackpot.md). Nothing in the machine's rules or its save changes:
the jar lives on the server.

- **Feeding.** logic.ts emits `{ type: "eaten", coins }` whenever the robot jar
  keeps coins (a pile counts each coin; never a capsule or a card). jackpot.ts
  (`createJarFeed`) turns each one into `ctx.jackpot.contribute(coins)`; the
  portal batches them and the server turns coins into pool tickets (×2, capped
  per player per game per day). The house pays: the player's wallet is untouched.
- **Rolling.** Each Super spin that pays (`spinWin` with `kind: "super"`) asks
  for exactly one `ctx.jackpot.roll()` (since 1.4.0 those events reach the feed
  when the Super wheel's pointer stops, and the roll plays on its screen). Rolls go one at a time: a second Super
  spin waits for the first's answer. Signed in only: a guest's trial machine
  never contributes or rolls (after a guest's Super spin a toast says to sign in).
  Every failure (offline, signed out, the server) is swallowed; the server's
  daily roll limit answers `won: false` like any miss.
- **The marquee** takes turns, 4 s each with a short fade: the Super line, the
  live pool ("Hũ may mắn 12.345 vé", from `state()` and `onState`) and, for a
  guest, "Đăng nhập để Super có cơ hội trúng Hũ". While a roll is out the lamps
  race round the sign ("Hũ may mắn…", at least 1.8 s, given up silently after
  15 s); then either "Hũ may mắn chưa nổ lần này" for 3.2 s, or the win.
- **The win** waits for the Super spin's own celebration, then 6 s over the
  whole machine, all drawn in code: the robot jar swells, trembles and bursts
  (sunburst, a flash ring, coins and confetti out of its mouth), a coin rain,
  "HŨ MAY MẮN!" and the amount counting up. Then a toast ("Bạn trúng Hũ may
  mắn 23.410 vé!"). The tickets are already in the wallet (the server paid
  them); the game reads the balance again so its counter rolls up.
- **The jar's badge**: a small glowing tag beside the robot jar, "Nuôi Hũ may
  mắn" / "Feeds the Lucky Jar", glowing brighter when the jar eats (signed in).
- **Rules and What's new**: one rules line for the jar; the rules card now steps
  its text down (19 → 14 px) until it fits a short screen.
- **Dev only**: `engames:xu-vu-tru:devJackpot` = `{ "won": true, "amount": 23410 }`
  (or `{ "won": false }`) in localStorage plays one scripted roll after the game
  starts, with no Super spin and no server (`import.meta.env.DEV`; the branch is
  not in production builds). Used for the screenshots.
- **Saves**: still schema 4; the envelope's `v` is "1.3.0". A 1.2.0 save loads
  unchanged (jackpot.test.ts).

## 1.2.0

- **The robot jar** is the machine's drain (above). Every shot ends up as about
  one coin on the shelf whatever happens at the gate, so the jar keeps about a
  tenth of every shot whatever the aim (Economy).
- **The lid**: a full stock never wastes a coin (above).
- **Prize spins pay about one coin back** (coin slots 1/2/2/1 → 2/4/2/2), so a
  hit is worth no less than a miss and good aim only adds tickets.
- **Cards for tickets only**: 60 a common card, 300 the Ragdoll, 1000 a full
  set. The coin exchange (CARD_COINS, RARE_COINS, SET_COINS) is gone.
- **The Prize Counter** (`manifest.shop`) and the **login streak**
  (`allowance.streak` = STREAK, 50/60/70/80/90/100/150), both delivered by
  `ctx.allowance.claim()` (game.ts `claimAllowance`): `coins` grants (welcome,
  a daily with its `streakDay`, a `shop` purchase) go on the balance; a
  `card-pack` grant rolls each card with `grantCard` (CARD_WEIGHTS on the
  machine's seeded random, straight into the stash, `State.packCards`) and shows
  it in the 3D card viewer, turning over from its back. Saved at once. Toasts:
  "Chuỗi ngày 3: +70 xu", "Quầy đổi thưởng: +10 xu", "Quầy đổi thưởng: <cat>".
- **Purchases arrive while the game is open**: besides the start and each
  Vietnam midnight, the game claims when it runs again after a suspend (tab,
  portal menu), on the first tap after 4 s without one (a dialog over the game,
  such as the Prize Counter, held the taps), at most every 10 s, and every 20 s
  while the out-of-coins strip shows. No window or document listeners.
- **The Prize Counter from the game**: the portal gives a game no way to open
  it, so the out-of-coins strip, signed in, points at the ticket chip instead
  ("Thêm xu: bấm ô vé ngoài trang để mở Quầy đổi thưởng").
- The item kind is `card-pack`, not `cardPack`: conventions.test.ts requires
  kinds in lowercase kebab case.
- **Saves**: schema 4 (below).

## 1.1.0

- **Endless play.** Nothing ends a run or blocks the machine. `reportScore` is
  never called (it opens the portal's score dialog). The leaderboard is filed
  silently: a cloud save carrying a `detail` is scored by the server from the
  save (`rules.score` = `lifetimeTickets`, `apps/web/src/server/saves.ts`). One
  rides along at most every 60 s while `lifetimeTickets` grows, and on suspend,
  on dispose and when the coins run out (at most every 10 s). The debounced
  saves (4 s after a change) carry no detail. The server's `saveScore` upserts on
  (game, user) keeping `max(score)`, so the board holds one row per player and
  refiling only ever raises it.
- **Readable gate** (no landing spread, guide, target ring, ready cue, hole
  15 → 18 px, swing 1.45 → 1.7 s, amplitude 45 → 40 px).
- **Wheel**: 24 slots → 11, coin slots on 38.5% of spins (was 5.4%).
- **Cards**: the rare Ragdoll; duplicates stack in an inventory; exchange by
  choice (the automatic 60 tickets per card and the automatic 1000-ticket set
  bonus with the album reset are gone); a 3D card viewer.
- **Saves**: schema 3 (below).

## Difficulty (measured, logic.test.ts "gate difficulty")

Every coin lands on LAND_X, so only timing matters: the hole is over the spot
for asin(HOLE_HALF / GATE_AMP) / (π/2) = asin(0.45) / (π/2) = 29.7% of the time.

| Fire times | Hit rate (bun over logic.ts, 2026-11-11) |
| --- | --- |
| Random (each 1/60 step fires with p = 0.06) | 30.0 % (20,000 shots) |
| Button held / Auto | 29.8 % (20,000 shots): no lock-in |
| Fired while the ready cue shows | 100 % (2,000 shots): the cue is exact |
| Well-timed taps, aimed at the middle of each green window with a normal timing error σ = 0.06 / 0.10 / 0.14 s | 96.2 / 78.4 / 62.0 % (2,000 shots each) |

A green window lasts about 0.25 s, twice per swing. These rates are timing
alone: a coin over the hole counts whether it drops in or knocks on the lid
(1.2.0). The test checks random and held in 26–34%, the cue at 100% (it is off
while the lid will be shut, so a cued shot always drops in) and σ = 0.1 s at
≥ 75%. With the button held most of those coins find the lid shut (a spin takes
2.15 s, hits come about once a second): 12% drop in.

## Economy (config.ts)

The side walls keep everything, misses and lid bounces come back as a coin on
the shelf, and prize spins pay about a coin back, so every shot ends up as
about one coin on the shelf. The only way out for a coin is the front edge,
and the jar keeps the ones that fall in its tenth of it. The drain is that
tenth, whatever the aim.

The wheel (weights in percent; widths on the wheel are the same numbers),
clockwise: t10 10 · c2 10 · t5 9.5 · c4 10 · core 8 · t20 10 · c2 10 · t100 7.5 ·
c2 8.5 · card 7.5 · t50 9. Slot order and kinds are as in 1.1.0; three coin
slots pay more (c1 → c2 twice, c2 → c4 once).

| Per prize spin | Expected value |
| --- | --- |
| Ticket slots (46%: 5/10/20/50/100 at 9.5/10/10/9/7.5) | 15.5 tickets |
| Coin slots (38.5%: 2 at 28.5, 4 at 10) | 0.97 coins, onto the shelf |
| Core slot (8%) → Mini spin | 2.27 tickets + 0.046 coins (straight to the balance) |
| Card slot (7.5%) | 0.075 cards, worth 5.0–5.3 tickets exchanged (below) |
| **All of it** | **1.016 coins and ~23 tickets** |

| Spin | Prizes | Weights | Expected value |
| --- | --- | --- | --- |
| Mini | T20 / C20 / T30 / C25 / T40 / C30 / T50 / C35 | 40 / 0.5 / 30 / 0.5 / 15 / 0.5 / 8 / 0.5 | 28.4 tickets + 0.58 coins |
| Super | 80 / 100 / 150 / 200 / 250 / 300 / 500 | 26 / 26 / 20 / 13 / 8 / 5 / 2 | 148 tickets |

By the tables, with hit rate h: a miss puts 1 coin on the shelf, a hit 0.97 on
the shelf plus 0.046 in hand. The jar keeps ~10% of what reaches the front, so
coins back per shot ≈ 0.9 + h × 0.019: 0.906 at random aim (h 0.3), 0.919 at
perfect aim. Perfect aim drains no faster than random, and no aim runs forever.

### Drain per shot (measured)

Steady state: a machine with coins to spare, 200 shots to settle, then 4,000
more, 4 seeds each (bun over logic.ts, 2026-11-11). Drain = coins gone from the
balance, the shelf and the air together, per shot; jar = coins the jar kept per
shot. Tickets exclude cards; cards are shown per shot (each worth ~66.5 tickets
exchanged one by one, up to ~70.8 with sets).

| Play | Shots/s | Over the hole | Drain/shot | Jar/shot | Tickets/shot | Cards/shot |
| --- | --- | --- | --- | --- | --- | --- |
| Random taps (p 0.02 per step) | 0.94 | 29 % | 0.105 | 0.106 | 6.7 | 0.020 |
| Button held / Auto | 4.0 | 12 % in (the lid takes most hits) | 0.099 | 0.103 | 3.4 | 0.006 |
| Rhythm taps (every swing window, σ 0.1 s, lid or not) | 1.18 | 39 % in | 0.090 | 0.108 | 8.7 | 0.027 |
| Perfect aim (only on the ready cue) | 0.46 | 100 % | 0.076 | 0.099 | 20.5 | 0.072 |

The jar's share is 0.10 ± 0.01 in every style; perfect aim drains least (its
Mini coins skip the jar). logic.test.ts measures random, held and perfect aim
(3 seeds × 1,500 shots: 0.114 / 0.094 / 0.095 when written; 0.132 / 0.095 /
0.089 on 1.3.1 and 0.131 / 0.095 / 0.080 on 1.4.0, bun over logic.ts,
2026-11-14) and checks each within 0.05–0.14, the jar's share within
0.07–0.13, the spread under 0.06 (0.05 until 1.4.0: with the Super spin off the
reels the seeded runs shift and the spread measured 0.050) and perfect aim no
faster than random.

### Simulated sessions (bun over logic.ts, 2026-11-11, final tuning)

**The daily 50 coins on a played machine**: a machine that played its 100
welcome coins held to idle, then 50 more. A new machine's shelf (~110–137
prefilled coins) first fills up to its working level (~135–140), so its first
coins last less; the daily always lands on a played shelf. Tickets a minute
include the cards' value.

| Play | Seeds | Minutes, mean | P10–P90 | Shots | Tickets a minute |
| --- | --- | --- | --- | --- | --- |
| Button held / Auto | 48 | **3.7** | 2.1–6.3 | 513 | 759 |
| Casual taps (2 a second, no aim) | 32 | **7.3** | 2.7–13.5 | 560 | 611 |
| Random taps (~0.94 a second) | 32 | 8.1 | 5.0–12.0 | 439 | 421 |
| Rhythm taps (1.18 a second) | 32 | 9.3 | 4.3–13.8 | 605 | 676 |
| Careful aim (green cue only, σ 0.1 s; waits while the lid is shut) | 16 | 17.0 | 8.5–29.0 | 633 | 686 |
| Perfect aim | 8 | 24.7 (2 runs hit the 60-minute cap) | 9.2–60 | 682 | 716 |

Targets: held 3–5 minutes (3.7 ✓), realistic tapping 5–8 minutes (casual 7.3 ✓;
a steady rhythm tapper runs a little long at 9.3). Variance is large: a 4-coin
slot or a Super spin early stretches a session a lot. The 100-coin trial on a
new machine, held, 24 seeds: 4.9 minutes (3.5–7.3), 836 shots, ~668 machine
tickets a minute (783 with cards).

logic.test.ts runs eight seeds of each with explicit timeouts: the trial held
(mean 3–7.5 minutes, 500–1,200 shots, 500–850 tickets a minute, coin share
30–47 %), the daily 50 held (2.5–5.5 minutes; measured 3.9) and casual taps
(4–11 minutes, longer than held; measured 5.5), and one perfect-aim run of 50
coins that idles (26 minutes, 718 shots).

### What a coin is worth in tickets

Tickets earned (cards exchanged) per coin drained, from the steady state
(tickets and cards per shot ÷ drain per shot) and the daily sessions:

| Play | Steady state | Daily 50 sessions |
| --- | --- | --- |
| Button held | ~38 | 55 |
| Random / casual taps | ~76 | 69 / 89 |
| Rhythm taps | ~116 | 127 |
| Careful aim | | 232 |
| Perfect aim | ~334 | 350 |

The Prize Counter sells 10 coins for 300 tickets, **30 tickets a coin**: below
what any style earns from a coin, so buying coins pays for itself in tickets
(more so the better the aim). The daily limit (3 bags, 30 coins a day) caps
what that adds, roughly 1,000–10,000 tickets a day. A card pack (400 tickets for
one card worth ~66.5 exchanged, or 100 toward a set) is a collector's buy, never
a ticket gain.

### Card weights

When a card slot pays, CARD_WEIGHTS picks the cat: 4 for each of the nine
common cats, 1 for the Ragdoll (RARE_CARD). Out of 37: each common cat 4/37 =
10.81%, the Ragdoll 1/37 = 2.70%. logic.test.ts draws 18,000 cards over 300
seeds and checks every cat within 4 standard errors.

### Card exchange

Tickets only, when the player chooses:

| Exchange | Tickets |
| --- | --- |
| One common card (9 cats) | CARD_TICKETS = 60 |
| One Ragdoll (rare) | RARE_TICKETS = 300 |
| A full set of 10 (one of each, consumes 1 of each) | SET_TICKETS = 1000 |

Tickets go to the shared wallet (`ctx.tickets`; a guest's trial tickets) and
count on the leaderboard. A card is worth ~66.5 tickets one by one, at most
~70.8 with sets wherever a Ragdoll allows (1000/37 + 27/37 × 60).

**Why the coin exchange went.** In 1.1.0 cards could also turn into coins (3 /
15 / 50), kept that low so a card slot could never hand back more coins than its
shot cost, which made the exchange feel bad. With prize spins now paying about
a coin back, any coin from a card would tip perfect aim past one coin a shot
and the machine would never run dry. Tickets only keeps cards worth having and
the coin balance honest.

The server's plausibility check allows up to RARE_TICKETS (300) tickets per card
gone from the inventory since the last save, on top of the per-shot bound, so an
exchange of a hoard with no shots in between is accepted and a jump without
cards spent is not. Cards from the Prize Counter enter the stash without shots;
exchanging them later is accepted the same way.

## Saves (save.ts)

`{ v, schema, state }`; `migrate` walks old schemas up one step at a time.

| Schema | Written by | `state` |
| --- | --- | --- |
| 1 | early 1.0.0 | the plain State, album as owned flags |
| 2 | 1.0.0 | bodies and flights packed into tuples, floats rounded, album as a bit mask |
| 3 | 1.1.0 | as 2 on the 11-slot wheel, with `cards` (a count per cat) and `seen` (bit mask) instead of the album |
| 4 | 1.2.0 | as 3, plus `eaten` (coins the jar kept) and `packCards` (cards bought at the Prize Counter) |
| 5 | 1.4.0 | as 4, plus `superPending` (Super spins earned, not spun); `queue` and `spin` hold Mini spins only |

2 → 3 (`toV3`): each owned cat becomes a count of 1 and is seen; a prize spin
running on the old 24-slot wheel is dropped, refunded into the stock (capped at
4) if it had not paid; coins on their way up land on LAND_X. Coins, lifetime
tickets, cores and the shelf carry over. save.test.ts migrates a live-shaped
1.0.0 save and checks all of it.

3 → 4 (`toV4`): `eaten` and `packCards` start at 0; nothing else changes. The
wheel kept its slots in the same order, so a prize spin saved mid-run stays on
its slot (a coin slot pays the 1.2.0 amount). 1.1.0 paid card exchanges at once,
so there are no pending coin exchanges to convert. save.test.ts migrates a
live-shaped 1.1.0 save (a stash, a spin running, coins in the air), checks the
machine is otherwise identical, that the server accepts the next save after
it, and walks a 1.0.0 save all the way up.

4 → 5 (`toV5`): every Super spin still owed (waiting in the queue, or running
on the reels unpaid) is a full meter whose cores are still in `cores`, and one
that already paid has spent its six, so `superPending` = ⌊cores / 6⌋. 1.3.x
queued the second of two only once the first paid; 1.4.0 owes both at once.
The Super spins leave the queue and the reels; Mini spins, the cores and the
rest carry over. `validState` refuses a Super spin on the reels and a
`superPending` the cores don't cover. save.test.ts migrates a queued one, a
running unpaid one, a paid one and twelve cores, checks the server accepts the
next save, and that a Super spin spun before a reload stays paid once.

The session simulations in logic.test.ts (`continuous play`) are opt-in because they are slow:
run `XVT_SIMS=1 bunx vitest run src/xu-vu-tru` from packages/games after any economy change.
Since 1.4.0 they spin each Super spin the moment it is earned (`play` in
logic.test.ts), as the shell's wheel does; game time stops while the wheel
shows, so the minutes are unchanged by it.

## Physics (physics.ts)

Our own, no dependency: discs on a 2D shelf seen from above, fixed 1/60 steps,
Coulomb friction + light damping, a sweep-and-prune pair list, five passes of
mass-weighted position correction plus inelastic contact impulses, the pusher as a
moving wall that hands its speed to what it touches, side walls the full depth of the shelf.
No randomness inside the step and a fixed order, so a run replays from its seed.
Depth is faked: a coin dropped onto a coin becomes a pile (`stack`, up to 3) worth
that many coins; past 170 bodies the oldest coin is folded into a neighbour's pile.
The renderer tilts the shelf into a 3/4 view and draws piles as offset discs.

## Changed from the genre

- No real money, tokens or prizes: tickets are only the score; the cards are
  in-game collectibles only (no trading; the Prize Counter sells them for
  tickets, never for money).
- Solo only (no online, no computer player).
