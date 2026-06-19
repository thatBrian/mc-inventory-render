import type { BlockFaceTextures, RenderKind } from "./types.js";

/** Raw block model shape as exposed by minecraft-assets `blocksModels`. */
export interface BlockModel {
  parent?: string;
  textures?: Record<string, string>;
  elements?: unknown[];
}

/** Minimal interface over the data we need from minecraft-assets. */
export interface AssetProvider {
  /** The resolved version string. */
  readonly version: string;
  /** Returns a data: URL (or http url) for an item sprite, or undefined. */
  getItemTexture(name: string): string | undefined;
  /** Returns the block model for a name, or undefined. */
  getBlockModel(name: string): BlockModel | undefined;
  /** Returns a source URL/path for a block face texture short key (e.g. "oak_log_top"). */
  getBlockFaceTexture(faceKey: string): string | undefined;
}

/** Strip "minecraft:" namespace and a leading "item/"|"block/" path segment. */
export function normalizeName(name: string): string {
  let n = name.trim();
  const colon = n.indexOf(":");
  if (colon !== -1) n = n.slice(colon + 1);
  return n;
}

/** Resolve a model texture reference like "minecraft:block/oak_log_top" to "oak_log_top". */
export function textureRefToFaceKey(ref: string): string {
  let r = normalizeName(ref);
  const slash = r.lastIndexOf("/");
  if (slash !== -1) r = r.slice(slash + 1);
  return r;
}

/**
 * Given a block model's textures map, resolve the three visible iso faces:
 * top, left side and right side. Handles uniform (all), pillar (end/side),
 * grass (top/side) and explicit up/down/north/south/east/west styles.
 *
 * Texture values that reference variables (start with "#") are resolved
 * against the same texture map.
 */
export function resolveFaceTextures(
  textures: Record<string, string> | undefined
): BlockFaceTextures | undefined {
  if (!textures) return undefined;

  const deref = (value: string | undefined): string | undefined => {
    let v = value;
    let guard = 0;
    while (v && v.startsWith("#") && guard++ < 8) {
      v = textures[v.slice(1)];
    }
    return v;
  };

  const pick = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const resolved = deref(textures[k]);
      if (resolved) return resolved;
    }
    return undefined;
  };

  // Priority: explicit faces, then pillar, then grass/top, then uniform.
  const top =
    pick("up", "top", "end") ?? pick("all", "side", "particle", "texture");
  const side =
    pick("side", "north", "south", "east", "west") ??
    pick("all", "particle", "texture");

  const topTex = top ?? side;
  const sideTex = side ?? top;
  if (!topTex || !sideTex) return undefined;

  return {
    top: textureRefToFaceKey(topTex),
    left: textureRefToFaceKey(sideTex),
    right: textureRefToFaceKey(sideTex),
  };
}

/**
 * Tint classes for grayscale textures that Minecraft colors at render time via
 * a biome colormap (`tintindex`). Inventory icons have no biome, so each class
 * maps to a single default color (see DEFAULT_TINT), overridable per render.
 */
export type TintClass = "grass" | "foliage" | "spruce" | "birch" | "lilypad";

/**
 * Default tint colors per class. These approximate Minecraft's *default*
 * (biome-less) colormap corner used for inventory icons. Override any of them
 * via the render `tint` option.
 */
export const DEFAULT_TINT: Record<TintClass, string> = {
  grass: "#7cbd6b",
  foliage: "#59ae30",
  spruce: "#619961",
  birch: "#80a755",
  lilypad: "#208030",
};

/** One texture layer of a face: a texture key plus an optional biome tint. */
export interface FaceLayer {
  key: string;
  tint?: TintClass;
}

/** Per-face layer stacks (base texture first, tinted overlay last). */
export interface BlockFaceLayers {
  top: FaceLayer[];
  left: FaceLayer[];
  right: FaceLayer[];
}

// Texture keys that are shipped grayscale and biome-tinted in vanilla. Spruce
// and birch leaves use constant (non-biome) colors, so they get their own class.
const GRASS_TEX =
  /^(grass_block_top|grass_block_side_overlay|grass|short_grass|fern|tall_grass.*|large_fern.*|potted_fern|sugar_cane)$/;
const FOLIAGE_TEX =
  /^(oak_leaves|jungle_leaves|acacia_leaves|dark_oak_leaves|mangrove_leaves|azalea_leaves_?.*|vine|mangrove_roots.*)$/;

/** Map a texture key to its tint class, or undefined if it is not tinted. */
export function tintClassFor(faceKey: string): TintClass | undefined {
  if (GRASS_TEX.test(faceKey)) return "grass";
  if (faceKey === "spruce_leaves") return "spruce";
  if (faceKey === "birch_leaves") return "birch";
  if (faceKey === "lily_pad") return "lilypad";
  if (FOLIAGE_TEX.test(faceKey)) return "foliage";
  return undefined;
}

/**
 * Like {@link resolveFaceTextures}, but returns layered faces: each visible
 * face is a stack of texture layers (base first), each carrying an optional
 * tint class. Grass-style blocks contribute a tinted `overlay` layer on their
 * side faces; tinted textures (grass top, leaves, …) carry their tint class so
 * the renderer can colorize the grayscale source.
 */
export function resolveFaceLayers(
  textures: Record<string, string> | undefined
): BlockFaceLayers | undefined {
  const base = resolveFaceTextures(textures);
  if (!base || !textures) return undefined;

  // Resolve the (optional) side overlay, dereferencing "#var" indirection.
  let overlayRef: string | undefined = textures.overlay;
  let guard = 0;
  while (overlayRef && overlayRef.startsWith("#") && guard++ < 8) {
    overlayRef = textures[overlayRef.slice(1)];
  }
  const overlayKey = overlayRef ? textureRefToFaceKey(overlayRef) : undefined;

  const layer = (key: string): FaceLayer => {
    const tint = tintClassFor(key);
    return tint ? { key, tint } : { key };
  };
  const side = (baseKey: string): FaceLayer[] =>
    overlayKey ? [layer(baseKey), layer(overlayKey)] : [layer(baseKey)];

  return {
    top: [layer(base.top)],
    left: side(base.left),
    right: side(base.right),
  };
}

/**
 * Classify a name as a block (has a usable block model), an item (has a flat
 * sprite) or missing. Blocks are preferred when a model with resolvable faces
 * exists, matching how Minecraft renders inventory icons.
 */
export function classify(name: string, provider: AssetProvider): RenderKind {
  const model = provider.getBlockModel(name);
  if (model && resolveFaceTextures(model.textures)) {
    // Only treat as a 3D block if at least one face texture file is resolvable.
    const faces = resolveFaceTextures(model.textures)!;
    const anyFace =
      provider.getBlockFaceTexture(faces.top) ??
      provider.getBlockFaceTexture(faces.left) ??
      provider.getBlockFaceTexture(faces.right);
    if (anyFace) return "block";
  }
  if (provider.getItemTexture(name)) return "item";
  // Some blocks (e.g. flat/cross models) only have an item sprite — fall back.
  if (model && provider.getItemTexture(name)) return "item";
  return "missing";
}
