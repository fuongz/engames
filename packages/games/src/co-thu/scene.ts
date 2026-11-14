// The three.js side of Cờ Thú: one WebGL canvas under the engine's 2D stage.
// It shows the jungle diorama, the pieces (a round base in the side's colour
// with a rank chip, and the animal as a camera-facing sprite), selection and
// move markers, hops, capture pops and the den-win confetti. It owns and
// disposes every GPU resource it makes; game.ts only calls its methods.
import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  Plane,
  QuadraticBezierCurve3,
  Quaternion,
  Raycaster,
  RingGeometry,
  SRGBColorSpace,
  Scene,
  Sprite,
  SpriteMaterial,
  type Texture,
  TextureLoader,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { ANIMAL_IDS, type AnimalId, BLUE_DARK, BLUE_HEX, RED_DARK, RED_HEX } from "./config";
import { buildDiorama, squareX, squareZ } from "./diorama";
import { COLS, ROWS, type Side, rankOf, sideOf, sq } from "./logic";

// The animal art: img/<id>.webp, 512 × 512 with transparency. Every sprite is
// drawn on the same grid: the figure is 420 px tall and its feet stand 42 px
// above the image's bottom edge, so one anchor fits them all.
const ART = import.meta.glob<string>("./img/*.webp", { eager: true, import: "default" });
const artUrl = (id: AnimalId): string | undefined => ART[`./img/${id}.webp`];

const FONT = '"Baloo 2", system-ui, sans-serif';
const BASE_H = 0.14;
/** World height of the whole sprite image (the figure is 420/512 of it). */
const SPRITE_H = 1.08;
/** Where the feet are in the image, from the bottom (0..1): they rest on the base. */
const FEET_V = 42 / 512;
/** A gentle size step by rank, so the Elephant reads bigger than the Rat without breaking the set. */
const SPRITE_SCALE: Record<AnimalId, number> = {
  chuot: 0.86,
  meo: 0.88,
  cho: 0.91,
  soi: 0.93,
  bao: 0.95,
  ho: 0.98,
  "su-tu": 1,
  voi: 1.04,
};

