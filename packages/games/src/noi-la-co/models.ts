// Every 3D model in Nói Là Có, built from boxes in code and merged into one
// vertex-coloured geometry per model. Units are tiles; y is up, a model stands
// on y = 0. Characters and animals face +z.
import { BoxGeometry, type BufferGeometry, Color, Float32BufferAttribute } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { PALETTE as P } from "./config";

/** Collects boxes, then merges them into one geometry. */
class Voxels {
  private parts: BufferGeometry[] = [];

  /** A box centred on (x, z), standing on y. */
  box(x: number, y: number, z: number, w: number, h: number, d: number, color: number) {
    const g = new BoxGeometry(w, h, d);
    g.deleteAttribute("uv");
    g.translate(x, y + h / 2, z);
    const c = new Color(color);
    const n = g.getAttribute("position").count;
    const rgb = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) rgb.set([c.r, c.g, c.b], i * 3);
    g.setAttribute("color", new Float32BufferAttribute(rgb, 3));
    this.parts.push(g);
    return this;
  }

  /** The same box on both sides of x = 0. */
  pair(x: number, y: number, z: number, w: number, h: number, d: number, color: number) {
    return this.box(x, y, z, w, h, d, color).box(-x, y, z, w, h, d, color);
  }

  build(): BufferGeometry {
    const merged = mergeGeometries(this.parts, false);
    for (const g of this.parts) g.dispose();
    this.parts = [];
    if (!merged) throw new Error("noi-la-co: empty model");
    merged.computeBoundingSphere();
    return merged;
  }
}

/** Darker (k < 1) or lighter version of a colour, each channel capped at 255. */
const shade = (c: number, k: number) => {
  const ch = (v: number) => Math.min(255, Math.round(v * k));
  return (ch((c >> 16) & 255) << 16) | (ch((c >> 8) & 255) << 8) | ch(c & 255);
};

/** Hair styles, one per seat, so villagers tell apart from behind too. */
const HAIR = [0x2a1d16, 0x5a3a22, 0x1c1c24, 0x8a5a2a, 0x2a1d16, 0xd9a441, 0x3a2414, 0x1c1c24] as const;

/**
 * A villager in parts, each standing on its own pivot so the shell can swing
 * them: legs hang from the hip (y = 0.5), arms from the shoulder (y = 1.0), the
 * head sits on the neck (y = 1.02). The whole figure is about 1.35 tall and
 * faces +z.
 */
export interface VillagerParts {
  head: BufferGeometry;
  torso: BufferGeometry;
  arm: BufferGeometry;
  leg: BufferGeometry;
}

export const HIP_Y = 0.5;
export const SHOULDER_Y = 0.98;
export const NECK_Y = 1.02;
export const HIP_X = 0.12;
export const SHOULDER_X = 0.33;

export function villagerParts(shirt: number, seat: number): VillagerParts {
  const hair = HAIR[seat % HAIR.length];
  const head = new Voxels()
    .box(0, 0, 0, 0.36, 0.34, 0.34, P.skin)
    // hair: a cap, a fringe and the back
    .box(0, 0.27, -0.01, 0.39, 0.1, 0.37, hair)
    .box(0, 0.18, -0.165, 0.39, 0.16, 0.06, hair)
    .box(0, 0.22, 0.17, 0.39, 0.06, 0.04, hair);
  if (seat % 4 === 1) head.box(0, 0.08, -0.2, 0.18, 0.2, 0.06, hair);
  if (seat % 4 === 3) head.pair(0.205, 0.05, 0, 0.04, 0.22, 0.26, hair);
  head
    .pair(0.08, 0.16, 0.171, 0.06, 0.07, 0.02, P.hair)
    .pair(0.08, 0.2, 0.172, 0.02, 0.02, 0.01, 0xffffff)
    .box(0, 0.07, 0.171, 0.12, 0.03, 0.02, 0xb4543c);
  const torso = new Voxels()
    .box(0, 0, 0, 0.5, 0.5, 0.28, shirt)
    .box(0, 0, 0, 0.52, 0.08, 0.3, P.pants)
    .box(0, 0.4, 0.141, 0.16, 0.08, 0.01, shade(shirt, 1.2));
  const arm = new Voxels()
    .box(0, -0.46, 0, 0.16, 0.46, 0.18, shirt)
    .box(0, -0.5, 0, 0.15, 0.12, 0.16, P.skin);
  const leg = new Voxels()
    .box(0, -0.5, 0, 0.22, 0.5, 0.24, P.pants)
    .box(0, -0.5, 0.02, 0.23, 0.09, 0.28, 0x3a2a20);
  return { head: head.build(), torso: torso.build(), arm: arm.build(), leg: leg.build() };
}

