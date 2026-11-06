export const W = 540;
export const H = 960;
export const WORLD_W = 1080;
export const WORLD_H = 1440;
export const CELL = 60;
export const PLAYER_SPEED = 220;
export const MAX_HP = 100;
export const WALLS = [
  { x: 180, y: 180, w: 240, h: 120 },
  { x: 660, y: 180, w: 240, h: 120 },
  { x: 180, y: 480, w: 120, h: 360 },
  { x: 780, y: 480, w: 120, h: 360 },
  { x: 420, y: 600, w: 240, h: 120 },
  { x: 180, y: 1080, w: 240, h: 120 },
  { x: 660, y: 1080, w: 240, h: 120 },
];
export const WEAPONS = [
  {
    interval: 0.12,
    damage: 16,
    pellets: 1,
    spread: 0.035,
    speed: 1000,
    unlock: 0,
  },
  {
    interval: 0.52,
    damage: 19,
    pellets: 7,
    spread: 0.12,
    speed: 800,
    unlock: 25,
  },
  { interval: 0.19, damage: 42, pellets: 1, spread: 0, speed: 740, unlock: 70 },
];
// All canvas paint tokens live here, shared by gameplay and catalogue art.
export const C = {
  void: "#090f14",
  floor: "#202d35",
  tile: "#293943",
  seam: "#15232c",
  wall: "#364b59",
  wallTop: "#587180",
  edge: "#8da2a9",
  ink: "#0c151d",
  white: "#e8f3eb",
  muted: "#8da5ae",
  lime: "#b8f36a",
  cyan: "#66e0ef",
  gold: "#ffce73",
  red: "#fa6b65",
  alien: "#9fbd74",
  runner: "#c88682",
  brute: "#9776aa",
  blood: "#53773c",
  panel: "rgba(9,18,25,0.94)",
  shadow: "rgba(0,0,0,0.35)",
  veil: "rgba(5,12,18,0.86)",
};
