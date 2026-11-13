// Tuning, palette and skins for Qua Đường. Pure data: logic.ts, the 3D shell and
// the tests all read it. World units are grid cells: x is the column (0 is the
// middle), a row is one lane; forward is +row.
import type { Localized } from "@web-games/core/i18n";

/** Logical size of the 2D HUD stage (the 3D canvas always fills the root). */
export const W = 540;
export const H = 960;

/** Fixed simulation step, seconds. logic.step is replayable at this rate. */
export const STEP = 1 / 60;

// ---------------------------------------------------------------- grid

/** Playable columns are -HALF..HALF (9 wide). */
export const HALF = 4;
/** Movers wrap at ±SPAN_HALF, far enough off-screen that the jump is never seen. */
export const SPAN_HALF = 16;
/** How far a lane's ground is drawn either side. */
export const LANE_HALF = 22;
/** Rows generated ahead of the furthest row reached, and kept behind it. */
export const AHEAD = 26;
export const KEEP_BEHIND = 8;
/** The first rows are always safe grass. */
export const START_ROWS = 4;

// ---------------------------------------------------------------- the duck

/** Seconds per hop. */
export const HOP_TIME = 0.12;
/** Half the duck's width, for vehicle and train hits. */
export const DUCK_HALF = 0.3;
/** Extra reach when landing on a floater, so a near miss still counts. */
export const LAND_SLACK = 0.2;

// ---------------------------------------------------------------- the ward officer

/** Seconds without reaching a new row before he blows a first warning whistle. */
export const STALL_WARN = 5;
/** Seconds without reaching a new row before he runs in. */
export const STALL_LIMIT = 8;
/** Going this many rows back from the furthest one reached sends him too. */
export const BACK_LIMIT = 4;
/** Seconds from his whistle to the catch. */
export const CATCH_TIME = 1.2;

// ---------------------------------------------------------------- traffic

/** Difficulty reaches its top at this row. */
export const RAMP_ROWS = 260;
/** The first rail lane may appear from this row. */
export const RAIL_FROM = 18;

export type VehicleKind = "moto" | "moto-box" | "ba-gac" | "bus" | "courier" | "ninja" | "dog-thief";
export type FloaterKind = "ghe" | "raft" | "hyacinth";
export type BlockKind = "banana" | "stool" | "food-cart" | "hedge";

/** Length in cells of every moving thing. */
export const LENGTH: Record<VehicleKind | FloaterKind | "train", number> = {
  moto: 1,
  "moto-box": 1,
  "ba-gac": 2,
  bus: 3,
  courier: 1,
  ninja: 1,
  "dog-thief": 1,
  ghe: 3,
  raft: 2,
  hyacinth: 1,
  train: 12,
};

/** Road speeds (cells/s) at difficulty 0 and 1. */
export const ROAD_SPEED = { min: [1.3, 2.4], max: [2.4, 4.6] } as const;
/** Gap between vehicles (cells) at difficulty 0 and 1. */
export const ROAD_GAP = { min: [3.2, 2.2], max: [6.5, 4.2] } as const;
// Courier lanes: a road lane given over to delivery riders, faster than the rest.
/** The first courier lane may appear from this row. */
export const COURIER_FROM = 8;
/** Chance a road lane is a courier lane, from COURIER_FROM to COURIER_FROM + COURIER_RAMP rows. */
export const COURIER_CHANCE = [0.08, 0.3] as const;
export const COURIER_RAMP = 120;
/** A courier lane's speed against an ordinary lane's at the same row (bus, cart and moto lanes average 1). */
export const COURIER_PACE = 1.5;
/** Its gaps are this much wider, so the faster stream still leaves room to cross. */
export const COURIER_GAP = 1.3;
/** Share of a courier lane's riders that are couriers (the rest are plain motos). */
export const COURIER_SHARE = 0.8;
/** Colour variants: green, sky blue, orange, yellow (models.ts COURIER_LOOKS). */
export const COURIER_VARIANTS = 4;

/** Share of a moto lane's riders on a step-through scooter, fully sun-covered. */
export const NINJA_SHARE = 0.2;
/** Pastel jacket variants (models.ts NINJA_LOOKS). */
export const NINJA_VARIANTS = 4;

