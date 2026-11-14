import "@fontsource/baloo-2/800.css";
import "@fontsource/handjet/700.css";
import {
  type CloudSlot,
  type GameHooks,
  type JackpotRoll,
  type PointerInfo,
  type Rect,
  type Runtime,
  SUMMARY_KEY,
  type ScoreReport,
  clamp,
  currentLocale,
  easeOutCubic,
  inRect,
  smoothstep,
} from "@web-games/core";
import {
  ALBUM_BTN,
  type ArtSrc,
  AUTO_BTN,
  CHUTE,
  COINS_BOX,
  CORE_COLORS,
  CREAM,
  CYAN,
  FONT,
  BROWN,
  GATE,
  HONEY,
  LAMPS_Y,
  LED_FONT,
  MENU_BTN,
  MUTED,
  REEL,
  type ReelCell,
  SHELF_BOTTOM,
  SHOOT,
  SPINS_BOX,
  TEAL,
  TERRA,
  TICKETS_BOX,
  VIOLET,
  WHEEL_C,
  WHEEL_R,
  type WheelLight,
  along,
  button,
  cardBackH,
  cardTexture,
  drawAlbumButton,
  drawAutoButton,
  drawBody,
  drawCabinet,
  drawCard3D,
  drawCardBack,
  drawCardFace,
  drawChute,
  drawCoreLamps,
  drawCounter,
  drawFlyingCoin,
  drawFrontLip,
  drawGate,
  drawJar,
  drawJarBadge,
  drawJarLane,
  drawCodeCoin,
  drawConfetti,
  drawSunburst,
  type Confetto,
  type MarqueeOpts,
  JAR_MOUTH,
  drawGlass,
  drawMarquee,
  drawMenuButton,
  drawOrb,
  drawPusher,
  drawRareBadge,
  drawReels,
  drawRobots,
  drawShadow,
  drawShelf,
  drawShootButton,
  drawTicketIcon,
  drawTray,
  drawWheel,
  fitSize,
  headline,
  hopAt,
  makeSprites,
  panel,
  proj,
  shineCard,
  text,
  versionTag,
} from "./art";
import {
  CARD_COUNT,
  CARD_IDS,
  CORE_COUNT,
  DAILY_COINS,
  FLIGHT_DOWN,
  FLIGHT_UP,
  H,
  MINI_PRIZES,
  PRIZE_QUEUE_MAX,
  PRIZE_SPIN_TIME,
  SEG_SIZE,
  SEG_START,
  SET_TIME,
  SHELF_D,
  SPIN_TIME,
  SUPER_PRIZES,
  SUPER_SPIN_TIME,
  TRIAL_COINS,
  VERSION,
  W,
  WELCOME_COINS,
  WHEEL,
  isRare,
} from "./config";
import cardBackArt from "./img/cards-v3/card-back.webp";
import cardBackRareArt from "./img/cards-v3/card-back-rare.webp";
import bengalImg from "./img/cards-v3/bengal.webp";
import britishImg from "./img/cards-v3/british.webp";
import maineCoonImg from "./img/cards-v3/maine-coon.webp";
import munchkinImg from "./img/cards-v3/munchkin.webp";
import persianImg from "./img/cards-v3/persian.webp";
import ragdollImg from "./img/cards-v3/ragdoll.webp";
import scottishFoldImg from "./img/cards-v3/scottish-fold.webp";
import siameseImg from "./img/cards-v3/siamese.webp";
import sphynxImg from "./img/cards-v3/sphynx.webp";
import tabbyImg from "./img/cards-v3/tabby.webp";
import cabinetBgArt from "./img/v2/cabinet-bg.webp";
import coinArt from "./img/v2/coin.webp";
import coinStack2Art from "./img/v2/coin-stack2.webp";
import coinStack3Art from "./img/v2/coin-stack3.webp";
import gateArt from "./img/v2/gate.webp";
import orbBlueArt from "./img/v2/orb-blue.webp";
import orbGreenArt from "./img/v2/orb-green.webp";
import orbOrangeArt from "./img/v2/orb-orange.webp";
import orbPurpleArt from "./img/v2/orb-purple.webp";
import orbRedArt from "./img/v2/orb-red.webp";
import orbYellowArt from "./img/v2/orb-yellow.webp";
import pusherArt from "./img/v2/pusher.webp";
import robotLeftArt from "./img/v2/robot-left.webp";
import robotRightArt from "./img/v2/robot-right.webp";
import shelfFloorArt from "./img/v2/shelf-floor.webp";
import shootIdleArt from "./img/v2/shoot-idle.webp";
import shootPressedArt from "./img/v2/shoot-pressed.webp";
import ticketArt from "./img/v2/ticket.webp";
import tileC1Art from "./img/v2/tile-c1.webp";
import tileC2Art from "./img/v2/tile-c2.webp";
import tileC4Art from "./img/v2/tile-c4.webp";
import tileC6Art from "./img/v2/tile-c6.webp";
import tileC8Art from "./img/v2/tile-c8.webp";
import tileCardArt from "./img/v2/tile-card.webp";
import tileCoreArt from "./img/v2/tile-core.webp";
import tileT10Art from "./img/v2/tile-t10.webp";
import tileT100Art from "./img/v2/tile-t100.webp";
import tileT20Art from "./img/v2/tile-t20.webp";
import tileT30Art from "./img/v2/tile-t30.webp";
import tileT5Art from "./img/v2/tile-t5.webp";
import tileT50Art from "./img/v2/tile-t50.webp";
import wheelHubArt from "./img/v2/wheel-hub.webp";
import {
  type GameEvent,
  type SpinKind,
  type State,
  createMachine,
  drainTickets,
  grantCard,
  grantCoins,
  holeAt,
  lidShut,
  normalizeAlbum,
  ownedCount,
  pusherAt,
  cardRate,
  exchangeCard,
  exchangeSet,
  hasSet,
  readyToShoot,
  setRate,
  update,
} from "./logic";
import { createJarFeed, supersPaid } from "./jackpot";
import { type MachineSave, fromSave, migrate, toSave } from "./save";
import { changelog } from "./changelog";
import { STRINGS } from "./strings";

// The imperative shell: turns the SHOOT button into inputs for logic.ts, plays
// its events as sound, light and particles, and draws the cabinet. Solo only.
//
// One machine that never resets. Signed in (ctx.cloud), it lives in cloud slot 0:
// loaded on mount, saved a few seconds after it changes (and at once for grants,
// on suspend and on dispose), with a local backup of anything unsent. Its coins
// come from the allowance (the welcome, the login streak's dailies and Prize
// Counter purchases: coins, or card packs rolled into the stash and shown in the
// card viewer) and coupons, and every ticket it pays is deposited in the shared
// arcade wallet. The allowance is claimed at start, at each Vietnam midnight, on
// coming back to the game (resumed, or tapped after a while away) and now and
// then while the coins are out, so a purchase arrives without a reload. Signed out, it is a local trial machine with
// TRIAL_COINS, trial tickets and nothing sent anywhere. A sign-out mid-game
// (calls failing with sign-in-required) drops back to the trial.
//
// Play is endless: nothing ever ends a run or blocks the machine. Out of coins
// it idles behind a small strip by the coin counter (the next daily coins, or a
// sign-in hint, and the code button). The leaderboard is never asked through
// reportScore (that opens the portal's score dialog); it is kept up to date
// silently: a cloud save carrying a `detail` is scored by the server from the
// save itself (save.ts rules.score), and one rides along about once a minute
// while the lifetime tickets grow, and when the coins run out, on suspend and on
// dispose. The plain debounced saves carry no detail.
//
// The Lucky Jar (1.3.0, docs/standards/jackpot.md, jackpot.ts): signed in, every
// coin the robot jar eats feeds the shared pool and every Super spin that pays
// rolls for it once. The marquee follows the live pool for everyone (guests get
// a sign-in hint), runs a short suspense while a roll is out, then shows the
// outcome: a celebration (the jar bursting, a coin rain and confetti drawn in
// code, the amount counting up) or a gentle "not this time". Errors are silent.

/** The guest's trial machine and its trial tickets: { save, tickets }. */
const TRIAL_KEY = "trial";
/** Coupon coins that arrived before a machine was loaded. */
const PENDING_KEY = "pendingCoins";
/** manifest.version when the player last closed the What's new card. */
const SEEN_KEY = "seenVersion";
/**
 * Dev builds only (`import.meta.env.DEV`; the branch is dropped from production
 * builds): `{ won: boolean, amount?: number }` stored here plays one Lucky Jar
 * roll with that answer a moment after the game starts, without a Super spin or
 * a server, so the suspense and both outcomes can be checked in a browser. Read
 * once and cleared.
 */
const DEV_JAR_KEY = "devJackpot";
/** The beta's keys: its run (discarded), album (seeds a new trial machine) and best. */
const LEGACY_RUN_KEY = "run";
const LEGACY_ALBUM_KEY = "album";
const LEGACY_BEST_KEY = "best";
/** The signed-in machine not yet confirmed by the server, per account. */
const backupKey = (playerId: string) => `machine:${playerId}`;
/** Seconds a changed machine waits before it is saved (changes in between join it). */
const SAVE_DEBOUNCE = 4;
/** Seconds between leaderboard filings at the most, while the lifetime tickets grow. */
const SCORE_EVERY = 60;
/** Seconds since the last filing before running out of coins files again (coins can run out often). */
const SCORE_ON_EMPTY = 10;
/** Seconds at zero coins before the out-of-coins strip shows (the shelf often hands a coin back). */
const STRIP_DELAY = 1.5;
/** Seconds between failed save retries, doubling up to the max. */
const RETRY_MIN = 4;
const RETRY_MAX = 60;
/** Seconds before failed ticket deposits are sent again. */
const DEPOSIT_RETRY = 10;
/** ms after the daily reset before claiming (the device clock may run a little fast). */
const CLAIM_SLACK = 2000;
/** ms between claims at the least, and before a failed claim is retried. */
const CLAIM_GAP = 60_000;
/**
 * ms between the extra claims that pick up Prize Counter purchases: when the
 * game resumes (the tab or the portal's menu gave it back) or the player taps it
 * again after a while (a dialog over it, like the Prize Counter, held the taps),
 * and every so often while the coins are out.
 */
const WAKE_GAP = 10_000;
/** ms without a tap on the game after which the next tap counts as coming back to it. */
const AWAY_TAP = 4_000;
/** ms between claims while the out-of-coins strip shows (a purchase may be on its way). */
const EMPTY_CLAIM_GAP = 20_000;
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
/** The v2 sprites (img/v2/, see its README), decoded once by makeSprites. */
const ART_SRC: ArtSrc = {
  "cabinet-bg": cabinetBgArt,
  "wheel-hub": wheelHubArt,
  "gate": gateArt,
  "coin": coinArt,
  "coin-stack2": coinStack2Art,
  "coin-stack3": coinStack3Art,
  "card-back": cardBackArt,
  "card-back-rare": cardBackRareArt,
  "ticket": ticketArt,
  "orb-red": orbRedArt,
  "orb-orange": orbOrangeArt,
  "orb-yellow": orbYellowArt,
  "orb-green": orbGreenArt,
  "orb-blue": orbBlueArt,
  "orb-purple": orbPurpleArt,
  "tile-t5": tileT5Art,
  "tile-t10": tileT10Art,
  "tile-t20": tileT20Art,
  "tile-t30": tileT30Art,
  "tile-t50": tileT50Art,
  "tile-t100": tileT100Art,
  "tile-c1": tileC1Art,
  "tile-c2": tileC2Art,
  "tile-c4": tileC4Art,
  "tile-c6": tileC6Art,
  "tile-c8": tileC8Art,
  "tile-core": tileCoreArt,
  "tile-card": tileCardArt,
  "shelf-floor": shelfFloorArt,
  "pusher": pusherArt,
  "shoot-idle": shootIdleArt,
  "shoot-pressed": shootPressedArt,
  "robot-left": robotLeftArt,
  "robot-right": robotRightArt,
};
/** What the two reels show. */
const MINI_CELLS: ReelCell[] = MINI_PRIZES.map((p) => ({ value: p.value, coin: p.kind === "coins" }));
const SUPER_CELLS: ReelCell[] = SUPER_PRIZES.map((value) => ({ value, coin: false }));
const cellsOf = (kind: SpinKind) => (kind === "mini" ? MINI_CELLS : SUPER_CELLS);
const spinTimeOf = (kind: SpinKind) => (kind === "mini" ? SPIN_TIME : SUPER_SPIN_TIME);
/** Seconds of Super spin win celebration. */
const SUPER_FX = 3.2;
/** The Lucky Jar: the suspense plays at least this long, and gives up silently after the max. */
const JAR_SUSPENSE_MIN = 1.8;
const JAR_SUSPENSE_MAX = 15;
/** Seconds the marquee shows "not this time". */
const JAR_MISSED_TIME = 3.2;
/** Seconds of the win celebration, when the jar bursts in it, and the amount's count-up. */
const JAR_WIN_FX = 6;
const JAR_BURST = 0.55;
const JAR_COUNT_FROM = 0.7;
const JAR_COUNT_TIME = 1.8;
/** Seconds each marquee line stays up (the Super line, the pool, a guest's sign-in hint), and its fade. */
const MARQUEE_EVERY = 4;
const MARQUEE_FADE = 0.25;
/** Seconds a coin takes to sink into the gate's hole. */
const SINK = 0.2;
/** Seconds a won card takes to fly to the album button. */
const CARD_FLY = 0.9;
/** Seconds a coin takes to drop into the robot jar, and the jar's happy munch after it. */
const JAR_DROP = 0.32;
const JAR_MUNCH = 0.9;
/** Seconds the gate's lid takes to shut or open. */
const LID_TIME = 0.18;
/** Toasts sit on the pusher's top plate, the one calm strip in the machine. */
const TOAST_Y = 522;
/** Where a toast is drawn (and, for a card's, tapped to open the card viewer). */
const TOAST_RECT: Rect = { x: W / 2 - 150, y: TOAST_Y - 26, w: 300, h: 52 };
/** Button faces, top→bottom: the main action in terracotta, the rest in teal, the album in violet. */
const BTN_GO: [string, string] = ["#E39272", TERRA];
const BTN_ALT: [string, string] = ["#7FB5AB", TEAL];
const BTN_CARD: [string, string] = ["#CBB0E8", "#9A76C4"];
/** A pale violet for a duplicate card. */
const LILAC = "#E2D2F2";

