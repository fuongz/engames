import {
  type BuildKind,
  COLS,
  CORRIDOR_W,
  CORRIDOR_X,
  HALL,
  HALL_X,
  HALL_Y,
  ROOM_COUNT,
  ROOM_H,
  ROW_Y,
  ROWS,
  TILE,
  WORLD_W,
  WORLD_H,
} from "./config";
import {
  bedTile,
  doorPos,
  gridOrigin,
  isLeft,
  mulberry32,
  roomRect,
  tileCenter,
} from "./logic";

// Procedural art in the ad's palette: near-black brick, slate-blue room floors
// with "+" build marks, navy walls, a blue bed, chibi sleepers, and a pale
// gowned ghost with red eyes. The static map is rendered once to an offscreen
// canvas; everything that moves draws per frame.

type Ctx = CanvasRenderingContext2D;
export const FONT = '"Baloo 2", "Trebuchet MS", system-ui, sans-serif';

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
  ctx.strokeStyle = "rgba(6,8,14,0.9)";
  ctx.strokeText(str, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(str, x, y);
}

/** Word-wrapped plain text; returns the y after the last line. */
export function paragraph(
  ctx: Ctx,
  str: string,
  x: number,
  y: number,
  width: number,
  size: number,
  color: string,
  lineHeight = 1.35,
) {
  ctx.font = `600 ${size}px ${FONT}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = color;
  let line = "";
  for (const word of str.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      ctx.fillText(line, x, y);
      y += size * lineHeight;
      line = word;
    } else line = next;
  }
  if (line) {
    ctx.fillText(line, x, y);
    y += size * lineHeight;
  }
  return y;
}

export function glow(
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

// ---------------------------------------------------------------- static map

/** The whole dorm floor plan at 2x: brick, corridors, hall, room floors and walls. Doors and beds draw on top per frame. */
export function makeMap(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = WORLD_W * 2;
  canvas.height = WORLD_H * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.scale(2, 2);
  drawMapInto(ctx);
  return canvas;
}

export function drawMapInto(ctx: Ctx) {
  const rng = mulberry32(7);
  // Brick everywhere
  ctx.fillStyle = "#1d1a1c";
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.strokeStyle = "rgba(255,255,255,0.035)";
  ctx.lineWidth = 1;
  for (let y = 0; y < WORLD_H; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD_W, y);
    ctx.stroke();
    for (let x = (y / 16) % 2 ? 0 : 16; x < WORLD_W; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 16);
      ctx.stroke();
    }
  }
  for (let i = 0; i < 600; i++) {
    ctx.fillStyle =
      rng() < 0.5 ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.18)";
    ctx.fillRect(
      Math.floor(rng() * (WORLD_W / 16)) * 16,
      Math.floor(rng() * (WORLD_H / 16)) * 16,
      16,
      16,
    );
  }

  // Corridors and hall: worn stone slabs
  const slab = (x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = "#33363d";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    for (let yy = y; yy < y + h; yy += 40) {
      for (let xx = x; xx < x + w; xx += 40)
        ctx.strokeRect(
          xx + 0.5,
          yy + 0.5,
          Math.min(40, x + w - xx),
          Math.min(40, y + h - yy),
        );
    }
  };
  const top = ROW_Y[0];
  const bottom = ROW_Y[ROW_Y.length - 1] + ROOM_H;
  for (const cx of CORRIDOR_X)
    slab(cx - CORRIDOR_W / 2, top, CORRIDOR_W, bottom - top);
  slab(HALL.x, HALL.y, HALL.w, HALL.h);
  // The hall's glowing seal, where everyone starts and the hunter heals (ad: the round logo)
  ctx.strokeStyle = "rgba(90,210,220,0.35)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(HALL_X, HALL_Y, 58, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(HALL_X, HALL_Y, 44, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(90,210,220,0.08)";
  ctx.beginPath();
  ctx.arc(HALL_X, HALL_Y, 58, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < ROOM_COUNT; i++) drawRoomShell(ctx, i);
}

function drawRoomShell(ctx: Ctx, room: number) {
  const r = roomRect(room);
  const o = gridOrigin(room);
  // Wall block
  ctx.fillStyle = "#11131a";
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = "#1b1f2b";
  ctx.fillRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8);
  // Floor
  ctx.fillStyle = "#4b5768";
  ctx.fillRect(o.x - 2, o.y - 2, COLS * TILE + 4, ROWS * TILE + 4);
  for (let t = 0; t < COLS * ROWS; t++) {
    const c = tileCenter(room, t);
    const x = c.x - TILE / 2;
    const y = c.y - TILE / 2;
    const g = ctx.createLinearGradient(x, y, x, y + TILE);
    g.addColorStop(0, "#6c7a8d");
    g.addColorStop(1, "#5a6779");
    ctx.fillStyle = g;
    ctx.fillRect(x + 1.5, y + 1.5, TILE - 3, TILE - 3);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
    if (t === bedTile(room)) continue;
    // "+" build mark (ad)
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(c.x - 5, c.y);
    ctx.lineTo(c.x + 5, c.y);
    ctx.moveTo(c.x, c.y - 5);
    ctx.lineTo(c.x, c.y + 5);
    ctx.stroke();
    ctx.lineWidth = 1;
  }
  // Door gap in the corridor wall
  const d = doorPos(room);
  ctx.fillStyle = "#4b5768";
  ctx.fillRect(isLeft(room) ? d.x - 14 : d.x, d.y - 20, 14, 40);
  // Room number plate on the top wall
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.font = `700 11px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    `${(Math.floor(room / 4) + 1) * 100 + (room % 4) + 1}`,
    r.x + r.w / 2,
    r.y + 12,
  );
}

