# Võ Đài Hoá Thú / Beastform Fighters: design notes

No recording or binary this time: the game is an original take on two
classics the user named, **Bloody Roar** (Hudson/Eighting, 1997) and **Mortal
Kombat** (Midway, 1992). Nothing is copied — characters, moves, art and names
are our own; only the genre ideas are borrowed.

## Borrowed ideas

| From | Idea | Our version |
| --- | --- | --- |
| Bloody Roar | Fighters turn into beasts mid-fight | A beast meter fed by landing and taking hits; full → transform (×1.25 damage, ×1.15 speed, health regrows, Frenzy attack) for 10 s, drained faster when hit |
| Mortal Kombat | Specials from directional motions | ↓→ + Punch, →↓→ + Punch, ↓← + Kick |
| Mortal Kombat | "Finish Him" after the deciding round | ↓↓ + Beast within 2 s: a beast roar that throws the dazed loser off stage — cartoon, no blood (decided with the user) |
| Both | Best of three rounds, a timer, a ladder of opponents | 60 s rounds, three fights; the last is a champion of your own style, one level harder, starting with a full meter |

## Our design decisions

- **Determinism first.** The fight runs at a fixed 60 Hz (`fixedStep`), all
  timing in frames, inputs as bitmasks, random state inside the CPU's brain.
  The same inputs replay the same fight (`logic.test.ts`), which is the ground
  rule for **rollback netcode** in phase 2 (online 1v1).
- **Touch first.** Motion inputs are hard on glass, so the **Special** button
  does each special by direction (alone / → / ←). Light attacks chain into the
  next on hit and normals cancel into specials, so combos need timing, not
  frame-perfect links.
- **Three styles.** Khang/Hổ (balanced; claw dash, invulnerable rising claw,
  overhead pounce), Linh/Sói (fast, less health; a howl projectile, a flip
  kick, a low slide), Tấn/Gấu (slow, more health; an armoured charge that is
  punishable on block, a rising swipe, a low ground slam).
- **Blocking**: hold away. Crouching blocks lows, standing blocks overheads
  (jump-ins and the tiger's pounce), mids either way. Specials chip 12% through
  a block.
- **Balance** (`logic.test.ts`): CPU vs CPU on Hard over every matchup, no
  fighter wins under 20% or over 80% of its fights; Hard beats Easy at least 6
  in 8.

## Art: everything is pixel art

Fight, HUD, menus and key art share one 16-bit pixel style, all generated with
an image model through Codex CLI and post-processed by `tools/vo-dai-sprites.py`
(sources in the gitignored `art-src/vo-dai/pixel/`):

| Asset | File | Notes |
| --- | --- | --- |
| Fighters | `img/px/<id>-<form>.webp` | 20 poses each, see below |
| Stage | `img/px/stage.webp` | 480×270 true pixels, drawn at 2x; mirrored into wide letterboxes |
| Effects | `img/px/effects.webp` | sparks, block, claw, howl wave, dust, aura, burst, puff, spin |
| HUD kit | `img/px/ui.webp` + `ui.json` | health and beast-meter frames, timer medallion, round gems, four touch buttons, pause; inner slots measured from the image |
| Select portraits | `img/px/portraits.webp` | six busts (human and beast), 96×96 at 2x |
| Key art | `img/poster-art.webp`, `img/banner-art.webp` | snapped to a 300×400 / 600×300 pixel grid, shown at 2x; `cover.ts` adds the title |

Text uses **Handjet** (`@fontsource/handjet`), a pixel display face that covers
Vietnamese diacritics; `text()` draws a blocky 2px outline and drop shadow
instead of a round stroke. Panels and buttons are hard-edged rectangles. The VS
screen shows each fighter's signature special from the fight atlas at 3x, so
menus and fight never disagree.

## Pixel sprites (the fight)

The fight is pixel art, after the pipeline in
[chongdashu/ai-game-spritesheets](https://github.com/chongdashu/ai-game-spritesheets):

1. **Anchor** per fighter-form: one side-view idle frame, generated with the
   repo's black-and-white pixel grid as a reference (chunky-pixel discipline)
   on a flat `#FF00FF` background.
2. **Pose sheets**: two 5x2 sheets per fighter-form (20 key poses: idle ×2,
   walk ×2, crouch, jump, jab, kick, low punch, sweep, air kick, three specials,
   frenzy, hit, block, down, win, dizzy/transform roar), each generated with
   the anchor (identity) and the repo's 5x2 sheet guide (layout) attached.
3. **Normalization** (`tools/vo-dai-sprites.py`, ImageMagick + cwebp; the generated sheets it reads live in the gitignored `art-src/vo-dai/pixel/`): key
   out the magenta, find each pose as connected blobs grouped by grid cell (the
   model drifts off its cells and returns sheets of varying size), scale each
   sheet so its standing pose is 66 true pixels tall (beast 74), snap to a real
   pixel grid, pin the feet to (60, 109) on a 144×112 cell, and pack 20 cells
   into one lossless webp atlas (`img/px/<id>-<form>.webp`, ~32 KB).

The stage (`img/px/stage.webp`, a 480×270 grid shown at 2x) and the effects
(`img/px/effects.webp`, ten 96×96 cells: sparks, block, claw, howl wave, dust,
aura, burst, puff, spin) come from the same style. `art.ts` maps every fighter
state and move to a pose (`poseFor`) and draws it unsmoothed at 2x; attacks
lunge a few pixels on active frames. Hitboxes and frame data are unchanged —
the art only shows them. The code-drawn rig remains the fallback while images
load.

## Not built yet

- Online 1v1 with rollback (the reason for the determinism above).
- Throws, a training mode, more fighters and stages.
