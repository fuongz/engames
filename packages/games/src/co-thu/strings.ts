import type { Localized } from "@web-games/core/i18n";
import type { Difficulty } from "./config";

// Every player-visible line. game.ts resolves these at draw time, so switching
// language in the portal shows on the next frame.

export interface Strings {
  title: string;
  subtitle: string;
  vsAi: string;
  playAs: string;
  red: string;
  blue: string;
  redFirst: string;
  hotseat: string;
  hotseatHint: string;
  level: Record<Difficulty, string>;
  /** Animal names by rank (index 1..8). */
  animals: string[];
  legend: string;
  legendRanks: string;
  legendRules: string[];
  close: string;
  you: string;
  ai: (level: Difficulty) => string;
  side: (red: boolean) => string;
  yourTurn: string;
  aiThinking: string;
  turnOf: (name: string) => string;
  tapPiece: string;
  tapTarget: string;
  newGame: string;
  menu: string;
  youWin: string;
  youLose: string;
  winOf: (name: string) => string;
  draw: string;
  reason: Record<"den" | "wipe" | "stuck" | "quiet" | "repeat", string>;
  winLine: (moves: number, score: number) => string;
  loseLine: string;
  again: string;
  wins: (n: number) => string;
  lost: string;
  noWebgl: string;
  detail: (level: Difficulty, moves: number) => string;
  summary: (level: Difficulty, wins: number) => string;
  // Online
  resign: string;
  resignSure: string;
  waitingFor: (name: string) => string;
  awayLine: (name: string, secs: number) => string;
  autoMoved: (name: string) => string;
  backToLobby: string;
  resigned: (name: string) => string;
  timedOut: (name: string) => string;
  left: (name: string) => string;
  matchDetail: (outcome: "win" | "loss" | "draw", moves: number, opponent: string) => string;
}

