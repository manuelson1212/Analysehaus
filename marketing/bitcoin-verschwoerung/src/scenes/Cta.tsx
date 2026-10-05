import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Backdrop, Camera, Glitch, pop, rise } from "../fx";
import { C, body, clamp, display, wordAt } from "../theme";

const Option: React.FC<{ n: number; label: string; at: number }> = ({ n, label, at }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 28,
        backgroundColor: "rgba(255,255,255,0.07)",
        border: "3px solid rgba(255,255,255,0.18)",
        borderRadius: 20,
        padding: "10px 30px 10px 10px",
        scale: pop(frame, at),
      }}
    >
      <div
        style={{
          width: 76,
          height: 76,
          borderRadius: 14,
          backgroundColor: C.orange,
          color: C.bg,
          fontFamily: display,
          fontSize: 70,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {n}
      </div>
      <div style={{ fontFamily: body, fontWeight: 900, fontSize: 46, color: C.white }}>{label}</div>
    </div>
  );
};

export const Cta: React.FC<{ clip?: string }> = ({ clip }) => {
  const frame = useCurrentFrame();
  const comments = wordAt("cta", "Kommentare");
  const follow = wordAt("cta", "Folge");
  const pulse = frame >= follow ? 1 + 0.06 * Math.sin((frame - follow) / 3) : 1;
  return (
    <AbsoluteFill>
      <Backdrop clip={clip} />
      <Camera punches={[comments, follow]} shakes={[0, follow]}>
        <div style={{ position: "absolute", top: 170, left: 0, right: 0, textAlign: "center", ...rise(frame, 0, 80, 8) }}>
          <Glitch bursts={[0]} style={{ fontFamily: display, fontSize: 150, lineHeight: 0.95, color: C.white }}>
            WELCHE
            <br />
            GLAUBST DU?
          </Glitch>
        </div>
        <div style={{ position: "absolute", top: 470, left: 150, right: 150, display: "flex", flexDirection: "column", gap: 14 }}>
          <Option n={1} label="NSA-Paper" at={8} />
          <Option n={2} label="Der Name" at={11} />
          <Option n={3} label="1 Mio. Coins" at={14} />
          <Option n={4} label="Whitepaper im Mac" at={17} />
          <Option n={5} label="Genesis-Botschaft" at={20} />
        </div>
        {frame >= follow ? (
          <div
            style={{
              position: "absolute",
              top: 1060,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
              scale: String(pulse),
              opacity: interpolate(frame, [follow, follow + 3], [0, 1], clamp),
            }}
          >
            <div
              style={{
                backgroundColor: C.red,
                color: C.white,
                fontFamily: display,
                fontSize: 76,
                padding: "16px 54px",
                borderRadius: 999,
                boxShadow: `0 0 60px ${C.red}99`,
                letterSpacing: 2,
              }}
            >
              FOLGEN FÜR TEIL 2
            </div>
          </div>
        ) : null}
      </Camera>
    </AbsoluteFill>
  );
};
