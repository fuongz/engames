import type { Localized } from "@web-games/core/i18n";
import type { BuildKind } from "./config";
import type { BotName } from "./logic";

// Every player-visible line. game.ts resolves these at draw time, so switching
// language in the portal shows on the next frame. Vietnamese follows the ad's
// wording where the ad shows it (THÔNG BÁO, Kiến Trúc, Tháp Chói...).

export interface Strings {
  noticeTitle: string;
  rules: string[];
  ok: string;
  moveHint: string;
  keysHint: string;
  sleep: string;
  door: string;
  lookHint: string;
  buildHint: string;
  roomTaken: string;
  caught: string;
  you: string;
  bots: Record<BotName, string>;
  hunter: string;
  level: (n: number) => string;
  enraged: string;
  nightBanner: string;
  retreat: string;
  buildTitle: string;
  tabs: { basic: string; workshop: string };
  builds: Record<BuildKind, { name: string; desc: string }>;
  turretStats: (damage: number, range: number) => string;
  limit: (used: number, max: number) => string;
  upgrade: string;
  max: string;
  turretLevel: (n: number) => string;
  bedLevel: (n: number) => string;
  bedIncome: (now: number, next: number | null) => string;
  doorLevel: (n: number) => string;
  doorHp: (now: number, next: number | null) => string;
  repair: string;
  close: string;
  won: string;
  lost: string;
  resultLine: (time: string, level: number) => string;
  score: (n: number) => string;
  newBest: string;
  best: (n: number) => string;
  playAgain: string;
  /** Online: after a match, back to the room's lobby. */
  backToLobby: string;
  /** Online: your door fell, the team plays on. */
  spectating: string;
  /** Online: the scoreboard heading on the result card. */
  team: string;
  paused: string;
  resume: string;
  restart: string;
  /** Leaderboard detail. */
  detail: (won: boolean, time: string, level: number) => string;
}

