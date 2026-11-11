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
| Ready cue | When a shot fired now would land in the hole (`readyToShoot`: the swing stepped forward exactly as `update` will, ceil(FLIGHT_UP / dt) steps), the cup glows green with a green ring, a ring pulses out and a green arrow points at the target |
| Hole | The hole's centre within ±HOLE_HALF = 18 px of the landing spot: swallowed, +1 prize spin in the stock. Otherwise it bounces off and falls onto the shelf as one coin at a seeded x |
| Prize spin | A weighted pick of a slot (seeded). A light chases round the slots for PRIZE_SPIN_TIME = 1.7 s, braking onto the picked slot, which blinks for PRIZE_HOLD = 0.45 s; it pays when it stops |
| Stock | At most PRIZE_QUEUE_MAX = 4 prize spins wait (the lamps under the gate), plus the one running. A coin that drops in the hole while all four are lit is swallowed for nothing ("Spins full") |
| Ticket slot (5/10/20/50/100) | tickets straight to the counter |
| Coin slot (1/2) | that many coins rain onto the shelf, one per equal band of its width |
| Core slot | an energy capsule drops onto the shelf + a **Mini spin**: tickets 20/30/40/50 or coins 20/25/30/35 |
| Card slot | a cat card drops onto the shelf, picked by CARD_WEIGHTS (below) |
| Shelf | walls on both sides the whole way; only the front edge drops things: +1 coin and +1 ticket per coin |
| Core meter | 6 slots; only a capsule pushed off the **front** fills one. The sixth starts a **Super spin**: 80/100/150/200/250/300/500 tickets |
| Cards | a card pushed off the **front** goes into the card inventory (`State.cards`, a count per cat: duplicates stack) and pays nothing by itself. `State.seen` marks cats ever collected. The player exchanges cards when they choose (below) |
| Out of coins | coins at 0 and nothing in the air, on the wheel, in the stock or on the reels, and nothing has fallen for ~5.7 s: the machine **idles** (`State.idle`). There is no end state and no blocking panel: a strip by the coin counter shows the next daily coins (or, for a guest, a sign-in hint) and the code button; `grantCoins`, a coin exchange or a coin pushed off the shelf wakes it where it stood |

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

A green window lasts about 0.25 s, twice per swing. The test checks random and
held in 26–34%, the cue at 100% and σ = 0.1 s at ≥ 75%.

## Economy (config.ts)

Misses come back as a coin on the shelf and the side walls keep everything, so
the only drain is coins swallowed by the hole minus what prizes give back.

The wheel (weights in percent; widths on the wheel are the same numbers),
clockwise: t10 10 · c1 10 · t5 9.5 · c2 10 · core 8 · t20 10 · c1 10 · t100 7.5 ·
c2 8.5 · card 7.5 · t50 9.

| Per prize spin | Expected value |
| --- | --- |
| Ticket slots (46%: 5/10/20/50/100 at 9.5/10/10/9/7.5) | 15.5 tickets |
| Coin slots (38.5%: 1 at 20, 2 at 18.5) | 0.57 coins |
| Core slot (8%) → Mini spin | 2.27 tickets + 0.046 coins |
| Card slot (7.5%) | 0.075 cards (worth ≤ 5.3 tickets or ≤ 0.27 coins exchanged, below) |
| **All of it** | **≤ 23.1 tickets, or ≤ 0.885 coins** (cards one way or the other) |

| Spin | Prizes | Weights | Expected value |
| --- | --- | --- | --- |
| Mini | T20 / C20 / T30 / C25 / T40 / C30 / T50 / C35 | 40 / 0.5 / 30 / 0.5 / 15 / 0.5 / 8 / 0.5 | 28.4 tickets + 0.58 coins (coins 2% of the time; was 4%) |
| Super | 80 / 100 / 150 / 200 / 250 / 300 / 500 | 26 / 26 / 20 / 13 / 8 / 5 / 2 | 148 tickets |

Expected coins back **per shot**: a miss comes back (via the shelf) and a hit
pays a prize spin, so with hit rate h and every hit spun it is (1 − h) + h ×
0.885: 0.966 at the 30% of random play, 0.885 with perfect aim. Below 1 at every
hit rate, so no aim and no card strategy can run forever; with the button held
the stock also swallows hits, so it drains faster.

The 4-coin slot of the first 1.1.0 draft became a second 2-coin slot and the
Mini's coin prizes went from 1/1/1/1 to 0.5 each: with card exchange for coins
on top, the 4 pushed perfect aim to ~1.0 coin a spin.

### Card weights

