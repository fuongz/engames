import type { Localized } from "@web-games/core/i18n";
import type { Difficulty, ThemeId } from "./config";

// Every player-visible line. game.ts resolves these at draw time, so switching
// language in the portal shows on the next frame.

export interface Strings {
  title: string;
  subtitle: string;
  vsAi: string;
  hotseat: string;
  hotseatHint: string;
  level: Record<Difficulty, string>;
  theme: string;
  themes: Record<ThemeId, string>;
  quanNon: string;
  quanNonValue: (forbid: boolean) => string;
  rules: string;
  rulesLines: string[];
  close: string;
  you: string;
  ai: (level: Difficulty) => string;
  player: (n: 1 | 2) => string;
  yourTurn: string;
  pickDir: string;
  aiThinking: string;
  turnOf: (name: string) => string;
  newGame: string;
  menu: string;
  points: (n: number) => string;
  debt: (n: number) => string;
  youWin: string;
  youLose: string;
  winOf: (name: string) => string;
  draw: string;
  finalLine: (a: number, b: number) => string;
  winLine: (margin: number, score: number) => string;
  again: string;
  wins: (n: number) => string;
  // moments
  quanTaken: string;
  captured: (n: number) => string;
  youngQuan: string;
  refill: (name: string, borrowed: number) => string;
  sweep: string;
  // online
  gameN: (n: number) => string;
  firstTo: (wins: number) => string;
  firstMove: (name: string) => string;
  away: (name: string, seconds: number) => string;
  timedOut: string;
  matchWin: string;
  matchLose: string;
  matchDraw: string;
  forfeitWin: string;
  forfeitLose: string;
  score: (n: number) => string;
  backToLobby: string;
  watching: string;
  // board text
  detail: (level: Difficulty, margin: number) => string;
  matchDetail: (won: boolean, a: number, b: number, them: string) => string;
  summary: (level: Difficulty, wins: number) => string;
}

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

const vi: Strings = {
  title: "Ô Ăn Quan",
  subtitle: "Trò chơi dân gian: rải dân, ăn quan",
  vsAi: "Đấu với máy",
  hotseat: "2 người 1 máy",
  hotseatHint: "Hai bạn thay nhau chạm trên cùng một máy",
  level: { easy: "Dễ", normal: "Vừa", hard: "Khó" },
  theme: "Giao diện",
  themes: { "san-gach": "Sân gạch", "son-mai": "Sơn mài", "dong-ho": "Đông Hồ" },
  quanNon: "Ăn quan non",
  quanNonValue: (forbid) => (forbid ? "Cấm" : "Cho ăn"),
  rules: "Luật chơi",
  rulesLines: [
    "Mỗi ô dân có 5 viên, mỗi ô quan một quan. Dân 1 điểm, quan 10 điểm.",
    "Đến lượt: bốc hết một ô bên mình, chọn chiều, rải mỗi ô một viên.",
    "Ô kế tiếp có dân: bốc lên rải tiếp. Ô kế tiếp là ô quan còn quân: mất lượt.",
    "Ô kế tiếp trống: ăn hết ô sau nó. Cứ một ô trống rồi một ô có quân là ăn tiếp. Hai ô trống liền: mất lượt.",
    "Hết dân bên mình: lấy 5 dân đã ăn rải lại, mỗi ô một viên; thiếu thì vay đối thủ, cuối ván trả.",
    "Hết cả hai quan: dân còn bên nào về bên đó. Nhiều điểm hơn thì thắng.",
    "Cấm ăn quan non (tuỳ chọn): ô quan phải có từ 5 dân mới được ăn.",
  ],
  close: "Đóng",
  you: "Bạn",
  ai: (l) => `Máy (${vi.level[l]})`,
  player: (n) => `Người ${n}`,
  yourTurn: "Chạm một ô bên bạn để bốc",
  pickDir: "Chọn chiều rải",
  aiThinking: "Máy đang nghĩ…",
  turnOf: (n) => `Lượt của ${cut(n, 16)}`,
  newGame: "Ván mới",
  menu: "Menu",
  points: (n) => `${n} điểm`,
  debt: (n) => `nợ ${n}`,
  youWin: "Bạn thắng!",
  youLose: "Máy thắng rồi",
  winOf: (n) => `${cut(n, 16)} thắng!`,
  draw: "Hoà",
  finalLine: (a, b) => `${a} – ${b} điểm`,
  winLine: (m, s) => `Hơn ${m} điểm · +${s} điểm xếp hạng`,
  again: "Chơi lại",
  wins: (n) => `${n} ván thắng`,
  quanTaken: "Ăn quan!",
  captured: (n) => `+${n}`,
  youngQuan: "Quan non, chưa ăn được",
  refill: (n, b) => (b > 0 ? `${cut(n, 14)} hết dân: rải lại, vay ${b} dân` : `${cut(n, 14)} hết dân: rải lại 5 dân`),
  sweep: "Hết quan, thu dân!",
  gameN: (n) => `Ván ${n}`,
  firstTo: (w) => (w === 1 ? "Thắng 1 ván là thắng trận" : `Ai thắng ${w} ván trước thắng trận`),
  firstMove: (n) => `${cut(n, 14)} đi trước`,
  away: (n, s) => `${cut(n, 14)} mất kết nối… ${s}s`,
  timedOut: "Hết giờ: máy đã đi giúp bạn",
  matchWin: "Bạn thắng trận!",
  matchLose: "Bạn thua trận",
  matchDraw: "Trận hoà",
  forfeitWin: "Đối thủ bỏ cuộc",
  forfeitLose: "Bạn bị xử thua",
  score: (n) => `+${n} điểm xếp hạng`,
  backToLobby: "Về phòng chờ",
  watching: "Bạn đang xem trận đấu",
  detail: (l, m) => `Thắng máy ${vi.level[l]} · hơn ${m} điểm`,
  matchDetail: (w, a, b, t) => `${w ? "Thắng" : "Thua"} ${a}–${b} với ${cut(t, 16)}`,
  summary: (l, w) => `Đã thắng máy ${vi.level[l]} ${w} lần`,
};

