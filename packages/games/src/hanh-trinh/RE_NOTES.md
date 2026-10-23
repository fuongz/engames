# Hành Trình Anh Hùng: reverse-engineering notes

Source: a 32 s iOS screen recording of a TikTok playable ad for **Epic Idle
Journey: RPG Battle** by FreePlay Studio ("Idle Never Felt This Good"). It was
analysed frame by frame with ffmpeg: a 0.5 fps contact sheet, full-res stills,
and 4 fps strips of the road to time the swings and arrows. No binary or ad
HTML was available, so REA had nothing to open; everything comes from the video.

## Observed in the recording

| Area | What the ad shows |
| --- | --- |
| Layout | Portrait. Grass with trees and bushes on top, a dirt road across the middle, two upgrade buttons at the bottom. The kill counter (skull) and gold (coin) sit in dark pills at the top. |
| Hero | Bald, peach-skinned, green body, two dot eyes, olive club. HP bar under the feet starts at **145**. |
| Line | Red foes with big white eyes, packed shoulder to shoulder, about 5½ visible, each with a red HP bar. |
| Foe types | Club grunt (**14 HP**, hits for **5**), axeman (**30 HP**, hits for 7–9), archer (**10 HP**, red bow, shoots arrows over the line), red pointy helmet with a gold band (**55 HP**). |
| Combat | Hero swings about once a second (raise overhead, slam), **10** damage, sometimes **MISS**, sometimes a crit **20** with a flame. The front foe swings back every ~1.25 s; its numbers pop over the hero and fade to grey. |
| Kill | Dust poof, 2–3 coins burst out and fly to the gold counter, kills +1, the whole line steps forward and the scenery scrolls with it. |
| Gold | 0 → 210 → 473 → 632 over the first 6 kills. |
| Upgrades | Axe button **200**, shield button **600**: grey until affordable, then full colour. The player in the recording never taps them. |
| End | After **11 kills** (~28 s) the hero hits 0 HP: dark overlay with crossed sword and axe, a knocked-out head and a **DEFEAT** ribbon, then the store page. |

## Our design decisions (not in the ad)

- **Gold** per kill is the foe's max HP × 7 (±10 %), which reproduces the ad's
  ~210 for a 30 HP axeman.
- **Upgrade ladders**: the left button continues stick → axe → iron sword → war
  hammer → flame sword → divine sword → dragon glaive → heaven sword. The right
  one goes wood → iron → gold → dragon → divine → heaven shield. Each shield adds
  max HP (healed on purchase) and a block chance ("CHẶN").
- **Scaling**: each new foe has +4 % HP and +3 % damage per foe spawned so far.
  A **chief** joins every 20th slot.
- **Kill heal**: 3 + 2 % of max HP per kill, so a run is a race between upgrades
  and scaling rather than a fixed countdown.
- **Score** for the leaderboard is the kill count, which is the number the ad keeps
  on screen. The detail line is the weapon and shield.
- **Balance check** (`logic.test.ts`): never upgrading dies at 9–16 kills (the ad:
  11); buying the cheapest upgrade whenever possible usually reaches 40–250 kills.

## Open questions

- Gold in the ad arrives in lumps (nothing for the first two kills), so the real
  game probably drops gold per foe type or from chests.
- What the axe and shield actually do in the real game, and whether there is
  healing, can't be seen: the recording never buys either.
