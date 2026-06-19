# mc-inventory-render

Render Minecraft inventories from JSON, across Minecraft versions, with correct
in-game visuals — **authentic isometric block icons** composited live from
per-face block textures, plus flat item sprites. Framework-agnostic core,
renders to an HTML canvas; optional thin React wrapper.

**[Live demo →](https://thatbrian.github.io/mc-inventory-render/)**

![A rendered Minecraft inventory window: a row of isometric block icons (oak log, grass, stone, diamond block, crafting table, planks, bookshelf, TNT, furnace) with stack-count badges, plus flat tool/item sprites with a durability bar in the hotbar.](https://raw.githubusercontent.com/thatBrian/mc-inventory-render/main/docs/example.png)

<sub>Rendered by this library from JSON (1.21.1). Regenerate with `npx tsx scripts/gen-example.mts`.</sub>

## Why isometric compositing?

Minecraft has **no pre-rendered block sprite** in any version. Block inventory
icons are live 3D models rendered with the model's `display.gui` transform:
rotation `[30, 225]` degrees, scale `0.625`, orthographic projection, with
per-face directional shading. This library reproduces that:

- The cube is projected so the **top face is an exact 2:1 diamond** and the
  whole icon's bounding box is **~1.11× taller than it is wide** (matching
  vanilla).
- Each visible face's square texture is mapped onto its screen-space
  parallelogram via an affine `setTransform`.
- Per-face **directional shading** is applied (top 100%, sides ~88% / ~72%) by
  multiplying the texture against a gray on an offscreen buffer.
- The correct per-face textures are resolved from the block model's `textures`
  map: `all` (uniform blocks like stone), `end`+`side` (logs/pillars),
  `top`+`side` (grass), or explicit `up`/`down`/`north`/`south`/`east`/`west`.

Items (anything without a usable block model) use their flat `item/generated`
sprite.

## Install

```sh
npm install mc-inventory-render
```

`minecraft-assets` is a dependency (it supplies the per-version model + texture
data). `react` is an optional peer dependency, only needed for the React
wrapper.

## Quick start (browser)

```ts
import { renderToCanvas } from "mc-inventory-render";

const canvas = document.querySelector("canvas")!;
await renderToCanvas(
  {
    version: "1.21.1",
    window: "inventory",
    slots: [
      { slot: 36, name: "oak_log", count: 2 },
      { slot: 37, name: "diamond_sword", durability: 0.6 },
    ],
  },
  canvas
);
```

Textures and the block-model map are loaded from the jsDelivr CDN by default
(nothing heavy is bundled). Point at your own mirror with `assetsBaseUrl`.

### Data URL

```ts
import { renderToDataURL } from "mc-inventory-render";
const png = await renderToDataURL({ version: "1.20.2", slots: [/* … */] });
```

### React

```tsx
import { InventoryCanvas } from "mc-inventory-render/react";

<InventoryCanvas
  input={{ version: "1.21.1", slots: [{ slot: 36, name: "grass_block" }] }}
  options={{ scale: 4 }}
/>;
```

## JSON schema

```jsonc
{
  "version": "1.21.1",     // any minecraft-assets-supported version (default 1.21.1)
  "window": "inventory",    // "inventory" | "chest" | "generic_9x3" | "generic_9x6"
  "slots": [
    {
      "slot": 36,            // integer slot index within the window's layout
      "name": "oak_log",     // item/block id, with or without "minecraft:"
      "count": 2,            // optional, default 1; drawn as a badge when > 1
      "durability": 0.6      // optional fraction in [0,1]; draws a damage bar when < 1
    }
  ]
}
```

Validation is strict — malformed input throws `InventoryInputError` with a
field-specific message.

### Slot numbering

- **`inventory`**: slots `9`–`35` = main inventory (3×9), `36`–`44` = hotbar
  (matches the container protocol numbering).
- **`chest` / `generic_9x3`**: `0`–`26` = container, then `27`–`62` = the
  player inventory + hotbar below it.
- **`generic_9x6`**: `0`–`53` = container, then the player inventory.

Slots referencing an index not present in the chosen window are skipped.

## Public API

Core (`mc-inventory-render`):

| Export | Description |
| --- | --- |
| `renderToCanvas(input, canvas, options?)` | Render onto an existing canvas (browser). |
| `renderToDataURL(input, options?)` | Render to a PNG data URL (browser). |
| `renderInventory(ctx, parsed, renderContext)` | Framework/-env-agnostic core renderer (used for Node/node-canvas). |
| `parseInput(input)` → `ParsedInput` | Validate + normalize JSON (object or string). |
| `createCdnProvider(version, opts?)` | Async asset provider backed by a CDN (no bundled data). |
| `createMinecraftAssetsProvider(version, mcAssets, faceUrl?)` | Asset provider backed by the local `minecraft-assets` package (Node). |
| `classify(name, provider)` | `"block" \| "item" \| "missing"`. |
| `resolveFaceTextures(textures)` | Resolve a model's textures to `{ top, left, right }` face keys. |
| `projectCube(iso?)` → `CubeGeometry` | The isometric face geometry. |
| `getWindowLayout(window)` | Slot layout + background for a window type. |
| `DEFAULT_ISO`, `DEFAULT_VERSION`, `DEFAULT_CDN_BASE` | Constants. |
| `browserImageLoader()`, `cachedLoader(inner)` | Image loaders. |

React (`mc-inventory-render/react`): `InventoryCanvas`.

### Options

```ts
interface RenderToCanvasOptions {
  scale?: number;            // integer GUI->px factor, default 4
  iso?: IsoConfig;           // override rotation/scale/shading
  drawBackground?: boolean;  // default true
  fallbackBackground?: string;
  assetsBaseUrl?: string;    // CDN/mirror base for the minecraft-assets data tree
  provider?: AssetProvider;  // advanced: supply your own
  loader?: ImageLoader;      // advanced: supply your own
  offscreen?: OffscreenFactory; // for face shading (auto in browser)
}
```

## Node usage

In Node there is no DOM. Render onto a [`canvas`](https://www.npmjs.com/package/canvas)
context with the core `renderInventory`, using the local-package provider and a
filesystem image loader. See `test/render.test.ts` for a complete, working
example (file-URL loader + offscreen factory + `createMinecraftAssetsProvider`).

## Version support

Works across every `minecraft-assets` data version. Verified in tests against
**1.16.4, 1.18.1, 1.20.2, 1.21.1** (logs, grass, uniform blocks, items,
durability, and items missing in older versions falling back gracefully). The
demo also exposes 1.19.1 and 1.21.8.

## Development

```sh
npm install
npm test          # vitest (unit + node-canvas render tests)
npm run coverage  # coverage report
npm run typecheck
npm run build     # tsup -> dist (esm + cjs + d.ts)
npm run demo:dev  # vite dev server for the demo
npm run demo:build # build demo into docs/ for GitHub Pages
npx tsx scripts/gen-example.mts # regenerate docs/example.png (README image)
```

## License

MIT
