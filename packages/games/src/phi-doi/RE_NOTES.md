# Phi Đội 1945: reverse-engineering notes

Source: a 34 s iOS screen recording (1170×2532, 120 fps) of a TikTok ad for
**1945 Air Force: Airplane Shooter** ("1945 Arcade Airplane Shooter · Epic Air
Attack in Space Games" on the App Store card). It was analysed frame by frame
with ffmpeg: a 1 fps contact sheet, full-res crops of the HUD, sprites and the
boss, and a 4 fps strip of the boss fight. No binary or ad HTML was available,
so REA had no artifact to open; everything below comes from the video.

## Observed in the recording

| Area         | What the video shows                                                                                                                                                                                                                |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout       | Portrait vertical scroller over a saturated blue sea. Rocky islands with sand rims, surf and palm trees hug the left or right edge; one has a pipeline on stilts ending in a platform.                                              |
| Intro        | "Your mission: survive the air battle" card at the top for the first ~3 s.                                                                                                                                                          |
| Player       | Yellow-winged fighter with a navy fuselage and blue/white star roundels, two smaller grey wingmen beside and slightly behind it, and a small gun drone trailing below.                                                              |
| Firing       | Automatic. The lead plane fires four to five yellow flames fading to magenta, fanning slightly; the wingmen fire green capsules straight up.                                                                                        |
| Enemies      | Green fighters with red roundels and a red spine (small red HP bar under them), flying in formations and turning across the screen; a helicopter over an island; dark grey gunboats with turrets; turrets on the pipeline platform. |
| Enemy fire   | Glowing red beads with a white core, mostly aimed.                                                                                                                                                                                  |
| Drops        | Gold coins fall from kills and fly to the plane; the counter top right goes 83 → 104 → 128 in ~25 s.                                                                                                                                |
| HUD          | Top left: a bar, red trailing into yellow (read as HP). Top right: pause button and coin counter. Bottom left: a green round button with three bullets and a blue button with three missiles (skill and bomb).                      |
| Boss intro   | Red band with "WARNING" between two strips of scrolling "!!!BEWARE", while gunboats pass.                                                                                                                                           |
| Boss         | A long battleship, bow down, grey armour with hexagon turret plates, an orange wooden deck and red bow trim. It sits at the top and drifts sideways.                                                                                |
| Boss attacks | Every ~2 s: four guns on the bow fire four slightly fanned chains of ~10 beads; missiles with flame trails drop straight down from the top edge at varying x; occasional single aimed beads.                                        |

## Our design decisions (not visible in the ad)

- **Structure**: 48 s of waves per stage, then the warning and the battleship.
  Sinking it heals a crate's worth and starts the next stage with tougher
  enemies (HP ×1.35 per stage, faster fire). The run ends when HP hits 0; the
  leaderboard score is points (kills, +10 per coin, +5000 per battleship).
- **Control**: relative drag anywhere (the plane moves by the finger's delta,
  so the finger never covers it), plus WASD/arrows. The hitbox is a 9 px circle
  around the cockpit, so threading bead chains is possible.
- **HP**: 100. Bead −10, missile −20, ramming −25, then 0.9 s of blinking
  invulnerability.
- **Power**: we read the ad's growing stream count as 1942-style power-ups.
  Wiping out an entire formation (or downing a bomber) drops a red **P** crate;
  each level adds one stream, fanning from level 3, max 5.
- **Skill (green button)**: fills from kills; when full, 5 s of rapid fire with
  two extra streams. **Bomb (blue button)**: starts at 2, max 5; clears all
  enemy fire, hits everything on screen for 40 (the boss for 70) and gives
  1.5 s of invulnerability.
- **Enemy roster**: fighters (V, swoop and diving column formations; some fire
  one aimed bead), helicopters (hover and fire 3-bead bursts), gunboats (on
  the water, under the plane's flight path), and a twin-engine bomber we added
  as a mid-stage power-up carrier. Pipeline turrets were left out.
- **Boss**: 1,100 HP. Cycle: bead chains, missiles, chains, then a 7-bead aimed
  spread that becomes a 4-arm spiral below half HP. Missiles can be shot down
  (2 hits, +50).
- **Omitted**: the gun drone under the player (it never visibly fires
  separately) and any between-stage upgrade shop the full game may have.
- **Balance check** (`logic.test.ts`): a pilot that never moves dies in ~25 s;
  one that only tracks targets usually sinks the first battleship but dies in
  stage 1–3; a dodging bot sinks it in every tested seed.

## Open questions

- What the top-left bar really is (HP or stage progress), and what the skull
  "Hoàn thành" counter near the top centre tracks.
- The real damage numbers and whether the boss has more phases; the recording
  ends mid-fight.
