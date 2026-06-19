import { describe, it, expect } from "vitest";
import {
  getWindowLayout,
  findSlotRect,
  layoutConstants,
} from "../src/layout.js";

describe("getWindowLayout - player inventory", () => {
  const l = getWindowLayout("inventory");

  it("has the vanilla 176x166 dimensions", () => {
    expect(l.width).toBe(176);
    expect(l.height).toBe(166);
    expect(l.background).toBe("gui/container/inventory.png");
  });

  it("has 36 slots (27 main + 9 hotbar)", () => {
    expect(l.slots).toHaveLength(36);
  });

  it("places hotbar slot 36 at x=8 y=142", () => {
    const s = findSlotRect(l, 36)!;
    expect(s.x).toBe(8);
    expect(s.y).toBe(142);
  });

  it("places main slot 9 at x=8 y=84", () => {
    const s = findSlotRect(l, 9)!;
    expect(s.x).toBe(8);
    expect(s.y).toBe(84);
  });

  it("spaces slots by SLOT_SIZE horizontally", () => {
    const a = findSlotRect(l, 9)!;
    const b = findSlotRect(l, 10)!;
    expect(b.x - a.x).toBe(layoutConstants.SLOT_SIZE);
  });

  it("returns undefined for an absent slot", () => {
    expect(findSlotRect(l, 999)).toBeUndefined();
  });
});

describe("getWindowLayout - chest", () => {
  it("9x3 chest has 27 container slots + 36 player slots", () => {
    const l = getWindowLayout("chest");
    expect(l.slots).toHaveLength(27 + 36);
    expect(l.background).toBe("gui/container/generic_54.png");
  });

  it("9x6 chest has 54 container slots + 36 player slots", () => {
    const l = getWindowLayout("generic_9x6");
    expect(l.slots).toHaveLength(54 + 36);
  });

  it("chest container slot 0 starts at top-left grid", () => {
    const l = getWindowLayout("chest");
    const s = findSlotRect(l, 0)!;
    expect(s.x).toBe(8);
    expect(s.y).toBe(18);
  });

  it("chest height grows with row count", () => {
    const small = getWindowLayout("generic_9x3");
    const big = getWindowLayout("generic_9x6");
    expect(big.height).toBeGreaterThan(small.height);
  });

  it("all slot numbers are unique", () => {
    const l = getWindowLayout("generic_9x6");
    const nums = new Set(l.slots.map((s) => s.slot));
    expect(nums.size).toBe(l.slots.length);
  });
});
