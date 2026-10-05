import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Backdrop, Camera, Counter, Glitch, Verdict } from "../fx";
import { C, clamp, display, lineStart, scene, wordAt } from "../theme";

const Brand: React.FC<{ part: string; rest: string; at: number }> = ({ part, rest, at }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        fontFamily: display,
        fontSize: 150,
        lineHeight: 1.08,
        translate: `${interpolate(frame, [at, at + 6], [-260, 0], { ...clamp, easing: Easing.out(Easing.back(1.6)) })}px 0px`,
        opacity: interpolate(frame, [at, at + 3], [0, 1], clamp),
      }}
    >
      <span style={{ color: C.orange }}>{part}</span>
      <span
        style={{
          color: C.white,
          clipPath: `inset(0 ${interpolate(frame, [at + 3, at + 10], [100, 0], clamp)}% 0 0)`,
        }}
      >
        {rest}
      </span>
    </div>
  );
};

export const Name: React.FC<{ clip?: string }> = ({ clip }) => {
  const frame = useCurrentFrame();
  const s = scene("name");
  const l1 = lineStart("name", 1);
  const sa = wordAt("name", "SAmsung");
  const to = wordAt("name", "TOSHIba");
  const na = wordAt("name", "NAKAmichi");
  const mo = wordAt("name", "MOTOrola");
  const vier = wordAt("name", "Vier");
  return (
    <AbsoluteFill>
      <Backdrop clip={clip} />
      <Camera punches={[l1, mo, vier]} shakes={[0, vier, s.stamp]}>
        {frame < l1 ? (
          <div style={{ position: "absolute", top: 520, left: 0, right: 0, textAlign: "center" }}>
            <Glitch bursts={[0, 20]} style={{ fontFamily: display, fontSize: 196, lineHeight: 1, color: C.white }}>
              SATOSHI
              <br />
              NAKAMOTO
            </Glitch>
            <div
              style={{
                fontFamily: display,
                fontSize: 60,
                color: C.orange,
                letterSpacing: 6,
                marginTop: 20,
                opacity: interpolate(frame, [10, 18], [0, 1], clamp),
              }}
            >
              ERFINDER VON BITCOIN · IDENTITÄT UNBEKANNT
            </div>
          </div>
        ) : (
          <div style={{ position: "absolute", top: 330, left: 110 }}>
            <Brand part="SA" rest="MSUNG" at={sa} />
            <Brand part="TOSHI" rest="BA" at={to} />
            <Brand part="NAKA" rest="MICHI" at={na} />
            <Brand part="MOTO" rest="ROLA" at={mo} />
            <div
              style={{
                fontFamily: display,
                fontSize: 70,
                color: C.white,
                marginTop: 16,
                opacity: interpolate(frame, [vier, vier + 4], [0, 1], clamp),
              }}
            >
              = <span style={{ color: C.orange }}>SA·TOSHI NAKA·MOTO</span>
            </div>
          </div>
        )}
      </Camera>
      <Counter n={2} />
      <Verdict at={s.stamp} tone="open" title="ZUFALL?" sub="Lustiges Wortspiel · kein Beleg" y={1000} />
    </AbsoluteFill>
  );
};
