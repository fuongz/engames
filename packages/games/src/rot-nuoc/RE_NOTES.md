# Rót Nước Màu / Water Sort: reverse-engineering notes

Source: an 18.6 s iOS screen recording (1170×2532, 60 fps) of a **Water Sort
Puzzle** ad: a title screen ("Water Sort Puzzle", "Level 58"), then the level
being played. It was analysed frame by frame with ffmpeg: a 2 fps contact
sheet and full-res stills of the board and a pour. No binary or ad HTML was
available, so REA had nothing to open; everything comes from the video.

## Observed in the recording

| Area       | What the ad shows                                                                                                                                                                                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Board      | Level 58: 11 glass tubes, 6 on top and 5 below, 4 layers each; 9 colours (purple, indigo, olive, grey, red, pink, sky, green, orange) and 2 empty tubes.                                                                                                                         |
| Background | Charcoal with faint hand-drawn doodles (suns, hearts, umbrellas, waves).                                                                                                                                                                                                         |
| HUD        | Glossy yellow buttons: back and restart on the left; "↶ 5" (undo, 5 left) and "+🧪 2" (add a tube, 2 left) on the right. A big white "LEVEL 58" and a gift box with a "Claim" tag.                                                                                               |
| Pour       | The tapped tube lifts, flies over the target, tilts far over (about 60–70°) and a thin stream of its top colour falls into the target, whose level rises; the tube flies back. Liquid surfaces stay level while the tube tilts. The whole matching top block moves when it fits. |
| Rule       | Liquid only lands on the same colour or in an empty tube.                                                                                                                                                                                                                        |

## Our design decisions (not in the ad)

- **Levels** are generated from the level number (same level, same layout):
  3 colours at level 1, one more every 4 levels, 9 by level 25 (the ad's board
  has 9), 12 at most; always 2 empty tubes. Each layout is checked with a
  depth-first solver before it is used, so **every level can be solved without
  boosters**; a starting tube is never already complete.
- **Boosters** are kept across levels (saved per device): 5 undos and 2 extra
  tubes to start (ad: "↶5", "+🧪2"); +1 undo per cleared level (max 20); at
  most one extra tube per level; the gift fills over 5 levels and gives
  +3 undos and +1 tube. Restart is free.
- **Leaderboard**: the portal's save dialog appears every 5 levels (score =
  the level just cleared) instead of after each level; the card summary shows
  the last level cleared.
- **Cut**: the back/home button (the portal has one), coins, ads.
- **Extras**: number keys pick tubes, Z/R/T for undo/restart/tube; a hint on
  the first levels, a warning when no move is left, a sparkle when a tube is
  completed, confetti on a win. Several pours can animate at once as long as
  they don't share a tube.

## Open questions

- The real game's level layouts and difficulty curve, and what the gift box
  contains.
