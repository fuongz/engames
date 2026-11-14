// The jungle island the board sits on, built in code: sandstone tiles over a
// moss bed, two turquoise ponds with lily pads and lotus, bramble traps, two
// stone burrow dens with straw, jungle plants round the rim and a rocky
// underside so the whole board floats. Static except the water shimmer and the
// bobbing pads, which `animate(t)` drives.
//
// World units: one square = 1. Square (x, y) is centred at (x - 3, 0, y - 4);
// tile tops are at y = 0. Red's den is at +z, Blue's at -z.
import {
  type BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import { BLUE_HEX, RED_HEX } from "./config";
import { COLS, DEN, ROWS, SQUARES, TRAPS, colOf, isWater, rowOf, sq } from "./logic";

export const TILE = 0.92;
export const TILE_H = 0.24;
export const WATER_Y = -0.065;
/** The grass round the board. */
const GRASS_Y = -0.12;

/** World position of a square's centre (tile top). */
export const squareX = (s: number) => colOf(s) - (COLS - 1) / 2;
export const squareZ = (s: number) => rowOf(s) - (ROWS - 1) / 2;

/** A stable 0..1 for decoration. */
export function hash(a: number, b = 0) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

function roundedRect(w: number, d: number, r: number): Shape {
  const s = new Shape();
  const x = -w / 2;
  const y = -d / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r);
  s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d);
  s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** A soft-edged slab lying flat, its top at y = 0. */
export function slab(w: number, d: number, h: number, r: number, bevel = 0.03): BufferGeometry {
  const g = new ExtrudeGeometry(roundedRect(w - bevel * 2, d - bevel * 2, r), {
    depth: h - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 5,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -h + bevel, 0);
  return g;
}

/** A leaf outline, tip along +y, lying in the xy plane. */
function leafGeometry(len: number, wid: number): BufferGeometry {
  const s = new Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(wid, len * 0.4, 0, len);
  s.quadraticCurveTo(-wid, len * 0.4, 0, 0);
  return new ShapeGeometry(s, 6);
}

const WATER_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const WATER_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec2 uSize;
varying vec2 vUv;
void main() {
  vec2 p = vUv * uSize;
  float edge = min(min(vUv.x, 1.0 - vUv.x) * uSize.x, min(vUv.y, 1.0 - vUv.y) * uSize.y);
  vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 0.7, edge));
  float w = sin(p.x * 5.1 + uTime * 1.3) + sin(p.y * 4.3 - uTime * 1.05) + sin((p.x + p.y) * 3.7 + uTime * 0.8);
  float glint = smoothstep(2.15, 2.85, w);
  float ripple = 0.5 + 0.5 * sin(p.x * 2.0 - p.y * 1.6 + uTime * 0.6);
  col += vec3(0.85, 1.0, 0.95) * glint * 0.32 + ripple * 0.035;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export interface Diorama {
  group: Group;
  /** Shimmer and bob; t in seconds. */
  animate(t: number): void;
  dispose(): void;
}

const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _e = new Vector3();

