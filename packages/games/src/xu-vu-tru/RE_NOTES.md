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
| Wheel | 24 slots, turning ~0.12 rev/s as decoration. It no longer pays by where it stands: a prize spin picks the slot (below). Every slot is drawn exactly as wide as its weight, so its share of the circle is its chance |
| Gate | A rail under the hub with a cup in it. The cup swings on a sine, ±GATE_AMP = 45 px, one swing per GATE_PERIOD = 1.45 s, the speed drifting ±10 % over 5.9 s so a held button can't lock onto it |
| Landing | The shot coin lands on the gate FLIGHT_UP = 0.42 s after the press, at a seeded spot within ±AIM_SPREAD = 33 px of the centre (the gold marks; it rattles out of the chute) |
| Hole | Coin centre within ±HOLE_HALF = 15 px of the cup's centre: swallowed, +1 prize spin in the stock. Otherwise it bounces off and falls onto the shelf as one coin at a seeded x |
| Prize spin | A weighted pick of a slot (seeded). A light chases round the slots for PRIZE_SPIN_TIME = 1.7 s, braking (cubic ease-out, one to two laps) onto the picked slot, which blinks for PRIZE_HOLD = 0.45 s; it pays when it stops |
| Stock | At most PRIZE_QUEUE_MAX = 4 prize spins wait (the lamps under the gate), plus the one running. A coin that drops in the hole while all four are lit is swallowed for nothing ("Spins full"), as with a pachinko stock |
| Ticket slot (5/10/20/30/50/100) | tickets straight to the counter |
| Coin slot (1/2/4/6/8) | that many coins rain onto the shelf, one per equal band of its width (seeded x inside each band) |
| Core slot | an energy capsule drops onto the shelf + a **Mini spin**: tickets 20/30/40/50 or coins 20/25/30/35 |
| Card slot | a cat card (one of 10, seeded pick) drops onto the shelf |
| Shelf | walls on both sides the whole way; only the front edge drops things: +1 coin and +1 ticket per coin |
| Core meter | 6 slots; only a capsule pushed off the **front** fills one. The sixth starts a **Super spin** (jumps the reel queue): 80/100/150/200/250/300/500 tickets, then the meter drops by 6 (a capsule that arrived mid-spin carries over) |
| Album | a card pushed off the **front** pays 60 tickets (duplicates too) and is marked owned. All 10 owned: +1000 tickets and the album starts over. The owned set is `State.album`, saved with the machine |
| Out of coins | coins at 0, nothing in the air, on the wheel, in the stock or on the reels, and nothing has fallen for ~5.7 s: the machine **idles** (`State.idle`, one `idle` event). It is not over: the shelf, cores, album and stock stay, and `grantCoins` (or a coin pushed off the shelf) wakes it where it stood |

## 1.0.0: one machine that never resets

- **Signed in** (`ctx.cloud`): the machine lives in cloud slot 0 (`accountSave`).
  A new account machine starts at **0 coins**; its coins come from the
  allowance (100 welcome, then 50 per Vietnam day, `manifest.allowance`) and
  coupons. Saves go up 4 s after a change, at once for a grant, on suspend and
  on dispose, with a local backup (`machine:<playerId>`) of anything unsent. On a
  conflict the server's newer copy wins, as in tiem-banh-may.
- **Tickets** go to the shared arcade wallet (`manifest.tickets`): logic counts
  `lifetimeTickets` and `unpaid`; the shell drains `unpaid` every step and
  deposits it. The save holds no wallet balance. The leaderboard ranks
  `lifetimeTickets` (`save.ts` `rules.score`): a `reportScore` when the machine
  idles, and at most one more filing a session (with the save, on suspend).
- **Guests**: a local trial machine with `TRIAL_COINS = 100`, trial tickets
  counted locally, no daily coins, no deposits, no reportScore. Signing in starts
  a fresh account machine: the trial is not imported.
