// Every 3D model in Qua Đường, built from boxes in code and merged into one
// vertex-coloured geometry per model (one draw call each, or one per
// InstancedMesh). Units are grid cells; y is up, a model stands on y = 0.
// Characters face +z; vehicles, floaters and the train face +x (their travel).
import { BoxGeometry, type BufferGeometry, Color, Float32BufferAttribute } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { HALF, LANE_HALF, PALETTE as P, type SkinId } from "./config";

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

  /** The same box mirrored across x = 0 and z = 0 as asked. */
  mirror(x: number, y: number, z: number, w: number, h: number, d: number, color: number, axis: "x" | "z" = "x") {
    this.box(x, y, z, w, h, d, color);
    return axis === "x" ? this.box(-x, y, z, w, h, d, color) : this.box(x, y, -z, w, h, d, color);
  }

  build(): BufferGeometry {
    const merged = mergeGeometries(this.parts, false);
    for (const g of this.parts) g.dispose();
    this.parts = [];
    if (!merged) throw new Error("qua-duong: empty model");
    merged.computeBoundingSphere();
    return merged;
  }
}

/** Darker version of a colour, for out-of-bounds ground and shading. */
const shade = (c: number, k: number) => {
  const r = Math.round(((c >> 16) & 255) * k);
  const g = Math.round(((c >> 8) & 255) * k);
  const b = Math.round((c & 255) * k);
  return (r << 16) | (g << 8) | b;
};

// ---------------------------------------------------------------- the duck

/** The conical non la hat, stacked plates. */
function hat(v: Voxels, y: number) {
  v.box(0, y, 0.06, 0.68, 0.05, 0.68, P.hat);
  v.box(0, y + 0.05, 0.06, 0.5, 0.07, 0.5, P.hatShade);
  v.box(0, y + 0.12, 0.06, 0.34, 0.07, 0.34, P.hat);
  v.box(0, y + 0.19, 0.06, 0.2, 0.07, 0.2, P.hatShade);
  v.box(0, y + 0.26, 0.06, 0.08, 0.05, 0.08, P.hat);
}

