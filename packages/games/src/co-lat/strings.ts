import type { Localized } from "@web-games/core/i18n";
import type { Difficulty } from "./config";

// Every player-visible line. game.ts resolves these at draw time, so switching
// language in the portal shows on the next frame.

type Colour = 1 | 2;

export interface Strings {
  /** The title, one line per entry (drawn on the menu and the poster). */
  title: string[];
  subtitle: string;
  vsAi: string;
  playAs: string;
  colour: Record<Colour, string>;
  firstNote: string;
  hotseat: string;
  hotseatHint: string;
  level: Record<Difficulty, string>;
  rules: string;
  rulesLines: string[];
  close: string;
  you: string;
  ai: (level: Difficulty) => string;
  player: (c: Colour) => string;
  yourTurn: string;
  aiThinking: string;
  turnOf: (name: string) => string;
  pass: (name: string) => string;
  undo: string;
  hints: string;
  newGame: string;
  menu: string;
  youWin: string;
  youLose: string;
  winOf: (name: string) => string;
  draw: string;
  discs: (a: number, b: number) => string;
  winLine: (a: number, b: number, score: number) => string;
  loseLine: (a: number, b: number) => string;
  again: string;
  wins: (n: number) => string;
  // online
  gameN: (n: number) => string;
  firstTo: (wins: number) => string;
  playsBlack: (name: string) => string;
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
  detail: (level: Difficulty, a: number, b: number) => string;
  matchDetail: (won: boolean, a: number, b: number, them: string) => string;
  summary: (level: Difficulty, wins: number) => string;
}

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export const STRINGS: Localized<Strings> = {
  vi: {
    title: ["CỜ LẬT"],
    subtitle: "Kẹp quân đối thủ để lật thành quân mình",
    vsAi: "Đấu với máy",
    playAs: "Bạn cầm",
    colour: { 1: "Đen", 2: "Trắng" },
    firstNote: "Đen đi trước",
    hotseat: "2 người 1 máy",
    hotseatHint: "Thay nhau chạm trên cùng một máy",
    level: { easy: "Dễ", normal: "Vừa", hard: "Khó" },
    rules: "Luật chơi",
    rulesLines: [
      "Bàn 8 × 8, mở đầu với 4 quân ở giữa. Đen đi trước.",
      "Đặt quân sao cho kẹp được một hàng quân đối thủ (ngang, dọc hoặc chéo) giữa quân vừa đặt và một quân của mình.",
      "Mọi hàng bị kẹp đều lật sang màu của bạn, cùng lúc theo cả 8 hướng.",
      "Không có nước hợp lệ thì mất lượt. Cả hai cùng hết nước thì ván kết thúc.",
      "Ai nhiều quân hơn thắng; bằng nhau là hoà. Chấm mờ là các ô đi được.",
      "Online: chủ phòng chọn Bo1, Bo3 hoặc Bo5, đổi màu mỗi ván; mỗi lượt 30 giây.",
    ],
    close: "Đã hiểu",
    you: "Bạn",
    ai: (level) => `Máy · ${STRINGS.vi.level[level]}`,
    player: (c) => `Bên ${STRINGS.vi.colour[c]}`,
    yourTurn: "Lượt của bạn · chạm ô có chấm",
    aiThinking: "Máy đang nghĩ...",
    turnOf: (name) => `Lượt của ${name}`,
    pass: (name) => `${name}: không còn nước đi — mất lượt`,
    undo: "Đi lại",
    hints: "Gợi ý",
    newGame: "Ván mới",
    menu: "Menu",
    youWin: "Bạn thắng!",
    youLose: "Máy thắng",
    winOf: (name) => `${name} thắng!`,
    draw: "Hoà!",
    discs: (a, b) => `${a} – ${b} quân`,
    winLine: (a, b, score) => `${a} – ${b} quân · ${score} điểm`,
    loseLine: (a, b) => `${a} – ${b} quân · thử lại nhé`,
    again: "Chơi lại",
    wins: (n) => `Thắng ${n}`,
    gameN: (n) => `Ván ${n}`,
    firstTo: (n) => (n === 1 ? "Một ván phân thắng thua" : `Ai thắng ${n} ván trước thắng trận`),
    playsBlack: (name) => `${name} cầm Đen, đi trước`,
    away: (name, s) => `${name} mất kết nối · còn ${s} giây`,
    timedOut: "Hết giờ, máy đánh hộ",
    matchWin: "Bạn thắng trận!",
    matchLose: "Bạn thua trận",
    matchDraw: "Hoà trận",
    forfeitWin: "Đối thủ bỏ cuộc",
    forfeitLose: "Bạn bị xử thua",
    score: (n) => `${n} điểm`,
    backToLobby: "Về phòng",
    watching: "Đang xem",
    detail: (level, a, b) => `Thắng máy ${STRINGS.vi.level[level]} · ${a}–${b} quân`,
    matchDetail: (won, a, b, them) => cut(`${won ? "Thắng" : "Thua"} ${a}–${b} với ${them}`, 40),
    summary: (level, wins) => `Thắng máy ${STRINGS.vi.level[level]} ${wins} lần`,
  },
  en: {
    title: ["REVERSI"],
    subtitle: "Trap your rival's discs to flip them",
    vsAi: "Play the computer",
    playAs: "You play",
    colour: { 1: "Black", 2: "White" },
    firstNote: "Black moves first",
    hotseat: "2 players, 1 phone",
    hotseatHint: "Take turns tapping on the same device",
    level: { easy: "Easy", normal: "Normal", hard: "Hard" },
    rules: "How to play",
    rulesLines: [
      "An 8 × 8 board starting with 4 discs in the middle. Black moves first.",
      "Place a disc so a line of your rival's discs (across, down or diagonal) is trapped between it and another of yours.",
      "Every trapped line flips to your colour, in all 8 directions at once.",
      "No legal move? You pass. When neither side can move, the game ends.",
      "Most discs wins; equal is a draw. Faint dots show where you can play.",
      "Online: the host picks best of 1, 3 or 5, colours swap each game; 30 seconds a turn.",
    ],
    close: "Got it",
    you: "You",
    ai: (level) => `CPU · ${STRINGS.en.level[level]}`,
    player: (c) => STRINGS.en.colour[c],
    yourTurn: "Your turn · tap a dotted square",
    aiThinking: "CPU is thinking...",
    turnOf: (name) => `${name}'s turn`,
    pass: (name) => `${name}: no legal move, turn passes`,
    undo: "Undo",
    hints: "Hints",
    newGame: "New game",
    menu: "Menu",
    youWin: "You win!",
    youLose: "The CPU wins",
    winOf: (name) => `${name} wins!`,
    draw: "Draw!",
    discs: (a, b) => `${a} – ${b} discs`,
    winLine: (a, b, score) => `${a} – ${b} discs · ${score} pts`,
    loseLine: (a, b) => `${a} – ${b} discs · try again`,
    again: "Play again",
    wins: (n) => `${n} ${n === 1 ? "win" : "wins"}`,
    gameN: (n) => `Game ${n}`,
    firstTo: (n) => (n === 1 ? "One game decides it" : `First to ${n} games wins`),
    playsBlack: (name) => `${name} ${name === "You" ? "play" : "plays"} Black and moves first`,
    away: (name, s) => `${name} disconnected · ${s}s left`,
    timedOut: "Time's up, a move was played for you",
    matchWin: "You win the match!",
    matchLose: "You lost the match",
    matchDraw: "Match drawn",
    forfeitWin: "Your opponent left",
    forfeitLose: "You forfeited",
    score: (n) => `${n} pts`,
    backToLobby: "Back to room",
    watching: "Watching",
    detail: (level, a, b) => `Beat ${STRINGS.en.level[level]} CPU · ${a}–${b}`,
    matchDetail: (won, a, b, them) => cut(`${won ? "Won" : "Lost"} ${a}–${b} vs ${them}`, 40),
    summary: (level, wins) => `Beat ${STRINGS.en.level[level]} CPU ${wins}×`,
  },
};
