import {
  CORE_MASS,
  DAMPING,
  FRICTION,
  ITERATIONS,
  MAX_SPEED,
  RELAX,
  RESTITUTION,
  SHELF_D,
  SHELF_W,
  SIDE_WALL_D,
} from "./config";

// The pusher shelf as 2D rigid discs seen from above: x across, y from the back
// wall (0) to the front edge (SHELF_D). Pure and deterministic — no randomness,
// a fixed iteration order, plain objects — so a run replays exactly from its seed
// and the state is JSON. Depth (stacks, the 3/4 view) is faked by the renderer.
//
// One step: sliding friction → integrate → for a few passes, push overlapping
// discs apart (position) and trade momentum along the contact (inelastic
// impulse) → keep everything in front of the pusher and inside the side walls →
// anything whose centre is past the front edge or out over a gutter leaves.
// Position corrections never add velocity, restitution is near zero and speed is
// capped, so a crowded shelf settles instead of exploding.

export interface Body {
  id: number;
  kind: "coin" | "core";
  /** Which energy core (0-5) a capsule is; -1 for coins. */
  core: number;
  /** Coins in this pile (a coin dropped on a coin stacks); 1 for capsules. */
  stack: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

export interface Exit {
  body: Body;
  edge: "front" | "side";
}

export const massOf = (b: Body) => (b.kind === "core" ? CORE_MASS : b.stack);

/** Candidate pairs from a sweep along x (bodies sorted by left edge, ties by id). */
function pairs(bodies: Body[], margin: number): number[] {
  const order = bodies.map((_, i) => i);
  order.sort((a, b) => bodies[a].x - bodies[a].r - (bodies[b].x - bodies[b].r) || bodies[a].id - bodies[b].id);
  const out: number[] = [];
  for (let oi = 0; oi < order.length; oi++) {
    const a = bodies[order[oi]];
    const reach = a.x + a.r + margin;
    for (let oj = oi + 1; oj < order.length; oj++) {
      const b = bodies[order[oj]];
      if (b.x - b.r > reach) break;
      if (Math.abs(a.y - b.y) < a.r + b.r + margin) out.push(order[oi], order[oj]);
    }
  }
  return out;
}

/**
 * Advance the shelf by `dt` with the pusher's front face at `pusherY` moving at
 * `pusherV` (positive = toward the front). Removes and returns what fell off.
 */
export function stepShelf(bodies: Body[], pusherY: number, pusherV: number, dt: number): Exit[] {
  // Friction and integration
  const drag = Math.max(0, 1 - DAMPING * dt);
  for (const b of bodies) {
    let speed = Math.hypot(b.vx, b.vy);
    if (speed > 0) {
      const slow = FRICTION * dt;
      const k = speed <= slow ? 0 : ((speed - slow) / speed) * drag;
      b.vx *= k;
      b.vy *= k;
      speed *= k;
    }
    if (speed > MAX_SPEED) {
      b.vx *= MAX_SPEED / speed;
      b.vy *= MAX_SPEED / speed;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }

  const cand = pairs(bodies, 4);
  for (let it = 0; it < ITERATIONS; it++) {
    for (let p = 0; p < cand.length; p += 2) {
      const a = bodies[cand[p]];
      const b = bodies[cand[p + 1]];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const min = a.r + b.r;
      let d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      if (d2 < 1e-6) {
        // Exactly on top of each other: part them sideways, lower id to the left
        dx = 1;
        dy = 0;
        d2 = 1;
      }
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const wa = 1 / massOf(a);
      const wb = 1 / massOf(b);
      const corr = ((min - d) * RELAX) / (wa + wb);
      a.x -= nx * corr * wa;
      a.y -= ny * corr * wa;
      b.x += nx * corr * wb;
      b.y += ny * corr * wb;
      const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (vn < 0) {
        const j = (-(1 + RESTITUTION) * vn) / (wa + wb);
        a.vx -= j * wa * nx;
        a.vy -= j * wa * ny;
        b.vx += j * wb * nx;
        b.vy += j * wb * ny;
      }
    }
    for (const b of bodies) constrain(b, pusherY, pusherV);
  }

  const exits: Exit[] = [];
  for (let i = bodies.length - 1; i >= 0; i--) {
    const b = bodies[i];
    const edge = b.y > SHELF_D ? "front" : b.x < 0 || b.x > SHELF_W ? "side" : null;
    if (edge) {
      exits.push({ body: b, edge });
      bodies.splice(i, 1);
    }
  }
  return exits.reverse();
}

/** The pusher (a moving back wall) and the side walls along the back of the shelf. */
function constrain(b: Body, pusherY: number, pusherV: number) {
  if (b.y - b.r < pusherY) {
    b.y = pusherY + b.r;
    if (b.vy < pusherV) b.vy = pusherV;
  }
  if (b.y < SIDE_WALL_D) {
    if (b.x - b.r < 0) {
      b.x = b.r;
      if (b.vx < 0) b.vx *= -0.2;
    } else if (b.x + b.r > SHELF_W) {
      b.x = SHELF_W - b.r;
      if (b.vx > 0) b.vx *= -0.2;
    }
  }
}

/** Total kinetic energy, for tests and the settle check. */
export function energy(bodies: Body[]) {
  let e = 0;
  for (const b of bodies) e += 0.5 * massOf(b) * (b.vx * b.vx + b.vy * b.vy);
  return e;
}
