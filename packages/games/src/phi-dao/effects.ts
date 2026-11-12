import { knife, type KnifeSprites } from "./art";
import {
  CX,
  CY,
  DRAGON_STORM,
  FLIGHT_TIME,
  H,
  KNIFE_EFFECTS,
  type KnifeSkin,
  MAX_PARTICLES,
  RADIUS,
} from "./config";
import { stormImpact, stormWake } from "./storm";
import type { Event, Knife, Run } from "./logic";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  color: string;
  kind: "spark" | "electric";
  size: number;
}
interface Flying {
  seat: number;
  skin: KnifeSkin;
  age: number;
}
interface Fallen extends Flying {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
}
interface Ring {
  x: number;
  y: number;
  age: number;
  skin: KnifeSkin;
}
const key = (stage: number, seat: number, angle: number) =>
  `${stage}:${seat}:${angle}`;
const launchY = 596;
const impactY = CY + RADIUS + 39;

/** Cosmetic state only. Server events confirm shots, hits and misses; none of this changes rules. */
export function createKnifeEffects() {
  const particles: Particle[] = [];
  const flying: Flying[] = [];
  const fallen: Fallen[] = [];
  const rings: Ring[] = [];
  const wakes: { age: number; seed: number }[] = [];
  const impacts = new Map<string, number>();
  let time = 0;
  function burst(x: number, y: number, skin: KnifeSkin, reduced: boolean) {
    const effect = KNIFE_EFFECTS[skin];
    const count = reduced ? 2 : effect.particles;
    for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = reduced
        ? 0
        : 30 + Math.random() * (skin === "dragon" ? 150 : 65);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        age: 0,
        life: 0.2 + Math.random() * 0.16,
        color: i % 3 ? effect.color : effect.accent,
        kind: skin === "dragon" && !reduced ? "electric" : "spark",
        size: skin === "dragon" ? 4 : 2,
      });
    }
    if (!reduced && effect.rings) {
      if (rings.length >= DRAGON_STORM.maxImpacts) rings.shift();
      rings.push({ x, y, age: 0, skin });
    }
  }
  return {
    get time() {
      return time;
    },
    impactAge(k: Knife, stage: number) {
      return impacts.get(key(stage, k.seat, k.angle)) ?? 1;
    },
    reset() {
      particles.length = 0;
      flying.length = 0;
      fallen.length = 0;
      rings.length = 0;
      wakes.length = 0;
      impacts.clear();
    },
    event(e: Event, s: Run, reduced: boolean) {
      const skin = e.skin ?? "classic";
      if (e.type === "throw") {
        // One accepted shot per seat is in flight at a time (cooldown > flight duration).
        const prev = flying.findIndex((f) => f.seat === e.seat);
        if (prev >= 0) flying.splice(prev, 1);
        flying.push({ seat: e.seat, skin, age: 0 });
        if (skin === "dragon" && !reduced) {
          if (wakes.length >= DRAGON_STORM.maxWakes) wakes.shift();
          wakes.push({ age: 0, seed: e.seat * 7 + time * 11 });
        }
      }
      if (e.type === "hit" || e.type === "miss") {
        const at = flying.findIndex((f) => f.seat === e.seat);
        if (at >= 0) flying.splice(at, 1);
        // Impact point follows the exact event angle; snapshots may already have rotated on.
        const angle = (e.angle ?? Math.PI / 2 - s.angle) + s.angle;
        const x = CX + Math.cos(angle) * RADIUS;
        const y = CY + Math.sin(angle) * RADIUS;
        burst(x, y, skin, reduced);
        if (e.type === "hit" && e.angle !== undefined)
          impacts.set(key(e.stage ?? s.stage, e.seat, e.angle), 0);
        if (e.type === "miss" && !reduced && fallen.length < 8)
          fallen.push({
            seat: e.seat,
            skin,
            age: 0,
            x: CX,
            y: impactY,
            vx: e.seat === 1 ? 100 : -100,
            vy: -130,
            angle: 0,
          });
      }
    },
    update(dt: number) {
      time += dt;
      for (const [id, age] of impacts) {
        if (age + dt > 0.25) impacts.delete(id);
        else impacts.set(id, age + dt);
      }
      for (let i = flying.length - 1; i >= 0; i--) {
        flying[i].age += dt;
        if (flying[i].age > 0.3) flying.splice(i, 1);
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.age += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 100 * dt;
        if (p.age >= p.life) particles.splice(i, 1);
      }
      for (let i = fallen.length - 1; i >= 0; i--) {
        const f = fallen[i];
        f.age += dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.vy += 900 * dt;
        f.angle += dt * (f.seat === 1 ? 9 : -9);
        if (f.age > 0.7 || f.y > H + 80) fallen.splice(i, 1);
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        rings[i].age += dt;
        if (rings[i].age >= DRAGON_STORM.impactLife) rings.splice(i, 1);
      }
      for (let i = wakes.length - 1; i >= 0; i--) {
        wakes[i].age += dt;
        if (wakes[i].age >= DRAGON_STORM.wakeLife) wakes.splice(i, 1);
      }
    },
    hasFlight() {
      return flying.length > 0;
    },
    draw(
      c: CanvasRenderingContext2D,
      sprites: KnifeSprites,
      reduced: boolean,
      impactSheet?: HTMLImageElement,
    ) {
      c.save();
      if (!reduced)
        for (const wake of wakes) {
          const progress = Math.min(1, wake.age / FLIGHT_TIME);
          const y = launchY + (impactY - launchY) * progress;
          stormWake(c, CX, y - 34, launchY + 25, wake.age, wake.seed);
        }
      for (const f of flying) {
        const progress = Math.min(1, f.age / FLIGHT_TIME);
        const y = launchY + (impactY - launchY) * progress;
        const style = KNIFE_EFFECTS[f.skin];
        if (!reduced && progress < 1 && f.skin === "classic") {
          const end = Math.min(640, y + style.trail);
          const gradient = c.createLinearGradient(CX, y, CX, end);
          gradient.addColorStop(0, style.color);
          gradient.addColorStop(1, "transparent");
          c.strokeStyle = gradient;
          c.lineWidth = 2;
          c.globalAlpha = 0.3;
          c.beginPath();
          c.moveTo(CX, y);
          c.lineTo(CX, end);
          c.stroke();
          c.globalAlpha = 1;
        }
        // Hold the last visible position only briefly if waiting for an online impact event.
        c.globalAlpha =
          f.age > FLIGHT_TIME
            ? Math.max(0, 1 - (f.age - FLIGHT_TIME) / 0.08)
            : 1;
        knife(c, CX, y, 0, f.seat, 1, { skin: f.skin, sprites, time, reduced });
        c.globalAlpha = 1;
      }
      for (const r of rings) {
        if (r.skin === "dragon") {
          if (!reduced) stormImpact(c, r.x, r.y, r.age, impactSheet);
          continue;
        }
        const k = r.age / 0.25;
        c.strokeStyle = KNIFE_EFFECTS[r.skin].color;
        c.globalAlpha = (1 - k) * 0.6;
        c.lineWidth = 1.5;
        for (let ring = 0; ring < KNIFE_EFFECTS[r.skin].rings; ring++) {
          c.beginPath();
          c.ellipse(
            r.x,
            r.y,
            4 + k * 34 + ring * 6,
            2 + k * 14 + ring * 3,
            0,
            0,
            Math.PI * 2,
          );
          c.stroke();
        }
      }
      for (const p of particles) {
        c.globalAlpha = 1 - p.age / p.life;
        c.fillStyle = p.color;
        c.save();
        c.translate(p.x, p.y);
        if (p.kind === "electric") {
          c.strokeStyle = p.color;
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(0, 0);
          c.lineTo(-p.vx * 0.035, -p.vy * 0.035);
          c.stroke();
          c.rotate(p.age * 3);
          c.beginPath();
          c.moveTo(0, -p.size);
          c.lineTo(p.size * 0.6, 0);
          c.lineTo(0, p.size);
          c.lineTo(-p.size * 0.6, 0);
          c.closePath();
          c.fill();
        } else c.fillRect(-1, -1, p.size, p.size);
        c.restore();
      }
      c.globalAlpha = 1;
      for (const f of fallen) {
        c.save();
        c.globalAlpha = Math.min(1, (0.7 - f.age) * 4);
        knife(c, f.x, f.y, f.angle, f.seat, 1, {
          skin: f.skin,
          sprites,
          time,
          reduced,
        });
        c.restore();
      }
      c.restore();
    },
  };
}
