import type { Localized } from "@web-games/core/i18n";
import type { WordId } from "./config";

// Every player-visible line. game.ts resolves these at draw time, so switching
// language in the portal shows on the next frame. Word names live in config.ts
// (the rules match typed text against them); the survival tips are here.

export interface Strings {
  title: string;
  sub: string;
  tapToStart: string;
  startHint: string;
  keysHint: string;
  paused: string;
  tapToResume: string;
  noWebGL: string;
  go: string;
  you: string;
  /** "Next writer in 5" */
  nextWriter: (seconds: number) => string;
  /** "An is writing… 7" */
  writing: (name: string, seconds: number) => string;
  yourTurn: (seconds: number) => string;
  typeHere: string;
  /** Desktop: how to reach the field and the quick picks. */
  typeKeys: string;
  send: string;
  /** Under a landed word: who wrote it. */
  wroteBy: (name: string) => string;
  /** The writer ran out of time and the room drew the word. */
  drawnFor: (name: string) => string;
  tip: Record<WordId, string>;
  storm: string;
  stormTip: string;
  dash: string;
  jump: string;
  alive: (n: number, of: number) => string;
  words: (n: number) => string;
  // out and over
  outTitle: string;
  ghostHint: string;
  keepHaunting: string;
  win: string;
  draw: string;
  lose: string;
  place: (place: number, of: number) => string;
  points: (n: number) => string;
  best: (n: number) => string;
  newBest: string;
  again: string;
  /** Leaderboard detail, ≤ 40 chars. */
  detail: (place: number, words: number) => string;
  summary: (best: number) => string;
  // online
  connecting: string;
  watching: string;
  backToLobby: string;
  matchOver: string;
}

