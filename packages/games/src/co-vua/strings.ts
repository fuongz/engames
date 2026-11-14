import type { Localized } from "@web-games/core/i18n";
import type { ColorChoice, Difficulty } from "./config";
import type { EndReason } from "./logic";

// Every player-visible line. game.ts resolves these at draw time, so switching
// language in the portal shows on the next frame.

export interface Strings {
  title: string;
  subtitle: string;
  vsAi: string;
  playAs: string;
  colorChoice: Record<ColorChoice, string>;
  hotseat: string;
  hotseatHint: string;
  level: Record<Difficulty, string>;
  rules: string;
  rulesLines: string[];
  close: string;
  you: string;
  ai: (level: Difficulty) => string;
  /** "White" / "Black" as a side's name. */
  side: (white: boolean) => string;
  yourTurn: string;
  aiThinking: string;
  turnOf: (name: string) => string;
  tapPiece: string;
  tapTarget: string;
  check: string;
  undo: string;
  flip: string;
  newGame: string;
  menu: string;
  promoteTo: string;
  cancel: string;
  /** Piece letters for the move list, by the English SAN letter (K Q R B N). */
  letters: Record<string, string>;
  youWin: string;
  youLose: string;
  winOf: (name: string) => string;
  draw: string;
  reason: Record<EndReason, string>;
  resignedBy: (name: string) => string;
  leftBy: (name: string) => string;
  winLine: (moves: number, score: number) => string;
  loseLine: string;
  again: string;
  wins: (n: number) => string;
  // online
  resign: string;
  sure: string;
  offerDraw: string;
  offered: string;
  theyOffer: (name: string) => string;
  accept: string;
  decline: string;
  declined: (name: string) => string;
  away: (name: string, seconds: number) => string;
  matchWin: string;
  matchLose: string;
  score: (n: number) => string;
  backToLobby: string;
  watching: string;
  // board text
  detail: (level: Difficulty, moves: number) => string;
  matchDetail: (outcome: "win" | "loss" | "draw", reason: EndReason, them: string) => string;
  summary: (level: Difficulty, wins: number) => string;
}

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export const STRINGS: Localized<Strings> = {
  vi: {
    title: "CỜ VUA",
    subtitle: "Chiếu hết vua đối phương để thắng",
    vsAi: "Đấu với máy",
    playAs: "Bạn cầm quân",
    colorChoice: { white: "Trắng", random: "Ngẫu nhiên", black: "Đen" },
    hotseat: "2 người 1 máy",
    hotseatHint: "Thay nhau đi trên cùng một máy",
    level: { easy: "Dễ", normal: "Vừa", hard: "Khó" },
    rules: "Luật chơi",
    rulesLines: [
      "Trắng đi trước. Chạm một quân để thấy các ô đi được, rồi chạm ô muốn đi.",
      "Chiếu hết vua đối phương là thắng.",
      "Có nhập thành, bắt tốt qua đường; tốt đến hàng cuối được phong Hậu, Xe, Tượng hoặc Mã.",
      "Hoà khi: hết nước đi mà không bị chiếu, thế cờ lặp lại 3 lần, 50 nước không ăn quân hay đi tốt, hoặc không đủ quân chiếu hết.",
      "Đấu máy: Đi lại rút nước của bạn và nước máy vừa đi (3 lần mỗi ván). Thắng nhanh được thêm điểm.",
      "Online: không tính giờ; được xin thua hoặc cầu hoà; rời phòng quá 60 giây là thua.",
    ],
    close: "Đã hiểu",
    you: "Bạn",
    ai: (level) => `Máy (${STRINGS.vi.level[level]})`,
    side: (white) => (white ? "Quân Trắng" : "Quân Đen"),
    yourTurn: "Lượt của bạn",
    aiThinking: "Máy đang nghĩ...",
    turnOf: (name) => `Lượt của ${name}`,
    tapPiece: "Chạm một quân để chọn",
    tapTarget: "Chạm ô có chấm để đi",
    check: "Chiếu tướng!",
    undo: "Đi lại",
    flip: "Xoay bàn",
    newGame: "Ván mới",
    menu: "Menu",
    promoteTo: "Phong cấp thành",
    cancel: "Huỷ",
    letters: { K: "V", Q: "H", R: "X", B: "T", N: "M" },
    youWin: "Bạn thắng!",
    youLose: "Máy thắng",
    winOf: (name) => `${name} thắng!`,
    draw: "Hoà!",
    reason: {
      mate: "Chiếu hết",
      stalemate: "Hết nước đi (hoà pat)",
      repetition: "Lặp lại thế cờ 3 lần",
      fifty: "Luật 50 nước",
      material: "Không đủ quân chiếu hết",
      resign: "Xin thua",
      agreement: "Hai bên đồng ý hoà",
      forfeit: "Rời phòng quá lâu",
    },
    resignedBy: (name) => `${name} xin thua`,
    leftBy: (name) => `${name} rời phòng quá lâu`,
    winLine: (moves, score) => `${moves} nước, ${score} điểm`,
    loseLine: "Thử lại nhé, máy cũng có lúc sơ hở",
    again: "Chơi lại",
    wins: (n) => `Thắng ${n}`,
    resign: "Xin thua",
    sure: "Chắc chưa?",
    offerDraw: "Cầu hoà",
    offered: "Đã cầu hoà",
    theyOffer: (name) => `${name} cầu hoà`,
    accept: "Đồng ý",
    decline: "Từ chối",
    declined: (name) => `${name} không đồng ý hoà`,
    away: (name, s) => `${name} mất kết nối, còn ${s} giây`,
    matchWin: "Bạn thắng!",
    matchLose: "Bạn thua",
    score: (n) => `${n} điểm`,
    backToLobby: "Về phòng",
    watching: "Đang xem",
    detail: (level, moves) => `Thắng máy ${STRINGS.vi.level[level]}, ${moves} nước`,
    matchDetail: (outcome, reason, them) =>
      cut(`${outcome === "win" ? "Thắng" : outcome === "loss" ? "Thua" : "Hoà"} ${them} (${STRINGS.vi.reason[reason]})`, 40),
    summary: (level, wins) => `Thắng máy ${STRINGS.vi.level[level]} ${wins} lần`,
  },
  en: {
    title: "CHESS",
    subtitle: "Checkmate the other king to win",
    vsAi: "Play the computer",
    playAs: "You play",
    colorChoice: { white: "White", random: "Random", black: "Black" },
    hotseat: "2 players, 1 phone",
    hotseatHint: "Take turns on the same device",
    level: { easy: "Easy", normal: "Normal", hard: "Hard" },
    rules: "How to play",
    rulesLines: [
      "White moves first. Tap a piece to see where it can go, then tap a square to move.",
      "Checkmate the other king to win.",
      "Castling and en passant are in; a pawn reaching the last rank becomes a queen, rook, bishop or knight.",
      "Draws: no legal move while not in check, the same position three times, 50 moves without a capture or pawn move, or too little material to mate.",
      "Against the computer: Undo takes back your move and its reply (3 per game). Quick wins score more.",
      "Online: no clock; you can resign or offer a draw; being away for over 60 seconds loses.",
    ],
    close: "Got it",
    you: "You",
    ai: (level) => `CPU (${STRINGS.en.level[level]})`,
    side: (white) => (white ? "White" : "Black"),
    yourTurn: "Your move",
    aiThinking: "CPU is thinking...",
    turnOf: (name) => `${name} to move`,
    tapPiece: "Tap a piece to pick it",
    tapTarget: "Tap a dotted square to move",
    check: "Check!",
    undo: "Undo",
    flip: "Flip",
    newGame: "New game",
    menu: "Menu",
    promoteTo: "Promote to",
    cancel: "Cancel",
    letters: { K: "K", Q: "Q", R: "R", B: "B", N: "N" },
    youWin: "You win!",
    youLose: "The CPU wins",
    winOf: (name) => `${name} wins!`,
    draw: "Draw!",
    reason: {
      mate: "Checkmate",
      stalemate: "Stalemate",
      repetition: "Threefold repetition",
      fifty: "Fifty-move rule",
      material: "Not enough material to mate",
      resign: "Resigned",
      agreement: "Draw agreed",
      forfeit: "Left the game",
    },
    resignedBy: (name) => `${name} resigned`,
    leftBy: (name) => `${name} left the game`,
    winLine: (moves, score) => `${moves} moves, ${score} pts`,
    loseLine: "Try again, the CPU slips up too",
    again: "Play again",
    wins: (n) => `${n} ${n === 1 ? "win" : "wins"}`,
    resign: "Resign",
    sure: "Sure?",
    offerDraw: "Offer draw",
    offered: "Draw offered",
    theyOffer: (name) => `${name} offers a draw`,
    accept: "Accept",
    decline: "Decline",
    declined: (name) => `${name} declined the draw`,
    away: (name, s) => `${name} disconnected, ${s}s left`,
    matchWin: "You win!",
    matchLose: "You lost",
    score: (n) => `${n} pts`,
    backToLobby: "Back to room",
    watching: "Watching",
    detail: (level, moves) => `Beat ${STRINGS.en.level[level]} CPU, ${moves} moves`,
    matchDetail: (outcome, reason, them) =>
      cut(`${outcome === "win" ? "Beat" : outcome === "loss" ? "Lost to" : "Drew"} ${them} (${STRINGS.en.reason[reason]})`, 40),
    summary: (level, wins) => `Beat ${STRINGS.en.level[level]} CPU ${wins}×`,
  },
};