/** A little ghost for a player who is out: it floats where they fell and still writes. */
export function ghostModel(): BufferGeometry {
  const v = new Voxels();
  v.box(0, 0.16, 0, 0.44, 0.5, 0.36, P.ghost);
  v.box(0, 0.62, 0, 0.36, 0.14, 0.3, P.ghost);
  for (const x of [-0.15, 0, 0.15]) v.box(x, 0.04, 0, 0.1, 0.12, 0.3, P.ghost);
  v.pair(0.09, 0.48, 0.181, 0.07, 0.1, 0.02, P.hair);
  return v.build();
}

/** The kite a flying player hangs from, centred above their head. */
export function kiteModel(): BufferGeometry {
  const v = new Voxels();
  v.box(0, 0.9, 0, 0.5, 0.04, 0.5, P.kite);
  v.box(0, 0.94, 0, 0.3, 0.02, 0.3, P.gold);
  v.box(0, 0, 0, 0.03, 0.9, 0.03, P.hair);
  v.box(0, 0.86, -0.36, 0.08, 0.03, 0.24, P.gold);
  return v.build();
}

export function buffaloModel(): BufferGeometry {
  const v = new Voxels();
  v.pair(0.26, 0, 0.42, 0.18, 0.34, 0.18, shade(P.buffalo, 0.8));
  v.pair(0.26, 0, -0.42, 0.18, 0.34, 0.18, shade(P.buffalo, 0.8));
  v.box(0, 0.3, 0, 0.78, 0.62, 1.3, P.buffalo);
  v.box(0, 0.5, 0.78, 0.56, 0.5, 0.46, shade(P.buffalo, 1.12));
  v.box(0, 0.5, 1.02, 0.36, 0.22, 0.1, 0xd8a0a0);
  v.pair(0.38, 0.92, 0.74, 0.3, 0.1, 0.1, P.horn);
  v.pair(0.52, 1, 0.74, 0.1, 0.22, 0.1, P.horn);
  v.pair(0.16, 0.8, 1.01, 0.1, 0.08, 0.02, 0xe5322b);
  v.box(0, 0.6, -0.68, 0.08, 0.3, 0.08, shade(P.buffalo, 0.7));
  return v.build();
}

export function crocModel(): BufferGeometry {
  const v = new Voxels();
  v.box(0, 0.04, 0, 0.5, 0.2, 0.9, P.croc);
  v.box(0, 0.02, 0, 0.4, 0.06, 0.8, P.crocBelly);
  v.box(0, 0.08, 0.66, 0.36, 0.16, 0.5, shade(P.croc, 1.1));
  v.box(0, 0.06, 0.92, 0.3, 0.06, 0.08, 0xffffff);
  v.box(0, 0.06, -0.68, 0.28, 0.14, 0.5, P.croc);
  v.box(0, 0.06, -1.04, 0.14, 0.1, 0.3, shade(P.croc, 0.85));
  v.pair(0.3, 0, 0.3, 0.16, 0.1, 0.18, shade(P.croc, 0.85));
  v.pair(0.3, 0, -0.3, 0.16, 0.1, 0.18, shade(P.croc, 0.85));
  v.pair(0.12, 0.24, 0.5, 0.1, 0.08, 0.1, P.gold);
  for (let i = 0; i < 4; i++) v.box(0, 0.24, -0.3 + i * 0.2, 0.12, 0.06, 0.1, shade(P.croc, 0.8));
  return v.build();
}

