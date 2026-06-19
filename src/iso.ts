import type { IsoConfig } from "./types.js";

/**
 * Default isometric configuration matching Minecraft's block inventory icons.
 *
 * Minecraft renders block GUI icons by applying the block model's
 * `display.gui` transform: rotation [30, 225] degrees and scale 0.625, then
 * projecting orthographically. The visual result is the familiar "diamond top
 * + two darker sides" cube. Vanilla applies directional face shading: the top
 * face at full brightness, and the two visible vertical faces dimmed (the
 * north/south ~0.8 and east/west ~0.6 in the vanilla lighting model; for the
 * two sides shown here we use ~0.88 and ~0.72 which reads correctly at icon
 * size).
 */
export const DEFAULT_ISO: IsoConfig = {
  topShade: 1.0,
  leftShade: 0.72,
  rightShade: 0.88,
  rotation: [30, 225],
  scale: 0.625,
};

export interface Point {
  x: number;
  y: number;
}

/** A face polygon: 4 corners in screen space, plus its source-texture mapping. */
export interface FacePolygon {
  /** Screen-space quad corners in order: a, b, c, d. */
  quad: [Point, Point, Point, Point];
  /** Brightness multiplier to apply to the face texture. */
  shade: number;
  /** Which face this is. */
  face: "top" | "left" | "right";
}

/** The full set of projected face polygons for a cube, within a unit box. */
export interface CubeGeometry {
  faces: FacePolygon[];
  /** Bounding box of all polygons (in the same screen units). */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

function rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** 3D point. */
interface V3 {
  x: number;
  y: number;
  z: number;
}

function rotateX(p: V3, a: number): V3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
}

function rotateY(p: V3, a: number): V3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
}

/**
 * Project a cube and return the three visible faces (top, left, right) as
 * screen-space parallelograms, ready for affine texture mapping.
 *
 * The math: take a unit cube centered at the origin, apply the gui rotation
 * (rotate Y by -rotation[1], then X by rotation[0] — the order/sign chosen so
 * the +Y face becomes the top diamond and two adjacent faces face the viewer),
 * then drop Z (orthographic) and flip Y for screen coordinates. With
 * rotation [30, 225] the top face becomes a 2:1 diamond and the bounding box
 * is ~1.11x taller than it is wide, matching vanilla.
 *
 * Output coordinates are unscaled (roughly the cube's projected extent); the
 * renderer scales/translates them into the target icon box.
 */
export function projectCube(config: IsoConfig = DEFAULT_ISO): CubeGeometry {
  const [rx, ry] = config.rotation;
  const ax = rad(rx);
  const ay = rad(ry);

  // Unit cube corners, edge length 1, centered at origin.
  const h = 0.5;
  // Name corners by sign of (x, y, z). y is up.
  const corner = (sx: number, sy: number, sz: number): Point => {
    let p: V3 = { x: sx * h, y: sy * h, z: sz * h };
    p = rotateY(p, ay);
    p = rotateX(p, ax);
    // Orthographic projection: drop z. Flip y so +y is up on screen.
    return { x: p.x * config.scale, y: -p.y * config.scale };
  };

  // Cube vertices.
  const v = {
    // top face (y = +1)
    tnw: corner(-1, +1, -1),
    tne: corner(+1, +1, -1),
    tse: corner(+1, +1, +1),
    tsw: corner(-1, +1, +1),
    // bottom face (y = -1)
    bnw: corner(-1, -1, -1),
    bne: corner(+1, -1, -1),
    bse: corner(+1, -1, +1),
    bsw: corner(-1, -1, +1),
  };

  // With rotation [30, 225] the viewer sees the top plus the two vertical faces
  // that share the near vertical edge (tne–bne): the east (+x) and north (-z)
  // faces. (The south/west faces point away from the camera and are culled.)
  const top: FacePolygon = {
    face: "top",
    shade: config.topShade,
    quad: [v.tnw, v.tne, v.tse, v.tsw],
  };
  // Left visible side: east face (x = +1): tse, tne, bne, bse
  const left: FacePolygon = {
    face: "left",
    shade: config.leftShade,
    quad: [v.tse, v.tne, v.bne, v.bse],
  };
  // Right visible side: north face (z = -1): tne, tnw, bnw, bne
  const right: FacePolygon = {
    face: "right",
    shade: config.rightShade,
    quad: [v.tne, v.tnw, v.bnw, v.bne],
  };

  const faces = [top, left, right];
  const all = faces.flatMap((f) => f.quad);
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const bounds = {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };

  return { faces, bounds };
}

/**
 * Affine transform (a, b, c, d, e, f for setTransform) that maps the unit
 * source texture square [0..w]x[0..h] onto the parallelogram defined by three
 * destination corners p0 (origin / source 0,0), p1 (source w,0) and
 * p2 (source 0,h). The fourth corner is implied (p1 + p2 - p0).
 *
 * This is exactly the transform needed to draw a square texture onto one of
 * the cube's faces.
 */
export function affineForParallelogram(
  p0: Point,
  p1: Point,
  p2: Point,
  w: number,
  h: number
): [number, number, number, number, number, number] {
  // x' = a*sx + c*sy + e ; y' = b*sx + d*sy + f
  const a = (p1.x - p0.x) / w;
  const b = (p1.y - p0.y) / w;
  const c = (p2.x - p0.x) / h;
  const d = (p2.y - p0.y) / h;
  const e = p0.x;
  const f = p0.y;
  return [a, b, c, d, e, f];
}
