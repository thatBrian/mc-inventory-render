import type { AssetProvider, BlockModel } from "./assets.js";
import { normalizeName } from "./assets.js";

/** The callable default export of the minecraft-assets package. */
interface McAssetsFactory {
  (version: string):
    | {
        version: string;
        directory: string;
        textureContent: Record<string, { name: string; texture: string }>;
        blocksModels: Record<string, BlockModel>;
      }
    | undefined;
}

/**
 * Build an AssetProvider backed by the `minecraft-assets` npm package.
 *
 * `mcAssets` is injected so the core stays free of a hard runtime import and so
 * tests can supply fakes. In normal usage pass the package's default export.
 *
 * `blockFaceUrl` maps a face short-key (e.g. "oak_log_top") to a URL the
 * renderer can load. By default it points at the package's on-disk
 * `blocks/<key>.png` via the reported `directory`. In a browser bundle you can
 * supply a function returning a hosted/CDN URL instead.
 */
export function createMinecraftAssetsProvider(
  version: string,
  mcAssets: McAssetsFactory,
  blockFaceUrl?: (faceKey: string, directory: string) => string | undefined
): AssetProvider {
  const a = mcAssets(version);
  if (!a) {
    throw new Error(`minecraft-assets has no data for version "${version}"`);
  }
  const directory = a.directory;
  const faceUrl =
    blockFaceUrl ?? ((key, dir) => `${dir}blocks/${key}.png`);

  return {
    version: a.version,
    getItemTexture(name) {
      const key = normalizeName(name);
      return a.textureContent[key]?.texture;
    },
    getBlockModel(name) {
      const key = normalizeName(name);
      return a.blocksModels[key];
    },
    getBlockFaceTexture(faceKey) {
      return faceUrl(faceKey, directory);
    },
  };
}
