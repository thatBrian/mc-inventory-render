import { describe, it, expect } from "vitest";
import { createCanvas, loadImage, Image } from "canvas";
import { readFileSync } from "node:fs";
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
import { getWindowLayout } from "../src/layout.js";

/** Node image loader: file:// and data: URLs via node-canvas. */
function nodeLoader(): ImageLoader {
  return {
    async load(url): Promise<LoadedImage | undefined> {
      try {
        let img: Image;
        if (url.startsWith("data:")) {
          img = await loadImage(url);
        } else {
          const path = url.startsWith("file:")
            ? fileURLToPath(url)
            : url;
          const buf = readFileSync(path);
          img = await loadImage(buf);
        }
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
}

function nodeOffscreen(): OffscreenFactory {
  return (w, h) => {
    const c = createCanvas(w, h);
    return {
      ctx: c.getContext("2d") as unknown as Ctx2D,
      canvas: c as unknown as CanvasImageSource,
    };
  };
}

function setup(version: string) {
  const provider = createMinecraftAssetsProvider(
    version,
    mcAssets,
    (faceKey, dir) => pathToFileURL(`${dir}blocks/${faceKey}.png`).href
  );
  const a = mcAssets(version)!;
  const guiUrl = (p: string) => pathToFileURL(`${a.directory}${p}`).href;
  return { provider, guiUrl };
}

/** Count non-transparent pixels in a region of a node canvas context. */
function nonEmptyPixels(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  x: number,
  y: number,
  w: number,
  h: number
): number {
  const data = ctx.getImageData(x, y, w, h).data;
  let n = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) n++;
  return n;
}

describe("renderInventory (node-canvas)", () => {
  it("renders to the expected scaled dimensions", async () => {
    const { provider, guiUrl } = setup("1.21.1");
    const canvas = createCanvas(10, 10);
    const ctx = canvas.getContext("2d");
    const input = parseInput({ version: "1.21.1", slots: [] });
    const size = await renderInventory(ctx as unknown as Ctx2D, input, {
      provider,
      loader: nodeLoader(),
      guiUrl,
      options: { scale: 4 },
    });
    const layout = getWindowLayout("inventory");
    expect(size.width).toBe(layout.width * 4);
    expect(size.height).toBe(layout.height * 4);
    expect(canvas.width).toBe(layout.width * 4);
  });

  it("draws a non-empty isometric block (oak_log) in its slot", async () => {
    const { provider, guiUrl } = setup("1.21.1");
    const canvas = createCanvas(10, 10);
    const ctx = canvas.getContext("2d");
    const input = parseInput({
      version: "1.21.1",
      slots: [{ slot: 36, name: "oak_log", count: 2 }],
    });
    await renderInventory(ctx as unknown as Ctx2D, input, {
      provider,
      loader: nodeLoader(),
      guiUrl,
      options: { scale: 4, drawBackground: false, offscreen: nodeOffscreen() },
    });
    const layout = getWindowLayout("inventory");
    const rect = layout.slots.find((s) => s.slot === 36)!;
    const s = 4;
    const drawn = nonEmptyPixels(ctx, rect.x * s, rect.y * s, 16 * s, 16 * s);
    // A composited cube fills a large share of the 64x64 icon area.
    expect(drawn).toBeGreaterThan(1000);
  });

  it("applies directional shading: top face brighter than sides", async () => {
    const { provider, guiUrl } = setup("1.21.1");
    const canvas = createCanvas(10, 10);
    const ctx = canvas.getContext("2d");
    const input = parseInput({
      version: "1.21.1",
      slots: [{ slot: 36, name: "stone" }],
    });
    await renderInventory(ctx as unknown as Ctx2D, input, {
      provider,
      loader: nodeLoader(),
      guiUrl,
      options: { scale: 8, drawBackground: false, offscreen: nodeOffscreen() },
    });
    const layout = getWindowLayout("inventory");
    const rect = layout.slots.find((s) => s.slot === 36)!;
    const s = 8;
    // Sample the top-center (top face) vs lower-left (a side face).
    const cx = rect.x * s + 8 * s;
    const topY = rect.y * s + 5 * s;
    const sideY = rect.y * s + 12 * s;
    const top = avgLuma(ctx, cx, topY);
    const side = avgLuma(ctx, rect.x * s + 4 * s, sideY);
    expect(top).toBeGreaterThan(side);
  });

  it("biome-tints the grass top green (not gray)", async () => {
    const { provider, guiUrl } = setup("1.21.1");
    const canvas = createCanvas(10, 10);
    const ctx = canvas.getContext("2d");
    const input = parseInput({
      version: "1.21.1",
      slots: [{ slot: 36, name: "grass_block" }],
    });
    await renderInventory(ctx as unknown as Ctx2D, input, {
      provider,
      loader: nodeLoader(),
      guiUrl,
      options: { scale: 8, drawBackground: false, offscreen: nodeOffscreen() },
    });
    const layout = getWindowLayout("inventory");
    const rect = layout.slots.find((s) => s.slot === 36)!;
    const s = 8;
    // Top-center sits on the (tinted) top diamond.
    const d = ctx.getImageData(rect.x * s + 8 * s, rect.y * s + 4 * s, 3, 3).data;
    const [r, g, b] = [d[0]!, d[1]!, d[2]!];
    expect(g).toBeGreaterThan(r); // green dominant
    expect(g).toBeGreaterThan(b);
  });

  it("respects a custom grass tint color", async () => {
    const { provider, guiUrl } = setup("1.21.1");
    const canvas = createCanvas(10, 10);
    const ctx = canvas.getContext("2d");
    const input = parseInput({
      version: "1.21.1",
      slots: [{ slot: 36, name: "grass_block" }],
    });
    await renderInventory(ctx as unknown as Ctx2D, input, {
      provider,
      loader: nodeLoader(),
      guiUrl,
      options: {
        scale: 8,
        drawBackground: false,
        offscreen: nodeOffscreen(),
        tint: { grass: "#ff0000" },
      },
    });
    const layout = getWindowLayout("inventory");
    const rect = layout.slots.find((s) => s.slot === 36)!;
    const s = 8;
    const d = ctx.getImageData(rect.x * s + 8 * s, rect.y * s + 4 * s, 3, 3).data;
    const [r, g, b] = [d[0]!, d[1]!, d[2]!];
    expect(r).toBeGreaterThan(g); // red dominant
    expect(r).toBeGreaterThan(b);
  });

  it("renders a flat item sprite (diamond_sword) non-empty", async () => {
    const { provider, guiUrl } = setup("1.21.1");
    const canvas = createCanvas(10, 10);
    const ctx = canvas.getContext("2d");
    const input = parseInput({
      version: "1.21.1",
      slots: [{ slot: 36, name: "diamond_sword", durability: 0.5 }],
    });
    await renderInventory(ctx as unknown as Ctx2D, input, {
      provider,
      loader: nodeLoader(),
      guiUrl,
      options: { scale: 4, drawBackground: false },
    });
    const layout = getWindowLayout("inventory");
    const rect = layout.slots.find((s) => s.slot === 36)!;
    const s = 4;
    const drawn = nonEmptyPixels(ctx, rect.x * s, rect.y * s, 16 * s, 16 * s);
    expect(drawn).toBeGreaterThan(100);
  });

  it("leaves a missing item's slot blank without throwing", async () => {
    const { provider, guiUrl } = setup("1.21.1");
    const canvas = createCanvas(10, 10);
    const ctx = canvas.getContext("2d");
    const input = parseInput({
      version: "1.21.1",
      slots: [{ slot: 36, name: "totally_not_real_xyz" }],
    });
    await expect(
      renderInventory(ctx as unknown as Ctx2D, input, {
        provider,
        loader: nodeLoader(),
        guiUrl,
        options: { scale: 4, drawBackground: false },
      })
    ).resolves.toBeDefined();
    const layout = getWindowLayout("inventory");
    const rect = layout.slots.find((s) => s.slot === 36)!;
    const s = 4;
    expect(nonEmptyPixels(ctx, rect.x * s, rect.y * s, 16 * s, 16 * s)).toBe(0);
  });

  it("works across multiple versions for oak_log", async () => {
    for (const v of ["1.16.4", "1.18.1", "1.20.2", "1.21.1"]) {
      const { provider, guiUrl } = setup(v);
      const canvas = createCanvas(10, 10);
      const ctx = canvas.getContext("2d");
      const input = parseInput({
        version: v,
        slots: [{ slot: 36, name: "oak_log" }],
      });
      await renderInventory(ctx as unknown as Ctx2D, input, {
        provider,
        loader: nodeLoader(),
        guiUrl,
        options: { scale: 4, drawBackground: false, offscreen: nodeOffscreen() },
      });
      const layout = getWindowLayout("inventory");
      const rect = layout.slots.find((s) => s.slot === 36)!;
      const s = 4;
      const drawn = nonEmptyPixels(ctx, rect.x * s, rect.y * s, 16 * s, 16 * s);
      expect(drawn, `version ${v}`).toBeGreaterThan(500);
    }
  });

  it("draws the window background when available", async () => {
    const { provider, guiUrl } = setup("1.21.1");
    const canvas = createCanvas(10, 10);
    const ctx = canvas.getContext("2d");
    const input = parseInput({ version: "1.21.1", slots: [] });
    await renderInventory(ctx as unknown as Ctx2D, input, {
      provider,
      loader: nodeLoader(),
      guiUrl,
      options: { scale: 2, drawBackground: true },
    });
    // Background fills the whole canvas with opaque pixels.
    const total = nonEmptyPixels(ctx, 0, 0, canvas.width, canvas.height);
    expect(total).toBeGreaterThan(canvas.width * canvas.height * 0.5);
  });
});

function avgLuma(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  x: number,
  y: number
): number {
  const d = ctx.getImageData(x, y, 3, 3).data;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3]! > 0) {
      sum += 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
      count++;
    }
  }
  return count ? sum / count : 0;
}