export const STRINGS: Localized<Strings> = {
  vi: {
    noticeTitle: "THÔNG BÁO", // ad
    rules: [
      "1. Khi đồng hồ đếm ngược màu đỏ xuất hiện, hãy vào phòng ngay lập tức và đi ngủ.",
      "2. Đừng vào phòng đã có người. Thấy có người nằm sẵn trên giường thì rời đi NGAY LẬP TỨC.",
      "3. Ngủ để kiếm Xu Vàng. Nâng cấp giường, xây và nâng cấp Tháp để tiêu diệt Thợ Săn Giấc Mơ.",
      "4. Nếu có kẻ phá cửa phòng bạn, hãy nhấn nút Sửa.",
      "5. Phòng nào tắt đèn là người trong đó đã bị bắt.",
    ],
    ok: "OK",
    moveHint: "Chạy vào một phòng trống và lên giường!",
    keysHint: "WASD / mũi tên: chạy | Space: ngủ | R: sửa cửa",
    sleep: "Ngủ", // ad
    door: "Cửa",
    lookHint: "Kéo màn hình để nhìn quanh",
    buildHint: "Chạm ô sáng để xây Tháp Chói cạnh cửa",
    roomTaken: "Phòng này có người rồi!",
    caught: "Bạn chưa kịp lên giường!",
    you: "Bạn", // ad
    bots: {
      novice: "Tân Thủ",
      apprentice: "Tập Sự",
      expert1: "Chuyên Gia I",
      expert2: "Chuyên Gia II",
      master: "Bậc Thầy",
    }, // ad
    hunter: "Thợ Săn Giấc Mơ", // ad
    level: (n) => `Cấp ${n}`,
    enraged: "NỔI ĐIÊN!",
    nightBanner: "Thợ Săn Giấc Mơ đã xuất hiện!",
    retreat: "Thợ Săn rút lui để hồi máu",
    buildTitle: "Kiến Trúc", // ad
    tabs: { basic: "Cơ Bản", workshop: "Xưởng" }, // ad
    builds: {
      turret: { name: "Tháp Chói", desc: "Bắn Thợ Săn khi tới gần" }, // ad name
      arcade: { name: "Máy Chơi Game", desc: "Tạo ra 1 ⚡ mỗi 2 giây" }, // ad
      station: { name: "Đài Sửa Chữa", desc: "Hồi máu cửa mỗi giây" }, // ad
      watchtower: { name: "Tháp Canh", desc: "Tăng phạm vi tấn công của Tháp" }, // ad
      accelerator: {
        name: "Máy Gia Tốc Hạt",
        desc: "Tăng tốc độ tấn công của Tháp",
      }, // ad
    },
    turretStats: (d, r) => `Tấn Công: ${d} | Phạm Vi: ${r}`,
    limit: (used, max) => `Có thể xây ${used}/${max}`, // ad
    upgrade: "Nâng cấp",
    max: "Tối đa",
    turretLevel: (n) => `Tháp Chói cấp ${n}`,
    bedLevel: (n) => `Giường cấp ${n}`,
    bedIncome: (now, next) =>
      next === null ? `${now} xu/giây` : `${now} → ${next} xu/giây`,
    doorLevel: (n) => `Cửa cấp ${n}`,
    doorHp: (now, next) =>
      next === null ? `Máu ${now}` : `Máu ${now} → ${next}`,
    repair: "Sửa",
    close: "Đóng",
    won: "Hạ Gục Thợ Săn!",
    lost: "Bạn Đã Bị Bắt!",
    resultLine: (time, level) => `Sống ${time} | Thợ Săn cấp ${level}`,
    score: (n) => `${n} điểm`,
    newBest: "Kỷ lục mới!",
    best: (n) => `Kỷ lục ${n}`,
    playAgain: "Chơi lại",
    backToLobby: "Về phòng chờ",
    spectating: "Bạn đã bị bắt, đang xem đồng đội",
    team: "Cả đội",
    paused: "Tạm Dừng",
    resume: "Tiếp tục",
    restart: "Chơi lại",
    detail: (won, time, level) =>
      won ? `Hạ Thợ Săn sau ${time}` : `Sống ${time}, cấp ${level}`,
  },
  en: {
    noticeTitle: "NOTICE",
    rules: [
      "1. When the red countdown appears, get into a room right away and go to sleep.",
      "2. Never take a room that's taken. If someone is already in the bed, leave AT ONCE.",
      "3. Sleep to earn Gold. Upgrade your bed, build and upgrade Turrets to destroy the Dream Hunter.",
      "4. If something is breaking your door, press Repair.",
      "5. A room that goes dark means its sleeper was caught.",
    ],
    ok: "OK",
    moveHint: "Run into an empty room and get into bed!",
    keysHint: "WASD / arrows: run | Space: sleep | R: repair",
    sleep: "Sleep",
    door: "Door",
    lookHint: "Drag the screen to look around",
    buildHint: "Tap the glowing tile to build a Glare Turret by the door",
    roomTaken: "Someone's already in there!",
    caught: "You weren't in bed in time!",
    you: "You",
    bots: {
      novice: "Rookie",
      apprentice: "Apprentice",
      expert1: "Expert I",
      expert2: "Expert II",
      master: "Master",
    },
    hunter: "Dream Hunter",
    level: (n) => `Lv ${n}`,
    enraged: "ENRAGED!",
    nightBanner: "The Dream Hunter is here!",
    retreat: "The Hunter retreats to heal",
    buildTitle: "Build",
    tabs: { basic: "Basic", workshop: "Workshop" },
    builds: {
      turret: {
        name: "Glare Turret",
        desc: "Shoots the Hunter when it comes close",
      },
      arcade: { name: "Arcade Machine", desc: "Makes 1 ⚡ every 2 seconds" },
      station: {
        name: "Repair Station",
        desc: "Restores door HP every second",
      },
      watchtower: { name: "Watchtower", desc: "Turrets reach further" },
      accelerator: {
        name: "Particle Accelerator",
        desc: "Turrets fire faster",
      },
    },
    turretStats: (d, r) => `Damage: ${d} | Range: ${r}`,
    limit: (used, max) => `Can build ${used}/${max}`,
    upgrade: "Upgrade",
    max: "Max",
    turretLevel: (n) => `Glare Turret Lv ${n}`,
    bedLevel: (n) => `Bed Lv ${n}`,
    bedIncome: (now, next) =>
      next === null ? `${now} gold/s` : `${now} → ${next} gold/s`,
    doorLevel: (n) => `Door Lv ${n}`,
    doorHp: (now, next) =>
      next === null ? `HP ${now}` : `HP ${now} → ${next}`,
    repair: "Repair",
    close: "Close",
    won: "Hunter Defeated!",
    lost: "You Got Caught!",
    resultLine: (time, level) => `Survived ${time} | Hunter Lv ${level}`,
    score: (n) => `${n} pts`,
    newBest: "New best!",
    best: (n) => `Best ${n}`,
    playAgain: "Play again",
    backToLobby: "Back to lobby",
    spectating: "You were caught, watching your team",
    team: "Team",
    paused: "Paused",
    resume: "Resume",
    restart: "Restart",
    detail: (won, time, level) =>
      won ? `Hunter down in ${time}` : `Survived ${time}, Lv ${level}`,
  },
};