When a card slot pays, CARD_WEIGHTS picks the cat: 4 for each of the nine
common cats, 1 for the Ragdoll (RARE_CARD). Out of 37: each common cat 4/37 =
10.81%, the Ragdoll 1/37 = 2.70%. logic.test.ts draws 18,000 cards over 300
seeds and checks every cat within 4 standard errors.

### Card exchange

| Exchange | Tickets | Coins |
| --- | --- | --- |
| One common card (9 cats) | CARD_TICKETS = 60 | CARD_COINS = 3 |
| One Ragdoll (rare) | RARE_TICKETS = 300 | RARE_COINS = 15 |
| A full set of 10 (one of each, consumes 1 of each) | SET_TICKETS = 1000 | SET_COINS = 50 |

Tickets go to the shared wallet (`ctx.tickets`; a guest's trial tickets) and
count on the leaderboard; coins go on the balance (`grantCoins`). A card is worth
at most ~70.8 tickets (sets wherever a Ragdoll allows: 1000/37 + 27/37 × 60) or
~3.5 coins.

**Why the coin rates are not 25 / 120 / 400.** Those were the requested rates.
A perfect player gets one prize spin per coin, so a card slot (7.5% of spins)
paying ~29 coins a card (400/37 + 27/37 × 25) adds 2.2 coins a spin: 2.8 coins
back per coin shot, an endless coin loop. Simulated (perfect aim, every card
turned into coins at once): 2.2 coins back per prize spin, and the machine never
idled within the 60-minute cap. At 3 / 15 / 50 the same player gets 0.69 coins
back per prize spin (0.885 at most by the tables) and every run ends (below).
Coins stay deliberately worth far less than tickets: 3 coins against 60 tickets.

The server's plausibility check allows up to RARE_TICKETS (300) tickets per card
gone from the inventory since the last save, on top of the per-shot bound, so an
exchange of a hoard with no shots in between is accepted and a jump without
cards spent is not.

### Simulated sessions (bun over logic.ts, 2026-11-11, final tuning)

100 coins on a new machine (the trial, or the welcome), button held until it
idles, 24 seeds; tickets are the machine's own (cards not exchanged):

| | Mean | P10 | Median | P90 | Min–max |
| --- | --- | --- | --- | --- | --- |
| Shots | 486 | 343 | 481 | 631 | 279–726 |
| Minutes | 3.6 | 2.1 | 3.9 | 4.7 | 1.7–5.4 |
| Tickets | 2,145 | 1,328 | 2,243 | 2,767 | 1,019–3,171 |
| Tickets a minute | 608 | 495 | 598 | 715 | 445–879 |
| Gate hit rate | 29.5 % | 28.7 % | 29.5 % | 30.4 % | 28.5–30.8 % |
| Coin slot share of prize spins | 36.7 % | 27.3 % | 37.3 % | 43.8 % | 24.6–49.1 % |
| Coins back per prize spin | 0.60 | 0.42 | 0.57 | 0.81 | 0.36–1.08 |
| Cards collected | 3.8 | 1 | 3 | 7 | 0–10 |

1.0.0, same harness: 373 shots, 2.4 minutes, ~634 tickets a minute *including*
the 60 tickets each card paid automatically. 1.1.0 lasts half again as long, at
~608 tickets a minute before cards (the ~3.8 cards add ~250 tickets or ~13 coins
when exchanged). logic.test.ts runs eight seeds and checks the means: 2.8–6
minutes, 300–750 shots, 480–800 tickets a minute, coin share 30–47%.

Perfect, paced play (fires only on the ready cue and only while a stock lamp is
free), every card exchanged for coins at once, 6 seeds: 296–885 shots over
10.9–32 minutes (mean 18), 0.69 coins back per prize spin, ~577 tickets a
minute, ~28 cards a run. Skill stretches the coins about 5×, not forever.
logic.test.ts runs two seeds of it and checks they idle with < 1 coin back a spin.

## Saves (save.ts)

`{ v, schema, state }`; `migrate` walks old schemas up one step at a time.

| Schema | Written by | `state` |
| --- | --- | --- |
| 1 | early 1.0.0 | the plain State, album as owned flags |
| 2 | 1.0.0 | bodies and flights packed into tuples, floats rounded, album as a bit mask |
| 3 | 1.1.0 | as 2 on the 11-slot wheel, with `cards` (a count per cat) and `seen` (bit mask) instead of the album |

2 → 3 (`toV3`): each owned cat becomes a count of 1 and is seen; a prize spin
running on the old 24-slot wheel is dropped, refunded into the stock (capped at
4) if it had not paid; coins on their way up land on LAND_X. Coins, lifetime
tickets, cores and the shelf carry over. save.test.ts migrates a live-shaped
1.0.0 save and checks all of it.

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
  in-game collectibles only (no trading, nothing to buy).
- Solo only (no online, no computer player).
