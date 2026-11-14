// Tuning, the word table and the palette for Nói Là Có. Pure data: the rules,
// the bots, the 3D shell, the online adapter and the tests all read it. World
// units are tiles: x runs east, y runs south, (0, 0) is the north-west corner.
import type { Localized } from "@web-games/core/i18n";

/** Logical size of the 2D HUD stage (the 3D canvas always fills the root). */
export const W = 540;
export const H = 960;

/** Fixed simulation step offline, seconds. Online the room steps at 1 / TICK_RATE. */
export const STEP = 1 / 60;
export const TICK_RATE = 20;

// ---------------------------------------------------------------- the match

/** Seats in every match; bots sit in the ones no human takes. */
export const SEATS = 8;
export const MIN_PLAYERS = 2;
export const MAX_HEARTS = 3;
export const COUNTDOWN = 3;
/** Seconds the writer has; the room draws a word for them after that. */
export const WRITE_TIME = 10;
/** Quiet seconds after a word lands before the next writer is picked: long at first, short later. */
export const GAP_FIRST = 12;
export const GAP_LAST = 5;
/** The gap reaches GAP_LAST after this many words. */
export const GAP_WORDS = 10;
/** Words that can run at once; the oldest ends when one more lands. */
export const MAX_ACTIVE = 6;
/** Longest text a client may send as a word. */
export const WORD_MAX = 24;
/** Seconds of play before the endless storm starts, so every match ends. */
export const STORM_AT = 210;
/** Seconds of play after which everyone loses a heart every STORM_DRAIN seconds, whatever they do. */
export const STORM_END = 300;
export const STORM_DRAIN = 2.5;

// ---------------------------------------------------------------- the sandbank

/** The sandbank is GRID x GRID tiles; every device gets the same one (online play shares it). */
export const GRID = 24;
/**
 * Ground levels: 0 the sandy shore, 1 grass, 2 a hill, 3 a hilltop, 4 a tree
 * (a wall nobody climbs). HIGH and up stay dry in floods and waves.
 */
export const HIGH = 2;
export const TREE = 4;
/** Height of the ground's surface per level, in tiles (a tree counts as far too tall to jump). */
export const LEVEL_Y = [0, 0.4, 1.4, 2.4, 9] as const;
/** The hut's floor and a haystack's top, in tiles. */
export const HUT_FLOOR = 1.5;
export const HAY_TOP = 1.2;

// ---------------------------------------------------------------- a player

export const PLAYER_R = 0.3;
/** Tiles per second on plain ground. */
export const SPEED = 4.2;
/** Gravity and the jump: a jump clears JUMP_H (about one hill step), in about 0.6 s. */
export const GRAVITY = 30;
export const JUMP_V = 8.7;
export const JUMP_H = (JUMP_V * JUMP_V) / (2 * GRAVITY);
/** Higher than this needs a jump; lower is just a step. */
export const STEP_UP = 0.45;
/** Height above the ground a kite carries you. */
export const FLY_H = 1.5;
export const DASH_SPEED = 2.6;
export const DASH_TIME = 0.22;
export const DASH_COOLDOWN = 2.5;
/** Seconds nothing can hurt you after a hit. */
export const INVULNERABLE = 1.5;
/** How fast a knock-back dies away (per second, exponential). */
export const KNOCK_DECAY = 5;
/** Steering on ice and oil: how much of the wanted velocity is reached per second. */
export const SLIDE = 1.5;

// ---------------------------------------------------------------- scoring

/** Points for every word that landed while you were alive, per place gained, and for the win. */
export const SCORE_WORD = 10;
export const SCORE_PLACE = 15;
export const SCORE_WIN = 50;

// ---------------------------------------------------------------- the words

export const WORD_IDS = [
  "lu",
  "song-than",
  "dung-nham",
  "loc-xoay",
  "sam-set",
  "ong",
  "trau-dien",
  "ca-sau",
  "rong",
  "bom",
  "phao-hoa",
  "vo-chuoi",
  "dau",
  "choi",
  "thuoc",
  "dieu",
  "dong-rom",
  "nguoc",
  "toi",
  "ngu",
  "ti-hon",
  "sa-mac",
  "bang",
  "dam-lay",
] as const;
export type WordId = (typeof WORD_IDS)[number];

export type WordGroup = "disaster" | "creature" | "object" | "help" | "prank" | "ground";

export interface WordDef {
  group: WordGroup;
  /** Helps the living (a bot short of hearts writes one of these). */
  kind: "harm" | "help" | "twist";
  name: Localized<string>;
  /** Everything else a player may type for it, in either language. Matched without accents, case or spaces. */
  aliases: string[];
  /** Seconds the event runs. */
  dur: number;
}