export const STRINGS: Localized<Strings> = {
  vi: {
    title: "CỜ THÚ",
    subtitle: "Đưa một con thú vào hang đối thủ là thắng",
    vsAi: "Đấu với máy",
    playAs: "Chọn phe",
    red: "Đỏ",
    blue: "Xanh",
    redFirst: "Đỏ đi trước",
    hotseat: "Hai người một máy",
    hotseatHint: "Thay nhau chạm, bàn cờ tự xoay về phía người đi",
    level: { easy: "Dễ", normal: "Thường", hard: "Khó" },
    animals: ["", "Chuột", "Mèo", "Chó", "Sói", "Báo", "Hổ", "Sư tử", "Voi"],
    legend: "Luật chơi",
    legendRanks: "Thú lớn ăn thú nhỏ hơn hoặc bằng",
    legendRules: [
      "Mỗi lượt đi một ô ngang hoặc dọc.",
      "Chuột ăn được Voi; Voi không ăn được Chuột.",
      "Chỉ Chuột được xuống nước. Chuột dưới nước không ăn được thú trên bờ, và ngược lại.",
      "Sư tử, Hổ nhảy qua ao, trừ khi có Chuột chắn dưới nước.",
      "Thú địch đứng trong bẫy của bạn: con nào của bạn cũng ăn được.",
      "Không được vào hang mình. Vào hang đối thủ là thắng.",
      "200 nước không ai ăn quân, hoặc một thế cờ lặp 3 lần: hoà.",
    ],
    close: "Đã hiểu",
    you: "Bạn",
    ai: (level) => `Máy (${STRINGS.vi.level[level]})`,
    side: (red) => (red ? "Phe Đỏ" : "Phe Xanh"),
    yourTurn: "Lượt của bạn",
    aiThinking: "Máy đang nghĩ...",
    turnOf: (name) => `Lượt của ${name}`,
    tapPiece: "Chạm một con thú để chọn",
    tapTarget: "Chạm ô sáng để đi",
    newGame: "Ván mới",
    menu: "Menu",
    youWin: "Bạn thắng!",
    youLose: "Máy thắng",
    winOf: (name) => `${name} thắng!`,
    draw: "Hoà!",
    reason: {
      den: "Đã vào hang",
      wipe: "Hết quân",
      stuck: "Hết nước đi",
      quiet: "200 nước không ăn quân",
      repeat: "Thế cờ lặp lại 3 lần",
    },
    winLine: (moves, score) => `${moves} nước, ${score} điểm`,
    loseLine: "Thử lại nhé, canh chừng hang của mình",
    again: "Chơi lại",
    wins: (n) => `Thắng ${n}`,
    lost: "Bị ăn",
    noWebgl: "Máy này chưa hiển thị được bàn cờ 3D (WebGL).",
    detail: (level, moves) => `Thắng máy ${STRINGS.vi.level[level]}, ${moves} nước`,
    summary: (level, wins) => `Thắng máy ${STRINGS.vi.level[level]} ${wins} lần`,
    resign: "Xin thua",
    resignSure: "Chắc chưa?",
    waitingFor: (name) => `Chờ ${name} đi...`,
    awayLine: (name, secs) => `${name} mất kết nối, còn ${secs} giây`,
    autoMoved: (name) => `${name} hết giờ, máy đi hộ`,
    backToLobby: "Về phòng chờ",
    resigned: (name) => `${name} xin thua`,
    timedOut: (name) => `${name} hết giờ 3 lượt liền`,
    left: (name) => `${name} rời trận quá lâu`,
    matchDetail: (outcome, moves, opponent) =>
      `${outcome === "win" ? "Thắng" : outcome === "loss" ? "Thua" : "Hoà"} ${opponent || "đối thủ"} online, ${moves} nước`,
  },
  en: {
    title: "ANIMAL CHESS",
    subtitle: "Walk any animal into the enemy den to win",
    vsAi: "Play the computer",
    playAs: "Play as",
    red: "Red",
    blue: "Blue",
    redFirst: "Red moves first",
    hotseat: "2 players, 1 phone",
    hotseatHint: "Take turns; the board turns to face whoever moves",
    level: { easy: "Easy", normal: "Normal", hard: "Hard" },
    animals: ["", "Rat", "Cat", "Dog", "Wolf", "Leopard", "Tiger", "Lion", "Elephant"],
    legend: "How to play",
    legendRanks: "Bigger animals take smaller or equal ones",
    legendRules: [
      "Each turn, move one square across or down.",
      "The Rat takes the Elephant; the Elephant can't take the Rat.",
      "Only the Rat may swim. A swimming Rat can't take an animal on land, nor the other way round.",
      "The Lion and Tiger leap across a pond unless a Rat is in the way.",
      "An enemy standing in one of your traps can be taken by any of your animals.",
      "You can't enter your own den. Enter the enemy den to win.",
      "200 moves without a capture, or the same position 3 times: a draw.",
    ],
    close: "Got it",
    you: "You",
    ai: (level) => `CPU (${STRINGS.en.level[level]})`,
    side: (red) => (red ? "Red" : "Blue"),
    yourTurn: "Your turn",
    aiThinking: "CPU is thinking...",
    turnOf: (name) => `${name}'s turn`,
    tapPiece: "Tap an animal to pick it",
    tapTarget: "Tap a lit square to move",
    newGame: "New game",
    menu: "Menu",
    youWin: "You win!",
    youLose: "The CPU wins",
    winOf: (name) => `${name} wins!`,
    draw: "Draw!",
    reason: {
      den: "Into the den",
      wipe: "No animals left",
      stuck: "No moves left",
      quiet: "200 moves without a capture",
      repeat: "Same position 3 times",
    },
    winLine: (moves, score) => `${moves} moves, ${score} pts`,
    loseLine: "Try again, and guard your den",
    again: "Play again",
    wins: (n) => `${n} ${n === 1 ? "win" : "wins"}`,
    lost: "Lost",
    noWebgl: "This device can't show the 3D board (WebGL).",
    detail: (level, moves) => `Beat ${STRINGS.en.level[level]} CPU, ${moves} moves`,
    summary: (level, wins) => `Beat ${STRINGS.en.level[level]} CPU ${wins} times`,
    resign: "Resign",
    resignSure: "Sure?",
    waitingFor: (name) => `Waiting for ${name}...`,
    awayLine: (name, secs) => `${name} dropped out, ${secs} s to return`,
    autoMoved: (name) => `${name} ran out of time, a move was played`,
    backToLobby: "Back to lobby",
    resigned: (name) => `${name} resigned`,
    timedOut: (name) => `${name} timed out 3 turns in a row`,
    left: (name) => `${name} was away too long`,
    matchDetail: (outcome, moves, opponent) =>
      `${outcome === "win" ? "Beat" : outcome === "loss" ? "Lost to" : "Drew with"} ${opponent || "a friend"} online, ${moves} moves`,
  },
};
