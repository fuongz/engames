import type { PointerInfo, Rect } from "../core";
import { type App, H, W, btn, viewRect } from "./app";
import { C, button, clockIcon, cover, panel, sprite, stars, text } from "./art";
import {
  INGREDIENTS,
  type IngredientId,
  type RecipeId,
  SPOON,
  type Step,
} from "./config";
import {
  type BakeResult,
  type Grade,
  type StepResult,
  bakeResult,
  finishBatch,
  gradeAmount,
  gradeMix,
  gradeOven,
  gradePick,
  gradePipe,
  gradeStove,
  has,
  ingredient,
  measureUnits,
  pantryQty,
  recipe,
  startBatch,
} from "./logic";

// Baking by hand, one recipe step at a time. The card at the top is the recipe;
// following it is the player's job, and every step is graded the moment it is
// done. A major slip ends the batch on the spot (no point finishing it).

type Phase =
  | { kind: "pick" }
  | { kind: "measure"; amount: number; holding: boolean; hold: number }
  | { kind: "mix"; turns: number; angle: number | null; spin: number }
  | { kind: "stove"; on: boolean; t: number }
  | { kind: "ovenSet"; temp: number }
  | { kind: "ovenRun"; temp: number; minutes: number }
  | { kind: "pipe"; amount: number; holding: boolean }
  | { kind: "wait"; t: number };

export interface BakeState {
  recipe: RecipeId;
  cost: number;
  step: number;
  results: StepResult[];
  phase: Phase;
  feedback: { grade: Grade; text: string; t: number } | null;
  outcome: BakeResult | null;
}

/** Real seconds an oven step takes at the right time, whatever its minutes. */
const OVEN_SECONDS = 5;
const OVEN_START = 150;
const POUR_BASE = 0.3;
const POUR_RAMP = 1.1;
const PIPE_RATE = 0.65;

function phaseFor(step: Step | undefined): Phase {
  switch (step?.kind) {
    case "add":
      return { kind: "pick" };
    case "mix":
      return { kind: "mix", turns: 0, angle: null, spin: 0 };
    case "stove":
      return { kind: "stove", on: false, t: 0 };
    case "oven":
      return { kind: "ovenSet", temp: OVEN_START };
    case "pipe":
      return { kind: "pipe", amount: 0, holding: false };
    default:
      return { kind: "wait", t: 0 };
  }
}

/** Set the batch's ingredients and time aside, then into the kitchen. */
export function startBake(app: App, id: RecipeId) {
  const started = startBatch(app.save, id);
  if (!started.ok) return app.sfx.bad();
  app.commit(started.save, { now: true });
  const r = recipe(id);
  app.go({
    kind: "bake",
    bake: {
      recipe: id,
      cost: started.cost,
      step: 0,
      results: [],
      phase: phaseFor(r.steps[0]),
      feedback: null,
      outcome: null,
    },
  });
}

function stepLabel(app: App, s: Step) {
  const tr = app.tr();
  const locale = app.rt.locale();
  switch (s.kind) {
    case "add": {
      const d = ingredient(s.ing);
      return tr.stepAdd(
        tr.amount(s.amount, d.unit, d.measure === "spoon"),
        d.name[locale],
      );
    }
    case "mix":
      return `${tr.stepMix[s.mode]} · ${tr.turns(s.turns)}`;
    case "stove":
      return tr.stepStove[s.mode];
    case "wait":
      return tr.stepWait(s.mode, s.minutes);
    case "oven":
      return tr.stepOven(s.temp, s.minutes);
    case "pipe":
      return tr.stepPipe[s.mode];
  }
}

const GRADE_COLOR: Record<Grade, string> = {
  perfect: C.good,
  good: "#7cc47e",
  minor: C.warn,
  major: C.bad,
};

/** Record a graded step: feedback now, then the next step, or the end of the batch. */
function grade(app: App, b: BakeState, res: StepResult, advance = true) {
  const tr = app.tr();
  const locale = app.rt.locale();
  b.results.push(res);
  const ing = res.ing ? ingredient(res.ing).name[locale] : undefined;
  const line =
    res.grade === "perfect"
      ? tr.grade.perfect
      : `${tr.grade[res.grade]} ${tr.note(res.note, ing)}`;
  b.feedback = { grade: res.grade, text: line, t: 0 };
  if (res.grade === "major") {
    app.sfx.bad();
    b.outcome = bakeResult(b.results);
    return;
  }
  if (res.grade === "perfect" || res.grade === "good") app.sfx.good();
  else app.sfx.bad();
  if (!advance) return;
  b.step++;
  const r = recipe(b.recipe);
  if (b.step >= r.steps.length) b.outcome = bakeResult(b.results);
  else b.phase = phaseFor(r.steps[b.step]);
}

