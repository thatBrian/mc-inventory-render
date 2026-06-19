import { describe, it, expect } from "vitest";
import {
  parseInput,
  InventoryInputError,
  DEFAULT_VERSION,
} from "../src/parse.js";

describe("parseInput", () => {
  it("fills defaults for version and window", () => {
    const p = parseInput({ slots: [] });
    expect(p.version).toBe(DEFAULT_VERSION);
    expect(p.window).toBe("inventory");
    expect(p.slots).toEqual([]);
  });

  it("accepts a JSON string", () => {
    const p = parseInput('{"version":"1.20.2","slots":[{"slot":0,"name":"stone"}]}');
    expect(p.version).toBe("1.20.2");
    expect(p.slots[0]).toEqual({ slot: 0, name: "stone", count: 1 });
  });

  it("normalizes count default to 1 and trims names", () => {
    const p = parseInput({ slots: [{ slot: 5, name: "  oak_log  " }] });
    expect(p.slots[0]).toEqual({ slot: 5, name: "oak_log", count: 1 });
  });

  it("keeps durability when valid", () => {
    const p = parseInput({
      slots: [{ slot: 1, name: "diamond_sword", durability: 0.6 }],
    });
    expect(p.slots[0]?.durability).toBeCloseTo(0.6);
  });

  it("rejects non-object input", () => {
    expect(() => parseInput(42 as never)).toThrow(InventoryInputError);
  });

  it("rejects invalid JSON string", () => {
    expect(() => parseInput("{not json")).toThrow(/not valid JSON/);
  });

  it("rejects unknown window", () => {
    expect(() =>
      parseInput({ window: "furnace" as never, slots: [] })
    ).toThrow(/Unknown window/);
  });

  it("requires slots to be an array", () => {
    expect(() => parseInput({ slots: {} as never })).toThrow(/must be an array/);
  });

  it("rejects negative or non-integer slot index", () => {
    expect(() => parseInput({ slots: [{ slot: -1, name: "x" }] })).toThrow(
      /non-negative integer/
    );
    expect(() => parseInput({ slots: [{ slot: 1.5, name: "x" }] })).toThrow(
      /non-negative integer/
    );
  });

  it("rejects empty name", () => {
    expect(() => parseInput({ slots: [{ slot: 0, name: "   " }] })).toThrow(
      /non-empty string/
    );
  });

  it("rejects non-integer count", () => {
    expect(() =>
      parseInput({ slots: [{ slot: 0, name: "x", count: 1.5 }] })
    ).toThrow(/must be an integer/);
  });

  it("rejects out-of-range durability", () => {
    expect(() =>
      parseInput({ slots: [{ slot: 0, name: "x", durability: 2 }] })
    ).toThrow(/in \[0, 1\]/);
    expect(() =>
      parseInput({ slots: [{ slot: 0, name: "x", durability: -0.1 }] })
    ).toThrow(/in \[0, 1\]/);
  });
});