type ButtonId = "go" | "rules" | "code" | "retry";
type Overlay = "start" | "rules" | "pause" | "album" | "exchange" | "viewer" | "news" | null;
/** loading/failed: the account machine is on its way (or could not be fetched). */
type Mode = "loading" | "failed" | "account" | "guest";

interface Backup {
  /** The cloud version this save was built on. */
  base: number;
  save: MachineSave;
}

interface TrialSave {
  save: unknown;
  tickets: unknown;
}

/** A failure that means the player is no longer signed in. */
const signedOutError = (e: unknown) => /sign-in-required|đăng nhập/i.test(e instanceof Error ? e.message : String(e));

/** "hh:mm:ss" until `at` (unix ms). */
function clock(ms: number) {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}`;
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

/** A coin of the Lucky Jar's rain (drawn in code). */
interface RainCoin {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  vs: number;
  r: number;
}

/** Something that just went over an edge, animated until it is gone. */
interface Faller {
  x: number;
  y: number;
  edge: "front" | "side";
  /** Coins into the robot jar (drawn dropping into its mouth). */
  jar: boolean;
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
  // No reportScore: the leaderboard is filed silently with the cloud save (see the top)
  const { storage, audio, coupons } = rt.game;
  const tr = () => STRINGS[rt.locale()];
  const version = rt.game.version ?? VERSION;
  // Account handles: dropped (null) for good if the player signs out mid-game
  let cloud = rt.game.cloud ?? null;
  let tickets = rt.game.tickets ?? null;
  let allowance = rt.game.allowance ?? null;
  const cardImgs = CARD_IDS.map((id) => {
    const img = new Image();
    img.src = CARD_SRC[id];
    return img;
  });
  const sp = makeSprites(cardImgs, ART_SRC);

  // The beta's run is not resumed (the machine changed shape): drop it, with a note
  let legacyDropped = storage.get<unknown>(LEGACY_RUN_KEY, null) !== null;
  if (legacyDropped) storage.set(LEGACY_RUN_KEY, null);
  if (storage.get<unknown>(LEGACY_BEST_KEY, null) !== null) storage.set(LEGACY_BEST_KEY, null);
  /** Coupon coins that arrived before a machine was ready (or in the beta, between runs). */
  let pendingCoins = Math.max(0, Math.floor(Number(storage.get<unknown>(PENDING_KEY, 0)) || 0));

  let mode: Mode = cloud ? "loading" : "guest";
  /** Bumped when the machine changes owner (sign-out, dispose): late answers for the old one are ignored. */
  let gen = 0;
  let disposed = false;
  /** The machine. While the account one loads this is a stand-in that is never saved. */
  let s: State = cloud ? createMachine(1) : loadTrial();
  /** Guest only: local trial tickets (never deposited). */
  let trialTickets = 0;
  if (mode === "guest") trialTickets = readTrialTickets();

  // Saving: game time `t` when the machine first changed since the last save (-1: clean)
  let dirtyAt = -1;
  let cloudVersion = 0;
  let saving = false;
  let saveAgain = false;
  let retryAt = 0;
  let retryGap = RETRY_MIN;
  /** A leaderboard filing that rides on the next cloud save (the server scores the save itself). */
  let scoreNext: ScoreReport | undefined;
  /** The lifetime tickets last sent to the leaderboard, and when (game time `t`). */
  let lastFiled = 0;
  let lastFiledAt = 0;

  // The wallet: its balance, deposits on their way, and failed ones waiting to be sent again
  let wallet: number | null = null;
  let pendingDeposit = 0;
  let owed = 0;
  let owedAt = 0;
  let lastCapToast = -999;
  let offBalance: (() => void) | undefined;

  // The allowance: the next Vietnam midnight, and when to claim next (unix ms)
  let nextDailyAt = 0;
  let claimAt = Number.POSITIVE_INFINITY;
  let claiming = false;

  const seen = storage.get<unknown>(SEEN_KEY, null);
  let overlay: Overlay = seen !== version ? "news" : "start";
  let rulesFrom: "start" | "pause" = "start";
  /** Where the album was opened from, so closing it goes back there. */
  let albumFrom: Overlay = null;
  /** Seconds at zero coins (the strip waits a beat), the strip's fade (0..1) and its nudge when SHOOT is pressed dry. */
  let zeroFor = 0;
  let stripIn = 0;
  let stripPulse = 0;
  /** The gate's ready cue, faded (0..1). */
  let readyGlow = 0;
  /** The hole's lid, 0 open → 1 shut (it follows lidShut), and a knock when a coin bounces off it. */
  let lidK = 0;
  let lidKnock = 0;
  /** The robot jar: its munch (1 → 0) after coins drop in, and what it has eaten this session (for its fill). */
  let jarMunch = 0;
  let jarFill = 0;
  /** Cards from the Prize Counter waiting to be shown in the card viewer, one at a time. */
  const reveals: number[] = [];
  /** The allowance: tomorrow's daily (the streak's next step), and the last claim (unix ms). */
  let nextDailyAmount = DAILY_COINS;
  let lastClaimAt = 0;
  /** The game was suspended (tab hidden, portal menu): claim once it runs again. */
  let resumed = false;
  /** The last tap on the game (unix ms). */
  let lastTapAt = Date.now();

  // The Lucky Jar (jackpot.ts): contributions and rolls go through the feed, signed in only
  const hasJar = rt.game.jackpot !== undefined;
  /** The marquee's Lucky Jar line: a roll's suspense, then its outcome for a while. */
  let jarPhase: "rolling" | "won" | "lost" | null = null;
  let jarPhaseT = 0;
  /** Answers waiting for the suspense to play out (a second Super spin can roll while the first shows). */
  const jarAnswers: JackpotRoll[] = [];
  /** The win: seconds of celebration left, the amount, and its coin rain and confetti. */
  let jarWinFx = 0;
  let jarWinAmount = 0;
  let rain: RainCoin[] = [];
  let confetti: Confetto[] = [];
  let lastJarTick = 0;
  /** The jar badge's glow after the jar eats (signed in: those coins just fed the pool). */
  let jarGlow = 0;
  const jarFeed = createJarFeed({
    jackpot: rt.game.jackpot,
    signedIn: () => mode === "account",
    onRollStart() {
      if (jarPhase === null) {
        jarPhase = "rolling";
        jarPhaseT = 0;
      }
    },
    onRoll(r) {
      jarAnswers.push(r);
    },
  });
  /** Dev builds only: one scripted roll (DEV_JAR_KEY), and when its answer arrives. */
  let devRoll: JackpotRoll | null = null;
  let devAnswerAt = -1;
  if (import.meta.env.DEV) {
    const raw = storage.get<{ won?: unknown; amount?: unknown } | null>(DEV_JAR_KEY, null);
    if (raw) {
      storage.set(DEV_JAR_KEY, null);
      const amount = Math.max(1, Math.floor(Number(raw.amount) || 23410));
      devRoll = raw.won === true ? { won: true, amount, pool: 5000 } : { won: false, pool: 12345 };
    }
  }

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
  let shownCoins = s.coins;
  let shownTickets = trialTickets;
  let bumpCoins = 0;
  let bumpTickets = 0;
  /** Toasts take turns: a welcome and a daily can arrive together. A card's toast opens the card viewer when tapped. */
  let toast: { text: string; t: number; color: string; card: number } | null = null;
  const toasts: { text: string; color: string; card: number }[] = [];
  /** The gate's cup lights up after a coin drops in (1 → 0). */
  let gateFlash = 0;
  /** Coins sinking into the hole (screen x, seconds in). */
  let sinks: { x: number; t: number }[] = [];
  /** The prize light: where it is (in slots, unwrapped), and the run it is making to the picked slot. */
  let lightPos = 0;
  let light: { from: number; to: number } | null = null;
  let lastLightCell = 0;
  let lastTick = 0;
  /** Where the last prize slot was on screen when it paid (its ticket pop rises from there). */
  let winAt = { x: WHEEL_C.x, y: WHEEL_C.y };
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
      if (t - lastTick < 0.035) return;
      lastTick = t;
      audio.tone({ freq: 2100, dur: 0.012, type: "square", vol: 0.012 });
    },
    hole() {
      audio.tone({ freq: 330, to: 150, dur: 0.1, type: "sine", vol: 0.06 });
      for (const [i, f] of [988, 1319, 1760].entries()) audio.tone({ freq: f, dur: 0.08, type: "square", vol: 0.035, delay: 0.06 + i * 0.05 });
    },
    prizeStart() {
      audio.tone({ freq: 420, to: 1500, dur: 0.28, type: "sawtooth", vol: 0.03 });
    },
    clink(v = 1) {
      if (t - lastClink < 0.045) return;
      lastClink = t;
      const f = 2500 + Math.random() * 700;
      audio.tone({ freq: f, dur: 0.05, type: "triangle", vol: 0.05 * v });
      audio.tone({ freq: f * 1.5, dur: 0.04, type: "sine", vol: 0.03 * v, delay: 0.018 });
    },
    win(value: number) {
      const notes = value >= 50 ? [784, 988, 1175, 1568] : value >= 20 ? [784, 988, 1175] : [880, 1175];
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
    /** A coin bounces off the hole's shut lid: a soft wooden knock. */
    lidKnock() {
      audio.tone({ freq: 520, to: 360, dur: 0.06, type: "triangle", vol: 0.05 });
    },
    /** The robot jar munches: two happy chirps. */
    munch() {
      for (const [i, f] of [660, 990].entries()) audio.tone({ freq: f, to: f * 1.2, dur: 0.07, type: "sine", vol: 0.04, delay: i * 0.08 });
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
    /** A Lucky Jar roll is out: a light tick that climbs while the marquee lamps race. */
    jarTick(k: number) {
      audio.tone({ freq: 1200 + 600 * Math.min(1, k), dur: 0.02, type: "square", vol: 0.016 });
    },
    /** The Lucky Jar tips: the Super tune, then a cascade of coins. */
    jarWin() {
      sfx.superBonus();
      for (let i = 0; i < 14; i++) audio.tone({ freq: 2300 + ((i * 337) % 900), dur: 0.05, type: "triangle", vol: 0.04, delay: 0.5 + i * 0.07 });
    },
    /** Not this time: a soft, kind two-note sigh. */
    jarMissed() {
      for (const [i, f] of [784, 659].entries()) audio.tone({ freq: f, dur: 0.18, type: "sine", vol: 0.035, delay: i * 0.14 });
    },
    /** The machine settles at zero coins: a soft two-note wind-down, not a game-over. */
    rest() {
      for (const [i, f] of [659, 523].entries()) audio.tone({ freq: f, dur: 0.16, type: "triangle", vol: 0.035, delay: i * 0.12 });
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

  function pop(str: string, x: number, y: number, color = HONEY, size = 30) {
    pops.push({ text: str, x, y, t: 0, color, size });
  }

  /** Show a toast now, or (`wait`) after the ones already showing: grants and notices must not be lost. */
  function say(str: string, color = HONEY, wait = false, card = -1) {
    if (wait && toast) {
      if (toasts.length < 4) toasts.push({ text: str, color, card });
    } else toast = { text: str, t: 0, color, card };
  }

  // ---------------------------------------------------------------- the Lucky Jar

  /** Advance the marquee's roll line and the win celebration (only while the machine shows). */
  function stepJar(dt: number) {
    jarPhaseT += dt;
    // Dev builds: the scripted roll starts once the machine shows, and answers a moment later
    if (devRoll && devAnswerAt < 0 && jarPhase === null) {
      jarPhase = "rolling";
      jarPhaseT = 0;
      devAnswerAt = t + 1.4;
    } else if (devRoll && devAnswerAt >= 0 && t >= devAnswerAt) {
      jarAnswers.push(devRoll);
      devRoll = null;
    }
    const waitingRoll = jarFeed.rolling || (devRoll !== null && devAnswerAt >= 0);
    if (jarPhase === "rolling") {
      // The Super spin's own celebration finishes first
      if (jarAnswers.length > 0 && jarPhaseT >= JAR_SUSPENSE_MIN && superFx <= 0.3) resolveJar(jarAnswers.shift() as JackpotRoll);
      // A failed roll (offline, signed out, the server) or no answer in time: the line just goes, silently
      else if (jarAnswers.length === 0 && (!waitingRoll || jarPhaseT > JAR_SUSPENSE_MAX)) jarPhase = null;
      else if (t - lastJarTick > 0.09) {
        lastJarTick = t;
        sfx.jarTick(jarPhaseT / JAR_SUSPENSE_MIN);
      }
    } else if (jarPhase === "lost" && jarPhaseT > JAR_MISSED_TIME) jarPhase = null;
    else if (jarPhase === "won" && jarWinFx <= 0) {
      jarPhase = null;
      // The toast stays after the celebration, over the machine
      say(tr().jarWon(jarWinAmount), HONEY, true);
    }
    // A late answer, or the next Super spin's: show it
    if (jarPhase === null && (jarAnswers.length > 0 || jarFeed.rolling)) {
      jarPhase = "rolling";
      jarPhaseT = jarAnswers.length > 0 ? JAR_SUSPENSE_MIN : 0;
    }
    jarGlow = Math.max(0, jarGlow - dt * 1.4);
    if (jarWinFx > 0) stepJarWin(dt);
  }

  function resolveJar(r: JackpotRoll) {
    jarPhaseT = 0;
    const amount = Math.floor(r.amount ?? 0);
    if (r.won && amount > 0) {
      jarPhase = "won";
      startJarWin(amount);
    } else {
      jarPhase = "lost";
      sfx.jarMissed();
    }
  }

  /** The win: the tickets are already in the wallet (the server paid them), so its balance is read again. */
  function startJarWin(amount: number) {
    jarWinFx = JAR_WIN_FX;
    jarWinAmount = amount;
    rain = [];
    confetti = [];
    shake = Math.max(shake, 0.5);
    cheer = JAR_WIN_FX;
    sfx.jarWin();
    const tk = tickets;
    const mine = gen;
    tk?.balance().then(
      (b) => {
        if (mine === gen) wallet = b;
      },
      () => {},
    );
  }

  /** Where the big jar stands in the celebration (logical px), and how much bigger than on the lip. */
  const JAR_FX = { x: W / 2, y: 430, scale: 2.6 };

  function stepJarWin(dt: number) {
    const before = JAR_WIN_FX - jarWinFx;
    jarWinFx = Math.max(0, jarWinFx - dt);
    const k = JAR_WIN_FX - jarWinFx;
    const v = view();
    if (before < JAR_BURST && k >= JAR_BURST) {
      // It bursts: coins and confetti out of its mouth
      shake = Math.max(shake, 0.9);
      const mouthY = JAR_FX.y - 30;
      for (let i = 0; i < 46; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
        const sp0 = 520 + Math.random() * 520;
        rain.push({ x: JAR_FX.x, y: mouthY, vx: Math.cos(a) * sp0, vy: Math.sin(a) * sp0, spin: Math.random() * 6, vs: 6 + Math.random() * 10, r: 9 + Math.random() * 7 });
      }
      const colors = [HONEY, CREAM, TERRA, TEAL, VIOLET, CYAN, ...CORE_COLORS];
      for (let i = 0; i < 110; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.8;
        const sp0 = 300 + Math.random() * 600;
        confetti.push({
          x: JAR_FX.x,
          y: mouthY,
          vx: Math.cos(a) * sp0,
          vy: Math.sin(a) * sp0,
          rot: Math.random() * 6,
          vr: (Math.random() - 0.5) * 14,
          w: 6 + Math.random() * 6,
          h: 10 + Math.random() * 8,
          color: colors[i % colors.length],
        });
      }
    }
    // Then it rains coins from the top for a while
    if (k > JAR_BURST && jarWinFx > 1.2) {
      const n = Math.random() < dt * 34 ? 1 : 0;
      for (let i = 0; i < n; i++)
        rain.push({ x: v.x + Math.random() * v.w, y: v.y - 20, vx: (Math.random() - 0.5) * 60, vy: 120 + Math.random() * 160, spin: Math.random() * 6, vs: 5 + Math.random() * 8, r: 10 + Math.random() * 8 });
    }
    for (const c of rain) {
      c.vy += 1100 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.spin += c.vs * dt;
    }
    rain = rain.filter((c) => c.y < v.y + v.h + 40);
    for (const c of confetti) {
      c.vy += 420 * dt;
      c.vx *= 1 - dt * 1.6;
      c.vy = Math.min(c.vy, 170);
      c.x += (c.vx + Math.sin(c.rot * 2) * 30) * dt;
      c.y += c.vy * dt;
      c.rot += c.vr * dt;
    }
    confetti = confetti.filter((c) => c.y < v.y + v.h + 30);
    if (jarWinFx <= 0) {
      rain = [];
      confetti = [];
    }
  }

  /** What the marquee shows: a roll's line, else the Super line taking turns with the pool (and a guest's hint). */
  function marqueeLine(rainbow: boolean): { label: string; opts: MarqueeOpts; hot: boolean } {
    const l = tr();
    if (jarPhase === "rolling") return { label: l.jarRolling, opts: { jar: true, suspense: true }, hot: false };
    if (jarPhase === "lost") return { label: l.jarMissed, opts: { jar: true, color: TEAL }, hot: false };
    if (jarPhase === "won") return { label: l.jarWinTitle, opts: { jar: true }, hot: true };
    const superLine = l.marquee(Math.max(...SUPER_PRIZES));
    if (rainbow || !hasJar) return { label: superLine, opts: {}, hot: rainbow };
    const lines: { label: string; opts: MarqueeOpts }[] = [{ label: superLine, opts: {} }];
    if (jarFeed.pool !== null) lines.push({ label: l.jarPool(jarFeed.pool), opts: { jar: true } });
    if (mode === "guest") lines.push({ label: l.jarSignIn, opts: { jar: true, color: TEAL } });
    const i = Math.floor(t / MARQUEE_EVERY) % lines.length;
    const u = t % MARQUEE_EVERY;
    const alpha = lines.length > 1 ? Math.min(1, u / MARQUEE_FADE, (MARQUEE_EVERY - u) / MARQUEE_FADE) : 1;
    return { label: lines[i].label, opts: { ...lines[i].opts, alpha }, hot: false };
  }

  /** The Lucky Jar win, over everything: the robot jar bursting, a coin rain and confetti, the amount counting up. */
  function drawJarWin() {
    const l = tr();
    const k = JAR_WIN_FX - jarWinFx;
    const v = view();
    const fade = jarWinFx < 0.6 ? jarWinFx / 0.6 : Math.min(1, k / 0.25);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = "rgba(40,29,25,0.74)";
    ctx.fillRect(v.x, v.y, v.w, v.h);
    drawSunburst(ctx, JAR_FX.x, JAR_FX.y - 20, 300, t, k < JAR_BURST ? k / JAR_BURST : 1);
    // The jar: swells and trembles, then bursts (a squash) and bounces happily
    const pre = clamp(k / JAR_BURST, 0, 1);
    const post = k - JAR_BURST;
    const tremble = k < JAR_BURST ? Math.sin(t * 70) * 3 * pre : 0;
    const bounce = post > 0 ? Math.exp(-post * 3) * Math.sin(post * 18) * 0.12 : 0;
    const sc = JAR_FX.scale * (0.6 + 0.4 * easeOutCubic(pre) + 0.06 * pre * pre) * (1 + bounce);
    ctx.save();
    ctx.translate(JAR_FX.x + tremble, JAR_FX.y);
    ctx.scale(sc, sc);
    ctx.translate(-JAR_MOUTH.x, -JAR_MOUTH.y - 25);
    drawJar(ctx, sp, t, post > 0 ? Math.max(0.2, 1 - post / 3) : 0, 40, "");
    ctx.restore();
    // The burst's flash ring
    if (post > 0 && post < 0.5) {
      const q = post / 0.5;
      ctx.globalAlpha = fade * (1 - q);
      ctx.strokeStyle = CREAM;
      ctx.lineWidth = 10 * (1 - q) + 2;
      ctx.beginPath();
      ctx.arc(JAR_FX.x, JAR_FX.y - 30, 40 + q * 220, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = fade;
    }
    drawConfetti(ctx, confetti);
    for (const c of rain) drawCodeCoin(ctx, c.x, c.y, c.r, c.spin);
    // The title and the amount counting up
    const pop = clamp((k - 0.1) / 0.35, 0, 1);
    ctx.save();
    ctx.translate(W / 2, 228);
    ctx.scale(easeOutCubic(pop), easeOutCubic(pop));
    ctx.rotate(Math.sin(t * 5) * 0.03);
    headline(ctx, l.jarWinTitle, 0, 0, fitSize(ctx, l.jarWinTitle, 64, 470), CORE_COLORS[Math.floor(t * 10) % 6]);
    ctx.restore();
    if (k >= JAR_COUNT_FROM) {
      const q = clamp((k - JAR_COUNT_FROM) / JAR_COUNT_TIME, 0, 1);
      const shown = Math.round(jarWinAmount * easeOutCubic(q));
      const str = l.jarWinAmount(shown);
      const full = l.jarWinAmount(jarWinAmount);
      const size = fitSize(ctx, full, 56, 470);
      const beat = q >= 1 ? 1 + 0.04 * Math.sin(t * 8) : 1;
      ctx.save();
      ctx.translate(W / 2, 640);
      ctx.scale(beat, beat);
      headline(ctx, str, 0, 0, size, HONEY);
      ctx.restore();
    }
    ctx.restore();
  }

  /** The chute's mouth, where a shot coin hops out onto the gate. */
  const mouth = CHUTE[CHUTE.length - 1];
  let chuteLen = 0;
  for (let i = 1; i < CHUTE.length; i++) chuteLen += Math.hypot(CHUTE[i].x - CHUTE[i - 1].x, CHUTE[i].y - CHUTE[i - 1].y);
  const N_SEGS = WHEEL.length;
  const wrapSeg = (i: number) => ((i % N_SEGS) + N_SEGS) % N_SEGS;

  /** Start the prize light on a run of one to two laps that stops on slot `seg`. */
  function aimLight(seg: number) {
    const from = Math.floor(lightPos);
    light = { from, to: from + N_SEGS + ((seg - wrapSeg(from) + N_SEGS) % N_SEGS) };
  }

  /** The middle of a wheel slot on screen right now, at `r` from the hub. */
  function slotPoint(seg: number, r = WHEEL_R * 0.66) {
    const a = s.wheel + SEG_START[seg] + SEG_SIZE[seg] / 2;
    return { x: WHEEL_C.x + Math.cos(a) * r, y: WHEEL_C.y + Math.sin(a) * r };
  }

  function wheelLight(): WheelLight | null {
    if (!s.prize || !light) return null;
    const head = Math.floor(lightPos);
    if (s.prize.paid) return { segs: [wrapSeg(head)], won: true };
    return { segs: [wrapSeg(head), wrapSeg(head - 1), wrapSeg(head - 2)], won: false };
  }

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
        // Out of coins: the strip by the counter nudges (it never blocks anything)
        autoOn = false;
        stripPulse = 1;
        if (t - lastDry > 1.2) {
          lastDry = t;
          sfx.dry();
          say(l.noCoins, TERRA);
        }
        break;
      case "gate": {
        if (e.hit) {
          const hx = GATE.x + e.hole;
          gateFlash = 1;
          sinks.push({ x: hx, t: 0 });
          burst(hx, GATE.y, 18, [HONEY, CREAM, CYAN], 220);
          pop(l.holeIn, hx, GATE.y - 30, HONEY, 30);
          sfx.hole();
        } else if (e.lid) {
          // On the shut lid: it knocks, and the coin bounces down onto the shelf like a miss
          lidKnock = 1;
          burst(GATE.x + e.hole, GATE.y - 6, 8, [TERRA, CREAM], 140);
          sfx.lidKnock();
        } else {
          // Bounced off the rail: a spark where it struck (the coin's fall is drawn as a flight)
          burst(GATE.x + e.x, GATE.y - 8, 6, [CREAM, HONEY], 130);
          sfx.clink(0.9);
        }
        break;
      }
      case "prizeStart":
        sfx.prizeStart();
        aimLight(e.seg);
        break;
      case "prizeWin": {
        winAt = slotPoint(e.seg);
        sfx.clink(1.2);
        burst(winAt.x, winAt.y, 12, [CREAM, HONEY, CYAN], 200);
        const seg = e.segment;
        if (seg.kind === "coins") {
          pop(l.coinRain(seg.value), winAt.x, winAt.y - 10, HONEY, seg.value >= 6 ? 34 : 28);
          if (seg.value >= 6) cheer = Math.max(cheer, 1);
          sfx.win(seg.value * 8);
        } else if (seg.kind === "core") {
          burst(winAt.x, winAt.y, 24, CORE_COLORS, 260);
          sfx.core();
          cheer = Math.max(cheer, 1.2);
        } else if (seg.kind === "card") {
          burst(winAt.x, winAt.y, 24, [VIOLET, CREAM, LILAC], 260);
          sfx.card(true);
          cheer = Math.max(cheer, 1.2);
        }
        break;
      }
      case "tickets":
        bumpTickets = 1;
        if (e.source === "wheel") {
          const big = e.amount >= 50;
          pop(`+${e.amount}`, winAt.x, winAt.y - 10, big ? HONEY : CREAM, big ? 42 : 32);
          sfx.win(e.amount);
          if (big) cheer = Math.max(cheer, 1);
        }
        break;
      case "coinsWon":
        bumpCoins = 1;
        sfx.back(3);
        pop(l.coinsWon(e.amount), REEL.x + REEL.w - 80, REEL.y - 16, CYAN, 34);
        break;
      case "land":
        landed.set(e.id, 0);
        sfx.clink(e.kind === "coin" ? 0.6 : 0.5);
        break;
      case "fall":
        if (e.edge === "front" && e.kind === "card") {
          const p = proj(e.x, SHELF_D);
          cardFlies.push({ card: e.card, x: p.x, y: p.y, t: 0 });
          burst(p.x, p.y, 26, [VIOLET, CREAM, HONEY], 300);
          pop(tr().count(s.cards[e.card] ?? 1), p.x, p.y - 30, VIOLET, 34);
          break;
        }
        fallers.push({ x: e.x, y: e.y, edge: e.edge, jar: e.jar, stack: e.stack, kind: e.kind, core: e.core, card: e.card, t: 0 });
        if (e.jar) {
          // Into the robot jar: it munches happily (the coins are the machine's now)
          jarFill += e.stack;
          break;
        }
        if (e.edge === "front") {
          const p = proj(e.x, SHELF_D);
          if (e.kind === "core") {
            burst(p.x, p.y, 30, [CORE_COLORS[e.core], CREAM, HONEY], 320);
            cheer = Math.max(cheer, 2);
          } else {
            sfx.back(e.stack);
            bumpCoins = 1;
            pop(`+${e.stack}`, p.x, p.y - 14, CYAN, e.stack > 1 ? 30 : 24);
          }
        } else sfx.lost();
        break;
      case "coreIn": {
        const i = Math.min(e.count, CORE_COUNT) - 1;
        lampPulse[i] = 1;
        sfx.core();
        say(l.coreIn(Math.min(e.count, CORE_COUNT), CORE_COUNT), CORE_COLORS[i]);
        burst(lampX(i), LAMPS_Y, 22, [CORE_COLORS[i], CREAM], 240);
        break;
      }
      case "card": {
        albumPulse = 1;
        sfx.card(e.fresh);
        const name = l.cards[CARD_IDS[e.card]];
        say(`${name}: ${e.fresh ? l.cardNew : `${l.cardDupe} ${l.count(e.count)}`}`, e.fresh ? VIOLET : LILAC, false, e.card);
        cheer = Math.max(cheer, 1.2);
        break;
      }
      case "spinStart":
        sfx.spinStart();
        aimReel(e.kind, e.idx);
        if (e.kind === "super") {
          say(l.superSpin, TERRA);
          shake = Math.max(shake, 0.4);
          cheer = Math.max(cheer, 2);
        } else say(l.miniSpin, HONEY);
        break;
      case "spinWin": {
        const big = e.kind === "super" || e.prize.value >= 40;
        sfx.spinWin(e.kind === "super" ? 100 : e.prize.value);
        if (e.prize.kind === "tickets") pop(`+${e.prize.value}`, REEL.x + REEL.w - 70, REEL.y - 16, HONEY, big ? 46 : 38);
        burst(REEL.x + REEL.w - 70, REEL.y + REEL.h / 2, big ? 40 : 22, [HONEY, CREAM, TERRA], 300);
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
      case "idle":
        sfx.rest();
        onIdle();
        break;
    }
  }

  // ---------------------------------------------------------------- the machine and its saves

  /** Put a machine on the cabinet (loaded, adopted from the server or the trial) and reset the display. */
  function adopt(next: State) {
    s = next;
    autoOn = false;
    pointersHeld.clear();
    tap = false;
    shownCoins = s.coins;
    fallers = [];
    cardFlies = [];
    pops = [];
    landed.clear();
    sinks = [];
    light = null;
    gateFlash = 0;
    reel = null;
    superFx = 0;
    setFx = 0;
    zeroFor = 0;
    stripIn = 0;
    readyGlow = 0;
    lidK = lidShut(s) ? 1 : 0;
    lidKnock = 0;
    jarMunch = 0;
    jarFill = 0;
    jarGlow = 0;
  }

  function readTrialTickets() {
    const raw = storage.get<TrialSave | null>(TRIAL_KEY, null);
    return Math.max(0, Math.floor(Number(raw?.tickets) || 0));
  }

  /** The guest's trial machine, or a new one with TRIAL_COINS (and the beta's album, if any). */
  function loadTrial(): State {
    const m = migrate(storage.get<TrialSave | null>(TRIAL_KEY, null)?.save ?? null);
    if (m.ok) return fromSave(m.save);
    if (m.reason === "legacy") legacyDropped = true;
    const album = normalizeAlbum(storage.get<unknown>(LEGACY_ALBUM_KEY, null));
    storage.set(LEGACY_ALBUM_KEY, null);
    const fresh = createMachine(newSeed(), TRIAL_COINS, album);
    storage.set(TRIAL_KEY, { save: toSave(fresh), tickets: 0 });
    return fresh;
  }

  function markDirty() {
    if (dirtyAt < 0) dirtyAt = t;
  }

  /** Write the machine to the account's local backup (sent or not, it is safe on this device). */
  function writeBackup(save: MachineSave) {
    if (cloud) storage.set<Backup>(backupKey(cloud.playerId), { base: cloudVersion, save });
  }

  /** Save now: grants, suspend and dispose can't wait for the debounce. */
  function saveNow() {
    if (mode === "guest") {
      dirtyAt = -1;
      storage.set(TRIAL_KEY, { save: toSave(s), tickets: trialTickets });
    } else if (mode === "account") void flush();
  }

  /** Send the machine to cloud slot 0. One save in flight at a time; a newer one follows it. */
  async function flush() {
    if (mode !== "account" || !cloud) return;
    if (saving) {
      saveAgain = true;
      return;
    }
    saving = true;
    dirtyAt = -1;
    const c = cloud;
    const mine = gen;
    const save = toSave(s);
    writeBackup(save);
    const score = scoreNext;
    scoreNext = undefined;
    try {
      const r = await c.save(0, save, cloudVersion, score);
      if (mine !== gen) return;
      retryGap = RETRY_MIN;
      if (r.ok) {
        cloudVersion = r.version;
        // Nothing newer waiting: the server has it all, the backup can go
        if (dirtyAt < 0 && !saveAgain) storage.set(backupKey(c.playerId), null);
        else writeBackup(save);
      } else adoptConflict(r.conflict);
    } catch (e) {
      if (mine !== gen) return;
      if (signedOutError(e)) return becomeGuest();
      scoreNext ??= score;
      markDirty();
      retryAt = t + retryGap;
      retryGap = Math.min(RETRY_MAX, retryGap * 2);
    } finally {
      saving = false;
      if (saveAgain && mine === gen && !disposed) {
        saveAgain = false;
        void flush();
      }
    }
  }

  /** Another device saved later: its machine wins (as in tiem-banh-may), ours is dropped. */
  function adoptConflict(slot: CloudSlot) {
    cloudVersion = slot.version;
    const m = migrate(slot.data);
    if (!m.ok) {
      // Nothing usable there: ours goes up on top of it
      markDirty();
      return;
    }
    saveAgain = false;
    dirtyAt = -1;
    if (cloud) storage.set(backupKey(cloud.playerId), null);
    adopt(fromSave(m.save));
    lastFiled = Math.max(lastFiled, s.lifetimeTickets);
    say(tr().conflictAdopted, CYAN, true);
  }

  /** The signed-in machine: the server's slot 0, a newer unsent backup, or a new one at 0 coins. */
  async function loadAccount() {
    if (!cloud) return;
    const c = cloud;
    const mine = gen;
    mode = "loading";
    try {
      const slot = await c.load(0);
      if (mine !== gen) return;
      cloudVersion = slot?.version ?? 0;
      const backup = storage.get<Backup | null>(backupKey(c.playerId), null);
      const local = backup && backup.base === cloudVersion ? migrate(backup.save) : null;
      const remote = migrate(slot?.data ?? null);
      // A newer build wrote it: never overwrite what this one can't read
      if (!local?.ok && !remote.ok && remote.reason === "future") {
        mode = "failed";
        return;
      }
      let push = true;
      let next: State;
      if (local?.ok) next = fromSave(local.save);
      else if (remote.ok) {
        next = fromSave(remote.save);
        push = false;
      } else {
        if (remote.reason === "legacy") legacyDropped = true;
        next = createMachine(newSeed(), 0);
      }
      mode = "account";
      adopt(next);
      lastFiled = s.lifetimeTickets;
      if (push) saveNow();
      applyPending();
      watchWallet();
      claimAt = 0;
    } catch (e) {
      if (mine !== gen) return;
      if (signedOutError(e)) becomeGuest();
      else mode = "failed";
    }
  }

  /** Signed out mid-game: the account machine stays on the account, play goes on with the trial. */
  function becomeGuest() {
    if (mode === "guest") return;
    if (mode === "account") writeBackup(toSave(s));
    gen++;
    cloud = null;
    tickets = null;
    allowance = null;
    offBalance?.();
    offBalance = undefined;
    saving = false;
    saveAgain = false;
    dirtyAt = -1;
    scoreNext = undefined;
    pendingDeposit = 0;
    owed = 0;
    wallet = null;
    claimAt = Number.POSITIVE_INFINITY;
    mode = "guest";
    adopt(loadTrial());
    trialTickets = readTrialTickets();
    shownTickets = trialTickets;
    if (overlay === null) overlay = "start";
    say(tr().signedOut, CYAN, true);
  }

  /** Coupon coins that came before a machine was ready. */
  function applyPending() {
    if (pendingCoins <= 0) return;
    const added = grantCoins(s, pendingCoins);
    pendingCoins = 0;
    storage.set(PENDING_KEY, null);
    if (added > 0) {
      bumpCoins = 1;
      say(tr().couponCoins(added), CYAN, true);
      saveNow();
    }
  }

  // ---------------------------------------------------------------- tickets

  function watchWallet() {
    const tk = tickets;
    if (!tk) return;
    const mine = gen;
    offBalance?.();
    offBalance = tk.onBalance((b) => {
      if (mine === gen) wallet = b;
    });
    tk.balance().then(
      (b) => {
        if (mine !== gen) return;
        if (wallet === null) shownTickets = b + pendingDeposit + owed;
        wallet = b;
      },
      (e) => {
        if (mine === gen && signedOutError(e)) becomeGuest();
      },
    );
  }

  /** Pay out what the machine earned: into the wallet (signed in) or the trial counter. */
  function payOut() {
    const n = drainTickets(s);
    if (n <= 0) return;
    if (mode === "guest") trialTickets += n;
    else if (mode === "account") deposit(n);
  }

  function deposit(n: number) {
    const tk = tickets;
    if (!tk) return;
    const mine = gen;
    pendingDeposit += n;
    tk.deposit(n).then(
      ({ balance, accepted }) => {
        if (mine !== gen) return;
        pendingDeposit -= n;
        // The server's word goes: a cap may have taken some
        wallet = balance;
        if (accepted < n && t - lastCapToast > 60) {
          lastCapToast = t;
          say(tr().ticketCap, HONEY, true);
        }
      },
      (e) => {
        if (mine !== gen) return;
        pendingDeposit -= n;
        if (signedOutError(e)) return becomeGuest();
        owed += n;
        if (owedAt <= t) owedAt = t + DEPOSIT_RETRY;
      },
    );
  }

  /** What the ticket counter shows: the wallet plus what is on its way to it. */
  const ticketTarget = () => (mode === "guest" ? trialTickets : (wallet ?? 0) + pendingDeposit + owed);

  // ---------------------------------------------------------------- allowance and the leaderboard

  /**
   * Ask the server for what is due: the welcome, the day's streak coins and
   * every Prize Counter purchase not yet delivered. Coins go on the balance; a
   * card pack rolls its cards (CARD_WEIGHTS, the machine's seeded random) into
   * the inventory and shows each in the card viewer. Saved at once: the server
   * never sends a grant twice.
   */
  async function claimAllowance() {
    const al = allowance;
    if (!al || claiming || mode !== "account") return;
    claiming = true;
    lastClaimAt = Date.now();
    claimAt = Date.now() + CLAIM_GAP;
    const mine = gen;
    try {
      const claim = await al.claim();
      if (mine !== gen) return;
      nextDailyAt = claim.nextDailyAt;
      if (Number.isFinite(claim.nextDailyAmount)) nextDailyAmount = claim.nextDailyAmount;
      claimAt = Math.max(claim.nextDailyAt + CLAIM_SLACK, Date.now() + CLAIM_GAP);
      const l = tr();
      let coins = false;
      let cards = false;
      for (const g of claim.grants) {
        if (g.kind === "coins") {
          const added = grantCoins(s, g.amount);
          if (added <= 0) continue;
          coins = true;
          const line = g.type === "welcome" ? l.welcomeGrant(added) : g.type === "daily" ? l.streakGrant(g.streakDay, added) : l.shopCoins(added);
          say(line, CYAN, true);
        } else if (g.kind === "card-pack") {
          for (let i = 0; i < Math.min(50, Math.max(0, Math.floor(g.amount))); i++) {
            const card = grantCard(s);
            cards = true;
            reveals.push(card);
            say(l.shopCard(l.cards[CARD_IDS[card]]), VIOLET, true, card);
          }
        }
      }
      if (coins) {
        bumpCoins = 1;
        audio.tone({ freq: 880, dur: 0.1, type: "triangle", vol: 0.05 });
      }
      if (cards) {
        albumPulse = 1;
        sfx.card(true);
      }
      // The server never sends these again: on the account (and the backup) now
      if (coins || cards) {
        markDirty();
        saveNow();
      }
    } catch (e) {
      if (mine === gen && signedOutError(e)) becomeGuest();
    } finally {
      claiming = false;
    }
  }

  /** Claim again soon after coming back (a purchase made in the Prize Counter meanwhile), at most every WAKE_GAP. */
  function wakeClaim() {
    if (mode === "account" && !claiming && Date.now() - lastClaimAt >= WAKE_GAP) void claimAllowance();
  }

  const detailOf = () => tr().detail(s.lifetimeTickets, s.supers);

  function writeSummary() {
    const n = s.lifetimeTickets;
    if (n > 0) storage.set(SUMMARY_KEY, { vi: STRINGS.vi.summary(n), en: STRINGS.en.summary(n) });
  }

  /**
   * File the leaderboard silently (signed in, and only if the lifetime tickets
   * grew since the last filing): the next cloud save carries a detail, and the
   * server scores the save itself. The board keeps one row per player (the
   * best), so filing again only ever raises it. Returns whether a save went.
   */
  function fileScore() {
    if (mode !== "account" || s.lifetimeTickets <= lastFiled) return false;
    lastFiled = s.lifetimeTickets;
    lastFiledAt = t;
    scoreNext = { score: s.lifetimeTickets, detail: detailOf() };
    void flush();
    return true;
  }

  /** Out of coins and settled: the summary, the leaderboard (signed in) and a save. */
  function onIdle() {
    writeSummary();
    if (!fileScore()) saveNow();
  }

  // ---------------------------------------------------------------- overlay buttons

  type Btn = { rect: Rect; id: ButtonId };
  /** A line of card text; `dot` marks the first line of a bullet (its colour index). */
  type Line = { str: string; y: number; size: number; color: string; dot?: number; center?: boolean };
  const PANEL: Rect = { x: 40, y: 236, w: 460, h: 428 };
  const startButtons = (): Btn[] => [
    { rect: { x: 100, y: 500, w: 340, h: 66 }, id: "go" },
    { rect: { x: 140, y: 578, w: 260, h: 56 }, id: "rules" },
  ];
  const pauseButtons = (): Btn[] => [
    { rect: { x: 100, y: 390, w: 340, h: 66 }, id: "go" },
    { rect: { x: 100, y: 470, w: 340, h: 56 }, id: "rules" },
    ...(coupons ? [{ rect: { x: 100, y: 538, w: 340, h: 56 }, id: "code" as const }] : []),
  ];
  const RULE_LINE = 28;
  const RULE_GAP = 14;
  /**
   * The rules card hugs its text (the line count depends on the language). On a
   * short screen the text steps down from 19 px until the card, its title and
   * its close button fit the visible view (1.3.0 added the Lucky Jar's line).
   */
  function rulesLayout() {
    const v = view();
    const n = tr().rulesLines.length;
    let fit = { size: 19, line: RULE_LINE, gap: RULE_GAP, h: 0 };
    for (let size = 19; size >= 14; size--) {
      const line = Math.round(size * 1.47);
      const gap = Math.round(size * 0.6);
      let lines = 0;
      for (const ln of tr().rulesLines) lines += wrap(ctx, ln, 410, size).length;
      fit = { size, line, gap, h: 106 + lines * line + n * gap + 96 };
      if (fit.h <= v.h - 16) break;
    }
    const r: Rect = { x: 24, y: Math.max(v.y + 8, v.y + (v.h - fit.h) / 2), w: 492, h: fit.h };
    return { ...fit, r };
  }
  const rulesRect = (): Rect => rulesLayout().r;
  const rulesClose = (): Rect => {
    const r = rulesRect();
    return { x: 150, y: r.y + r.h - 84, w: 240, h: 60 };
  };

  /** The What's new card: the version's lines, and the note about a dropped beta run. */
  function newsCard() {
    const l = tr();
    const news = changelog.find((e) => e.version === version) ?? changelog[0];
    const lines: Line[] = [];
    let y = 104;
    for (const [n, line] of (news.changes[currentLocale(rt)] ?? []).entries()) {
      for (const [i, ln] of wrap(ctx, line, 400, 19).entries()) {
        lines.push({ str: ln, y, size: 19, color: CREAM, dot: i === 0 ? n : undefined });
        y += RULE_LINE;
      }
      y += RULE_GAP;
    }
    if (legacyDropped) {
      for (const ln of wrap(ctx, l.legacyNote, 420, 17)) {
        lines.push({ str: ln, y, size: 17, color: HONEY, center: true });
        y += 24;
      }
      y += 10;
    }
    const h = y + 92;
    const r: Rect = { x: 24, y: H / 2 - h / 2, w: 492, h };
    for (const ln of lines) ln.y += r.y;
    const close: Rect = { x: 150, y: r.y + h - 84, w: 240, h: 60 };
    return { r, lines, close };
  }

  /** The account machine on its way (or not). */
  const LOADING: Rect = { x: 60, y: 350, w: 420, h: 250 };
  const RETRY: Rect = { x: 140, y: 510, w: 260, h: 58 };

  function press(id: ButtonId, from: "start" | "pause") {
    audio.tone({ freq: 660, dur: 0.06, type: "square", vol: 0.04 });
    if (id === "go") overlay = null;
    else if (id === "code") coupons?.open();
    else if (id === "retry") void loadAccount();
    else {
      rulesFrom = from;
      overlay = "rules";
    }
  }

  function closeNews() {
    storage.set(SEEN_KEY, version);
    legacyDropped = false;
    overlay = "start";
  }

  function onSpace(down: boolean) {
    spaceHeld = down;
    if (down && overlay === null) tap = true;
  }

  // ---------------------------------------------------------------- update

  function step(dt: number) {
    t += dt;
    const ready = mode === "account" || mode === "guest";
    // The machine waits behind the menus; nothing else ever stops it
    const frozen = !ready || overlay !== null;
    if (!frozen) {
      const hadCoins = s.coins > 0;
      const shoot = pointersHeld.size > 0 || spaceHeld || tap || (autoOn && s.coins > 0);
      const evs = update(s, { shoot }, dt);
      // The Lucky Jar: eaten coins feed it and a paid Super spin rolls (signed in only); a guest's Super gets a hint
      jarFeed.feed(evs);
      if (hasJar && mode === "guest" && supersPaid(evs) > 0) say(tr().jarGuestSuper, CYAN, true);
      // A tap is spent once the machine has answered it (a shot, or the dry click)
      if (evs.some((e) => e.type === "shoot" || e.type === "dry")) tap = false;
      for (const e of evs) onEvent(e);
      if (evs.length > 0) markDirty();
      payOut();
      if (autoOn && s.coins <= 0) autoOn = false;
      // The coins just ran out: file the leaderboard (not more often than SCORE_ON_EMPTY)
      if (hadCoins && s.coins === 0 && t - lastFiledAt >= SCORE_ON_EMPTY) fileScore();
    }
    if (ready) {
      // Out of coins: the strip by the counter, a beat after the last coin went
      zeroFor = s.coins === 0 ? zeroFor + dt : 0;
      const showStrip = zeroFor > STRIP_DELAY && overlay === null;
      stripIn = clamp(stripIn + (showStrip ? dt : -dt) * 5, 0, 1);
      // The silent leaderboard: about once a minute while the lifetime tickets grow
      if (t - lastFiledAt >= SCORE_EVERY && s.lifetimeTickets > lastFiled) fileScore();
      if (dirtyAt >= 0 && t - dirtyAt >= SAVE_DEBOUNCE) {
        if (mode === "guest") saveNow();
        else if (!saving && t >= retryAt) void flush();
      }
      if (mode === "account" && owed > 0 && t >= owedAt) {
        const n = owed;
        owed = 0;
        deposit(n);
      }
      // The daily coins: at start, then each Vietnam midnight while the game stays open
      if (mode === "account" && !claiming && Date.now() >= claimAt) void claimAllowance();
      // Back from a suspend: a purchase may have been made meanwhile
      if (resumed) {
        resumed = false;
        wakeClaim();
      }
      // Out of coins: look for Prize Counter coins now and then
      if (stripIn >= 1 && mode === "account" && !claiming && Date.now() - lastClaimAt >= EMPTY_CLAIM_GAP) void claimAllowance();
      // Prize Counter cards, one viewer at a time, once nothing else is open
      if (overlay === null && reveals.length > 0) openViewer(reveals.shift() as number, null, true);
    }

    // The ready cue: a shot now drops into the hole
    const cue = ready && overlay === null && s.coins > 0 && readyToShoot(s);
    readyGlow = clamp(readyGlow + (cue ? dt * 14 : -dt * 8), 0, 1);
    stripPulse = Math.max(0, stripPulse - dt * 2);
    // The lid follows the stock; the jar munches after coins land in it
    lidK = clamp(lidK + (lidShut(s) ? dt : -dt) / LID_TIME, 0, 1);
    lidKnock = Math.max(0, lidKnock - dt * 4);
    jarMunch = Math.max(0, jarMunch - dt / JAR_MUNCH);
    for (const f of fallers) {
      if (!f.jar || f.t >= JAR_DROP || f.t + dt < JAR_DROP) continue;
      jarMunch = 1;
      if (hasJar && mode === "account") jarGlow = 1;
      sfx.munch();
      pop(tr().jarYum, JAR_MOUTH.x, JAR_MOUTH.y - 26, HONEY, 26);
      burst(JAR_MOUTH.x, JAR_MOUTH.y, 8, [HONEY, CREAM, "#F2A6A0"], 120);
    }
    if (overlay === "viewer") stepViewer(dt);
    if (ready && overlay === null) stepJar(dt);

    // Lights and counters
    const busyReels = s.spin !== null || s.prize !== null;
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
    gateFlash = Math.max(0, gateFlash - dt * 2.5);
    for (const k of sinks) k.t += dt;
    sinks = sinks.filter((k) => k.t < SINK);
    // A toast waits behind a panel (a welcome grant lands while the start card shows)
    if (toast && overlay === null && (mode === "account" || mode === "guest")) {
      toast.t += dt;
      if (toast.t > 1.6) {
        const next = toasts.shift();
        toast = next ? { ...next, t: 0 } : null;
      }
    }
    const roll = (shown: number, real: number) => {
      const d = real - shown;
      if (Math.abs(d) < 0.5) return real;
      return shown + Math.sign(d) * Math.max(dt * 30, Math.abs(d) * dt * 6);
    };
    shownCoins = roll(shownCoins, s.coins);
    shownTickets = roll(shownTickets, ticketTarget());
    for (const [id, k] of landed) {
      if (k > 0.2) landed.delete(id);
      else landed.set(id, k + dt);
    }

    // The prize light: fast at first, braking onto the picked slot (a resumed run may come back mid-spin)
    if (s.prize && !light) aimLight(s.prize.seg);
    if (s.prize && light) {
      const k = clamp(s.prize.t / PRIZE_SPIN_TIME, 0, 1);
      lightPos = light.from + (light.to - light.from) * (1 - (1 - k) ** 3);
      const cell = Math.floor(lightPos);
      if (cell !== lastLightCell) {
        lastLightCell = cell;
        if (k < 1) sfx.tick();
      }
    } else light = null;

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
    if (exPop) {
      exPop.t += dt;
      if (exPop.t > 1.2) exPop = null;
    }
    pops = pops.filter((p) => p.t < 1);
    for (const f of fallers) f.t += dt;
    fallers = fallers.filter((f) => f.t < (f.jar ? JAR_DROP : f.edge === "front" && f.kind === "coin" ? 0.8 : 0.55));
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
        // Up the chute, then a short hop out of its mouth onto the target ring (LAND)
        const end = hopAt(1);
        const hop = Math.hypot(end.x - mouth.x, end.y - mouth.y);
        const k = f.t / FLIGHT_UP;
        const k1 = chuteLen / (chuteLen + hop);
        if (k < k1) {
          const p = along(CHUTE, k / k1);
          const q = along(CHUTE, (k - 0.05) / k1);
          ctx.save();
          ctx.strokeStyle = "rgba(234,184,93,0.7)";
          ctx.lineWidth = 6;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(q.x, q.y);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          ctx.restore();
          drawFlyingCoin(ctx, sp, p.x, p.y, 22, f.t * 30);
        } else {
          const u = clamp((k - k1) / (1 - k1), 0, 1);
          const p = hopAt(u);
          drawFlyingCoin(ctx, sp, p.x, p.y, 22 - 4 * u, f.t * 30);
        }
        continue;
      }
      const k = clamp(f.t / FLIGHT_DOWN, 0, 1);
      const end = proj(f.x, py + 16);
      if (f.kind === "core") {
        const y = lerpN(GATE.y, end.y, k * k);
        drawOrb(ctx, sp, f.core, end.x, y, 44 * end.s);
        continue;
      }
      if (f.kind === "card") {
        // Flutters down face down, flipping, to where it will land (its cat shows when it is pushed off)
        const y = lerpN(GATE.y, end.y, k * k);
        const w = 40 * end.s;
        const h = cardBackH(w);
        ctx.save();
        ctx.translate(end.x, y - w * 0.6);
        ctx.rotate(Math.sin(f.t * 9) * 0.25);
        ctx.scale(Math.max(0.2, Math.abs(Math.cos(f.t * 7))), 1);
        drawCardBack(ctx, sp, -w / 2, -h / 2, w, h, isRare(f.card));
        ctx.restore();
        continue;
      }
      // A coin bounces off the gate (or pours out of it, for a prize) and falls to the shelf
      const from = { x: GATE.x + f.aim, y: GATE.y - 8 };
      const cx = (from.x + end.x) / 2;
      const cy = Math.min(from.y, end.y) - 60;
      const x = (1 - k) * (1 - k) * from.x + 2 * (1 - k) * k * cx + k * k * end.x;
      const y = (1 - k) * (1 - k) * from.y + 2 * (1 - k) * k * cy + k * k * end.y;
      drawFlyingCoin(ctx, sp, x, y, lerpN(18, 30 * end.s, k), f.t * 22);
    }
    // Coins dropping into the hole: shrink and sink
    for (const k of sinks) {
      const q = k.t / SINK;
      drawFlyingCoin(ctx, sp, k.x, GATE.y - 8 + q * 8, 18 * (1 - q * 0.8), 0);
    }
  }

  const lerpN = (a: number, b: number, k: number) => a + (b - a) * k;

  function drawFallers() {
    for (const f of fallers) {
      const p = proj(f.x, f.edge === "front" ? SHELF_D : f.y);
      if (f.jar) {
        // Over the edge and down into the jar's mouth, shrinking as it goes in
        const k = clamp(f.t / JAR_DROP, 0, 1);
        const x = lerpN(p.x, JAR_MOUTH.x, k);
        const y = lerpN(p.y, JAR_MOUTH.y + 6, k * k) - Math.sin(k * Math.PI) * 10;
        for (let i = 0; i < f.stack; i++) drawFlyingCoin(ctx, sp, x + i * 5, y - i * 5, 26 * (1 - 0.45 * k), f.t * 18 + i);
        continue;
      }
      if (f.edge === "front") {
        const k = Math.min(f.t, 0.35);
        const x = p.x;
        const y = p.y + 200 * k + 900 * k * k;
        if (f.t < 0.35) {
          ctx.globalAlpha = 1 - k / 0.5;
          if (f.kind === "core") drawOrb(ctx, sp, f.core, x, y + 12, 48);
          else for (let i = 0; i < f.stack; i++) drawFlyingCoin(ctx, sp, x + i * 8, y - i * 6, 30, f.t * 20 + i);
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
        if (f.kind === "core") drawOrb(ctx, sp, f.core, x, y + 10, 40);
        else if (f.kind === "card") {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(dir * f.t * 6);
          drawCardBack(ctx, sp, -16, -cardBackH(32) / 2, 32, cardBackH(32), isRare(f.card));
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
    drawCabinet(ctx, sp, v);
    // Title above the cabinet when the phone is tall enough to show it
    if (v.y < -50) headline(ctx, l.title, W / 2, v.y / 2, fitSize(ctx, l.title, 40, 380), CREAM);
    const mq = marqueeLine(rainbow);
    drawMarquee(ctx, mq.label, t, mq.hot, mq.opts);
    drawMenuButton(ctx, MENU_BTN, l.menu);
    drawAlbumButton(ctx, sp, ALBUM_BTN, l.album, ownedCount(s.cards), CARD_COUNT, albumPulse);
    versionTag(ctx, 493, 76, l.versionLabel(version));
    drawCoreLamps(ctx, sp, s.cores, CORE_COUNT, t, superFx > 0, lampPulse);
    drawRobots(ctx, sp, t, cheer);
    drawWheel(ctx, sp, s.wheel, t, chase, wheelLight());
    drawGate(ctx, sp, holeAt(s.gate), s.stock, gateFlash, s.stock >= PRIZE_QUEUE_MAX, t, readyGlow, lidK, lidKnock);
    drawGlass(ctx, { x: 120, y: 112, w: 300, h: 300 }, t);

    // Reels and the spins counter
    const spinning = s.spin !== null;
    const reelLabel = !s.spin ? l.youWin : s.spin.kind === "super" ? "SUPER" : "MINI";
    drawReels(ctx, sp, reelLabel, cellsOf(reelKind), reelPos, spinning, !!s.spin?.paid, t, s.spin?.kind === "super");
    drawCounter(ctx, SPINS_BOX, l.spins, s.queue.length, VIOLET, 2, 0);

    // The shelf
    drawShelf(ctx, sp);
    drawPusher(ctx, sp, pusherAt(s.pusherT).y);
    const order = [...s.bodies].sort((a, b) => a.y - b.y || a.id - b.id);
    for (const b of order) drawShadow(ctx, b);
    for (const b of order) {
      const k = landed.get(b.id);
      drawBody(ctx, sp, b, t, k === undefined ? 0 : Math.max(0, 1 - k / 0.18));
    }
    drawJarLane(ctx, t, jarMunch);
    drawFrontLip(ctx, chase, rainbow);
    drawFallers();
    drawJar(ctx, sp, t, jarMunch, jarFill, l.jar);
    if (hasJar) drawJarBadge(ctx, t, jarGlow, l.jarBadge);
    drawGlass(ctx, { x: 30, y: 476, w: 480, h: 340 }, t + 4);
    drawChute(ctx, chuteGlow);
    drawFlights();

    // Controls
    drawCounter(ctx, COINS_BOX, l.coins, shownCoins, CYAN, 4, bumpCoins);
    drawCounter(ctx, TICKETS_BOX, mode === "guest" ? l.trialTickets : l.tickets, shownTickets, HONEY, 6, bumpTickets, mode === "account" && tickets !== null ? l.sharedWallet : undefined);
    const pressed = pointersHeld.size > 0 || spaceHeld;
    drawShootButton(ctx, sp, l.shoot, pressed, t, s.coins > 0);
    drawAutoButton(ctx, AUTO_BTN, l.auto, autoOn ? l.on : l.off, autoOn, s.coins > 0);
    drawTray(ctx, sp, shownCoins, view());
    // How to aim, until the player has a few hits
    if (s.gateHits < 3 && s.shots < 40 && overlay === null && s.coins > 0)
      // On the pusher's plate, where toasts go (the jar sits under the shelf's edge)
      if (!toast) text(ctx, l.aimHint, W / 2, TOAST_Y, fitSize(ctx, l.aimHint, 17, 440), readyGlow > 0.5 ? "#C9F2B8" : CREAM);
    if (stripIn > 0) drawStrip();
  }

  // ---------------------------------------------------------------- the out-of-coins strip

  /** The strip's line: when the next daily coins come (signed in), or the sign-in hint (guest). */
  function stripText() {
    const l = tr();
    if (mode !== "account") return l.guestHint(WELCOME_COINS);
    const left = nextDailyAt - Date.now();
    return nextDailyAt > 0 && left > 0 ? l.dailyIn(nextDailyAmount, clock(left)) : l.dailyLater(nextDailyAmount);
  }
  /** The strip's second line, signed in: trade tickets for coins at the Prize Counter (the portal's ticket chip). */
  const showCounterHint = () => mode === "account" && tickets !== null;
  const STRIP_H = 46;
  /** Clear of the robot jar, which stands on the middle of the shelf's front edge. */
  const STRIP_Y = SHELF_BOTTOM - STRIP_H - 40;
  const STRIP_TEXT = 20;
  /** The strip hugs its contents, left-aligned over the coin counter's side of the shelf. */
  function stripRect(): Rect {
    ctx.font = `800 ${STRIP_TEXT}px ${FONT}`;
    // Measured on the widest the countdown gets, so the strip does not twitch every second
    const w = 24 + 26 + ctx.measureText(stripText().replace(/\d/g, "8")).width + 16 + (coupons ? codeW() + 8 : 0);
    return { x: COINS_BOX.x - 6, y: STRIP_Y, w: Math.min(W - 2 * (COINS_BOX.x - 6), w), h: STRIP_H };
  }
  function codeW() {
    ctx.font = `800 18px ${FONT}`;
    return ctx.measureText(tr().enterCode).width + 32;
  }
  /** The strip's code button (only with coupons). */
  function stripCode(): Rect {
    const r = stripRect();
    const w = codeW();
    return { x: r.x + r.w - w - 6, y: r.y + 6, w, h: r.h - 12 };
  }

  function drawStrip() {
    const r = stripRect();
    ctx.save();
    ctx.globalAlpha = stripIn;
    ctx.translate(0, (1 - stripIn) * 12);
    const k = 1 + 0.05 * Math.sin(stripPulse * Math.PI);
    ctx.translate(r.x, r.y + r.h / 2);
    ctx.scale(k, k);
    ctx.translate(-r.x, -(r.y + r.h / 2));
    ctx.fillStyle = BROWN;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y + 4, r.w, r.h, r.h / 2);
    ctx.fill();
    ctx.fillStyle = "rgba(51,64,79,0.95)";
    ctx.strokeStyle = stripPulse > 0 ? TERRA : CYAN;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, r.h / 2);
    ctx.fill();
    ctx.stroke();
    drawFlyingCoin(ctx, sp, r.x + 26, r.y + r.h / 2, 24, 0);
    text(ctx, stripText(), r.x + 46, r.y + r.h / 2 + 1, STRIP_TEXT, CYAN, "left", null);
    if (coupons) button(ctx, stripCode(), tr().enterCode, BTN_GO, 18);
    if (showCounterHint()) {
      // Above the strip: where tickets turn into coins (the game can't open the counter itself)
      const hint = tr().counterHint;
      const size = fitSize(ctx, hint, 16, W - 2 * r.x - 52);
      ctx.font = `800 ${size}px ${FONT}`;
      const hw = ctx.measureText(hint).width + 52;
      const hr: Rect = { x: r.x, y: r.y - 38, w: hw, h: 30 };
      ctx.fillStyle = "rgba(51,38,33,0.92)";
      ctx.strokeStyle = HONEY;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(hr.x, hr.y, hr.w, hr.h, hr.h / 2);
      ctx.fill();
      ctx.stroke();
      drawTicketIcon(ctx, sp, hr.x + 20, hr.y + hr.h / 2, 24);
      text(ctx, hint, hr.x + 38, hr.y + hr.h / 2 + 1, size, HONEY, "left", null);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- the card viewer

  /** Biggest tilt either way (radians): subtle, the engine has no reduced-motion signal. */
  const TILT_YAW = 0.3;
  const TILT_PITCH = 0.24;
  /** Seconds a flip takes, and the viewer's pop-in. */
  const FLIP_TIME = 0.55;
  const OPEN_TIME = 0.24;
  /** Seconds without pointer movement before the card drifts back to its idle sway. */
  const TILT_IDLE = 1.6;
  interface Viewer {
    card: number;
    from: Overlay;
    /** A card from the Prize Counter: shown with its own title, starting face down and turning over. */
    reveal: boolean;
    open: number;
    /** 0 = face up, 1 = back up; `flipK` runs toward it. */
    flip: number;
    flipK: number;
    /** Tilt now and where it heads (-1..1 of the max each way). */
    tx: number;
    ty: number;
    aimX: number;
    aimY: number;
    movedAt: number;
    /** A press on the card: a tap (not a drag) flips it on release. */
    press: { id: number; x: number; y: number; at: number } | null;
  }
  let viewer: Viewer | null = null;
  /** Textures: the faces by card (and the badge's language), the back, and the scratch the shine is drawn into. */
  const faces = new Map<string, HTMLCanvasElement>();
  const backTexes = new Map<string, HTMLCanvasElement>();
  let shineTex: HTMLCanvasElement | null = null;

  function viewerBox() {
    const v = view();
    // Fit the card inside the screen both ways: on a wide desktop view 70% of the
    // width alone overflows the height, so cap by the game's width and the height
    // left under the title and above the hint.
    const w = Math.round(Math.min(Math.min(v.w, W) * 0.7, ((v.h - 240) * 3) / 4));
    const h = Math.round((w * 4) / 3);
    return { cx: v.x + v.w / 2, cy: v.y + v.h / 2 + 10, w, h };
  }
  function viewerClose(): Rect {
    const b = viewerBox();
    const v = view();
    return { x: Math.min(v.x + v.w - 64, b.cx + b.w / 2 - 8), y: b.cy - b.h / 2 - 96, w: 56, h: 56 };
  }

  function openViewer(card: number, from: Overlay, reveal = false) {
    audio.tone({ freq: 988, dur: 0.07, type: "triangle", vol: 0.045 });
    pointersHeld.clear();
    tap = false;
    // A reveal starts back up and turns over as it pops in
    viewer = { card, from, reveal, open: 0, flip: 0, flipK: reveal ? 1 : 0, tx: 0, ty: 0, aimX: 0, aimY: 0, movedAt: -99, press: null };
    if (reveal) sfx.card(true);
    overlay = "viewer";
  }
  function closeViewer() {
    if (!viewer) return;
    overlay = viewer.from;
    viewer = null;
  }
  function flipViewer() {
    if (!viewer) return;
    viewer.flip = 1 - viewer.flip;
    audio.tone({ freq: viewer.flip ? 520 : 780, to: viewer.flip ? 780 : 520, dur: 0.18, type: "triangle", vol: 0.04 });
  }

  function stepViewer(dt: number) {
    const vw = viewer;
    if (!vw) return;
    vw.open = Math.min(1, vw.open + dt / OPEN_TIME);
    vw.flipK = clamp(vw.flipK + (vw.flip > vw.flipK ? dt : -dt) / FLIP_TIME, 0, 1);
    if (Math.abs(vw.flipK - vw.flip) < 1e-6) vw.flipK = vw.flip;
    // Follow the pointer; left alone, sway a little
    const idle = t - vw.movedAt > TILT_IDLE;
    const ax = idle ? Math.sin(t * 0.9) * 0.3 : vw.aimX;
    const ay = idle ? Math.sin(t * 0.7 + 1) * 0.25 : vw.aimY;
    const k = 1 - Math.exp(-dt * (idle ? 3 : 10));
    vw.tx += (ax - vw.tx) * k;
    vw.ty += (ay - vw.ty) * k;
  }

  function viewerMove(p: PointerInfo) {
    const vw = viewer;
    if (!vw) return;
    const b = viewerBox();
    vw.aimX = clamp((p.x - b.cx) / (b.w * 0.6), -1, 1);
    vw.aimY = clamp((p.y - b.cy) / (b.h * 0.6), -1, 1);
    vw.movedAt = t;
  }

  function viewerDown(p: PointerInfo) {
    const vw = viewer;
    if (!vw) return;
    const b = viewerBox();
    if (inRect(p, viewerClose())) return closeViewer();
    if (inRect(p, { x: b.cx - b.w / 2, y: b.cy - b.h / 2, w: b.w, h: b.h })) {
      vw.press = { id: p.id, x: p.x, y: p.y, at: t };
      viewerMove(p);
      return;
    }
    closeViewer();
  }

  function viewerUp(p: PointerInfo) {
    const vw = viewer;
    if (!vw?.press || vw.press.id !== p.id) return;
    const moved = Math.hypot(p.x - vw.press.x, p.y - vw.press.y);
    const quick = t - vw.press.at < 0.6;
    vw.press = null;
    if (moved < 16 && quick) flipViewer();
  }

  function faceTexture(card: number, w: number, h: number) {
    const img = sp.cards[card] ?? null;
    const ok = !!img?.complete && (img?.naturalWidth ?? 0) > 0;
    const key = `${card}:${rt.locale()}:${ok}:${w}`;
    let tex = faces.get(key);
    if (!tex) {
      tex = cardTexture((g, tw, th) => drawCardFace(g, img, 0, 0, tw, th, true, rareLabel(card)), w, h);
      faces.set(key, tex);
    }
    return tex;
  }
  function backTexture(card: number, w: number, h: number) {
    const rare = isRare(card);
    const ok = !!sp.img[rare ? "card-back-rare" : "card-back"];
    const key = `${rare}:${ok}:${Math.ceil(w)}`;
    let tex = backTexes.get(key);
    if (!tex) {
      // The whole 3:4 back art, edge to edge (no inset, so nothing is cropped or squashed)
      tex = cardTexture((g, tw, th) => drawCardBack(g, sp, 0, 0, tw, th, rare), w, h);
      backTexes.set(key, tex);
    }
    return tex;
  }

  function drawViewer() {
    const vw = viewer;
    if (!vw) return;
    const l = tr();
    const b = viewerBox();
    const v = view();
    ctx.fillStyle = "rgba(30,22,19,0.72)";
    ctx.fillRect(v.x, v.y, v.w, v.h);
    const pop = easeOutCubic(vw.open);
    // Textures at twice the logical size, for a crisp card on a phone
    const tw = b.w * 2;
    const th = b.h * 2;
    const face = faceTexture(vw.card, tw, th);
    const back = backTexture(vw.card, tw, th);
    if (!shineTex || shineTex.width !== face.width) {
      shineTex = document.createElement("canvas");
      shineTex.width = face.width;
      shineTex.height = face.height;
    }
    const flipping = smoothstep(vw.flipK);
    const yaw = vw.tx * TILT_YAW + flipping * Math.PI;
    const pitch = -vw.ty * TILT_PITCH;
    const showsFace = Math.cos(yaw) * Math.cos(pitch) >= 0;
    shineCard(shineTex, showsFace ? face : back, vw.tx, vw.ty, t, showsFace && isRare(vw.card));
    // A soft shadow under the card, shifted away from the light
    const lift = Math.sin(flipping * Math.PI);
    ctx.save();
    ctx.globalAlpha = 0.5 * pop;
    ctx.translate(b.cx - vw.tx * 18, b.cy + b.h / 2 + 18 + lift * 14);
    ctx.scale(b.w * 0.46 * (1 - lift * 0.3), 22);
    const shade = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    shade.addColorStop(0, "rgba(26,18,16,0.9)");
    shade.addColorStop(1, "rgba(26,18,16,0)");
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const scale = (0.6 + 0.4 * pop) * (1 + lift * 0.03);
    // The faces are mirrored copies: draw the shine canvas as whichever side shows
    drawCard3D(ctx, shineTex, shineTex, b.cx, b.cy - lift * 6, b.w * scale, b.h * scale, yaw, pitch);
    // Name above, the hint below, the close button
    ctx.globalAlpha = pop;
    const name = l.cards[CARD_IDS[vw.card]];
    headline(ctx, name, b.cx, b.cy - b.h / 2 - 66, fitSize(ctx, name, 34, b.w - 60), isRare(vw.card) ? HONEY : CREAM);
    if (vw.reveal) text(ctx, l.shopCardTitle, b.cx, b.cy - b.h / 2 - 108, fitSize(ctx, l.shopCardTitle, 20, b.w - 60), VIOLET, "center", null);
    text(ctx, l.flipHint, b.cx, b.cy + b.h / 2 + 66, fitSize(ctx, l.flipHint, 20, v.w - 60), MUTED, "center", null);
    const c = viewerClose();
    ctx.fillStyle = BROWN;
    ctx.beginPath();
    ctx.arc(c.x + c.w / 2, c.y + c.h / 2 + 3, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = CREAM;
    ctx.strokeStyle = BROWN;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(c.x + c.w / 2, c.y + c.h / 2, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = BROWN;
    ctx.lineWidth = 4.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (const d of [-1, 1]) {
      ctx.moveTo(c.x + c.w / 2 - 8, c.y + c.h / 2 - 8 * d);
      ctx.lineTo(c.x + c.w / 2 + 8, c.y + c.h / 2 + 8 * d);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
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
      ctx.fillStyle = "rgba(51,38,33,0.92)";
      ctx.beginPath();
      ctx.roundRect(W / 2 - 150, TOAST_Y - 22, 300, 44, 22);
      ctx.fill();
      ctx.strokeStyle = toast.color;
      ctx.lineWidth = 3;
      ctx.stroke();
      text(ctx, toast.text, W / 2, TOAST_Y + 1, fitSize(ctx, toast.text, 26, 280), toast.color);
      // The rare card's badge sits on the toast's corner like a tag
      if (toast.card >= 0 && isRare(toast.card)) drawRareBadge(ctx, W / 2 - 150 + 12, TOAST_Y - 24, 22, tr().rare);
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
      ctx.shadowColor = VIOLET;
      ctx.shadowBlur = 20;
      drawCardFace(ctx, sp.cards[c.card] ?? null, -w / 2, (-w * 2) / 3, w, (w * 4) / 3, true, rareLabel(c.card));
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
      ctx.fillStyle = "rgba(51,38,33,0.78)";
      ctx.fillRect(0, WHEEL_C.y - 78, W, 156);
      ctx.translate(W / 2, WHEEL_C.y - 18);
      ctx.scale(pop, pop);
      ctx.rotate(Math.sin(t * 6) * 0.03);
      headline(ctx, l.superSpin, 0, 0, fitSize(ctx, l.superSpin, 62, 480), CORE_COLORS[Math.floor(t * 10) % 6]);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = fade;
      headline(ctx, `+${superWon} ${l.tickets}`, W / 2, WHEEL_C.y + 44, 40, HONEY);
      ctx.restore();
      if (Math.random() < 0.5) burst(Math.random() * W, WHEEL_C.y - 70, 3, CORE_COLORS, 160);
    }
    if (jarWinFx > 0) drawJarWin();
  }

  /** All ten cards fanned out over the wheel, with the set bonus. */
  function drawSetCelebration() {
    const l = tr();
    const k = SET_TIME - setFx;
    const grow = k < 0.4 ? easeOutCubic(k / 0.4) : 1;
    const fade = setFx < 0.5 ? setFx / 0.5 : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = "rgba(51,38,33,0.84)";
    ctx.fillRect(0, WHEEL_C.y - 150, W, 330);
    for (let i = 0; i < CARD_COUNT; i++) {
      const a = (i - (CARD_COUNT - 1) / 2) * 0.13 * grow;
      ctx.save();
      ctx.translate(W / 2, WHEEL_C.y + 330);
      ctx.rotate(a);
      ctx.translate(0, -360 - Math.sin(t * 5 + i) * 4);
      ctx.shadowColor = CORE_COLORS[i % 6];
      ctx.shadowBlur = 16;
      drawCardFace(ctx, sp.cards[i] ?? null, -36, -48, 72, 96, true, rareLabel(i));
      ctx.restore();
    }
    ctx.translate(W / 2, WHEEL_C.y + 70);
    ctx.scale(grow, grow);
    ctx.rotate(Math.sin(t * 6) * 0.03);
    headline(ctx, l.setDone, 0, 0, fitSize(ctx, l.setDone, 52, 480), VIOLET);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = fade;
    headline(ctx, setWon, W / 2, WHEEL_C.y + 128, 40, HONEY);
    ctx.restore();
    if (Math.random() < 0.5) burst(Math.random() * W, WHEEL_C.y - 120, 3, [VIOLET, HONEY, CYAN, TERRA], 160);
  }

  // The album card: a 5×2 grid of cards with their names
  const ALBUM: Rect = { x: 16, y: H / 2 - 272, w: 508, h: 544 };
  const ALBUM_CARD = { w: 86, h: 115, gap: 9, row: 158 };
  const albumClose = (): Rect => ({ x: 284, y: ALBUM.y + ALBUM.h - 82, w: 220, h: 58 });
  /** Album card `i`'s rect on screen. */
  const albumCard = (i: number): Rect => {
    const x0 = W / 2 - (5 * ALBUM_CARD.w + 4 * ALBUM_CARD.gap) / 2;
    return {
      x: x0 + (i % 5) * (ALBUM_CARD.w + ALBUM_CARD.gap),
      y: ALBUM.y + 112 + Math.floor(i / 5) * ALBUM_CARD.row,
      w: ALBUM_CARD.w,
      h: ALBUM_CARD.h,
    };
  };
  /** The album card under a pointer (its name below counts too), or -1. */
  const albumCardAt = (p: PointerInfo) => {
    for (let i = 0; i < CARD_COUNT; i++) {
      const r = albumCard(i);
      if (inRect(p, { x: r.x - 4, y: r.y - 4, w: r.w + 8, h: r.h + 34 })) return i;
    }
    return -1;
  };
  /** The Rare badge's label for the rare card, null for the rest. */
  const rareLabel = (card: number) => (isRare(card) ? tr().rare : null);

  function drawAlbum() {
    const l = tr();
    const r = ALBUM;
    panel(ctx, r, 24);
    headline(ctx, l.albumTitle, W / 2, r.y + 46, fitSize(ctx, l.albumTitle, 36, r.w - 60), VIOLET);
    text(ctx, l.albumNote, W / 2, r.y + 86, fitSize(ctx, l.albumNote, 18, r.w - 40), CREAM, "center", null);
    for (let i = 0; i < CARD_COUNT; i++) {
      const c = albumCard(i);
      drawStashCard(i, c, true);
      const lines = wrap(ctx, l.cards[CARD_IDS[i]], ALBUM_CARD.w + 6, 13).slice(0, 2);
      for (const [j, ln] of lines.entries())
        text(ctx, ln, c.x + c.w / 2, c.y + c.h + 13 + j * 15, 13, s.cards[i] > 0 ? CREAM : MUTED, "center", null);
    }
    const owned = ownedCount(s.cards);
    text(ctx, `${owned}/${CARD_COUNT}`, W / 2, r.y + 112 + 2 * ALBUM_CARD.row + 4, 26, owned > 0 ? HONEY : MUTED, "center", null, LED_FONT, 700);
    const any = s.cards.some((n) => n > 0);
    dimIf(!any, () => button(ctx, albumExchange(), l.exchange, BTN_GO, 26));
    button(ctx, albumClose(), l.close, BTN_CARD, 26);
  }

  /** Draw `fn` faded when `off` (a button the player can't use right now). */
  function dimIf(off: boolean, fn: () => void) {
    ctx.save();
    if (off) ctx.globalAlpha *= 0.38;
    fn();
    ctx.restore();
  }

  /**
   * One cat in the stash: its card with an "xN" count; a cat exchanged down to
   * none is shown faded with "traded"; a cat never collected is a silhouette.
   */
  function drawStashCard(i: number, r: Rect, glow: boolean) {
    const l = tr();
    const n = s.cards[i];
    const seen = s.seen[i];
    ctx.save();
    if (n > 0 && glow) {
      ctx.shadowColor = CORE_COLORS[i % 6];
      ctx.shadowBlur = 12;
    }
    if (seen && n === 0) ctx.globalAlpha = 0.35;
    drawCardFace(ctx, sp.cards[i] ?? null, r.x, r.y, r.w, r.h, seen, rareLabel(i));
    ctx.restore();
    if (n > 0) {
      // The count, a pill on the card's bottom-right corner
      const label = l.count(n);
      ctx.font = `700 20px ${LED_FONT}`;
      const pw = Math.max(30, ctx.measureText(label).width + 14);
      const px = r.x + r.w - pw + 4;
      const py = r.y + r.h - 20;
      ctx.fillStyle = BROWN;
      ctx.beginPath();
      ctx.roundRect(px, py, pw, 24, 12);
      ctx.fill();
      ctx.strokeStyle = HONEY;
      ctx.lineWidth = 2;
      ctx.stroke();
      text(ctx, label, px + pw / 2, py + 13, 20, HONEY, "center", null, LED_FONT, 700);
    } else if (seen) {
      ctx.save();
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
      ctx.rotate(-0.2);
      text(ctx, l.traded, 0, 0, fitSize(ctx, l.traded, 17, r.w - 8), CREAM, "center", BROWN);
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------- the card exchange

  const EX: Rect = { x: 16, y: H / 2 - 330, w: 508, h: 660 };
  const EX_CARD = { w: 70, h: 93, gap: 18, row: 118 };
  /** The cat picked for a one-card exchange (-1: none yet). */
  let exPick = -1;
  /** An exchange waiting for the player's yes: one card, or the set. */
  let exAsk: { set: boolean } | null = null;
  /** The last exchange's pop on the exchange card. */
  let exPop: { text: string; t: number } | null = null;
  /** What the last full set paid, for the celebration. */
  let setWon = "";

  const exCard = (i: number): Rect => {
    const x0 = W / 2 - (5 * EX_CARD.w + 4 * EX_CARD.gap) / 2;
    return { x: x0 + (i % 5) * (EX_CARD.w + EX_CARD.gap), y: EX.y + 100 + Math.floor(i / 5) * EX_CARD.row, w: EX_CARD.w, h: EX_CARD.h };
  };
  /** The two exchange buttons, for tickets: one card, or the set. */
  const exButton = (set: boolean): Rect => ({ x: 110, y: EX.y + (set ? 498 : 384), w: 320, h: 56 });
  const exDone = (): Rect => ({ x: 150, y: EX.y + EX.h - 74, w: 240, h: 56 });
  const ASK: Rect = { x: 44, y: H / 2 - 120, w: 452, h: 240 };
  const askYes = (): Rect => ({ x: 70, y: ASK.y + ASK.h - 82, w: 190, h: 58 });
  const askNo = (): Rect => ({ x: 280, y: ASK.y + ASK.h - 82, w: 190, h: 58 });
  const albumExchange = (): Rect => ({ x: 36, y: ALBUM.y + ALBUM.h - 82, w: 220, h: 58 });

  const canExchange = (set: boolean) => (set ? hasSet(s) : exPick >= 0 && s.cards[exPick] > 0);

  function openExchange() {
    audio.tone({ freq: 740, dur: 0.06, type: "triangle", vol: 0.04 });
    if (exPick < 0 || !(s.cards[exPick] > 0)) exPick = s.cards.findIndex((n) => n > 0);
    exAsk = null;
    exPop = null;
    overlay = "exchange";
  }

  /** The player said yes: consume the cards, pay the tickets, save. */
  function doExchange(set: boolean) {
    const n = set ? exchangeSet(s) : exchangeCard(s, exPick);
    exAsk = null;
    if (n <= 0) return;
    const str = tr().ticketsN(n);
    payOut();
    bumpTickets = 1;
    markDirty();
    saveNow();
    say(tr().exchanged(str), HONEY, true);
    if (set) {
      // A full set: back to the machine for the fanfare
      setWon = str;
      setFx = SET_TIME;
      shake = Math.max(shake, 0.6);
      cheer = SET_TIME;
      sfx.setDone();
      for (let i = 0; i < 6; i++) burst(60 + i * 84, 300 + (i % 2) * 200, 26, [VIOLET, HONEY, CYAN, TERRA], 380);
      overlay = null;
      return;
    }
    sfx.card(true);
    exPop = { text: str, t: 0 };
  }

  function drawExchange() {
    const l = tr();
    panel(ctx, EX, 24);
    headline(ctx, l.exchange, W / 2, EX.y + 44, fitSize(ctx, l.exchange, 38, EX.w - 60), HONEY);
    text(ctx, l.pickCard, W / 2, EX.y + 80, fitSize(ctx, l.pickCard, 18, EX.w - 40), MUTED, "center", null);
    for (let i = 0; i < CARD_COUNT; i++) {
      const r = exCard(i);
      if (i === exPick) {
        ctx.strokeStyle = HONEY;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(r.x - 5, r.y - 5, r.w + 10, r.h + 10, 10);
        ctx.stroke();
      }
      drawStashCard(i, r, false);
    }
    // One card
    const pick = exPick >= 0 ? exPick : -1;
    const name = pick >= 0 ? l.cards[CARD_IDS[pick]] : "";
    const head = pick >= 0 ? `${l.oneCard}: ${name} ${l.count(s.cards[pick])}` : l.oneCard;
    text(ctx, head, 40, EX.y + 360, fitSize(ctx, head, 20, EX.w - 60), CREAM, "left", null);
    const one = l.ticketsN(cardRate(Math.max(pick, 0)));
    dimIf(!canExchange(false), () => button(ctx, exButton(false), one, BTN_GO, 24));
    // The full set
    const missing = s.cards.filter((n) => n === 0).length;
    const status = missing === 0 ? l.setReady : l.setMissing(missing);
    text(ctx, l.fullSet, 40, EX.y + 474, fitSize(ctx, l.fullSet, 18, EX.w - 210), CREAM, "left", null);
    text(ctx, status, EX.x + EX.w - 24, EX.y + 474, 18, missing === 0 ? HONEY : MUTED, "right", null);
    dimIf(!canExchange(true), () => button(ctx, exButton(true), l.ticketsN(setRate()), BTN_GO, 24));
    button(ctx, exDone(), l.done, BTN_CARD, 24);
    if (exPop) {
      const k = exPop.t;
      ctx.globalAlpha = k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.5);
      headline(ctx, exPop.text, W / 2, EX.y + 330 - k * 30, 30, HONEY);
      ctx.globalAlpha = 1;
    }
    if (exAsk) {
      const v = view();
      ctx.fillStyle = "rgba(30,22,19,0.6)";
      ctx.fillRect(v.x, v.y, v.w, v.h);
      panel(ctx, ASK, 22);
      const reward = l.ticketsN(exAsk.set ? setRate() : cardRate(exPick));
      const q = exAsk.set ? l.confirmSet(reward) : l.confirmCard(name, reward);
      const lines = wrap(ctx, q, ASK.w - 60, 24).slice(0, 3);
      for (const [i, ln] of lines.entries())
        text(ctx, ln, W / 2, ASK.y + 60 + i * 32 - (lines.length - 1) * 8, 24, CREAM, "center", null);
      button(ctx, askYes(), l.confirm, BTN_GO, 24);
      button(ctx, askNo(), l.cancel, BTN_ALT, 24);
    }
  }

  function exchangeDown(p: PointerInfo) {
    if (exAsk) {
      if (inRect(p, askYes())) doExchange(exAsk.set);
      else if (inRect(p, askNo()) || !inRect(p, ASK)) exAsk = null;
      return;
    }
    if (inRect(p, exDone()) || !inRect(p, EX)) {
      overlay = "album";
      return;
    }
    for (let i = 0; i < CARD_COUNT; i++) {
      const r = exCard(i);
      if (inRect(p, { x: r.x - 6, y: r.y - 6, w: r.w + 12, h: r.h + 12 })) {
        if (s.seen[i]) {
          exPick = i;
          audio.tone({ freq: 880, dur: 0.04, type: "triangle", vol: 0.035 });
        }
        return;
      }
    }
    for (const set of [false, true])
      if (inRect(p, exButton(set)) && canExchange(set)) {
        audio.tone({ freq: 660, dur: 0.06, type: "square", vol: 0.04 });
        exAsk = { set };
        return;
      }
  }

  function drawOverlay() {
    const l = tr();
    const loading = mode === "loading" || mode === "failed";
    if (!overlay && !loading) return;
    const v = view();
    ctx.fillStyle = "rgba(40,29,25,0.62)";
    ctx.fillRect(v.x, v.y, v.w, v.h);
    if (loading) {
      panel(ctx, LOADING, 24);
      headline(ctx, l.title, W / 2, LOADING.y + 52, fitSize(ctx, l.title, 40, LOADING.w - 60), HONEY);
      if (mode === "loading") {
        const dots = ".".repeat(1 + (Math.floor(t * 3) % 3));
        text(ctx, l.loading.replace(/…$/, dots), W / 2, LOADING.y + 130, 22, CREAM, "center", null);
      } else {
        for (const [i, ln] of wrap(ctx, l.loadFailed, 360, 19).entries())
          text(ctx, ln, W / 2, LOADING.y + 112 + i * 26, 19, CREAM, "center", null);
        button(ctx, RETRY, l.retry, BTN_GO, 26);
      }
      return;
    }
    if (overlay === "album") drawAlbum();
    else if (overlay === "exchange") drawExchange();
    else if (overlay === "start") {
      panel(ctx, PANEL, 26);
      headline(ctx, l.title, W / 2, 300, fitSize(ctx, l.title, 58, 400), HONEY);
      text(ctx, l.subtitle, W / 2, 352, 22, CREAM, "center", null);
      const note = mode === "guest" ? l.guestNote(TRIAL_COINS) : l.accountNote;
      const lines = wrap(ctx, note, 400, 18).slice(0, 2);
      for (const [i, ln] of lines.entries()) text(ctx, ln, W / 2, 396 + i * 24 - (lines.length - 1) * 12, 18, CYAN, "center", null);
      // The wallet, never the machine's all-time payout (lifetimeTickets is the leaderboard score, not a balance).
      // No weekly line: GameContext exposes no weekly-net API, and a different number would only confuse.
      const walletLine = mode === "guest" ? l.trialLine(trialTickets) : mode === "account" && tickets !== null ? l.walletLine(ticketTarget()) : null;
      if (walletLine) text(ctx, walletLine, W / 2, 456, fitSize(ctx, walletLine, 20, 400), HONEY, "center", null);
      for (const b of startButtons()) {
        const label = b.id === "go" ? (s.shots > 0 ? l.resume : l.start) : l.rules;
        button(ctx, b.rect, label, b.id === "go" ? BTN_GO : BTN_ALT, b.id === "go" ? 30 : 22);
      }
    } else if (overlay === "pause") {
      panel(ctx, { x: 60, y: 290, w: 420, h: coupons ? 322 : 270 }, 24);
      headline(ctx, l.paused, W / 2, 344, 40, CREAM);
      for (const b of pauseButtons()) {
        const label = b.id === "go" ? l.resume : b.id === "code" ? l.enterCode : l.rules;
        button(ctx, b.rect, label, b.id === "go" ? BTN_GO : BTN_ALT, b.id === "go" ? 28 : 20);
      }
    } else if (overlay === "rules") {
      const { r, size, line: lineH, gap } = rulesLayout();
      panel(ctx, r, 24);
      headline(ctx, l.rules, W / 2, r.y + 50, 38, CREAM);
      let y = r.y + 106;
      l.rulesLines.forEach((line, i) => {
        bullet(i, y);
        for (const ln of wrap(ctx, line, 410, size)) {
          text(ctx, ln, 84, y, size, CREAM, "left", null);
          y += lineH;
        }
        y += gap;
      });
      button(ctx, rulesClose(), l.close, BTN_GO, 26);
    } else if (overlay === "news") {
      const c = newsCard();
      panel(ctx, c.r, 24);
      const title = l.newsTitle(version);
      headline(ctx, title, W / 2, c.r.y + 50, fitSize(ctx, title, 36, c.r.w - 50), VIOLET);
      for (const ln of c.lines) {
        if (ln.dot !== undefined) bullet(ln.dot, ln.y);
        text(ctx, ln.str, ln.center ? W / 2 : 84, ln.y, ln.size, ln.color, ln.center ? "center" : "left", null);
      }
      button(ctx, c.close, l.close, BTN_CARD, 26);
    } else if (overlay === "viewer") drawViewer();
  }

  function bullet(i: number, y: number) {
    ctx.fillStyle = [CYAN, HONEY, TEAL, CORE_COLORS[i % 6], TERRA, VIOLET][i % 6];
    ctx.beginPath();
    ctx.arc(64, y + 1, 7, 0, Math.PI * 2);
    ctx.fill();
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

  function pause() {
    overlay = "pause";
    saveNow();
  }

  function down(p: PointerInfo) {
    // A tap after a while away (a dialog over the game, like the Prize Counter): look for purchases
    const now = Date.now();
    if (now - lastTapAt >= AWAY_TAP) wakeClaim();
    lastTapAt = now;
    if (mode === "loading") return;
    if (mode === "failed") {
      if (inRect(p, RETRY)) press("retry", "start");
      return;
    }
    if (overlay === "news") {
      if (inRect(p, newsCard().close) || !inRect(p, newsCard().r)) closeNews();
      return;
    }
    if (overlay === "start") {
      for (const b of startButtons()) if (inRect(p, b.rect)) return press(b.id, "start");
      if (inRect(p, ALBUM_BTN)) openAlbum("start");
      return;
    }
    if (overlay === "pause") {
      for (const b of pauseButtons()) if (inRect(p, b.rect)) return press(b.id, "pause");
      return;
    }
    if (overlay === "viewer") {
      viewerDown(p);
      return;
    }
    if (overlay === "rules") {
      if (inRect(p, rulesClose()) || !inRect(p, rulesRect())) overlay = rulesFrom;
      return;
    }
    if (overlay === "album") {
      if (inRect(p, albumClose()) || !inRect(p, ALBUM)) overlay = albumFrom;
      else if (inRect(p, albumExchange())) {
        if (s.cards.some((n) => n > 0)) openExchange();
      } else {
        // A collected cat opens the viewer; a silhouette stays shut
        const i = albumCardAt(p);
        if (i >= 0 && s.seen[i]) openViewer(i, "album");
      }
      return;
    }
    if (overlay === "exchange") {
      exchangeDown(p);
      return;
    }
    if (inRect(p, { x: MENU_BTN.x - 6, y: MENU_BTN.y - 6, w: MENU_BTN.w + 12, h: MENU_BTN.h + 12 })) {
      pause();
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
    // The out-of-coins strip's code button
    if (stripIn > 0.5 && coupons && inRect(p, stripCode())) {
      audio.tone({ freq: 660, dur: 0.06, type: "square", vol: 0.04 });
      coupons.open();
      return;
    }
    // A card's toast opens the card viewer
    if (toast && toast.card >= 0 && inRect(p, TOAST_RECT)) {
      openViewer(toast.card, null);
      return;
    }
    if (inRect(p, { x: AUTO_BTN.x - 8, y: AUTO_BTN.y - 8, w: AUTO_BTN.w + 16, h: AUTO_BTN.h + 16 })) {
      if (autoOn) autoOn = false;
      else if (s.coins > 0) autoOn = true;
      audio.tone({ freq: autoOn ? 740 : 520, dur: 0.05, type: "square", vol: 0.04 });
    }
  }

  // Coupons: coins only, never tickets, never a score report. They go into the
  // machine at once (and are saved at once: the code is already spent); one that
  // arrives while the account machine is still loading waits in storage.
  const offGrant = coupons?.onGrant((grant) => {
    let coins = 0;
    for (const r of grant.rewards) if (r.kind === "coins" && r.amount > 0) coins += Math.floor(r.amount);
    if (coins <= 0) return;
    if (mode === "account" || mode === "guest") {
      grantCoins(s, coins);
      saveNow();
    } else {
      pendingCoins += coins;
      storage.set(PENDING_KEY, pendingCoins);
    }
    bumpCoins = 1;
    audio.tone({ freq: 880, dur: 0.1, type: "triangle", vol: 0.05 });
    pop(tr().couponCoins(coins), COINS_BOX.x + COINS_BOX.w / 2, COINS_BOX.y + COINS_BOX.h + 30, CYAN, 34);
    say(tr().couponCoins(coins), CYAN);
  });

  // Start: the account machine loads (then claims the allowance); a guest's trial is ready now
  if (mode === "loading") void loadAccount();
  else applyPending();

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
      move(p) {
        if (overlay === "viewer") viewerMove(p);
      },
      up(p) {
        pointersHeld.delete(p.id);
        if (overlay === "viewer") viewerUp(p);
      },
    },
    keydown(e) {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        if (e.repeat || mode === "loading") return;
        if (mode === "failed") press("retry", "start");
        else if (overlay === "news") closeNews();
        else if (overlay === "start" || overlay === "pause") press("go", overlay);
        else if (overlay === "viewer") flipViewer();
        else if (overlay === "rules") overlay = rulesFrom;
        else if (overlay === "album") overlay = albumFrom;
        else if (overlay === "exchange") {
          if (exAsk) doExchange(exAsk.set);
        } else onSpace(true);
      } else if (e.code === "Escape") {
        if (overlay === null) pause();
        else if (overlay === "pause") overlay = null;
        else if (overlay === "viewer") closeViewer();
        else if (overlay === "news") closeNews();
        else if (overlay === "rules") overlay = rulesFrom;
        else if (overlay === "album") overlay = albumFrom;
        else if (overlay === "exchange") {
          if (exAsk) exAsk = null;
          else overlay = "album";
        }
      }
    },
    keyup(e) {
      if (e.code === "Space" || e.code === "Enter") onSpace(false);
    },
    suspend() {
      // The next step runs once the game is back: claim then (Prize Counter purchases)
      resumed = true;
      pointersHeld.clear();
      autoOn = false;
      spaceHeld = false;
      tap = false;
      if (overlay === null) overlay = "pause";
      writeSummary();
      // Leaving: the leaderboard rides on this save if the tickets grew
      if (!fileScore()) saveNow();
    },
    dispose() {
      jarFeed.dispose();
      offGrant?.();
      offBalance?.();
      if (mode === "account" || mode === "guest") {
        payOut();
        if (!fileScore()) saveNow();
      }
      disposed = true;
    },
  };
}