export const STRINGS: Localized<Strings> = {
  vi: {
    title: "Nói Là Có",
    sub: "Viết một chữ, cả bãi cùng chịu",
    tapToStart: "Chạm để bắt đầu",
    startHint: "Trái: kéo để chạy · Phải: vuốt để xoay camera",
    keysHint: "WASD chạy · Space nhảy · Shift lướt · kéo chuột xoay · Enter viết",
    paused: "Tạm dừng",
    tapToResume: "Chạm để chơi tiếp",
    noWebGL: "Thiết bị này không bật được đồ họa 3D (WebGL).",
    go: "Chạy!",
    you: "Bạn",
    nextWriter: (n) => `Người viết tiếp theo sau ${n}`,
    writing: (name, n) => `${name} đang viết… ${n}`,
    yourTurn: (n) => `Đến lượt bạn viết! ${n}`,
    typeHere: "Gõ một chữ…",
    typeKeys: "[Enter] để gõ · [1]–[4] chọn nhanh",
    send: "Viết",
    wroteBy: (name) => `${name} viết`,
    drawnFor: (name) => `${name} hết giờ, trời bốc hộ`,
    tip: {
      lu: "Nước dâng ngập bãi cát. Lên bãi cỏ!",
      "song-than": "Sóng đang ập tới. Lên đồi, chòi, đống rơm, hoặc nhảy đúng lúc!",
      "dung-nham": "Ô nhấp nháy sắp thành dung nham. Tránh ra, hoặc nhảy qua!",
      "loc-xoay": "Lốc đuổi theo người gần nhất. Chạy xa nó!",
      "sam-set": "Sét đánh vào vòng sáng. Rời vòng, hoặc núp dưới mái chòi!",
      ong: "Ong đuổi đốt. Chạy liên tục, đừng đứng lại!",
      "trau-dien": "Trâu húc theo vạch đỏ. Né sang ngang, hoặc nhảy qua!",
      "ca-sau": "Cá sấu rình ở bãi cát. Tránh xa mép nước!",
      rong: "Rồng phun lửa theo vạch đỏ. Ra khỏi vạch!",
      bom: "Bom sắp nổ. Ra khỏi vòng đỏ!",
      "phao-hoa": "Pháo rơi vào các vòng tròn. Né vòng, hoặc núp dưới mái chòi!",
      "vo-chuoi": "Giẫm vỏ chuối là trượt dài. Nhìn dưới chân!",
      dau: "Vũng dầu trơn như mỡ. Đi vòng qua!",
      choi: "Có chòi: sàn cao tránh lũ, mái che sét và pháo.",
      thuoc: "Túi thuốc rơi xuống. Ai nhặt trước được thêm tim!",
      dieu: "Mọi người bay lên. Mặt đất không chạm tới bạn được!",
      "dong-rom": "Đống rơm mọc lên. Trèo lên để tránh lũ và sóng!",
      nguoc: "Điều khiển bị đảo ngược!",
      toi: "Trời tối om. Chỉ thấy quanh mình!",
      ngu: "Đứng yên là ngủ gật. Đi liên tục!",
      "ti-hon": "Ai cũng hóa tí hon, chạy chậm hẳn!",
      "sa-mac": "Nắng cháy: nước rút, cá sấu bỏ đi, ai cũng chậm lại.",
      bang: "Mặt đất đóng băng, trơn trượt!",
      "dam-lay": "Bãi hóa đầm lầy, lội rất chậm. Đồi cao vẫn khô!",
    },
    storm: "Trời phạt!",
    stormTip: "Sét đánh không ngừng, mái chòi không che được nữa!",
    dash: "Lướt",
    jump: "Nhảy",
    alive: (n, of) => `Còn ${n}/${of}`,
    words: (n) => `${n} chữ`,
    outTitle: "Bạn đã bị loại!",
    ghostHint: "Hồn ma vẫn được viết chữ khi tới lượt.",
    keepHaunting: "Ở lại viết chữ",
    win: "Bạn sống sót!",
    draw: "Hòa!",
    lose: "Hết trận!",
    place: (p, of) => `Hạng ${p}/${of}`,
    points: (n) => `${n} điểm`,
    best: (n) => `Kỷ lục ${n}`,
    newBest: "Kỷ lục mới!",
    again: "Chơi lại",
    detail: (place, words) => `Hạng ${place}, qua ${words} chữ`,
    summary: (best) => `Kỷ lục ${best} điểm`,
    connecting: "Đang kết nối…",
    watching: "Đang xem trận này",
    backToLobby: "Về phòng chờ",
    matchOver: "Hết trận!",
  },
  en: {
    title: "Say It, Survive It",
    sub: "Write one word, everyone lives with it",
    tapToStart: "Tap to start",
    startHint: "Left: drag to run · Right: swipe to turn the camera",
    keysHint: "WASD run · Space jump · Shift dash · drag to look · Enter write",
    paused: "Paused",
    tapToResume: "Tap to keep playing",
    noWebGL: "This device cannot start 3D graphics (WebGL).",
    go: "Run!",
    you: "You",
    nextWriter: (n) => `Next writer in ${n}`,
    writing: (name, n) => `${name} is writing… ${n}`,
    yourTurn: (n) => `Your turn to write! ${n}`,
    typeHere: "Type a word…",
    typeKeys: "[Enter] to type · [1]–[4] quick pick",
    send: "Write",
    wroteBy: (name) => `written by ${name}`,
    drawnFor: (name) => `${name} ran out of time`,
    tip: {
      lu: "The water covers the sand. Get on the grass!",
      "song-than": "A wave is coming. Get on a hill, the hut, a haystack, or jump it!",
      "dung-nham": "Blinking tiles turn to lava. Step off, or jump over!",
      "loc-xoay": "The tornado chases whoever is nearest. Run!",
      "sam-set": "Lightning hits the glowing rings. Leave them, or hide under the hut roof!",
      ong: "Bees chase and sting. Keep running!",
      "trau-dien": "The buffalo charges along the red line. Step aside, or jump it!",
      "ca-sau": "Crocodiles lurk on the sand. Stay away from the water's edge!",
      rong: "The dragon burns along the red line. Get out of it!",
      bom: "Bombs are about to blow. Leave the red circles!",
      "phao-hoa": "Rockets land in the rings. Dodge them, or hide under the hut roof!",
      "vo-chuoi": "Step on a peel and you slide. Watch your feet!",
      dau: "Oil is as slippery as it looks. Go around!",
      choi: "A hut: a high floor above floods, a roof against lightning and rockets.",
      thuoc: "Medicine dropped. First to grab it gains a heart!",
      dieu: "Everyone flies. The ground cannot touch you!",
      "dong-rom": "Haystacks appear. Climb them to escape floods and waves!",
      nguoc: "Controls are reversed!",
      toi: "Pitch dark. You only see around yourself!",
      ngu: "Stand still and you nod off. Keep moving!",
      "ti-hon": "Everyone turns tiny and much slower!",
      "sa-mac": "Scorching sun: water drains, crocodiles leave, everyone slows.",
      bang: "The ground freezes over. Slippery!",
      "dam-lay": "The bank turns to swamp, wading is slow. The hills stay dry!",
    },
    storm: "Wrath of the sky!",
    stormTip: "Lightning without end, and the hut roof no longer helps!",
    dash: "Dash",
    jump: "Jump",
    alive: (n, of) => `${n}/${of} left`,
    words: (n) => `${n} words`,
    outTitle: "You are out!",
    ghostHint: "Ghosts still write when their turn comes.",
    keepHaunting: "Stay and write",
    win: "You survived!",
    draw: "Draw!",
    lose: "Match over!",
    place: (p, of) => `Place ${p}/${of}`,
    points: (n) => `${n} pts`,
    best: (n) => `Best ${n}`,
    newBest: "New best!",
    again: "Play again",
    detail: (place, words) => `Place ${place}, ${words} words`,
    summary: (best) => `Best ${best} pts`,
    connecting: "Connecting…",
    watching: "Watching this match",
    backToLobby: "Back to lobby",
    matchOver: "Match over!",
  },
};
