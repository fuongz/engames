# Cờ Cá Ngựa (Ludo) — notes

**Reference:** Ludo as Vietnamese families play it, *cờ cá ngựa* (horse tokens):
the international board with **two dice added up**. Rules changed 2026-11-08 to the
Vietnamese two-dice variant after checking FPT Shop, Hoàng Hà Mobile and vi.wikipedia
"Cờ cá ngựa" (bonus rolls, total on one horse, no jumping, no safe squares). No app's
UI was followed; the board, tokens and die are our own.

## Rules we use

| Rule | Choice |
| --- | --- |
| Board | 15 × 15 cross: a 52-square loop, a 5-square home column per colour, home triangle in the middle |
| Seats | 2, 3 or 4 colours (2 sit opposite); turn order clockwise; who starts is drawn at random |
| Dice | two per roll, **added up and moved by one horse** — never split between two |
| Bonus roll | doubles (1-1 … 6-6) or 1-6. It brings a horse out of base onto its start square (or another horse walks the total instead), and earns another roll — even when it couldn't be played. Three in a row lose the turn; the third isn't played. A 6 alone does nothing special |
| No jumping | a horse can't pass any horse, its own or a rival's: a roll bigger than the gap to the horse in front is not a move for it. One horse to a square (its own start square too: a horse can't come out while one of its own stands there) |
| Capture | stopping exactly on a rival sends it back to base, on any loop square — **no safe squares** (the start square included). Only the home column is safe |
| Home | the total **or more** reaches home (two dice never make 1, so "exact" would strand a horse one square short); the home column's squares still block like any other. No legal move means the turn passes |
| End | first to bring all 4 home is 1st; the rest play on for 2nd/3rd. The game stops when one colour is left, or when every person at the table has finished (the computer doesn't play on alone — remaining computers are ranked by progress) |

A `Match` (logic.ts) is paced in seconds — dice tumble 0.6 s, 0.15 s a hop, the
computer's 0.4 s pauses — so the phone and the realtime room run the very same
state machine; the client only draws it from its phase clock. A roll is one
decision (phase "move": which horse, then "moving"). A person's only sensible
move (one square to go to) plays itself. The snapshot carries `dice`, `bonus`
(bonus rolls in a row) and the legal `moves` (horses). A game saved under the old
rules (with `used`/per-die moves) is dropped on load rather than resumed.

## Input

After the roll the horses that can move glow (arrow above, dashed ring where they
land); tap one. The status line says "move N", "bring one out" or both. The dice dim
while the horse hops. Online actions: `{type:"roll"}` and `{type:"move", token}` (an
old client's `die` is ignored).

## Modes

- **Offline** (menu): table size 2–4, how many people on this phone (1–4, the rest
  are the computer on Easy / Normal / Hard). One person = "you vs the computer"; more
  = hot-seat, with each person's colour named on the status line. The game is saved
  each turn and resumes on reopen. No undo (dice).
- **Online** (`online.ts`, mode `versus`, `bots: true`): the host picks the table
  size (`players` setting, 2/3/4, default 4); people take seats (friends opposite),
  the computer (Normal) fills the rest. 20 s per decision (roll, then move); when it
  runs out the room rolls/moves for you with the Normal computer. Three timeouts in a
  row and the computer keeps playing your seat until you tap again; a dropped player
  (`setAutopilot`) is played by the computer until they return. Each client sees the
  board turned so its own colour is bottom-left.

## Computer (`ai.ts`)

- **Easy**: a random legal move.
- **Normal**: rule of thumb — capture > leave base > reach the home column >
  progress, minus the danger of stopping where a rival can hit it next roll (exact
  two-dice odds, blocked paths and rivals coming out onto their start square included).
- **Hard**: one number for the board a move leaves — each horse out is worth
  100 + its progress, less the chance it is hit next turn × that worth; its own
  standing minus the rivals' average. Captures, bringing horses out and risky stops
  all fall out of it. A one-ply look at the next rival's 21 possible rolls and replies
  was tried and was no stronger (~75% vs Easy either way).
- Seeded 1-on-1 (1000 games): Hard beats Easy ~76%, Normal beats Easy ~70%, Hard
  beats Normal ~55%. At a table of 4 vs three Normals, Hard is 1st ~28% (25% = luck).
  The old split-dice rules gave Hard ~93% vs Easy: with one decision a roll, luck
  weighs far more. `logic.test.ts` keeps Hard > 65% and Normal > 62% vs Easy (120
  seeded games). A decision takes well under 1 ms.

## Scores

- Solo (one person, finishing 1st vs the computer): 100 / 300 / 800 by level × 1 /
  1.5 / 2 for 2 / 3 / 4 seats. Detail e.g. "Về nhất · máy Khó · 4 người".
- Online board `co-ca-ngua:versus`, per human seat: 1st 400 / 600 / 800 (2 / 3 / 4
  seats), 2nd at a table of 3 / 4 gets 150 / 250, others 0. `outcome`: 1st = win,
  everyone else loss. Detail "Về nhất · 4 người".

## Art

- **Key art** (poster + banner, regenerated 2026-11-08 to show two dice) and the
  four **horse tokens** (`img/tokens.webp`, keyed by `art-src/co-ca-ngua/tokens.sh`)
  from Codex.
- **In-game look** (2026-11-08, after a reference screenshot the user liked; the
  organisation is borrowed, all content is original and Vietnam-themed): a deep-blue
  backdrop with faint line doodles (conical hats, lanterns, lotus, boats, stars,
  drawn in code), a raised lavender tray, crisp track squares drawn in `art.ts`
  (start squares in the colour, no marks: there are no safe squares since the
  2026-11-08 rules change), and each colour's corner a
  little scene around a clean stable inset — red Hội An (shophouse, lanterns, áo
  dài stall), green rice terraces (stilt house, buffalo, bamboo), yellow a pagoda by
  the lotus pond, blue the bay (junk boat, palm, xích lô). Props are 18 Codex
  sprites keyed off magenta into `img/props.webp` (6 × 3 cells of 150 px); round
  portraits (`img/avatars.webp`, 8 × 128 px: one person per colour, plus four faces
  for the computer) sit at the four corners. Both atlases are rebuilt by
  `art-src/co-ca-ngua/scene.sh`; prompts (`props1.txt`, `props2.txt`,
  `avatars.txt`) and raw PNGs are there too. In-game images total ≈ 215 KB.
- The board, dice, roll button, round buttons and panels are drawn in `art.ts`.
  All text is **Baloo 2** 600/800 (full Vietnamese, imported in `game.ts`).