/** The dragon's head; its body is a chain of cubes the scene strings out behind it. */
export function dragonHeadModel(): BufferGeometry {
  const v = new Voxels();
  v.box(0, 0, 0, 0.9, 0.7, 1, P.dragon);
  v.box(0, 0.04, 0.7, 0.66, 0.4, 0.6, shade(P.dragon, 1.12));
  v.box(0, 0, 0.72, 0.5, 0.1, 0.5, 0xb02020);
  v.pair(0.3, 0.7, -0.2, 0.12, 0.5, 0.12, P.dragonBelly);
  v.pair(0.26, 0.5, 0.3, 0.16, 0.16, 0.16, P.gold);
  v.pair(0.5, 0.2, 0.2, 0.3, 0.06, 0.06, P.dragonBelly);
  return v.build();
}

export function bombModel(): BufferGeometry {
  const v = new Voxels();
  v.box(0, 0, 0, 0.5, 0.5, 0.5, P.bomb);
  v.box(0, 0.06, 0, 0.6, 0.38, 0.38, P.bomb);
  v.box(0, 0.06, 0, 0.38, 0.38, 0.6, P.bomb);
  v.box(0, 0.5, 0, 0.16, 0.08, 0.16, 0x55555f);
  v.box(0.04, 0.58, 0, 0.05, 0.14, 0.05, P.thatch);
  return v.build();
}

export function bananaModel(): BufferGeometry {
  const v = new Voxels();
  v.box(0, 0.06, 0, 0.14, 0.12, 0.14, P.banana);
  v.box(0.16, 0, 0, 0.22, 0.05, 0.12, P.banana);
  v.box(-0.16, 0, 0, 0.22, 0.05, 0.12, P.banana);
  v.box(0, 0, 0.16, 0.12, 0.05, 0.22, P.banana);
  v.box(0, 0.18, 0, 0.06, 0.06, 0.06, shade(P.banana, 0.6));
  return v.build();
}

export function medkitModel(): BufferGeometry {
  const v = new Voxels();
  v.box(0, 0, 0, 0.46, 0.34, 0.34, P.medkit);
  v.box(0, 0.09, 0.171, 0.24, 0.08, 0.02, P.cross);
  v.box(0, 0.01, 0.171, 0.08, 0.24, 0.02, P.cross);
  v.box(0, 0.34, 0, 0.2, 0.05, 0.08, P.cross);
  return v.build();
}

/** A hut on stilts over a 2 x 2 footprint, centred on it: the floor is at `floor`, the roof keeps the sky off. */
export function hutModel(floor: number): BufferGeometry {
  const v = new Voxels();
  for (const [x, z] of [
    [-0.9, -0.9],
    [0.9, -0.9],
    [-0.9, 0.9],
    [0.9, 0.9],
  ]) {
    v.box(x, 0, z, 0.12, floor + 1.25, 0.12, P.bambooDark);
  }
  v.box(0, floor - 0.1, 0, 2, 0.1, 2, P.bamboo);
  for (let i = 0; i < 5; i++) v.box(-0.8 + i * 0.4, floor, 0, 0.04, 0.012, 2, P.bambooDark);
  // A back wall and low side rails, so the inside stays visible from the camera
  v.box(0, floor, -0.94, 1.9, 0.9, 0.06, P.thatchDark);
  v.pair(0.94, floor + 0.3, 0, 0.05, 0.06, 1.9, P.bambooDark);
  // A ladder at the front
  v.pair(0.2, 0, 1.12, 0.05, floor, 0.05, P.bambooDark);
  for (let i = 1; i < 4; i++) v.box(0, (floor * i) / 4, 1.12, 0.4, 0.04, 0.05, P.bamboo);
  // The thatch, in steps
  v.box(0, floor + 1.25, 0, 2.5, 0.16, 2.5, P.thatch);
  v.box(0, floor + 1.41, 0, 1.9, 0.16, 1.9, P.thatchDark);
  v.box(0, floor + 1.57, 0, 1.2, 0.16, 1.2, P.thatch);
  v.box(0, floor + 1.73, 0, 0.5, 0.14, 0.5, P.thatchDark);
  return v.build();
}

