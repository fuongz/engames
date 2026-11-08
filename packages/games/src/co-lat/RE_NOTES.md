# Cờ Lật (Reversi) — notes

**Reference:** the standard international Othello/Reversi rules. "Othello" is a
trademark, so the game is called Reversi / Cờ Lật and uses none of its branding.

## Rules we use

| Rule | Choice |
| --- | --- |
| Board | 8 × 8 |
| Opening | d4 and e5 White, d5 and e4 Black; Black moves first |
| A move | must outflank: brackets a line of the opponent's discs between the new disc and one of yours, in any of 8 directions; every bracketed line flips |
| No legal move | that player passes (automatically, with a banner) |
| End | neither player can move (board full or not) |
| Winner | most discs; equal counts are a draw. Empty squares are not awarded |

## Modes

- **Against the computer** (`ai.ts`): pick Black or White, then Easy / Normal / Hard.
  Easy plays a random move 30% of the time, otherwise the square-weight table plus a lot
  of noise. Normal is a 3-ply alpha-beta search on the full evaluation (square weights
  with the corner-neighbour penalty lifted once the corner is taken, mobility, edge
  stability anchored on corners, frontier discs, disc count late on). Hard is iterative
  deepening with the previous best move first under a 50k-node budget, and a perfect
  endgame solve from 14 empty squares (fastest-first ordering) when it fits a 400k-node
  budget. Budgets count nodes, not time, so a move is the same on every machine and in
  the realtime room. Measured ≈ 80–200 ms a move on a laptop (`logic.test.ts` checks
  < 400 ms). 3 take-backs a game.
- **2 players, 1 phone**: hot-seat, unlimited take-backs, session tally.
- **Online 1-on-1** (`online.ts`, mode `versus`): best of 1, 3 or 5 (the host's lobby
  setting `bestOf`, default 3; up to N+2 games when draws repeat). Seat 0 plays Black in
  odd games, colours swap every game. 30 s turns; a timed-out turn is played by the
  Normal computer; 3 timeouts in a row, or 30 s disconnected, forfeits the match.

## Input

One tap on a dotted square plays it: the squares are ~43 CSS px on a 390 px phone, so
no pick-then-confirm is needed (unlike Caro). Hints (dots on legal squares) can be
turned off with the Hints button ([H] on a keyboard). [U] undo, [Esc] menu.

## Animation

The new disc drops in, then each flipped disc turns over in 3D (lifts, narrows to its
edge showing the other face, lands) in a ripple outward from the move,
`FLIP_STAGGER` apart. Counts on the cards follow the discs as they turn. The computer
waits for the discs to settle (and for a pass banner to be read).

## Scores

- Solo (only wins against the computer): 100 / 400 / 1200 by level, plus 2 / 6 / 15
  per disc of winning margin.
- Online board `co-lat:versus`: match winner 1000 + 5 per disc of margin summed over
  the games they won; the loser 250 per game won.

## Art

Key art from Codex (felt board in a walnut frame, a disc mid-flip, lamp-lit table);
raw PNGs in the git-ignored `art-src/co-lat/`. The board, discs and buttons are drawn
in `art.ts`. All text is **Baloo 2** (600/700/800, full Vietnamese, imported in
`game.ts`).
