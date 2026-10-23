import { BOSS_HALF_H, BOSS_HALF_W, type PickupKind, W } from "./config";
import { mulberry32 } from "./logic";

// Procedural art in the ad's palette: a saturated blue Pacific, sandy islands
// with dark rock and palms, a yellow-winged lead plane with grey wingmen, green
// fighters with red roundels and a grey/orange battleship. Static shapes are
// pre-rendered to offscreen canvases once; rotors, the boss and flames draw per frame.

type Ctx = CanvasRenderingContext2D;
export const FONT = '"Baloo 2", "Trebuchet MS", system-ui, sans-serif';

/** Offscreen sprite drawn around its centre at 2x for crisp scaling. */
export interface Sprite {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
}

function sprite(w: number, h: number, draw: (ctx: Ctx) => void): Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = w * 2;
  canvas.height = h * 2;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.scale(2, 2);
    ctx.translate(w / 2, h / 2);
    draw(ctx);
  }
  return { canvas, w, h };
}

export function blit(
  ctx: Ctx,
  s: Sprite,
  x: number,
  y: number,
  scale = 1,
  angle = 0,
) {
  if (angle === 0) {
    ctx.drawImage(
      s.canvas,
      x - (s.w * scale) / 2,
      y - (s.h * scale) / 2,
      s.w * scale,
      s.h * scale,
    );
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.drawImage(
    s.canvas,
    (-s.w * scale) / 2,
    (-s.h * scale) / 2,
    s.w * scale,
    s.h * scale,
  );
  ctx.restore();
}

/** Flat dark silhouette of a sprite, drawn offset below aircraft as a shadow on the sea. */
export function shadowOf(s: Sprite): Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = s.canvas.width;
  canvas.height = s.canvas.height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.drawImage(s.canvas, 0, 0);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = "rgba(6,20,60,0.32)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  return { canvas, w: s.w, h: s.h };
}

function poly(ctx: Ctx, pts: number[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

/** Same shape mirrored around x = 0, for symmetric aircraft. */
function mirror(draw: (side: 1 | -1) => void) {
  draw(1);
  draw(-1);
}

export function glowDot(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  color: string,
  alpha = 1,
) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

export function text(
  ctx: Ctx,
  str: string,
  x: number,
  y: number,
  size: number,
  fill = "#fff",
  align: CanvasTextAlign = "center",
  weight = 800,
) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.min(6, Math.max(2.5, size * 0.16));
  ctx.strokeStyle = "rgba(8,16,48,0.85)";
  ctx.strokeText(str, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(str, x, y);
}

function star(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.42 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function vgrad(ctx: Ctx, y0: number, y1: number, stops: string[]) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [i, c] of stops.entries()) g.addColorStop(i / (stops.length - 1), c);
  return g;
}

function hgrad(ctx: Ctx, x0: number, x1: number, stops: string[]) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  for (const [i, c] of stops.entries()) g.addColorStop(i / (stops.length - 1), c);
  return g;
}

// ---------------------------------------------------------------- aircraft

