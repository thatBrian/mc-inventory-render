import { defineConfig } from "vite";
import { resolve } from "node:path";

// Demo built into ../docs for GitHub Pages. base is set to the repo name at
// build time so assets resolve under https://<user>.github.io/<repo>/.
export default defineConfig(({ command }) => ({
  root: resolve(__dirname),
  base: command === "build" ? "./" : "/",
  resolve: {
    alias: {
      "mc-inventory-render": resolve(__dirname, "../src/index.ts"),
    },
  },
  build: {
    outDir: resolve(__dirname, "../docs"),
    emptyOutDir: true,
  },
}));
