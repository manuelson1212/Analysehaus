import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { C, Word, body, clamp, timeline } from "./theme";

type Chunk = { words: Word[]; from: number; to: number };

/** Groups each line into short pages of up to 3 words / 20 characters, TikTok style. */
const chunks: Chunk[] = timeline.scenes.flatMap((s) =>
  s.lines.flatMap((l) => {
    const pages: Word[][] = [];
    for (const w of l.words) {
      const cur = pages[pages.length - 1];
      const len = cur ? cur.map((x) => x.text).join(" ").length : 0;
      if (!cur || cur.length >= 3 || len + w.text.length > 20 || /[.?!:]$/.test(cur[cur.length - 1].text)) {
        pages.push([w]);
      } else {
        cur.push(w);
      }
    }
    return pages.map((p, i) => ({
      words: p.map((w) => ({ ...w, from: w.from + s.from, to: w.to + s.from })),
      from: p[0].from + s.from,
      to: (i < pages.length - 1 ? pages[i + 1][0].from : l.to + 6) + s.from,
    }));
  }),
);

export const Captions: React.FC = () => {
  const frame = useCurrentFrame();
  const chunk = chunks.find((c) => frame >= c.from && frame < c.to);
  if (!chunk) return null;
  // Long German compounds would overflow the 940 px line: shrink the page to fit its longest word.
  const longest = Math.max(...chunk.words.map((w) => w.text.length));
  const fontSize = Math.min(92, Math.floor(940 / (longest * 0.74)));
  return (
    <div
      style={{
        position: "absolute",
        top: 1250,
        left: 70,
        right: 70,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "0 22px",
        scale: String(interpolate(frame, [chunk.from, chunk.from + 4], [0.8, 1], { ...clamp, easing: Easing.out(Easing.back(2)) })),
      }}
    >
      {chunk.words.map((w) => {
        const active = frame >= w.from && frame < w.to;
        const spoken = frame >= w.from;
        return (
          <span
            key={`${w.from}-${w.text}`}
            style={{
              fontFamily: body,
              fontWeight: 900,
              fontSize,
              lineHeight: 1.12,
              textTransform: "uppercase",
              color: active ? C.orange : C.white,
              opacity: spoken ? 1 : 0.55,
              WebkitTextStroke: "10px #000",
              paintOrder: "stroke fill",
              textShadow: "0 8px 0 rgba(0,0,0,0.55)",
              scale: active ? String(interpolate(frame, [w.from, w.from + 3], [1.18, 1.06], clamp)) : "1",
              display: "inline-block",
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};
