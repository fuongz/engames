import type { Localized } from "@web-games/core/i18n";
import type { RoomSetting } from "@web-games/core/online";

// Tuning for Cờ Tỷ Phú. Numbers and tables only; the rules are in logic.ts.
// The board, prices and rents are our own (Vietnamese places, cheap → dear);
// only the shape of the genre (40 squares, 8 colour groups) is shared.

/** Landscape: the board is a ring round the whole screen, the dashboard inside it. */
export const W = 960;
export const H = 540;

export type Difficulty = "easy" | "normal" | "hard";
export const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];

// ---------------------------------------------------------------- money

/** Money is in thousands of đồng; shown as "200K". */
export const START_CASH = 1500;
/** Paid for passing or landing on Xuất phát. */
export const SALARY = 200;
export const JAIL_FINE = 50;
/** Failed doubles attempts in jail before the fine is forced. */
export const JAIL_TRIES = 3;
/** Doubles in a row that send you to jail. */
export const MAX_DOUBLES = 3;
/** The bank's supply of buildings. */
export const HOUSES = 32;
export const HOTELS = 12;
/** A hotel is this many "houses" on the houses counter (4 houses + 1). */
export const HOTEL = 5;
/** Unmortgaging costs the mortgage plus this share. */
export const MORTGAGE_INTEREST = 0.1;
/** Smallest opening bid and raise in an auction. */
export const MIN_BID = 10;
/** Offers a player may make in one turn. */
export const OFFERS_PER_TURN = 3;

// ---------------------------------------------------------------- the board

export type SquareKind = "start" | "prop" | "transport" | "utility" | "chance" | "chest" | "tax" | "jail" | "rest" | "gotojail";

export interface Square {
  kind: SquareKind;
  name: Localized<string>;
  /** 0..7 colour groups (cheap → dear), 8 transport, 9 utilities, -1 none. */
  group: number;
  /** Purchase price; 0 if it can't be owned. Also the tax for a tax square. */
  price: number;
  /** Property: rent with 0..4 houses and with a hotel. */
  rent: number[];
  /** Cost of one house (and of the hotel) in this group. */
  house: number;
}

export const TRANSPORT_GROUP = 8;
export const UTILITY_GROUP = 9;
/** Transport rent by how many of the four the owner holds. */
export const TRANSPORT_RENT = [25, 50, 100, 200];
/** Utility rent = dice total × this, by how many of the two the owner holds. */
export const UTILITY_MULT = [4, 10];

const corner = (kind: SquareKind, vi: string, en: string): Square => ({ kind, name: { vi, en }, group: -1, price: 0, rent: [], house: 0 });
const prop = (group: number, vi: string, en: string, price: number, rent: number[], house: number): Square => ({
  kind: "prop",
  name: { vi, en },
  group,
  price,
  rent,
  house,
});
const transport = (vi: string, en: string): Square => ({ kind: "transport", name: { vi, en }, group: TRANSPORT_GROUP, price: 200, rent: [], house: 0 });
const utility = (vi: string, en: string): Square => ({ kind: "utility", name: { vi, en }, group: UTILITY_GROUP, price: 150, rent: [], house: 0 });
const chance = (): Square => ({ kind: "chance", name: { vi: "Cơ hội", en: "Chance" }, group: -1, price: 0, rent: [], house: 0 });
const chest = (): Square => ({ kind: "chest", name: { vi: "Khí vận", en: "Fortune" }, group: -1, price: 0, rent: [], house: 0 });
const tax = (vi: string, en: string, amount: number): Square => ({ kind: "tax", name: { vi, en }, group: -1, price: amount, rent: [], house: 0 });

/** The 40 squares, in move order from Xuất phát. */
export const BOARD: Square[] = [
  corner("start", "Xuất phát", "Start"),
  prop(0, "Hà Giang", "Ha Giang", 60, [3, 12, 36, 100, 180, 260], 50),
  chest(),
  prop(0, "Cao Bằng", "Cao Bang", 70, [5, 22, 66, 190, 330, 460], 50),
  tax("Thuế thu nhập", "Income tax", 200),
  transport("Bến xe", "Bus station"),
  prop(1, "Sa Pa", "Sa Pa", 100, [7, 32, 95, 280, 410, 560], 50),
  chance(),
  prop(1, "Mộc Châu", "Moc Chau", 100, [7, 32, 95, 280, 410, 560], 50),
  prop(1, "Điện Biên", "Dien Bien", 120, [9, 44, 110, 320, 460, 620], 50),
  corner("jail", "Trại giam", "Jail"),
  prop(2, "Bến Tre", "Ben Tre", 140, [11, 52, 155, 460, 640, 770], 100),
  utility("Điện lực", "Power company"),
  prop(2, "Cần Thơ", "Can Tho", 140, [11, 52, 155, 460, 640, 770], 100),
  prop(2, "Châu Đốc", "Chau Doc", 160, [13, 62, 185, 510, 710, 910], 100),
  transport("Ga tàu", "Rail station"),
  prop(3, "Quy Nhơn", "Quy Nhon", 180, [15, 72, 205, 560, 760, 960], 100),
  chest(),
  prop(3, "Phong Nha", "Phong Nha", 180, [15, 72, 205, 560, 760, 960], 100),
  prop(3, "Huế", "Hue", 200, [17, 82, 225, 610, 810, 1010], 100),
  corner("rest", "Quán nước", "Tea stall"),
  prop(4, "Nha Trang", "Nha Trang", 220, [19, 92, 255, 710, 880, 1060], 150),
  chance(),
  prop(4, "Hội An", "Hoi An", 220, [19, 92, 255, 710, 880, 1060], 150),
  prop(4, "Đà Nẵng", "Da Nang", 240, [21, 104, 310, 760, 930, 1110], 150),
  transport("Cảng biển", "Seaport"),
  prop(5, "Vũng Tàu", "Vung Tau", 260, [23, 112, 335, 810, 980, 1160], 150),
  prop(5, "Phú Quốc", "Phu Quoc", 260, [23, 112, 335, 810, 980, 1160], 150),
  utility("Nhà máy nước", "Waterworks"),
  prop(5, "Đà Lạt", "Da Lat", 280, [25, 122, 365, 860, 1030, 1210], 150),
  corner("gotojail", "Vào tù", "Go to jail"),
  prop(6, "Ninh Bình", "Ninh Binh", 300, [27, 132, 395, 910, 1110, 1290], 200),
  prop(6, "Hải Phòng", "Hai Phong", 300, [27, 132, 395, 910, 1110, 1290], 200),
  chest(),
  prop(6, "Hạ Long", "Ha Long", 320, [29, 152, 455, 1010, 1210, 1410], 200),
  transport("Sân bay", "Airport"),
  chance(),
  prop(7, "Sài Gòn", "Saigon", 350, [36, 178, 510, 1110, 1310, 1510], 200),
  tax("Thuế xa xỉ", "Luxury tax", 100),
  prop(7, "Hà Nội", "Hanoi", 400, [52, 205, 610, 1410, 1710, 2010], 200),
];

