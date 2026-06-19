import { renderToCanvas } from "mc-inventory-render";

const VERSIONS = ["1.16.4", "1.18.1", "1.19.1", "1.20.2", "1.21.1", "1.21.8"];

const PRESETS: Record<string, unknown> = {
  "Block showcase": {
    version: "1.21.1",
    window: "inventory",
    slots: [
      { slot: 9, name: "oak_log", count: 64 },
      { slot: 10, name: "grass_block", count: 12 },
      { slot: 11, name: "stone", count: 64 },
      { slot: 12, name: "diamond_block", count: 5 },
      { slot: 13, name: "crafting_table" },
      { slot: 14, name: "pumpkin" },
      { slot: 15, name: "bookshelf" },
      { slot: 16, name: "tnt" },
      { slot: 17, name: "furnace" },
      { slot: 36, name: "diamond_sword", durability: 0.6 },
      { slot: 37, name: "diamond_pickaxe", durability: 0.25 },
      { slot: 38, name: "apple", count: 3 },
      { slot: 39, name: "bow", durability: 0.9 },
    ],
  },
  "Items vs blocks": {
    version: "1.21.1",
    window: "inventory",
    slots: [
      { slot: 36, name: "oak_log", count: 2 },
      { slot: 37, name: "diamond_sword", durability: 0.6 },
      { slot: 38, name: "redstone", count: 64 },
      { slot: 39, name: "emerald_block" },
      { slot: 40, name: "golden_apple", count: 8 },
    ],
  },
  "Chest (9x3)": {
    version: "1.20.2",
    window: "chest",
    slots: [
      { slot: 0, name: "iron_block", count: 64 },
      { slot: 1, name: "gold_block", count: 64 },
      { slot: 2, name: "diamond_block", count: 64 },
      { slot: 4, name: "netherrack" },
      { slot: 5, name: "obsidian", count: 16 },
      { slot: 13, name: "ender_chest" },
      { slot: 22, name: "cobblestone", count: 64 },
    ],
  },
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const versionSel = $<HTMLSelectElement>("version");
const windowSel = $<HTMLSelectElement>("window");
const scaleSel = $<HTMLSelectElement>("scale");
const jsonArea = $<HTMLTextAreaElement>("json");
const canvas = $<HTMLCanvasElement>("canvas");
const statusEl = $<HTMLParagraphElement>("status");
const presetsEl = $<HTMLDivElement>("presets");

for (const v of VERSIONS) {
  const o = document.createElement("option");
  o.value = v;
  o.textContent = v;
  versionSel.appendChild(o);
}
versionSel.value = "1.21.1";

for (const name of Object.keys(PRESETS)) {
  const b = document.createElement("button");
  b.textContent = name;
  b.onclick = () => loadPreset(name);
  presetsEl.appendChild(b);
}

function loadPreset(name: string): void {
  const preset = PRESETS[name] as { version?: string; window?: string };
  jsonArea.value = JSON.stringify(preset, null, 2);
  if (preset.version) versionSel.value = preset.version;
  if (preset.window) {
    windowSel.value = preset.window === "generic_9x3" ? "chest" : preset.window;
  }
  rerender();
}

let timer: number | undefined;
function scheduleRender(): void {
  if (timer) window.clearTimeout(timer);
  timer = window.setTimeout(rerender, 250);
}

async function rerender(): Promise<void> {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonArea.value);
  } catch (e) {
    setStatus(`Invalid JSON: ${(e as Error).message}`, true);
    return;
  }
  // Let the controls override the JSON for convenience.
  parsed.version = versionSel.value;
  parsed.window = windowSel.value;

  setStatus("Loading textures…");
  try {
    const size = await renderToCanvas(parsed, canvas, {
      scale: Number(scaleSel.value),
    });
    setStatus(`Rendered ${size.width}×${size.height}px @ ${versionSel.value}`);
  } catch (e) {
    setStatus(`Render error: ${(e as Error).message}`, true);
  }
}

function setStatus(msg: string, error = false): void {
  statusEl.textContent = msg;
  statusEl.classList.toggle("error", error);
}

jsonArea.addEventListener("input", scheduleRender);
versionSel.addEventListener("change", rerender);
windowSel.addEventListener("change", rerender);
scaleSel.addEventListener("change", rerender);

// Repo link
const repo = $<HTMLAnchorElement>("repo-link");
if (repo) repo.href = "https://github.com/thatBrian/mc-inventory-render";

loadPreset("Block showcase");
