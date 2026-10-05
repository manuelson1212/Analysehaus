import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";
import timelineJson from "./timeline.json";

// Fonts ship in public/fonts (OFL, from Fontsource) so rendering works offline.
const fonts: [string, string, string][] = [
  ["Anton", "400", "anton-latin-400-normal.woff2"],
  ["Inter", "600", "inter-latin-600-normal.woff2"],
  ["Inter", "800", "inter-latin-800-normal.woff2"],
  ["Inter", "900", "inter-latin-900-normal.woff2"],
  ["JetBrains Mono", "400", "jetbrains-mono-latin-400-normal.woff2"],
  ["JetBrains Mono", "700", "jetbrains-mono-latin-700-normal.woff2"],
];
for (const [family, weight, file] of fonts) {
  loadFont({ family, weight, url: staticFile(`fonts/${file}`) });
}

export const display = "Anton";
export const body = "Inter";
export const mono = "'JetBrains Mono'";

export const C = {
  bg: "#06080b",
  orange: "#f7931a",
  red: "#ff3b3b",
  green: "#3dff8f",
  paper: "#ece4d2",
  ink: "#16130f",
  white: "#ffffff",
  dim: "rgba(255,255,255,0.55)",
};

export type Word = { text: string; from: number; to: number };
export type Line = { key: string; show: string; from: number; to: number; words: Word[] };
export type SceneData = {
  id: string;
  from: number;
  durationInFrames: number;
  stamp: number;
  lines: Line[];
};

export const timeline = timelineJson as {
  fps: number;
  durationInFrames: number;
  scenes: SceneData[];
};

export const scene = (id: string): SceneData => {
  const s = timeline.scenes.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scene ${id}`);
  return s;
};

/** Frame where line `i` of a scene starts, relative to the scene. */
export const lineStart = (id: string, i: number) => scene(id).lines[i].from;

/** Frame where the first word starting with `prefix` is spoken, relative to the scene. */
export const wordAt = (id: string, prefix: string) => {
  for (const l of scene(id).lines) {
    const w = l.words.find((x) => x.text.startsWith(prefix));
    if (w) return w.from;
  }
  throw new Error(`No word "${prefix}" in scene ${id}`);
};

export const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;
