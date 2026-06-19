import type { InventoryInput } from "./types.js";
import { parseInput } from "./parse.js";
import { createCdnProvider, DEFAULT_CDN_BASE } from "./cdnProvider.js";
import type { AssetProvider } from "./assets.js";
import {
  browserImageLoader,
  cachedLoader,
  type ImageLoader,
} from "./imageSource.js";
import {
  renderInventory,
  type Ctx2D,
  type OffscreenFactory,
  type RenderOptions,
} from "./renderer.js";
import { getWindowLayout } from "./layout.js";

export * from "./types.js";
export { parseInput, InventoryInputError, DEFAULT_VERSION } from "./parse.js";
export type { ParsedInput, NormalizedSlot } from "./parse.js";
export {
  classify,
  resolveFaceTextures,
  resolveFaceLayers,
  tintClassFor,
  DEFAULT_TINT,
  normalizeName,
  textureRefToFaceKey,
} from "./assets.js";
export type {
  AssetProvider,
  BlockModel,
  TintClass,
  FaceLayer,
  BlockFaceLayers,
} from "./assets.js";
export {
  projectCube,
  affineForParallelogram,
  DEFAULT_ISO,
} from "./iso.js";
export type { CubeGeometry, FacePolygon, Point } from "./iso.js";
export { getWindowLayout, findSlotRect, layoutConstants } from "./layout.js";
export type { WindowLayout, SlotRect } from "./layout.js";
export { createMinecraftAssetsProvider } from "./minecraftAssetsProvider.js";
export { createCdnProvider, DEFAULT_CDN_BASE } from "./cdnProvider.js";
export {
  renderInventory,
  type Ctx2D,
  type RenderOptions,
  type RenderContext,
  type OffscreenFactory,
} from "./renderer.js";
export {
  browserImageLoader,
  cachedLoader,
  type ImageLoader,
  type LoadedImage,
} from "./imageSource.js";

/** Options controlling how assets are located in a browser context. */
export interface RenderToCanvasOptions extends RenderOptions {
  /**
   * Base URL where the minecraft-assets data tree is served (must contain the
   * version directory layout, e.g. `<base>/<version>/blocks/<file>.png`). When
   * omitted, the jsDelivr CDN for minecraft-assets is used.
   */
  assetsBaseUrl?: string;
  /** Override the asset provider entirely (advanced/testing). */
  provider?: AssetProvider;
  /** Override the image loader (advanced/testing). */
  loader?: ImageLoader;
}

const CDN_BASE = DEFAULT_CDN_BASE;

function defaultOffscreen(): OffscreenFactory | undefined {
  if (typeof document === "undefined") return undefined;
  return (w, h) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return undefined;
    return { ctx: ctx as unknown as Ctx2D, canvas: c };
  };
}

/**
 * Render an inventory described by JSON onto an existing canvas (browser).
 * Resolves async because the block-model map and textures are loaded over the
 * network from the CDN. No version data is bundled.
 */
export async function renderToCanvas(
  input: InventoryInput | string,
  canvas: HTMLCanvasElement,
  options: RenderToCanvasOptions = {}
): Promise<{ width: number; height: number }> {
  const parsed = parseInput(input);
  const base = options.assetsBaseUrl ?? CDN_BASE;
  const provider =
    options.provider ?? (await createCdnProvider(parsed.version, { base }));
  const loader = options.loader ?? cachedLoader(browserImageLoader());

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get a 2D context from the canvas");

  return renderInventory(ctx as unknown as Ctx2D, parsed, {
    provider,
    loader,
    options: { offscreen: defaultOffscreen(), ...options },
    guiUrl: (path) => {
      // path is like "gui/container/inventory.png"
      return `${base}/${parsed.version}/${path}`;
    },
  });
}

/**
 * Render an inventory to a PNG data URL (browser). Creates an offscreen canvas.
 */
export async function renderToDataURL(
  input: InventoryInput | string,
  options: RenderToCanvasOptions = {}
): Promise<string> {
  if (typeof document === "undefined") {
    throw new Error(
      "renderToDataURL requires a DOM. In Node, render onto a node-canvas instance with renderInventory()."
    );
  }
  const parsed = parseInput(input);
  const layout = getWindowLayout(parsed.window);
  const scale = Math.max(1, Math.floor(options.scale ?? 4));
  const canvas = document.createElement("canvas");
  canvas.width = layout.width * scale;
  canvas.height = layout.height * scale;
  await renderToCanvas(input, canvas, options);
  return canvas.toDataURL("image/png");
}
