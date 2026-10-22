# Tinh Tú Phi Hành: reverse-engineering notes

Source: a 53 s iOS screen recording (1170×2532 with a 90° rotation flag, so the
game is landscape) of a horizontal shoot 'em up mini-game. It was analysed frame
by frame with ffmpeg: a contact sheet at 0.5 fps, full-res stills at key moments,
and 1 to 4 fps strips around the boss warning, the skill and the boss kill. No
binary or HTML was available, so REA had no artifact to open; everything below
comes from the video.

## Observed in the recording

| Area | What the video shows |
| --- | --- |
| Start | Dark overlay, "Chuẩn Bị Bắt Đầu", a big number in a glowing blue medallion counting 3-2-1. |
| HUD | Top right: "Điểm Hiện Tại:" plus the score in gold, a pause button, a shard counter "0/10" and an hourglass timer starting at 00:59. |
| Rider | A pink-haired girl with rainbow twin tails on a golden flying blade. Three pink hearts float above her. |
| Controls | A floating joystick at the bottom left, an orange skill button at the bottom right showing charges "0/2", "1/2" and a ring around it that fills. |
| Firing | Automatic, pink and gold petal bullets in parallel streams. Two streams at the start, three after "Tăng số lượng đạn." |
| Enemies | Dark fighters with blue neon edges (one hit), flaming lava meteors and big obsidian rocks with purple crystal fire, which glow white when hit and take several hits. All fly right to left. None of them fire. |
| Score | +20 per fighter or meteor, +80 per crystal rock (420 → 500 on one kill). |
| Power-ups | A blue bubble with three blades, captioned "Cấp đạn xuyên." or "Tăng số lượng đạn."; a gold orb with the skill emblem captioned "Cung cấp / Tăng Năng Lượng Tinh Tú."; a purple bubble with the emblem and "2→3". |
| Boss | At 00:20 left: a pulsing red vignette and a red "!" badge under pause. A huge obsidian and lava serpent fills the right edge, with a green HP bar. |
| Skill | Tapping the button plays a full-screen cut-in (character art sweeping across with speed lines), then an ornate mirror portal in front of the rider fires a screen-wide beam. Charges drop by one. |
| Boss kill | Explosions, "Đã Vượt Qua Đợt 1!" banner, "×10" shards flying to the counter (0/10 → 10/10), power-up bubbles dropped. Play continues with denser enemies. |

## Our design decisions (not visible in the ad)

- **Round** of 60 s. The boss warning starts at 40 s elapsed, matching 00:20 on
  the timer. The round ends when the timer runs out or all hearts are gone.
- **Damage**: ramming an enemy, boss fire orbs or the boss's row beam costs one
  heart, followed by 1.6 s of blinking invulnerability. The ad never shows the
  player getting hit.
- **Boss attacks** cycle through a 7-orb fan aimed at the player, three meteors
  and a row beam with a 0.9 s dashed-line warning. The boss has 240 HP; one skill
  beam takes about a third, so saving charges for the boss matters (it does in
  the ad too).
- **Energy**: kills fill the ring (+6 fighter or meteor, +20 crystal); a full
  ring is one charge, up to 2, or 3 after the purple bubble (our reading of
  "2→3"). The gold orb gives a full charge.
- **Pierce** lets a bullet pass through one more enemy per level (max 3); **multi**
  adds a stream (max 5).
- **Stars**: 1 for surviving, +1 for beating the boss (10/10 shards), +1 for no
  hearts lost. The game clock freezes during the cut-in, as it appears to in the ad.
- **Balance check** (`logic.test.ts`): a player who doesn't move loses all three
  hearts before the end; a dodging bot that saves its skill for the boss beats it
  in most seeds and scores 1,100–2,100 (the ad shows 1,460 at 52 s).

## Open questions

- The real damage numbers, the boss's actual attack patterns, and whether wave 2
  has its own boss. The recording ends at 00:14.
- Whether the gold coin is score or currency; we treat every pickup as +10.