/** A tree on a tile: a thick trunk and a stepped canopy that leaves the tiles around it open. */
export function treeModel(): BufferGeometry {
  const v = new Voxels();
  v.box(0, 0, 0, 0.9, 0.3, 0.9, P.trunk);
  v.box(0, 0, 0, 0.62, 2.6, 0.62, P.trunk);
  v.box(0.18, 1.4, 0, 0.5, 0.14, 0.14, P.trunk);
  v.box(0, 2.3, 0, 2.2, 0.8, 2.2, P.leaf);
  v.box(0, 3.1, 0, 1.6, 0.7, 1.6, P.leafDark);
  v.box(0, 3.8, 0, 0.9, 0.5, 0.9, P.leaf);
  v.box(0.7, 2.1, 0.7, 0.5, 0.4, 0.5, P.leafDark);
  v.box(-0.8, 2.2, -0.4, 0.4, 0.36, 0.4, P.leafDark);
  return v.build();
}

/** A tuft of grass, a flower or a pebble for the open ground. */
export function tuftModel(kind: number): BufferGeometry {
  const v = new Voxels();
  if (kind === 0) v.box(0, 0, 0, 0.06, 0.18, 0.06, P.leafDark).box(0.07, 0, 0.03, 0.05, 0.13, 0.05, P.leaf).box(-0.06, 0, -0.02, 0.05, 0.15, 0.05, P.leaf);
  else if (kind === 1) v.box(0, 0, 0, 0.04, 0.2, 0.04, P.leafDark).box(0, 0.2, 0, 0.12, 0.08, 0.12, [0xffe27a, 0xf472b6, 0xffffff][kind % 3]).box(0, 0.22, 0, 0.05, 0.05, 0.05, 0xf5a623);
  else v.box(0, 0, 0, 0.26, 0.12, 0.2, P.rock).box(0.04, 0.1, 0, 0.14, 0.07, 0.12, shade(P.rock, 1.12));
  return v.build();
}

/** A puffy cloud of a few boxes, far out over the water. */
export function cloudModel(): BufferGeometry {
  const v = new Voxels();
  v.box(0, 0, 0, 4, 1, 2.4, P.cloud);
  v.box(-0.8, 0.8, 0, 2, 0.8, 1.8, P.cloud);
  v.box(1, 0.6, 0.2, 1.6, 0.7, 1.6, P.cloud);
  return v.build();
}

/** A haystack filling a 2 x 2 footprint, flat enough on top to stand on at `top`. */
export function haystackModel(top: number): BufferGeometry {
  const v = new Voxels();
  v.box(0, 0, 0, 1.96, top * 0.55, 1.96, P.hayDark);
  v.box(0, top * 0.55, 0, 1.84, top * 0.45, 1.84, P.hay);
  for (const [x, z] of [
    [-0.6, 0.4],
    [0.5, -0.5],
    [0.2, 0.7],
  ]) {
    v.box(x, top, z, 0.3, 0.03, 0.08, P.hayDark);
  }
  v.box(0, 0.2, 0.99, 1.4, 0.06, 0.02, P.bambooDark);
  v.box(0.99, 0.2, 0, 0.02, 0.06, 1.4, P.bambooDark);
  return v.build();
}

/** A clump of reeds for the shore. */
export function reedModel(): BufferGeometry {
  const v = new Voxels();
  v.box(0, 0, 0, 0.06, 0.5, 0.06, P.leafDark);
  v.box(0.1, 0, 0.06, 0.05, 0.36, 0.05, P.leaf);
  v.box(-0.09, 0, -0.04, 0.05, 0.42, 0.05, P.leaf);
  v.box(0, 0.5, 0, 0.08, 0.12, 0.08, P.trunk);
  return v.build();
}

/** A banana plant out in the shallows, for the far corners. */
export function palmModel(): BufferGeometry {
  const v = new Voxels();
  v.box(0, 0, 0, 0.22, 1.5, 0.22, P.trunk);
  v.box(0, 1.5, 0, 1.5, 0.08, 0.34, P.leaf);
  v.box(0, 1.52, 0, 0.34, 0.08, 1.5, P.leafDark);
  v.box(0, 1.6, 0, 0.9, 0.08, 0.9, P.leaf);
  v.box(0.16, 1.24, 0.14, 0.18, 0.26, 0.18, P.banana);
  return v.build();
}