export function duckModel(skin: SkinId): BufferGeometry {
  const v = new Voxels();
  // feet and body
  v.mirror(0.12, 0, 0.06, 0.13, 0.08, 0.22, P.beak);
  v.mirror(0.1, 0.06, 0, 0.07, 0.08, 0.07, P.beak);
  v.box(0, 0.12, 0, 0.52, 0.38, 0.56, P.duck);
  v.box(0, 0.3, -0.32, 0.22, 0.14, 0.1, P.duckShade);
  v.mirror(0.29, 0.2, -0.02, 0.07, 0.22, 0.34, P.duckShade);
  // head, beak, eyes
  v.box(0, 0.5, 0.08, 0.42, 0.36, 0.4, P.duck);
  v.box(0, 0.58, 0.32, 0.24, 0.08, 0.14, P.beak);
  v.box(0, 0.54, 0.3, 0.18, 0.04, 0.1, shade(P.beak, 0.85));
  v.mirror(0.13, 0.7, 0.285, 0.07, 0.08, 0.02, P.eye);

  if (skin === "vit-ao-mua") {
    // A lemon raincoat over the body, hood under the hat, dark buttons
    v.box(0, 0.1, 0, 0.6, 0.36, 0.62, 0xe8ef3a);
    v.box(0, 0.44, 0.02, 0.5, 0.06, 0.5, 0xd5dc2c);
    v.box(0, 0.24, 0.315, 0.05, 0.05, 0.02, 0x2f3a4a);
    v.box(0, 0.34, 0.315, 0.05, 0.05, 0.02, 0x2f3a4a);
    v.box(0, 0.66, -0.06, 0.46, 0.24, 0.3, 0xe8ef3a);
    hat(v, 0.86);
  } else if (skin === "vit-shipper") {
    // Green courier helmet with a visor, insulated delivery box on the back
    v.box(0, 0.8, 0.06, 0.48, 0.14, 0.46, P.helmetGreen);
    v.box(0, 0.94, 0.06, 0.36, 0.06, 0.34, P.helmetGreen);
    v.box(0, 0.8, 0.31, 0.4, 0.05, 0.08, shade(P.helmetGreen, 0.7));
    v.box(0, 0.22, -0.44, 0.5, 0.48, 0.32, P.helmetGreen);
    v.box(0, 0.42, -0.6, 0.5, 0.08, 0.02, P.busYellow);
    v.mirror(0.2, 0.3, -0.27, 0.05, 0.3, 0.05, P.hair);
  } else if (skin === "vit-ao-dai") {
    // Red áo dài: fitted top, long front and back panels, gold trim
    v.box(0, 0.16, 0, 0.56, 0.34, 0.6, 0xd62b2b);
    v.box(0, 0.48, 0.04, 0.24, 0.06, 0.26, 0xd62b2b);
    v.box(0, 0.02, 0.31, 0.34, 0.3, 0.04, 0xc42222);
    v.box(0, 0.02, -0.31, 0.34, 0.3, 0.04, 0xc42222);
    v.box(0, 0.3, 0.315, 0.3, 0.04, 0.02, P.badge);
    v.mirror(0.3, 0.2, -0.02, 0.06, 0.24, 0.36, 0xd62b2b);
    hat(v, 0.86);
  } else if (skin === "vit-kinh-ram") {
    // Sunglasses and a guitar slung on the back
    v.box(0, 0.68, 0.3, 0.38, 0.1, 0.04, P.eye);
    v.mirror(0.2, 0.7, 0.18, 0.03, 0.04, 0.24, P.eye);
    v.box(0.04, 0.12, -0.36, 0.34, 0.36, 0.1, 0xb4652a);
    v.box(0.04, 0.24, -0.42, 0.12, 0.12, 0.02, 0x3a2414);
    v.box(0.04, 0.48, -0.36, 0.08, 0.5, 0.06, P.woodDark);
    hat(v, 0.86);
  } else {
    // vit-vang: the plain duckling, red chin strap
    v.mirror(0.22, 0.54, 0.1, 0.02, 0.32, 0.04, P.strap);
    hat(v, 0.86);
  }
  return v.build();
}

// ---------------------------------------------------------------- people

function rider(v: Voxels, x: number, y: number, shirt: number, helmet: number) {
  v.box(x + 0.04, y, 0, 0.22, 0.14, 0.32, 0x34405a);
  v.box(x - 0.06, y + 0.12, 0, 0.22, 0.28, 0.28, shirt);
  v.mirror(x + 0.12, y + 0.3, 0.15, 0.26, 0.07, 0.07, shirt, "z");
  v.box(x - 0.05, y + 0.4, 0, 0.2, 0.2, 0.2, P.skin);
  v.box(x - 0.06, y + 0.54, 0, 0.25, 0.12, 0.25, helmet);
}

export function motoModel(body: number, shirt: number, helmet: number, cargo: boolean): BufferGeometry {
  const v = new Voxels();
  v.mirror(0.3, 0, 0, 0.24, 0.24, 0.1, P.tyre);
  v.box(0, 0.12, 0, 0.66, 0.18, 0.24, body);
  v.box(0.26, 0.22, 0, 0.16, 0.18, 0.26, body);
  v.box(0.31, 0.36, 0, 0.06, 0.2, 0.06, P.metal);
  v.box(0.31, 0.54, 0, 0.06, 0.04, 0.44, P.tyre);
  v.box(-0.1, 0.3, 0, 0.38, 0.06, 0.24, P.tyre);
  // the rider's arms reach the handlebar: built along x, mirrored across z
  v.box(0.04, 0.24, 0, 0.22, 0.14, 0.32, 0x34405a);
  v.box(-0.06, 0.36, 0, 0.22, 0.28, 0.28, shirt);
  v.mirror(0.12, 0.54, 0.15, 0.26, 0.07, 0.07, shirt, "z");
  v.box(-0.05, 0.64, 0, 0.2, 0.2, 0.2, P.skin);
  v.box(-0.06, 0.78, 0, 0.25, 0.12, 0.25, helmet);
  if (cargo) {
    v.box(-0.36, 0.34, 0, 0.3, 0.24, 0.36, P.box);
    v.box(-0.36, 0.58, 0, 0.28, 0.22, 0.32, shade(P.box, 0.92));
    v.box(-0.36, 0.8, 0, 0.24, 0.18, 0.28, P.box);
    v.box(-0.36, 0.34, 0, 0.31, 0.64, 0.05, P.boxTape);
  }
  return v.build();
}

