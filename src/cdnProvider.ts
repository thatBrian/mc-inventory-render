import type { AssetProvider, BlockModel } from "./assets.js";
import { normalizeName } from "./assets.js";

/**
 * Default CDN base for the minecraft-assets data tree (jsDelivr).
 * Layout: `<base>/<version>/{blocks_models.json,blocks/<x>.png,items/<x>.png}`.
 */
export const DEFAULT_CDN_BASE =
  "https://cdn.jsdelivr.net/npm/minecraft-assets/minecraft-assets/data";

/**
 * Build an AssetProvider that resolves everything from a remote CDN, without
 * importing the (very large) minecraft-assets data into the bundle. This is the
 * recommended provider for browser/web usage.
 *
 * It fetches `blocks_models.json` once for the version, then resolves:
 *   - item textures  -> `<base>/<version>/items/<name>.png`
 *   - block faces    -> `<base>/<version>/blocks/<faceKey>.png`
 *
 * Because block-vs-item classification needs the model map, this provider is
 * async to construct.
 */
export async function createCdnProvider(
  version: string,
  options: {
    base?: string;
    fetchImpl?: typeof fetch;
  } = {}
): Promise<AssetProvider> {
  const base = options.base ?? DEFAULT_CDN_BASE;
  const f = options.fetchImpl ?? fetch;
  const url = `${base}/${version}/blocks_models.json`;
  const res = await f(url);
  if (!res.ok) {
    throw new Error(
      `Could not load block models for version "${version}" (${res.status} from ${url})`
    );
  }
  const blocksModels = (await res.json()) as Record<string, BlockModel>;

  return {
    version,
    getItemTexture(name) {
      const key = normalizeName(name);
      // We can't cheaply know if the file exists; return a URL and let the
      // image loader fall back to undefined on 404.
      return `${base}/${version}/items/${key}.png`;
    },
    getBlockModel(name) {
      return blocksModels[normalizeName(name)];
    },
    getBlockFaceTexture(faceKey) {
      return `${base}/${version}/blocks/${faceKey}.png`;
    },
  };
}
