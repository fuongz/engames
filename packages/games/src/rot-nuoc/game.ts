import "@fontsource/baloo-2/800.css";
import {
  type GameHooks,
  type PointerInfo,
  type Rect,
  type Runtime,
  SUMMARY_KEY,
  inRect,
  smoothstep as ease,
} from "@web-games/core";
import {
  CONFETTI,
  type Glyph,
  type Layer,
  MOUTH_H,
  TUBE_W,
  UNIT_H,
  drawBackdrop,
  drawGift,
  drawStream,
  drawTube,
  glyph,
  makeBackdrop,
  text,
  tubeLength,
  countBadge,
  yellowButton,
} from "./art";
import {
  GIFT_EVERY,
  GIFT_TUBES,
  GIFT_UNDOS,
  H,
  LIFT,
  MAX_UNDOS,
  POUR_TIME,
  REPORT_EVERY,
  START_TUBES,
  START_UNDOS,
  UNDO_PER_LEVEL,
  W,
} from "./config";
import {
  type Board,
  type Move,
  type Tube,
  addTube,
  canAddTube,
  canPour,
  createBoard,
  isComplete,
  pour,
  restart,
  solved,
  undo,
} from "./logic";
import { STRINGS } from "./strings";

interface Progress {
  level: number;
  undos: number;
  tubes: number;
  /** Levels cleared towards the next gift. */
  gift: number;
}

interface Anim {
  move: Move;
  t: number;
}

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  spin: number;
}

const TILT = 1.15; // ~66°, ad: the tube leans well over the target

