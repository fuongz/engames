# Chiến Thú Hỗn Chiến: reverse-engineering notes

Source: a 25 s iOS screen recording of the App Store playable ad for
"Chiến Thú Hỗn Chiến" (English: *Clash of Critters*). It was analysed frame by
frame with ffmpeg (1 fps contact sheet, 5 fps strips around the merge and the
evolution). No game binary or ad HTML was available, so REA's artifact tools had
nothing to open: everything below comes from the video, not from code.

## Observed in the recording

| Area | What the ad shows |
| --- | --- |
| Layout | Portrait. Top: camp scenery (red van left, stone hut right), egg counter pill centred. Middle: sand ring around a round grass field. Bottom: tree line. |
| Field | 19 round slots in rows 3-4-5-4-3, alternating light/dark green. |
| Enemies | Zombies walk in single file along the sand ring, each with an HP number above it. Variants: basic (white shirt), miner (hat), blond, blue riot shield, burning red. |
| Base | A kid with a cap and backpack stands on the ring at the left; a red striped bar sits just below him. |
| Critters | Green cat-like creatures with pink ears and a level number above them (green for 1, cyan for 2, gold for 5). A magenta glow ring under level 2+. |
| Attack | Weapons orbit and spin around each critter: a spring onion at level 1, green jade blades from level 2 (2 blades), 4 blades at level 5. They hit zombies within reach. |
| Merge | The tutorial hand drags one level 1 onto another: white flash, then a single level 2. |
| Eggs | Orange flame-patterned eggs labelled "20" sit on the ring; the counter goes 0 → 1 → 3 → 5. Yellow light beams appear on empty slots and spawn new level 1 critters. |
| Evolution | At level 5: the screen dims, "Đang tiến hóa" appears, a black silhouette wobbles with a magnifying glass circling it, sparkles, then a white flash reveals the new form. |

## Our design decisions (not in the ad)

- **Path direction**: zombies spawn at a gate under the red bar, go round the ring
  counter-clockwise and damage the kid if they arrive. We read the red bar as base HP.
- **Reach rule**: only critters near the rim can hit the ring, and higher levels
  reach further (`bladeOrbit`, `bladeHalf`). That makes placement a decision.
- **Economy**: a kill drops an egg 15 % of the time, a wild egg on the track gives
  2, a wave clear gives 1. Hatching costs `1 + floor(summons / 3)` eggs.
- **Species tiers** at levels 1, 3, 5 and 7, so evolution happens more often than
  in the ad. The full "Đang tiến hóa" screen plays the first time a tier is
  reached on a device (saved in `dex`); later evolutions only flash.
- **Waves**: `8 + 2n` enemies, HP scales by 1.3× per wave, new enemy types unlock
  on waves 2 to 4, and every 5th wave ends with a brute.
- **Balance check** (`logic.test.ts`): an idle player loses around wave 4; a greedy
  bot (hatch, merge, keep big critters on the rim) reaches about wave 16.

## Open questions

- Whether the real game uses a fixed path or several lanes, and what the red bar
  actually is. Only a longer recording or the shipped app would settle this.
- Real damage and HP numbers. The ad's numbers (1 to 98) are staged for the ad.