export const WORDS: Record<WordId, WordDef> = {
  lu: { group: "disaster", kind: "harm", name: { vi: "Lũ", en: "Flood" }, aliases: ["lũ lụt", "ngập", "lụt", "nước lên", "flooding"], dur: 17 },
  "song-than": { group: "disaster", kind: "harm", name: { vi: "Sóng thần", en: "Tsunami" }, aliases: ["sóng", "wave", "tidal wave"], dur: 7 },
  "dung-nham": { group: "disaster", kind: "harm", name: { vi: "Dung nham", en: "Lava" }, aliases: ["núi lửa", "volcano", "magma", "lửa", "fire"], dur: 15 },
  "loc-xoay": { group: "disaster", kind: "harm", name: { vi: "Lốc xoáy", en: "Tornado" }, aliases: ["lốc", "vòi rồng", "gió lốc", "twister", "cyclone"], dur: 14 },
  "sam-set": { group: "disaster", kind: "harm", name: { vi: "Sấm sét", en: "Lightning" }, aliases: ["sét", "sấm", "bão", "giông", "thunder", "storm"], dur: 12 },
  ong: { group: "creature", kind: "harm", name: { vi: "Ong", en: "Bees" }, aliases: ["bầy ong", "tổ ong", "ong vò vẽ", "bee", "wasp", "wasps"], dur: 13 },
  "trau-dien": { group: "creature", kind: "harm", name: { vi: "Trâu điên", en: "Mad buffalo" }, aliases: ["trâu", "con trâu", "bò", "buffalo", "bull"], dur: 20 },
  "ca-sau": { group: "creature", kind: "harm", name: { vi: "Cá sấu", en: "Crocodile" }, aliases: ["sấu", "croc", "crocodiles", "alligator"], dur: 16 },
  rong: { group: "creature", kind: "harm", name: { vi: "Rồng", en: "Dragon" }, aliases: ["con rồng", "rồng lửa", "dragons"], dur: 11.5 },
  bom: { group: "object", kind: "harm", name: { vi: "Bom", en: "Bomb" }, aliases: ["mìn", "nổ", "bombs", "mine", "boom"], dur: 6 },
  "phao-hoa": { group: "object", kind: "harm", name: { vi: "Pháo hoa", en: "Fireworks" }, aliases: ["pháo", "pháo bông", "firework", "rocket", "rockets"], dur: 10 },
  "vo-chuoi": { group: "object", kind: "twist", name: { vi: "Vỏ chuối", en: "Banana peel" }, aliases: ["chuối", "banana", "bananas", "peel"], dur: 20 },
  dau: { group: "object", kind: "twist", name: { vi: "Dầu", en: "Oil" }, aliases: ["dầu nhớt", "nhớt", "dầu loang", "oil spill", "grease"], dur: 18 },
  choi: { group: "help", kind: "help", name: { vi: "Chòi", en: "Hut" }, aliases: ["cái chòi", "nhà", "lều", "nhà sàn", "house", "shelter", "home"], dur: 30 },
  thuoc: { group: "help", kind: "help", name: { vi: "Thuốc", en: "Medicine" }, aliases: ["hồi máu", "tim", "cứu thương", "medkit", "heal", "heart", "health"], dur: 15 },
  dieu: { group: "help", kind: "help", name: { vi: "Diều", en: "Kite" }, aliases: ["bay", "cánh diều", "thả diều", "fly", "wings", "flying"], dur: 10 },
  "dong-rom": { group: "help", kind: "help", name: { vi: "Đống rơm", en: "Haystack" }, aliases: ["rơm", "ụ rơm", "cây rơm", "hay", "straw"], dur: 30 },
  nguoc: { group: "prank", kind: "twist", name: { vi: "Ngược", en: "Reverse" }, aliases: ["đảo ngược", "lộn ngược", "đảo", "reversed", "backwards", "mirror"], dur: 10 },
  toi: { group: "prank", kind: "twist", name: { vi: "Tối", en: "Dark" }, aliases: ["đêm", "bóng tối", "tối om", "mù", "night", "darkness", "blind"], dur: 12 },
  ngu: { group: "prank", kind: "twist", name: { vi: "Ngủ", en: "Sleep" }, aliases: ["buồn ngủ", "ngủ gật", "sleepy", "nap", "zzz"], dur: 12 },
  "ti-hon": { group: "prank", kind: "twist", name: { vi: "Tí hon", en: "Tiny" }, aliases: ["nhỏ", "thu nhỏ", "bé xíu", "small", "shrink", "mini"], dur: 12 },
  "sa-mac": { group: "ground", kind: "twist", name: { vi: "Sa mạc", en: "Desert" }, aliases: ["cát", "nắng", "hạn hán", "sand", "drought", "sun"], dur: 20 },
  bang: { group: "ground", kind: "twist", name: { vi: "Băng", en: "Ice" }, aliases: ["đóng băng", "tuyết", "băng giá", "lạnh", "snow", "frozen", "freeze"], dur: 16 },
  "dam-lay": { group: "ground", kind: "twist", name: { vi: "Đầm lầy", en: "Swamp" }, aliases: ["bùn", "lầy", "sình", "bùn lầy", "mud", "bog", "marsh"], dur: 18 },
};

