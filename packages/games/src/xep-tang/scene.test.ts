import { OrthographicCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { type Camera, project } from "./art";
import { H, W } from "./config";
import { contactFootprint, placeCamera } from "./scene";

describe("3D camera and 2D overlay alignment", () => {
  it.each([
    [390, 844],
    [1440, 900],
    [844, 390],
  ])("matches the existing projection at %d × %d", (width, height) => {
    const scale = Math.min(width / W, height / H);
    const view = {
      x: (W - width / scale) / 2,
      y: (H - height / scale) / 2,
      w: width / scale,
      h: height / scale,
    };
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
    for (const zoom of [1, 0.35]) {
      const cam: Camera = { zoom, focusY: 12, anchorY: 510, dx: 7, dy: -3 };
      placeCamera(camera, cam, view);
      for (const [x, y, z] of [
        [0, 12, 0],
        [-1.25, 12.15, 0.5],
        [0.5, 0, -0.5],
      ]) {
        const point = new Vector3(x, y, z).project(camera);
        const expected = project(cam, x, y, z);
        expect(view.x + ((point.x + 1) * view.w) / 2).toBeCloseTo(
          expected.x,
          8,
        );
        expect(view.y + ((1 - point.y) * view.h) / 2).toBeCloseTo(
          expected.y,
          8,
        );
        expect(point.z).toBeGreaterThan(-1);
        expect(point.z).toBeLessThan(1);
      }
    }
  });
});


describe("contact shadows", () => {
  const receiver = { x: 0, z: 0, w: 1, d: 1 };
  it("does not shadow a support when the moving slab is outside it", () => {
    expect(contactFootprint({ ...receiver, x: 2 }, receiver)).toBeNull();
  });
  it("clips shadows to the support, including thin late-game slabs", () => {
    for (const support of [receiver, { x: 0.3, z: -0.2, w: 0.004, d: 0.01 }]) {
      const patch = contactFootprint(receiver, support);
      expect(patch).not.toBeNull();
      if (!patch) continue;
      expect(patch.x - patch.w / 2).toBeGreaterThanOrEqual(support.x - support.w / 2 - 1e-10);
      expect(patch.x + patch.w / 2).toBeLessThanOrEqual(support.x + support.w / 2 + 1e-10);
      expect(patch.z - patch.d / 2).toBeGreaterThanOrEqual(support.z - support.d / 2 - 1e-10);
      expect(patch.z + patch.d / 2).toBeLessThanOrEqual(support.z + support.d / 2 + 1e-10);
    }
  });
});
