import type { AssetProvider } from "./assets.js";
import { classify, resolveFaceTextures } from "./assets.js";
import { affineForParallelogram, DEFAULT_ISO, projectCube } from "./iso.js";
import type { IsoConfig } from "./types.js";
import { getWindowLayout, findSlotRect } from "./layout.js";
import type { ParsedInput } from "./parse.js";
import type { ImageLoader, LoadedImage } from "./imageSource.js";

/** Minimal 2D context surface we rely on (subset shared by DOM + node canvas). */
export interface Ctx2D {
  canvas: { width: number; height: number };
  imageSmoothingEnabled: boolean;
  save(): void;
  restore(): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  font: string;
  textBaseline: CanvasTextBaseline;
  textAlign: CanvasTextAlign;
  globalCompositeOperation: string;
  globalAlpha: number;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  clip(): void;
  fill(): void;
  setTransform(
    a: number,
    b: number,
    c: number,
    d: number,
    e: number,
    f: number
  ): void;
  resetTransform?(): void;
  translate(x: number, y: number): void;
  scale(x: number, y: number): void;
  drawImage(
    image: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number
  ): void;
  drawImage(image: CanvasImageSource, dx: number, dy: number): void;
  fillText(text: string, x: number, y: number): void;
  strokeText?(text: string, x: number, y: number): void;
}

/** Creates an offscreen tint buffer (needed for per-face shading). */
export interface OffscreenFactory {
  (w: number, h: number): { ctx: Ctx2D; canvas: CanvasImageSource } | undefined;
}

export interface RenderOptions {
  /** Integer GUI->pixel scale factor. Default 4. */
  scale?: number;
  /** Override iso configuration. */
  iso?: IsoConfig;
  /** Provide a background; if false, no window background is drawn. */
  drawBackground?: boolean;
  /** Background color used when the window texture cannot be loaded. */
  fallbackBackground?: string;
  /** Offscreen canvas factory for face shading. Optional but recommended. */
  offscreen?: OffscreenFactory;
}

const RESOLVED: Required<Omit<RenderOptions, "iso" | "offscreen">> & {
  iso: IsoConfig;
} = {
  scale: 4,
  iso: DEFAULT_ISO,
  drawBackground: true,
  fallbackBackground: "#c6c6c6",
};

export interface RenderContext {
  provider: AssetProvider;
  loader: ImageLoader;
  options?: RenderOptions;
  /** Resolves a window gui texture path to a loadable URL. */
  guiUrl: (path: string) => string;
}

/**
 * Render a parsed inventory onto a 2D context. Pure of any DOM specifics: the
 * context, loader, offscreen factory and url resolvers are all injected.
 * Returns the pixel dimensions written.
 */
export async function renderInventory(
  ctx: Ctx2D,
  input: ParsedInput,
  rc: RenderContext
): Promise<{ width: number; height: number }> {
  const opt = { ...RESOLVED, ...rc.options, iso: rc.options?.iso ?? DEFAULT_ISO };
  const layout = getWindowLayout(input.window);
  const s = Math.max(1, Math.floor(opt.scale));
  const width = layout.width * s;
  const height = layout.height * s;

  ctx.canvas.width = width;
  ctx.canvas.height = height;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);

  // Background
  if (opt.drawBackground) {
    const bg = await rc.loader.load(rc.guiUrl(layout.background));
    if (bg) {
      ctx.drawImage(
        bg.source,
        0,
        0,
        layout.width,
        layout.height,
        0,
        0,
        width,
        height
      );
    } else {
      ctx.fillStyle = opt.fallbackBackground;
      ctx.fillRect(0, 0, width, height);
    }
  }

  // Slots
  for (const slot of input.slots) {
    const rect = findSlotRect(layout, slot.slot);
    if (!rect) continue; // slot not present in this window; skip silently
    const ox = rect.x * s;
    const oy = rect.y * s;
    const iconPx = 16 * s;
    await drawSlot(ctx, slot, rc.provider, rc.loader, opt, ox, oy, iconPx, s);
  }

  return { width, height };
}

interface DrawOpt {
  iso: IsoConfig;
  offscreen?: OffscreenFactory;
}

async function drawSlot(
  ctx: Ctx2D,
  slot: { name: string; count: number; durability?: number },
  provider: AssetProvider,
  loader: ImageLoader,
  opt: DrawOpt,
  ox: number,
  oy: number,
  iconPx: number,
  scale: number
): Promise<void> {
  const kind = classify(slot.name, provider);

  if (kind === "block") {
    await drawIsoBlock(ctx, slot.name, provider, loader, opt, ox, oy, iconPx);
  } else if (kind === "item") {
    const url = provider.getItemTexture(slot.name);
    if (url) {
      const img = await loader.load(url);
      if (img) drawFlat(ctx, img, ox, oy, iconPx);
    }
  } else {
    // missing — try a flat sprite as a last resort, else leave blank
    const url = provider.getItemTexture(slot.name);
    if (url) {
      const img = await loader.load(url);
      if (img) drawFlat(ctx, img, ox, oy, iconPx);
    }
  }

  // Count badge
  if (slot.count > 1) {
    drawCount(ctx, slot.count, ox, oy, iconPx, scale);
  }
  // Durability bar
  if (slot.durability !== undefined && slot.durability < 1) {
    drawDurability(ctx, slot.durability, ox, oy, iconPx, scale);
  }
}

function drawFlat(
  ctx: Ctx2D,
  img: LoadedImage,
  ox: number,
  oy: number,
  iconPx: number
): void {
  // Item sprites may be animated sheets (height = N*width). Use the top frame.
  const frameH = img.width; // square frame
  const sh = img.height >= frameH ? frameH : img.height;
  ctx.drawImage(img.source, 0, 0, img.width, sh, ox, oy, iconPx, iconPx);
}

