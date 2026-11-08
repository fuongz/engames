# Cờ Vua / Chess — notes

**Reference:** the FIDE Laws of Chess. No UI to follow; the look is our own (a warm
walnut-and-maple study, matching the Codex key art).

## Rules we use

| Rule | Choice |
| --- | --- |
| Moves | full FIDE: castling both sides (rights, empty squares, king never in/through/into check), en passant (only right after the double step, never exposing the king), promotion to Q/R/B/N |
| End | checkmate; stalemate draws |
| Draws | **automatic** on threefold repetition, the fifty-move rule (100 plies) and insufficient material (K v K, K + minor v K, bishops all on one square colour). FIDE makes the first two a claim; a casual phone game ends them for you. Checkmate on the 100th ply still wins |
| Repetition | position key = pieces + side to move + castling rights + the en passant square only when a capture there is legal (FIDE's definition), hashed to a 53-bit number |

Move generation is checked with perft (`logic.test.ts`): start position to depth 4
(197 281), Kiwipete to depth 3 (97 862), and three more standard positions.

## Modes

- **Against the computer** (`ai.ts`): pick White, Black or random in the menu, then
  Easy / Normal / Hard. Negamax alpha-beta + quiescence, iterative deepening, PVS, a
  65k-entry transposition table (two 32-bit Zobrist keys), ordering by hash move,
  MVV-LVA, killers and history; material + Michniewski piece-square tables with a
  tapered king. Repetitions in the search score 0. Easy: 1 ply + captures, ±170 cp
  noise and a random move 12% of the time. Normal: 3 plies, ±30 cp. Hard: deepens
  until 300 ms (node cap 400k), a little noise only in the first 10 plies. Tests check
  Hard stays under 400 ms and the levels rank Normal > Easy, Hard > Normal.
  3 take-backs a game (your move + its reply).
- **2 players, 1 phone**: hot-seat, the board stays White-at-bottom (Flip button),
  unlimited take-backs, session tally.
- **Online 1-on-1** (`online.ts`, mode `versus`, no lobby settings): seat 0 plays White.
  **No clock** (the user's choice). Actions: move {from,to,promo?}, resign (tap twice),
  offer draw (once per 2 plies; moving declines the other side's offer), accept,
  decline. A player away (`setAutopilot`) for 60 s forfeits. Snapshots drop the packed
  moves and repetition keys (they stay on the server), so they are ~1 KB.

## Input

Tap a piece → its legal squares get dots (captures get rings); tap one to move, or
drag the piece there. Tap the chosen piece again to put it down. Last move tinted,
king in check glows red. A promotion opens a Q/R/B/N picker over the board (tap
anywhere else to cancel). Desktop: [U] undo, [F] flip, [Esc] menu.

## Scores

- Solo (wins against the computer only): 100 / 400 / 1200 by level, plus 1 / 4 / 12 per
  move under 60 of your own moves.
- Online board `co-vua:versus`: a win 1000, plus 10 per move under 60 for a checkmate.
  Draws and losses score 0.

## Art

Key art from Codex ("warm study at golden hour", carved ivory and walnut pieces); raw
PNGs in the git-ignored `art-src/co-vua/`. In-game pieces are vector paths in `art.ts`
(cached per pixel size), readable at ~45 CSS px a square. In-game text is **Mali**
(600/700); the title is **Baloo 2** 800. The move list uses Vietnamese piece letters in
Vietnamese (V H X T M) and English ones in English.