/** Lead plane, nose up: yellow wings with blue star roundels on a navy fuselage. */
function drawHero(ctx: Ctx) {
  ctx.lineJoin = "round";
  // Shadow-side outline first so every part gets a dark rim
  ctx.strokeStyle = "#1a1636";
  ctx.lineWidth = 3;
  // Wings
  poly(
    ctx,
    [
      -56, 2, -50, -8, -10, -12, 10, -12, 50, -8, 56, 2, 52, 10, 10, 8, -10, 8,
      -52, 10,
    ],
  );
  ctx.stroke();
  ctx.fillStyle = vgrad(ctx, -12, 10, ["#ffe27a", "#f4b528", "#c9801a"]);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  poly(ctx, [-50, -6, -10, -10, 10, -10, 50, -6, 50, -3, -50, -3]);
  ctx.fill();
  mirror((s) => {
    ctx.fillStyle = "#26357e";
    ctx.beginPath();
    ctx.arc(s * 33, -1, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    star(ctx, s * 33, -1, 5.5);
    ctx.fill();
  });
  // Tail plane
  poly(ctx, [-20, 30, -18, 24, 18, 24, 20, 30, 16, 34, -16, 34]);
  ctx.stroke();
  ctx.fillStyle = vgrad(ctx, 24, 34, ["#ffe27a", "#d8901d"]);
  ctx.fill();
  // Fuselage
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 38, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = hgrad(ctx, -9, 9, ["#2a2468", "#5a54b8", "#2a2468"]);
  ctx.fill();
  ctx.fillStyle = "#c6413c";
  ctx.fillRect(-6, 14, 12, 4);
  // Canopy
  ctx.fillStyle = vgrad(ctx, -16, -2, ["#e8fbff", "#6fc8f0", "#2a6aa0"]);
  ctx.beginPath();
  ctx.ellipse(0, -8, 5, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  // Nose and spinning prop
  ctx.fillStyle = "#c6413c";
  ctx.beginPath();
  ctx.ellipse(0, -36, 5, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(220,230,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, -39, 20, 3, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Grey escort plane, nose up. */
function drawWingman(ctx: Ctx) {
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#1c2230";
  ctx.lineWidth = 2.5;
  poly(ctx, [-30, 2, -27, -5, -5, -7, 5, -7, 27, -5, 30, 2, 27, 6, -27, 6]);
  ctx.stroke();
  ctx.fillStyle = vgrad(ctx, -7, 6, ["#e6ecf2", "#a9b4c2", "#6f7b8c"]);
  ctx.fill();
  mirror((s) => {
    ctx.fillStyle = "#26357e";
    ctx.beginPath();
    ctx.arc(s * 18, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    star(ctx, s * 18, 0, 3);
    ctx.fill();
  });
  poly(ctx, [-11, 18, -10, 14, 10, 14, 11, 18, 9, 20, -9, 20]);
  ctx.stroke();
  ctx.fillStyle = "#b8c2ce";
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 0, 5, 22, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = hgrad(ctx, -5, 5, ["#7a8698", "#dfe6ee", "#7a8698"]);
  ctx.fill();
  ctx.fillStyle = "#79c8ef";
  ctx.beginPath();
  ctx.ellipse(0, -5, 3, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#58cf6a";
  ctx.fillRect(-2, -24, 4, 4);
}

/** Green fighter with red roundels and a red spine, nose up (rotated to its heading). */
function drawZero(ctx: Ctx) {
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#16260f";
  ctx.lineWidth = 2.5;
  poly(ctx, [-30, 2, -26, -5, -6, -7, 6, -7, 26, -5, 30, 2, 26, 6, -26, 6]);
  ctx.stroke();
  ctx.fillStyle = vgrad(ctx, -7, 6, ["#a6d465", "#6c9a38", "#3f6420"]);
  ctx.fill();
  mirror((s) => {
    ctx.fillStyle = "#e0342c";
    ctx.beginPath();
    ctx.arc(s * 18, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
  });
  poly(ctx, [-11, 19, -10, 14, 10, 14, 11, 19, 9, 21, -9, 21]);
  ctx.stroke();
  ctx.fillStyle = "#6c9a38";
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 1, 5, 22, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = hgrad(ctx, -5, 5, ["#3f6420", "#8cbc4c", "#3f6420"]);
  ctx.fill();
  ctx.fillStyle = "#d83a30";
  ctx.fillRect(-1.5, -8, 3, 22);
  ctx.fillStyle = "#cfeef8";
  ctx.beginPath();
  ctx.ellipse(0, -5, 3, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(230,230,230,0.4)";
  ctx.beginPath();
  ctx.ellipse(0, -22, 12, 2, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Twin-engine green bomber, nose down. */
function drawBomber(ctx: Ctx) {
  ctx.rotate(Math.PI);
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#16260f";
  ctx.lineWidth = 3;
  poly(
    ctx,
    [-64, 4, -60, -6, -14, -12, 14, -12, 60, -6, 64, 4, 60, 12, -60, 12],
  );
  ctx.stroke();
  ctx.fillStyle = vgrad(ctx, -12, 12, ["#9ccb5c", "#5f8d30", "#38591b"]);
  ctx.fill();
  mirror((s) => {
    ctx.fillStyle = "#e0342c";
    ctx.beginPath();
    ctx.arc(s * 46, 2, 6, 0, Math.PI * 2);
    ctx.fill();
    // Engine nacelle
    ctx.beginPath();
    ctx.ellipse(s * 24, -6, 7, 18, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = hgrad(ctx, s * 24 - 7, s * 24 + 7, [
      "#2f4a18",
      "#7aa840",
      "#2f4a18",
    ]);
    ctx.fill();
    ctx.fillStyle = "rgba(230,230,230,0.35)";
    ctx.beginPath();
    ctx.ellipse(s * 24, -25, 13, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  poly(ctx, [-24, 40, -22, 32, 22, 32, 24, 40, 20, 44, -20, 44]);
  ctx.stroke();
  ctx.fillStyle = "#5f8d30";
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 4, 10, 42, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = hgrad(ctx, -10, 10, ["#38591b", "#8cbc4c", "#38591b"]);
  ctx.fill();
  ctx.fillStyle = "#cfeef8";
  ctx.beginPath();
  ctx.ellipse(0, -28, 6, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d83a30";
  ctx.fillRect(-2, -14, 4, 44);
}

/** Helicopter body, nose down. The rotor is drawn per frame. */
function drawHeliBody(ctx: Ctx) {
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#1d2410";
  ctx.lineWidth = 2.5;
  // Tail boom pointing up (it flies nose down toward the player)
  ctx.fillStyle = "#59652c";
  ctx.beginPath();
  ctx.roundRect(-3.5, -40, 7, 34, 3);
  ctx.stroke();
  ctx.fill();
  ctx.fillRect(-12, -40, 24, 5);
  ctx.strokeRect(-12, -40, 24, 5);
  ctx.beginPath();
  ctx.ellipse(0, 6, 15, 22, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = hgrad(ctx, -15, 15, ["#3d4720", "#8a9a4a", "#3d4720"]);
  ctx.fill();
  ctx.fillStyle = vgrad(ctx, 10, 26, ["#7fd0f2", "#2c6e9a"]);
  ctx.beginPath();
  ctx.ellipse(0, 18, 10, 8, 0, 0, Math.PI);
  ctx.fill();
  // Skids
  ctx.strokeStyle = "#2a2f18";
  ctx.lineWidth = 3;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 19, -10);
    ctx.lineTo(s * 19, 24);
    ctx.stroke();
  }
}

/** Grey gunboat, bow down. */
function drawBoat(ctx: Ctx) {
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#0e1420";
  ctx.lineWidth = 2.5;
  poly(ctx, [-16, -40, 16, -40, 18, 10, 0, 42, -18, 10]);
  ctx.stroke();
  ctx.fillStyle = hgrad(ctx, -18, 18, ["#2d3440", "#6a7484", "#2d3440"]);
  ctx.fill();
  ctx.fillStyle = "#7a5634";
  poly(ctx, [-11, -32, 11, -32, 12, 6, 0, 28, -12, 6]);
  ctx.fill();
  ctx.fillStyle = "#4e5868";
  ctx.fillRect(-9, -26, 18, 16);
  ctx.strokeRect(-9, -26, 18, 16);
  ctx.fillStyle = "#3a4250";
  ctx.beginPath();
  ctx.arc(0, 10, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#242a34";
  ctx.fillRect(-2, 10, 4, 16);
}

// ---------------------------------------------------------------- projectiles & pickups

export interface Sprites {
  hero: Sprite;
  wingman: Sprite;
  zero: Sprite;
  bomber: Sprite;
  heli: Sprite;
  boat: Sprite;
  bullet: Sprite;
  wingBullet: Sprite;
  orb: Sprite;
  missile: Sprite;
  coin: Sprite;
  pickups: Record<Exclude<PickupKind, "coin">, Sprite>;
}

function crate(color: string, edge: string, glyph: (ctx: Ctx) => void) {
  return sprite(52, 52, (ctx) => {
    glowDot(ctx, 0, 0, 26, color, 0.5);
    ctx.beginPath();
    ctx.roundRect(-17, -17, 34, 34, 8);
    ctx.fillStyle = vgrad(ctx, -17, 17, ["#ffffff", color, edge]);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    glyph(ctx);
  });
}

export function makeSprites(): Sprites {
  return {
    hero: sprite(120, 90, drawHero),
    wingman: sprite(66, 52, drawWingman),
    zero: sprite(66, 52, drawZero),
    bomber: sprite(136, 100, drawBomber),
    heli: sprite(50, 90, drawHeliBody),
    boat: sprite(44, 90, drawBoat),
    // ad: main guns spit long yellow flames that fade to magenta
    bullet: sprite(14, 40, (ctx) => {
      glowDot(ctx, 0, -8, 10, "rgba(255,200,80,0.9)", 0.6);
      const g = vgrad(ctx, -18, 18, [
        "#fffbe0",
        "#ffd24a",
        "#ff7a2a",
        "rgba(220,60,200,0)",
      ]);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, 4, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }),
    wingBullet: sprite(12, 22, (ctx) => {
      glowDot(ctx, 0, 0, 9, "rgba(90,255,140,0.9)", 0.5);
      ctx.fillStyle = vgrad(ctx, -8, 8, ["#eaffea", "#4ee07a", "#1a9a4a"]);
      ctx.beginPath();
      ctx.roundRect(-3, -8, 6, 16, 3);
      ctx.fill();
    }),
    // ad: enemy fire is glowing red beads with a white core
    orb: sprite(26, 26, (ctx) => {
      glowDot(ctx, 0, 0, 13, "rgba(255,40,40,0.9)", 0.7);
      ctx.fillStyle = "#ff3a3a";
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff4f0";
      ctx.beginPath();
      ctx.arc(0, 0, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }),
    missile: sprite(24, 50, (ctx) => {
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0a1022";
      ctx.lineWidth = 2;
      ctx.fillStyle = "#2e3a6a";
      for (const s of [-1, 1]) {
        poly(ctx, [s * 6, -14, s * 11, -20, s * 11, -12, s * 6, -6]);
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.roundRect(-6, -18, 12, 32, 5);
      ctx.fillStyle = hgrad(ctx, -6, 6, ["#1c2448", "#5a6cb0", "#1c2448"]);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, 14, 6, 9, 0, 0, Math.PI);
      ctx.fillStyle = "#e8302a";
      ctx.fill();
      ctx.stroke();
      glowDot(ctx, 0, 18, 6, "rgba(255,255,255,0.8)", 0.6);
    }),
    coin: sprite(22, 22, (ctx) => {
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 10, 0, 0, Math.PI * 2);
      ctx.fillStyle = vgrad(ctx, -10, 10, ["#fff2a0", "#f6b22a", "#b86a10"]);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#7a4508";
      ctx.stroke();
      ctx.fillStyle = "#ffe27a";
      star(ctx, 0, 0, 5);
      ctx.fill();
    }),
    pickups: {
      power: crate("#ff5a3a", "#a8200e", (ctx) =>
        text(ctx, "P", 0, 1, 24, "#ffffff"),
      ),
      bomb: crate("#4a8cff", "#1a3a9a", (ctx) => {
        ctx.fillStyle = "#1a2040";
        ctx.beginPath();
        ctx.ellipse(0, 2, 6, 11, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-7, -12, 14, 4);
        ctx.fillStyle = "#ff4a3a";
        ctx.beginPath();
        ctx.ellipse(0, 9, 4, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }),
      heal: crate("#3ad86a", "#127a34", (ctx) => {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-4, -11, 8, 22);
        ctx.fillRect(-11, -4, 22, 8);
      }),
    },
  };
}

/** Two-blade rotor spinning over a helicopter. */
export function drawRotor(ctx: Ctx, x: number, y: number, t: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#e8ecd8";
  ctx.beginPath();
  ctx.arc(0, 0, 36, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.9;
  ctx.rotate(t * 30);
  ctx.fillStyle = "#e8e4cc";
  for (const a of [0, Math.PI / 2]) {
    ctx.save();
    ctx.rotate(a);
    ctx.fillRect(-38, -2.5, 76, 5);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** Exhaust flame under a missile or the hero. */
export function drawThrust(
  ctx: Ctx,
  x: number,
  y: number,
  len: number,
  t: number,
  dir = 1,
) {
  const flick = 0.85 + Math.sin(t * 60) * 0.15;
  const l = len * flick;
  const g = ctx.createLinearGradient(0, y, 0, y + dir * l);
  g.addColorStop(0, "rgba(255,255,230,0.95)");
  g.addColorStop(0.3, "rgba(255,190,70,0.85)");
  g.addColorStop(1, "rgba(255,80,20,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - 5, y);
  ctx.quadraticCurveTo(x, y + dir * l * 1.2, x + 5, y);
  ctx.fill();
}

export function hitFlash(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  amount: number,
) {
  if (amount <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  glowDot(ctx, x, y, r * 1.2, "rgba(255,255,255,0.9)", Math.min(1, amount * 8));
  ctx.restore();
}

/** Small red HP bar under damaged enemies, as in the ad. */
export function drawHpBar(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  ratio: number,
) {
  ctx.fillStyle = "rgba(10,14,30,0.75)";
  ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
  ctx.fillStyle = "#e8302a";
  ctx.fillRect(x - w / 2, y, w * Math.max(0, ratio), 4);
}

// ---------------------------------------------------------------- sea & islands

export interface Sea {
  tile: HTMLCanvasElement;
  islands: Sprite[];
}

const TILE = 540;

export function makeSea(): Sea {
  const tile = document.createElement("canvas");
  tile.width = TILE;
  tile.height = TILE;
  const ctx = tile.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#2453b4";
    ctx.fillRect(0, 0, TILE, TILE);
    const rng = mulberry32(42);
    // Soft darker and lighter swells, wrapped so the tile repeats seamlessly
    for (let i = 0; i < 40; i++) {
      const x = rng() * TILE;
      const y = rng() * TILE;
      const r = 40 + rng() * 90;
      const color =
        rng() < 0.5 ? "rgba(20,50,140,0.35)" : "rgba(70,120,220,0.22)";
      for (const ox of [-TILE, 0, TILE])
        for (const oy of [-TILE, 0, TILE]) {
          const g = ctx.createRadialGradient(
            x + ox,
            y + oy,
            0,
            x + ox,
            y + oy,
            r,
          );
          g.addColorStop(0, color);
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = g;
          ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
        }
    }
    // Little wave glints
    ctx.strokeStyle = "rgba(160,200,255,0.18)";
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 90; i++) {
      const x = rng() * TILE;
      const y = rng() * TILE;
      const w = 6 + rng() * 10;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + w / 2, y - 3, x + w, y);
      ctx.stroke();
    }
  }
  return { tile, islands: [0, 1, 2, 3].map((seed) => makeIsland(seed)) };
}

/** Rocky island with a sand rim, surf and palm trees; its left edge is the open-sea side when flipped. */
function makeIsland(seed: number): Sprite {
  const w = 300;
  const h = 360;
  return sprite(w, h, (ctx) => {
    const rng = mulberry32(seed * 977 + 13);
    // Blob outline: a wobbly ellipse
    const pts: [number, number][] = [];
    const n = 28;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 0.78 + rng() * 0.22;
      pts.push([Math.cos(a) * (w * 0.42) * r, Math.sin(a) * (h * 0.44) * r]);
    }
    const blob = (scale: number) => {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const [x0, y0] = pts[i % n];
        const [x1, y1] = pts[(i + 1) % n];
        const mx = ((x0 + x1) / 2) * scale;
        const my = ((y0 + y1) / 2) * scale;
        if (i === 0) ctx.moveTo(mx, my);
        else ctx.quadraticCurveTo(x0 * scale, y0 * scale, mx, my);
      }
      ctx.closePath();
    };
    // Surf, shallow water, sand, rock
    blob(1.12);
    ctx.fillStyle = "rgba(120,190,255,0.35)";
    ctx.fill();
    blob(1.04);
    ctx.fillStyle = "rgba(235,245,255,0.55)";
    ctx.fill();
    blob(1);
    ctx.fillStyle = "#dcc79a";
    ctx.fill();
    blob(0.8);
    ctx.fillStyle = "#7a6248";
    ctx.fill();
    blob(0.74);
    ctx.fillStyle = "#3a3440";
    ctx.fill();
    // Rock texture
    for (let i = 0; i < 26; i++) {
      const a = rng() * Math.PI * 2;
      const r = rng() * 0.6;
      const x = Math.cos(a) * w * 0.4 * r;
      const y = Math.sin(a) * h * 0.42 * r;
      ctx.fillStyle = rng() < 0.5 ? "#4c4552" : "#2a2530";
      ctx.beginPath();
      ctx.ellipse(
        x,
        y,
        8 + rng() * 14,
        6 + rng() * 10,
        rng() * 3,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    // Palms: dark green star fronds with a lighter centre
    for (let i = 0; i < 7; i++) {
      const a = rng() * Math.PI * 2;
      const r = 0.25 + rng() * 0.5;
      const x = Math.cos(a) * w * 0.38 * r;
      const y = Math.sin(a) * h * 0.4 * r;
      const size = 20 + rng() * 14;
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.arc(x + 6, y + 8, size * 0.8, 0, Math.PI * 2);
      ctx.fill();
      for (let k = 0; k < 7; k++) {
        const fa = (k / 7) * Math.PI * 2 + rng();
        ctx.fillStyle = k % 2 ? "#2f6a3a" : "#3f8a48";
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(
          x + Math.cos(fa + 0.4) * size * 0.7,
          y + Math.sin(fa + 0.4) * size * 0.7,
          x + Math.cos(fa) * size,
          y + Math.sin(fa) * size,
        );
        ctx.quadraticCurveTo(
          x + Math.cos(fa - 0.4) * size * 0.5,
          y + Math.sin(fa - 0.4) * size * 0.5,
          x,
          y,
        );
        ctx.fill();
      }
      ctx.fillStyle = "#6a4a2a";
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Scrolling ocean. `scroll` grows over time; islands come from a seeded sequence. */
export function drawSea(
  ctx: Ctx,
  sea: Sea,
  scroll: number,
  left: number,
  right: number,
  top: number,
  bottom: number,
) {
  const off = scroll % TILE;
  const x0 = Math.floor(left / TILE) * TILE;
  for (
    let y = off + Math.floor((top - off) / TILE) * TILE;
    y < bottom;
    y += TILE
  ) {
    // 1px overlap hides the hairline seam that fractional scaling leaves between tiles
    for (let x = x0; x < right; x += TILE)
      ctx.drawImage(sea.tile, x, y, TILE + 1, TILE + 1);
  }
  // Islands hug the left or right edge, like the coast in the ad
  const SPACING = 520;
  const first = Math.floor((scroll - bottom - 400) / SPACING);
  const last = Math.ceil((scroll - top + 400) / SPACING);
  for (let i = first; i <= last; i++) {
    const rng = mulberry32(i * 7919 + 3);
    if (rng() < 0.2) continue;
    const onLeft = rng() < 0.6;
    const island = sea.islands[Math.floor(rng() * sea.islands.length)];
    const y = scroll - i * SPACING - rng() * 160;
    const x = onLeft ? -20 + rng() * 60 : W + 20 - rng() * 60;
    ctx.save();
    ctx.translate(x, y);
    if (!onLeft) ctx.scale(-1, 1);
    ctx.drawImage(
      island.canvas,
      -island.w / 2,
      -island.h / 2,
      island.w,
      island.h,
    );
    ctx.restore();
  }
}

// ---------------------------------------------------------------- boss

/** Battleship seen from above, bow pointing down at the player. */
export function drawBattleship(
  ctx: Ctx,
  x: number,
  y: number,
  t: number,
  flash: number,
  dying: number,
) {
  const hw = BOSS_HALF_W;
  const hh = BOSS_HALF_H;
  ctx.save();
  ctx.translate(x, y);
  if (dying > 0) ctx.rotate((2 - dying) * 0.04);

  // Wake
  ctx.fillStyle = "rgba(230,240,255,0.35)";
  poly(ctx, [
    -hw - 6,
    -hh,
    hw + 6,
    -hh,
    hw + 26,
    -hh - 120,
    -hw - 26,
    -hh - 120,
  ]);
  ctx.fill();
  ctx.fillStyle = "rgba(0,10,40,0.35)";
  poly(ctx, [
    -hw + 10,
    -hh + 16,
    hw + 10,
    -hh + 16,
    hw + 10,
    hh - 70,
    10,
    hh + 22,
    -hw + 10,
    hh - 70,
  ]);
  ctx.fill();

  // Hull
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#141824";
  poly(ctx, [-hw, -hh, hw, -hh, hw, hh - 90, 0, hh + 6, -hw, hh - 90]);
  ctx.fillStyle = hgrad(ctx, -hw, hw, [
    "#3a4150",
    "#8a94a6",
    "#a8b2c2",
    "#8a94a6",
    "#3a4150",
  ]);
  ctx.fill();
  ctx.stroke();
  // Red bow trim
  ctx.strokeStyle = "#b8282a";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-hw + 4, hh - 92);
  ctx.lineTo(0, hh);
  ctx.lineTo(hw - 4, hh - 92);
  ctx.stroke();

  // Orange wooden deck mid-ship
  ctx.fillStyle = vgrad(ctx, -40, hh - 60, ["#b8642a", "#d88a3a", "#a0521e"]);
  poly(ctx, [
    -hw + 12,
    -40,
    hw - 12,
    -40,
    hw - 12,
    hh - 96,
    0,
    hh - 30,
    -hw + 12,
    hh - 96,
  ]);
  ctx.fill();
  ctx.strokeStyle = "rgba(90,40,10,0.5)";
  ctx.lineWidth = 1;
  for (let px = -hw + 20; px < hw - 12; px += 9) {
    ctx.beginPath();
    ctx.moveTo(px, -40);
    ctx.lineTo(px, hh - 80 - Math.abs(px) * 0.8);
    ctx.stroke();
  }

  // Hex turret plates (ad: big hexagon armour on the stern half)
  const hex = (cx: number, cy: number, r: number, fill: string) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#1a1e2a";
    ctx.stroke();
  };
  hex(0, -hh + 58, 44, "#5a6274");
  hex(0, -hh + 58, 30, "#c8d0dc");
  hex(0, -hh + 58, 18, "#4a5262");
  for (const s of [-1, 1]) hex(s * 30, 8, 20, "#3a4150");

  // Gun turrets that track nothing in particular: a slow sweep reads as alive
  const turret = (cx: number, cy: number, r: number, aim: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(aim);
    ctx.fillStyle = "#20242e";
    ctx.fillRect(-4, 0, 3, r + 14);
    ctx.fillRect(1, 0, 3, r + 14);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = "#6a7282";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#141824";
    ctx.stroke();
    ctx.restore();
  };
  turret(0, 30, 14, Math.sin(t * 0.8) * 0.5);
  for (const s of [-1, 1]) turret(s * 24, 100, 10, Math.sin(t * 1.1 + s) * 0.4);
  for (let i = 0; i < 4; i++) {
    const gx = (i - 1.5) * 14;
    ctx.fillStyle = "#2a2e38";
    ctx.beginPath();
    ctx.arc(gx, 145, 5, 0, Math.PI * 2);
    ctx.fill();
    glowDot(
      ctx,
      gx,
      147,
      7,
      "rgba(255,80,40,0.9)",
      0.5 + Math.sin(t * 8 + i) * 0.3,
    );
  }

  // Damage fires as HP drops or while sinking
  if (dying > 0) {
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 6; i++)
      glowDot(
        ctx,
        Math.sin(i * 3.1 + t * 4) * 40,
        -hh + 40 + i * 60,
        30,
        "rgba(255,140,40,0.8)",
        0.7,
      );
  }
  ctx.restore();

  if (flash > 0) {
    ctx.save();
    // Kept faint: under constant fire the flash never fully decays
    ctx.globalAlpha = Math.min(0.16, flash * 3);
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "#ffffff";
    poly(ctx, [
      x - hw,
      y - hh,
      x + hw,
      y - hh,
      x + hw,
      y + hh - 90,
      x,
      y + hh + 6,
      x - hw,
      y + hh - 90,
    ]);
    ctx.fill();
    ctx.restore();
  }
}