// Dog-thief bikers: rare, one per lane at most, and they swing a net.
/** No dog-thief bike before this row. */
export const DOG_FROM = 25;
/** Chance a moto lane past DOG_FROM carries one, at difficulty 0 and 1 (buses fill ~20–30% of lanes). */
export const DOG_CHANCE = [0.1, 0.16] as const;
/** Chance the bike strikes when it reaches a duck next to its lane (once per lap). */
export const NET_CHANCE = 0.6;
/** Seconds the net is raised before the swipe: the warning. */
export const NET_WARN = 0.5;
/** Seconds the swipe is drawn sweeping (the catch itself is instant, at its start). */
export const NET_SWIPE = 0.32;
/** The swipe covers the rows either side of the bike's lane, this far either side of its centre. */
export const NET_HALF = 1.4;

/** River current (cells/s) at difficulty 0 and 1. */
export const RIVER_SPEED = { min: [0.9, 1.4], max: [1.6, 2.6] } as const;
/** Gap between floaters (cells) at difficulty 0 and 1. */
export const RIVER_GAP = { min: [1, 1.6], max: [2.2, 3.2] } as const;

/** A train crosses at this speed (cells/s). */
export const TRAIN_SPEED = 34;
/** Seconds the light blinks and the bell dings before the train arrives. */
export const TRAIN_WARN = 1.4;
/** Seconds between trains, at difficulty 0 and 1. */
export const TRAIN_PERIOD = { min: [7, 5], max: [11, 8] } as const;

/** Chance a lane (grass or road) carries a coin. */
export const COIN_CHANCE = 0.16;

// ---------------------------------------------------------------- look

/** Rows per full day → dusk → day cycle; dusk sits in its second half. */
export const DAY_CYCLE = 200;

/** Every colour the 3D scene uses, as 0xRRGGBB. One place to retune the palette. */
export const PALETTE = {
  day: {
    sky: 0x9fdcff,
    fog: 0xbfe8ff,
    sun: 0xfff3dc,
    sunIntensity: 2.4,
    hemiSky: 0xd8f0ff,
    hemiGround: 0x7fae52,
    hemiIntensity: 1.25,
  },
  dusk: {
    sky: 0xf49a7e,
    fog: 0xf7b08e,
    sun: 0xffa060,
    sunIntensity: 1.9,
    hemiSky: 0xffb7a0,
    hemiGround: 0x6a5470,
    hemiIntensity: 1.05,
  },
  grassA: 0x8fd14f,
  grassB: 0x84c646,
  grassEdge: 0x6aa83a,
  road: 0x55585f,
  roadEdge: 0x9b9ea6,
  roadLine: 0xf2f2ea,
  water: 0x3fc1d9,
  waterDeep: 0x2a9fbf,
  bank: 0x8b8f96,
  gravel: 0x8a7f74,
  tie: 0x7a4e2e,
  rail: 0xc9ccd2,
  // duck
  duck: 0xffd23a,
  duckShade: 0xf2b51f,
  beak: 0xff8a1f,
  eye: 0x231a14,
  hat: 0xe9d39a,
  hatShade: 0xcfb478,
  strap: 0xd63a2a,
  // people and vehicles
  skin: 0xf1c08f,
  hair: 0x2b2420,
  tyre: 0x2a2a2e,
  metal: 0xb9bec7,
  motoRed: 0xe0403a,
  motoBlue: 0x2f6fd6,
  motoWhite: 0xf3efe6,
  helmetGreen: 0x2f9e55,
  helmetPink: 0xf48fb1,
  helmetBlue: 0x2c5fc7,
  shirtWhite: 0xf4f4f4,
  shirtGreen: 0x3aa45b,
  shirtPink: 0xf3a0b8,
  box: 0xd9a35c,
  boxTape: 0x9c6a2f,
  busGreen: 0x2fa34e,
  busYellow: 0xf5d13a,
  busRoof: 0xf2efe4,
  glass: 0x2a3b55,
  wood: 0x8a5a33,
  woodDark: 0x6a4224,
  woodLight: 0xb9874f,
  bamboo: 0xc9c06a,
  bambooDark: 0x9c9447,
  boatRed: 0xc8382c,
  thatch: 0xd8b878,
  leaf: 0x4fae3a,
  leafDark: 0x3d8f2c,
  flower: 0xb07ad9,
  banana: 0xf2d43a,
  trunk: 0x9a7a4a,
  wall: 0xf3c94f,
  wallShade: 0xe0b23e,
  roof: 0xc4472f,
  roofShade: 0xa23a26,
  shutter: 0x2e8a57,
  stool: 0xe23a35,
  cart: 0xd9dde3,
  awningRed: 0xe0453a,
  awningWhite: 0xf6f1e7,
  pot: 0xa9adb5,
  hedge: 0x4ca83c,
  hedgeTop: 0x6cc54f,
  coin: 0xffc928,
  coinFace: 0xffe27a,
  pole: 0x6b4b33,
  wire: 0x3a2a22,
  sign: 0xf6f1e7,
  signRed: 0xd62f2f,
  train: 0xf1ead8,
  trainStripe: 0x234e8c,
  trainNose: 0xd23b30,
  officer: 0x6f7a3a,
  officerCap: 0x55602a,
  badge: 0xe0b03a,
  whistle: 0xd9dde3,
  // emissive bits, drawn unlit
  lanternOff: 0xb8483a,
  lanternOn: 0xffb35a,
  lightOff: 0x5c1d1d,
  lightOn: 0xff3a2a,
  headOff: 0xd8d2b0,
  headOn: 0xfff2a8,
  splash: 0xe8fbff,
  // courier riders: jacket, helmet and box share a colour
  courierGreen: 0x2fb352,
  courierSky: 0x7cc8f2,
  courierOrange: 0xf5862b,
  courierYellow: 0xf7cb17,
  courierBike: 0x33363e,
  reflect: 0xe4e8ec,
  // sun-covered scooter riders
  ninjaPink: 0xf7b6c9,
  ninjaMint: 0xa9e3c8,
  ninjaLilac: 0xcdb6f0,
  ninjaPeach: 0xffd3a1,
  brim: 0xefe3c8,
  mask: 0x8fa6c0,
  shades: 0x15151b,
  scooter: 0xf2ede2,
  wicker: 0xb98a4f,
  // dog-thief bikers
  hoodie: 0x2b2e38,
  hoodieB: 0x3c3646,
  cap: 0x17191f,
  sportBike: 0x2a2c33,
  sportTrim: 0xb8322c,
  netPole: 0x9a8a6e,
  netHoop: 0xd8d0bc,
  netMesh: 0x6f8a80,
} as const;

