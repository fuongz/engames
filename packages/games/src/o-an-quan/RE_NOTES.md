# Ô Ăn Quan — notes

**Reference:** the traditional Vietnamese pit-and-pebble game (a mancala), with the
rules as written up on oanquan.online. Only the rules were used from it; the look,
the modes and the code are ours.

## Rules we use

| Rule | Choice |
| --- | --- |
| Board | 2 rows × 5 dân pits (5 dân each) between 2 half-oval quan pits (one quan each) |
| Points | dân 1, quan 10 (70 in all) |
| A move | take every dân from one of your pits, either way round, one per pit (quan pits too) |
| Next pit full (a dân pit) | take it and keep sowing |
| Next pit is a quan pit with anything in it | the turn ends |
| Next pit empty | capture the pit after it; repeat for each "empty, then full" pair; two empties end the turn |
| Quan pits | never picked up to sow from |
| Row empty on your turn | put 5 captured dân back, one per pit; short → **borrow** from the opponent (repaid at the end: debtor −n, lender +n) |
| Neither side can refill | the game ends and is counted as it stands |
| End | both quan pits empty → each side keeps the dân in its own row; most points wins; equal is a draw |
| Young quan (optional) | "cấm ăn quan non": a quan pit can only be captured once it holds ≥ 5 dân |
| Guards | a sowing that relays 60 times is stopped; a game is counted at 300 moves (neither is reached in play) |

Not used from the reference: its "lật bàn" side swap, its 3-player triangular board,
repetition endings and time banks.

## Modes

- **Against the computer** (`ai.ts`): Easy / Normal / Hard — negamax with alpha-beta
  over whole moves, 1 / 3 / 6 plies; Easy also plays a random move 45% of the time.
  Evaluation: points held + 0.35 per dân in your row (they come home at the end).
  Hard beats Easy ≥ 75% of games (`logic.test.ts`).
- **2 players, 1 phone**: hot-seat, the top player plays the top row.
- **Online 1-on-1** (`online.ts`, mode `versus`): best of 1, 3 or 5 (lobby setting
  `bestOf`, default 1) and the young-quan rule (`quanNon`: `allow`/`forbid`). 30 s a
  turn **plus** the time the last move takes to play out on screen (`stepsTime`), so
  a long relay doesn't eat the next player's clock. A timed-out turn is played by the
  Normal computer; 3 timeouts in a row, or 30 s disconnected, forfeits. Each client
  sees its own row at the bottom (seat 1's view is turned half round).

## Input

Tap one of your pits (it gets a dashed ring and two arrows appear by it), then tap
an arrow to sow that way on screen. A sideways swipe on your pit sows at once.
Desktop: 1–5 pick a pit, ←/→ sow, T theme, Esc menu.

## Playing a move out

`play()` returns the move as steps (`take`, `drop`, `capture`, `stop`, `refill`,
`sweep`, `end`). `game.ts` plays them back on a copy of the board (`shown`), stone by
stone, with the stones in hand floating over the pit, captures flying to the
player's card, and a click per stone. The rules state is already final; `shown`
catches up and is re-synced whenever nothing is playing. Online moves arrive as the
same steps in the room's `move` events.

## Scores

- Solo (only wins against the computer): 100 / 400 / 1200 by level, plus 2 / 6 / 15
  per point of winning margin.
- Online board `o-an-quan:versus`: match winner 1000 + 4 per point scored over the
  match; the loser 250 per game won.

## Art

Three themes, picked in the menu or cycled with the Theme button (saved per device):
**Sân gạch** (chalk on a brick courtyard — the approved sample A), **Sơn mài** (red
lacquer tray, amber stones, jade quan) and **Đông Hồ** (folk woodblock print on rice
paper). Each has a Codex backdrop (`img/bg-*.webp`) and a stone sheet
(`img/stones-*.webp`: six pebbles + two quan stones); the board itself is drawn in
`art.ts` so pits match the rules exactly. Raw PNGs and prompts are in the git-ignored
`art-src/o-an-quan/`; `tools/o-an-quan-sprites.py` keys and packs them. Text is
Baloo 2 (600/800).
