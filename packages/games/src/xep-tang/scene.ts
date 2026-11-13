// Optional 3D drawing layer. The core still owns input, timing and the canvas
// used for the sky/HUD. Composite immediately after rendering so no preserved
// WebGL drawing buffer or second animation loop is needed.
import type { Rect } from "@web-games/core";
import {
  BoxGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  Object3D,
  OrthographicCamera,
  Scene,
  WebGLRenderer,
} from "three";
import type { Camera } from "./art";
import { H, PLINTH_H, SCALE, SLAB_H, W } from "./config";
import { type Box, type Run, hueFor } from "./logic";

export interface FallingSlab {
  box: Box;
  y: number;
  rot: number;
  hue: number;
  opacity: number;
}

/** Match art.project exactly, including letterbox bleed and camera shake. */
export function placeCamera(
  camera: OrthographicCamera,
  cam: Camera,
  view: Rect,
) {
  const pixels = SCALE * cam.zoom * Math.sqrt(1.5);
  camera.left = (view.x - W / 2 - cam.dx) / pixels;
  camera.right = (view.x + view.w - W / 2 - cam.dx) / pixels;
  camera.top = (cam.anchorY + cam.dy - view.y) / pixels;
  camera.bottom = (cam.anchorY + cam.dy - view.y - view.h) / pixels;
  camera.position.set(20, cam.focusY + 20, 20);
  camera.lookAt(0, cam.focusY, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

/** Clip a small directional contact shadow to the supporting slab. */
export function contactFootprint(source: Box, receiver: Box): Box | null {
  const left = Math.max(source.x - source.w / 2 + 0.05, receiver.x - receiver.w / 2);
  const right = Math.min(source.x + source.w / 2 + 0.05, receiver.x + receiver.w / 2);
  const back = Math.max(source.z - source.d / 2 + 0.03, receiver.z - receiver.d / 2);
  const front = Math.min(source.z + source.d / 2 + 0.03, receiver.z + receiver.d / 2);
  if (right <= left || front <= back) return null;
  return { x: (left + right) / 2, z: (back + front) / 2, w: right - left, d: front - back };
}

export class StackScene {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
  private geometry = new BoxGeometry(1, SLAB_H, 1);
  private material = new MeshLambertMaterial();
  private plinthGeometry = new BoxGeometry(1, 1, 1);
  private plinth = new Mesh(this.plinthGeometry, this.material.clone());
  private shadowGeometry = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  private shadowMaterial = new MeshBasicMaterial({ color: 0x292238, transparent: true, opacity: 0.12, depthWrite: false });
  private contacts = new InstancedMesh(this.shadowGeometry, this.shadowMaterial, 129);
  private tower = new InstancedMesh(this.geometry, this.material, 128);
  private mover = new Mesh(this.geometry, this.material);
  private fragments: Mesh<BoxGeometry, MeshLambertMaterial>[] = [];
  private pose = new Object3D();
  private color = new Color();
  private width = 0;
  private height = 0;

  constructor() {
    this.renderer = new WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setClearColor(0, 0);
    this.tower.frustumCulled = false;
    this.contacts.frustumCulled = false;
    const sun = new DirectionalLight(0xffffff, 2.2);
    sun.position.set(-3, 8, 5);
    this.scene.add(new HemisphereLight(0xffffff, 0x716080, 2), sun, this.plinth, this.tower, this.mover, this.contacts);
  }

  private tint(hue: number) {
    return this.color.setHSL(hue / 360, 0.58, 0.57);
  }

  private transform(target: Object3D, box: Box, y: number, height: number) {
    target.position.set(box.x, y + height / 2, box.z);
    target.scale.set(box.w, height / SLAB_H, box.d);
    target.rotation.set(0, 0, 0);
    target.updateMatrix();
  }

  /** False while the GPU context is lost: the shell draws its 2D fallback. */
  draw(
    ctx: CanvasRenderingContext2D,
    view: Rect,
    cam: Camera,
    run: Run,
    squash: number,
    moving: Box | null,
    pieces: readonly FallingSlab[],
  ) {
    if (this.renderer.getContext().isContextLost()) return false;
    // The destination already includes the engine's capped device pixel ratio.
    // Cap this extra render target to 1.5× CSS pixels on dense phone screens.
    const dprScale = Math.min(
      1,
      1.5 / Math.min(2, window.devicePixelRatio || 1),
    );
    const width = Math.max(1, Math.round(ctx.canvas.width * dprScale));
    const height = Math.max(1, Math.round(ctx.canvas.height * dprScale));
    if (width !== this.width || height !== this.height) {
      this.renderer.setSize(width, height, false);
      this.width = width;
      this.height = height;
    }
    placeCamera(this.camera, cam, view);
    const below =
      Math.ceil((H + 240 - cam.anchorY) / (SLAB_H * SCALE * cam.zoom)) + 2;
    const from =
      cam.zoom < 1 ? 1 : Math.max(1, Math.floor(cam.focusY / SLAB_H) - below);
    const count = Math.max(0, run.stack.length - from);
    if (count > this.tower.instanceMatrix.count) {
      this.scene.remove(this.tower);
      this.tower.dispose();
      this.tower = new InstancedMesh(
        this.geometry,
        this.material,
        Math.max(count, this.tower.instanceMatrix.count * 2),
      );
      this.tower.frustumCulled = false;
      this.scene.add(this.tower);
    }
    this.tower.count = count;
    const depth = PLINTH_H * 2.2;
    const base = run.stack[0];
    this.plinth.position.set(base.x, -depth / 2, base.z);
    this.plinth.scale.set(base.w, depth, base.d);
    this.plinth.material.color.copy(this.tint(hueFor(run, 0)));
    for (let i = from; i < run.stack.length; i++) {
      const h =
        i === run.stack.length - 1
          ? SLAB_H * (1 - 0.28 * Math.sin(squash * Math.PI))
          : SLAB_H;
      this.transform(this.pose, run.stack[i], (i - 1) * SLAB_H, h);
      this.tower.setMatrixAt(i - from, this.pose.matrix);
      this.tower.setColorAt(i - from, this.tint(hueFor(run, i)));
    }
    this.tower.instanceMatrix.needsUpdate = true;
    if (this.tower.instanceColor) this.tower.instanceColor.needsUpdate = true;

    this.mover.visible = moving !== null;
    if (moving) {
      this.transform(this.mover, moving, run.score * SLAB_H, SLAB_H);
      // A separate material keeps the tower's instance colours independent.
      if (this.mover.material === this.material)
        this.mover.material = this.material.clone();
      this.mover.material.color.copy(this.tint(hueFor(run, run.score + 1)));
    }
    for (let i = 0; i < pieces.length; i++) {
      const p = pieces[i];
      let mesh = this.fragments[i];
      if (!mesh) {
        mesh = new Mesh(
          this.geometry,
          new MeshLambertMaterial({ transparent: true }),
        );
        this.fragments.push(mesh);
        this.scene.add(mesh);
      }
      mesh.visible = true;
      this.transform(mesh, p.box, p.y, SLAB_H);
      mesh.rotation.set(p.rot * 0.65, p.rot * 0.2, p.rot);
      mesh.material.color.copy(this.tint(p.hue));
      mesh.material.opacity = p.opacity;
    }
    for (let i = pieces.length; i < this.fragments.length; i++)
      this.fragments[i].visible = false;
    // One batch of two-triangle contact patches, no shadow-map render pass.
    const capacity = count + 1;
    if (capacity > this.contacts.instanceMatrix.count) {
      this.scene.remove(this.contacts);
      this.contacts.dispose();
      this.contacts = new InstancedMesh(this.shadowGeometry, this.shadowMaterial, Math.max(capacity, this.contacts.instanceMatrix.count * 2));
      this.contacts.frustumCulled = false;
      this.scene.add(this.contacts);
    }
    let shadows = 0;
    const contact = (source: Box, receiver: Box, y: number) => {
      const patch = contactFootprint(source, receiver);
      if (!patch) return;
      this.pose.position.set(patch.x, y + 0.0005, patch.z);
      this.pose.scale.set(patch.w, 1, patch.d);
      this.pose.rotation.set(0, 0, 0);
      this.pose.updateMatrix();
      this.contacts.setMatrixAt(shadows++, this.pose.matrix);
    };
    for (let i = from; i < run.stack.length; i++) contact(run.stack[i], run.stack[i - 1], (i - 1) * SLAB_H);
    if (moving) {
      const topHeight = run.score * SLAB_H - (run.score > 0 ? SLAB_H * 0.28 * Math.sin(squash * Math.PI) : 0);
      contact(moving, run.stack[run.stack.length - 1], topHeight);
    }
    this.contacts.count = shadows;
    this.contacts.instanceMatrix.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
    ctx.drawImage(this.renderer.domElement, view.x, view.y, view.w, view.h);
    return true;
  }

  dispose() {
    for (const mesh of this.fragments) mesh.material.dispose();
    if (this.mover.material !== this.material) this.mover.material.dispose();
    this.tower.dispose();
    this.plinthGeometry.dispose();
    this.plinth.material.dispose();
    this.contacts.dispose();
    this.shadowGeometry.dispose();
    this.shadowMaterial.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