const en: Strings = {
  title: "Ô Ăn Quan",
  subtitle: "The Vietnamese folk game: sow the pebbles, take the quan",
  vsAi: "Play the computer",
  hotseat: "2 players, 1 phone",
  hotseatHint: "Take turns on the same phone",
  level: { easy: "Easy", normal: "Normal", hard: "Hard" },
  theme: "Theme",
  themes: { "san-gach": "Courtyard", "son-mai": "Lacquer", "dong-ho": "Folk print" },
  quanNon: "Young quan",
  quanNonValue: (forbid) => (forbid ? "Not until 5" : "Can be taken"),
  rules: "How to play",
  rulesLines: [
    "Each small pit starts with 5 pebbles, each end pit with one quan. A pebble is 1 point, a quan 10.",
    "On your turn, take every pebble from one of your pits, pick a way round and drop one in each pit.",
    "Next pit holds pebbles: pick them up and keep sowing. Next is an end pit with stones: your turn ends.",
    "Next pit is empty: capture the pit after it, and again for each 'empty, then full' that follows. Two empties in a row: nothing.",
    "Your row is empty: put 5 captured pebbles back, one per pit; short, and you borrow from your opponent and repay at the end.",
    "Both end pits empty: each side keeps the pebbles in its row. Most points wins.",
    "Young quan rule (optional): an end pit can only be captured once it holds 5 pebbles.",
  ],
  close: "Close",
  you: "You",
  ai: (l) => `Computer (${en.level[l]})`,
  player: (n) => `Player ${n}`,
  yourTurn: "Tap one of your pits to pick it up",
  pickDir: "Pick a direction",
  aiThinking: "The computer is thinking…",
  turnOf: (n) => `${cut(n, 16)}'s turn`,
  newGame: "New game",
  menu: "Menu",
  points: (n) => `${n} pts`,
  debt: (n) => `owes ${n}`,
  youWin: "You win!",
  youLose: "The computer wins",
  winOf: (n) => `${cut(n, 16)} wins!`,
  draw: "Draw",
  finalLine: (a, b) => `${a} – ${b} points`,
  winLine: (m, s) => `Ahead by ${m} · +${s} ranking points`,
  again: "Play again",
  wins: (n) => `${n} ${n === 1 ? "win" : "wins"}`,
  quanTaken: "Quan taken!",
  captured: (n) => `+${n}`,
  youngQuan: "Too young to take",
  refill: (n, b) => (b > 0 ? `${cut(n, 14)} ran out: refill, borrowing ${b}` : `${cut(n, 14)} ran out: refill 5`),
  sweep: "Both quan gone: count up!",
  gameN: (n) => `Game ${n}`,
  firstTo: (w) => (w === 1 ? "One game decides it" : `First to ${w} games wins`),
  firstMove: (n) => `${cut(n, 14)} goes first`,
  away: (n, s) => `${cut(n, 14)} disconnected… ${s}s`,
  timedOut: "Time's up: a move was played for you",
  matchWin: "You won the match!",
  matchLose: "You lost the match",
  matchDraw: "Match drawn",
  forfeitWin: "Your opponent forfeited",
  forfeitLose: "You forfeited",
  score: (n) => `+${n} ranking points`,
  backToLobby: "Back to lobby",
  watching: "You're watching this match",
  detail: (l, m) => `Beat ${en.level[l]} by ${m}`,
  matchDetail: (w, a, b, t) => `${w ? "Won" : "Lost"} ${a}–${b} vs ${cut(t, 16)}`,
  summary: (l, w) => `Beat ${en.level[l]} ${w}×`,
};

export const STRINGS: Localized<Strings> = { vi, en };
