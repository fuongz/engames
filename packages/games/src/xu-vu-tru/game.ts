import "@fontsource/baloo-2/800.css";
import "@fontsource/handjet/700.css";
import { type GameHooks, type PointerInfo, type Rect, type Runtime, SUMMARY_KEY, clamp, easeOutCubic, inRect } from "@web-games/core";
import {
  ALBUM_BTN,
  AMBER,
  CHUTE,
  COINS_BOX,
  CORE_COLORS,
  FONT,
  GOLD,
  LAMPS_Y,
  LED_FONT,
  MENU_BTN,
  MINT,
  NEON,
  PINK,
  REEL,
  SHELF_BOTTOM,
  SHOOT,
  SPINS_BOX,
  TICKETS_BOX,
  WHEEL_C,
  INK,
  along,
  AUTO_BTN,
  type ReelCell,
  betaTag,
  button,
  drawAlbumButton,
  drawAutoButton,
  drawBackground,
  drawBody,
  drawCabinet,
  drawCardFace,
  drawChute,
  drawCoreLamps,
  drawCounter,
  drawFlyingCoin,
  drawFrontLip,
  drawGlass,
  drawMarquee,
  drawPusher,
  drawReels,
  drawRobots,
  drawShadow,
  drawShelf,
  drawShootButton,
  drawTray,
  drawWheel,
  fitSize,
  makeSprites,
  neon,
  panel,
  proj,
  text,
} from "./art";
import {
  CARD_COUNT,
  CARD_IDS,
  CARD_TICKETS,
  CORE_COUNT,
  FLIGHT_DOWN,
  FLIGHT_UP,
  H,
  MINI_PRIZES,
  SET_TICKETS,
  SET_TIME,
  SHELF_D,
  SPIN_TIME,
  SUPER_PRIZES,
  SUPER_SPIN_TIME,
  W,
} from "./config";
import bengalImg from "./img/cards/bengal.webp";
import britishImg from "./img/cards/british.webp";
import maineCoonImg from "./img/cards/maine-coon.webp";
import munchkinImg from "./img/cards/munchkin.webp";
import persianImg from "./img/cards/persian.webp";
import ragdollImg from "./img/cards/ragdoll.webp";
import scottishFoldImg from "./img/cards/scottish-fold.webp";
import siameseImg from "./img/cards/siamese.webp";
import sphynxImg from "./img/cards/sphynx.webp";
import tabbyImg from "./img/cards/tabby.webp";
import robotsImg from "./img/robots.webp";
import {
  type GameEvent,
  RULES_VERSION,
  type SpinKind,
  type State,
  createRun,
  grantCoins,
  normalizeAlbum,
  ownedCount,
  pusherAt,
  segmentAt,
  update,
} from "./logic";
import { STRINGS } from "./strings";

// The imperative shell: turns the SHOOT button into inputs for logic.ts, plays
// its events as sound, light and particles, and draws the cabinet. Solo only.

const RUN_KEY = "run";
const PENDING_KEY = "pendingCoins";
/** The card album, kept across runs. */
const ALBUM_KEY = "album";
/** Card art in CARD_IDS order. */
const CARD_SRC: Record<(typeof CARD_IDS)[number], string> = {
  persian: persianImg,
  british: britishImg,
  siamese: siameseImg,
  "maine-coon": maineCoonImg,
  "scottish-fold": scottishFoldImg,
  ragdoll: ragdollImg,
  bengal: bengalImg,
  sphynx: sphynxImg,
  munchkin: munchkinImg,
  tabby: tabbyImg,
};
/** What the two reels show. */
const MINI_CELLS: ReelCell[] = MINI_PRIZES.map((p) => ({ value: p.value, coin: p.kind === "coins" }));
const SUPER_CELLS: ReelCell[] = SUPER_PRIZES.map((value) => ({ value, coin: false }));
const cellsOf = (kind: SpinKind) => (kind === "mini" ? MINI_CELLS : SUPER_CELLS);
const spinTimeOf = (kind: SpinKind) => (kind === "mini" ? SPIN_TIME : SUPER_SPIN_TIME);
/** Seconds of Super spin win celebration. */
const SUPER_FX = 3.2;
/** Seconds a won card takes to fly to the album button. */
const CARD_FLY = 0.9;
/** Toasts sit on the pusher's top plate, the one calm strip in the machine. */
const TOAST_Y = 522;
const SAVE_EVERY = 8;

type ButtonId = "go" | "new" | "rules" | "code";
type Overlay = "start" | "rules" | "pause" | "over" | "album" | null;

interface Best {
  tickets: number;
  supers: number;
}

interface Pop {
  text: string;
  x: number;
  y: number;
  t: number;
  color: string;
  size: number;
}

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

/** Something that just went over an edge, animated until it is gone. */
interface Faller {
  x: number;
  y: number;
  edge: "front" | "side";
  stack: number;
  kind: "coin" | "core" | "card";
  core: number;
  card: number;
  t: number;
}

/** A card just pushed off the front, flying up to the album button. */
interface CardFly {
  card: number;
  x: number;
  y: number;
  t: number;
}

/** Reels run at full speed for 60% of the spin, then brake evenly to a stop. */
function reelEase(k: number) {
  if (k < 0.6) return k / 0.8;
  const u = (k - 0.6) / 0.4;
  return 0.75 + 0.25 * (1 - (1 - u) * (1 - u));
}

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

/** A saved run, if it still has the shape this version expects. */
function parseRun(raw: unknown): State | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Partial<State>;
  if (
    r.v !== RULES_VERSION ||
    typeof r.seed !== "number" ||
    typeof r.coins !== "number" ||
    typeof r.tickets !== "number" ||
    typeof r.wheel !== "number" ||
    typeof r.pusherT !== "number" ||
    !Array.isArray(r.bodies) ||
    !Array.isArray(r.flights) ||
    !Array.isArray(r.queue) ||
    typeof r.cores !== "number" ||
    !Array.isArray(r.album) ||
    r.album.length !== CARD_COUNT
  )
    return null;
  return r as State;
}

