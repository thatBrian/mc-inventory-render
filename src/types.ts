/** A single stack placed into a slot of an inventory window. */
export interface SlotItem {
  /** Numeric slot index within the chosen window's slot layout. */
  slot: number;
  /** Item/block identifier, e.g. "oak_log", "diamond_sword" (with or without "minecraft:" prefix). */
  name: string;
  /** Stack size. Defaults to 1. Counts > 1 are drawn as a number badge. */
  count?: number;
  /**
   * Remaining durability as a fraction in [0, 1] (1 = full, 0 = broken).
   * When present and < 1, a durability bar is drawn under the item.
   */
  durability?: number;
}

/** Supported window types (slot layouts). */
export type WindowType = "inventory" | "chest" | "generic_9x3" | "generic_9x6";

/** Inventory render request. The primary JSON input shape of the library. */
export interface InventoryInput {
  /** Any minecraft-assets-supported version, e.g. "1.21.1". Defaults to a recent version. */
  version?: string;
  /** Which window layout to render. Defaults to "inventory". */
  window?: WindowType;
  /** Items to place into slots. */
  slots: SlotItem[];
}

/** Result of classifying a name into how it should be rendered. */
export type RenderKind = "block" | "item" | "missing";

/** A resolved face texture set for compositing a 3D block icon. */
export interface BlockFaceTextures {
  /** Top face texture key (resolved to a blocks/<name> short key). */
  top: string;
  /** Left-front visible side. */
  left: string;
  /** Right-front visible side. */
  right: string;
}

/** Geometry/shading constants for isometric block compositing. */
export interface IsoConfig {
  /** Brightness multiplier for the top face. */
  topShade: number;
  /** Brightness multiplier for the left side face. */
  leftShade: number;
  /** Brightness multiplier for the right side face. */
  rightShade: number;
  /** display.gui rotation [x, y] in degrees. */
  rotation: [number, number];
  /** display.gui scale. */
  scale: number;
}