export function buildDiorama(): Diorama {
  const group = new Group();
  const mats: { std: Map<string, MeshStandardMaterial> } = { std: new Map() };
  const mat = (hex: string, opts: { flat?: boolean; double?: boolean; rough?: number } = {}) => {
    const key = `${hex}|${opts.flat ? 1 : 0}|${opts.double ? 1 : 0}|${opts.rough ?? 0.9}`;
    let m = mats.std.get(key);
    if (!m) {
      m = new MeshStandardMaterial({
        color: hex,
        roughness: opts.rough ?? 0.9,
        metalness: 0,
        flatShading: opts.flat ?? false,
        side: opts.double ? DoubleSide : undefined,
      });
      mats.std.set(key, m);
    }
    return m;
  };
  const add = (o: Object3D, cast = true, receive = true) => {
    o.castShadow = cast;
    o.receiveShadow = receive;
    group.add(o);
    return o;
  };
  const mesh = (g: BufferGeometry, m: MeshStandardMaterial, x: number, y: number, z: number, cast = true, receive = true) => {
    const o = new Mesh(g, m);
    o.position.set(x, y, z);
    return add(o, cast, receive) as Mesh;
  };

  // ------------------------------------------------------------ island
  const BW = COLS + 0.5;
  const BD = ROWS + 0.5;
  // Grassy top, a little bigger than the board, and a soil band under it
  mesh(slab(BW + 2.6, BD + 2.6, 0.5, 1.3, 0.12), mat("#7fbf4d"), 0, GRASS_Y, 0, false, true);
  mesh(slab(BW + 2.3, BD + 2.3, 0.7, 1.2, 0.1), mat("#8a5a36"), 0, -0.62, 0, false, false);
  // Rocky underside: a squashed, faceted cone hanging below
  const under = new ConeGeometry(6.4, 6.2, 9, 3);
  under.rotateX(Math.PI);
  under.scale(0.92, 1, 1.1);
  mesh(under, mat("#7b5b42", { flat: true }), 0, -4.2, 0, false, false);
  const under2 = new ConeGeometry(4.2, 4.4, 7, 2);
  under2.rotateX(Math.PI);
  mesh(under2, mat("#6a7d58", { flat: true }), 1.2, -5.2, -0.8, false, false);
  // Hanging roots and a few floating rocks
  const root = new CylinderGeometry(0.03, 0.012, 1.6, 4);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + hash(i, 3);
    const r = 5.2 + hash(i, 4) * 0.6;
    const o = mesh(root, mat("#5c3d25"), Math.cos(a) * r * 0.82, -1.5 - hash(i, 5) * 0.6, Math.sin(a) * r, false, false);
    o.rotation.z = (hash(i, 6) - 0.5) * 0.5;
    o.scale.y = 0.6 + hash(i, 7);
  }
  const rock = new DodecahedronGeometry(0.4, 0);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.6;
    const o = mesh(rock, mat("#8d8170", { flat: true }), Math.cos(a) * 7.2, -2.6 - hash(i, 9) * 2, Math.sin(a) * 7.8, false, false);
    o.scale.setScalar(0.5 + hash(i, 10) * 0.8);
    o.rotation.set(hash(i, 11) * 3, hash(i, 12) * 3, 0);
  }

  // ------------------------------------------------------------ moss bed and tiles
  // A mossy bed under the tiles: it shows in the gaps as green grout
  mesh(slab(BW + 0.15, BD + 0.15, 0.3, 0.35, 0.05), mat("#4f8a35"), 0, -0.1, 0, false, true);
  const tileGeo = slab(TILE, TILE, TILE_H, 0.12, 0.035);
  const land: number[] = [];
  for (let s = 0; s < SQUARES; s++) if (!isWater(s)) land.push(s);
  const tiles = new InstancedMesh(tileGeo, mat("#ffffff", { rough: 0.95 }), land.length);
  tiles.castShadow = false;
  tiles.receiveShadow = true;
  const sand = [new Color("#e8cf9b"), new Color("#dcc08a"), new Color("#efd9a9"), new Color("#d6b884")];
  const denTint = new Color("#b9a88a");
  const trapTint = new Color("#cdb487");
  land.forEach((s, i) => {
    _m.makeTranslation(squareX(s), (hash(s, 1) - 0.5) * 0.02, squareZ(s));
    tiles.setMatrixAt(i, _m);
    const c = sand[Math.floor(hash(s, 2) * sand.length)].clone();
    c.offsetHSL((hash(s, 3) - 0.5) * 0.015, 0, (hash(s, 4) - 0.5) * 0.05);
    if (s === DEN[1] || s === DEN[-1]) c.copy(denTint);
    else if (TRAPS[1].includes(s) || TRAPS[-1].includes(s)) c.lerp(trapTint, 0.6);
    tiles.setColorAt(i, c);
  });
  add(tiles, false, true);

  // Moss tufts creeping over tile edges and corners
  const tuft = new IcosahedronGeometry(0.11, 0);
  tuft.scale(1, 0.32, 1);
  const tufts: [number, number, number][] = [];
  for (let s = 0; s < SQUARES; s++) {
    if (isWater(s)) continue;
    const n = hash(s, 20) < 0.55 ? 1 + Math.floor(hash(s, 21) * 3) : 0;
    for (let k = 0; k < n; k++) {
      const corner = Math.floor(hash(s, 22 + k) * 4);
      const ox = (corner & 1 ? 1 : -1) * (TILE / 2 - 0.04 - hash(s, 30 + k) * 0.25);
      const oz = (corner & 2 ? 1 : -1) * (TILE / 2 - 0.02);
      const flip = hash(s, 40 + k) < 0.5;
      tufts.push([squareX(s) + (flip ? oz : ox), 0.005, squareZ(s) + (flip ? ox : oz)]);
    }
  }
  const moss = new InstancedMesh(tuft, mat("#6fae3f", { flat: true }), tufts.length);
  tufts.forEach(([x, y, z], i) => {
    const k = 0.7 + hash(i, 50) * 0.9;
    _q.setFromAxisAngle(_e.set(0, 1, 0), hash(i, 51) * 6);
    _m.compose(_p.set(x, y, z), _q, _s.set(k, k, k));
    moss.setMatrixAt(i, _m);
    moss.setColorAt(i, new Color(hash(i, 52) < 0.5 ? "#79b845" : "#5f9e3a"));
  });
  add(moss, false, true);

  // ------------------------------------------------------------ ponds
  const waterMats: ShaderMaterial[] = [];
  const pads: { o: Object3D; phase: number; y: number }[] = [];
  const padGeo = new CircleGeometry(0.17, 20, 0.35, Math.PI * 2 - 0.55);
  padGeo.rotateX(-Math.PI / 2);
  const petal = new SphereGeometry(0.05, 8, 6);
  petal.scale(0.7, 1.7, 0.45);
  petal.translate(0, 0.07, 0);
  const heart = new SphereGeometry(0.035, 8, 6);
  for (const x0 of [1, 4]) {
    const cx = squareX(sq(x0, 4)) + 0.5;
    const cz = squareZ(sq(x0, 4));
    // Stone lip round the basin, then the water inside
    mesh(slab(2.08, 3.08, 0.36, 0.22, 0.04), mat("#a99877"), cx, -0.085, cz, false, true);
    const water = new ShaderMaterial({
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uDeep: { value: new Color("#1ba7b5") },
        uShallow: { value: new Color("#7fe3d6") },
        uSize: { value: [1.94, 2.94] },
      },
    });
    waterMats.push(water);
    const plane = new Mesh(new PlaneGeometry(1.94, 2.94), water);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(cx, WATER_Y, cz);
    add(plane, false, false);
    // Lily pads near the square corners so a swimming rat stays clear
    for (let i = 0; i < 5; i++) {
      const px = cx + (i % 2 === 0 ? -1 : 1) * (0.62 + hash(x0, i) * 0.25);
      const pz = cz + (i - 2) * 0.62 + (hash(x0, i + 9) - 0.5) * 0.2;
      const pad = new Mesh(padGeo, mat(i % 3 === 0 ? "#4f9a3c" : "#62b04a", { double: true }));
      pad.position.set(px, WATER_Y + 0.012, pz);
      pad.rotation.y = hash(x0, i + 20) * 6;
      pad.scale.setScalar(0.8 + hash(x0, i + 30) * 0.6);
      add(pad, false, true);
      pads.push({ o: pad, phase: hash(x0, i + 40) * 6, y: pad.position.y });
      if (i === 1 || i === 4) {
        // A lotus on this pad
        const lotus = new Group();
        for (let k = 0; k < 7; k++) {
          const pm = new Mesh(petal, mat(k % 2 ? "#f6a6c8" : "#fbc4da"));
          pm.rotation.set(0.5, (k / 7) * Math.PI * 2, 0, "YXZ");
          lotus.add(pm);
        }
        const h = new Mesh(heart, mat("#ffd84a"));
        h.position.y = 0.04;
        lotus.add(h);
        lotus.position.set(0, 0.01, 0);
        pad.add(lotus);
      }
    }
  }

  // ------------------------------------------------------------ traps: bramble rings
  const ring = new TorusGeometry(0.33, 0.045, 6, 22);
  ring.rotateX(Math.PI / 2);
  const ring2 = new TorusGeometry(0.3, 0.03, 5, 18);
  ring2.rotateX(Math.PI / 2);
  const thorn = new ConeGeometry(0.022, 0.1, 4);
  const leaf = leafGeometry(0.14, 0.06);
  for (const side of [1, -1] as const) {
    for (const s of TRAPS[side]) {
      const x = squareX(s);
      const z = squareZ(s);
      const a = mesh(ring, mat("#6b4f2a", { flat: true }), x, 0.04, z);
      a.rotation.y = hash(s, 1);
      const b = mesh(ring2, mat("#4f6b2a", { flat: true }), x, 0.08, z);
      b.rotation.set(0.12, hash(s, 2) * 3, 0.08);
      for (let k = 0; k < 14; k++) {
        const ang = (k / 14) * Math.PI * 2 + hash(s, k) * 0.3;
        const t = new Mesh(thorn, mat("#e9dcb0"));
        t.position.set(x + Math.cos(ang) * 0.34, 0.07 + hash(s, k + 50) * 0.04, z + Math.sin(ang) * 0.34);
        // Point outward and a little up
        t.rotation.set(0, -ang, -Math.PI / 2 + 0.5);
        add(t, false, false);
      }
      for (let k = 0; k < 6; k++) {
        const ang = (k / 6) * Math.PI * 2 + hash(s, k + 70);
        const lf = new Mesh(leaf, mat("#5da23c", { double: true }));
        lf.position.set(x + Math.cos(ang) * 0.32, 0.08, z + Math.sin(ang) * 0.32);
        lf.rotation.set(-0.9, -ang + Math.PI / 2, 0, "YXZ");
        add(lf, false, false);
      }
    }
  }

  // ------------------------------------------------------------ dens: stone burrows with straw
  const stone = new DodecahedronGeometry(0.12, 0);
  const straw = new CylinderGeometry(0.008, 0.008, 0.26, 3);
  const nest = new TorusGeometry(0.2, 0.065, 6, 18);
  nest.rotateX(Math.PI / 2);
  const hole = new CircleGeometry(0.19, 18);
  hole.rotateX(-Math.PI / 2);
  const pole = new CylinderGeometry(0.018, 0.022, 0.75, 6);
  const flag = new PlaneGeometry(0.3, 0.2);
  flag.translate(0.15, 0, 0);
  for (const side of [1, -1] as const) {
    const s = DEN[side];
    const x = squareX(s);
    const z = squareZ(s);
    // The burrow mouth faces the board; the stones arch round the back
    const back = side; // red's den is at +z: its back is +z
    mesh(hole, mat("#2e2015"), x, 0.004, z, false, false);
    mesh(nest, mat("#e2bf62", { flat: true }), x, 0.05, z, true, true);
    for (let k = 0; k < 16; k++) {
      const st = new Mesh(straw, mat(k % 2 ? "#f0d47f" : "#d9b45a"));
      const ang = hash(s, k) * Math.PI * 2;
      st.position.set(x + Math.cos(ang) * 0.17, 0.08, z + Math.sin(ang) * 0.17);
      st.rotation.set(Math.PI / 2 - 0.25, ang + hash(s, k + 20) * 1.2, 0, "YXZ");
      add(st, false, false);
    }
    for (let k = 0; k < 11; k++) {
      const ang = Math.PI * (k / 10); // a half circle
      const r = 0.42;
      const h = Math.sin(ang) * 0.42; // stones climb into an arch
      const st = new Mesh(stone, mat(hash(s, k + 40) < 0.35 ? "#7f9b62" : "#9a9a8a", { flat: true }));
      st.position.set(x + Math.cos(ang) * r, 0.06 + h * 0.75, z + back * (0.22 + Math.sin(ang) * 0.12));
      st.scale.setScalar(0.85 + hash(s, k + 60) * 0.5);
      st.rotation.set(hash(s, k + 80) * 3, hash(s, k + 90) * 3, 0);
      add(st, true, true);
    }
    // A pennant in the side's colour beside the burrow
    const px = x + 0.55;
    const pz = z + back * 0.3;
    mesh(pole, mat("#7a5634"), px, 0.37, pz);
    const fl = mesh(flag, mat(side === 1 ? RED_HEX : BLUE_HEX, { double: true }), px, 0.62, pz);
    fl.rotation.y = side === 1 ? 0.3 : Math.PI + 0.3;
  }

  // ------------------------------------------------------------ jungle round the rim
  const frond = leafGeometry(1.0, 0.24);
  const bigLeaf = leafGeometry(0.75, 0.42);
  const fernLeaf = leafGeometry(0.55, 0.12);
  const trunkSeg = new CylinderGeometry(0.1, 0.13, 0.5, 7);
  const bushBall = new IcosahedronGeometry(0.35, 1);
  const flower = new SphereGeometry(0.06, 6, 5);
  const greens = ["#3f8f3a", "#4fa544", "#2f7a35", "#5cb84a"];

  const palm = (x: number, z: number, h: number, lean: number) => {
    const g = new Group();
    let y = 0;
    let ox = 0;
    const segs = Math.round(h / 0.45);
    for (let i = 0; i < segs; i++) {
      const t = new Mesh(trunkSeg, mat(i % 2 ? "#8b6a45" : "#9c7a52", { flat: true }));
      ox = lean * (i / segs) ** 2;
      t.position.set(ox, y + 0.25, 0);
      t.rotation.z = -lean * 0.25;
      t.castShadow = true;
      g.add(t);
      y += 0.45;
    }
    for (let k = 0; k < 8; k++) {
      const f = new Mesh(frond, mat(greens[k % greens.length], { double: true }));
      f.position.set(ox, y, 0);
      f.rotation.set(-Math.PI / 2 + 0.2 + hash(k, 7) * 0.3, (k / 8) * Math.PI * 2, 0, "YXZ");
      f.castShadow = true;
      g.add(f);
    }
    g.position.set(x, GRASS_Y, z);
    g.rotation.y = Math.atan2(-x, -z) + Math.PI / 2;
    group.add(g);
  };

  const fern = (x: number, z: number, size: number, seed: number) => {
    const g = new Group();
    const n = 7;
    for (let k = 0; k < n; k++) {
      const f = new Mesh(fernLeaf, mat(greens[(k + seed) % greens.length], { double: true }));
      f.rotation.set(-Math.PI / 2 + 0.9 + hash(seed, k) * 0.3, (k / n) * Math.PI * 2 + hash(seed, k + 9), 0, "YXZ");
      f.castShadow = true;
      g.add(f);
    }
    g.scale.setScalar(size);
    g.position.set(x, GRASS_Y + 0.02, z);
    group.add(g);
  };

  const monstera = (x: number, z: number, size: number, seed: number) => {
    const g = new Group();
    for (let k = 0; k < 4; k++) {
      const f = new Mesh(bigLeaf, mat(k % 2 ? "#2f8a3e" : "#3c9b47", { double: true }));
      f.rotation.set(-Math.PI / 2 + 0.55 + hash(seed, k) * 0.4, (k / 4) * Math.PI * 2 + hash(seed, k + 4), 0, "YXZ");
      f.position.y = 0.05 + k * 0.04;
      f.castShadow = true;
      g.add(f);
    }
    g.scale.setScalar(size);
    g.position.set(x, GRASS_Y, z);
    group.add(g);
  };

  const bush = (x: number, z: number, size: number, seed: number) => {
    const g = new Group();
    for (let k = 0; k < 3; k++) {
      const b = new Mesh(bushBall, mat(greens[(seed + k) % greens.length], { flat: true }));
      b.position.set((hash(seed, k) - 0.5) * 0.5, 0.18 + hash(seed, k + 3) * 0.1, (hash(seed, k + 6) - 0.5) * 0.4);
      b.scale.setScalar(0.7 + hash(seed, k + 9) * 0.4);
      b.castShadow = true;
      g.add(b);
    }
    const colors = ["#ff7aa8", "#ffb347", "#fff07a", "#ff6b5a"];
    for (let k = 0; k < 5; k++) {
      const f = new Mesh(flower, mat(colors[(seed + k) % colors.length]));
      const a = hash(seed, k + 20) * Math.PI * 2;
      f.position.set(Math.cos(a) * 0.32, 0.25 + hash(seed, k + 30) * 0.25, Math.sin(a) * 0.3);
      g.add(f);
    }
    g.scale.setScalar(size);
    g.position.set(x, GRASS_Y, z);
    group.add(g);
  };

  const ex = BW / 2 + 0.55; // just off the board's long sides
  const ez = BD / 2 + 0.55; // just off its short ends
  // Tall palms only at the four corners, so they never hide the squares
  palm(-ex - 0.2, -ez - 0.1, 2.2, 0.5);
  palm(ex + 0.25, -ez + 0.2, 2.6, -0.4);
  palm(-ex - 0.1, ez + 0.2, 1.8, -0.3);
  palm(ex + 0.2, ez + 0.15, 2.0, 0.45);
  // Big leaves along the long sides, low bushes and ferns at both ends
  for (let i = 0; i < 5; i++) {
    const z = -3.6 + i * 1.8 + (hash(i, 1) - 0.5) * 0.5;
    monstera(-ex - 0.05 - hash(i, 2) * 0.3, z, 0.8 + hash(i, 3) * 0.5, i);
    monstera(ex + 0.05 + hash(i, 4) * 0.3, z + 0.7, 0.8 + hash(i, 5) * 0.5, i + 10);
  }
  for (let i = 0; i < 6; i++) {
    const x = -3.4 + i * 1.36 + (hash(i, 6) - 0.5) * 0.4;
    for (const end of [-1, 1]) {
      const z = end * (ez + 0.05 + hash(i, 7 + end) * 0.25);
      if ((i + (end > 0 ? 1 : 0)) % 2 === 0) bush(x, z, 0.55 + hash(i, 8) * 0.25, i + (end > 0 ? 20 : 0));
      else fern(x, z, 0.7 + hash(i, 9) * 0.4, i + 30);
    }
  }
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1;
    fern(side * (ex + 0.6 + hash(i, 40) * 0.3), -4 + i * 1.6, 0.6 + hash(i, 41) * 0.3, i + 50);
  }
  // Pebbles in the grass
  for (let i = 0; i < 16; i++) {
    const a = hash(i, 60) * Math.PI * 2;
    const r = 0.5 + hash(i, 61) * 0.6;
    const x = Math.cos(a) > 0 ? ex + r * 0.6 : -ex - r * 0.6;
    const o = mesh(rock, mat("#b5a993", { flat: true }), x, GRASS_Y + 0.02, (hash(i, 62) - 0.5) * BD, true, true);
    o.scale.setScalar(0.18 + hash(i, 63) * 0.18);
  }

  return {
    group,
    animate(t: number) {
      for (const w of waterMats) w.uniforms.uTime.value = t;
      for (const p of pads) {
        p.o.position.y = p.y + Math.sin(t * 1.4 + p.phase) * 0.008;
        p.o.rotation.y += Math.sin(t * 0.5 + p.phase) * 0.0006;
      }
    },
    dispose() {
      const geos = new Set<BufferGeometry>();
      group.traverse((o) => {
        const m = o as Mesh;
        if (m.geometry) geos.add(m.geometry);
      });
      for (const g of geos) g.dispose();
      for (const m of mats.std.values()) m.dispose();
      for (const w of waterMats) w.dispose();
      tiles.dispose();
      moss.dispose();
    },
  };
}
