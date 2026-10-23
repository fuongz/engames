# Ký Túc Xá Đêm / Night Dorm: reverse-engineering notes

Source: a 36 s iOS screen recording (1170×2532, 60 fps) of a TikTok ad for
**Haunted Dorm** by Mihuan Games (the "HAUNTED DORM · Piracy is Prohibited ·
Mihuan Games" seal is on the floor). It was analysed frame by frame with
ffmpeg: a 1 fps contact sheet, full-res crops of the rules sheet, the build
menu and a room, and a few stills around sleeping. No binary or ad HTML was
available, so REA had nothing to open; everything comes from the video.

## Observed in the recording

| Area       | What the ad shows                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rules      | A paper "THÔNG BÁO" sheet with OK: (1) when the red countdown appears, get into a room and sleep; (2) don't follow others in; if someone is already in the bed, leave AT ONCE; (3) get into bed right away; sleeping and upgrading the bed earn Gold, build and upgrade Turrets to kill the Dream Hunter (Thợ Săn Giấc Mơ); (4) if your door is broken, press Repair; (5) if another room's light goes out, go strip its devices; (6) buy items at the hidden shop. |
| Lobby      | Characters to unlock, a "BẮT ĐẦU" button, "Chọn bản đồ → Bản Đồ Thường", then a matchmaking screen: the hunter (Agulrre Alla Lyon) VS six players ("Tôi" plus five), "Đang ghép 1s…10s", "Sẵn sàng".                                                                                                                                                                                                                                                                |
| Match      | Top-down dorm: dark brick, stone corridors, rooms with a grid of "+" build tiles, a blue bed and a grey door slab. A huge red countdown 30 → 0. A joystick at the bottom. Other players are labelled by rank: Tân Thủ, Tập Sự, Chuyên Gia I/II, Bậc Thầy.                                                                                                                                                                                                           |
| Sleeping   | Standing at a bed shows a "Ngủ" button. Asleep, the bed pops "+1" gold every second (gold 0 → 14 in ~14 s). The camera follows the player.                                                                                                                                                                                                                                                                                                                          |
| HUD        | Gold (coin) and energy (bolt) top left, a row of six avatars with "Bạn" under yours.                                                                                                                                                                                                                                                                                                                                                                                |
| Build menu | "Kiến Trúc" with tabs Cơ Bản / Nhận Xu Vàng / Công Nghệ Cao / CN Đen / Xưởng. Tháp Chói: Tấn Công 4, Phạm Vi 4, 8 gold. Máy Chơi Game Mốc Meo: makes 1 ⚡ / 2 s, 200 gold. Đài Sửa Chữa: restores door HP each second, 64 ⚡, "Có thể xây 1/4". Hộp Aladdin: random item, 10 gold, 0/4. Xưởng: Tháp Canh (+range, 256 ⚡), Máy Gia Tốc Hạt (+attack speed, 2048 ⚡), Solenoid (faster the closer the hunter, 2048 ⚡).                                              |
| End of ad  | The recording stops at countdown 14 with the build menu open. **The hunter never appears.**                                                                                                                                                                                                                                                                                                                                                                         |

## Our design decisions (not in the ad)

- **Map**: wider than the screen. Two corridors with four rooms on each side
  (16 rooms), a hall across the middle where everyone spawns and the hunter
  heals. Free movement with wall collision (WASD/arrows, or a floating joystick
  on touch), with a small "corner assist" that slides you into a corridor mouth
  or doorway when you are a few pixels off. Space/E or the big button sleeps.
- **Rule 2**: a bed that is taken refuses you; bots race you for rooms.
- **Economy**: bed income 1, 2, 4, 7, 12, 20 gold/s; doors and turrets upgrade
  with gold; Arcade Machines (120 gold, max 2) make the ⚡ that buys Repair
  Stations, the Watchtower and the Accelerator. Building already works during
  the countdown once you are in bed (the ad opens the menu at 22 s).
- **Cut**: Hộp Aladdin (at the user's request), Solenoid, the shop, the extra
  tabs, character unlocks and matchmaking.
- **The hunter** (designed from scratch): released when the countdown ends; it
  never targets the player first. It walks the corridors to the weakest door
  (weighted by door HP) and hits it every second; turrets within range of it
  fire. Every 40 s it levels up (HP and hits ×1.38). Below 22% HP it retreats
  to the hall to heal, to 100%, 85%, then 70%; after three retreats it is
  **enraged** and fights to the death. A broken door kills that room's
  sleeper and turns its light off (rule 5). Your door breaking ends the run.
- **Range**: "Phạm Vi 4" is 4 × 34 px, enough to cover your own door but not
  the whole corridor, so turrets must sit near the door.
- **Score**: gold earned + 5 per second survived + 5000 (and up to 3000 for
  speed) for taking the hunter down.
- **Balance** (`logic.test.ts`): a player who buys sensibly once a second wins
  4–7 of 8 seeds in about 3.5–4 minutes of night; one who sleeps but never
  builds is caught within two minutes; missing the countdown is fatal.

## Open questions

- Everything about the real hunter: its HP, damage, speed, targeting and
  whether it retreats or levels up.
- What the Solenoid, the shop and the "CN Đen" tab actually do.
