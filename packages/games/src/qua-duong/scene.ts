// The three.js side of Qua Đường: one WebGL canvas under the engine's 2D stage,
// lit by a sun and a sky, drawn immediate-mode each frame — every visible lane,
// mover and prop is pushed into an InstancedMesh per model, so a frame is a few
// dozen draw calls however busy the street gets. Owns and disposes every GPU
// resource it makes.
import {
  type BufferGeometry,
  BoxGeometry,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  InstancedMesh,
  type Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  OrthographicCamera,
  PCFShadowMap,
  Quaternion,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { HALF, LANE_HALF, PALETTE, type SkinId } from "./config";
import { type Lane, type State, laneAt, moverX, trainAt } from "./logic";
import {
  type GroundKind,
  baGacModel,
  bananaModel,
  busModel,
  coinModel,
  duckModel,
  foodCartModel,
  gheModel,
  groundModel,
  hedgeModel,
  houseModel,
  hyacinthModel,
  motoModel,
  officerModel,
  poleModel,
  raftModel,
  railPostModel,
  stoolModel,
  trainModel,
  wireModel,
} from "./models";

/** Where a character stands and how it is squashed, in world units. */
export interface Pose {
  x: number;
  y: number;
  z: number;
  rotY: number;
  sx: number;
  sy: number;
  sz: number;
}

/** A glowing cube: splash drops, feathers, sparkles. */
export interface Particle {
  x: number;
  y: number;
  z: number;
  size: number;
  color: Color;
}

/** Everything the shell animates that the rules don't know about. */
export interface Frame {
  /** World clock (the rules' time): movers are drawn where the rules have them. */
  time: number;
  /** 0 = day, 1 = dusk. */
  dusk: number;
  /** The point the camera looks at (x, row). */
  lookX: number;
  lookRow: number;
  duck: Pose | null;
  /** Other racers in an online race, drawn see-through. */
  ghosts?: readonly { pose: Pose; skin: SkinId }[];
  officer: Pose | null;
  particles: readonly Particle[];
}

const UP = new Vector3(0, 1, 0);
const _m = new Matrix4();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();

/** One InstancedMesh, refilled from scratch every frame. */
class Pool {
  readonly mesh: InstancedMesh;
  private n = 0;

  constructor(
    readonly geometry: BufferGeometry,
    material: Material,
    private cap: number,
    shadows: "cast" | "receive" | "none" = "cast",
  ) {
    this.mesh = new InstancedMesh(geometry, material, cap);
    this.mesh.count = 0;
    // Instances span the whole street: the geometry's own bounds mean nothing
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = shadows === "cast";
    this.mesh.receiveShadow = shadows !== "none";
  }

  add(x: number, y: number, z: number, rotY = 0, sx = 1, sy = 1, sz = 1, color?: Color) {
    if (this.n >= this.cap) return;
    _q.setFromAxisAngle(UP, rotY);
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    this.mesh.setMatrixAt(this.n, _m);
    if (color) this.mesh.setColorAt(this.n, color);
    this.n++;
  }

  flush() {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.n = 0;
  }
}

/** A stable 0..1 per (row, salt), for decoration the rules don't care about. */
function hash(row: number, salt: number) {
  let h = Math.imul(row ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}

const MOTO_LOOKS = [
  [PALETTE.motoRed, PALETTE.shirtGreen, PALETTE.helmetGreen],
  [PALETTE.motoBlue, PALETTE.shirtWhite, PALETTE.helmetBlue],
  [PALETTE.motoWhite, PALETTE.shirtPink, PALETTE.helmetPink],
  [PALETTE.motoRed, PALETTE.shirtWhite, PALETTE.helmetBlue],
] as const;

/** Camera offset from the point it looks at: a high 3/4 view from behind and a little right. */
const CAM_OFFSET = new Vector3(3.2, 13, 9);
const CAM_DIST = CAM_OFFSET.length();
/** Sun direction (towards the sun), from the left so shadows fall right and towards the camera. */
const SUN_OFFSET = new Vector3(-6, 14, 4);

const mix = (out: Color, a: number, b: number, k: number) => out.set(a).lerp(_tmp.set(b), k);
const _tmp = new Color();

export class Scene3D {
  readonly canvas: HTMLCanvasElement;
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new OrthographicCamera(-5, 5, 10, -10, 0.1, 120);
  private sun = new DirectionalLight();
  private hemi = new HemisphereLight();
  private fog = new Fog(0xffffff, 20, 40);
  private sky = new Color();
  private material = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
  private glowMaterial = new MeshBasicMaterial({ color: 0xffffff });
  private pools = new Map<string, Pool>();
  private glow: Pool;
  private duck: Mesh;
  private officer: Mesh;
  private ghostMaterial = new MeshLambertMaterial({ vertexColors: true, flatShading: true, transparent: true, opacity: 0.55, depthWrite: false });
  private ghostModels = new Map<SkinId, BufferGeometry>();
  private ghosts: Mesh[] = [];
  private skin: SkinId | null = null;
  private geometries: BufferGeometry[] = [];
  // scratch colours, reused every frame
  private lantern = new Color();
  private head = new Color();
  private lightOn = new Color(PALETTE.lightOn);
  private lightOff = new Color(PALETTE.lightOff);

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none";
    this.renderer = new WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;

    this.scene.background = this.sky;
    this.scene.fog = this.fog;
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -20;
    sc.right = 20;
    sc.top = 20;
    sc.bottom = -20;
    sc.near = 1;
    sc.far = 60;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 3;
    this.scene.add(this.hemi, this.sun, this.sun.target);

    const ground = (k: GroundKind) => this.pool(k, groundModel(k), 48, "receive");
    for (const k of ["grass-a", "grass-b", "road", "road-line", "river", "rail"] as const) ground(k);
    for (const [i, [body, shirt, helmet]] of MOTO_LOOKS.entries()) this.pool(`moto${i}`, motoModel(body, shirt, helmet, false), 60);
    this.pool("moto-box", motoModel(PALETTE.motoBlue, PALETTE.shirtWhite, PALETTE.helmetGreen, true), 60);
    this.pool("ba-gac", baGacModel(), 40);
    this.pool("bus", busModel(), 30);
    this.pool("train", trainModel(), 8);
    this.pool("ghe", gheModel(), 40);
    this.pool("raft2", raftModel(2), 40);
    this.pool("raft3", raftModel(3), 40);
    this.pool("hyacinth1", hyacinthModel(1), 60);
    this.pool("hyacinth2", hyacinthModel(2), 40);
    this.pool("banana", bananaModel(), 120);
    this.pool("stool", stoolModel(), 60);
    this.pool("food-cart", foodCartModel(), 60);
    this.pool("hedge", hedgeModel(), 120);
    this.pool("house", houseModel(), 70);
    this.pool("pole", poleModel(), 40);
    this.pool("wire", wireModel((HALF + 1.6) * 2), 20);
    this.pool("rail-post", railPostModel(), 20);
    this.pool("coin", coinModel(), 30);
    const cube = new BoxGeometry(1, 1, 1);
    this.geometries.push(cube);
    this.glow = new Pool(cube, this.glowMaterial, 700, "none");
    this.scene.add(this.glow.mesh);

    this.duck = new Mesh(undefined, this.material);
    this.duck.castShadow = true;
    this.duck.receiveShadow = true;
    const officer = officerModel();
    this.geometries.push(officer);
    this.officer = new Mesh(officer, this.material);
    this.officer.castShadow = true;
    this.scene.add(this.duck, this.officer);
  }

  private ghost(i: number, skin: SkinId): Mesh {
    let geometry = this.ghostModels.get(skin);
    if (!geometry) {
      geometry = duckModel(skin);
      this.ghostModels.set(skin, geometry);
    }
    let mesh = this.ghosts[i];
    if (!mesh) {
      mesh = new Mesh(geometry, this.ghostMaterial);
      mesh.renderOrder = 2;
      this.ghosts[i] = mesh;
      this.scene.add(mesh);
    }
    mesh.geometry = geometry;
    return mesh;
  }

  /** A world point on screen, as 0..1 of the canvas from its top-left (null when behind the camera). */
  project(x: number, y: number, z: number): { x: number; y: number } | null {
    const v = _p.set(x, y, z).project(this.camera);
    if (v.z < -1 || v.z > 1) return null;
    return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
  }

  private pool(key: string, geometry: BufferGeometry, cap: number, shadows?: "cast" | "receive" | "none") {
    this.geometries.push(geometry);
    const p = new Pool(geometry, this.material, cap, shadows);
    this.pools.set(key, p);
    this.scene.add(p.mesh);
    return p;
  }

  private add(key: string, x: number, y: number, z: number, rotY = 0) {
    this.pools.get(key)?.add(x, y, z, rotY);
  }

  setSkin(skin: SkinId) {
    if (skin === this.skin) return;
    this.skin = skin;
    const old = this.duck.geometry;
    this.duck.geometry = duckModel(skin);
    old.dispose();
  }

  /** Match the root's CSS size; devicePixelRatio capped at 2. */
  resize(width: number, height: number, dpr: number) {
    if (width <= 0 || height <= 0) return;
    this.renderer.setPixelRatio(Math.min(dpr || 1, 2));
    this.renderer.setSize(width, height, false);
    const aspect = width / height;
    // Show the 9-column playfield with a little street either side on a phone,
    // more rows on a wide screen, and never so wide that movers wrap in view.
    let vw = 10;
    let vh = vw / aspect;
    if (vh < 15) {
      vh = 15;
      vw = vh * aspect;
    }
    if (vw > 26) {
      vw = 26;
      vh = vw / aspect;
    }
    const c = this.camera;
    c.left = -vw / 2;
    c.right = vw / 2;
    c.top = vh / 2;
    c.bottom = -vh / 2;
    c.updateProjectionMatrix();
  }

  render(s: State, f: Frame) {
    this.light(f.dusk);
    const lx = f.lookX;
    const lz = -f.lookRow;
    this.camera.position.set(lx + CAM_OFFSET.x, CAM_OFFSET.y, lz + CAM_OFFSET.z);
    this.camera.lookAt(lx, 0, lz);
    this.sun.position.set(lx + SUN_OFFSET.x, SUN_OFFSET.y, lz + SUN_OFFSET.z);
    this.sun.target.position.set(lx, 0, lz);
    this.fog.near = CAM_DIST + 6;
    this.fog.far = CAM_DIST + 12;

    mix(this.lantern, PALETTE.lanternOff, PALETTE.lanternOn, f.dusk);
    mix(this.head, PALETTE.headOff, PALETTE.headOn, f.dusk);
    const from = Math.floor(f.lookRow) - 16;
    const to = Math.ceil(f.lookRow) + 18;
    for (let row = from; row <= to; row++) this.lane(s, row, f);

    if (f.duck) {
      const d = f.duck;
      this.duck.visible = true;
      this.duck.position.set(d.x, d.y, d.z);
      this.duck.rotation.set(0, d.rotY, 0);
      this.duck.scale.set(d.sx, d.sy, d.sz);
    } else this.duck.visible = false;
    const ghosts = f.ghosts ?? [];
    ghosts.forEach((g, i) => {
      const m = this.ghost(i, g.skin);
      const p = g.pose;
      m.visible = true;
      m.position.set(p.x, p.y, p.z);
      m.rotation.set(0, p.rotY, 0);
      m.scale.set(p.sx, p.sy, p.sz);
    });
    for (let i = ghosts.length; i < this.ghosts.length; i++) this.ghosts[i].visible = false;
    if (f.officer) {
      const o = f.officer;
      this.officer.visible = true;
      this.officer.position.set(o.x, o.y, o.z);
      this.officer.rotation.set(0, o.rotY, 0);
      this.officer.scale.set(o.sx, o.sy, o.sz);
    } else this.officer.visible = false;
    for (const p of f.particles) this.glow.add(p.x, p.y, p.z, 0, p.size, p.size, p.size, p.color);

    for (const p of this.pools.values()) p.flush();
    this.glow.flush();
    this.renderer.render(this.scene, this.camera);
  }

  private light(dusk: number) {
    const { day, dusk: eve } = PALETTE;
    mix(this.sky, day.sky, eve.sky, dusk);
    mix(this.fog.color, day.fog, eve.fog, dusk);
    mix(this.sun.color, day.sun, eve.sun, dusk);
    this.sun.intensity = day.sunIntensity + (eve.sunIntensity - day.sunIntensity) * dusk;
    mix(this.hemi.color, day.hemiSky, eve.hemiSky, dusk);
    mix(this.hemi.groundColor, day.hemiGround, eve.hemiGround, dusk);
    this.hemi.intensity = day.hemiIntensity + (eve.hemiIntensity - day.hemiIntensity) * dusk;
  }

  private lane(s: State, row: number, f: Frame) {
    const z = -row;
    const lane = row >= 0 ? laneAt(s, row) : undefined;
    if (!lane) {
      // Behind the start (or rows already forgotten): quiet grass, hedged off at the start line
      this.add(row % 2 ? "grass-b" : "grass-a", 0, 0, z);
      if (row === -1) for (let x = -HALF; x <= HALF; x++) this.add("hedge", x, 0, z);
      this.sides(row, z, f, true);
      return;
    }
    if (lane.kind === "grass") {
      this.add(row % 2 ? "grass-b" : "grass-a", 0, 0, z);
      for (const b of lane.blocks) this.add(b.kind, b.x, 0, z, b.kind === "hedge" ? 0 : hash(row, b.x) * 4 > 2 ? Math.PI / 2 : 0);
      this.sides(row, z, f, false);
    } else if (lane.kind === "road") {
      this.add("road", 0, 0, z);
      if (laneAt(s, row - 1)?.kind === "road") this.add("road-line", 0, 0, z);
      this.traffic(lane, z, f);
    } else if (lane.kind === "river") {
      this.add("river", 0, 0, z);
      this.floaters(lane, z, f);
    } else this.rail(lane, z, f);
    if (lane.coin !== null) this.add("coin", lane.coin, 0.62 + Math.sin(f.time * 3 + row) * 0.06, z, f.time * 2.4 + row);
  }

  /** Houses, banana trees and lantern strings beyond the playfield. */
  private sides(row: number, z: number, f: Frame, quiet: boolean) {
    for (const side of [-1, 1]) {
      if (hash(row, side + 5) < 0.6) {
        this.add("house", side * (HALF + 3.6), 0, z);
        // a lantern by the door
        this.glow.add(side * (HALF + 3.6), 1.25, z + 0.56, 0, 0.16, 0.2, 0.16, this.lantern);
      } else if (hash(row, side + 11) < 0.5) this.add("banana", side * (HALF + 3.2), 0, z, hash(row, 3) * 6);
      if (hash(row, side + 17) < 0.45) this.add("banana", side * (HALF + 1.6), 0, z, hash(row, side) * 6);
    }
    if (quiet || row < 3 || hash(row, 23) > 0.24) return;
    const edge = HALF + 1.6;
    this.add("pole", -edge, 0, z);
    this.add("pole", edge, 0, z);
    this.add("wire", 0, 0, z);
    for (let i = 0; i < 7; i++) {
      const x = -edge + 0.8 + i * ((edge * 2 - 1.6) / 6);
      const sway = Math.sin(f.time * 1.6 + i + row) * 0.03;
      this.glow.add(x + sway, 2.2, z, 0, 0.24, 0.3, 0.24, this.lantern);
    }
  }

  private traffic(lane: Lane, z: number, f: Frame) {
    const rot = lane.dir > 0 ? 0 : Math.PI;
    const lit = 0.16 + f.dusk * 0.06;
    lane.movers.forEach((m, i) => {
      const x = moverX(lane, m, f.time);
      if (Math.abs(x) > LANE_HALF) return;
      const front = x + lane.dir * (m.len / 2 + 0.01);
      if (m.kind === "moto") {
        this.add(`moto${(lane.row * 7 + i) % MOTO_LOOKS.length}`, x, 0, z, rot);
        this.glow.add(front - lane.dir * 0.2, 0.36, z, 0, lit, lit, lit, this.head);
      } else if (m.kind === "moto-box") {
        this.add("moto-box", x, 0, z, rot);
        this.glow.add(front - lane.dir * 0.2, 0.36, z, 0, lit, lit, lit, this.head);
      } else if (m.kind === "ba-gac") {
        this.add("ba-gac", x, 0, z, rot);
        this.glow.add(front - lane.dir * 0.16, 0.42, z, 0, lit, lit, lit, this.head);
      } else {
        this.add("bus", x, 0, z, rot);
        for (const dz of [-0.28, 0.28]) this.glow.add(front, 0.26, z + dz, 0, lit, lit * 0.8, lit, this.head);
      }
    });
  }

  private floaters(lane: Lane, z: number, f: Frame) {
    const rot = lane.dir > 0 ? 0 : Math.PI;
    for (const m of lane.movers) {
      const x = moverX(lane, m, f.time);
      if (Math.abs(x) > LANE_HALF) continue;
      const bob = Math.sin(f.time * 2.2 + m.x0 * 1.7) * 0.025;
      const key = m.kind === "ghe" ? "ghe" : m.kind === "raft" ? `raft${m.len === 3 ? 3 : 2}` : `hyacinth${m.len === 2 ? 2 : 1}`;
      this.add(key, x, bob, z, rot);
    }
  }

  private rail(lane: Lane, z: number, f: Frame) {
    this.add("rail", 0, 0, z);
    const t = trainAt(lane, f.time);
    const blink = t.warn ? Math.floor(f.time * 5) % 2 : -1;
    for (const side of [-1, 1]) {
      const px = side * (HALF + 1.3);
      this.add("rail-post", px, 0, z + 0.48, side > 0 ? Math.PI : 0);
      const sx = px - side * 0.11;
      this.glow.add(sx, 0.93, z + 0.34, 0, 0.1, 0.12, 0.12, blink === 0 ? this.lightOn : this.lightOff);
      this.glow.add(sx, 0.93, z + 0.62, 0, 0.1, 0.12, 0.12, blink === 1 ? this.lightOn : this.lightOff);
    }
    if (t.x !== null) {
      this.add("train", t.x, 0, z, lane.dir > 0 ? 0 : Math.PI);
      const front = t.x + lane.dir * 6.03;
      for (const dz of [-0.22, 0.22]) this.glow.add(front, 0.46, z + dz, 0, 0.06, 0.14, 0.14, this.head);
    }
  }

  dispose() {
    for (const g of this.geometries) g.dispose();
    this.duck.geometry.dispose();
    for (const g of this.ghostModels.values()) g.dispose();
    this.ghostMaterial.dispose();
    for (const p of this.pools.values()) p.mesh.dispose();
    this.glow.mesh.dispose();
    this.material.dispose();
    this.glowMaterial.dispose();
    this.sun.shadow.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
