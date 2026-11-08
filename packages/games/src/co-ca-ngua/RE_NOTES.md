# Cờ Cá Ngựa (Ludo) — notes

**Reference:** Ludo as Vietnamese families play it, *cờ cá ngựa* (horse tokens):
the international board with **two dice**, each spent separately. No app's UI was followed; the board, tokens
and die are our own.

## Rules we use

| Rule | Choice |
| --- | --- |
| Board | 15 × 15 cross: a 52-square loop, a 5-square home column per colour, home triangle in the middle |
| Seats | 2, 3 or 4 colours (2 sit opposite); turn order clockwise; who starts is drawn at random |
| Dice | two per roll, spent one at a time in the player's order: pick a die, then a horse to move by it; then the other die (same horse or another). One horse by both dice = two separate steps, and an intermediate landing captures as usual |
| Leaving base | only by spending a die that shows 6, onto the colour's own start square (the other die can then move it or another horse) |
| Using the roll | "use as much as you can", kept simple: while both dice are unspent, a first move that would make the other die unplayable is refused if some first move keeps both playable. There is no "play the larger die" rule. A die that can't be played is lost; if neither can, the turn passes |
| Doubles | another roll (even when they couldn't be played); three doubles in a row lose the turn, the third roll isn't played. A 6 alone no longer rolls again |
| Capture | landing on any opponent token(s) sends them back to base — except on the 8 safe squares (the 4 start squares and the 4 stars) |
| Stacks | no blockades: tokens share squares freely |
| Home | exact roll only; no legal move means the turn passes |
| End | first to bring all 4 home is 1st; the rest play on for 2nd/3rd. The game stops when one colour is left, or when every person at the table has finished (the computer doesn't play on alone — remaining computers are ranked by progress) |

A `Match` (logic.ts) is paced in seconds — dice tumble 0.6 s, 0.15 s a hop, the
computer's 0.4 s pauses — so the phone and the realtime room run the very same
state machine; the client only draws it from its phase clock. Each die is its own
decision (phase "move", then "moving", then "move" again for the other die). A
person's only sensible move (one die value, one square) plays itself. The
snapshot carries `dice`, `used` (spent or lost) and the legal `moves` (die, horse).

## Input

After the roll, the first playable die is pre-selected (lifted, outlined); tap the
other die to switch, then tap a glowing horse. Tapping a horse only the other die
can move spends that one. Spent dice dim; a die that can't be played is greyed and
then lost. Online actions: `{type:"roll"}` and `{type:"move", die: 0|1, token}`.

## Modes

- **Offline** (menu): table size 2–4, how many people on this phone (1–4, the rest
  are the computer on Easy / Normal / Hard). One person = "you vs the computer"; more
  = hot-seat, with each person's colour named on the status line. The game is saved
  each turn and resumes on reopen. No undo (dice).
- **Online** (`online.ts`, mode `versus`, `bots: true`): the host picks the table
  size (`players` setting, 2/3/4, default 4); people take seats (friends opposite),
  the computer (Normal) fills the rest. 20 s per decision (roll, then move); when it
  runs out the room rolls/spends a die for you with the Normal computer. Three timeouts in a
  row and the computer keeps playing your seat until you tap again; a dropped player
  (`setAutopilot`) is played by the computer until they return. Each client sees the
  board turned so its own colour is bottom-left.

## Computer (`ai.ts`)

- **Easy**: a random legal move.
- **Normal**: rule of thumb — capture > leave base > reach safety / home column >
  progress, minus the danger of stopping 1–6 squares in front of an opponent.
- **Hard**: the same priorities with exact dice odds (a 6 and again counts), the
  value of each token by how far it has come, hunting the leader, and tokens it can
  reach next turn; with both dice unspent it plans the pair (first move + the best
  second move on the board it leaves). A one-ply expectimax over opponents' replies
  and a pure board evaluation were tried (one-die version) and were weaker.
- Seeded 1-on-1 (600 games, two dice): Hard beats Easy ~93%, Normal beats Easy ~86%,
  Hard beats Normal ~68%. At a table of 4 vs three Normals, Hard is 1st ~35% (25% =
  luck). `logic.test.ts` keeps Hard and Normal > 75% vs Easy. A decision takes well
  under 1 ms.

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
  (shield on start squares, gold star on the stars), and each colour's corner a
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
