import type { Localized } from "@web-games/core/i18n";
import type { Difficulty } from "./config";

// Every player-visible line. game.ts resolves these at draw time, so switching
// language in the portal shows on the next frame.

export interface Strings {
  title: string;
  subtitle: string;
  players: string;
  people: string;
  peopleHint: (people: number, total: number) => string;
  computer: string;
  level: Record<Difficulty, string>;
  start: string;
  resume: string;
  rules: string;
  rulesLines: string[];
  close: string;
  /** By corner: 0 bottom-left, then clockwise. */
  color: string[];
  you: string;
  cpu: string;
  person: (n: number) => string;
  roll: string;
  yourRoll: string;
  pickDie: string;
  pickHorse: (die: number) => string;
  turnOf: (name: string) => string;
  firstTurn: (name: string) => string;
  doubles: string;
  noMove: string;
  noMoveDoubles: string;
  threeDoubles: string;
  lost: (die: number) => string;
  captured: (victim: string) => string;
  capturedYou: (by: string) => string;
  home: string;
  place: (n: number) => string;
  finished: (name: string, place: number) => string;
  youPlaced: (place: number) => string;
  wins: (name: string) => string;
  homeCount: (n: number) => string;
  again: string;
  newGame: string;
  menu: string;
  score: (n: number) => string;
  loseLine: string;
  // online
  timedOut: string;
  away: string;
  idle: string;
  backToLobby: string;
  watching: string;
  // board text
  detail: (level: Difficulty, total: number) => string;
  placeDetail: (place: number, total: number) => string;
  summary: (level: Difficulty, wins: number) => string;
}

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const VI_PLACE = ["nhất", "nhì", "ba", "tư"];
const EN_PLACE = ["1st", "2nd", "3rd", "4th"];

