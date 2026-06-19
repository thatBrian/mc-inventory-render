import { describe, it, expect, vi } from "vitest";
import { createCdnProvider } from "../src/cdnProvider.js";
import { classify } from "../src/assets.js";

const MODELS = {
  oak_log: {
    parent: "block/cube_column",
    textures: { end: "block/oak_log_top", side: "block/oak_log" },
  },
  stone: { parent: "block/cube_all", textures: { all: "block/stone" } },
};

function fakeFetch(ok = true) {
  return vi.fn(async () => ({
    ok,
    status: ok ? 200 : 404,
    json: async () => MODELS,
  })) as unknown as typeof fetch;
}

describe("createCdnProvider", () => {
  it("fetches the version's block models and resolves blocks", async () => {
    const p = await createCdnProvider("1.21.1", { fetchImpl: fakeFetch() });
    expect(p.version).toBe("1.21.1");
    expect(classify("oak_log", p)).toBe("block");
    expect(classify("stone", p)).toBe("block");
  });

  it("builds CDN urls for item and face textures", async () => {
    const p = await createCdnProvider("1.20.2", {
      base: "https://cdn.example/data",
      fetchImpl: fakeFetch(),
    });
    expect(p.getItemTexture("diamond_sword")).toBe(
      "https://cdn.example/data/1.20.2/items/diamond_sword.png"
    );
    expect(p.getBlockFaceTexture("oak_log_top")).toBe(
      "https://cdn.example/data/1.20.2/blocks/oak_log_top.png"
    );
  });

  it("strips the minecraft: namespace in item urls", async () => {
    const p = await createCdnProvider("1.21.1", {
      base: "b",
      fetchImpl: fakeFetch(),
    });
    expect(p.getItemTexture("minecraft:apple")).toBe("b/1.21.1/items/apple.png");
  });

  it("throws when the model fetch fails", async () => {
    await expect(
      createCdnProvider("9.9.9", { fetchImpl: fakeFetch(false) })
    ).rejects.toThrow(/Could not load block models/);
  });
});