/** Only if an image fails to load: a plain disc with the rank, so the game stays playable. */
function fallbackCanvas(rank: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  if (!g) return c;
  g.fillStyle = "#fff6e0";
  g.beginPath();
  g.arc(128, 150, 84, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 8;
  g.strokeStyle = "#4f6b52";
  g.stroke();
  g.fillStyle = "#22402a";
  g.font = `800 96px ${FONT}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(rank), 128, 156);
  return c;
}

/** A small round chip with the rank number, in the side's colour. */
function chipCanvas(rank: number, side: Side): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d");
  if (!g) return c;
  g.fillStyle = "#fffaf0";
  g.beginPath();
  g.arc(32, 32, 29, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = side === 1 ? RED_DARK : BLUE_DARK;
  g.stroke();
  g.fillStyle = side === 1 ? RED_DARK : BLUE_DARK;
  g.font = `800 40px ${FONT}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(String(rank), 32, 35);
  return c;
}

interface PieceObj {
  id: number;
  piece: number;
  sq: number;
  group: Group;
  base: Mesh;
  sprite: Sprite;
  chip: Sprite;
  /** World position of the base centre on the tile. */
  pos: Vector3;
  lift: number;
  scale: number;
  hop: { from: Vector3; to: Vector3; t: number; dur: number; height: number; victim: number | null } | null;
  pop: { t: number } | null;
}

interface Particle {
  p: Vector3;
  v: Vector3;
  life: number;
  max: number;
  size: number;
  color: Color;
  spin: number;
}

export interface Target {
  sq: number;
  capture: boolean;
  jump: boolean;
}

const _v = new Vector3();
const _w = new Vector3();
const _m = new Matrix4();
const _q = new Quaternion();
const _s = new Vector3();
const UP = new Vector3(0, 1, 0);
const MAX_PARTICLES = 220;

export class Board3D {
  readonly canvas: HTMLCanvasElement;
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(30, 1, 0.5, 120);
  private sun = new DirectionalLight("#fff0cf", 2.6);
  private diorama = buildDiorama();
  private pieces = new Map<number, PieceObj>();
  private textures = new Map<string, Texture>();
  private spriteMats = new Map<string, SpriteMaterial>();
  private loader = new TextureLoader();
  private baseGeo = new CylinderGeometry(0.36, 0.39, BASE_H, 32);
  private rimGeo = new TorusGeometry(0.335, 0.03, 6, 32);
  private baseMat: Record<Side, MeshStandardMaterial>;
  private rimMat = new MeshStandardMaterial({ color: "#fff6e0", roughness: 0.5 });
  private markers = new Group();
  private dotGeo = new CircleGeometry(0.17, 24);
  private ringGeo = new RingGeometry(0.31, 0.41, 32);
  private frameGeo = new RingGeometry(0.4, 0.46, 4, 1);
  private glowGeo = new RingGeometry(0.36, 0.52, 40);
  private dotMat = new MeshBasicMaterial({ color: "#8dff8a", transparent: true, opacity: 0.85, depthWrite: false, depthTest: false });
  private capMat = new MeshBasicMaterial({ color: "#ff4b42", transparent: true, opacity: 0.95, depthWrite: false, depthTest: false });
  private arcMat = new MeshBasicMaterial({ color: "#fff3a8", transparent: true, opacity: 0.85, depthWrite: false });
  private lastFromMat = new MeshBasicMaterial({ color: "#ffe36b", transparent: true, opacity: 0.45, depthWrite: false });
  private lastToMat = new MeshBasicMaterial({ color: "#ffe36b", transparent: true, opacity: 0.9, depthWrite: false });
  private glowMat = new MeshBasicMaterial({ color: "#fff27a", transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false });
  private dots: Mesh[] = [];
  private rings: Mesh[] = [];
  private arcs: Mesh[] = [];
  private lastFrom: Mesh;
  private lastTo: Mesh;
  private glow: Mesh;
  private selectedId: number | null = null;
  private particles: Particle[] = [];
  private bits: InstancedMesh;
  private bitGeo = new BoxGeometry(0.07, 0.07, 0.02);
  private bitMat = new MeshBasicMaterial({ color: "#ffffff" });
  private raycaster = new Raycaster();
  private ground = new Plane(new Vector3(0, 1, 0), 0);
  private time = 0;
  private cheer = 0;
  private cheerAt: Vector3 | null = null;
  private cheerColors: Color[] = [];

  // Camera: an orbit round the board centre, eased toward the side to move
  private azimuth = 0;
  private azimuthGoal = 0;
  private elevation = 0.92;
  private distance = 18;
  private size = { w: 1, h: 1 };
  private frame = { top: 0, bottom: 0, left: 0, right: 0 };
  private shadowsDirty = true;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none";
    this.renderer = new WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.outputColorSpace = SRGBColorSpace;

    // Sky: a soft vertical gradient, mint toward the bottom so the island floats
    const sky = document.createElement("canvas");
    sky.width = 4;
    sky.height = 256;
    const sg = sky.getContext("2d");
    if (sg) {
      const grad = sg.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, "#7fd0ee");
      grad.addColorStop(0.55, "#bdebf0");
      grad.addColorStop(1, "#e3f7df");
      sg.fillStyle = grad;
      sg.fillRect(0, 0, 4, 256);
    }
    const skyTex = new CanvasTexture(sky);
    skyTex.colorSpace = SRGBColorSpace;
    this.textures.set("sky", skyTex);
    this.scene.background = skyTex;
    this.scene.fog = new Fog("#cfeff0", 30, 60);

    const hemi = new HemisphereLight("#d9f2ff", "#5d8a3a", 1.5);
    this.scene.add(hemi);
    this.sun.position.set(-5, 12, 7);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -8;
    sc.right = 8;
    sc.top = 8;
    sc.bottom = -8;
    sc.near = 1;
    sc.far = 40;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 4;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.scene.add(this.diorama.group);

    this.baseMat = {
      1: new MeshStandardMaterial({ color: RED_HEX, roughness: 0.45 }),
      [-1]: new MeshStandardMaterial({ color: BLUE_HEX, roughness: 0.45 }),
    } as Record<Side, MeshStandardMaterial>;

    // Markers
    this.dotGeo.rotateX(-Math.PI / 2);
    this.ringGeo.rotateX(-Math.PI / 2);
    this.frameGeo.rotateX(-Math.PI / 2);
    this.frameGeo.rotateY(Math.PI / 4);
    this.glowGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 6; i++) {
      const d = new Mesh(this.dotGeo, this.dotMat);
      d.visible = false;
      d.renderOrder = 5;
      this.markers.add(d);
      this.dots.push(d);
      const r = new Mesh(this.ringGeo, this.capMat);
      r.visible = false;
      r.renderOrder = 5;
      this.markers.add(r);
      this.rings.push(r);
    }
    this.lastFrom = new Mesh(this.frameGeo, this.lastFromMat);
    this.lastTo = new Mesh(this.frameGeo, this.lastToMat);
    this.lastFrom.visible = this.lastTo.visible = false;
    this.glow = new Mesh(this.glowGeo, this.glowMat);
    this.glow.visible = false;
    this.glow.renderOrder = 3;
    this.markers.add(this.lastFrom, this.lastTo, this.glow);
    this.scene.add(this.markers);

    this.bits = new InstancedMesh(this.bitGeo, this.bitMat, MAX_PARTICLES);
    this.bits.count = 0;
    this.bits.frustumCulled = false;
    this.scene.add(this.bits);
  }

  // ---------------------------------------------------------------- textures

  private animalMaterial(id: AnimalId): SpriteMaterial {
    let m = this.spriteMats.get(id);
    if (m) return m;
    // Hidden until its image is in, so a piece never flashes a blank card
    const mat = new SpriteMaterial({ alphaTest: 0.35, transparent: true });
    mat.visible = false;
    m = mat;
    this.spriteMats.set(id, mat);
    const fallback = () => {
      if (this.spriteMats.get(id) !== mat) return;
      const t = new CanvasTexture(fallbackCanvas(ANIMAL_IDS.indexOf(id)));
      t.colorSpace = SRGBColorSpace;
      this.textures.set(id, t);
      mat.map = t;
      mat.visible = true;
      mat.needsUpdate = true;
    };
    const url = artUrl(id);
    if (!url) fallback();
    else
      this.loader.load(
        url,
        (real) => {
          if (this.spriteMats.get(id) !== mat) {
            real.dispose();
            return;
          }
          real.colorSpace = SRGBColorSpace;
          this.textures.set(id, real);
          mat.map = real;
          mat.visible = true;
          mat.needsUpdate = true;
        },
        undefined,
        fallback,
      );
    return m;
  }

  private chipMaterial(rank: number, side: Side): SpriteMaterial {
    const key = `chip${rank}${side}`;
    let m = this.spriteMats.get(key);
    if (!m) {
      const t = new CanvasTexture(chipCanvas(rank, side));
      t.colorSpace = SRGBColorSpace;
      this.textures.set(key, t);
      m = new SpriteMaterial({ map: t, depthTest: true, transparent: true, alphaTest: 0.2 });
      this.spriteMats.set(key, m);
    }
    return m;
  }

  // ---------------------------------------------------------------- pieces

  /** Make the pieces match `ids` (square → piece id, -1 for none) on `board`, without animation. */
  setPieces(board: readonly number[], ids: readonly number[]) {
    const seen = new Set<number>();
    for (let s = 0; s < board.length; s++) {
      const id = ids[s];
      if (id < 0 || board[s] === 0) continue;
      seen.add(id);
      let p = this.pieces.get(id);
      if (!p || p.piece !== board[s]) {
        if (p) this.removePiece(p);
        p = this.makePiece(id, board[s]);
      }
      p.sq = s;
      p.pos.set(squareX(s), 0, squareZ(s));
      p.hop = null;
      p.pop = null;
      p.scale = 1;
    }
    for (const p of [...this.pieces.values()]) if (!seen.has(p.id)) this.removePiece(p);
    this.shadowsDirty = true;
  }

  private makePiece(id: number, piece: number): PieceObj {
    const side = sideOf(piece) as Side;
    const rank = rankOf(piece);
    const animal = ANIMAL_IDS[rank] as AnimalId;
    const group = new Group();
    const base = new Mesh(this.baseGeo, this.baseMat[side]);
    base.position.y = BASE_H / 2;
    base.castShadow = true;
    base.receiveShadow = true;
    const rim = new Mesh(this.rimGeo, this.rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = BASE_H;
    base.add(rim);
    rim.position.y = BASE_H / 2;
    const sprite = new Sprite(this.animalMaterial(animal));
    // Feet on the base's top face, a hair sunk in so they never float
    sprite.center.set(0.5, FEET_V);
    sprite.position.y = BASE_H - 0.01;
    const h = SPRITE_H * SPRITE_SCALE[animal];
    sprite.scale.set(h, h, 1);
    const chip = new Sprite(this.chipMaterial(rank, side));
    chip.scale.set(0.2, 0.2, 1);
    chip.renderOrder = 4;
    group.add(base, sprite, chip);
    this.scene.add(group);
    const p: PieceObj = { id, piece, sq: -1, group, base, sprite, chip, pos: new Vector3(), lift: 0, scale: 1, hop: null, pop: null };
    sprite.userData.pieceId = id;
    base.userData.pieceId = id;
    this.pieces.set(id, p);
    return p;
  }

  private removePiece(p: PieceObj) {
    this.scene.remove(p.group);
    this.pieces.delete(p.id);
    if (this.selectedId === p.id) this.selectedId = null;
  }

  /** Hop (or leap across a pond) to `to`; a piece already there pops as the mover lands. */
  move(id: number, to: number, jump: boolean, victim: number | null) {
    const p = this.pieces.get(id);
    if (!p) return;
    p.hop = {
      from: p.pos.clone(),
      to: new Vector3(squareX(to), 0, squareZ(to)),
      t: 0,
      dur: jump ? 0.62 : 0.32,
      height: jump ? 1.25 : 0.38,
      victim,
    };
    p.sq = to;
  }

  /** Anything still moving (the shell waits before the computer replies or the result shows). */
  busy(): boolean {
    for (const p of this.pieces.values()) if (p.hop || p.pop) return true;
    return Math.abs(this.azimuthGoal - this.azimuth) > 0.02;
  }

  // ---------------------------------------------------------------- markers

  /** Lift and glow the piece on `from`, and light its legal targets. Null clears. */
  select(id: number | null, from: number, targets: readonly Target[]) {
    this.selectedId = id;
    for (const a of this.arcs) {
      this.markers.remove(a);
      a.geometry.dispose();
    }
    this.arcs = [];
    let d = 0;
    let r = 0;
    for (const m of [...this.dots, ...this.rings]) m.visible = false;
    if (id === null) return;
    for (const t of targets) {
      const x = squareX(t.sq);
      const z = squareZ(t.sq);
      if (t.capture) {
        const ring = this.rings[r++];
        if (ring) {
          ring.position.set(x, 0.03, z);
          ring.visible = true;
        }
      } else {
        const dot = this.dots[d++];
        if (dot) {
          dot.position.set(x, t.sq >= 0 && this.isWaterSquare(t.sq) ? -0.045 : 0.03, z);
          dot.visible = true;
        }
      }
      if (t.jump) {
        const a = new Vector3(squareX(from), 0.3, squareZ(from));
        const b = new Vector3(x, 0.3, z);
        const mid = a.clone().lerp(b, 0.5);
        mid.y = 1.6;
        const curve = new QuadraticBezierCurve3(a, mid, b);
        const arc = new Mesh(new TubeGeometry(curve, 24, 0.028, 6, false), this.arcMat);
        arc.renderOrder = 2;
        this.markers.add(arc);
        this.arcs.push(arc);
      }
    }
  }

  private isWaterSquare(s: number) {
    const x = s % COLS;
    const y = Math.floor(s / COLS);
    return y >= 3 && y <= 5 && (x === 1 || x === 2 || x === 4 || x === 5);
  }

  /** Mark the last move's two squares (null hides them). */
  setLastMove(m: { from: number; to: number } | null) {
    this.lastFrom.visible = this.lastTo.visible = m !== null;
    if (!m) return;
    this.lastFrom.position.set(squareX(m.from), this.isWaterSquare(m.from) ? -0.05 : 0.02, squareZ(m.from));
    this.lastTo.position.set(squareX(m.to), this.isWaterSquare(m.to) ? -0.05 : 0.02, squareZ(m.to));
  }

  // ---------------------------------------------------------------- effects

  private burst(at: Vector3, colors: string[], n: number, speed: number, up: number) {
    for (let i = 0; i < n; i++) {
      if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        p: at.clone(),
        v: new Vector3(Math.cos(a) * s, up * (0.6 + Math.random() * 0.8), Math.sin(a) * s),
        life: 0,
        max: 0.8 + Math.random() * 0.8,
        size: 0.6 + Math.random() * 0.9,
        color: new Color(colors[i % colors.length]),
        spin: Math.random() * 10,
      });
    }
  }

  /** Confetti and a glow over the den a piece just walked into. */
  celebrate(at: number, side: Side) {
    this.cheer = 2.4;
    this.cheerAt = new Vector3(squareX(at), 0.4, squareZ(at));
    const own = side === 1 ? [RED_HEX, "#ff9a7a"] : [BLUE_HEX, "#8cc4ff"];
    this.cheerColors = [...own, "#ffe14d", "#7ee06a", "#ffffff"].map((c) => new Color(c));
    this.burst(this.cheerAt, [...own, "#ffe14d", "#7ee06a", "#ffffff"], 90, 2.4, 5.5);
  }

  // ---------------------------------------------------------------- camera and layout

  /** Turn the board to face `side` (Red looks from +z). */
  setView(side: Side, instant = false) {
    const goal = side === 1 ? 0 : Math.PI;
    // Always turn the short way round, keeping the angle continuous
    let g = goal;
    while (g - this.azimuth > Math.PI) g -= Math.PI * 2;
    while (g - this.azimuth < -Math.PI) g += Math.PI * 2;
    this.azimuthGoal = g;
    if (instant) this.azimuth = g;
  }

  /** The canvas size in CSS pixels, and the screen band (CSS px from each edge) the HUD covers. */
  resize(w: number, h: number, dpr: number, frame: { top: number; bottom: number; left: number; right: number }) {
    this.size = { w: Math.max(1, w), h: Math.max(1, h) };
    this.frame = frame;
    this.renderer.setPixelRatio(Math.min(dpr || 1, 2));
    this.renderer.setSize(this.size.w, this.size.h, false);
    this.camera.aspect = this.size.w / this.size.h;
    this.fit();
  }

  private place(az: number) {
    const c = this.camera;
    const d = this.distance;
    c.position.set(Math.sin(az) * Math.cos(this.elevation) * d, Math.sin(this.elevation) * d, Math.cos(az) * Math.cos(this.elevation) * d);
    c.up.set(0, 1, 0);
    c.lookAt(0, 0, 0);
    c.updateMatrixWorld();
  }

  /** Pick the distance that fits the board in the free band, then shift the view to centre it there. */
  private fit() {
    const { w, h } = this.size;
    const f = this.frame;
    const availW = Math.max(40, w - f.left - f.right);
    const availH = Math.max(40, h - f.top - f.bottom);
    // A steeper look on a tall screen, a lower one on a wide screen
    this.elevation = w < h ? 0.98 : 0.86;
    const c = this.camera;
    c.clearViewOffset();
    c.fov = w < h ? 34 : 30;
    c.updateProjectionMatrix();
    const hx = COLS / 2 + 0.2;
    const hz = ROWS / 2 + 0.2;
    const pts: Vector3[] = [];
    for (const x of [-hx, hx]) for (const z of [-hz, hz]) for (const y of [0, 1.1]) pts.push(new Vector3(x, y, z));
    const bounds = () => {
      let minX = 1;
      let maxX = -1;
      let minY = 1;
      let maxY = -1;
      for (const p of pts) {
        _v.copy(p).project(c);
        minX = Math.min(minX, _v.x);
        maxX = Math.max(maxX, _v.x);
        minY = Math.min(minY, _v.y);
        maxY = Math.max(maxY, _v.y);
      }
      return { minX, maxX, minY, maxY };
    };
    const ax = (availW / w) * 0.98;
    const ay = (availH / h) * 0.98;
    let lo = 4;
    let hi = 80;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      this.distance = mid;
      this.place(0);
      const b = bounds();
      if (b.maxX - b.minX <= 2 * ax && b.maxY - b.minY <= 2 * ay) hi = mid;
      else lo = mid;
    }
    this.distance = hi;
    this.place(0);
    const b = bounds();
    // Where the board's centre lands now, and where the free band's centre is (CSS px)
    const nowY = ((1 - (b.minY + b.maxY) / 2) / 2) * h;
    const wantY = f.top + availH / 2;
    const nowX = (((b.minX + b.maxX) / 2 + 1) / 2) * w;
    const wantX = f.left + availW / 2;
    c.setViewOffset(w, h, -(wantX - nowX), -(wantY - nowY), w, h);
    c.updateProjectionMatrix();
    this.place(this.azimuth);
  }

  /**
   * The square under CSS pixel (x, y) of the canvas, or -1. Pieces count by their
   * whole figure, except that a square in `prefer` (a lit target) wins even when
   * a figure stands in front of it.
   */
  pick(x: number, y: number, prefer: readonly number[] = []): number {
    const ndc = new Vector2((x / this.size.w) * 2 - 1, -(y / this.size.h) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const ground = this.groundSquare();
    if (ground >= 0 && prefer.includes(ground)) return ground;
    const targets: Sprite[] = [];
    for (const p of this.pieces.values()) if (!p.pop) targets.push(p.sprite);
    const hits = this.raycaster.intersectObjects(targets, false);
    for (const h of hits) {
      // Ignore the transparent corners of the sprite: only a hit near its middle counts
      const uv = h.uv;
      if (uv && (uv.x < 0.18 || uv.x > 0.82 || uv.y > 0.9)) continue;
      const id = h.object.userData.pieceId as number;
      const p = this.pieces.get(id);
      if (p) return p.sq;
    }
    return ground;
  }

  /** The square the current ray meets at tile height, or -1. */
  private groundSquare(): number {
    const hit = this.raycaster.ray.intersectPlane(this.ground, _w);
    if (!hit) return -1;
    const col = Math.round(hit.x + (COLS - 1) / 2);
    const row = Math.round(hit.z + (ROWS - 1) / 2);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return -1;
    // Only near the square's middle, so a tap on a gap between squares doesn't misfire
    if (Math.abs(hit.x - squareX(sq(col, row))) > 0.49 || Math.abs(hit.z - squareZ(sq(col, row))) > 0.49) return -1;
    return sq(col, row);
  }

  // ---------------------------------------------------------------- frame

  render(dt: number) {
    this.time += dt;
    const t = this.time;
    this.diorama.animate(t);

    // Camera orbit
    if (Math.abs(this.azimuthGoal - this.azimuth) > 0.0005) {
      this.azimuth += (this.azimuthGoal - this.azimuth) * (1 - Math.exp(-dt * 3.2));
      if (Math.abs(this.azimuthGoal - this.azimuth) < 0.002) this.azimuth = this.azimuthGoal;
    }
    this.place(this.azimuth);

    // Pieces
    let moving = false;
    const camFlat = _w.set(this.camera.position.x, 0, this.camera.position.z).normalize();
    for (const p of [...this.pieces.values()]) {
      let y = 0;
      let squash = 1;
      if (p.hop) {
        moving = true;
        const h = p.hop;
        h.t = Math.min(1, h.t + dt / h.dur);
        const k = h.t < 0.5 ? 2 * h.t * h.t : 1 - (-2 * h.t + 2) ** 2 / 2;
        p.pos.lerpVectors(h.from, h.to, k);
        y = Math.sin(Math.PI * h.t) * h.height;
        if (h.victim !== null && h.t >= 0.8) {
          const v = this.pieces.get(h.victim);
          if (v && !v.pop) {
            v.pop = { t: 0 };
            this.burst(
              new Vector3(v.pos.x, 0.5, v.pos.z),
              sideOf(v.piece) === 1 ? [RED_HEX, "#ffd2c4", "#ffe14d"] : [BLUE_HEX, "#cfe6ff", "#ffe14d"],
              26,
              1.6,
              3.2,
            );
          }
          h.victim = null;
        }
        if (h.t >= 1) {
          p.hop = null;
          p.pos.copy(h.to);
          p.scale = 0.82; // a squash on landing, eased back below
        }
      }
      if (p.pop) {
        moving = true;
        p.pop.t += dt / 0.34;
        const k = p.pop.t;
        squash = k < 0.35 ? 1 + k * 0.7 : Math.max(0, 1.25 * (1 - (k - 0.35) / 0.65));
        if (k >= 1) {
          this.removePiece(p);
          continue;
        }
      }
      // Selected: lift and bob
      const lifted = this.selectedId === p.id ? 0.22 + Math.sin(t * 5) * 0.03 : 0;
      p.lift += (lifted - p.lift) * (1 - Math.exp(-dt * 14));
      p.scale += (1 - p.scale) * (1 - Math.exp(-dt * 10));
      const sy = p.scale * squash;
      const sxz = (2 - p.scale) * squash;
      p.group.position.set(p.pos.x, y + p.lift, p.pos.z);
      p.group.scale.set(sxz, sy, sxz);
      // The rank chip sits on the base's rim nearest the camera
      p.chip.position.set(camFlat.x * 0.36, BASE_H + 0.05, camFlat.z * 0.36);
      if (this.selectedId === p.id) {
        this.glow.visible = true;
        this.glow.position.set(p.pos.x, 0.025, p.pos.z);
        this.glowMat.opacity = 0.55 + Math.sin(t * 6) * 0.25;
      }
    }
    if (this.selectedId === null || !this.pieces.has(this.selectedId)) this.glow.visible = false;

    // Marker pulse
    const pulse = 0.85 + Math.sin(t * 5) * 0.12;
    for (const d of this.dots) d.scale.setScalar(pulse);
    for (const r of this.rings) r.scale.setScalar(0.95 + Math.sin(t * 6) * 0.06);
    this.arcMat.opacity = 0.55 + Math.sin(t * 4) * 0.25;

    // Den celebration: a slow trickle of extra confetti
    if (this.cheer > 0 && this.cheerAt) {
      this.cheer -= dt;
      if (Math.random() < dt * 30) {
        const c = this.cheerColors[Math.floor(Math.random() * this.cheerColors.length)];
        this.burst(this.cheerAt, [`#${c.getHexString()}`], 1, 1.8, 4.5);
      }
    }

    // Particles: confetti flutters down
    let n = 0;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const q = this.particles[i];
      q.life += dt;
      if (q.life >= q.max) {
        this.particles.splice(i, 1);
        continue;
      }
      q.v.y -= 7 * dt;
      q.v.multiplyScalar(1 - dt * 1.6);
      q.p.addScaledVector(q.v, dt);
      const k = 1 - q.life / q.max;
      _q.setFromAxisAngle(UP, q.spin + q.life * 8);
      _m.compose(q.p, _q, _s.set(q.size * k, q.size * k, q.size * k));
      this.bits.setMatrixAt(n, _m);
      this.bits.setColorAt(n, q.color);
      n++;
    }
    this.bits.count = n;
    this.bits.instanceMatrix.needsUpdate = true;
    if (this.bits.instanceColor) this.bits.instanceColor.needsUpdate = true;

    if (moving || this.shadowsDirty) {
      this.renderer.shadowMap.needsUpdate = true;
      this.shadowsDirty = moving;
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.diorama.dispose();
    for (const t of this.textures.values()) t.dispose();
    for (const m of this.spriteMats.values()) m.dispose();
    for (const a of this.arcs) a.geometry.dispose();
    for (const g of [this.baseGeo, this.rimGeo, this.dotGeo, this.ringGeo, this.frameGeo, this.glowGeo, this.bitGeo]) g.dispose();
    for (const m of [this.baseMat[1], this.baseMat[-1], this.rimMat, this.dotMat, this.capMat, this.arcMat, this.lastFromMat, this.lastToMat, this.glowMat, this.bitMat])
      m.dispose();
    this.bits.dispose();
    this.sun.shadow.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }
}