export function updateBake(app: App, b: BakeState, dt: number) {
  if (b.feedback) {
    b.feedback.t += dt;
    if (b.feedback.t > 1.6) b.feedback = null;
  }
  if (b.outcome) return;
  const step = recipe(b.recipe).steps[b.step];
  const p = b.phase;
  if (p.kind === "measure" && p.holding && step?.kind === "add") {
    p.hold += dt;
    p.amount += step.amount * (POUR_BASE + POUR_RAMP * p.hold) * dt;
    if (Math.random() < dt * 14) app.sfx.pour();
  } else if (p.kind === "stove" && p.on && step?.kind === "stove") {
    p.t += dt;
    // Left on the heat far too long: it burns by itself
    if (p.t > step.seconds * 2) grade(app, b, gradeStove(step.seconds, p.t));
  } else if (p.kind === "ovenRun" && step?.kind === "oven") {
    p.minutes += (step.minutes / OVEN_SECONDS) * dt;
    if (p.minutes > step.minutes * 2)
      grade(app, b, gradeOven(step, p.temp, p.minutes));
  } else if (p.kind === "pipe" && p.holding) {
    p.amount += PIPE_RATE * dt;
  } else if (p.kind === "mix") {
    p.spin = Math.max(0, p.spin - dt * 3);
  } else if (p.kind === "wait") {
    p.t += dt;
  }
}

export function drawBake(app: App, b: BakeState) {
  const { ctx } = app;
  const v = viewRect(app);
  cover(ctx, app.sprites.get("bg-kitchen"), v, 0.45);
  ctx.fillStyle = "rgba(255, 246, 230, 0.3)";
  ctx.fillRect(v.x, v.y, v.w, v.h);
  const cardBottom = drawRecipeCard(app, b);
  if (b.outcome) return drawOutcome(app, b);

  const step = recipe(b.recipe).steps[b.step];
  const station: Rect = {
    x: 0,
    y: cardBottom + 10,
    w: W,
    h: H - 230 - cardBottom,
  };
  const p = b.phase;
  if (step.kind === "add") {
    if (p.kind === "pick") drawPick(app, b);
    else if (p.kind === "measure") drawMeasure(app, b, step, p, station);
  } else if (step.kind === "mix" && p.kind === "mix")
    drawMix(app, b, step, p, station);
  else if (step.kind === "stove" && p.kind === "stove")
    drawStove(app, b, step, p, station);
  else if (
    step.kind === "oven" &&
    (p.kind === "ovenSet" || p.kind === "ovenRun")
  )
    drawOven(app, b, step, p, station);
  else if (step.kind === "pipe" && p.kind === "pipe")
    drawPipe(app, b, p, station);
  else if (step.kind === "wait" && p.kind === "wait")
    drawWait(app, b, step, station);

  if (b.feedback) drawFeedback(app, b.feedback, station.y + 40);
}

/** The recipe card pinned up top: every step, ticked as it is done. */
function drawRecipeCard(app: App, b: BakeState) {
  const { ctx } = app;
  const locale = app.rt.locale();
  const r = recipe(b.recipe);
  const top = app.rt.stage.view.y + 12;
  const perCol = Math.ceil(r.steps.length / 2);
  const lineH = 25;
  const card = { x: 14, y: top, w: W - 28, h: 58 + perCol * lineH };
  panel(ctx, card, {
    fill: "#fff6e3",
    stroke: C.cardBorder,
    radius: 20,
    line: 4,
  });
  sprite(ctx, app.sprites.get(r.sprite), card.x + 34, card.y + 28, 40, 36);
  text(ctx, r.name[locale], card.x + 60, card.y + 28, {
    size: 22,
    align: "left",
    maxWidth: card.w - 80,
  });
  const colW = (card.w - 24) / 2;
  r.steps.forEach((s, i) => {
    const col = i < perCol ? 0 : 1;
    const row = col ? i - perCol : i;
    const x = card.x + 12 + col * colW;
    const y = card.y + 58 + row * lineH;
    const current = i === b.step && !b.outcome;
    if (current) {
      panel(
        ctx,
        { x: x - 2, y: y - 11, w: colW - 6, h: 23 },
        { fill: "#fbe1bf", radius: 11, line: 0 },
      );
    }
    const past = i < b.step || (b.outcome && i <= b.step);
    ctx.beginPath();
    ctx.arc(x + 10, y + 1, 7, 0, Math.PI * 2);
    ctx.fillStyle = past ? C.good : current ? C.cardBorder : "#eadbd3";
    ctx.fill();
    text(ctx, `${i + 1}. ${stepLabel(app, s)}`, x + 22, y + 1, {
      size: 15,
      weight: current ? 800 : 700,
      align: "left",
      fill: past ? C.muted : C.text,
      maxWidth: colW - 30,
    });
  });
  return card.y + card.h;
}