function wrap(ctx: CanvasRenderingContext2D, str: string, maxW: number, size: number) {
  ctx.font = `800 ${size}px ${FONT}`;
  const lines: string[] = [];
  let line = "";
  for (const word of str.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxW && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

export function setup(rt: Runtime): GameHooks {
  const { stage, ctx } = rt;
  const { storage, audio, reportScore, coupons } = rt.game;
  const tr = () => STRINGS[rt.locale()];
  const cardImgs = CARD_IDS.map((id) => {
    const img = new Image();
    img.src = CARD_SRC[id];
    return img;
  });
  const sp = makeSprites(cardImgs);
  const robots = new Image();
  robots.src = robotsImg;
  const robotsReady = () => (robots.complete && robots.naturalWidth > 0 ? robots : null);

  let best: Best = storage.get<Best>("best", { tickets: 0, supers: 0 });
  /** The album outlives runs: storage is its home, the run carries a copy while it plays. */
  let album = normalizeAlbum(storage.get<unknown>(ALBUM_KEY, null));
  const saved = parseRun(storage.get<unknown>(RUN_KEY, null));
  let s: State = saved && !saved.over ? saved : createRun(newSeed(), undefined, album);
  s.album = [...album];
  let resumable = !!saved && !saved.over && saved.shots > 0;
  /** Coupon coins that arrived while no run was in play; they join the next run. */
  let pendingCoins = Math.max(0, Math.floor(Number(storage.get<unknown>(PENDING_KEY, 0)) || 0));
  let overlay: Overlay = "start";
  let rulesFrom: "start" | "pause" = "start";
  /** Where the album was opened from, so closing it goes back there. */
  let albumFrom: Overlay = null;
  let reported = false;
  let newBest = false;
  let overAt = -1;

  // Input
  /** Every pointer currently pressing SHOOT (a Set: a second finger must not overwrite the first). */
  const pointersHeld = new Set<number>();
  /** Auto-fire toggle: fires every FIRE_INTERVAL while coins remain. */
  let autoOn = false;
  let spaceHeld = false;
  /** A press that hasn't fired yet (a quick tap between two steps still counts). */
  let tap = false;

  // Display state
  let t = 0;
  let chase = 0;
  let shake = 0;
  let cheer = 0;
  let superFx = 0;
  let superWon = 0;
  let setFx = 0;
  let albumPulse = 0;
  let chuteGlow = 0;
  let saveT = 0;
  let shownCoins = s.coins;
  let shownTickets = s.tickets;
  let bumpCoins = 0;
  let bumpTickets = 0;
  let toast: { text: string; t: number; color: string } | null = null;
  let hit: { seg: number; t: number } | null = null;
  let lastSeg = segmentAt(s.wheel);
  let lastClink = 0;
  let lastDry = -9;
  const lampPulse = Array.from({ length: CORE_COUNT }, () => 0);
  const landed = new Map<number, number>();
  let pops: Pop[] = [];
  let bits: Bit[] = [];
  let fallers: Faller[] = [];
  let cardFlies: CardFly[] = [];
  /** The spin reel: which prize list it shows, where the strip is, and the run it is making. */
  let reelKind: SpinKind = "mini";
  let reelPos = 0;
  let reel: { from: number; to: number } | null = null;
  let lastReelCell = 0;

  const view = () => stage.view;

  // ---------------------------------------------------------------- sound

  const sfx = {
    shoot() {
      audio.tone({ freq: 220, to: 900, dur: 0.12, type: "sawtooth", vol: 0.045 });
      audio.tone({ freq: 1500, to: 2400, dur: 0.05, type: "square", vol: 0.02, delay: 0.03 });
    },
    tick() {
      audio.tone({ freq: 2100, dur: 0.012, type: "square", vol: 0.012 });
    },
    clink(v = 1) {
      if (t - lastClink < 0.045) return;
      lastClink = t;
      const f = 2500 + Math.random() * 700;
      audio.tone({ freq: f, dur: 0.05, type: "triangle", vol: 0.05 * v });
      audio.tone({ freq: f * 1.5, dur: 0.04, type: "sine", vol: 0.03 * v, delay: 0.018 });
    },
    win(value: number) {
      const notes = value >= 12 ? [784, 988, 1175, 1568] : value >= 6 ? [784, 988, 1175] : [880, 1175];
      for (const [i, f] of notes.entries()) audio.tone({ freq: f, dur: 0.09, type: "square", vol: 0.04, delay: i * 0.055 });
    },
    back(n: number) {
      for (let i = 0; i < Math.min(n, 3); i++)
        audio.tone({ freq: 2900 - i * 300, dur: 0.05, type: "triangle", vol: 0.05, delay: i * 0.05 });
      audio.tone({ freq: 1320, dur: 0.12, type: "sine", vol: 0.05, delay: 0.06 });
    },
    lost() {
      audio.tone({ freq: 200, to: 80, dur: 0.16, type: "sine", vol: 0.05 });
    },
    core() {
      for (const [i, f] of [523, 659, 784, 1047, 1319].entries()) audio.tone({ freq: f, dur: 0.16, type: "triangle", vol: 0.06, delay: i * 0.06 });
    },
    spinStart() {
      for (const [i, f] of [392, 523, 659, 784].entries()) audio.tone({ freq: f, dur: 0.1, type: "square", vol: 0.04, delay: i * 0.07 });
    },
    reelTick() {
      audio.tone({ freq: 1100, dur: 0.018, type: "square", vol: 0.02 });
    },
    spinWin(prize: number) {
      const n = prize >= 65 ? 8 : prize >= 30 ? 6 : 4;
      for (let i = 0; i < n; i++)
        audio.tone({ freq: [784, 988, 1175, 1568][i % 4] * (i >= 4 ? 2 : 1), dur: 0.1, type: "square", vol: 0.045, delay: i * 0.07 });
    },
    superBonus() {
      const tune = [523, 659, 784, 1047, 784, 1047, 1319, 1568];
      for (const [i, f] of tune.entries()) {
        audio.tone({ freq: f, dur: 0.16, type: "square", vol: 0.05, delay: i * 0.11 });
        audio.tone({ freq: f / 2, dur: 0.16, type: "triangle", vol: 0.05, delay: i * 0.11 });
      }
      audio.noise(0.4, 0.06);
    },
    reset() {
      audio.tone({ freq: 880, to: 220, dur: 0.4, type: "triangle", vol: 0.04 });
    },
    card(fresh: boolean) {
      const notes = fresh ? [988, 1319, 1568, 1976] : [988, 1319];
      for (const [i, f] of notes.entries()) audio.tone({ freq: f, dur: 0.12, type: "triangle", vol: 0.05, delay: i * 0.07 });
    },
    setDone() {
      const tune = [659, 784, 988, 1319, 988, 1319, 1568, 1976, 2637];
      for (const [i, f] of tune.entries()) {
        audio.tone({ freq: f, dur: 0.14, type: "triangle", vol: 0.055, delay: i * 0.09 });
        audio.tone({ freq: f / 2, dur: 0.14, type: "square", vol: 0.03, delay: i * 0.09 });
      }
      audio.noise(0.5, 0.05);
    },
    dry() {
      audio.tone({ freq: 110, dur: 0.18, type: "square", vol: 0.05 });
    },
    over() {
      for (const [i, f] of [784, 659, 523, 392].entries()) audio.tone({ freq: f, dur: 0.18, type: "triangle", vol: 0.05, delay: i * 0.12 });
    },
  };

  // ---------------------------------------------------------------- feedback

  function burst(x: number, y: number, n: number, colors: string[], speed = 260) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.8);
      const life = 0.5 + Math.random() * 0.6;
      bits.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 120,
        life,
        max: life,
        color: colors[i % colors.length],
        size: 2.5 + Math.random() * 4,
      });
    }
  }

  function pop(str: string, x: number, y: number, color = GOLD, size = 30) {
    pops.push({ text: str, x, y, t: 0, color, size });
  }

  function say(str: string, color = GOLD) {
    toast = { text: str, t: 0, color };
  }

  const pointerTip = CHUTE[CHUTE.length - 1];

  /** Start the reel strip on a run that ends on prize `idx`. */
  function aimReel(kind: SpinKind, idx: number) {
    reelKind = kind;
    const n = cellsOf(kind).length;
    const from = reelPos;
    const at = ((Math.round(from) % n) + n) % n;
    reel = { from, to: Math.round(from) + n * 5 + ((idx - at + n) % n) };
  }

  const lampX = (i: number) => W / 2 - (58 * (CORE_COUNT - 1)) / 2 + i * 58;

  function onEvent(e: GameEvent) {
    const l = tr();
    switch (e.type) {
      case "shoot":
        sfx.shoot();
        chuteGlow = 1;
        break;
      case "dry":
        if (t - lastDry > 1.2) {
          lastDry = t;
          sfx.dry();
          say(l.noCoins, PINK);
        }
        break;
      case "hit": {
        hit = { seg: e.seg, t: 0 };
        sfx.clink(1.2);
        burst(pointerTip.x - 10, pointerTip.y, 10, ["#ffffff", GOLD, NEON], 200);
        const seg = e.segment;
        if (seg.kind === "coins") {
          pop(l.coinRain(seg.value), pointerTip.x - 50, pointerTip.y - 30, GOLD, seg.value >= 6 ? 34 : 28);
          if (seg.value >= 6) cheer = Math.max(cheer, 1);
          sfx.win(seg.value * 2);
        } else if (seg.kind === "core") {
          burst(pointerTip.x - 20, pointerTip.y, 24, CORE_COLORS, 260);
          sfx.core();
          cheer = Math.max(cheer, 1.2);
        } else if (seg.kind === "card") {
          burst(pointerTip.x - 20, pointerTip.y, 24, [PINK, "#ffffff", "#ffd6ea"], 260);
          sfx.card(true);
          cheer = Math.max(cheer, 1.2);
        }
        break;
      }
      case "tickets":
        bumpTickets = 1;
        if (e.source === "wheel") {
          pop(
            `+${e.amount}`,
            pointerTip.x - 34 + (Math.random() - 0.5) * 36,
            pointerTip.y - 26 - Math.random() * 20,
            e.amount >= 10 ? GOLD : "#ffffff",
            e.amount >= 10 ? 40 : 30,
          );
          sfx.win(e.amount);
          if (e.amount >= 10) cheer = Math.max(cheer, 1);
        }
        break;
      case "coinsWon":
        bumpCoins = 1;
        sfx.back(3);
        pop(l.coinsWon(e.amount), REEL.x + REEL.w - 80, REEL.y - 16, MINT, 34);
        break;
      case "land":
        landed.set(e.id, 0);
        sfx.clink(e.kind === "coin" ? 0.6 : 0.5);
        break;
      case "fall":
        if (e.edge === "front" && e.kind === "card") {
          const p = proj(e.x, SHELF_D);
          cardFlies.push({ card: e.card, x: p.x, y: p.y, t: 0 });
          burst(p.x, p.y, 26, [PINK, "#ffffff", GOLD], 300);
          pop(`+${CARD_TICKETS}`, p.x, p.y - 30, GOLD, 34);
          break;
        }
        fallers.push({ x: e.x, y: e.y, edge: e.edge, stack: e.stack, kind: e.kind, core: e.core, card: e.card, t: 0 });
        if (e.edge === "front") {
          const p = proj(e.x, SHELF_D);
          if (e.kind === "core") {
            burst(p.x, p.y, 30, [CORE_COLORS[e.core], "#ffffff", GOLD], 320);
            cheer = Math.max(cheer, 2);
          } else {
            sfx.back(e.stack);
            bumpCoins = 1;
            pop(`+${e.stack}`, p.x, p.y - 14, MINT, e.stack > 1 ? 30 : 24);
          }
        } else sfx.lost();
        break;
      case "coreIn": {
        const i = Math.min(e.count, CORE_COUNT) - 1;
        lampPulse[i] = 1;
        sfx.core();
        say(l.coreIn(Math.min(e.count, CORE_COUNT), CORE_COUNT), CORE_COLORS[i]);
        burst(lampX(i), LAMPS_Y, 22, [CORE_COLORS[i], "#ffffff"], 240);
        break;
      }
      case "card": {
        albumPulse = 1;
        sfx.card(e.fresh);
        const name = l.cards[CARD_IDS[e.card]];
        say(`${name} · ${e.fresh ? l.cardNew : l.cardDupe}`, e.fresh ? PINK : "#ffd6ea");
        cheer = Math.max(cheer, 1.2);
        break;
      }
      case "setComplete":
        setFx = SET_TIME;
        shake = Math.max(shake, 0.6);
        cheer = SET_TIME;
        sfx.setDone();
        for (let i = 0; i < 6; i++) burst(60 + i * 84, 300 + (i % 2) * 200, 26, [PINK, GOLD, NEON, MINT], 380);
        break;
      case "spinStart":
        sfx.spinStart();
        aimReel(e.kind, e.idx);
        if (e.kind === "super") {
          say(l.superSpin, PINK);
          shake = Math.max(shake, 0.4);
          cheer = Math.max(cheer, 2);
        } else say(l.miniSpin, GOLD);
        break;
      case "spinWin": {
        const big = e.kind === "super" || e.prize.value >= 40;
        sfx.spinWin(e.kind === "super" ? 100 : e.prize.value);
        if (e.prize.kind === "tickets") pop(`+${e.prize.value}`, REEL.x + REEL.w - 70, REEL.y - 16, GOLD, big ? 46 : 38);
        burst(REEL.x + REEL.w - 70, REEL.y + REEL.h / 2, big ? 40 : 22, [GOLD, "#ffffff", PINK], 300);
        cheer = Math.max(cheer, 1.5);
        if (big) shake = Math.max(shake, 0.3);
        if (e.kind === "super") {
          superFx = SUPER_FX;
          superWon = e.prize.value;
          shake = 0.9;
          cheer = SUPER_FX;
          sfx.superBonus();
          for (let i = 0; i < 6; i++) burst(60 + i * 84, 300 + (i % 2) * 200, 26, CORE_COLORS, 380);
        }
        break;
      }
      case "superReset":
        sfx.reset();
        break;
      case "over":
        overAt = t;
        sfx.over();
        finish();
        break;
    }
  }

  function finish() {
    if (reported) return;
    reported = true;
    storage.set(RUN_KEY, null);
    resumable = false;
    newBest = s.tickets > best.tickets;
    if (newBest) {
      best = { tickets: s.tickets, supers: Math.max(best.supers, s.supers) };
      storage.set("best", best);
      storage.set(SUMMARY_KEY, { vi: STRINGS.vi.summary(best.tickets), en: STRINGS.en.summary(best.tickets) });
    }
    if (s.tickets > 0) reportScore?.({ score: s.tickets, detail: tr().detail(s.tickets, s.supers) });
  }

  function save() {
    if (s.over || s.shots === 0) return;
    storage.set(RUN_KEY, s);
  }

  /** Keep the album's home copy in step with the run (and the run saved with it). */
  function storeAlbum() {
    album = [...s.album];
    storage.set(ALBUM_KEY, album);
    save();
  }

  /** Move stored coupon coins into a run that has not started shooting yet. */
  function claimPending() {
    if (pendingCoins <= 0 || s.over || s.shots > 0) return;
    const added = grantCoins(s, pendingCoins);
    pendingCoins = 0;
    storage.set(PENDING_KEY, null);
    shownCoins = s.coins - added;
    if (added > 0) bumpCoins = 1;
  }

  function newRun() {
    autoOn = false;
    pointersHeld.clear();
    s = createRun(newSeed(), undefined, album);
    claimPending();
    reported = false;
    newBest = false;
    overAt = -1;
    shownCoins = s.coins;
    shownTickets = s.tickets;
    fallers = [];
    cardFlies = [];
    pops = [];
    landed.clear();
    reel = null;
    superFx = 0;
    setFx = 0;
    storage.set(RUN_KEY, null);
    resumable = false;
    overlay = null;
  }

  // ---------------------------------------------------------------- overlay buttons

  const PANEL: Rect = { x: 40, y: 236, w: 460, h: 428 };
  const startButtons = (): { rect: Rect; id: ButtonId }[] => {
    const list: { rect: Rect; id: ButtonId }[] = [{ rect: { x: 100, y: 500, w: 340, h: 66 }, id: "go" }];
    if (resumable) list.push({ rect: { x: 100, y: 578, w: 164, h: 56 }, id: "new" }, { rect: { x: 276, y: 578, w: 164, h: 56 }, id: "rules" });
    else list.push({ rect: { x: 140, y: 578, w: 260, h: 56 }, id: "rules" });
    return list;
  };
  const pauseButtons = (): { rect: Rect; id: ButtonId }[] => [
    { rect: { x: 100, y: 390, w: 340, h: 66 }, id: "go" },
    { rect: { x: 100, y: 470, w: 164, h: 56 }, id: "rules" },
    { rect: { x: 276, y: 470, w: 164, h: 56 }, id: "new" },
    ...(coupons ? [{ rect: { x: 100, y: 538, w: 340, h: 56 }, id: "code" as const }] : []),
  ];
  const RULE_LINE = 28;
  const RULE_GAP = 14;
  /** The rules card hugs its text (the line count depends on the language). */
  const rulesRect = (): Rect => {
    let lines = 0;
    for (const line of tr().rulesLines) lines += wrap(ctx, line, 400, 19).length;
    const h = 106 + lines * RULE_LINE + tr().rulesLines.length * RULE_GAP + 96;
    return { x: 24, y: H / 2 - h / 2, w: 492, h };
  };
  const rulesClose = (): Rect => {
    const r = rulesRect();
    return { x: 150, y: r.y + r.h - 84, w: 240, h: 60 };
  };
  const AGAIN: Rect = { x: 110, y: 600, w: 320, h: 66 };

  function press(id: ButtonId, from: "start" | "pause") {
    audio.tone({ freq: 660, dur: 0.06, type: "square", vol: 0.04 });
    if (id === "go") {
      claimPending();
      overlay = null;
    } else if (id === "code") coupons?.open();
    else if (id === "new") newRun();
    else {
      rulesFrom = from;
      overlay = "rules";
    }
  }

  function onSpace(down: boolean) {
    spaceHeld = down;
    if (down && overlay === null) tap = true;
  }

  // ---------------------------------------------------------------- update

  function step(dt: number) {
    t += dt;
    // A resumed run waits behind the menu; a fresh one idles there (wheel and pusher moving)
    const frozen =
      overlay === "pause" ||
      overlay === "album" ||
      (overlay === "rules" && rulesFrom === "pause") ||
      (overlay !== null && overlay !== "over" && resumable);
    if (!frozen) {
      const live = overlay === null;
      const shoot = live && (pointersHeld.size > 0 || spaceHeld || tap || (autoOn && s.coins > 0));
      const evs = update(s, { shoot }, dt);
      // A tap is spent once the machine has answered it (a shot, or the dry click)
      if (evs.some((e) => e.type === "shoot" || e.type === "dry")) tap = false;
      for (const e of evs) onEvent(e);
      if (evs.some((e) => e.type === "card" || e.type === "setComplete")) storeAlbum();
      if (autoOn && (s.coins <= 0 || s.over || !live)) autoOn = false;
      const seg = segmentAt(s.wheel);
      if (seg !== lastSeg) {
        lastSeg = seg;
        if (live) sfx.tick();
      }
      if (live) {
        saveT += dt;
        if (saveT > SAVE_EVERY) {
          saveT = 0;
          save();
        }
      }
    }
    if (s.over && overlay === null && overAt >= 0 && t - overAt > 1.1) overlay = "over";

    // Lights and counters
    const busyReels = s.spin !== null;
    chase += dt * (superFx > 0 || setFx > 0 ? 24 : busyReels ? 14 : 5);
    shake = Math.max(0, shake - dt);
    cheer = Math.max(0, cheer - dt);
    superFx = Math.max(0, superFx - dt);
    setFx = Math.max(0, setFx - dt);
    albumPulse = Math.max(0, albumPulse - dt * 1.2);
    chuteGlow = Math.max(0, chuteGlow - dt * 4);
    bumpCoins = Math.max(0, bumpCoins - dt * 4);
    bumpTickets = Math.max(0, bumpTickets - dt * 4);
    for (let i = 0; i < lampPulse.length; i++) lampPulse[i] = Math.max(0, lampPulse[i] - dt * 1.5);
    if (hit) {
      hit.t += dt;
      if (hit.t > 0.6) hit = null;
    }
    if (toast) {
      toast.t += dt;
      if (toast.t > 1.6) toast = null;
    }
    const roll = (shown: number, real: number) => {
      const d = real - shown;
      if (Math.abs(d) < 0.5) return real;
      return shown + Math.sign(d) * Math.max(dt * 30, Math.abs(d) * dt * 6);
    };
    shownCoins = roll(shownCoins, s.coins);
    shownTickets = roll(shownTickets, s.tickets);
    for (const [id, k] of landed) {
      if (k > 0.2) landed.delete(id);
      else landed.set(id, k + dt);
    }

    // The spin reel (a resumed run may come back mid-spin)
    if (s.spin && !reel) aimReel(s.spin.kind, s.spin.idx);
    if (s.spin && reel) {
      const k = clamp(s.spin.t / spinTimeOf(s.spin.kind), 0, 1);
      reelPos = reel.from + (reel.to - reel.from) * reelEase(k);
      const cell = Math.floor(reelPos);
      if (cell !== lastReelCell) {
        lastReelCell = cell;
        if (k < 1) sfx.reelTick();
      }
    } else reel = null;

    // Particles and pops
    for (const b of bits) {
      b.vy += 700 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
    }
    bits = bits.filter((b) => b.life > 0);
    for (const p of pops) p.t += dt;
    pops = pops.filter((p) => p.t < 1);
    for (const f of fallers) f.t += dt;
    fallers = fallers.filter((f) => f.t < (f.edge === "front" && f.kind === "coin" ? 0.8 : 0.55));
    for (const c of cardFlies) c.t += dt;
    cardFlies = cardFlies.filter((c) => c.t < CARD_FLY);
    if (bits.length > 400) bits.splice(0, bits.length - 400);
  }

  // ---------------------------------------------------------------- render

  function drawFlights() {
    const py = pusherAt(s.pusherT).y;
    for (const f of s.flights) {
      if (f.t < 0) continue;
      if (f.phase === "up") {
        const k = f.t / FLIGHT_UP;
        const p = along(CHUTE, k);
        const q = along(CHUTE, k - 0.05);
        ctx.save();
        ctx.strokeStyle = "rgba(255,220,120,0.6)";
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(q.x, q.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.restore();
        drawFlyingCoin(ctx, sp, p.x, p.y, 22, f.t * 30);
        continue;
      }
      const k = clamp(f.t / FLIGHT_DOWN, 0, 1);
      const end = proj(f.x, py + 16);
      if (f.kind === "core") {
        const y = lerpN(330, end.y, k * k);
        const img = sp.cores[f.core];
        const w = 48 * end.s;
        ctx.save();
        ctx.shadowColor = CORE_COLORS[f.core];
        ctx.shadowBlur = 20;
        ctx.drawImage(img, end.x - w / 2, y - w * 1.1, w, w * (img.height / img.width));
        ctx.restore();
        continue;
      }
      if (f.kind === "card") {
        // Flutters down, flipping, to where it will land
        const y = lerpN(330, end.y, k * k);
        const w = 40 * end.s;
        ctx.save();
        ctx.translate(end.x, y - w * 0.6);
        ctx.rotate(Math.sin(f.t * 9) * 0.25);
        ctx.scale(Math.max(0.2, Math.abs(Math.cos(f.t * 7))), 1);
        ctx.shadowColor = PINK;
        ctx.shadowBlur = 18;
        drawCardFace(ctx, sp.cards[f.card] ?? null, -w / 2, (-w * 2) / 3, w, (w * 4) / 3, true);
        ctx.restore();
        continue;
      }
      const from = pointerTip;
      const cx = (from.x + end.x) / 2;
      const cy = Math.min(from.y, end.y) - 60;
      const x = (1 - k) * (1 - k) * from.x + 2 * (1 - k) * k * cx + k * k * end.x;
      const y = (1 - k) * (1 - k) * from.y + 2 * (1 - k) * k * cy + k * k * end.y;
      drawFlyingCoin(ctx, sp, x, y, lerpN(20, 30 * end.s, k), f.t * 22);
    }
  }

  const lerpN = (a: number, b: number, k: number) => a + (b - a) * k;

  function drawFallers() {
    for (const f of fallers) {
      const p = proj(f.x, f.edge === "front" ? SHELF_D : f.y);
      if (f.edge === "front") {
        const k = Math.min(f.t, 0.35);
        const x = p.x;
        const y = p.y + 200 * k + 900 * k * k;
        if (f.t < 0.35) {
          ctx.globalAlpha = 1 - k / 0.5;
          if (f.kind === "core") {
            const img = sp.cores[f.core];
            ctx.drawImage(img, x - 26, y - 40, 52, 52 * (img.height / img.width));
          } else for (let i = 0; i < f.stack; i++) drawFlyingCoin(ctx, sp, x + i * 8, y - i * 6, 30, f.t * 20 + i);
          ctx.globalAlpha = 1;
        } else if (f.kind === "coin") {
          // Back to the coin counter
          const q = easeOutCubic((f.t - 0.35) / 0.45);
          const tx = COINS_BOX.x + COINS_BOX.w / 2;
          const ty = COINS_BOX.y + COINS_BOX.h / 2;
          const sx = x;
          const sy = p.y + 200 * 0.35 + 900 * 0.35 * 0.35;
          for (let i = 0; i < f.stack; i++)
            drawFlyingCoin(ctx, sp, lerpN(sx, tx, q) + i * 6, lerpN(sy, ty, q) - Math.sin(q * Math.PI) * 60 - i * 6, 24 * (1 - q * 0.4), f.t * 20);
        }
      } else {
        const dir = f.x < 220 ? -1 : 1;
        const x = p.x + dir * 90 * f.t;
        const y = p.y + 500 * f.t * f.t;
        ctx.globalAlpha = Math.max(0, 1 - f.t / 0.55);
        if (f.kind === "core") {
          const img = sp.cores[f.core];
          ctx.drawImage(img, x - 22, y - 34, 44, 44 * (img.height / img.width));
        } else if (f.kind === "card") {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(dir * f.t * 6);
          drawCardFace(ctx, sp.cards[f.card] ?? null, -16, -21, 32, 43, true);
          ctx.restore();
        } else drawFlyingCoin(ctx, sp, x, y, 26 * p.s, 1.2 + f.t * 8);
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawMachine() {
    const l = tr();
    const v = view();
    const rainbow = superFx > 0 || setFx > 0 || s.spin?.kind === "super";
    drawBackground(ctx, sp, v, t);
    drawCabinet(ctx, v, t, chase, rainbow);
    // Title on the cabinet's crown when the phone is tall enough to show it
    if (v.y < -50) neon(ctx, l.title, W / 2, v.y / 2, fitSize(ctx, l.title, 40, 380), NEON, 1);
    drawMarquee(ctx, l.marquee(Math.max(...SUPER_PRIZES)), t, rainbow);
    // Menu button
    ctx.save();
    ctx.fillStyle = "rgba(10,8,32,0.85)";
    ctx.strokeStyle = "rgba(79,243,255,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(MENU_BTN.x, MENU_BTN.y, MENU_BTN.w, MENU_BTN.h, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 3; i++) ctx.fillRect(MENU_BTN.x + 27, MENU_BTN.y + 12 + i * 6, 24, 3);
    text(ctx, l.menu, MENU_BTN.x + MENU_BTN.w / 2, MENU_BTN.y + 41, 14, "#ffffff", "center", null);
    ctx.restore();
    drawAlbumButton(ctx, ALBUM_BTN, l.album, ownedCount(s.album), CARD_COUNT, albumPulse);
    betaTag(ctx, 488, 86, l.beta);
    drawCoreLamps(ctx, sp, s.cores, CORE_COUNT, t, superFx > 0, lampPulse);
    drawRobots(ctx, robotsReady(), t, cheer);
    drawWheel(ctx, sp, s.wheel, t, chase, hit);
    drawGlass(ctx, { x: 120, y: 112, w: 300, h: 300 }, t);

    // Reels and the spins counter
    const spinning = s.spin !== null;
    const reelLabel = !s.spin ? l.youWin : s.spin.kind === "super" ? "SUPER" : "MINI";
    drawReels(ctx, reelLabel, cellsOf(reelKind), reelPos, spinning, !!s.spin?.paid, t, s.spin?.kind === "super");
    drawCounter(ctx, SPINS_BOX, l.spins, s.queue.length, PINK, 2, 0);

    // The shelf
    drawShelf(ctx, t);
    const py = pusherAt(s.pusherT).y;
    drawPusher(ctx, py, t, rainbow);
    const order = [...s.bodies].sort((a, b) => a.y - b.y || a.id - b.id);
    for (const b of order) drawShadow(ctx, b);
    for (const b of order) {
      const k = landed.get(b.id);
      drawBody(ctx, sp, b, t, k === undefined ? 0 : Math.max(0, 1 - k / 0.18));
    }
    drawFrontLip(ctx, chase, rainbow);
    drawFallers();
    drawGlass(ctx, { x: 30, y: 476, w: 480, h: 340 }, t + 4);
    drawChute(ctx, chuteGlow);
    drawFlights();

    // Controls
    drawCounter(ctx, COINS_BOX, l.coins, shownCoins, MINT, 4, bumpCoins);
    drawCounter(ctx, TICKETS_BOX, l.tickets, shownTickets, AMBER, 5, bumpTickets);
    const pressed = pointersHeld.size > 0 || spaceHeld;
    drawShootButton(ctx, l.shoot, pressed, t, s.coins > 0 && !s.over);
    drawAutoButton(ctx, AUTO_BTN, l.auto, autoOn ? l.on : l.off, autoOn, s.coins > 0 && !s.over);
    drawTray(ctx, sp, shownCoins, view());
    if (s.shots < 6 && overlay === null)
      text(ctx, l.holdHint, W / 2, SHELF_BOTTOM + 38, 15, "#cfd6ff", "center", INK);
  }

  function drawFx() {
    for (const b of bits) {
      ctx.globalAlpha = Math.min(1, (b.life / b.max) * 1.5);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x - b.size / 2, b.y - b.size / 2, b.size, b.size);
    }
    ctx.globalAlpha = 1;
    for (const p of pops) {
      const k = p.t;
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      const scale = k < 0.12 ? 0.6 + (k / 0.12) * 0.5 : 1.1 - Math.min(0.1, (k - 0.12) * 0.4);
      text(ctx, p.text, p.x, p.y - k * 50, p.size * scale, p.color);
    }
    ctx.globalAlpha = 1;
    if (toast) {
      const k = toast.t;
      const a = k < 0.15 ? k / 0.15 : k > 1.3 ? 1 - (k - 1.3) / 0.3 : 1;
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(8,6,28,0.82)";
      ctx.beginPath();
      ctx.roundRect(W / 2 - 150, TOAST_Y - 22, 300, 44, 22);
      ctx.fill();
      ctx.strokeStyle = toast.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      text(ctx, toast.text, W / 2, TOAST_Y + 1, fitSize(ctx, toast.text, 26, 280), toast.color);
      ctx.globalAlpha = 1;
    }
    for (const c of cardFlies) {
      // Pop up off the front edge, then arc into the album button
      const k = c.t / CARD_FLY;
      const q = easeOutCubic(clamp((k - 0.25) / 0.75, 0, 1));
      const tx = ALBUM_BTN.x + 20;
      const ty = ALBUM_BTN.y + 20;
      const x = lerpN(c.x, tx, q);
      const y = lerpN(c.y - 40 * Math.min(1, k / 0.25), ty, q) - Math.sin(q * Math.PI) * 80;
      const w = lerpN(64, 18, q);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((1 - q) * 0.2 - 0.12 * q);
      ctx.shadowColor = PINK;
      ctx.shadowBlur = 20;
      drawCardFace(ctx, sp.cards[c.card] ?? null, -w / 2, (-w * 2) / 3, w, (w * 4) / 3, true);
      ctx.restore();
    }
    if (setFx > 0) drawSetCelebration();
    if (superFx > 0) {
      const k = SUPER_FX - superFx;
      const l = tr();
      const pop = k < 0.3 ? easeOutCubic(k / 0.3) : 1;
      const fade = superFx < 0.4 ? superFx / 0.4 : 1;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.fillStyle = "rgba(10,4,30,0.72)";
      ctx.fillRect(0, WHEEL_C.y - 78, W, 156);
      ctx.translate(W / 2, WHEEL_C.y - 18);
      ctx.scale(pop, pop);
      ctx.rotate(Math.sin(t * 6) * 0.03);
      neon(ctx, l.superSpin, 0, 0, fitSize(ctx, l.superSpin, 62, 480), CORE_COLORS[Math.floor(t * 10) % 6], 1.8);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = fade;
      neon(ctx, `+${superWon} ${l.tickets}`, W / 2, WHEEL_C.y + 44, 40, GOLD, 1.4);
      ctx.restore();
      if (Math.random() < 0.5) burst(Math.random() * W, WHEEL_C.y - 70, 3, CORE_COLORS, 160);
    }
  }

  /** All ten cards fanned out over the wheel, with the set bonus. */
  function drawSetCelebration() {
    const l = tr();
    const k = SET_TIME - setFx;
    const grow = k < 0.4 ? easeOutCubic(k / 0.4) : 1;
    const fade = setFx < 0.5 ? setFx / 0.5 : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = "rgba(10,4,30,0.8)";
    ctx.fillRect(0, WHEEL_C.y - 150, W, 330);
    for (let i = 0; i < CARD_COUNT; i++) {
      const a = (i - (CARD_COUNT - 1) / 2) * 0.13 * grow;
      ctx.save();
      ctx.translate(W / 2, WHEEL_C.y + 330);
      ctx.rotate(a);
      ctx.translate(0, -360 - Math.sin(t * 5 + i) * 4);
      ctx.shadowColor = CORE_COLORS[i % 6];
      ctx.shadowBlur = 16;
      drawCardFace(ctx, sp.cards[i] ?? null, -36, -48, 72, 96, true);
      ctx.restore();
    }
    ctx.translate(W / 2, WHEEL_C.y + 70);
    ctx.scale(grow, grow);
    ctx.rotate(Math.sin(t * 6) * 0.03);
    neon(ctx, l.setDone, 0, 0, fitSize(ctx, l.setDone, 52, 480), PINK, 1.8);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = fade;
    neon(ctx, l.setBonus(SET_TICKETS), W / 2, WHEEL_C.y + 128, 40, GOLD, 1.4);
    ctx.restore();
    if (Math.random() < 0.5) burst(Math.random() * W, WHEEL_C.y - 120, 3, [PINK, GOLD, NEON, MINT], 160);
  }

  // The album card: a 5×2 grid of cards with their names
  const ALBUM: Rect = { x: 16, y: H / 2 - 272, w: 508, h: 544 };
  const ALBUM_CARD = { w: 86, h: 115, gap: 9, row: 158 };
  const albumClose = (): Rect => ({ x: 150, y: ALBUM.y + ALBUM.h - 82, w: 240, h: 58 });

  function drawAlbum() {
    const l = tr();
    const r = ALBUM;
    panel(ctx, r, 24);
    neon(ctx, l.albumTitle, W / 2, r.y + 46, fitSize(ctx, l.albumTitle, 36, r.w - 60), PINK);
    text(ctx, l.albumNote(CARD_TICKETS, SET_TICKETS), W / 2, r.y + 86, fitSize(ctx, l.albumNote(CARD_TICKETS, SET_TICKETS), 18, r.w - 40), "#d6dcff", "center", null);
    const x0 = W / 2 - (5 * ALBUM_CARD.w + 4 * ALBUM_CARD.gap) / 2;
    for (let i = 0; i < CARD_COUNT; i++) {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const x = x0 + col * (ALBUM_CARD.w + ALBUM_CARD.gap);
      const y = r.y + 112 + row * ALBUM_CARD.row;
      const owned = s.album[i];
      ctx.save();
      if (owned) {
        ctx.shadowColor = CORE_COLORS[i % 6];
        ctx.shadowBlur = 12;
      }
      drawCardFace(ctx, sp.cards[i] ?? null, x, y, ALBUM_CARD.w, ALBUM_CARD.h, owned);
      ctx.restore();
      const lines = wrap(ctx, l.cards[CARD_IDS[i]], ALBUM_CARD.w + 6, 13).slice(0, 2);
      for (const [j, ln] of lines.entries())
        text(ctx, ln, x + ALBUM_CARD.w / 2, y + ALBUM_CARD.h + 13 + j * 15, 13, owned ? "#ffffff" : "#7d7aa8", "center", null);
    }
    const owned = ownedCount(s.album);
    text(ctx, `${owned}/${CARD_COUNT}`, W / 2, r.y + 112 + 2 * ALBUM_CARD.row + 4, 26, owned > 0 ? GOLD : "#bfc6ff", "center", null, LED_FONT, 700);
    button(ctx, albumClose(), l.close, ["#ff7eb6", "#c0306e"], 26);
  }

  function drawOverlay() {
    const l = tr();
    if (!overlay) return;
    const v = view();
    ctx.fillStyle = "rgba(4,3,14,0.66)";
    ctx.fillRect(v.x, v.y, v.w, v.h);
    if (overlay === "album") drawAlbum();
    else if (overlay === "start") {
      panel(ctx, PANEL, 26);
      neon(ctx, l.title, W / 2, 300, fitSize(ctx, l.title, 58, 400), NEON, 1.3);
      text(ctx, l.subtitle, W / 2, 352, 22, "#d6dcff", "center", null);
      betaTag(ctx, W / 2, 392, l.beta);
      text(ctx, l.betaNote(s.coins), W / 2, 424, 18, MINT, "center", null);
      if (best.tickets > 0) text(ctx, l.best(best.tickets), W / 2, 460, 20, AMBER, "center", null);
      for (const b of startButtons()) {
        const label = b.id === "go" ? (resumable ? l.resume : l.start) : b.id === "new" ? l.newRun : l.rules;
        button(ctx, b.rect, label, b.id === "go" ? ["#ffb03a", "#e0560e"] : ["#3a8bff", "#2340b0"], b.id === "go" ? 30 : 22);
      }
    } else if (overlay === "pause") {
      panel(ctx, { x: 60, y: 290, w: 420, h: coupons ? 322 : 270 }, 24);
      neon(ctx, l.paused, W / 2, 344, 40, NEON);
      for (const b of pauseButtons()) {
        const label = b.id === "go" ? l.resume : b.id === "new" ? l.newRun : b.id === "code" ? l.enterCode : l.rules;
        button(ctx, b.rect, label, b.id === "go" ? ["#ffb03a", "#e0560e"] : ["#3a8bff", "#2340b0"], b.id === "go" ? 28 : 20);
      }
    } else if (overlay === "rules") {
      const r = rulesRect();
      panel(ctx, r, 24);
      neon(ctx, l.rules, W / 2, r.y + 50, 38, NEON);
      let y = r.y + 106;
      l.rulesLines.forEach((line, i) => {
        ctx.fillStyle = [NEON, GOLD, MINT, CORE_COLORS[i % 6], PINK, AMBER][i % 6];
        ctx.beginPath();
        ctx.arc(64, y + 1, 7, 0, Math.PI * 2);
        ctx.fill();
        for (const ln of wrap(ctx, line, 400, 19)) {
          text(ctx, ln, 84, y, 19, "#eef0ff", "left", null);
          y += RULE_LINE;
        }
        y += RULE_GAP;
      });
      button(ctx, rulesClose(), l.close, ["#ffb03a", "#e0560e"], 26);
    } else if (overlay === "over") {
      const r: Rect = { x: 50, y: 250, w: 440, h: 450 };
      panel(ctx, r, 26);
      neon(ctx, l.over, W / 2, 312, fitSize(ctx, l.over, 52, 400), PINK, 1.4);
      text(ctx, l.totalTickets, W / 2, 374, 22, "#d6dcff", "center", null);
      ctx.save();
      ctx.font = `700 96px ${LED_FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = AMBER;
      ctx.shadowBlur = 24;
      ctx.fillStyle = AMBER;
      ctx.fillText(String(Math.round(shownTickets)), W / 2, 448);
      ctx.restore();
      text(ctx, l.supersLine(s.supers), W / 2, 510, 22, s.supers > 0 ? GOLD : "#bfc6ff", "center", null);
      if (s.sets > 0) text(ctx, l.setsLine(s.sets), W / 2, 540, 20, PINK, "center", null);
      if (newBest) neon(ctx, l.newBest, W / 2, 574, 28, MINT);
      else text(ctx, l.best(best.tickets), W / 2, 574, 20, AMBER, "center", null);
      button(ctx, AGAIN, l.again, ["#ffb03a", "#e0560e"], 30);
    }
  }

  // ---------------------------------------------------------------- input

  function inShoot(p: PointerInfo) {
    return Math.hypot(p.x - SHOOT.x, p.y - SHOOT.y) < SHOOT.r + 26;
  }

  function openAlbum(from: Overlay) {
    audio.tone({ freq: 880, dur: 0.06, type: "triangle", vol: 0.04 });
    pointersHeld.clear();
    albumFrom = from;
    overlay = "album";
  }

  function down(p: PointerInfo) {
    if (overlay === "start") {
      for (const b of startButtons()) if (inRect(p, b.rect)) return press(b.id, "start");
      if (inRect(p, ALBUM_BTN)) openAlbum("start");
      return;
    }
    if (overlay === "pause") {
      for (const b of pauseButtons()) if (inRect(p, b.rect)) return press(b.id, "pause");
      return;
    }
    if (overlay === "rules") {
      if (inRect(p, rulesClose()) || !inRect(p, rulesRect())) overlay = rulesFrom;
      return;
    }
    if (overlay === "album") {
      if (inRect(p, albumClose()) || !inRect(p, ALBUM)) overlay = albumFrom;
      return;
    }
    if (overlay === "over") {
      if (inRect(p, AGAIN)) newRun();
      return;
    }
    if (inRect(p, { x: MENU_BTN.x - 6, y: MENU_BTN.y - 6, w: MENU_BTN.w + 12, h: MENU_BTN.h + 12 })) {
      overlay = "pause";
      save();
      return;
    }
    if (inRect(p, { x: ALBUM_BTN.x - 6, y: ALBUM_BTN.y - 6, w: ALBUM_BTN.w + 12, h: ALBUM_BTN.h + 6 })) {
      openAlbum(null);
      return;
    }
    if (inShoot(p)) {
      pointersHeld.add(p.id);
      tap = true;
      return;
    }
    if (inRect(p, { x: AUTO_BTN.x - 8, y: AUTO_BTN.y - 8, w: AUTO_BTN.w + 16, h: AUTO_BTN.h + 16 })) {
      if (autoOn) autoOn = false;
      else if (s.coins > 0 && !s.over) autoOn = true;
      audio.tone({ freq: autoOn ? 740 : 520, dur: 0.05, type: "square", vol: 0.04 });
    }
  }

  // Coupons: coins only, never tickets, never a score report. A run in play gets
  // them at once; otherwise they wait in storage for the next run.
  const offGrant = coupons?.onGrant((grant) => {
    let coins = 0;
    for (const r of grant.rewards) if (r.kind === "coins" && r.amount > 0) coins += Math.floor(r.amount);
    if (coins <= 0) return;
    const live = !s.over && s.shots > 0;
    if (live) {
      grantCoins(s, coins);
      save();
    } else {
      pendingCoins += coins;
      storage.set(PENDING_KEY, pendingCoins);
    }
    bumpCoins = 1;
    audio.tone({ freq: 880, dur: 0.1, type: "triangle", vol: 0.05 });
    pop(tr().couponCoins(coins), COINS_BOX.x + COINS_BOX.w / 2, COINS_BOX.y + COINS_BOX.h + 30, MINT, 34);
    say(tr().couponCoins(coins), MINT);
  });

  return {
    update: step,
    render() {
      stage.begin();
      ctx.save();
      if (shake > 0) {
        const a = Math.min(1, shake) * 9;
        ctx.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
      }
      drawMachine();
      drawFx();
      ctx.restore();
      drawOverlay();
      stage.end();
    },
    pointer: {
      down,
      up(p) {
        pointersHeld.delete(p.id);
      },
    },
    keydown(e) {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (e.repeat) return;
        if (overlay === "start" || overlay === "pause") press("go", overlay);
        else if (overlay === "over") newRun();
        else if (overlay === "rules") overlay = rulesFrom;
        else if (overlay === "album") overlay = albumFrom;
        else onSpace(true);
      } else if (e.code === "Escape") {
        if (overlay === null) {
          overlay = "pause";
          save();
        } else if (overlay === "pause") overlay = null;
        else if (overlay === "rules") overlay = rulesFrom;
        else if (overlay === "album") overlay = albumFrom;
      }
    },
    keyup(e) {
      if (e.code === "Space" || e.code === "Enter") onSpace(false);
    },
    suspend() {
      pointersHeld.clear();
      autoOn = false;
      spaceHeld = false;
      tap = false;
      if (overlay === null) overlay = "pause";
      save();
    },
    dispose() {
      offGrant?.();
      save();
    },
  };
}
