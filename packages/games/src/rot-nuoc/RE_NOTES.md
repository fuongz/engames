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

- **Levels** are generated from the level number (same level, same layout).
  Difficulty, retuned in Nov 2026 because the first curve was too easy:
  - 4 colours at level 1, one more every 3 levels, 12 from level 25;
  - from level 20, every even level has **one** empty tube instead of two.
    Random layouts with one spare are almost never solvable past 8 colours, so
    those levels use 7 colours (8 from level 40);
  - from level 15, every third level is a **"?" level**: each layer under the
    top shows as "?" until the layer above it is poured off. Restart covers
    them again;
  - several solvable layouts are drawn per level and the hardest kept: fewest
    same-colour neighbours, then the most work for the solver.
  Each layout is checked with a depth-first solver before it is used, so
  **every level can be solved without boosters**; a starting tube is never
  already complete. Generation stays under ~60 ms.
- **Boosters** are kept across levels (saved per device): 3 undos and 2 extra
  tubes to start (ad: "↶5", "+🧪2"); +1 undo every second cleared level
  (max 20); at most one extra tube per level; the gift fills over 5 levels and
  gives +3 undos and +1 tube. Restart is free.
- **Pours** take 0.5 s. Several can run at once as long as no tube is lifted
  twice, and a tube that is still filling can take a second pour.
- **Leaderboard**: the portal's save dialog appears every 5 levels (score =
  the level just cleared) instead of after each level; the card summary shows
  the last level cleared.
- **Cut**: the back/home button (the portal has one), coins, ads.
- **Extras**: number keys pick tubes, Z/R/T for undo/restart/tube; a hint on
  the first levels, a warning when no move is left, a sparkle when a tube is
  completed, confetti on a win.

## Open questions

- The real game's level layouts and difficulty curve, and what the gift box
  contains.
