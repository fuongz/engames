# Xếp Tầng — notes

**Genre:** one-tap block stacking, popularised by Ketchapp's *Stack* (2016). We take only the
genre mechanic; the name, palette, sky, sounds, UI and wording are our own.

## Rules we use

| Rule | Choice |
| --- | --- |
| Slabs | start 1 × 1 on a pedestal; each new slab has the size of the one below |
| Motion | slides along x, then z, alternating; enters from a random end (seeded) and bounces between ±1.25 |
| Drop | one tap / Space; the overhang is sliced off and tumbles away |
| Miss | no overlap (or < 0.004) ends the run; the whole slab falls |
| Perfect | centre within 0.035 of the slab below snaps exactly; chime rises a pentatonic step per perfect in a row |
| Grow back | from the 3rd perfect in a row, each perfect adds 0.06 along its axis, never past the first slab's size |
| Speed | 1.5 units/s, +0.02 per floor, capped at 3 (≈ floor 75) |
| Score | slabs placed; leaderboard detail "12 tầng · 5 hoàn hảo" |

`logic.ts` is pure and deterministic for a seed; the game runs on `fixedStep: 1/60` so the
slide speed is the same on 60 Hz and 120 Hz screens.

## Look

"Khối màu tối giản": flat isometric slabs with three shaded faces, the hue turning 5° a floor.
The sky is our own day: dawn (rose/peach) → day (soft blue) → sunset (violet/apricot) → night
(indigo, twinkling stars), each held ~22 floors, then around again. The score ink switches
between plum and warm white with the sky's brightness. Landing: a short squash and screen
thump; a perfect adds a ripple of the top face's outline and sparks. At game over the camera
pulls back to show the whole tower above the result card.

## Art

Key art from Codex (minimal isometric tower at dusk, no text); raw PNGs in the git-ignored
`art-src/xep-tang/`. `cover.ts` bakes the localized title onto the poster. In-game text is
**Baloo 2** 600/800 (full Vietnamese, imported in `game.ts`).