async function drawIsoBlock(
  ctx: Ctx2D,
  name: string,
  provider: AssetProvider,
  loader: ImageLoader,
  opt: DrawOpt,
  ox: number,
  oy: number,
  iconPx: number
): Promise<void> {
  const model = provider.getBlockModel(name);
  const faces = resolveFaceTextures(model?.textures);
  if (!faces) return;

  const [topImg, leftImg, rightImg] = await Promise.all([
    loadFace(provider, loader, faces.top),
    loadFace(provider, loader, faces.left),
    loadFace(provider, loader, faces.right),
  ]);

  const geom = projectCube(opt.iso);
  // Fit the projected cube bounding box into the icon box.
  const bw = geom.bounds.maxX - geom.bounds.minX;
  const bh = geom.bounds.maxY - geom.bounds.minY;
  const fit = Math.min(iconPx / bw, iconPx / bh);
  // Center within the icon box.
  const cx = ox + iconPx / 2;
  const cy = oy + iconPx / 2;
  const midX = (geom.bounds.minX + geom.bounds.maxX) / 2;
  const midY = (geom.bounds.minY + geom.bounds.maxY) / 2;

  const project = (p: { x: number; y: number }) => ({
    x: cx + (p.x - midX) * fit,
    y: cy + (p.y - midY) * fit,
  });

  const faceImg = { top: topImg, left: leftImg, right: rightImg };

  // Draw back-to-front isn't required (no overlap among the 3 visible faces),
  // but draw sides first then top for clean seams.
  for (const f of geom.faces) {
    const img = faceImg[f.face];
    if (!img) continue;
    const shaded = applyShade(img, f.shade, opt.offscreen);
    const [a, b, c, d] = f.quad.map(project) as [
      { x: number; y: number },
      { x: number; y: number },
      { x: number; y: number },
      { x: number; y: number }
    ];
    // Map the square face texture onto the parallelogram (a=origin, b=u, d=v).
    drawTexturedQuad(ctx, shaded, a, b, d, img.width, img.height);
  }
}

async function loadFace(
  provider: AssetProvider,
  loader: ImageLoader,
  faceKey: string
): Promise<LoadedImage | undefined> {
  const url = provider.getBlockFaceTexture(faceKey);
  if (!url) return undefined;
  return loader.load(url);
}

/**
 * Draw a square texture onto a parallelogram via an affine setTransform.
 * a = destination of source (0,0); b = destination of source (w,0);
 * d = destination of source (0,h). Clips to the quad to avoid bleed.
 */
function drawTexturedQuad(
  ctx: Ctx2D,
  img: LoadedImage,
  a: { x: number; y: number },
  b: { x: number; y: number },
  d: { x: number; y: number },
  w: number,
  h: number
): void {
  ctx.save();
  // Compute the 4th corner and clip the parallelogram.
  const c = { x: b.x + d.x - a.x, y: b.y + d.y - a.y };
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.clip();
  const m = affineForParallelogram(a, b, d, w, h);
  ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
  ctx.drawImage(img.source, 0, 0);
  if (ctx.resetTransform) ctx.resetTransform();
  else ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.restore();
}

/**
 * Produce a brightness-multiplied copy of an image using an offscreen buffer.
 * If no offscreen factory is available, returns the original (unshaded).
 */
function applyShade(
  img: LoadedImage,
  shade: number,
  offscreen?: OffscreenFactory
): LoadedImage {
  if (shade >= 0.999 || !offscreen) return img;
  const buf = offscreen(img.width, img.height);
  if (!buf) return img;
  const { ctx, canvas } = buf;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, img.width, img.height);
  ctx.drawImage(img.source, 0, 0);
  // Multiply by a gray to darken, preserving alpha.
  ctx.globalCompositeOperation = "multiply";
  const v = Math.round(shade * 255);
  ctx.fillStyle = `rgb(${v},${v},${v})`;
  ctx.fillRect(0, 0, img.width, img.height);
  // Restore alpha channel (multiply with gray keeps alpha; ensure transparent
  // pixels stay transparent by masking against the source alpha).
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(img.source, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  return { width: img.width, height: img.height, source: canvas };
}

const COUNT_FONT_PX = 8;

function drawCount(
  ctx: Ctx2D,
  count: number,
  ox: number,
  oy: number,
  iconPx: number,
  scale: number
): void {
  const text = String(count);
  ctx.save();
  ctx.font = `${COUNT_FONT_PX * scale}px monospace`;
  ctx.textBaseline = "bottom";
  ctx.textAlign = "right";
  const x = ox + iconPx - scale;
  const y = oy + iconPx + scale;
  // Drop shadow then white text (mimics Minecraft font shadow).
  ctx.fillStyle = "#3f3f3f";
  ctx.fillText(text, x + scale, y + scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawDurability(
  ctx: Ctx2D,
  durability: number,
  ox: number,
  oy: number,
  iconPx: number,
  scale: number
): void {
  // Vanilla durability bar: 13px wide, at the bottom of the icon, 2px tall.
  const barW = 13 * scale;
  const barH = 2 * scale;
  const bx = ox + 2 * scale;
  const by = oy + iconPx - 3 * scale;
  // Background (dark).
  ctx.save();
  ctx.fillStyle = "#000000";
  ctx.fillRect(bx, by, barW, barH);
  // Foreground colored by remaining fraction (red->green via HSL hue 0..120).
  const frac = Math.max(0, Math.min(1, durability));
  const hue = Math.round(frac * 120);
  ctx.fillStyle = hslToHex(hue, 1, 0.5);
  ctx.fillRect(bx, by, Math.round(barW * frac), scale);
  ctx.restore();
}

function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
