import type { InventoryInput, WindowType } from "./types.js";

const WINDOW_TYPES: WindowType[] = [
  "inventory",
  "chest",
  "generic_9x3",
  "generic_9x6",
];

/** Default version when none is supplied. */
export const DEFAULT_VERSION = "1.21.1";

export class InventoryInputError extends Error {
  override name = "InventoryInputError";
}

/** A fully-normalized input with all optionals filled in. */
export interface ParsedInput {
  version: string;
  window: WindowType;
  slots: NormalizedSlot[];
}

export interface NormalizedSlot {
  slot: number;
  name: string;
  count: number;
  durability?: number;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Validate and normalize a raw JSON object into a ParsedInput.
 * Accepts either an object or a JSON string. Throws InventoryInputError on
 * malformed input.
 */
export function parseInput(input: InventoryInput | string): ParsedInput {
  let raw: unknown = input;
  if (typeof input === "string") {
    try {
      raw = JSON.parse(input);
    } catch (e) {
      throw new InventoryInputError(
        `Input is not valid JSON: ${(e as Error).message}`
      );
    }
  }

  if (!isObject(raw)) {
    throw new InventoryInputError("Input must be an object");
  }

  const version =
    raw.version === undefined ? DEFAULT_VERSION : String(raw.version);

  let window: WindowType = "inventory";
  if (raw.window !== undefined) {
    if (!WINDOW_TYPES.includes(raw.window as WindowType)) {
      throw new InventoryInputError(
        `Unknown window "${String(raw.window)}". Expected one of: ${WINDOW_TYPES.join(", ")}`
      );
    }
    window = raw.window as WindowType;
  }

  if (!Array.isArray(raw.slots)) {
    throw new InventoryInputError("Input.slots must be an array");
  }

  const slots: NormalizedSlot[] = raw.slots.map((s, i) =>
    normalizeSlot(s, i)
  );

  return { version, window, slots };
}

function normalizeSlot(s: unknown, index: number): NormalizedSlot {
  if (!isObject(s)) {
    throw new InventoryInputError(`slots[${index}] must be an object`);
  }
  if (typeof s.slot !== "number" || !Number.isInteger(s.slot) || s.slot < 0) {
    throw new InventoryInputError(
      `slots[${index}].slot must be a non-negative integer`
    );
  }
  if (typeof s.name !== "string" || s.name.trim() === "") {
    throw new InventoryInputError(
      `slots[${index}].name must be a non-empty string`
    );
  }

  let count = 1;
  if (s.count !== undefined) {
    if (typeof s.count !== "number" || !Number.isInteger(s.count)) {
      throw new InventoryInputError(
        `slots[${index}].count must be an integer`
      );
    }
    count = s.count;
  }

  let durability: number | undefined;
  if (s.durability !== undefined) {
    if (
      typeof s.durability !== "number" ||
      s.durability < 0 ||
      s.durability > 1 ||
      Number.isNaN(s.durability)
    ) {
      throw new InventoryInputError(
        `slots[${index}].durability must be a number in [0, 1]`
      );
    }
    durability = s.durability;
  }

  return { slot: s.slot, name: s.name.trim(), count, durability };
}
