import type { WindowType } from "./types.js";

/** A slot position in unscaled GUI pixels (16x16 inner content area). */
export interface SlotRect {
  slot: number;
  /** X of the slot's inner top-left (where the 16x16 icon goes). */
  x: number;
  /** Y of the slot's inner top-left. */
  y: number;
}

/** A full window layout: background texture region + slot positions. */
export interface WindowLayout {
  /** minecraft-assets gui texture path relative to the version directory. */
  background: string;
  /** Used (cropped) width of the background texture in GUI pixels. */
  width: number;
  /** Used (cropped) height of the background texture in GUI pixels. */
  height: number;
  /** All slot rects keyed by slot number. */
  slots: SlotRect[];
}

const SLOT_SIZE = 18; // grid spacing between slots in GUI pixels
const ICON = 16; // icon size in GUI pixels

/** Build a left-to-right, top-to-bottom grid of slots. */
function grid(
  startSlot: number,
  cols: number,
  rows: number,
  originX: number,
  originY: number
): SlotRect[] {
  const out: SlotRect[] = [];
  let slot = startSlot;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({
        slot,
        x: originX + c * SLOT_SIZE,
        y: originY + r * SLOT_SIZE,
      });
      slot++;
    }
  }
  return out;
}

/**
 * Player inventory window. Matches vanilla gui/container/inventory.png
 * (176x166 used region). Slots: 9-35 = main 3x9, 36-44 = hotbar.
 * (Crafting/armor slots are omitted — they are rarely needed and overlap the
 * player-model viewport region.)
 */
function playerInventory(): WindowLayout {
  const main = grid(9, 9, 3, 8, 84);
  const hotbar = grid(36, 9, 1, 8, 142);
  return {
    background: "gui/container/inventory.png",
    width: 176,
    height: 166,
    slots: [...main, ...hotbar],
  };
}

/**
 * Generic chest with `rows` rows of 9 (vanilla gui/container/generic_54.png).
 * Container slots are 0..(rows*9-1); the player inventory below uses
 * rows*9 .. rows*9+26 (main) and the following 9 (hotbar), matching the
 * generic container protocol numbering.
 */
function genericChest(rows: number): WindowLayout {
  const height = 114 + rows * SLOT_SIZE;
  const container = grid(0, 9, rows, 8, 18);
  const playerStart = rows * 9;
  const playerY = 32 + rows * SLOT_SIZE; // top of player main inv
  const main = grid(playerStart, 9, 3, 8, playerY);
  const hotbar = grid(playerStart + 27, 9, 1, 8, playerY + 58);
  return {
    background: "gui/container/generic_54.png",
    width: 176,
    height,
    slots: [...container, ...main, ...hotbar],
  };
}

/** Resolve a window type to a concrete layout. */
export function getWindowLayout(window: WindowType): WindowLayout {
  switch (window) {
    case "inventory":
      return playerInventory();
    case "chest":
    case "generic_9x3":
      return genericChest(3);
    case "generic_9x6":
      return genericChest(6);
    default: {
      const _exhaustive: never = window;
      throw new Error(`Unknown window type: ${String(_exhaustive)}`);
    }
  }
}

/** Look up a single slot rect within a layout, or undefined if absent. */
export function findSlotRect(
  layout: WindowLayout,
  slot: number
): SlotRect | undefined {
  return layout.slots.find((s) => s.slot === slot);
}

export const layoutConstants = { SLOT_SIZE, ICON };