export function busModel(): BufferGeometry {
  const v = new Voxels();
  for (const x of [-0.95, 0.95]) v.mirror(x, 0, 0.37, 0.34, 0.34, 0.1, P.tyre, "z");
  v.box(0, 0.12, 0, 2.9, 0.4, 0.8, P.busGreen);
  v.box(0, 0.52, 0, 2.92, 0.08, 0.82, P.busYellow);
  v.box(0, 0.6, 0, 2.86, 0.26, 0.8, P.glass);
  for (let x = -1.2; x <= 1.21; x += 0.6) v.box(x, 0.6, 0, 0.07, 0.26, 0.82, P.busGreen);
  v.box(1.45, 0.6, 0, 0.04, 0.26, 0.7, P.glass);
  v.box(0, 0.86, 0, 2.9, 0.1, 0.8, P.busYellow);
  v.box(-0.3, 0.96, 0, 1.1, 0.1, 0.5, P.busRoof);
  v.box(1.46, 0.16, 0, 0.04, 0.12, 0.6, P.metal);
  return v.build();
}

export function baGacModel(): BufferGeometry {
  const v = new Voxels();
  // the bicycle front with its rider
  v.box(0.72, 0, 0, 0.28, 0.28, 0.08, P.tyre);
  v.box(0.56, 0.22, 0, 0.36, 0.06, 0.06, P.metal);
  v.box(0.72, 0.28, 0, 0.05, 0.3, 0.05, P.metal);
  v.box(0.72, 0.56, 0, 0.05, 0.04, 0.36, P.tyre);
  rider(v, 0.48, 0.26, P.shirtPink, P.hat);
  // the cart bed and its load
  v.mirror(0.42, 0, -0.25, 0.28, 0.28, 0.08, P.tyre, "z");
  v.box(-0.25, 0.26, 0, 1.2, 0.08, 0.84, P.woodLight);
  v.box(-0.25, 0.34, 0.4, 1.2, 0.12, 0.04, P.wood);
  v.box(-0.25, 0.34, -0.4, 1.2, 0.12, 0.04, P.wood);
  v.box(-0.5, 0.34, 0.12, 0.36, 0.3, 0.36, P.box);
  v.box(-0.5, 0.64, 0.12, 0.3, 0.24, 0.3, shade(P.box, 0.92));
  v.box(-0.05, 0.34, -0.16, 0.3, 0.2, 0.3, P.pot);
  v.box(-0.05, 0.54, -0.16, 0.36, 0.22, 0.36, P.leaf);
  v.box(-0.05, 0.76, -0.16, 0.12, 0.1, 0.12, P.flower);
  return v.build();
}

