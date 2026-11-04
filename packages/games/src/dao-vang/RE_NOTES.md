# Đào Vàng — notes

A claw-and-winch mining arcade game in the long-running "gold miner" genre. No
code, art, names or numbers come from any particular game: the characters (a
Vietnamese girl miner in a nón lá, goggled moles) and all art are original,
generated for Engames and processed by `tools/dao-vang-sprites.py`.

## Genre conventions we kept

- A miner at the top of the screen; a claw on a rope swings like a pendulum
  below her. One input fires it.
- The claw travels in a straight line at a constant speed, grabs the first
  object it touches and reels it back. Reel speed depends on the object's
  weight: big gold and big rocks crawl, diamonds zip.
- Missing everything: the claw comes back empty from the edge of the screen.
- Objects: gold in three sizes, rocks in two (nearly worthless and heavy),
  diamonds, a mystery "?" sack, and moles that walk across the board — some
  carrying a diamond.
- A timed level with a money goal. Money carries over, and the goal is a
  running total, so it rises every level. Miss it at time-up and the run ends.
- A shop between levels with a handful of random offers at varying prices:
  dynamite (blow up what you are reeling), strength (reel faster), a lucky
  item (better sacks), a diamond upgrade and a rock upgrade. Spending lowers
  the bank, so buying is a real trade-off.

## Our decisions

- **Portrait 540×960**, mobile first; the swing is about ±70° from straight down
  so the whole board is reachable from the centre.
- **Numbers** (`config.ts`): gold 50 / 150 / 500, diamond 600, rocks 15 / 35,
  mole 2, mole with diamond 602. Reel speed = 660 / weight px/s (capped at the
  empty speed 720); strength ×1.6. Polish ×1.5 diamonds, rock book ×3 rocks.
- **Goal**: the level's step is 550 + 120 per level; the bank must hold the sum
  of all steps so far. Boards are generated with at least 2.1× the step in
  gold and diamonds, so every level is winnable with room for misses.
- **Board generation** is deterministic from a run seed and the level number
  (`mulberry32`). Deeper levels shift gold further down, add rocks and moles,
  and swap cheap nuggets for diamonds. `logic.test.ts` plays levels 1–8 with a
  simple greedy bot: ≥85 % clears on levels 1–3, ≥50 % up to 8, starting with
  no spare money.
- **Mystery sacks** roll on landing: 60 % money (20–300), 20 % a stick of
  dynamite, 20 % strength for the rest of the level. With the clover: 70 %
  money (200–800), 15 % / 15 %.
- **Shop**: 3–4 of the five items, each priced at base + per-level, ±40 %.
  Dynamite works immediately (stock), the other four last for the next level
  only. The shop can be skipped.
- **Time-up ends the level immediately**, even mid-reel (what is on the hook is
  lost). An empty board also ends the level early.
- **Small gold is drawn bigger** than the genre usually does (hit radius 21,
  drawn ≈52 px) so it reads on a phone — a note from the art review.
- **Score**: at game over the bank is reported once (`reportScore`), with the
  level reached as the detail. Quitting reports nothing. The portal card shows
  the best bank and deepest level cleared.
- **Fixed step** 1/60 s, so swing timing is the same at 60 Hz and 120 Hz.
