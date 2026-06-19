import { describe, it, expect } from "vitest";
import {
  projectCube,
  affineForParallelogram,
  DEFAULT_ISO,
} from "../src/iso.js";

describe("projectCube", () => {
  const geom = projectCube();

  it("produces exactly three visible faces: top, left, right", () => {
    expect(geom.faces.map((f) => f.face).sort()).toEqual([
      "left",
      "right",
      "top",
    ]);
  });

  it("applies vanilla-style shading (top brightest, sides dimmer)", () => {
    const byFace = Object.fromEntries(geom.faces.map((f) => [f.face, f.shade]));
    expect(byFace.top).toBe(1.0);
    expect(byFace.right).toBeLessThan(byFace.top!);
    expect(byFace.left).toBeLessThan(byFace.right!);
    expect(byFace.left).toBeGreaterThan(0.5);
  });

  it("renders the top face as a 2:1 diamond", () => {
    const top = geom.faces.find((f) => f.face === "top")!;
    const xs = top.quad.map((p) => p.x);
    const ys = top.quad.map((p) => p.y);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);
    expect(w / h).toBeCloseTo(2, 2);
  });

  it("has a bounding box ~1.11x taller than wide", () => {
    const w = geom.bounds.maxX - geom.bounds.minX;
    const h = geom.bounds.maxY - geom.bounds.minY;
    expect(h / w).toBeCloseTo(1.112, 2);
  });

  it("uses the standard gui transform [30, 225] scale 0.625", () => {
    expect(DEFAULT_ISO.rotation).toEqual([30, 225]);
    expect(DEFAULT_ISO.scale).toBeCloseTo(0.625);
  });

  it("is a stable snapshot of cube geometry", () => {
    const rounded = geom.faces.map((f) => ({
      face: f.face,
      shade: f.shade,
      quad: f.quad.map((p) => ({
        x: Number(p.x.toFixed(4)),
        y: Number(p.y.toFixed(4)),
      })),
    }));
    expect(rounded).toMatchSnapshot();
  });

  it("respects custom iso config (scale changes extent)", () => {
    const big = projectCube({ ...DEFAULT_ISO, scale: 1.25 });
    const bw = big.bounds.maxX - big.bounds.minX;
    const sw = geom.bounds.maxX - geom.bounds.minX;
    expect(bw).toBeCloseTo(sw * 2, 4);
  });
});

describe("affineForParallelogram", () => {
  it("maps the source square corners to the destination corners", () => {
    const p0 = { x: 10, y: 20 };
    const p1 = { x: 26, y: 20 }; // u axis
    const p2 = { x: 10, y: 36 }; // v axis
    const [a, b, c, d, e, f] = affineForParallelogram(p0, p1, p2, 16, 16);
    // source (0,0) -> p0
    expect(e).toBe(10);
    expect(f).toBe(20);
    // source (16,0) -> p1
    expect(a * 16 + c * 0 + e).toBeCloseTo(26);
    expect(b * 16 + d * 0 + f).toBeCloseTo(20);
    // source (0,16) -> p2
    expect(a * 0 + c * 16 + e).toBeCloseTo(10);
    expect(b * 0 + d * 16 + f).toBeCloseTo(36);
  });

  it("handles sheared parallelograms (iso side face)", () => {
    const p0 = { x: 0, y: 0 };
    const p1 = { x: 10, y: 5 };
    const p2 = { x: 0, y: 16 };
    const m = affineForParallelogram(p0, p1, p2, 16, 16);
    // u axis is sheared
    expect(m[0]).toBeCloseTo(10 / 16);
    expect(m[1]).toBeCloseTo(5 / 16);
  });
});
