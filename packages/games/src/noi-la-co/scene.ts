// The three.js side of Nói Là Có: one WebGL canvas under the engine's 2D stage,
// a perspective camera the shell steers (behind your villager, or over the
// whole bank), and everything else drawn from the rules' state.
//
// Kept light on purpose, so a cheap phone holds its frame rate:
// - the sandbank is ONE merged mesh, built once per map; a ground word only
//   repaints its top faces;
// - trees, grass, reeds, pebbles and clouds are static instanced meshes,
//   filled once, their density set by the quality level;
// - everything that moves goes into a handful of InstancedMeshes per frame;
// - three quality levels (pixel ratio, shadow map, decoration, view distance),
//   which the shell picks and lowers when frames run slow.
import {
  type BufferGeometry,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Float32BufferAttribute,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  type Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { GRID, HAY_TOP, HUT_FLOOR, LEVEL_Y, PALETTE as P, SEATS, SEAT_COLORS, T, TREE } from "./config";
import {
  HIP_X,
  HIP_Y,
  NECK_Y,
  SHOULDER_X,
  SHOULDER_Y,
  bananaModel,
  bombModel,
  buffaloModel,
  cloudModel,
  crocModel,
  dragonHeadModel,
  ghostModel,
  haystackModel,
  hutModel,
  kiteModel,
  medkitModel,
  reedModel,
  treeModel,
  tuftModel,
  villagerParts,
} from "./models";
import { type Hazard, type State, fireStrip, ground, groundAt, hash, lavaAt, lavaPhase, onOil, waveTravel } from "./sim";

// ---------------------------------------------------------------- quality

export type Quality = 0 | 1 | 2;

interface QualitySpec {
  /** Highest device pixel ratio drawn. */
  dpr: number;
  /** Shadow map size, 0 for no shadows. */
  shadows: number;
  /** Share of the possible grass tufts, reeds and pebbles placed. */
  decor: number;
  /** Fog end: nothing further is worth drawing. */
  far: number;
  clouds: number;
}

export const QUALITY: readonly QualitySpec[] = [
  { dpr: 1, shadows: 0, decor: 0.25, far: 40, clouds: 3 },
  { dpr: 1.5, shadows: 1024, decor: 0.6, far: 55, clouds: 6 },
  { dpr: 2, shadows: 2048, decor: 1, far: 70, clouds: 10 },
];

/** A first guess from what the browser says about the device; the shell lowers it if frames run slow. */
export function guessQuality(): Quality {
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = (navigator as { deviceMemory?: number }).deviceMemory ?? 4;
  const touch = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  if (cores <= 4 || memory <= 2) return 0;
  return touch ? 1 : 2;
}

// ---------------------------------------------------------------- what the shell hands over

/** A player as the shell wants it drawn, in world units. */
export interface Actor {
  seat: number;
  x: number;
  y: number;
  z: number;
  rotY: number;
  scale: number;
  /** 0..1: how hard they are running, for the stride. */
  speed: number;
  air: boolean;
  /** Lying down: asleep or knocked over. */
  lie: boolean;
  show: boolean;
  ghost: boolean;
  kite: boolean;
}

/** A glowing cube: sparks, splashes, embers. */
export interface Particle {
  x: number;
  y: number;
  z: number;
  size: number;
  color: Color;
}

/** Where the camera looks from: around a point, turned by yaw, raised by pitch. */
export interface View {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  dist: number;
}

export interface Frame {
  clock: number;
  /** 0 = day, 1 = the dark word. */
  dark: number;
  view: View;
  actors: readonly Actor[];
  /** Where the golden pillar over the writer stands. */
  writer: { x: number; y: number; z: number } | null;
  particles: readonly Particle[];
  /** Lightning that has just struck: world x, z and 1 → 0 as it fades. */
  bolts: readonly { x: number; z: number; k: number }[];
}

const UP = new Vector3(0, 1, 0);
const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();
const _c = new Color();
const HALF = GRID / 2;
/** Rules (x, y) → world x and z: the sandbank is centred on the origin. */
const wx = (x: number) => x - HALF;
const wz = (y: number) => y - HALF;
/** Where the columns of the bank start, under the water. */
const BASE = -1.4;
export const WATER_Y = -0.15;

/** One InstancedMesh, refilled from scratch every frame (or filled once and left). */
class Pool {
  readonly mesh: InstancedMesh;
  private n = 0;

  constructor(
    geometry: BufferGeometry,
    material: Material,
    private cap: number,
    shadows: "cast" | "receive" | "none" = "cast",
  ) {
    this.mesh = new InstancedMesh(geometry, material, cap);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = shadows === "cast";
    this.mesh.receiveShadow = shadows !== "none";
  }

  add(x: number, y: number, z: number, rotY = 0, sx = 1, sy = 1, sz = 1, color?: Color | number) {
    if (this.n >= this.cap) return;
    _q.setFromAxisAngle(UP, rotY);
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    this.mesh.setMatrixAt(this.n, _m);
    if (color !== undefined) this.mesh.setColorAt(this.n, typeof color === "number" ? _c.set(color) : color);
    this.n++;
  }

  flush() {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.n = 0;
  }
}

/** A villager's jointed body, plus the ghost and the kite that stand in for it. */
interface Body {
  root: Group;
  figure: Group;
  armL: Mesh;
  armR: Mesh;
  legL: Mesh;
  legR: Mesh;
  kite: Mesh;
  ghost: Mesh;
}

const SUN_OFFSET = new Vector3(-8, 16, 6);

export class Scene3D {
  readonly canvas: HTMLCanvasElement;
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(55, 0.5, 0.1, 140);
  private sun = new DirectionalLight();
  private hemi = new HemisphereLight();
  private fog = new Fog(P.sky, 30, 70);
  private sky = new Color();
  private quality: Quality;
  private width = 1;
  private height = 1;
  private dpr = 1;
  /** Vertex-coloured models; white cubes tinted per instance; unlit glow; see-through glow. */
  private material = new MeshLambertMaterial({ vertexColors: true });
  private tintMaterial = new MeshLambertMaterial();
  private glowMaterial = new MeshBasicMaterial({ color: 0xffffff, fog: false });
  private beamMaterial = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false, fog: false });
  private discMaterial = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false });
  private floodMaterial = new MeshLambertMaterial({ color: P.water, transparent: true, opacity: 0.62, depthWrite: false });
  private seaMaterial = new MeshLambertMaterial({ color: P.river, transparent: true, opacity: 0.88 });
  private ghostMaterial = new MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false });
  private pools = new Map<string, Pool>();
  private tint: Pool;
  private glow: Pool;
  private beam: Pool;
  private disc: Pool;
  private flood: Mesh;
  private wave: Mesh;
  private sea: Mesh;
  private bodies: Body[] = [];
  private geometries: BufferGeometry[] = [];
  // the static world, rebuilt only for a new map, a ground word or a quality change
  private terrain: Mesh | null = null;
  private terrainSeed = Number.NaN;
  private terrainGround: string | null = "";
  private statics: Pool[] = [];
  private staticsKey = "";

  constructor(quality: Quality) {
    this.quality = quality;
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none";
    this.renderer = new WebGLRenderer({ canvas: this.canvas, antialias: quality > 0, powerPreference: "high-performance" });
    this.renderer.shadowMap.type = PCFShadowMap;

    this.scene.background = this.sky;
    this.scene.fog = this.fog;
    const sc = this.sun.shadow.camera;
    sc.left = -16;
    sc.right = 16;
    sc.top = 16;
    sc.bottom = -16;
    sc.near = 1;
    sc.far = 60;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.hemi, this.sun, this.sun.target);

    const cube = this.keep(new BoxGeometry(1, 1, 1));
    this.tint = new Pool(cube, this.tintMaterial, 900);
    this.glow = new Pool(cube, this.glowMaterial, 900, "none");
    this.beam = new Pool(cube, this.beamMaterial, 120, "none");
    this.disc = new Pool(this.keep(new CylinderGeometry(1, 1, 0.02, 24)), this.discMaterial, 160, "none");
    this.disc.mesh.renderOrder = 3;
    this.beam.mesh.renderOrder = 4;
    this.scene.add(this.tint.mesh, this.glow.mesh, this.beam.mesh, this.disc.mesh);

    this.pool("buffalo", buffaloModel(), 2);
    this.pool("croc", crocModel(), 8);
    this.pool("dragon", dragonHeadModel(), 2);
    this.pool("bomb", bombModel(), 14);
    this.pool("banana", bananaModel(), 48);
    this.pool("medkit", medkitModel(), 6);
    this.pool("hut", hutModel(HUT_FLOOR), 2);
    this.pool("haystack", haystackModel(HAY_TOP), 4);

    this.sea = new Mesh(this.keep(new PlaneGeometry(400, 400).rotateX(-Math.PI / 2)), this.seaMaterial);
    this.sea.position.y = WATER_Y;
    this.sea.receiveShadow = true;
    this.flood = new Mesh(cube, this.floodMaterial);
    this.flood.renderOrder = 1;
    this.wave = new Mesh(cube, this.floodMaterial);
    this.wave.renderOrder = 1;
    this.scene.add(this.sea, this.flood, this.wave);

    const ghost = this.keep(ghostModel());
    const kite = this.keep(kiteModel());
    for (let seat = 0; seat < SEATS; seat++) this.bodies.push(this.body(seat, ghost, kite));
    this.setQuality(quality);
  }

  private keep<G extends BufferGeometry>(g: G): G {
    this.geometries.push(g);
    return g;
  }

  private pool(key: string, geometry: BufferGeometry, cap: number) {
    const p = new Pool(this.keep(geometry), this.material, cap);
    this.pools.set(key, p);
    this.scene.add(p.mesh);
  }

  private add(key: string, x: number, y: number, z: number, rotY = 0, scale = 1) {
    this.pools.get(key)?.add(x, y, z, rotY, scale, scale, scale);
  }

  private body(seat: number, ghostGeometry: BufferGeometry, kiteGeometry: BufferGeometry): Body {
    const parts = villagerParts(SEAT_COLORS[seat % SEAT_COLORS.length], seat);
    for (const g of Object.values(parts)) this.keep(g);
    const part = (g: BufferGeometry, x: number, y: number) => {
      const m = new Mesh(g, this.material);
      m.position.set(x, y, 0);
      m.castShadow = true;
      return m;
    };
    const figure = new Group();
    const armL = part(parts.arm, SHOULDER_X, SHOULDER_Y);
    const armR = part(parts.arm, -SHOULDER_X, SHOULDER_Y);
    const legL = part(parts.leg, HIP_X, HIP_Y);
    const legR = part(parts.leg, -HIP_X, HIP_Y);
    figure.add(part(parts.torso, 0, HIP_Y), part(parts.head, 0, NECK_Y), armL, armR, legL, legR);
    const kite = new Mesh(kiteGeometry, this.material);
    kite.position.y = 1.1;
    kite.scale.setScalar(1.6);
    const ghost = new Mesh(ghostGeometry, this.ghostMaterial);
    ghost.scale.setScalar(1.6);
    ghost.renderOrder = 2;
    const root = new Group();
    root.add(figure, kite, ghost);
    this.scene.add(root);
    return { root, figure, armL, armR, legL, legR, kite, ghost };
  }

  /** Change the quality level: pixel ratio, shadows, decoration and view distance. */
  setQuality(q: Quality) {
    this.quality = q;
    const spec = QUALITY[q];
    const shadows = spec.shadows > 0;
    this.renderer.shadowMap.enabled = shadows;
    this.sun.castShadow = shadows;
    if (shadows && this.sun.shadow.mapSize.x !== spec.shadows) {
      this.sun.shadow.mapSize.set(spec.shadows, spec.shadows);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    for (const m of [this.material, this.tintMaterial, this.seaMaterial, this.ghostMaterial, this.floodMaterial]) m.needsUpdate = true;
    this.camera.far = spec.far + 10;
    this.staticsKey = "";
    this.applySize();
  }

  get level(): Quality {
    return this.quality;
  }

  /** A world point on screen, as 0..1 of the canvas from its top-left (null behind the camera). */
  project(x: number, y: number, z: number): { x: number; y: number } | null {
    const v = _p.set(x, y, z).project(this.camera);
    if (v.z < -1 || v.z > 1) return null;
    return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
  }

  /** Match the root's CSS size. */
  resize(width: number, height: number, dpr: number) {
    if (width <= 0 || height <= 0) return;
    this.width = width;
    this.height = height;
    this.dpr = dpr || 1;
    this.applySize();
  }

  private applySize() {
    this.renderer.setPixelRatio(Math.min(this.dpr, QUALITY[this.quality].dpr));
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    // A tall phone gets a wider lens, so the sides are not cut too close
    this.camera.fov = this.camera.aspect < 0.7 ? 62 : 52;
    this.camera.updateProjectionMatrix();
  }

  render(s: State, f: Frame) {
    this.light(f.dark);
    this.world(s);
    this.look(s, f.view);
    this.flood.visible = false;
    this.wave.visible = false;
    for (const hz of s.hazards) this.hazard(s, hz, f);
    if (s.storm) this.marks(s, s.storm, T.lightning.radius, P.bolt, f, false);
    this.overlays(s, f);

    for (let seat = 0; seat < SEATS; seat++) this.pose(this.bodies[seat], f.actors.find((a) => a.seat === seat), f.clock);
    if (f.writer) {
      const w = f.writer;
      this.beam.add(w.x, w.y + 6, w.z, 0, 0.6, 12, 0.6, P.gold);
      this.glow.add(w.x, w.y + 2.3 + Math.sin(f.clock * 5) * 0.1, w.z, f.clock * 3, 0.22, 0.22, 0.22, P.gold);
    }
    for (const b of f.bolts) {
      for (let i = 0; i < 7; i++) {
        const jx = hash(i, Math.round(b.x * 31)) - 0.5;
        const jz = hash(i + 9, Math.round(b.z * 17)) - 0.5;
        this.glow.add(b.x + jx * 0.5, 0.6 + i * 1.6, b.z + jz * 0.3, 0, 0.18 * b.k + 0.06, 1.7, 0.18 * b.k + 0.06, P.bolt);
      }
    }
    for (const p of f.particles) this.glow.add(p.x, p.y, p.z, 0, p.size, p.size, p.size, p.color);

    for (const p of this.pools.values()) p.flush();
    this.tint.flush();
    this.glow.flush();
    this.beam.flush();
    this.disc.flush();
    this.renderer.render(this.scene, this.camera);
  }

  // ---------------------------------------------------------------- camera and light

  private look(s: State, v: View) {
    // Something in the way (a hillside behind you, a tree's leaves): first try looking from
    // higher up, and only if that is blocked too bring the camera in front of it
    let pitch = v.pitch;
    let dist = this.clear(s, v, pitch);
    for (let p = v.pitch + 0.2; dist < v.dist * 0.85 && p <= 1.3; p += 0.2) {
      const d = this.clear(s, v, p);
      if (d > dist) {
        pitch = p;
        dist = d;
      }
    }
    const cp = Math.cos(pitch);
    this.camera.position.set(v.x + Math.sin(v.yaw) * cp * dist, v.y + Math.sin(pitch) * dist, v.z + Math.cos(v.yaw) * cp * dist);
    this.camera.lookAt(v.x, v.y, v.z);
    this.sun.position.set(v.x + SUN_OFFSET.x, SUN_OFFSET.y, v.z + SUN_OFFSET.z);
    this.sun.target.position.set(v.x, 0, v.z);
  }

  /** How far back the camera can sit at this pitch before ground or leaves get in the way. */
  private clear(s: State, v: View, pitch: number) {
    const cp = Math.cos(pitch);
    const dx = Math.sin(v.yaw) * cp;
    const dy = Math.sin(pitch);
    const dz = Math.cos(v.yaw) * cp;
    for (let d = 0.6; d < v.dist; d += 0.25) {
      const rx = v.x + dx * d + HALF;
      const rz = v.z + dz * d + HALF;
      if (rx < 0 || rz < 0 || rx >= GRID || rz >= GRID) break;
      const y = v.y + dy * d;
      if (y < groundAt(s, rx, rz) + 0.3 || (y > 2 && y < 4.7 && this.underCanopy(s, rx, rz))) return Math.max(2.5, d - 0.5);
    }
    return v.dist;
  }

  /** Within the leaves of a tree (they spread a tile past the trunk's own). */
  private underCanopy(s: State, x: number, z: number) {
    const tx = Math.floor(x);
    const tz = Math.floor(z);
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const n = tx + i;
        const m = tz + j;
        if (n < 0 || m < 0 || n >= GRID || m >= GRID || s.h[m * GRID + n] !== TREE) continue;
        if (Math.abs(x - (n + 0.5)) < 1.2 && Math.abs(z - (m + 0.5)) < 1.2) return true;
      }
    }
    return false;
  }

  private light(dark: number) {
    this.sky.set(P.sky).lerp(_c.set(P.skyDark), dark * 0.9);
    this.fog.color.copy(this.sky);
    const far = QUALITY[this.quality].far;
    this.fog.near = far * 0.55;
    this.fog.far = far;
    this.seaMaterial.color.set(P.river).lerp(_c.set(P.skyDark), dark * 0.6);
    this.sun.color.set(0xfff2d8).lerp(_c.set(0x8fa0ff), dark);
    this.sun.intensity = 2.4 - dark * 1.8;
    this.hemi.color.set(0xdff2ff).lerp(_c.set(0x39407a), dark);
    this.hemi.groundColor.set(0x8a7a5a).lerp(_c.set(0x15142a), dark);
    this.hemi.intensity = 1.3 - dark * 0.8;
  }

  // ---------------------------------------------------------------- the static world

  private world(s: State) {
    if (this.terrainSeed !== s.seed0) {
      this.buildTerrain(s);
      this.terrainSeed = s.seed0;
      this.terrainGround = "";
      this.staticsKey = "";
    }
    const word = ground(s);
    if (word !== this.terrainGround) {
      this.paintTerrain(s, word);
      this.terrainGround = word;
    }
    const key = `${s.seed0}:${this.quality}`;
    if (key !== this.staticsKey) {
      this.buildStatics(s);
      this.staticsKey = key;
    }
  }

  /** The whole sandbank as one mesh: a column per tile from below the water up to its top. */
  private buildTerrain(s: State) {
    if (this.terrain) {
      this.scene.remove(this.terrain);
      this.terrain.geometry.dispose();
    }
    const boxes: BufferGeometry[] = [];
    for (let i = 0; i < GRID * GRID; i++) {
      const level = s.h[i] ?? 1;
      const top = LEVEL_Y[level === TREE ? 1 : level];
      const g = new BoxGeometry(1, top - BASE, 1);
      g.deleteAttribute("uv");
      g.translate(wx((i % GRID) + 0.5), (top + BASE) / 2, wz(Math.floor(i / GRID) + 0.5));
      boxes.push(g);
    }
    const merged = mergeGeometries(boxes, false);
    for (const g of boxes) g.dispose();
    if (!merged) return;
    merged.setAttribute("color", new Float32BufferAttribute(new Float32Array(merged.getAttribute("position").count * 3), 3));
    this.terrain = new Mesh(merged, this.material);
    this.terrain.receiveShadow = true;
    this.terrain.castShadow = true;
    this.scene.add(this.terrain);
  }

  /** Colour every tile: its level, a light checker, and the ground word on the tops. */
  private paintTerrain(s: State, word: string | null) {
    const color = this.terrain?.geometry.getAttribute("color");
    if (!color) return;
    // BoxGeometry lays out 24 vertices per box: +x, -x, +y, -y, +z, -z, four each
    for (let i = 0; i < GRID * GRID; i++) {
      const level = s.h[i] ?? 1;
      const odd = ((i % GRID) + Math.floor(i / GRID)) % 2 === 1;
      const tone = 0.95 + hash(s.seed0, i) * 0.07;
      let top: number = level === 0 ? P.sand : level === 2 ? P.hill : level === 3 ? P.hilltop : odd ? P.grassA : P.grassB;
      let side: number = level === 0 ? P.sandSide : P.grassSide;
      if (word === "sa-mac") {
        top = odd ? P.desert : P.sand;
        side = P.sandSide;
      } else if (word === "bang") {
        top = odd ? P.ice : 0xe6f7ff;
        side = 0x9ccbe0;
      } else if (word === "dam-lay" && level < 2) top = odd ? P.swamp : 0x5f5e33;
      for (let v = 0; v < 24; v++) {
        const face = Math.floor(v / 4);
        _c.set(face === 2 ? top : side).multiplyScalar(face === 2 ? tone : 0.92);
        color.setXYZ(i * 24 + v, _c.r, _c.g, _c.b);
      }
    }
    color.needsUpdate = true;
  }

  /** Trees, grass tufts, reeds, pebbles and clouds: filled once for the map and quality. */
  private buildStatics(s: State) {
    for (const p of this.statics) {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.dispose();
    }
    this.statics = [];
    const spec = QUALITY[this.quality];
    const make = (geometry: BufferGeometry, cap: number, shadows: "cast" | "none") => {
      const p = new Pool(geometry, this.material, Math.max(1, cap), shadows);
      this.statics.push(p);
      this.scene.add(p.mesh);
      return p;
    };
    const trees = make(treeModel(), 16, "cast");
    const tufts = [make(tuftModel(0), 300, "none"), make(tuftModel(1), 100, "none"), make(tuftModel(2), 60, "cast")];
    const reeds = make(reedModel(), 100, "none");
    for (let i = 0; i < GRID * GRID; i++) {
      const level = s.h[i] ?? 1;
      const x = wx((i % GRID) + 0.5);
      const z = wz(Math.floor(i / GRID) + 0.5);
      const roll = hash(s.seed0 + 31, i);
      if (level === TREE) trees.add(x, LEVEL_Y[1], z, hash(i, 4) * 6);
      else if (level === 0) {
        if (roll < 0.18 * spec.decor) reeds.add(x + (hash(i, 3) - 0.5) * 0.6, LEVEL_Y[0], z + (hash(i, 5) - 0.5) * 0.6, hash(i, 7) * 6, 1.3, 1.3, 1.3);
      } else if (roll < 0.55 * spec.decor) {
        const kind = roll < 0.4 * spec.decor ? 0 : roll < 0.5 * spec.decor ? 1 : 2;
        tufts[kind].add(x + (hash(i, 3) - 0.5) * 0.7, LEVEL_Y[level], z + (hash(i, 5) - 0.5) * 0.7, hash(i, 7) * 6, 1.4, 1.4, 1.4);
      }
    }
    const clouds = make(cloudModel(), spec.clouds, "none");
    for (let i = 0; i < spec.clouds; i++) {
      const a = (i / spec.clouds) * Math.PI * 2 + hash(s.seed0, i) * 0.6;
      const r = GRID * 0.95 + hash(i, 2) * GRID * 0.4;
      clouds.add(Math.cos(a) * r, 10 + hash(i, 3) * 5, Math.sin(a) * r, a, 1.6, 1, 1.6);
    }
    for (const p of this.statics) p.flush();
  }

  // ---------------------------------------------------------------- per frame: ground overlays

  private overlays(s: State, f: Frame) {
    const lava = s.hazards.find((h) => h.word === "dung-nham");
    const phase = lava ? lavaPhase(lava) : null;
    const oil = s.hazards.some((h) => h.word === "dau");
    if (!lava && !oil) return;
    for (let ty = 0; ty < GRID; ty++) {
      for (let tx = 0; tx < GRID; tx++) {
        const top = groundAt(s, tx + 0.5, ty + 0.5);
        const x = wx(tx + 0.5);
        const z = wz(ty + 0.5);
        if (oil && onOil(s, tx + 0.5, ty + 0.5)) this.tint.add(x, top + 0.012, z, 0, 0.98, 0.024, 0.98, P.oil);
        if (lava && phase && lavaAt(s, lava, tx, ty)) {
          if (!phase.warn) {
            const flick = 0.85 + 0.15 * Math.sin(f.clock * 8 + tx * 1.3 + ty * 2.1);
            this.glow.add(x, top + 0.03, z, 0, 0.96, 0.06, 0.96, _c.set(P.lava).multiplyScalar(flick));
          } else if (Math.floor(f.clock * (phase.k > 0.6 ? 9 : 4)) % 2 === 0) this.glow.add(x, top + 0.02, z, 0, 0.7, 0.03, 0.7, P.lavaWarn);
        }
      }
    }
  }

  // ---------------------------------------------------------------- villagers

  private pose(b: Body, a: Actor | undefined, clock: number) {
    b.root.visible = !!a && a.show;
    if (!a || !a.show) return;
    b.root.position.set(a.x, a.y, a.z);
    b.root.rotation.set(0, a.rotY, 0);
    b.root.scale.setScalar(a.scale);
    b.figure.visible = !a.ghost;
    b.ghost.visible = a.ghost;
    b.kite.visible = a.kite && !a.ghost;
    if (a.ghost) return;
    const stride = Math.sin(clock * 11 + a.seat) * a.speed;
    if (a.air || a.kite) {
      // Arms up, one knee forward: the jump pose (and hanging from the kite)
      b.armL.rotation.set(-2.6, 0, -0.2);
      b.armR.rotation.set(-2.6, 0, 0.2);
      b.legL.rotation.set(-0.5, 0, 0);
      b.legR.rotation.set(0.15, 0, 0);
    } else {
      b.armL.rotation.set(stride * 0.8, 0, 0);
      b.armR.rotation.set(-stride * 0.8, 0, 0);
      b.legL.rotation.set(-stride * 0.75, 0, 0);
      b.legR.rotation.set(stride * 0.75, 0, 0);
    }
    if (a.lie) {
      b.figure.rotation.set(-Math.PI / 2, 0, 0);
      b.figure.position.set(0, 0.2, -0.6);
    } else {
      b.figure.rotation.set(0, 0, 0);
      b.figure.position.set(0, a.speed > 0.2 && !a.air ? Math.abs(Math.sin(clock * 11 + a.seat)) * 0.05 : 0, 0);
    }
  }

  // ---------------------------------------------------------------- the words

  /** A flat strip from (x, y) along (dx, dy), at a height. */
  private strip(pool: Pool, x: number, y: number, dx: number, dy: number, len: number, width: number, height: number, thick: number, color: number) {
    pool.add(wx(x + (dx * len) / 2), height, wz(y + (dy * len) / 2), Math.atan2(dx, dy), width, thick, len, color);
  }

  private marks(s: State, hz: Hazard, radius: number, color: number, f: Frame, rockets: boolean) {
    for (const e of hz.ents) {
      const y = groundAt(s, e.x, e.y) + 0.05;
      const pulse = 0.75 + 0.25 * Math.sin(f.clock * 18);
      this.disc.add(wx(e.x), y, wz(e.y), 0, radius, 1, radius, color);
      this.disc.add(wx(e.x), y, wz(e.y), 0, radius * 0.35 * pulse, 1, radius * 0.35 * pulse, P.warn);
      if (rockets) this.glow.add(wx(e.x), y + 0.3 + e.t * 12, wz(e.y), 0, 0.16, 0.6, 0.16, P.cross);
    }
  }

  private hazard(s: State, hz: Hazard, f: Frame) {
    const t = f.clock;
    switch (hz.word) {
      case "lu": {
        const rise = Math.min(1, hz.t / T.flood.warn) * Math.min(1, Math.max(0, hz.dur - hz.t) / 1.2);
        const top = WATER_Y + (T.flood.level - WATER_Y) * rise + Math.sin(t * 2) * 0.012;
        this.flood.visible = true;
        this.flood.scale.set(GRID + 0.4, 1, GRID + 0.4);
        this.flood.position.set(0, top - 0.5, 0);
        break;
      }
      case "song-than": {
        const travel = waveTravel(hz);
        const growing = Math.min(1, Math.max(0, hz.t / T.tsunami.warn));
        const height = (travel < 0 ? 0.3 + growing * 0.7 : 1) * (T.tsunami.top + 0.15 - WATER_Y);
        const depth = Math.max(-1.5, travel);
        const alongX = hz.a < 2;
        const at = hz.a % 2 === 0 ? depth - HALF : HALF - depth;
        this.wave.visible = depth < GRID + 1.2;
        this.wave.scale.set(alongX ? 1.6 : GRID + 4, height, alongX ? GRID + 4 : 1.6);
        this.wave.position.set(alongX ? at : 0, WATER_Y + height / 2, alongX ? 0 : at);
        if (this.wave.visible) {
          for (let i = 0; i < 14; i++) {
            const across = -HALF - 2 + ((GRID + 4) * (i + 0.5)) / 14;
            const bob = Math.sin(t * 6 + i) * 0.12;
            this.glow.add(alongX ? at : across, WATER_Y + height + bob, alongX ? across : at, 0, 0.6, 0.3, 0.6, 0xffffff);
          }
        }
        break;
      }
      case "loc-xoay": {
        const e = hz.ents[0];
        const y0 = groundAt(s, e.x, e.y);
        for (let i = 0; i < 10; i++) {
          const w = 0.45 + i * 0.3;
          const sway = Math.sin(t * 5 + i * 0.7) * 0.06 * i;
          this.tint.add(wx(e.x) + sway, y0 + 0.4 + i * 0.5, wz(e.y) + Math.cos(t * 4 + i) * 0.04 * i, t * 7 + i * 0.6, w, 0.48, w, i % 2 ? P.tornado : 0xb8bcc8);
        }
        break;
      }
      case "sam-set":
        this.marks(s, hz, T.lightning.radius, P.bolt, f, false);
        break;
      case "phao-hoa":
        this.marks(s, hz, T.fireworks.radius, P.gold, f, true);
        break;
      case "ong":
        for (const [n, e] of hz.ents.entries()) {
          const y0 = groundAt(s, e.x, e.y);
          for (let i = 0; i < 12; i++) {
            const k = i + n * 12;
            this.glow.add(wx(e.x) + Math.sin(t * 7 + k * 1.7) * 0.4, y0 + 1 + Math.sin(t * 9 + k) * 0.3, wz(e.y) + Math.cos(t * 6 + k * 2.3) * 0.4, 0, 0.12, 0.12, 0.12, i % 3 ? P.bee : P.bomb);
          }
        }
        break;
      case "trau-dien": {
        const e = hz.ents[0];
        const hop = e.k === 1 ? Math.abs(Math.sin(t * 22)) * 0.12 : 0;
        const y0 = groundAt(s, e.x, e.y);
        this.add("buffalo", wx(e.x), y0 + hop, wz(e.y), Math.atan2(e.vx, e.vy), 1.3);
        if (e.k === 0 && e.t < T.buffalo.aim && Math.floor(t * (e.t < 0.5 ? 14 : 7)) % 2 === 0) this.strip(this.beam, e.x, e.y, e.vx, e.vy, GRID * 1.5, T.buffalo.hit * 2, y0 + 0.9, 0.04, P.warn);
        break;
      }
      case "ca-sau":
        for (const e of hz.ents) this.add("croc", wx(e.x), LEVEL_Y[0] + 0.02, wz(e.y), Math.atan2(Math.cos(e.k), Math.sin(e.k)), 1.3);
        break;
      case "rong": {
        const e = hz.ents[0];
        const strip = fireStrip(e);
        const heading = e.k === 0 ? Math.atan2(-Math.sin(hz.a), Math.cos(hz.a)) : Math.atan2(strip.dx, strip.dy);
        const fly = 6 + Math.sin(t * 2.4) * 0.3;
        this.add("dragon", wx(e.x), fly, wz(e.y), heading, 1.6);
        for (let i = 1; i <= 12; i++) {
          const a = hz.a - i * 0.09;
          const size = 1 - i * 0.055;
          this.tint.add(Math.cos(a) * T.dragon.orbit, fly + 0.25 + Math.sin(t * 5 - i * 0.8) * 0.3, Math.sin(a) * T.dragon.orbit, -a, size, size, size, i % 2 ? P.dragon : P.dragonBelly);
        }
        if (e.k === 1 && Math.floor(t * (e.t < 0.5 ? 14 : 7)) % 2 === 0) this.strip(this.beam, strip.x, strip.y, strip.dx, strip.dy, strip.len, T.dragon.half * 2, 1.2, 0.04, P.warn);
        if (e.k === 2) {
          this.strip(this.beam, strip.x, strip.y, strip.dx, strip.dy, strip.len, T.dragon.half * 2, 1.0, 2, P.lava);
          this.strip(this.glow, strip.x, strip.y, strip.dx, strip.dy, strip.len, T.dragon.half * 0.7, 0.9, 0.6 + Math.sin(t * 30) * 0.1, P.lavaWarn);
        }
        break;
      }
      case "bom":
        for (const e of hz.ents) {
          const y = groundAt(s, e.x, e.y);
          const on = Math.floor(t * (e.t < 0.8 ? 16 : 7)) % 2 === 0;
          this.add("bomb", wx(e.x), y, wz(e.y), 0, on ? 1.3 : 1.15);
          this.disc.add(wx(e.x), y + 0.05, wz(e.y), 0, T.bomb.radius, 1, T.bomb.radius, P.warn);
          if (on) this.glow.add(wx(e.x) + 0.04, y + 0.85, wz(e.y), 0, 0.1, 0.1, 0.1, P.lavaWarn);
        }
        break;
      case "vo-chuoi":
        for (const [i, e] of hz.ents.entries()) this.add("banana", wx(e.x), groundAt(s, e.x, e.y), wz(e.y), hash(hz.salt, i) * 6, 1.4);
        break;
      case "thuoc":
        for (const [i, e] of hz.ents.entries()) {
          const y = groundAt(s, e.x, e.y);
          this.add("medkit", wx(e.x), y + 0.3 + Math.sin(t * 3 + i) * 0.08, wz(e.y), t * 1.5, 1.3);
          this.disc.add(wx(e.x), y + 0.05, wz(e.y), 0, 0.55, 1, 0.55, 0x4ade80);
          this.beam.add(wx(e.x), y + 2, wz(e.y), 0, 0.12, 4, 0.12, 0x4ade80);
        }
        break;
      case "choi":
        this.add("hut", wx(hz.a + 1), 0, wz(hz.b + 1));
        break;
      case "dong-rom":
        for (const e of hz.ents) this.add("haystack", wx(e.x + 1), 0, wz(e.y + 1));
        break;
      default:
        break;
    }
  }

  dispose() {
    for (const g of this.geometries) g.dispose();
    this.terrain?.geometry.dispose();
    for (const p of this.statics) {
      p.mesh.geometry.dispose();
      p.mesh.dispose();
    }
    for (const p of this.pools.values()) p.mesh.dispose();
    for (const p of [this.tint, this.glow, this.beam, this.disc]) p.mesh.dispose();
    for (const m of [this.material, this.tintMaterial, this.glowMaterial, this.beamMaterial, this.discMaterial, this.floodMaterial, this.seaMaterial, this.ghostMaterial]) m.dispose();
    this.sun.shadow.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
