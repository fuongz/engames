# Mèo Vũ Trụ / Cosmic Cats: design notes

No single game was reverse-engineered. Mèo Vũ Trụ is an original game in the
classic arcade **wave-shooter** genre (the space-invaders family: a ship at the
bottom, waves of enemies above, power-ups that change and level the gun). It
takes genre conventions only; the theme, enemies, weapons, waves, bosses, UI and
art are our own. No level layout, weapon name, pickup look or screen was copied
from any existing game.

## Genre conventions we use

| Convention                                                                 | Here                                                               |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Ship at the bottom, enemies come in waves from the top                     | Portrait 540×960; the ship lives in the lower half                 |
| Coloured pickups swap the weapon; the same colour levels it                | Red / blue / green **fish cans** (not boxes); power 1–10           |
| A generic power-up adds a level                                            | Glowing energy orb                                                 |
| Enemies drop collectables that add up to a bomb                            | Dried fish; every 30 is a missile that clears the screen           |
| Formations, divers, snaking lines, a mini-boss, a bonus stage, an end boss | Ten waves per chapter, three chapters                              |
| Lives with a short shield after respawn                                    | 3 lives (max 5), 2.6 s shield                                      |
| The loop gets harder after the last chapter                                | "Vòng 2…": enemy HP +60 %, fire +35 %, bullet speed +10 % per loop |

## Our own decisions

- **Theme:** alien cats in bubble saucers are stealing Earth's fish. Enemy fire
  is hairballs, little fish-bone darts and (boss 2) bouncing yarn balls, drawn
  bright with dark outlines so they read on a phone and never look friendly.
- **Weapons:** spread (more streams per level), laser (narrow bolts that pierce
  up to five cats, more parallel beams), chain bolt (auto-targets the nearest
  cat ahead and jumps to neighbours; more jumps per level). A different colour
  switches family and keeps the level; the same colour adds one. Losing a life
  costs two levels, never below 1. No overheat.
- **Controls:** relative drag anywhere (the ship keeps its offset from the
  finger, so it stays visible above the thumb), always-on auto-fire, a
  thumb-reachable missile button whose ring fills with fish. Keyboard arrows /
  WASD, mouse hover follows, Space fires a missile.
- **Fairness:** the hit circle (11 px) is far smaller than the sprite;
  ordinary cats hold fire within 170 px above the ship; at most 46 enemy
  bullets at once; kamikaze robo-kittens glow red and shake before they dash;
  bosses are armoured while flying in. A balance test has a simple dodging bot
  clear chapter 1 waves 1–5, and beat each boss at power 5.
- **Waves (per chapter):** formation grid that sways and creeps down (later
  ones send divers), lines that snake or loop in a figure-8, kamikaze kittens,
  space-junk rain, the big saucer with escorts, fish rain (bonus), boss.
- **Bosses:** each has three phases at ⅔ and ⅓ HP, each phase adding an
  attack and dropping an orb, then a can.
  1. _Captain Chonk_ on the cat-food-can mothership: fish-cannon bursts, claw
     dart fans, then launches kamikaze kittens.
  2. _Steel Mecha-Cat_: yarn balls that bounce off the walls, dart rings, then
     dashes side to side with aimed darts.
  3. _The Cat Queen_ on her fish battleship: alternating turret darts, a
     sweeping mouth-cannon stream, then calls in UFO escorts.
- **Score:** kills (×loop), fish 50, bones 20, wave-clear bonus
  (500 + 100·wave + 1000·(chapter−1), ×loop), boss bonus. Reported once at game
  over with the detail "Chương X - Đợt Y"; best score and furthest wave are
  saved on the device and shown on the portal card.
- **No mid-wave resume:** a reload starts a new run (runs are short).

## Art

Generated with the Codex CLI's image tool (`tools/meo-vu-tru-art.sh`) from the
approved samples (sheet, scene, boss) and keyed off magenta by
`tools/meo-vu-tru-sprites.py`. The ship, five enemy cats, fish, bone, orb and the
chapter-1 boss come from the approved sample sheet; UFO colour variants, fish
cans, missile, heart, bosses 2–3, background, poster and banner art were
generated for this game. Shots, bullets, rocks and effects are procedural.
