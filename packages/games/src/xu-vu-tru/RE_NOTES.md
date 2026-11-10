# Xu Vũ Trụ — notes

**Reference:** the coin-shooter + coin-pusher redemption cabinet genre (a big target
wheel you shoot tokens at for tickets; the tokens then fall onto a pusher shelf with
special pieces that trigger a bonus). This is an original take: robots and outer
space, six energy cores, a cat-card album, our own wheel, art and names. Nothing from any licensed
machine (no characters, logos, s## The machine

| Part | What it does |
| --- | --- |
| SHOOT | 1 coin up the chute; hold (or Auto) to fire every 0.24 s |
| Wheel | 24 slots, turning ~0.2 rev/s with a slow speed wobble (so a held button can't lock onto a slot). The slot at the 3 o'clock pointer when the coin arrives (0.42 s after the press) pays, and the shot coin never reaches the shelf itself |
| Ticket slot (2/3/5/10) | tickets straight to the counter; nothing drops |
| Coin slot (1/2/4/6/8) | that many coins rain onto the shelf, one per equal band of its width (seeded x inside each band) |
| Core slot | an energy capsule drops onto the shelf (nothing else) + a **Mini spin**: tickets 20/30/40/50 or coins 20/25/30/35 |
| Card slot | a cat card (one of 10, seeded pick) drops onto the shelf |
| Shelf | walls on both sides the whole way; only the front edge drops things: +1 coin and +1 ticket per coin |
| Core meter | 6 slots; only a capsule pushed off the **front** fills one. The sixth starts a **Super spin** (jumps the spin queue): 80/100/150/200/250/300/500 tickets, then the meter drops by 6 (a capsule that arrived mid-spin carries over) |
| Album | a card pushed off the **front** pays 60 tickets (duplicates too) and is marked owned. All 10 owned: +1000 tickets and the album starts over. The owned set is in `State.album`; game.ts copies it to storage key `album` after every card, so it outlives runs |
| End | coins at 0, nothing in the air or on the reels, and nothing has fallen for ~5.7 s. Score = total tickets |

`BETA_START_COINS = 200` in config.ts is a test value (the user asked for 200 in beta).

## Economy (config.ts)

The side walls run the whole shelf, so nothing is lost over the sides: every coin
on the shelf eventually leaves by the front. The machine's drain is the ticket
slots, which keep the shot coin.

Slot widths, in units of 1/41.5 of the turn (the coin meets the wheel at an
effectively uniform angle, so chance = width / 41.5):

| Slot | Count × width | Share of the wheel |
| --- | --- | --- |
| tickets 2 / 3 / 5 / 10 | 7 / 4 / 2 / 1 × 2 | 33.7% / 19.3% / 9.6% / 4.8% |
| coins 1 / 2 / 4 / 6 / 8 | 3 × 2 / 2 × 1.5 / 1 × 1 / 1 × 0.75 / 1 × 0.75 | 14.5% / 7.2% / 2.4% / 1.8% / 1.8% |
| core | 1 × 1.25 | 3.0% |
| card | 1 × 0.75 | 1.8% |

Spin weights:

| Spin | Prizes | Weights | Expected value |
| --- | --- | --- | --- |
| Mini | T20 / C20 / T30 / C25 / T40 / C30 / T50 / C35 | 30 / 8 / 22 / 5 / 12 / 3 / 6 / 1 | 23.4 tickets + 4.7 coins (coins 20% of the time) |
| Super | 80 / 100 / 150 / 200 / 250 / 300 / 500 | 26 / 26 / 20 / 13 / 8 / 5 / 2 | 148 tickets |

Per shot: 2.2 tickets from the wheel, 0.64 coins dropped, 0.03 Mini spins
(≈ 0.14 coins), 0.018 cards. With no side losses nearly all of that comes back,
so a shot returns ≈ 0.75–0.8 coins: **a net drain of roughly 0.2–0.25 coins a shot**.

Simulated (6 seeds, button held, a throwaway vitest over logic.ts, 2026-11-10):
a 200-coin run lasts ~720 shots on average (range ~430–1340, 2–6 min);
~3,500 tickets (range ~1,700–6,800); 1–7 Super spins, since every core now
reaches the front eventually.

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