export const STRINGS: Localized<Strings> = {
  vi: {
    title: "Cờ Cá Ngựa",
    subtitle: "Hai xí ngầu · ra 6 mới xuất ngựa · đưa cả 4 về đích",
    players: "Số người chơi",
    people: "Người chơi trên máy này",
    peopleHint: (p, n) => (p === n ? "Thay nhau gieo trên cùng một máy" : p === 1 ? `Bạn và ${n - 1} máy` : `${p} người, ${n - p} máy`),
    computer: "Máy chơi",
    level: { easy: "Dễ", normal: "Vừa", hard: "Khó" },
    start: "Bắt đầu",
    resume: "Chơi tiếp",
    rules: "Luật chơi",
    rulesLines: [
      "Mỗi lượt gieo hai xí ngầu, đi từng xí ngầu một: chạm xí ngầu, rồi chạm con ngựa (cùng con hay con khác).",
      "Xí ngầu ra 6 mới xuất được một ngựa khỏi chuồng.",
      "Đi theo chiều kim đồng hồ, hết một vòng thì rẽ vào đường về đích.",
      "Đổ đôi được gieo thêm; ba lần đôi liền thì mất lượt.",
      "Đứng trúng ngựa đối thủ là đá nó về chuồng, trừ ô xuất phát và ô ngôi sao.",
      "Về đích phải đúng số. Đi được cả hai xí ngầu thì phải đi cả hai; xí ngầu không đi được thì bỏ.",
      "Ai đưa đủ 4 ngựa về đích trước thì về nhất; người còn lại chơi tiếp tranh hạng.",
      "Online: mỗi lượt 20 giây; hết giờ hoặc mất kết nối thì máy đi thay.",
    ],
    close: "Đã hiểu",
    color: ["Đỏ", "Xanh lá", "Vàng", "Xanh dương"],
    you: "Bạn",
    cpu: "Máy",
    person: (n) => `Người ${n}`,
    roll: "Gieo",
    yourRoll: "Lượt của bạn · chạm xí ngầu để gieo",
    pickDie: "Chọn xí ngầu rồi chạm con ngựa",
    pickHorse: (d) => `Đi ${d} · chạm con ngựa đang sáng`,
    turnOf: (name) => `Lượt của ${name}`,
    firstTurn: (name) => `${name} đi trước`,
    doubles: "Đổ đôi · được gieo thêm!",
    noMove: "Không đi được · mất lượt",
    noMoveDoubles: "Không đi được · đổ đôi nên gieo tiếp",
    threeDoubles: "Ba lần đôi liền · mất lượt!",
    lost: (d) => `Xí ngầu ${d} không đi được`,
    captured: (v) => `Đá ngựa ${v} về chuồng!`,
    capturedYou: (by) => `${by} đá ngựa của bạn về chuồng!`,
    home: "Về đích!",
    place: (n) => VI_PLACE[n - 1] ?? String(n),
    finished: (name, p) => `${name} về ${VI_PLACE[p - 1] ?? p}!`,
    youPlaced: (p) => (p === 1 ? "Bạn về nhất!" : `Bạn về ${VI_PLACE[p - 1] ?? p}`),
    wins: (name) => `${name} về nhất!`,
    homeCount: (n) => `${n}/4 về đích`,
    again: "Chơi lại",
    newGame: "Ván mới",
    menu: "Menu",
    score: (n) => `+${n} điểm`,
    loseLine: "Xúc xắc lần sau sẽ chiều bạn hơn",
    timedOut: "Hết giờ · máy đi thay bạn",
    away: "Mất kết nối",
    idle: "Máy đang chơi thay bạn · chạm xí ngầu để chơi tiếp",
    backToLobby: "Về phòng",
    watching: "Đang xem",
    detail: (level, n) => cut(`Về nhất · máy ${STRINGS.vi.level[level]} · ${n} người`, 40),
    placeDetail: (p, n) => cut(`Về ${VI_PLACE[p - 1] ?? p} · ${n} người`, 40),
    summary: (level, wins) => `Về nhất ${wins} lần · máy ${STRINGS.vi.level[level]}`,
  },
  en: {
    title: "Ludo",
    subtitle: "Two dice · a 6 brings a horse out · bring all 4 home",
    players: "Players",
    people: "People on this phone",
    peopleHint: (p, n) => (p === n ? "Take turns rolling on one phone" : p === 1 ? `You and ${n - 1} CPU` : `${p} people, ${n - p} CPU`),
    computer: "Computer",
    level: { easy: "Easy", normal: "Normal", hard: "Hard" },
    start: "Start",
    resume: "Resume",
    rules: "How to play",
    rulesLines: [
      "Roll two dice and play them one at a time: tap a die, then a horse (the same one or another).",
      "A die showing 6 brings a horse out of its stable.",
      "Move clockwise; after a full lap, turn up your own home path.",
      "Doubles roll again; three doubles in a row lose the turn.",
      "Land on a rival to send it back to its stable, except on start and star squares.",
      "Exact number to reach home. If both dice can be played, play both; a die that can't be played is lost.",
      "First to bring all 4 home wins; the rest play on for the places.",
      "Online: 20 seconds a turn; if time runs out or you drop, the computer plays for you.",
    ],
    close: "Got it",
    color: ["Red", "Green", "Yellow", "Blue"],
    you: "You",
    cpu: "CPU",
    person: (n) => `Player ${n}`,
    roll: "Roll",
    yourRoll: "Your turn · tap the dice to roll",
    pickDie: "Pick a die, then tap a horse",
    pickHorse: (d) => `Move ${d} · tap a glowing horse`,
    turnOf: (name) => `${name}'s turn`,
    firstTurn: (name) => `${name} goes first`,
    doubles: "Doubles · roll again!",
    noMove: "No move · turn passes",
    noMoveDoubles: "No move · doubles, roll again",
    threeDoubles: "Three doubles in a row · turn lost!",
    lost: (d) => `The ${d} can't be played`,
    captured: (v) => `Sent ${v} back to the stable!`,
    capturedYou: (by) => `${by} sent your horse back!`,
    home: "Home!",
    place: (n) => EN_PLACE[n - 1] ?? String(n),
    finished: (name, p) => `${name} finished ${EN_PLACE[p - 1] ?? p}!`,
    youPlaced: (p) => (p === 1 ? "You came 1st!" : `You came ${EN_PLACE[p - 1] ?? p}`),
    wins: (name) => `${name} wins!`,
    homeCount: (n) => `${n}/4 home`,
    again: "Play again",
    newGame: "New game",
    menu: "Menu",
    score: (n) => `+${n} pts`,
    loseLine: "The dice will be kinder next time",
    timedOut: "Time's up · the computer moved for you",
    away: "Disconnected",
    idle: "The computer is playing for you · tap the dice to take over",
    backToLobby: "Back to room",
    watching: "Watching",
    detail: (level, n) => cut(`1st · ${STRINGS.en.level[level]} CPU · ${n} players`, 40),
    placeDetail: (p, n) => cut(`${EN_PLACE[p - 1] ?? p} of ${n} players`, 40),
    summary: (level, wins) => `1st ${wins}× vs ${STRINGS.en.level[level]} CPU`,
  },
};
