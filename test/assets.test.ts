import { describe, it, expect } from "vitest";
import {
  normalizeName,
  textureRefToFaceKey,
  resolveFaceTextures,
  resolveFaceLayers,
  tintClassFor,
  classify,
  type AssetProvider,
  type BlockModel,
} from "../src/assets.js";

describe("tintClassFor", () => {
  it("classifies grass-family textures as grass", () => {
    expect(tintClassFor("grass_block_top")).toBe("grass");
    expect(tintClassFor("grass_block_side_overlay")).toBe("grass");
    expect(tintClassFor("short_grass")).toBe("grass");
    expect(tintClassFor("fern")).toBe("grass");
  });
  it("classifies biome-tinted leaves as foliage, constant-color leaves on their own", () => {
    expect(tintClassFor("oak_leaves")).toBe("foliage");
    expect(tintClassFor("jungle_leaves")).toBe("foliage");
    expect(tintClassFor("vine")).toBe("foliage");
    expect(tintClassFor("spruce_leaves")).toBe("spruce");
    expect(tintClassFor("birch_leaves")).toBe("birch");
    expect(tintClassFor("lily_pad")).toBe("lilypad");
  });
  it("returns undefined for untinted textures", () => {
    expect(tintClassFor("stone")).toBeUndefined();
    expect(tintClassFor("oak_log")).toBeUndefined();
    expect(tintClassFor("grass_block_side")).toBeUndefined(); // dirt base, not tinted
  });
});

describe("resolveFaceLayers", () => {
  it("returns single untinted layers for a uniform block", () => {
    const f = resolveFaceLayers({ all: "minecraft:block/stone" });
    expect(f).toEqual({
      top: [{ key: "stone" }],
      left: [{ key: "stone" }],
      right: [{ key: "stone" }],
    });
  });

  it("tints the grass top and adds a tinted side overlay", () => {
    const f = resolveFaceLayers({
      top: "block/grass_block_top",
      side: "block/grass_block_side",
      overlay: "block/grass_block_side_overlay",
    });
    expect(f).toEqual({
      top: [{ key: "grass_block_top", tint: "grass" }],
      left: [
        { key: "grass_block_side" },
        { key: "grass_block_side_overlay", tint: "grass" },
      ],
      right: [
        { key: "grass_block_side" },
        { key: "grass_block_side_overlay", tint: "grass" },
      ],
    });
  });

  it("returns undefined for empty/missing textures", () => {
    expect(resolveFaceLayers(undefined)).toBeUndefined();
    expect(resolveFaceLayers({})).toBeUndefined();
  });
});

describe("normalizeName", () => {
  it("strips minecraft namespace", () => {
    expect(normalizeName("minecraft:oak_log")).toBe("oak_log");
  });
  it("trims whitespace", () => {
    expect(normalizeName("  stone  ")).toBe("stone");
  });
  it("passes through plain names", () => {
    expect(normalizeName("diamond_sword")).toBe("diamond_sword");
  });
});

describe("textureRefToFaceKey", () => {
  it("strips namespace and path prefix", () => {
    expect(textureRefToFaceKey("minecraft:block/oak_log_top")).toBe(
      "oak_log_top"
    );
  });
  it("handles block/ without namespace", () => {
    expect(textureRefToFaceKey("block/grass_block_side")).toBe(
      "grass_block_side"
    );
  });
});

describe("resolveFaceTextures", () => {
  it("resolves a uniform cube_all block (all)", () => {
    const f = resolveFaceTextures({ all: "minecraft:block/stone" });
    expect(f).toEqual({ top: "stone", left: "stone", right: "stone" });
  });

  it("resolves a pillar/log (end + side)", () => {
    const f = resolveFaceTextures({
      end: "minecraft:block/oak_log_top",
      side: "minecraft:block/oak_log",
    });
    expect(f).toEqual({
      top: "oak_log_top",
      left: "oak_log",
      right: "oak_log",
    });
  });

  it("resolves grass (top + side)", () => {
    const f = resolveFaceTextures({
      top: "block/grass_block_top",
      side: "block/grass_block_side",
      bottom: "block/dirt",
    });
    expect(f).toEqual({
      top: "grass_block_top",
      left: "grass_block_side",
      right: "grass_block_side",
    });
  });

  it("prefers up over top over end", () => {
    const f = resolveFaceTextures({
      up: "block/a",
      top: "block/b",
      end: "block/c",
      side: "block/d",
    });
    expect(f?.top).toBe("a");
  });

  it("resolves texture variable references (#var)", () => {
    const f = resolveFaceTextures({
      texture: "#all",
      all: "minecraft:block/dirt",
    });
    expect(f?.top).toBe("dirt");
  });

  it("returns undefined for empty/missing textures", () => {
    expect(resolveFaceTextures(undefined)).toBeUndefined();
    expect(resolveFaceTextures({})).toBeUndefined();
  });
});

// --- fake provider for classify ---
function makeProvider(opts: {
  models?: Record<string, BlockModel>;
  items?: Set<string>;
  faces?: Set<string>;
}): AssetProvider {
  return {
    version: "test",
    getItemTexture: (n) =>
      opts.items?.has(n.replace("minecraft:", "")) ? "data:img" : undefined,
    getBlockModel: (n) => opts.models?.[n.replace("minecraft:", "")],
    getBlockFaceTexture: (k) =>
      opts.faces?.has(k) ? `file://${k}.png` : undefined,
  };
}

describe("classify", () => {
  it("classifies a block when model + face textures exist", () => {
    const p = makeProvider({
      models: { stone: { textures: { all: "block/stone" } } },
      faces: new Set(["stone"]),
    });
    expect(classify("stone", p)).toBe("block");
  });

  it("falls back to item when model has no resolvable face files", () => {
    const p = makeProvider({
      models: { torch: { textures: { all: "block/torch" } } },
      faces: new Set(), // no face files
      items: new Set(["torch"]),
    });
    expect(classify("torch", p)).toBe("item");
  });

  it("classifies an item when only a sprite exists", () => {
    const p = makeProvider({ items: new Set(["diamond_sword"]) });
    expect(classify("diamond_sword", p)).toBe("item");
  });

  it("returns missing when nothing is found", () => {
    const p = makeProvider({});
    expect(classify("nonexistent_xyz", p)).toBe("missing");
  });

  it("handles namespaced names", () => {
    const p = makeProvider({ items: new Set(["apple"]) });
    expect(classify("minecraft:apple", p)).toBe("item");
  });
});
