export const W = 480;
export const H = 840;
export const CX = W / 2;
export const CY = 310;
export const RADIUS = 100;
export const FLIGHT_TIME = 0.06;
export const COOLDOWN = 0.07;
export const COLLISION_ANGLE = 0.19;
export const MAX_STAGE = 15;
export const RUN_SECONDS = 180;
export const PALETTE = {
  sky: "#102f39",
  panel: "#123e46",
  cream: "#fff4d6",
  muted: "#b0d3c9",
  orange: "#ffb94b",
  rind: "#ef8c27",
  wood: "#ce9c62",
  ring: "#956138",
  cyan: "#79e2e4",
  coral: "#ff8b76",
  steel: "#d9f3f0",
  ink: "#17323a",
};

/** Cosmetic tiers share exactly the same timing and hitbox. Ownership and prices come from the account shop. */
export const KNIFE_SKINS = ["classic", "dragon"] as const;
export type KnifeSkin = (typeof KNIFE_SKINS)[number];
export const isKnifeSkin = (value: unknown): value is KnifeSkin =>
  value === "classic" || value === "dragon";
export const KNIFE_EFFECTS = {
  classic: {
    color: "#e8e5d7",
    accent: "#d7ae53",
    particles: 4,
    rings: 0,
    trail: 36,
  },
  dragon: {
    color: "#c095ff",
    accent: "#f2dfff",
    particles: 20,
    rings: 2,
    trail: 140,
  },
} as const;
export const MAX_PARTICLES = 160;

export const COSMETICS = [
  { id: "classic", name: { vi: "Cổ điển", en: "Classic" }, price: 0 },
  { id: "dragon", name: { vi: "Rồng sét", en: "Storm Dragon" }, price: 2000 },
];

/** Decorative effects outlive the fast physical shot, with strict overlap limits. */
export const DRAGON_STORM = {
  wakeLife: 0.24,
  impactLife: 0.4,
  maxWakes: 6,
  maxImpacts: 4,
} as const;

/** A 4×4 generated VFX atlas: fixed-size cells retain transparent gutters and a stable pivot. */
export const STORM_SHEET = {
  columns: 4,
  rows: 4,
  frames: 16,
  duration: 0.4,
  size: 224,
} as const;