// ---------------------------------------------------------------- props

const BED_COLORS = [
  "#3b6fd8",
  "#2f9fb8",
  "#7a5ad8",
  "#d8833b",
  "#d83b6f",
  "#e8c23b",
];

export function drawBed(ctx: Ctx, x: number, y: number, level: number) {
  ctx.fillStyle = "#5a3a22";
  ctx.beginPath();
  ctx.roundRect(x - 18, y - 21, 36, 42, 5);
  ctx.fill();
  ctx.fillStyle = "#f2efe6";
  ctx.beginPath();
  ctx.roundRect(x - 14, y - 18, 28, 10, 4);
  ctx.fill();
  const blanket = BED_COLORS[Math.min(BED_COLORS.length - 1, level - 1)];
  const g = ctx.createLinearGradient(x, y - 8, x, y + 19);
  g.addColorStop(0, blanket);
  g.addColorStop(1, "#1a2440");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x - 15, y - 7, 30, 26, 4);
  ctx.fill();
  if (level > 1) {
    for (let i = 0; i < Math.min(5, level - 1); i++) {
      ctx.fillStyle = "#ffe27a";
      ctx.beginPath();
      ctx.arc(x - 10 + i * 5, y + 15, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Door slab across the gap; tinted by level, cracked as it loses HP. */
export function drawDoor(
  ctx: Ctx,
  room: number,
  ratio: number,
  level: number,
  broken: boolean,
  shake: number,
) {
  const d = doorPos(room);
  const x =
    (isLeft(room) ? d.x - 12 : d.x + 2) +
    (shake > 0 ? (Math.random() - 0.5) * 4 : 0);
  if (broken) {
    ctx.fillStyle = "#3a2a2a";
    ctx.fillRect(x, d.y + 8, 10, 12);
    ctx.fillRect(x + 2, d.y - 20, 8, 8);
    return;
  }
  const tones = [
    "#9aa3b0",
    "#a8b8c8",
    "#c8a86a",
    "#8fd0d8",
    "#d890c8",
    "#f0d060",
  ];
  ctx.fillStyle = tones[Math.min(tones.length - 1, level - 1)];
  ctx.fillRect(x, d.y - 19, 10, 38);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(x + 2, d.y - 15, 6, 4);
  ctx.fillStyle = "#3a3f48";
  ctx.beginPath();
  ctx.arc(x + 5, d.y + 6, 2, 0, Math.PI * 2);
  ctx.fill();
  if (ratio < 0.66) {
    ctx.strokeStyle = "rgba(20,10,10,0.8)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x + 1, d.y - 8);
    ctx.lineTo(x + 6, d.y - 2);
    ctx.lineTo(x + 3, d.y + 4);
    if (ratio < 0.33) {
      ctx.moveTo(x + 9, d.y + 14);
      ctx.lineTo(x + 4, d.y + 10);
    }
    ctx.stroke();
  }
}

export function drawBar(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  ratio: number,
  color: string,
) {
  ctx.fillStyle = "rgba(6,8,14,0.8)";
  ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, ratio)), 4);
}

// ---------------------------------------------------------------- buildings

