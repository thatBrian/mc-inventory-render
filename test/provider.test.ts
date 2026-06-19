import { describe, it, expect } from "vitest";
import mcAssets from "minecraft-assets";
import { createMinecraftAssetsProvider } from "../src/minecraftAssetsProvider.js";
import { classify, resolveFaceTextures } from "../src/assets.js";

const VERSIONS = ["1.16.4", "1.18.1", "1.20.2", "1.21.1"];

describe("createMinecraftAssetsProvider (real assets)", () => {
  it("throws on a version with no data", () => {
    expect(() =>
      createMinecraftAssetsProvider("0.0.0-nope", mcAssets)
    ).toThrow(/no data/);
  });

  for (const v of VERSIONS) {
    describe(`version ${v}`, () => {
      const p = createMinecraftAssetsProvider(v, mcAssets);

      it("resolves an item sprite as a data URL", () => {
        const tex = p.getItemTexture("diamond_sword");
        expect(tex).toMatch(/^data:image\/png;base64,/);
      });

      it("classifies oak_log as a block with end+side faces", () => {
        expect(classify("oak_log", p)).toBe("block");
        const f = resolveFaceTextures(p.getBlockModel("oak_log")?.textures)!;
        expect(f.top).toContain("oak_log_top");
        expect(f.left).toContain("oak_log");
      });

      it("classifies stone as a uniform block", () => {
        expect(classify("stone", p)).toBe("block");
        const f = resolveFaceTextures(p.getBlockModel("stone")?.textures)!;
        expect(f.top).toBe("stone");
        expect(f.left).toBe("stone");
      });

      it("classifies grass_block with distinct top/side", () => {
        expect(classify("grass_block", p)).toBe("block");
        const f = resolveFaceTextures(p.getBlockModel("grass_block")?.textures)!;
        expect(f.top).toContain("grass_block_top");
        expect(f.left).toContain("grass_block_side");
      });

      it("classifies diamond_sword as an item", () => {
        expect(classify("diamond_sword", p)).toBe("item");
      });

      it("classifies a nonexistent name as missing", () => {
        expect(classify("totally_not_real_block_xyz", p)).toBe("missing");
      });

      it("builds a filesystem block face path under the version directory", () => {
        const url = p.getBlockFaceTexture("oak_log_top");
        expect(url).toContain("blocks/oak_log_top.png");
      });
    });
  }

  it("handles a version-specific item gracefully (cherry not in 1.16.4)", () => {
    const old = createMinecraftAssetsProvider("1.16.4", mcAssets);
    // cherry_planks added in 1.20 — should be missing in 1.16.4, not throw.
    expect(classify("cherry_planks", old)).toBe("missing");
    const recent = createMinecraftAssetsProvider("1.21.1", mcAssets);
    expect(classify("cherry_planks", recent)).toBe("block");
  });
});
