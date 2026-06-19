declare module "minecraft-assets" {
  interface BlockModelData {
    parent?: string;
    textures?: Record<string, string>;
    elements?: unknown[];
  }
  interface VersionAssets {
    version: string;
    directory: string;
    textureContent: Record<string, { name: string; texture: string }>;
    blocksModels: Record<string, BlockModelData>;
    blocksStates: Record<string, unknown>;
    blocks: Record<string, unknown>;
    items: Record<string, unknown>;
  }
  interface McAssets {
    (version: string): VersionAssets | undefined;
    versions?: string[];
  }
  const mcAssets: McAssets;
  export default mcAssets;
}
