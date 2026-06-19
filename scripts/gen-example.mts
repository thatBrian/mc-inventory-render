/**
 * Regenerate docs/example.png — the README showcase image.
 * Renders a representative inventory with the library's own renderer
 * (node-canvas) so the committed image always reflects current geometry.
 *
 *   npx tsx scripts/gen-example.mts
 */
import { createCanvas, loadImage, type Image } from "canvas";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
import mcAssets from "minecraft-assets";
import { createMinecraftAssetsProvider } from "../src/minecraftAssetsProvider.js";
import { parseInput } from "../src/parse.js";
import {
  renderInventory,
  type Ctx2D,
  type OffscreenFactory,
} from "../src/renderer.js";
import type { ImageLoader, LoadedImage } from "../src/imageSource.js";

const loader: ImageLoader = {
  async load(url) {
    try {
      let img: Image;
      if (url.startsWith("data:")) img = await loadImage(url);
      else
        img = await loadImage(
          readFileSync(url.startsWith("file:") ? fileURLToPath(url) : url)
        );
      return {
        width: img.width,
        height: img.height,
        source: img as unknown as CanvasImageSource,
      };
    } catch {
      return undefined;
    }
  },
};

const offscreen: OffscreenFactory = (w, h) => {
  const c = createCanvas(w, h);
  return {
    ctx: c.getContext("2d") as unknown as Ctx2D,
    canvas: c as unknown as CanvasImageSource,
  };
};

const version = "1.21.1";
const provider = createMinecraftAssetsProvider(
  version,
  mcAssets as never,
  (faceKey, dir) => pathToFileURL(`${dir}blocks/${faceKey}.png`).href
);
const a = (mcAssets as never as (v: string) => { directory: string })(version);
const guiUrl = (p: string) => pathToFileURL(`${a.directory}${p}`).href;

const input = parseInput({
  version,
  window: "inventory",
  slots: [
    // Main inventory top row (9–17): a block showcase exercising every
    // face-resolution path (uniform, top+side, end+side, distinct faces).
    { slot: 9, name: "oak_log", count: 64 },
    { slot: 10, name: "grass_block", count: 12 },
    { slot: 11, name: "stone", count: 64 },
    { slot: 12, name: "diamond_block", count: 5 },
    { slot: 13, name: "crafting_table" },
    { slot: 14, name: "oak_planks", count: 32 },
    { slot: 15, name: "bookshelf" },
    { slot: 16, name: "tnt" },
    { slot: 17, name: "furnace" },
    // Hotbar (36–39): flat item sprites, counts, and a durability bar.
    { slot: 36, name: "diamond_sword", durability: 0.85 },
    { slot: 37, name: "diamond_pickaxe", durability: 0.4 },
    { slot: 38, name: "apple", count: 3 },
    { slot: 39, name: "bow" },
  ],
});

const SCALE = 4;
const canvas = createCanvas(10, 10);
const ctx = canvas.getContext("2d");
const { width, height } = await renderInventory(ctx as unknown as Ctx2D, input, {
  provider,
  loader,
  guiUrl,
  options: { scale: SCALE, drawBackground: true, offscreen },
});
writeFileSync("docs/example.png", canvas.toBuffer("image/png"));
console.log(`wrote docs/example.png (${width}x${height})`);