export const SQUARES = BOARD.length;
export const JAIL = 10;
export const GO_TO_JAIL = 30;
/** The squares of each group, by group number (0..9). */
export const GROUPS: number[][] = Array.from({ length: 10 }, (_, g) => BOARD.flatMap((sq, i) => (sq.group === g ? [i] : [])));
export const ownable = (sq: number) => BOARD[sq]?.price > 0 && BOARD[sq]?.kind !== "tax";

/** Group colours on the board: our own palette (clay, mint, lotus, tangerine, lantern, rice gold, jade, indigo). */
export const GROUP_COLORS = ["#b0643c", "#5cc6b4", "#e7799f", "#f29a38", "#d93a3a", "#e9c13a", "#2f9e6a", "#3d4fb0", "#6b5a4a", "#6b5a4a"];

// ---------------------------------------------------------------- players

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
/** Player colours (token and owner marks): lantern red, river blue, jade, saffron. */
export const PLAYER_COLORS = ["#e2483d", "#3a7ee0", "#25a36a", "#f0a422"];
/** Token per seat: nón lá, đèn lồng, hoa sen, thuyền. */
export const TOKENS = ["hat", "lantern", "lotus", "boat"] as const;
export type Token = (typeof TOKENS)[number];

// ---------------------------------------------------------------- pacing

/** Seconds a computer player waits before each decision, so people can follow. */
export const BOT_DELAY = 0.7;
/** Seconds the dice tumble before the token sets off. */
export const DICE_TIME = 0.7;
/** Seconds per square a token takes to hop. */
export const HOP_TIME = 0.14;
/** Any game that reaches this many turns ends on net worth (a guard; real games end far sooner). */
export const TURN_CAP = 1500;

// ---------------------------------------------------------------- online

export const TICK_RATE = 10;
/** Seconds for each decision online; when it runs out the computer decides for you. */
export const TURN_SECONDS = 30;
/** Seconds for each decision after a player has let the clock run out once. */
export const IDLE_SECONDS = 6;
/** Time limits a game can have, in minutes (0 = none). */
export const TIME_LIMITS = [0, 30, 60] as const;
export type TimeLimit = (typeof TIME_LIMITS)[number];
export const DEFAULT_TIME_LIMIT: TimeLimit = 60;
export const DEFAULT_PLAYERS = 4;

/** The host's lobby choices (manifest and room adapter share this list). */
export const ROOM_SETTINGS: RoomSetting[] = [
  {
    key: "players",
    label: { vi: "Số người chơi", en: "Players" },
    choices: [2, 3, 4].map((n) => ({ value: String(n), label: { vi: `${n} người`, en: `${n} players` } })),
    default: String(DEFAULT_PLAYERS),
  },
  {
    key: "time",
    label: { vi: "Giới hạn giờ", en: "Time limit" },
    choices: TIME_LIMITS.map((m) => ({
      value: String(m),
      label: m === 0 ? { vi: "Không giới hạn", en: "No limit" } : { vi: `${m} phút`, en: `${m} min` },
    })),
    default: String(DEFAULT_TIME_LIMIT),
  },
];

// ---------------------------------------------------------------- scores

/** Solo: winning against the computer scores net worth ÷ 10, times this by level. */
export const LEVEL_MULT: Record<Difficulty, number> = { easy: 1, normal: 2, hard: 4 };
/** Solo: plus this per computer player beaten, by level. */
export const BEAT_BONUS: Record<Difficulty, number> = { easy: 50, normal: 150, hard: 400 };
/** Online: the winner's base score (plus net worth ÷ 10); second place in a 3–4 player game. */
export const ONLINE_WIN = 600;
export const ONLINE_SECOND = 150;