export function setup(rt: Runtime): GameHooks {
  const { stage, ctx } = rt;
  const { storage, audio, reportScore } = rt.game;
  const tr = () => STRINGS[rt.locale()];
  const backdrop = makeBackdrop();

  const progress: Progress = {
    level: 1,
    undos: START_UNDOS,
    tubes: START_TUBES,
    gift: 0,
    ...storage.get<Partial<Progress>>("progress", {}),
  };
  const save = () => storage.set("progress", progress);

  let board: Board = createBoard(progress.level);
  let selected: number | null = null;
  let anims: Anim[] = [];
  let shakes: number[] = [];
  let bits: Bit[] = [];
  let toast: { text: string; t: number; color: string } | null = null;
  let won: { t: number; pours: number; level: number } | null = null;
  let t = 0;

  const view = () => stage.view;
  const top = () => view().y;
  const left = () => Math.max(view().x, 0);
  const right = () => Math.min(view().x + view().w, W);

  // ---------------------------------------------------------- layout

  const len = () => tubeLength(board.capacity);

  /** Mouth (top-centre) of each tube: one row up to six tubes, else two rows, top row fuller (ad: 6 over 5). */
  function slot(i: number) {
    const n = board.tubes.length;
    const rows = n <= 6 ? 1 : 2;
    const perTop = rows === 1 ? n : Math.ceil(n / 2);
    const row = i < perTop ? 0 : 1;
    const inRow = row === 0 ? perTop : n - perTop;
    const col = row === 0 ? i : i - perTop;
    const gap = Math.min(78, (W - 40) / Math.max(inRow, 1));
    const x = W / 2 + (col - (inRow - 1) / 2) * gap;
    const y = rows === 1 ? 380 : 250 + row * (len() + 84);
    return { x, y };
  }

  const tubeRect = (i: number): Rect => {
    const s = slot(i);
    return {
      x: s.x - TUBE_W / 2 - 8,
      y: s.y - LIFT - 10,
      w: TUBE_W + 16,
      h: len() + LIFT + 20,
    };
  };

  const restartBtn = (): Rect => ({
    x: left() + 18,
    y: top() + 22,
    w: 64,
    h: 50,
  });
  const undoBtn = (): Rect => ({
    x: right() - 172,
    y: top() + 22,
    w: 64,
    h: 50,
  });
  const tubeBtn = (): Rect => ({
    x: right() - 92,
    y: top() + 22,
    w: 64,
    h: 50,
  });
  const giftPos = () => ({ x: right() - 66, y: top() + 128 });
  const giftRect = (): Rect => {
    const g = giftPos();
    return { x: g.x - 34, y: g.y - 34, w: 68, h: 76 };
  };
  const nextBtn = (): Rect => ({
    x: W / 2 - 120,
    y: top() + view().h / 2 + 70,
    w: 240,
    h: 60,
  });

  // ---------------------------------------------------------- actions

  function say(str: string, color = "#ffffff") {
    toast = { text: str, t: 0, color };
  }

  const busy = (i: number) =>
    anims.some((a) => a.move.from === i || a.move.to === i);

  function tapTube(i: number) {
    if (busy(i)) return;
    if (selected === null) {
      if (
        board.tubes[i].length === 0 ||
        isComplete(board.tubes[i], board.capacity)
      )
        return;
      selected = i;
      audio.tone({ freq: 660, dur: 0.05, type: "triangle", vol: 0.06 });
      return;
    }
    if (selected === i) {
      selected = null;
      return;
    }
    const from = selected;
    if (canPour(board.tubes, board.capacity, from, i)) {
      const m = pour(board, from, i);
      if (m) {
        anims.push({ move: m, t: 0 });
        selected = null;
        for (let k = 0; k < 4; k++)
          audio.tone({
            freq: 300 + k * 90,
            dur: 0.09,
            type: "sine",
            vol: 0.05,
            delay: 0.2 + k * 0.08,
          });
      }
      return;
    }
    // Not allowed: shake the target, and pick it up instead if it has liquid
    shakes[i] = 0.3;
    audio.tone({ freq: 180, dur: 0.12, type: "square", vol: 0.05 });
    say(tr().ruleHint, "#ffb0b0");
    selected =
      board.tubes[i].length > 0 && !isComplete(board.tubes[i], board.capacity)
        ? i
        : null;
  }

  function finishAnims() {
    for (const a of anims) onPoured(a.move);
    anims = [];
  }

  function doUndo() {
    if (won) return;
    if (progress.undos <= 0) return say(tr().noUndo, "#ffb0b0");
    finishAnims();
    if (!undo(board)) return;
    progress.undos--;
    save();
    selected = null;
    audio.tone({ freq: 520, to: 360, dur: 0.12, type: "triangle", vol: 0.07 });
  }

  function doAddTube() {
    if (won) return;
    if (!canAddTube(board)) return say(tr().tubeUsed, "#ffb0b0");
    if (progress.tubes <= 0) return say(tr().noTube, "#ffb0b0");
    finishAnims();
    addTube(board);
    progress.tubes--;
    save();
    audio.tone({ freq: 700, to: 1100, dur: 0.18, type: "sine", vol: 0.08 });
  }

  function doRestart() {
    if (won) return;
    finishAnims();
    restart(board);
    selected = null;
    audio.tone({ freq: 440, to: 330, dur: 0.15, type: "triangle", vol: 0.07 });
  }

  function claimGift() {
    if (progress.gift < GIFT_EVERY) return;
    progress.gift = 0;
    progress.undos = Math.min(MAX_UNDOS, progress.undos + GIFT_UNDOS);
    progress.tubes += GIFT_TUBES;
    save();
    const g = giftPos();
    confetti(g.x, g.y, 40);
    say(`${tr().gift} ${tr().giftReward(GIFT_UNDOS, GIFT_TUBES)}`, "#ffe27a");
    for (const [i, f] of [784, 988, 1318].entries())
      audio.tone({
        freq: f,
        dur: 0.12,
        type: "sine",
        vol: 0.1,
        delay: i * 0.07,
      });
  }

  function nextLevel() {
    if (!won) return;
    won = null;
    board = createBoard(progress.level);
    selected = null;
    anims = [];
    shakes = [];
  }

  /** A pour finished animating: sparkle a completed tube, and check for the win. */
  function onPoured(m: Move) {
    const dst = board.tubes[m.to];
    if (isComplete(dst, board.capacity)) {
      const s = slot(m.to);
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2;
        bits.push({
          x: s.x,
          y: s.y + 6,
          vx: Math.cos(a) * 140,
          vy: Math.sin(a) * 140 - 60,
          life: 0.7,
          color: "#ffffff",
          spin: 0,
        });
      }
      audio.tone({ freq: 1046, dur: 0.1, type: "sine", vol: 0.08 });
      audio.tone({
        freq: 1568,
        dur: 0.16,
        type: "sine",
        vol: 0.06,
        delay: 0.06,
      });
    }
  }

  function checkWin() {
    if (won || anims.length > 0 || !solved(board)) return;
    const level = board.level;
    won = { t: 0, pours: board.moves, level };
    progress.level = level + 1;
    progress.undos = Math.min(MAX_UNDOS, progress.undos + UNDO_PER_LEVEL);
    progress.gift = Math.min(GIFT_EVERY, progress.gift + 1);
    save();
    storage.set(SUMMARY_KEY, {
      vi: `Đã qua màn ${level}`,
      en: `Cleared level ${level}`,
    });
    // The portal's save dialog every few levels, not after each one
    if (level % REPORT_EVERY === 0)
      reportScore?.({ score: level, detail: tr().detail(level) });
    confetti(W / 2, top() + 200, 90);
    for (const [i, f] of [523, 659, 784, 1046].entries())
      audio.tone({
        freq: f,
        dur: 0.18,
        type: "triangle",
        vol: 0.12,
        delay: i * 0.1,
      });
  }

  function confetti(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const v = 200 + Math.random() * 320;
      bits.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 1.6 + Math.random(),
        color: CONFETTI[i % CONFETTI.length],
        spin: Math.random() * 6,
      });
    }
  }

  const hasMove = () => {
    for (let a = 0; a < board.tubes.length; a++)
      for (let b = 0; b < board.tubes.length; b++)
        if (canPour(board.tubes, board.capacity, a, b)) return true;
    return false;
  };

  // ---------------------------------------------------------- input

  function onPointerDown(p: PointerInfo) {
    if (won) {
      if (won.t > 0.6 && inRect(p, nextBtn())) nextLevel();
      return;
    }
    if (inRect(p, restartBtn())) return doRestart();
    if (inRect(p, undoBtn())) return doUndo();
    if (inRect(p, tubeBtn())) return doAddTube();
    if (progress.gift >= GIFT_EVERY && inRect(p, giftRect()))
      return claimGift();
    for (let i = 0; i < board.tubes.length; i++) {
      if (inRect(p, tubeRect(i))) return tapTube(i);
    }
    selected = null;
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (e.code === "KeyZ") doUndo();
    else if (e.code === "KeyR") doRestart();
    else if (e.code === "KeyT") doAddTube();
    else if (e.code === "Escape") selected = null;
    else if (e.code === "Enter" || e.code === "Space") {
      if (won && won.t > 0.6) nextLevel();
    } else if (/^Digit[0-9]$/.test(e.code)) {
      // 1..9 then 0 pick the first ten tubes
      const d = Number(e.code.slice(5));
      const i = d === 0 ? 9 : d - 1;
      if (i < board.tubes.length && !won) tapTube(i);
    }
  };

  // ---------------------------------------------------------- frame

  function step(dt: number) {
    t += dt;
    for (const a of anims) a.t += dt;
    const done = anims.filter((a) => a.t >= POUR_TIME);
    anims = anims.filter((a) => a.t < POUR_TIME);
    for (const a of done) onPoured(a.move);
    checkWin();
    shakes = shakes.map((v) => Math.max(0, (v ?? 0) - dt));
    for (const b of bits) {
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vy += 520 * dt;
      b.vx *= 0.99;
    }
    bits = bits.filter((b) => b.life > 0);
    if (toast) {
      toast.t += dt;
      if (toast.t > 2.2) toast = null;
    }
    if (won) won.t += dt;
  }

  /** Group a tube into layers, then adjust for any pour still animating into or out of it. */
  function layersOf(i: number): Layer[] {
    const tube: Tube = board.tubes[i];
    const layers: Layer[] = [];
    for (const c of tube) {
      const last = layers[layers.length - 1];
      if (last && last.color === c) last.amount++;
      else layers.push({ color: c, amount: 1 });
    }
    for (const a of anims) {
      const p = pourProgress(a.t);
      const pending = a.move.count * (1 - p);
      if (a.move.from === i && pending > 0) {
        const last = layers[layers.length - 1];
        if (last && last.color === a.move.color) last.amount += pending;
        else layers.push({ color: a.move.color, amount: pending });
      }
      if (a.move.to === i && pending > 0) {
        const last = layers[layers.length - 1];
        if (last) last.amount -= pending;
      }
    }
    return layers;
  }

  // Timeline of a pour: fly over (0–25%), pour (25–70%), fly back (70–100%)
  const pourProgress = (at: number) => ease((at / POUR_TIME - 0.25) / 0.45);

  function pose(i: number): { x: number; y: number; angle: number } {
    const s = slot(i);
    const a = anims.find((x) => x.move.from === i);
    const shake = shakes[i] ? Math.sin(t * 60) * 5 * (shakes[i] / 0.3) : 0;
    if (!a)
      return { x: s.x + shake, y: s.y - (selected === i ? LIFT : 0), angle: 0 };
    const d = slot(a.move.to);
    const sign = s.x <= d.x ? 1 : -1;
    const over = { x: d.x - sign * 12, y: d.y - 64, angle: sign * TILT };
    const k = a.t / POUR_TIME;
    if (k < 0.25) {
      const e = ease(k / 0.25);
      return {
        x: s.x + (over.x - s.x) * e,
        y: s.y - LIFT + (over.y - s.y + LIFT) * e,
        angle: over.angle * e,
      };
    }
    if (k < 0.7) return over;
    const e = ease((k - 0.7) / 0.3);
    return {
      x: over.x + (s.x - over.x) * e,
      y: over.y + (s.y - over.y) * e,
      angle: over.angle * (1 - e),
    };
  }

  function draw() {
    const v = view();
    stage.begin();
    drawBackdrop(ctx, backdrop, v.x, v.y, v.x + v.w, v.y + v.h);

    // Resting tubes first, pouring tubes on top
    const order = board.tubes
      .map((_, i) => i)
      .sort(
        (a, b) =>
          Number(anims.some((x) => x.move.from === a)) -
          Number(anims.some((x) => x.move.from === b)),
      );
    for (const i of order) {
      const p = pose(i);
      drawTube(
        ctx,
        p.x,
        p.y,
        p.angle,
        layersOf(i),
        board.capacity,
        selected === i,
      );
    }
    // Streams from tilted lips into their targets
    for (const a of anims) {
      const k = a.t / POUR_TIME;
      if (k < 0.25 || k > 0.7) continue;
      const p = pose(a.move.from);
      const sign = p.angle > 0 ? 1 : -1;
      const lipX = p.x + sign * (TUBE_W / 2) * Math.cos(TILT);
      const lipY = p.y + (TUBE_W / 2) * Math.sin(TILT);
      const d = slot(a.move.to);
      const filled = layersOf(a.move.to).reduce(
        (n, l) => n + Math.max(0, l.amount),
        0,
      );
      const surface = d.y + MOUTH_H + (board.capacity - filled) * UNIT_H;
      const thin = Math.min(1, (k - 0.25) * 20, (0.7 - k) * 20);
      drawStream(ctx, lipX, lipY, surface, a.move.color, 6 * thin);
    }

    drawHud();
    for (const b of bits) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, b.life * 2);
      ctx.translate(b.x, b.y);
      ctx.rotate(t * b.spin);
      ctx.fillStyle = b.color;
      ctx.fillRect(-4, -2.5, 8, 5);
      ctx.restore();
    }
    if (won) drawWin();
    stage.end();
  }

  function counted(r: Rect, kind: Glyph, n: number, enabled: boolean) {
    yellowButton(ctx, r.x, r.y, r.w, r.h, enabled);
    glyph(ctx, kind, r.x + r.w / 2, r.y + r.h / 2, 30, enabled);
    countBadge(ctx, r.x + r.w - 4, r.y + 2, n, enabled);
  }

  function drawHud() {
    const l = tr();
    const r = restartBtn();
    yellowButton(ctx, r.x, r.y, r.w, r.h, true);
    glyph(ctx, "restart", r.x + r.w / 2, r.y + r.h / 2, 30);
    counted(
      undoBtn(),
      "undo",
      progress.undos,
      progress.undos > 0 && board.history.length > 0,
    );
    counted(
      tubeBtn(),
      "tube",
      progress.tubes,
      progress.tubes > 0 && canAddTube(board),
    );
    // ad: big white "LEVEL 58" with a gift box beside it
    text(ctx, l.level(board.level), W / 2 - 20, top() + 128, 38, "#ffffff");
    const g = giftPos();
    drawGift(
      ctx,
      g.x,
      g.y,
      progress.gift / GIFT_EVERY,
      progress.gift >= GIFT_EVERY,
      l.claim,
      t,
    );

    const bottom = Math.min(top() + view().h, H + 60);
    if (toast) {
      ctx.globalAlpha = Math.min(1, toast.t * 5, (2.2 - toast.t) * 3);
      text(
        ctx,
        toast.text,
        W / 2,
        bottom - 110,
        17,
        toast.color,
        "center",
        700,
      );
      ctx.globalAlpha = 1;
    } else if (!won && anims.length === 0 && !solved(board) && !hasMove()) {
      text(ctx, l.stuck, W / 2, bottom - 110, 17, "#ffd36b", "center", 700);
    } else if (board.level <= 2 && board.moves === 0) {
      text(ctx, l.tapHint, W / 2, bottom - 110, 17, "#dfe4ee", "center", 700);
    }
  }

  function drawWin() {
    if (!won) return;
    const v = view();
    const a = Math.min(1, won.t * 3);
    ctx.fillStyle = `rgba(6,6,10,${0.6 * a})`;
    ctx.fillRect(v.x, v.y, v.w, v.h);
    const cy = top() + v.h / 2;
    const pop = 1 + Math.max(0, 0.3 - won.t) * 1.5;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(W / 2, cy - 60);
    ctx.scale(pop, pop);
    text(ctx, tr().won, 0, 0, 52, "#ffe27a");
    ctx.restore();
    ctx.globalAlpha = a;
    text(
      ctx,
      tr().wonLine(won.level, won.pours),
      W / 2,
      cy - 4,
      19,
      "#ffffff",
      "center",
      700,
    );
    text(ctx, tr().undoReward, W / 2, cy + 28, 16, "#9affb0", "center", 700);
    if (won.t > 0.6) {
      const r = nextBtn();
      ctx.fillStyle = "#3a2a06";
      ctx.beginPath();
      ctx.roundRect(r.x, r.y + 4, r.w, r.h, 16);
      ctx.fill();
      const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
      g.addColorStop(0, "#5ae0ff");
      g.addColorStop(1, "#1aa0d8");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 16);
      ctx.fill();
      text(ctx, tr().next, W / 2, r.y + r.h / 2 + 1, 26, "#ffffff");
    }
    ctx.globalAlpha = 1;
  }

  return {
    update: step,
    render: draw,
    pointer: { down: onPointerDown },
    keydown: onKey,
  };
}
