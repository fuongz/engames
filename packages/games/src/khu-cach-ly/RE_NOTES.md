# Reference and scope

The supplied 2026-10-23 screen recording (about 20 seconds) shows a mobile ad: an overhead/isometric soldier, dense pursuing hordes, grey laboratory corridors and a darker fenced arena, bright continuous gunfire, weapon pickups and a health HUD. The ad is visual evidence, not evidence of the advertised game’s actual rules.

This original Canvas 2D interpretation keeps the overhead movement, corridor pressure, automatic aiming, swarms and bright weapon trails. It uses original procedural marine/creature art, a traversable laboratory arena, three kill-unlocked weapons, medical pickups, a rechargeable pulse and an endless wave sequence with a boss every five waves. It does not reproduce the ad’s assets, commercial upgrade screens or 3D renderer.

Rules run at 60 fixed ticks per second. Seeded spawns, collision, flow-field navigation, swept bullet collision, damage, drops and scoring live in logic.ts. The runtime owns input, audio unlock, suspension and teardown. Touch uses a floating movement stick; keyboard uses WASD/arrows, 1–3 and Space. Score is reported exactly at death, never on quit.