export function drawBuilding(
  ctx: Ctx,
  kind: BuildKind,
  x: number,
  y: number,
  size: number,
  level: number,
  t: number,
) {
  const s = size / 40;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#0d0f14";
  ctx.lineWidth = 2;
  if (kind === "turret") {
    // ad: Tháp Chói, a lamp-headed tower
    ctx.fillStyle = "#2b2f3a";
    ctx.beginPath();
    ctx.roundRect(-13, 8, 26, 10, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#6b4a3a";
    ctx.fillRect(-4, -4, 8, 13);
    ctx.strokeRect(-4, -4, 8, 13);
    ctx.fillStyle = "#3a2f2a";
    ctx.beginPath();
    ctx.arc(0, -9, 10, Math.PI, 0);
    ctx.lineTo(10, -2);
    ctx.lineTo(-10, -2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    glow(ctx, 0, -6, 11 + Math.sin(t * 5) * 1.5, "rgba(255,230,140,0.95)", 0.7);
    ctx.fillStyle = "#fff4c0";
    ctx.beginPath();
    ctx.arc(0, -6, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "arcade") {
    ctx.fillStyle = "#6a3aa8";
    ctx.beginPath();
    ctx.roundRect(-12, -16, 24, 34, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = Math.floor(t * 4) % 2 ? "#7af0ff" : "#4ad0f0";
    ctx.fillRect(-8, -12, 16, 11);
    ctx.fillStyle = "#ff5a7a";
    ctx.beginPath();
    ctx.arc(-4, 6, 2.5, 0, Math.PI * 2);
    ctx.arc(4, 6, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "station") {
    // ad: crossed wrench and screwdriver
    ctx.fillStyle = "#33463a";
    ctx.beginPath();
    ctx.roundRect(-16, -16, 32, 32, 5);
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#c8d0d8";
    ctx.beginPath();
    ctx.moveTo(-9, 9);
    ctx.lineTo(9, -9);
    ctx.moveTo(-9, -9);
    ctx.lineTo(9, 9);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#0d0f14";
  } else if (kind === "watchtower") {
    ctx.strokeStyle = "#7aa0d8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-12, 16);
    ctx.lineTo(0, -14);
    ctx.lineTo(12, 16);
    ctx.moveTo(-7, 4);
    ctx.lineTo(7, 4);
    ctx.stroke();
    ctx.fillStyle = "#c8d8f0";
    ctx.beginPath();
    ctx.arc(0, -14, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "accelerator") {
    ctx.fillStyle = "#1a2a48";
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#7ad0ff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 10, t * 4, t * 4 + Math.PI * 1.4);
    ctx.stroke();
    glow(ctx, 0, 0, 8, "rgba(140,220,255,0.9)", 0.8);
  }
  ctx.restore();
  if (kind === "turret" && level > 1) {
    ctx.fillStyle = "#e8302a";
    ctx.beginPath();
    ctx.arc(x + size * 0.4, y - size * 0.4, 7, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, String(level), x + size * 0.4, y - size * 0.4 + 0.5, 10, "#fff");
  }
}

// ---------------------------------------------------------------- people

export interface Palette {
  hair: string;
  dress: string;
  skin: string;
}

export const PALETTES: Palette[] = [
  { hair: "#15141a", dress: "#f2f2f2", skin: "#f5e6dc" }, // player: black hair, white shirt
  { hair: "#2a2020", dress: "#c8302a", skin: "#f0dccc" },
  { hair: "#e8e8e8", dress: "#b07a5a", skin: "#f5e6dc" },
  { hair: "#1a1a1a", dress: "#3a4a3a", skin: "#ead6c4" },
  { hair: "#5a3a2a", dress: "#d8c8a8", skin: "#f5e6dc" },
  { hair: "#101014", dress: "#4a3a6a", skin: "#f0e0d4" },
];

/** Chibi sleeper, about 30px tall, walking (bobbing) or standing. */
export function drawPerson(
  ctx: Ctx,
  x: number,
  y: number,
  p: Palette,
  t: number,
  walking: boolean,
) {
  const bob = walking ? Math.abs(Math.sin(t * 12)) * 2 : 0;
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(x, y + 12, 9, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#0d0f14";
  ctx.fillStyle = p.dress;
  ctx.beginPath();
  ctx.moveTo(x - 7, y + 10 - bob);
  ctx.lineTo(x - 5, y - 2 - bob);
  ctx.lineTo(x + 5, y - 2 - bob);
  ctx.lineTo(x + 7, y + 10 - bob);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Hair behind
  ctx.fillStyle = p.hair;
  ctx.beginPath();
  ctx.ellipse(x, y - 9 - bob, 9, 9.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.skin;
  ctx.beginPath();
  ctx.ellipse(x, y - 7 - bob, 7, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = p.hair;
  ctx.beginPath();
  ctx.ellipse(x, y - 12 - bob, 7.5, 4, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#15141a";
  ctx.fillRect(x - 3.5, y - 7 - bob, 1.8, 2.2);
  ctx.fillRect(x + 1.7, y - 7 - bob, 1.8, 2.2);
}

/** Head on the pillow, blanket pulled up. */
export function drawSleeper(
  ctx: Ctx,
  x: number,
  y: number,
  p: Palette,
  level: number,
) {
  drawBed(ctx, x, y, level);
  ctx.fillStyle = p.hair;
  ctx.beginPath();
  ctx.ellipse(x, y - 13, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.skin;
  ctx.beginPath();
  ctx.ellipse(x, y - 11, 6, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#15141a";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x - 4, y - 11);
  ctx.lineTo(x - 1.5, y - 11);
  ctx.moveTo(x + 1.5, y - 11);
  ctx.lineTo(x + 4, y - 11);
  ctx.stroke();
}

// ---------------------------------------------------------------- hunter

/** The Dream Hunter: a floating white-gowned ghost with long black hair and red eyes. */
export function drawHunter(
  ctx: Ctx,
  x: number,
  y: number,
  t: number,
  flash: number,
  enraged: boolean,
  scale = 1,
) {
  const bob = Math.sin(t * 3) * 3;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 26 - bob, 16, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (enraged)
    glow(ctx, 0, 0, 46, "rgba(255,30,40,0.55)", 0.6 + Math.sin(t * 10) * 0.2);
  // Gown with a ragged hem
  ctx.fillStyle = flash > 0 ? "#ffffff" : "#e8e6ee";
  ctx.strokeStyle = "#1a1520";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-9, -8);
  ctx.quadraticCurveTo(-18, 8, -16, 22);
  for (let i = 0; i <= 6; i++) {
    const hx = -16 + (i * 32) / 6;
    ctx.lineTo(hx, 22 + (i % 2 ? 5 : 0) + Math.sin(t * 6 + i) * 1.5);
  }
  ctx.quadraticCurveTo(18, 8, 9, -8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Arms reaching forward
  ctx.strokeStyle = "#d8d4e0";
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-8, -2);
  ctx.lineTo(-13, 10);
  ctx.moveTo(8, -2);
  ctx.lineTo(13, 10);
  ctx.stroke();
  // Hair, face, hair over face
  ctx.fillStyle = "#0e0c12";
  ctx.beginPath();
  ctx.ellipse(0, -16, 13, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-12, -16, 24, 22);
  ctx.fillStyle = "#e4e0ea";
  ctx.beginPath();
  ctx.ellipse(0, -14, 8, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0e0c12";
  ctx.beginPath();
  ctx.moveTo(-9, -24);
  ctx.quadraticCurveTo(-2, -12, -6, -2);
  ctx.lineTo(-10, -4);
  ctx.closePath();
  ctx.fill();
  glow(ctx, -3, -14, 6, "rgba(255,40,40,0.9)", 0.9);
  glow(ctx, 4, -14, 6, "rgba(255,40,40,0.9)", 0.9);
  ctx.fillStyle = "#ff3030";
  ctx.beginPath();
  ctx.arc(-3, -14, 1.8, 0, Math.PI * 2);
  ctx.arc(4, -14, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- icons

export function coin(ctx: Ctx, x: number, y: number, r = 9) {
  const g = ctx.createLinearGradient(x, y - r, x, y + r);
  g.addColorStop(0, "#ffe680");
  g.addColorStop(1, "#d88a10");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#7a4508";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  text(ctx, "G", x, y + 0.5, r * 1.15, "#fff3c0");
}

export function bolt(ctx: Ctx, x: number, y: number, r = 9) {
  ctx.fillStyle = "#5ad0ff";
  ctx.strokeStyle = "#0d2a48";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + r * 0.3, y - r);
  ctx.lineTo(x - r * 0.55, y + r * 0.15);
  ctx.lineTo(x - r * 0.02, y + r * 0.15);
  ctx.lineTo(x - r * 0.3, y + r);
  ctx.lineTo(x + r * 0.55, y - r * 0.15);
  ctx.lineTo(x + r * 0.02, y - r * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}
