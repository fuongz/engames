import {
  CX,
  CY,
  H,
  KNIFE_EFFECTS,
  type KnifeSkin,
  PALETTE as P,
  RADIUS,
  W,
} from "./config";
import { dragonBlade, dragonCharge } from "./storm";
import type { Knife, Run } from "./logic";
export const FONT = '"Baloo 2", sans-serif';
export function text(
  c: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size = 22,
  color: string = P.cream,
) {
  c.font = `800 ${size}px ${FONT}`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = color;
  c.fillText(value, x, y);
}
export function pill(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string = P.panel,
) {
  c.fillStyle = color;
  c.beginPath();
  c.roundRect(x, y, w, h, 18);
  c.fill();
}
export type KnifeSprites = Partial<Record<KnifeSkin, HTMLImageElement>>;
export interface KnifeLook {
  skin?: KnifeSkin;
  sprites?: KnifeSprites;
  time?: number;
  reduced?: boolean;
  /** Each settled knife has its own short impact motion. */
  impactAge?: (knife: Knife) => number;
  wobble?: number;
  /** Settled blades use restrained energy; the ready knife gets the full charge. */
  energy?: number;
}

export function knife(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  seat: number,
  scale = 1,
  look: KnifeLook = {},
) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.scale(scale, scale);
  if (look.wobble) {
    // Pivot at the embedded tip so the blade does not slide across the hitbox.
    c.translate(0, -39);
    c.rotate(look.wobble);
    c.translate(0, 39);
  }
  const skin = look.skin ?? "classic";
  const sprite = look.sprites?.[skin];
  if (skin === "dragon" && !look.reduced)
    dragonCharge(c, look.time ?? 0, look.energy ?? 1);
  if (sprite?.complete && sprite.naturalWidth) {
    const height = 71;
    const width = (height * sprite.naturalWidth) / sprite.naturalHeight;
    c.drawImage(sprite, -width / 2, -39, width, height);
  } else {
    // Same silhouette while the generated art loads, including in cover rendering.
    c.fillStyle = P.steel;
    c.beginPath();
    c.moveTo(0, -39);
    c.lineTo(7, -5);
    c.lineTo(5, 0);
    c.lineTo(-5, 0);
    c.lineTo(-7, -5);
    c.closePath();
    c.fill();
    c.fillStyle = KNIFE_EFFECTS[skin].accent;
    c.fillRect(-12, 0, 24, 5);
    c.fillStyle = P.ink;
    c.fillRect(-5, 5, 10, 24);
    c.fillStyle = KNIFE_EFFECTS[skin].accent;
    c.fillRect(-6, 29, 12, 4);
  }
  if (seat >= 0) {
    // A quiet owner marker keeps partners distinguishable even with the same skin.
    c.fillStyle = seat === 1 ? P.coral : P.cyan;
    c.beginPath();
    c.arc(0, 25, 2, 0, Math.PI * 2);
    c.fill();
  }
  if (skin === "dragon" && !look.reduced)
    dragonBlade(c, look.time ?? 0, look.energy ?? 1);
  c.restore();
}
/** 200 ms damped feedback, independent for every blade; no delay to the next throw. */
export function impactWobble(age: number) {
  if (age < 0 || age >= 0.2) return 0;
  return Math.sin(age * Math.PI * 30) * 0.12 * (1 - age / 0.2) ** 2;
}
export function target(
  c: CanvasRenderingContext2D,
  s: Run,
  sprite?: HTMLImageElement,
  look: KnifeLook = {},
) {
  c.save();
  c.translate(CX, CY);
  c.rotate(s.angle);
  const orange = s.stage % 5 === 0;
  if (!orange && sprite?.complete && sprite.naturalWidth) {
    c.drawImage(
      sprite,
      -RADIUS - 7,
      -RADIUS - 7,
      (RADIUS + 7) * 2,
      (RADIUS + 7) * 2,
    );
  } else {
    c.fillStyle = orange ? P.rind : P.ring;
    c.beginPath();
    c.arc(0, 0, RADIUS + 6, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = orange ? P.orange : P.wood;
    c.beginPath();
    c.arc(0, 0, RADIUS, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = orange ? P.cream : P.ring;
    c.lineWidth = orange ? 3 : 2;
    for (let i = 1; i <= 5; i++) {
      c.beginPath();
      c.ellipse(0, 0, i * 17, i * 17 - 2, 0.2, 0, Math.PI * 2);
      c.stroke();
    }
    if (orange)
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(Math.cos(a) * 94, Math.sin(a) * 94);
        c.stroke();
      }
  }
  for (const k of s.knives) {
    const a = k.angle;
    knife(
      c,
      Math.cos(a) * (RADIUS + 36),
      Math.sin(a) * (RADIUS + 36),
      a - Math.PI / 2,
      k.seat,
      1,
      {
        ...look,
        skin: k.skin ?? "classic",
        energy: 0.22,
        wobble: look.reduced ? 0 : impactWobble(look.impactAge?.(k) ?? 1),
      },
    );
  }
  c.restore();
}
export function backdrop(
  c: CanvasRenderingContext2D,
  image?: HTMLImageElement,
) {
  c.fillStyle = P.sky;
  c.fillRect(0, 0, W, H);
  if (image?.complete && image.naturalWidth) {
    const scale = Math.max(W / image.naturalWidth, H / image.naturalHeight);
    c.drawImage(
      image,
      (W - image.naturalWidth * scale) / 2,
      (H - image.naturalHeight * scale) / 2,
      image.naturalWidth * scale,
      image.naturalHeight * scale,
    );
  }
  const shade = c.createLinearGradient(0, 0, 0, H);
  shade.addColorStop(0, "rgba(9,30,39,0.55)");
  shade.addColorStop(0.45, "rgba(9,30,39,0.06)");
  shade.addColorStop(1, "rgba(9,30,39,0.6)");
  c.fillStyle = shade;
  c.fillRect(0, 0, W, H);
}