export function trainModel(): BufferGeometry {
  const v = new Voxels();
  // locomotive at the front (+x), three carriages behind
  v.box(4.5, 0.12, 0, 2.9, 1.0, 0.86, P.train);
  v.box(4.5, 0.42, 0, 2.92, 0.14, 0.88, P.trainStripe);
  v.box(5.96, 0.12, 0, 0.1, 0.7, 0.74, P.trainNose);
  v.box(5.3, 0.78, 0, 0.7, 0.22, 0.88, P.glass);
  v.box(4.2, 1.12, 0, 1.4, 0.12, 0.5, P.metal);
  for (const cx of [1.5, -1.5, -4.5]) {
    v.box(cx, 0.12, 0, 2.85, 0.96, 0.84, P.train);
    v.box(cx, 0.36, 0, 2.87, 0.1, 0.86, P.trainStripe);
    v.box(cx, 0.62, 0, 2.6, 0.24, 0.86, P.glass);
    v.box(cx, 1.08, 0, 2.85, 0.08, 0.7, P.metal);
  }
  v.mirror(0, 0, 0.3, 11.8, 0.14, 0.1, P.tyre, "z");
  return v.build();
}

// ---------------------------------------------------------------- the river

export function gheModel(): BufferGeometry {
  const v = new Voxels();
  v.box(0, -0.3, 0, 2.3, 0.16, 0.56, P.woodDark);
  v.box(0, -0.16, 0, 2.7, 0.16, 0.78, P.wood);
  v.box(0, -0.02, 0, 2.5, 0.04, 0.62, P.woodLight);
  v.mirror(1.42, -0.12, 0, 0.18, 0.2, 0.5, P.woodDark);
  v.box(1.56, 0.0, 0, 0.12, 0.12, 0.3, P.boatRed);
  v.box(-1.56, 0.0, 0, 0.12, 0.12, 0.3, P.boatRed);
  // a basket of flowers at the stern, the rower at the bow
  v.box(-1.12, 0.02, 0, 0.26, 0.14, 0.3, P.woodLight);
  v.box(-1.12, 0.16, 0, 0.22, 0.08, 0.26, P.banana);
  v.box(1.22, 0.02, 0.18, 0.16, 0.26, 0.18, P.shirtPink);
  v.box(1.22, 0.28, 0.18, 0.14, 0.14, 0.14, P.skin);
  v.box(1.22, 0.42, 0.18, 0.34, 0.04, 0.34, P.hat);
  v.box(1.22, 0.46, 0.18, 0.18, 0.06, 0.18, P.hatShade);
  v.box(1.36, -0.2, 0.42, 0.06, 0.5, 0.06, P.woodDark);
  return v.build();
}

export function raftModel(len: number): BufferGeometry {
  const v = new Voxels();
  for (const [i, z] of [-0.33, -0.11, 0.11, 0.33].entries()) v.box(0, -0.2, z, len - 0.08, 0.18, 0.2, i % 2 ? P.bambooDark : P.bamboo);
  for (const x of [-(len / 2 - 0.3), len / 2 - 0.3]) v.box(x, -0.03, 0, 0.1, 0.04, 0.86, P.woodDark);
  return v.build();
}

export function hyacinthModel(len: number): BufferGeometry {
  const v = new Voxels();
  for (let i = 0; i < len; i++) {
    const cx = i - (len - 1) / 2;
    v.box(cx, -0.22, 0, 0.86, 0.18, 0.82, P.leafDark);
    v.box(cx - 0.2, -0.06, -0.18, 0.3, 0.12, 0.3, P.leaf);
    v.box(cx + 0.22, -0.06, 0.12, 0.28, 0.14, 0.28, P.leaf);
    v.box(cx - 0.12, -0.06, 0.24, 0.24, 0.1, 0.24, shade(P.leaf, 1.1));
    v.box(cx + 0.2, 0.06, -0.2, 0.12, 0.14, 0.12, P.flower);
    v.box(cx + 0.24, 0.16, -0.2, 0.08, 0.06, 0.08, shade(P.flower, 1.15));
  }
  return v.build();
}

// ---------------------------------------------------------------- grass blocks and street furniture

