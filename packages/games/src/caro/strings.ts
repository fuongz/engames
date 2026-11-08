import type { Localized } from "@web-games/core/i18n";
import type { Difficulty } from "./config";

// Every player-visible line. game.ts resolves these at draw time, so switching
// language in the portal shows on the next frame.

export interface Strings {
  title: string;
  subtitle: string;
  vsAi: string;
  hotseat: string;
  hotseatHint: string;
  level: Record<Difficulty, string>;
  rules: string;
  rulesLines: string[];
  close: string;
  you: string;
  ai: (level: Difficulty) => string;
  player: (mark: "X" | "O") => string;
  yourTurn: string;
  aiThinking: string;
  turnOf: (name: string) => string;
  tapToPick: string;
  tapAgain: string;
  undo: string;
  zoomIn: string;
  zoomOut: string;
  newGame: string;
  menu: string;
  youWin: string;
  youLose: string;
  winOf: (name: string) => string;
  draw: string;
  winLine: (moves: number, score: number) => string;
  loseLine: string;
  again: string;
  tally: (a: number, b: number) => string;
  wins: (n: number) => string;
  // online
  gameN: (n: number) => string;
  firstTo: string;
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
  detail: (level: Difficulty, moves: number) => string;
  matchDetail: (won: boolean, a: number, b: number, them: string) => string;
  summary: (level: Difficulty, wins: number) => string;
}

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export const STRINGS: Localized<Strings> = {
  vi: {
    title: "CARO",
    subtitle: "5 ô liền là thắng · chặn 2 đầu",
    vsAi: "Đấu với máy",
    hotseat: "2 người 1 máy",
    hotseatHint: "Thay nhau chạm trên cùng một máy",
    level: { easy: "Dễ", normal: "Vừa", hard: "Khó" },
    rules: "Luật chơi",
    rulesLines: [
      "X đi trước, hai bên thay nhau đánh vào một ô trống.",
      "Ai có 5 dấu liền nhau (ngang, dọc hoặc chéo) là thắng.",
      "Chặn 2 đầu: hàng 5 bị đối thủ chặn cả hai đầu thì không tính.",
      "Chạm một ô để chọn, chạm lần nữa để đánh.",
      "Kéo một ngón để di chuyển bàn, chụm hai ngón hoặc nút kính lúp để phóng to.",
      "Online: thắng 2 ván trước, mỗi lượt 30 giây.",
    ],
    close: "Đã hiểu",
    you: "Bạn",
    ai: (level) => `Máy · ${STRINGS.vi.level[level]}`,
    player: (mark) => `Người ${mark}`,
    yourTurn: "Lượt của bạn",
    aiThinking: "Máy đang nghĩ...",
    turnOf: (name) => `Lượt của ${name}`,
    tapToPick: "Chạm một ô để chọn",
    tapAgain: "Chạm lần nữa để đánh",
    undo: "Đi lại",
    zoomIn: "Phóng to",
    zoomOut: "Thu nhỏ",
    newGame: "Ván mới",
    menu: "Menu",
    youWin: "Bạn thắng!",
    youLose: "Máy thắng",
    winOf: (name) => `${name} thắng!`,
    draw: "Hoà!",
    winLine: (moves, score) => `${moves} nước · ${score} điểm`,
    loseLine: "Thử lại nhé, máy cũng có lúc sơ hở",
    again: "Chơi lại",
    tally: (a, b) => `${a} – ${b}`,
    wins: (n) => `Thắng ${n}`,
    gameN: (n) => `Ván ${n}`,
    firstTo: "Thắng 2 ván trước",
    firstMove: (name) => `${name} đi trước`,
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
    detail: (level, moves) => `Thắng máy ${STRINGS.vi.level[level]} · ${moves} nước`,
    matchDetail: (won, a, b, them) => cut(`${won ? "Thắng" : "Thua"} ${a}–${b} với ${them}`, 40),
    summary: (level, wins) => `Thắng máy ${STRINGS.vi.level[level]} ${wins} lần`,
  },
  en: {
    title: "CARO",
    subtitle: "Five in a row wins · not if blocked both ends",
    vsAi: "Play the computer",
    hotseat: "2 players, 1 phone",
    hotseatHint: "Take turns tapping on the same device",
    level: { easy: "Easy", normal: "Normal", hard: "Hard" },
    rules: "How to play",
    rulesLines: [
      "X goes first; take turns marking an empty square.",
      "Five of your marks in a row (across, down or diagonal) wins.",
      "Blocked both ends: a five your opponent has capped at both ends doesn't count.",
      "Tap a square to pick it, tap it again to play.",
      "Drag one finger to move the board; pinch or use the magnifier to zoom.",
      "Online: first to win 2 games, 30 seconds a turn.",
    ],
    close: "Got it",
    you: "You",
    ai: (level) => `CPU · ${STRINGS.en.level[level]}`,
    player: (mark) => `Player ${mark}`,
    yourTurn: "Your turn",
    aiThinking: "CPU is thinking...",
    turnOf: (name) => `${name}'s turn`,
    tapToPick: "Tap a square to pick it",
    tapAgain: "Tap again to play",
    undo: "Undo",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    newGame: "New game",
    menu: "Menu",
    youWin: "You win!",
    youLose: "The CPU wins",
    winOf: (name) => `${name} wins!`,
    draw: "Draw!",
    winLine: (moves, score) => `${moves} moves · ${score} pts`,
    loseLine: "Try again, the CPU slips up too",
    again: "Play again",
    tally: (a, b) => `${a} – ${b}`,
    wins: (n) => `${n} ${n === 1 ? "win" : "wins"}`,
    gameN: (n) => `Game ${n}`,
    firstTo: "First to 2 games",
    firstMove: (name) => `${name} goes first`,
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
    detail: (level, moves) => `Beat ${STRINGS.en.level[level]} CPU · ${moves} moves`,
    matchDetail: (won, a, b, them) => cut(`${won ? "Won" : "Lost"} ${a}–${b} vs ${them}`, 40),
    summary: (level, wins) => `Beat ${STRINGS.en.level[level]} CPU ${wins}×`,
  },
};
