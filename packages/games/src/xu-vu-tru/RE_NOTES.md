# Xu Vũ Trụ — notes

**Reference:** the coin-shooter + coin-pusher redemption cabinet genre (a big target
wheel you shoot tokens at for tickets; the tokens then fall onto a pusher shelf with
special pieces that trigger a bonus). This is an original take: robots and outer
space, six energy cores, our own wheel, art and names. Nothing from any licensed
machine (no characters, logos, stones or names).

## The machine

| Part | What it does |
| --- | --- |
| SHOOT | 1 coin up the chute; hold to fire every 0.24 s |
| Wheel | 20 slots, turning ~0.2 rev/s with a slow speed wobble (so a held button can't lock onto a slot). The slot at the 3 o'clock pointer when the coin arrives (0.42 s after the press) pays: 2/3/6/12 tickets, **LÕI** (lights the next dark core) or **BONUS** (a Bonus Spin). LÕI and BONUS are half-width |
| Reels "BẠN THẮNG" | Bonus Spin: 10 / 30 / 65 / 100 tickets (weights 52/30/13/5); spins queue on the LƯỢT counter |
| Shelf | coins pushed over the front: +1 coin and +1 ticket each; over the open side gutters: lost |
| Energy cores | six capsules; pushing one off the front lights its core + a Bonus Spin. All six lit: SUPER BONUS 250 tickets + a 12-coin shower, then the cores go dark and missing capsules drop back in. A capsule lost to a gutter comes back while its core is dark |
| End | coins at 0, nothing in the air or on the reels, and nothing has fallen for ~5.7 s. Score = total tickets |

`BETA_START_COINS = 200` in config.ts is a test value (the user asked for 200 in beta).
With random play a run is ~450–600 shots (~3 min holding the button), 1–3 Super Bonuses
and 15–30 Bonus Spins.

## Physics (physics.ts)

Our own, no dependency: discs on a 2D shelf seen from above, fixed 1/60 steps,
Coulomb friction + light damping, a sweep-and-prune pair list, five passes of
mass-weighted position correction plus inelastic contact impulses, the pusher as a
moving wall that hands its speed to what it touches, side walls only along the back.
No randomness inside the step and a fixed order, so a run replays from its seed.
Depth is faked: a coin dropped onto a coin becomes a pile (`stack`, up to 3) worth
that many coins; past 170 bodies the oldest coin is folded into a neighbour's pile.
The renderer tilts the shelf into a 3/4 view and draws piles as offset discs.

## Changed from the genre

- No real money, tokens or prizes: tickets are only the score.
- Solo only (no online, no computer player).
