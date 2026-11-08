# Caro — notes

**Reference:** the rules page at learnplaywin.net/caro (no UI to follow), plus the
pen-and-paper game everyone in Vietnam plays on squared exercise-book paper.

## Rules we use

| Rule | Choice |
| --- | --- |
| Board | 19 × 19 squares (marks go in squares, like on paper) |
| Win | 5 or more in a row, any direction |
| "Chặn hai đầu" | a row capped by the opponent at **both** ends doesn't count; the board edge never blocks |
| Overline | allowed (6+ wins) |
| Opening | X first; rematches swap who opens |

## Modes

- **Against the computer** (`ai.ts`): Easy / Normal / Hard. It scores every run of five
  squares by how many marks one side holds in it. Easy is noisy and half-hearted at
  defending; Normal takes the best square; Hard runs a 4-ply alpha-beta search over the
  best ~10 squares (well under 400 ms on a laptop, see `logic.test.ts`). 3 take-backs a game.
- **2 players, 1 phone**: hot-seat, unlimited take-backs, session tally.
- **Online 1-on-1** (`online.ts`, mode `versus`): best of 3, 30 s turns. A timed-out
  turn is played for you by the Normal computer; 3 timeouts in a row, or 30 s
  disconnected, forfeits the match.

## Input

Tap a square to pick it (dashed pencil box + faint mark), tap again to play: a
19 × 19 board leaves ~20 CSS px per square on a 390 px phone, so a single tap would
misfire. Pinch or the magnifier button zooms (×2, up to ×2.6); one finger pans when
zoomed. A move that lands off-screen while zoomed glides the camera to it.

## Scores

- Solo (only wins against the computer): 100 / 400 / 1200 by level, plus a bonus per
  move under 40 of your own moves.
- Online board `caro:versus`: match winner 1000 + 5 per move under 80; the loser 250
  per game won.

## Art

Key art from Codex (style A "school notebook", approved 2026-11-08); raw PNGs in the
git-ignored `art-src/caro/`. The board, marks and buttons are drawn in `art.ts`.