// ---------------------------------------------------------------- skins

export type SkinId = "vit-vang" | "vit-ao-mua" | "vit-shipper" | "vit-ao-dai" | "vit-kinh-ram";

export interface Skin {
  id: SkinId;
  name: Localized<string>;
  /** Shared arcade tickets; 0 = free and always owned (docs/standards/tickets.md §6). */
  price: number;
}

/**
 * Duck looks, sold once for shared tickets through the account cosmetics shop
 * (`manifest.cosmetics`). vit-vang is the free default. Never rename an id: it
 * names the purchase in the ledger. Art: apps/web/public/shop/qua-duong/<id>.webp.
 */
export const SKINS: Skin[] = [
  { id: "vit-vang", name: { vi: "Vịt vàng", en: "Yellow duckling" }, price: 0 },
  { id: "vit-ao-mua", name: { vi: "Vịt áo mưa", en: "Raincoat duck" }, price: 1500 },
  { id: "vit-shipper", name: { vi: "Vịt shipper", en: "Courier duck" }, price: 2500 },
  { id: "vit-ao-dai", name: { vi: "Vịt áo dài", en: "Áo dài duck" }, price: 4000 },
  { id: "vit-kinh-ram", name: { vi: "Vịt kính râm", en: "Shades duck" }, price: 6000 },
];

/** The manifest's cosmetics catalog. */
export const COSMETICS = SKINS.map(({ id, name, price }) => ({ id, name, price }));

export const DEFAULT_SKIN: SkinId = "vit-vang";

export const isSkinId = (v: unknown): v is SkinId => SKINS.some((s) => s.id === v);

// ---------------------------------------------------------------- tickets

/** Tickets per row reached, and per coin picked up, paid at the end of a solo run. */
export const TICKETS_PER_ROW = 1;
export const TICKETS_PER_COIN = 5;
/** One deposit is capped at this by the server (tickets.md); never ask for more. */
export const MAX_DEPOSIT = 5000;

// ---------------------------------------------------------------- online race

export const RACE_MIN = 2;
export const RACE_MAX = 4;
/** Simulation steps per second in a room; each runs STEP-sized substeps. */
export const RACE_TICK_RATE = 30;
/** Seconds of "3, 2, 1" before the ducks may hop. */
export const RACE_COUNTDOWN = 3;
/** The race stops after this many seconds; the furthest duck wins. */
export const RACE_SECONDS = 150;
/** Coin rows remembered per racer in a snapshot (rows a client still draws). */
export const RACE_GOT_KEEP = 16;
