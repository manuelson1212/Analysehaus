import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Backdrop, Camera, Counter, Verdict, pop, rise } from "../fx";
import { C, body, clamp, display, lineStart, mono, scene, wordAt } from "../theme";

const PATH = "/System/Library/Image Capture/Devices/VirtualScanner.app/Contents/Resources/simpledoc.pdf";

const YearChip: React.FC<{ year: string; label: string; at: number; color: string }> = ({ year, label, at, color }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ textAlign: "center", scale: pop(frame, at) }}>
      <div style={{ fontFamily: display, fontSize: 110, lineHeight: 1, color }}>{year}</div>
      <div style={{ fontFamily: body, fontWeight: 800, fontSize: 36, color: C.white }}>{label}</div>
    </div>
  );
};

export const Mac: React.FC<{ clip?: string }> = ({ clip }) => {
  const frame = useCurrentFrame();
  const s = scene("mac");
  const wp = wordAt("mac", "Bitcoin-Whitepaper");
  const l1 = lineStart("mac", 1);
  const y18 = wordAt("mac", "2018");
  const y23 = wordAt("mac", "2023");
  const typed = Math.round(interpolate(frame, [4, wp - 2], [0, PATH.length], clamp));
  return (
    <AbsoluteFill>
      <Backdrop clip={clip} tint={C.green} />
      <Camera punches={[wp, l1, y23]} shakes={[wp, s.stamp]} origin="50% 38%">
        <div
          style={{
            position: "absolute",
            top: 300,
            left: 80,
            right: 80,
            borderRadius: 22,
            overflow: "hidden",
            backgroundColor: "#0d1117",
            border: "2px solid rgba(255,255,255,0.12)",
            boxShadow: "0 40px 90px rgba(0,0,0,0.6)",
            ...rise(frame, 0, 120, 10),
          }}
        >
          <div style={{ display: "flex", gap: 14, padding: "20px 24px", backgroundColor: "#1a1f27" }}>
            <div style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#ff5f57" }} />
            <div style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#febc2e" }} />
            <div style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#28c840" }} />
            <div style={{ flex: 1, textAlign: "center", fontFamily: mono, fontSize: 24, color: C.dim }}>Terminal — macOS</div>
          </div>
          <div style={{ padding: "26px 30px 34px", fontFamily: mono, fontSize: 34, lineHeight: 1.4, color: C.green, wordBreak: "break-all" }}>
            <span style={{ color: C.dim }}>$ </span>open {PATH.slice(0, typed)}
            <span style={{ opacity: Math.floor(frame / 8) % 2 ? 0 : 1 }}>▌</span>
          </div>
        </div>
        {frame >= wp ? (
          <div
            style={{
              position: "absolute",
              top: 560,
              left: 200,
              right: 200,
              backgroundColor: C.white,
              color: C.ink,
              padding: "38px 40px",
              boxShadow: `0 0 0 6px ${C.green}, 0 40px 100px rgba(0,0,0,0.7)`,
              rotate: "2deg",
              scale: pop(frame, wp, 7),
              textAlign: "center",
            }}
          >
            <div style={{ fontFamily: "DejaVu Serif, Georgia, serif", fontWeight: 700, fontSize: 40, lineHeight: 1.2 }}>
              Bitcoin: A Peer-to-Peer Electronic Cash System
            </div>
            <div style={{ fontFamily: "DejaVu Serif, Georgia, serif", fontSize: 28, marginTop: 14 }}>Satoshi Nakamoto</div>
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{ height: 12, marginTop: 14, backgroundColor: "rgba(0,0,0,0.15)", width: `${[100, 92, 97, 80, 60][i]}%` }}
              />
            ))}
            <div style={{ fontFamily: mono, fontSize: 22, marginTop: 18, color: "#666" }}>simpledoc.pdf</div>
          </div>
        ) : null}
        {frame >= l1 ? (
          <div
            style={{
              position: "absolute",
              top: 1010,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 50,
              ...rise(frame, l1, 30, 6),
            }}
          >
            <YearChip year="2018" label="im System" at={y18} color={C.white} />
            <div
              style={{
                fontFamily: display,
                fontSize: 90,
                color: C.green,
                opacity: interpolate(frame, [y18 + 4, y23], [0, 1], clamp),
                translate: `${interpolate(frame, [y18 + 4, y23], [-30, 0], { ...clamp, easing: Easing.out(Easing.cubic) })}px 0px`,
              }}
            >
              →
            </div>
            <YearChip year="2023" label="entdeckt" at={y23} color={C.green} />
          </div>
        ) : null}
      </Camera>
      <Counter n={4} />
      <Verdict at={s.stamp} tone="fact" title="FAKT" sub="Lag seit macOS Mojave im System" y={700} />
    </AbsoluteFill>
  );
};