export const isWordId = (v: unknown): v is WordId => typeof v === "string" && Object.hasOwn(WORDS, v);

/** The three ground words replace one another. */
export const GROUND_WORDS: readonly WordId[] = ["sa-mac", "bang", "dam-lay"];

// ---------------------------------------------------------------- per-word tuning

export const T = {
  /** Water stands this high: the shore drowns, the grass stays dry. */
  flood: { warn: 3, level: 0.25 },
  /** The wave washes over anyone lower than `top`: on a hill, on a haystack, or in mid-jump. */
  tsunami: { warn: 3.5, speed: 7, push: 7, top: 1.1 },
  /** Lava burns feet: jump over it. */
  lava: { warn: 2.5, burn: 5, share: 0.42 },
  tornado: { speed: 2.9, hit: 1, pull: 3.4, pullSpeed: 1, toss: 8 },
  lightning: { every: 0.8, fuse: 1, radius: 0.95 },
  bees: { swarms: 4, speed: 3.4, hit: 0.55, rest: 1.2 },
  /** The buffalo tramples anyone lower than `over` above the ground: jump it. */
  buffalo: { aim: 1.1, speed: 10, hit: 0.85, charges: 5, push: 6, over: 0.75 },
  croc: { count: 5, speed: 4.2, sight: 4.5, hit: 0.65, rest: 1.5 },
  dragon: { glide: 1.6, inhale: 1.2, fire: 0.8, half: 0.9, breaths: 4, orbit: 9 },
  bomb: { count: 7, every: 0.5, fuse: 2.2, radius: 1.5 },
  fireworks: { every: 0.18, fuse: 0.9, radius: 0.75 },
  banana: { count: 40, hit: 0.45, stun: 0.7, slide: 6 },
  oil: { count: 5, radius: 1.9 },
  medkit: { count: 3, hit: 0.6 },
  sleep: { still: 1, nap: 2.5 },
  tiny: { speed: 0.65 },
  desert: { speed: 0.8 },
  swamp: { speed: 0.5 },
  stormEvery: 0.8,
} as const;

// ---------------------------------------------------------------- palette

/** Shirt colour per seat. */
export const SEAT_COLORS = [0xe5484d, 0x3b82f6, 0xf5b301, 0x22a559, 0xf97316, 0xa855f7, 0x22c7d6, 0xf472b6] as const;

export const PALETTE = {
  sky: 0xbfe6f5,
  skyDark: 0x1b1a3a,
  river: 0x3f9fd8,
  riverLight: 0xbfe8ff,
  seabed: 0xd9c690,
  hill: 0x6cb544,
  hilltop: 0x8bc95a,
  rock: 0x8d8f99,
  cloud: 0xffffff,
  riverDeep: 0x7a5c40,
  sand: 0xe9d39a,
  sandSide: 0xcbb074,
  grassA: 0x7cc24a,
  grassB: 0x71b843,
  grassSide: 0x8a5a36,
  mound: 0x5fa83a,
  moundSide: 0x7a4e2e,
  desert: 0xe6c36a,
  ice: 0xcfeefc,
  swamp: 0x6b6a3a,
  water: 0x4aa8e0,
  lava: 0xff6a1a,
  lavaWarn: 0xffc04a,
  skin: 0xf2c7a0,
  hair: 0x2a1d16,
  pants: 0x3a3f52,
  hat: 0xe2c77a,
  thatch: 0xd9b45a,
  thatchDark: 0xb8913f,
  bamboo: 0xb99a5b,
  bambooDark: 0x8a6f3c,
  hay: 0xe3bf55,
  hayDark: 0xc79f3a,
  leaf: 0x3f9a3c,
  leafDark: 0x2f7a30,
  trunk: 0x7a4e2e,
  buffalo: 0x4a4048,
  horn: 0xe8dcc0,
  croc: 0x4f8a3a,
  crocBelly: 0xc9d48a,
  dragon: 0x2fa35a,
  dragonBelly: 0xe7d36a,
  bee: 0xffc928,
  bomb: 0x22222a,
  banana: 0xffd93b,
  oil: 0x1d1a22,
  medkit: 0xffffff,
  cross: 0xe5322b,
  warn: 0xe5322b,
  bolt: 0xfff7a8,
  gold: 0xffc928,
  kite: 0xe5484d,
  tornado: 0x9aa0ad,
  ghost: 0xdfe8ff,
} as const;