export function bananaModel(): BufferGeometry {
  const v = new Voxels();
  v.box(0, 0, 0, 0.22, 1.1, 0.22, P.trunk);
  v.box(0, 0.4, 0, 0.26, 0.08, 0.26, shade(P.trunk, 0.85));
  v.box(0, 1.05, 0, 0.32, 0.3, 0.32, P.leaf);
  v.mirror(0.36, 1.05, 0, 0.5, 0.08, 0.24, P.leaf);
  v.mirror(0.66, 0.95, 0, 0.2, 0.08, 0.22, P.leafDark);
  v.mirror(0, 1.12, 0.36, 0.24, 0.08, 0.5, P.leafDark, "z");
  v.mirror(0, 1.02, 0.66, 0.22, 0.08, 0.2, P.leaf, "z");
  v.box(0.14, 0.72, 0.1, 0.16, 0.22, 0.16, P.banana);
  return v.build();
}

export function stoolModel(): BufferGeometry {
  const v = new Voxels();
  for (const [ox, oz, h] of [
    [-0.18, -0.1, 0],
    [0.2, 0.16, 0],
    [0.2, 0.16, 0.34],
  ] as const) {
    for (const [lx, lz] of [
      [-0.13, -0.13],
      [0.13, -0.13],
      [-0.13, 0.13],
      [0.13, 0.13],
    ])
      v.box(ox + lx, h, oz + lz, 0.06, 0.28, 0.06, P.stool);
    v.box(ox, h + 0.28, oz, 0.36, 0.06, 0.36, P.stool);
  }
  return v.build();
}

export function foodCartModel(): BufferGeometry {
  const v = new Voxels();
  v.mirror(0.24, 0, 0.32, 0.28, 0.28, 0.06, P.tyre, "z");
  v.box(0, 0.16, 0, 0.84, 0.46, 0.6, P.cart);
  v.box(0, 0.62, 0, 0.74, 0.26, 0.5, 0xbfe6f0);
  v.box(-0.18, 0.66, 0, 0.2, 0.12, 0.2, P.banana);
  v.box(0.22, 0.62, 0, 0.22, 0.26, 0.22, P.pot);
  for (const [x, z] of [
    [-0.4, -0.28],
    [0.4, -0.28],
    [-0.4, 0.28],
    [0.4, 0.28],
  ])
    v.box(x, 0.62, z, 0.04, 0.44, 0.04, P.metal);
  for (let i = 0; i < 5; i++) v.box(-0.4 + i * 0.2, 1.06, 0, 0.2, 0.06, 0.78, i % 2 ? P.awningWhite : P.awningRed);
  return v.build();
}

export function hedgeModel(): BufferGeometry {
  const v = new Voxels();
  v.box(0, 0, 0, 0.9, 0.46, 0.82, P.hedge);
  v.box(0, 0.46, 0, 0.8, 0.12, 0.72, P.hedgeTop);
  v.box(0.2, 0.58, 0.1, 0.3, 0.08, 0.3, P.hedgeTop);
  return v.build();
}

/** A yellow tube house with a red tile roof, two cells wide, front facing +z. */
export function houseModel(): BufferGeometry {
  const v = new Voxels();
  v.box(0, 0, 0, 1.8, 0.3, 0.92, P.wallShade);
  v.box(0, 0.3, 0, 1.8, 1.3, 0.9, P.wall);
  v.mirror(0.5, 0.85, 0.46, 0.34, 0.42, 0.03, P.shutter);
  v.box(0, 0, 0.46, 0.42, 0.72, 0.03, P.woodDark);
  v.box(0, 1.45, 0.46, 1.6, 0.06, 0.03, P.wallShade);
  v.box(0, 1.6, 0, 2.0, 0.14, 1.12, P.roof);
  v.box(0, 1.74, 0, 1.7, 0.14, 0.84, P.roofShade);
  v.box(0, 1.88, 0, 1.36, 0.14, 0.54, P.roof);
  v.box(0, 2.02, 0, 1.0, 0.08, 0.22, P.roofShade);
  return v.build();
}

export function poleModel(): BufferGeometry {
  return new Voxels().box(0, 0, 0, 0.14, 2.7, 0.14, P.pole).box(0, 2.5, 0, 0.5, 0.06, 0.08, P.pole).build();
}