/** Which jars are on the shelf: everything this recipe needs plus whatever else is in the pantry. */
function shelf(app: App, b: BakeState): IngredientId[] {
  const r = recipe(b.recipe);
  const inRecipe = new Set(
    r.steps.flatMap((s) => (s.kind === "add" ? [s.ing] : [])),
  );
  return INGREDIENTS.filter(
    (i) => inRecipe.has(i.id) || pantryQty(app.save, i.id) > 0,
  ).map((i) => i.id);
}

function drawPick(app: App, b: BakeState) {
  const { ctx } = app;
  const tr = app.tr();
  const locale = app.rt.locale();
  const items = shelf(app, b);
  // One row up to six jars, two rows beyond that; centred, never giant
  const perRow = items.length <= 6 ? items.length : Math.ceil(items.length / 2);
  const size = Math.min(100, (W - 28 - (perRow - 1) * 8) / perRow);
  const x0 = (W - (perRow * size + (perRow - 1) * 8)) / 2;
  const rows = Math.ceil(items.length / perRow);
  const sy = H - 20 - rows * (size + 8);
  panel(
    ctx,
    { x: 8, y: sy - 14, w: W - 16, h: rows * (size + 8) + 22 },
    { fill: "#c99a6b", stroke: C.ink, radius: 16, line: 4 },
  );
  sprite(ctx, app.sprites.get("tool-bowl"), W / 2, sy - 70, 250, 200, "bottom");
  text(ctx, tr.pickIng, W / 2, sy - 40, {
    size: 21,
    fill: C.white,
    outline: C.ink,
  });
  items.forEach((id, i) => {
    const r = {
      x: x0 + (i % perRow) * (size + 8),
      y: sy + Math.floor(i / perRow) * (size + 8),
      w: size,
      h: size,
    };
    const key = `shelf-${id}`;
    const pressed = app.ui.isPressed(key);
    panel(
      ctx,
      { ...r, y: r.y + (pressed ? 2 : 0) },
      { fill: C.card, stroke: C.creamDeep, radius: 14, line: 3 },
    );
    const def = ingredient(id);
    sprite(
      ctx,
      app.sprites.get(def.sprite),
      r.x + size / 2,
      r.y + size / 2 - 6 + (pressed ? 2 : 0),
      size - 22,
      size - 30,
    );
    text(ctx, def.name[locale], r.x + size / 2, r.y + size - 12, {
      size: 12,
      maxWidth: size - 6,
    });
    app.ui.add({
      rect: r,
      key,
      tap: () => {
        app.sfx.tap();
        const wrong = gradePick(recipe(b.recipe), b.step, id);
        if (wrong) return grade(app, b, wrong, false);
        b.phase = { kind: "measure", amount: 0, holding: false, hold: 0 };
      },
    });
  });
}

