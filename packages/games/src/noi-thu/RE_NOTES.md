# Nối Thú / Critter Connect: design notes

No recording or binary: the game is an original take on the **Onet** connect-tile
genre (a descendant of Shisen-Sho), known in Vietnam as "Pikachu cổ điển" after
an old PC/Flash version. Only the rules of the genre are borrowed. Every
creature is our own design (see Art); nothing from any franchise is used.

## Genre conventions we keep

| Convention | Our version |
| --- | --- |
| Tap two identical tiles; they go if a line with **at most two bends** joins them through empty cells | `findPath` in `logic.ts`: straight, one corner, or two corners; fewer bends win over a shorter route |
| The line may run **outside the board**, one cell beyond the edge | The board is stored with a one-cell empty ring (`(cols + 2) × (rows + 2)`); the ring is drawn `RING` px outside the tiles |
| A bright line flashes between the pair before they vanish | Lime line with a dark outline and a glow, `LINE_TIME` 0.32 s, while the two tiles pop |
| Shrinking time bar, rainbow-coloured | One bar per level; 300 s at level 1, 4 s less each level, floor 150 s |
| Tiles **shift after every pair**, a new way each level, cycling | 1 still, 2 down, 3 up, 4 left, 5 right, 6 top/bottom halves split, 7 left/right halves split; then the cycle repeats with less time |
| No pair left → the board reshuffles | Automatic and free, with a toast; the shuffle repeats until a pair is open |
| Hint and shuffle helpers | Hint (shows a pair), shuffle, and a **freeze** that stops the clock for 10 s |

## Our design decisions

- **Board** 8 × 12 = 96 tiles in a 540 × 960 portrait stage (bleed on), tiles
  56 × 60 px, so it reads at 390 × 844 with the HUD above and the booster bar
  below. Everything you can tap stays inside the logical 960 px height, clear
  of the home indicator.
- **Kinds** grow with the level: 12 at level 1, +4 a level, all 36 from level
  7. Pairs are dealt round-robin over the level's kinds, so every kind appears
  an even number of times (8 each at level 1; 2 or 4 each with all 36).
- **Split gravity** alternates each cycle: levels 6–7 split *outward* (each
  half to its own edge), levels 13–14 pull the halves *toward the centre*,
  20–21 outward again, and so on.
- **Generation** is deterministic from (level, seed) with the `mulberry32`
  generator; a new run draws a random seed. The shuffle's PRNG state lives in
  the run, so a saved run is one plain JSON object. Every generated board has
  an open pair, and a simulation in `logic.test.ts` clears levels 1–7, 13 and
  14 by always taking an open pair.
- **Wrong taps**: a different animal moves the selection to it (classic) with
  a small shake; the same animal with no legal line shakes both and says why.
- **Score**: 10 per pair, +5 per combo step (a match within 3 s of the last,
  up to +50); clearing the board pays 3 per second left on the clock.
- **Boosters** carry over between levels: 3 hints, 2 shuffles, 2 freezes to
  start; +1 hint each cleared level, +1 shuffle and +1 freeze every third
  level; cap 9. A freeze can't stack.
- **Saving**: the whole run (board, clock, score, boosters) is saved per
  device after every action and every 5 s, so a reload resumes mid-level.
  Time running out ends the run: it is reported to the leaderboard once
  (`score`, detail "Level N"), the save is cleared and the best score kept for
  the game card. Quitting never reports.
- **Keys**: H hint, S shuffle, F freeze, Esc drops the selection,
  Enter/Space on the win and game-over screens.
- **Cut**: the pause button from the sample mock-up (the portal has its own
  menu), lives, obstacle stages.

## Art

`art-src/noi-thu/` (not in the repo) holds the sources. `sheet-a.png` is the
approved sample sheet (red panda, axolotl, capybara, hedgehog, otter, leaf
bunny, fox, penguin, frog, owl, hamster, turtle). `sheet-b.png` (panda, koala,
lion cub, elephant, giraffe, sheep, black kitten, tiger cub, monkey,
stegosaurus, unicorn foal, bat) and `sheet-c.png` (duckling, flamingo, toucan,
peacock, whale, octopus, crab, jellyfish, bee, snail, butterfly, seal pup) were
generated with the Codex CLI using sheet A as the style reference, as were
`poster.png` and `banner.png`. `gen-all.sh` re-runs all four prompts.

`python3 tools/noi-thu-sprites.py` finds each tile as a blob, clears its white
corners, resizes it to 96 × 104 and packs the 36 into `img/tiles.webp` (kind =
atlas index, sheet order); it also crops the key art to `img/poster-art.webp`
and `img/banner-art.webp`. Then `bun run art` renders the posters, banner and
share image from `cover.ts`.

## Open questions

- The time and kind curves are first guesses: play-test whether 300 s for 48
  pairs at level 1 is too generous and whether 36 kinds by level 7 is too steep.