- **Saves** are `{ v, schema, state }` (`save.ts`). Schema 1 was the plain State;
  schema 2 packs bodies and flights into tuples with rounded floats (a busy
  shelf is ~4 KB, against ~15 KB as plain State; the worst case the test builds
  stays under 16 KB of the server's 64 KB). `migrate` walks old schemas up step by step.
  The beta's run (storage key `run`, a bare State with `RULES_VERSION` 3) is
  discarded with a note; its album seeds a new trial machine.

### Why the stock cap swallows

With the button held, ~1 coin a second reaches the hole while a spin takes 2.15 s,
so spins pile up. If a hit beyond the cap bounced back to the shelf instead, held
play could only drain coins as fast as spins finish (~0.47 a second): a 200-coin run
would take ~1,600+ shots and 7+ minutes, outside the 600–1,000 target. Swallowing
keeps every hit a coin spent, and makes pacing shots to the lamps the skill.

## Difficulty (measured, logic.test.ts "gate difficulty")

The hole's position is A·sin(phase); a coin lands uniformly in ±33 px.

| Fire times | Hit rate |
| --- | --- |
| Random (each 1/60 step fires with p = 0.06) | 25.8 % (3,000 and 20,000 shots) |
| Button held / Auto | 25.9 % (20,000 shots): no lock-in, the spread over a run is plain binomial noise |
| Ideal: fire only when the hole will be centred under the band on arrival | 45.6 % (3,000 shots; theory HOLE_HALF / AIM_SPREAD = 45.5 %) |

The ideal player cannot beat ~45 %: where in the band the coin lands is random.
A human tapping on the swing will land somewhere between the two.

## Economy (config.ts)

Misses come back as a coin on the shelf and the side walls keep everything, so
the only drain is coins swallowed by the hole minus what prizes give back. At a
25 % hit rate that puts a floor of ~200 / 0.25 = 800 shots under 200 coins
(less a little: the shelf ends holding 15–45 more coins than it started with),
so coin prizes are kept small. The tuning is unchanged in 1.0.0; what changed is
that the shelf now carries over, so coins banked on it pay out in the next
session.

Slot weights (percent; widths on the wheel are the same numbers):

| Slot | Slots × weight | Share |
| --- | --- | --- |
| tickets 5 / 10 / 20 / 30 / 50 / 100 | 4 × 3.6 / 5 × 5.3 / 3 × 6 / 2 × 5.5 / 2 × 3.4 / 1 × 3.9 | 14.4 / 26.5 / 18 / 11 / 6.8 / 3.9 |
| coins 1 / 2 / 4 / 6 / 8 | 1 each × 1.5 / 1.2 / 1 / 0.9 / 0.8 | 5.4 |
| core | 1 × 8 | 8 |
| card | 1 × 6 | 6 |

Per prize spin: 17.6 tickets from ticket slots, 0.20 coins from coin slots, 0.08
Mini spins, 0.06 cards.

| Spin | Prizes | Weights | Expected value |
| --- | --- | --- | --- |
| Mini | T20 / C20 / T30 / C25 / T40 / C30 / T50 / C35 | 40 / 1 / 30 / 1 / 15 / 1 / 8 / 1 | 27.8 tickets + 1.1 coins (coins 4 % of the time) |
| Super | 80 / 100 / 150 / 200 / 250 / 300 / 500 | 26 / 26 / 20 / 13 / 8 / 5 / 2 | 148 tickets |

Mini coin weights went from 8/5/3/1 to 1/1/1/1: one Mini coin win (20–35 coins)
adds ~100 shots to a run, and was the main source of runs over 1,000 shots.

### Simulated sessions (bun over logic.ts, 2026-11-11)

200 coins on a new machine, button held until it idles, 33 seeds:

| | Mean | P10 | Median | P90 | Min–max |
| --- | --- | --- | --- | --- | --- |
| Shots | 808 | 620 | 808 | 1,032 | 579–1,287 |
| Minutes | 4.2 | 3.0 | 4.2 | 5.6 | 2.7–6.5 |
| Tickets | 3,186 | 2,310 | 3,101 | 4,026 | 1,944–5,357 |
| Gate hit rate | 26.1 % | 23.8 % | 26.3 % | 28.0 % | 22.3–31.2 % |
| Prize spins paid | 109 | 80 | 108 | 145 | 73–171 |
| Hits lost to a full stock | 101 | 85 | 97 | 123 | 79–168 |
| Super spins | 1.1 | 1 | 1 | 2 | 0–2 |
| Cards | 4.8 | 2 | 4 | 7 | 0–13 |

26 of 33 runs end inside 600–1,000 shots. The spread is mostly luck that no
tuning removes without gutters: a run's hit rate (±2 % over ~800 shots moves the
length ~±8 %), Mini coin wins, and how many coins the shelf keeps at the end.
The test runs four seeds (101/202/303/404: 744 / 970 / 828 / 840 shots, mean 845,
2,679–3,810 tickets) and checks the mean is inside 600–1,000.

Continuous play (1.0.0), button held, 8 seeds (11…88):

| | Shots | Minutes | Tickets |
| --- | --- | --- | --- |
| 100 coins on a new machine (the trial, or the welcome) | 240–534, mean 388 | 1.5–3.2, mean 2.4 | 920–2,411 |
| then a 50-coin daily on the same shelf | 139–355, mean 214 | 0.8–3.0, mean 1.6 | 776–2,515 |

The daily lasts ~4× its coins because the first session left the shelf full.
The test checks the four-seed trial mean (318 shots) inside 220–600.

A perfect, paced player (fires only for a centred hole and only while a stock
lamp is free), same four seeds: ~655 shots over ~11 minutes, ~7,250 tickets, 2–3
Super spins and 12–18 cards a run: about 2.3× the held button. Skill and patience
pay, which is the point of the gate.

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