function drawMeasure(
  app: App,
  b: BakeState,
  step: Extract<Step, { kind: "add" }>,
  p: Extract<Phase, { kind: "measure" }>,
  st: Rect,
) {
  const { ctx } = app;
  const tr = app.tr();
  const def = ingredient(step.ing);
  const cx = W / 2;
  const cy = st.y + st.h * 0.58;
  const pour = def.measure === "pour";
  if (pour) {
    sprite(
      ctx,
      app.sprites.get("tool-scale"),
      cx,
      cy + 120,
      260,
      250,
      "bottom",
    );
    // The bag tips over the scale while pouring
    ctx.save();
    ctx.translate(cx + 70, cy - 120);
    ctx.rotate(p.holding ? -0.9 : -0.25);
    sprite(ctx, app.sprites.get(def.sprite), 0, 0, 110, 110);
    ctx.restore();
    if (p.holding) {
      ctx.fillStyle = streamColor(step.ing);
      for (let i = 0; i < 10; i++) {
        const k = (app.time * 3 + i / 10) % 1;
        ctx.beginPath();
        ctx.arc(
          cx + 22 + Math.sin(i * 7) * 6,
          cy - 90 + k * 120,
          5,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    // Readout and gauge
    const ro = { x: cx - 110, y: st.y + 6, w: 220, h: 60 };
    panel(ctx, ro, { fill: "#2f3b36", stroke: C.ink, radius: 14, line: 4 });
    text(ctx, `${Math.round(p.amount)} ${def.unit}`, cx, ro.y + 31, {
      size: 32,
      fill: "#b9f5c6",
    });
    const g = { x: 50, y: ro.y + 74, w: W - 100, h: 20 };
    const max = step.amount * 1.5;
    panel(ctx, g, { fill: "#f6e6dc", radius: 10, line: 3 });
    zone(ctx, g, max, step.amount * 0.88, step.amount * 1.12, "#ffe08a");
    zone(ctx, g, max, step.amount * 0.95, step.amount * 1.05, "#9fdc8f");
    const nx = g.x + (Math.min(p.amount, max) / max) * g.w;
    ctx.fillStyle = C.ink;
    ctx.fillRect(nx - 2, g.y - 6, 4, g.h + 12);
    text(ctx, tr.holdPour, cx, H - 200, {
      size: 18,
      fill: C.white,
      outline: C.ink,
    });
    const hold = { x: 24, y: H - 170, w: 250, h: 92 };
    button(ctx, hold, "", {
      fill: p.holding ? "#fbd9b4" : C.cream,
      pressed: p.holding,
    });
    sprite(
      ctx,
      app.sprites.get(def.sprite),
      hold.x + hold.w / 2,
      hold.y + 40 + (p.holding ? 4 : 0),
      70,
      60,
    );
    app.ui.add({
      rect: hold,
      down: () => {
        p.holding = true;
        p.hold = 0;
      },
      up: () => {
        p.holding = false;
      },
    });
  } else {
    sprite(ctx, app.sprites.get("tool-bowl"), cx, cy + 110, 250, 200, "bottom");
    const units = measureUnits(step.ing, p.amount);
    const bob = p.hold > 0 ? Math.max(0, 1 - (app.time - p.hold) * 4) * 14 : 0;
    sprite(ctx, app.sprites.get(def.sprite), cx, cy - 80 - bob, 120, 110);
    const unit = def.measure === "count" ? tr.eggUnit : tr.spoonUnit;
    text(ctx, `${units} ${unit}`, cx, st.y + 40, {
      size: 40,
      fill: C.white,
      outline: C.ink,
    });
    const tap = { x: 24, y: H - 170, w: 250, h: 92 };
    btn(
      app,
      "count",
      tap,
      `+1 ${unit}`,
      () => {
        p.amount += def.measure === "count" ? 1 : SPOON;
        p.hold = app.time;
        app.sfx.pour();
      },
      { size: 28, silent: true },
    );
    text(ctx, tr.tapAdd(unit), cx, H - 200, {
      size: 18,
      fill: C.white,
      outline: C.ink,
    });
  }
  btn(
    app,
    "added",
    { x: W - 250, y: H - 170, w: 226, h: 92 },
    tr.added,
    () =>
      grade(app, b, gradeAmount(step.ing, step.amount, Math.round(p.amount))),
    {
      fill: C.green,
      size: 24,
      disabled: p.amount <= 0 || p.holding,
    },
  );
}

function zone(
  ctx: CanvasRenderingContext2D,
  g: Rect,
  max: number,
  lo: number,
  hi: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.fillRect(
    g.x + (lo / max) * g.w,
    g.y + 3,
    ((hi - lo) / max) * g.w,
    g.h - 6,
  );
}

function streamColor(id: IngredientId) {
  const colors: Partial<Record<IngredientId, string>> = {
    flour: "#fff7ea",
    sugar: "#ffffff",
    butter: "#ffe58a",
    milk: "#ffffff",
    cream: "#fffaf0",
    strawberry: "#ff6b7d",
    oil: "#ffd84d",
    chocolate: "#6b3b2a",
  };
  return colors[id] ?? "#fff3d6";
}

function drawMix(
  app: App,
  b: BakeState,
  step: Extract<Step, { kind: "mix" }>,
  p: Extract<Phase, { kind: "mix" }>,
  st: Rect,
) {
  const { ctx } = app;
  const tr = app.tr();
  const cx = W / 2;
  const cy = st.y + st.h * 0.55;
  const R = Math.min(170, st.h * 0.45);
  // Progress ring: a full circle is 1.5× the turns asked for, the green arc is "just right"
  const max = step.turns * 1.5;
  const arc = (from: number, to: number, color: string, w: number) => {
    ctx.beginPath();
    ctx.arc(
      cx,
      cy,
      R + 14,
      -Math.PI / 2 + (from / max) * Math.PI * 2,
      -Math.PI / 2 + (to / max) * Math.PI * 2,
    );
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.stroke();
  };
  arc(0, max, "rgba(255,255,255,0.7)", 16);
  arc(step.turns * 0.9, step.turns * 1.1, "#9fdc8f", 16);
  arc(0, Math.min(p.turns, max), C.cardBorder, 8);
  sprite(ctx, app.sprites.get("tool-bowl"), cx, cy + R * 0.2, R * 2, R * 1.7);
  // The batter swirls with the spoon
  ctx.save();
  ctx.translate(cx, cy - R * 0.05);
  ctx.scale(1, 0.42);
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.68, 0, Math.PI * 2);
  ctx.fillStyle =
    step.mode === "whisk"
      ? "#fff6e4"
      : step.mode === "knead"
        ? "#f3dcb2"
        : "#f8e2b4";
  ctx.fill();
  ctx.strokeStyle = "rgba(160, 110, 70, 0.35)";
  ctx.lineWidth = 6;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(
      0,
      0,
      R * (0.2 + i * 0.16),
      p.turns * Math.PI * 2 + i,
      p.turns * Math.PI * 2 + i + 2.2,
    );
    ctx.stroke();
  }
  ctx.restore();
  const a = p.turns * Math.PI * 2;
  ctx.save();
  ctx.translate(
    cx + Math.cos(a) * R * 0.45,
    cy - R * 0.05 + Math.sin(a) * R * 0.2,
  );
  ctx.rotate(-0.6);
  sprite(ctx, app.sprites.get("tool-whisk"), 0, -40, 120, 120);
  ctx.restore();
  text(ctx, tr.turns(Math.floor(p.turns * 10) / 10), cx, st.y + 20, {
    size: 30,
    fill: C.white,
    outline: C.ink,
  });
  text(ctx, tr.spin, cx, H - 200, { size: 18, fill: C.white, outline: C.ink });

  const area = {
    x: cx - R - 40,
    y: cy - R - 40,
    w: (R + 40) * 2,
    h: (R + 40) * 2,
  };
  const angleOf = (pt: PointerInfo) => Math.atan2(pt.y - cy, pt.x - cx);
  app.ui.add({
    rect: area,
    down: (pt) => {
      p.angle = Math.hypot(pt.x - cx, pt.y - cy) > 24 ? angleOf(pt) : null;
    },
    move: (pt) => {
      if (Math.hypot(pt.x - cx, pt.y - cy) < 24) return;
      const now = angleOf(pt);
      if (p.angle !== null) {
        let d = now - p.angle;
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        p.turns += Math.abs(d) / (Math.PI * 2);
        p.spin = Math.min(1, p.spin + Math.abs(d));
        if (Math.random() < Math.abs(d)) app.sfx.pour();
      }
      p.angle = now;
    },
    up: () => {
      p.angle = null;
    },
  });
  const auto =
    has(app.save, "mixer") && (step.mode === "whisk" || step.mode === "cream");
  if (auto) {
    btn(
      app,
      "mixer",
      { x: 24, y: H - 150, w: 226, h: 80 },
      tr.useMixer,
      () => {
        p.turns = step.turns;
        grade(app, b, gradeMix(step.turns, step.turns));
      },
      { size: 22 },
    );
  }
  btn(
    app,
    "mixed",
    { x: W - 250, y: H - 150, w: 226, h: 80 },
    tr.done,
    () => grade(app, b, gradeMix(step.turns, p.turns)),
    {
      fill: C.green,
      size: 26,
      disabled: p.turns <= 0,
    },
  );
}

const STOVE_COLORS: Record<string, [string, string, string]> = {
  caramel: ["#f7f0e2", "#e2a23f", "#3a1d0c"],
  fry: ["#f6e2b8", "#e4a95a", "#4a2a14"],
  cook: ["#fbf2d6", "#efd89a", "#7a5530"],
};

function mixColor(a: string, b: string, k: number) {
  const pa = [1, 3, 5].map((i) => Number.parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => Number.parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((x, i) =>
    Math.round(x + (pb[i] - x) * Math.min(1, Math.max(0, k))),
  );
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function stoveColor(mode: string, k: number) {
  const [a, b, c] = STOVE_COLORS[mode] ?? STOVE_COLORS.cook;
  return k <= 1 ? mixColor(a, b, k) : mixColor(b, c, k - 1);
}

function drawStove(
  app: App,
  b: BakeState,
  step: Extract<Step, { kind: "stove" }>,
  p: Extract<Phase, { kind: "stove" }>,
  st: Rect,
) {
  const { ctx } = app;
  const tr = app.tr();
  const cx = W / 2;
  const cy = st.y + st.h * 0.55;
  // Burner and flames
  panel(
    ctx,
    { x: cx - 150, y: cy + 50, w: 300, h: 40 },
    { fill: "#d9d3e8", radius: 14, line: 4 },
  );
  if (p.on) {
    for (let i = 0; i < 7; i++) {
      const fx = cx - 90 + i * 30;
      const fh = 18 + Math.sin(app.time * 18 + i) * 6;
      ctx.beginPath();
      ctx.moveTo(fx - 8, cy + 52);
      ctx.quadraticCurveTo(fx, cy + 52 - fh * 2, fx + 8, cy + 52);
      ctx.fillStyle = i % 2 ? "#ffb347" : "#ff7a45";
      ctx.fill();
    }
  }
  sprite(
    ctx,
    app.sprites.get("tool-saucepan"),
    cx + 40,
    cy + 60,
    330,
    190,
    "bottom",
  );
  const k = p.t / step.seconds;
  ctx.save();
  ctx.translate(cx - 17, cy - 72);
  ctx.scale(1, 0.38);
  ctx.beginPath();
  ctx.arc(0, 0, 80, 0, Math.PI * 2);
  ctx.fillStyle = stoveColor(step.mode, k);
  ctx.fill();
  ctx.restore();
  if (p.on) {
    for (let i = 0; i < 5; i++) {
      const bx = cx - 77 + ((i * 37 + app.time * 40) % 120);
      const by = cy - 80 + Math.sin(app.time * 9 + i) * 6;
      ctx.beginPath();
      ctx.arc(bx, by, 4 + (i % 2) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  // The colour to aim for
  const sw = { x: cx - 120, y: st.y + 8, w: 240, h: 56 };
  panel(ctx, sw, { fill: C.card, stroke: C.cardBorder, radius: 18, line: 4 });
  ctx.beginPath();
  ctx.arc(sw.x + 36, sw.y + 28, 17, 0, Math.PI * 2);
  ctx.fillStyle = stoveColor(step.mode, 1);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = C.ink;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(sw.x + 86, sw.y + 28, 17, 0, Math.PI * 2);
  ctx.fillStyle = stoveColor(step.mode, k);
  ctx.fill();
  ctx.stroke();
  text(ctx, "→", sw.x + 61, sw.y + 28, { size: 20 });
  text(ctx, tr.stepStove[step.mode], sw.x + 168, sw.y + 28, {
    size: 17,
    maxWidth: 120,
  });
  text(ctx, tr.stoveHint, cx, H - 200, {
    size: 17,
    fill: C.white,
    outline: C.ink,
    maxWidth: W - 40,
  });
  if (!p.on) {
    btn(
      app,
      "heat",
      { x: W / 2 - 140, y: H - 160, w: 280, h: 92 },
      tr.heatOn,
      () => {
        p.on = true;
      },
      { fill: "#ffd6a8", size: 28 },
    );
  } else {
    btn(
      app,
      "offheat",
      { x: W / 2 - 140, y: H - 160, w: 280, h: 92 },
      tr.offHeat,
      () => grade(app, b, gradeStove(step.seconds, p.t)),
      {
        fill: C.green,
        size: 28,
      },
    );
  }
}

function drawOven(
  app: App,
  b: BakeState,
  step: Extract<Step, { kind: "oven" }>,
  p: Extract<Phase, { kind: "ovenSet" } | { kind: "ovenRun" }>,
  st: Rect,
) {
  const { ctx } = app;
  const tr = app.tr();
  const cx = W / 2;
  const ov = { w: 330, h: 330 };
  const oy = st.y + st.h * 0.5 + ov.h / 2;
  const running = p.kind === "ovenRun";
  sprite(ctx, app.sprites.get("tool-oven"), cx, oy, ov.w, ov.h, "bottom");
  // The window: dark, glowing while it bakes, with the cake rising and browning inside
  const win = { x: cx - 91, y: oy - 194, w: 205, h: 118 };
  if (!running) {
    // An oven that is off has a dark window
    ctx.fillStyle = "#4a2c20";
    ctx.fillRect(win.x, win.y, win.w, win.h);
  }
  if (running) {
    const k = p.minutes / step.minutes;
    ctx.save();
    ctx.beginPath();
    ctx.rect(win.x, win.y, win.w, win.h);
    ctx.clip();
    ctx.fillStyle = `rgba(255, ${150 + Math.sin(app.time * 6) * 20}, 60, 0.75)`;
    ctx.fillRect(win.x, win.y, win.w, win.h);
    const rise = 0.7 + Math.min(1, k) * 0.3;
    sprite(
      ctx,
      app.sprites.get(recipe(b.recipe).sprite),
      cx,
      win.y + win.h - 4,
      120 * rise,
      90 * rise,
      "bottom",
    );
    if (k > 1) {
      ctx.fillStyle = `rgba(40, 20, 10, ${Math.min(0.75, (k - 1) * 0.9)})`;
      ctx.fillRect(win.x, win.y, win.w, win.h);
    }
    ctx.restore();
    const clock = { x: cx - 100, y: st.y + 6, w: 200, h: 60 };
    panel(ctx, clock, { fill: "#2f3b36", stroke: C.ink, radius: 14, line: 4 });
    text(
      ctx,
      `${Math.floor(p.minutes)} ${app.rt.locale() === "vi" ? "phút" : "min"}`,
      cx,
      clock.y + 31,
      { size: 30, fill: "#ffcf8a" },
    );
    btn(
      app,
      "ovenout",
      { x: W / 2 - 140, y: H - 160, w: 280, h: 92 },
      tr.ovenOut,
      () => grade(app, b, gradeOven(step, p.temp, p.minutes)),
      {
        fill: C.green,
        size: 28,
      },
    );
    return;
  }
  // Set the dial
  const dial = { x: cx - 160, y: st.y + 4, w: 320, h: 70 };
  panel(ctx, dial, { fill: C.card, stroke: C.cardBorder, radius: 22, line: 4 });
  text(ctx, `${p.temp}°C`, cx, dial.y + 36, { size: 34 });
  const minus = { x: dial.x + 8, y: dial.y + 8, w: 64, h: 58 };
  const plus = { x: dial.x + dial.w - 72, y: dial.y + 8, w: 64, h: 58 };
  btn(app, "tminus", minus, "−", () => (p.temp = Math.max(100, p.temp - 10)), {
    size: 30,
  });
  btn(app, "tplus", plus, "+", () => (p.temp = Math.min(250, p.temp + 10)), {
    size: 30,
  });
  text(ctx, tr.ovenSet, cx, H - 200, {
    size: 18,
    fill: C.white,
    outline: C.ink,
  });
  btn(
    app,
    "ovenin",
    { x: W / 2 - 140, y: H - 160, w: 280, h: 92 },
    tr.ovenIn,
    () => {
      b.phase = { kind: "ovenRun", temp: p.temp, minutes: 0 };
    },
    { fill: "#ffd6a8", size: 28 },
  );
}

function drawPipe(
  app: App,
  b: BakeState,
  p: Extract<Phase, { kind: "pipe" }>,
  st: Rect,
) {
  const { ctx } = app;
  const tr = app.tr();
  const cx = W / 2;
  const cy = st.y + st.h * 0.6;
  sprite(ctx, app.sprites.get(recipe(b.recipe).sprite), cx, cy + 60, 230, 200);
  // The ideal swirl (dashed) and what has been squeezed so far
  const target = 70;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.arc(cx, cy - 40, target, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.setLineDash([]);
  const r = target * Math.min(2, p.amount);
  if (r > 2) {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(
        cx,
        cy - 40 + r * 0.3 - i * r * 0.32,
        r * (1 - i * 0.25),
        r * (0.4 - i * 0.06),
        0,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = i % 2 ? "#ffe3ea" : "#ffd0dc";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = C.ink;
      ctx.stroke();
    }
  }
  ctx.save();
  ctx.translate(cx + 60, cy - 150 - (p.holding ? 0 : 10));
  ctx.rotate(0.5);
  sprite(ctx, app.sprites.get("tool-piping-bag"), 0, 0, 130, 130);
  ctx.restore();
  text(ctx, tr.pipeHint, cx, H - 200, {
    size: 18,
    fill: C.white,
    outline: C.ink,
  });
  const hold = { x: 24, y: H - 170, w: 250, h: 92 };
  button(ctx, hold, tr.stepPipe.frost, {
    fill: p.holding ? "#fbd9b4" : C.cream,
    pressed: p.holding,
    size: 22,
  });
  app.ui.add({
    rect: hold,
    down: () => {
      p.holding = true;
    },
    up: () => {
      p.holding = false;
    },
  });
  btn(
    app,
    "piped",
    { x: W - 250, y: H - 170, w: 226, h: 92 },
    tr.done,
    () => grade(app, b, gradePipe(p.amount)),
    {
      fill: C.green,
      size: 26,
      disabled: p.amount <= 0 || p.holding,
    },
  );
}

function drawWait(
  app: App,
  b: BakeState,
  step: Extract<Step, { kind: "wait" }>,
  st: Rect,
) {
  const { ctx } = app;
  const tr = app.tr();
  const cx = W / 2;
  const cy = st.y + st.h * 0.5;
  clockIcon(ctx, cx, cy - 20, 90, app.time * 600);
  text(ctx, tr.stepWait(step.mode, step.minutes), cx, cy + 110, {
    size: 28,
    fill: C.white,
    outline: C.ink,
  });
  btn(
    app,
    "waited",
    { x: W / 2 - 140, y: H - 160, w: 280, h: 92 },
    tr.next,
    () => grade(app, b, { grade: "perfect", note: "exact" }),
    {
      fill: C.green,
      size: 28,
    },
  );
}

function drawFeedback(
  app: App,
  f: NonNullable<BakeState["feedback"]>,
  y: number,
) {
  const k = f.t / 1.6;
  const alpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
  app.ctx.save();
  app.ctx.globalAlpha = Math.max(0, alpha);
  const scale = 1 + Math.max(0, 0.25 - f.t) * 1.6;
  app.ctx.translate(W / 2, y + 60 - k * 30);
  app.ctx.scale(scale, scale);
  text(app.ctx, f.text, 0, 0, {
    size: 30,
    fill: GRADE_COLOR[f.grade],
    outline: C.white,
    maxWidth: W - 40,
  });
  app.ctx.restore();
}

/** The batch is done (or ruined): show it, then onto the display or into the bin. */
function drawOutcome(app: App, b: BakeState) {
  const { ctx } = app;
  const tr = app.tr();
  const locale = app.rt.locale();
  const r = recipe(b.recipe);
  const out = b.outcome;
  if (!out) return;
  const m = { x: 30, y: 300, w: W - 60, h: 520 };
  panel(ctx, m, {
    fill: C.board,
    stroke: C.boardDeep,
    radius: 30,
    line: 5,
    lip: 6,
  });
  app.ui.block(viewRect(app));
  const failed = "fail" in out;
  const title = failed ? tr.fail[out.fail] : tr.baked(r.yield, r.name[locale]);
  text(ctx, title, W / 2, m.y + 44, {
    size: 30,
    fill: C.white,
    outline: C.ink,
    maxWidth: m.w - 40,
  });
  const inner = { x: m.x + 20, y: m.y + 80, w: m.w - 40, h: 250 };
  panel(ctx, inner, {
    fill: failed ? C.cardInner : C.owned,
    stroke: failed ? C.cardBorder : C.ownedBorder,
    radius: 22,
    line: 4,
  });
  const bounce = Math.sin(app.time * 3) * 4;
  sprite(
    ctx,
    app.sprites.get(failed ? `fail-${out.fail}` : r.sprite),
    W / 2,
    inner.y + inner.h / 2 + bounce - (failed ? 0 : 14),
    200,
    180,
  );
  if (!failed) stars(ctx, W / 2, inner.y + inner.h - 28, out.stars, 18);
  // What went wrong, briefly
  const notes = b.results.filter((x) => x.grade !== "perfect").slice(-3);
  notes.forEach((n, i) => {
    const ing = n.ing ? ingredient(n.ing).name[locale] : undefined;
    text(
      ctx,
      `• ${tr.note(n.note, ing)}`,
      W / 2,
      inner.y + inner.h + 26 + i * 26,
      { size: 18, weight: 700, fill: GRADE_COLOR[n.grade], outline: C.white },
    );
  });
  const br = { x: m.x + 40, y: m.y + m.h - 92, w: m.w - 80, h: 74 };
  btn(
    app,
    "outcome",
    br,
    failed ? tr.bin : tr.store,
    () => {
      const before = app.save.mastery[b.recipe] ?? 0;
      const next = finishBatch(app.save, b.recipe, out, b.cost, true);
      app.commit(next);
      if (!failed && before < 3 && (next.mastery[b.recipe] ?? 0) >= 3)
        app.toast(tr.mastered, W / 2, 300, C.good, 34);
      if (!failed) app.sfx.coin();
      app.go({ kind: "hub" });
    },
    { fill: failed ? C.cream : C.green, size: 26 },
  );
}