/** The wire lanterns hang from, across a whole lane between two poles. */
export function wireModel(span: number): BufferGeometry {
  return new Voxels().box(0, 2.46, 0, span, 0.03, 0.03, P.wire).build();
}

export function railPostModel(): BufferGeometry {
  const v = new Voxels();
  v.box(0, 0, 0, 0.1, 1.4, 0.1, P.metal);
  v.box(0, 1.2, 0, 0.06, 0.2, 0.7, P.sign);
  v.box(0, 1.26, 0, 0.07, 0.08, 0.7, P.signRed);
  v.box(0.06, 0.82, 0, 0.08, 0.22, 0.42, P.tyre);
  return v.build();
}

export function coinModel(): BufferGeometry {
  const v = new Voxels();
  v.box(0, -0.2, 0, 0.4, 0.4, 0.1, P.coin);
  v.box(0, -0.13, 0, 0.24, 0.26, 0.14, P.coinFace);
  return v.build();
}

/** The ward officer: khaki uniform, cap with a badge, whistle. */
export function officerModel(): BufferGeometry {
  const v = new Voxels();
  v.mirror(0.09, 0, 0, 0.14, 0.34, 0.16, shade(P.officer, 0.8));
  v.box(0, 0.34, 0, 0.38, 0.36, 0.24, P.officer);
  v.box(0, 0.38, 0, 0.4, 0.05, 0.26, P.tyre);
  v.mirror(0.24, 0.36, 0, 0.1, 0.32, 0.12, P.officer);
  v.box(0, 0.7, 0, 0.26, 0.26, 0.26, P.skin);
  v.box(0, 0.94, 0, 0.32, 0.1, 0.32, P.officerCap);
  v.box(0, 0.94, 0.18, 0.28, 0.03, 0.1, shade(P.officerCap, 0.7));
  v.box(0, 0.98, 0.165, 0.08, 0.06, 0.02, P.badge);
  v.mirror(0.07, 0.86, 0.13, 0.04, 0.03, 0.01, P.eye);
  v.box(0, 0.74, 0.16, 0.06, 0.04, 0.12, P.whistle);
  return v.build();
}

// ---------------------------------------------------------------- ground

export type GroundKind = "grass-a" | "grass-b" | "road" | "road-line" | "river" | "rail";

/** One lane's ground: brighter inside the playfield, shaded outside it. */
export function groundModel(kind: GroundKind): BufferGeometry {
  const v = new Voxels();
  const strip = (y: number, h: number, inner: number, outer: number) => {
    const edge = HALF + 0.5;
    const side = LANE_HALF - edge;
    v.box(0, y, 0, edge * 2, h, 1, inner);
    v.mirror(edge + side / 2, y, 0, side, h, 1, outer);
  };
  if (kind === "grass-a" || kind === "grass-b") {
    const c = kind === "grass-a" ? P.grassA : P.grassB;
    strip(-0.5, 0.5, c, shade(c, 0.86));
  } else if (kind === "road") {
    strip(-0.5, 0.47, P.road, shade(P.road, 0.86));
  } else if (kind === "road-line") {
    for (let x = -LANE_HALF + 0.4; x < LANE_HALF; x += 1.25) v.box(x, -0.03, 0.5, 0.6, 0.012, 0.06, P.roadLine);
  } else if (kind === "river") {
    strip(-0.9, 0.68, P.water, shade(P.waterDeep, 0.9));
  } else {
    strip(-0.5, 0.48, P.gravel, shade(P.gravel, 0.86));
    for (let x = -LANE_HALF + 0.25; x < LANE_HALF; x += 0.55) v.box(x, -0.04, 0, 0.18, 0.05, 0.84, P.tie);
    v.mirror(0, 0.01, 0.26, LANE_HALF * 2, 0.06, 0.06, P.rail, "z");
  }
  return v.build();
}
