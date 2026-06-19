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
