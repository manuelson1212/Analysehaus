import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Circle } from "@remotion/rough-notation";
import { Backdrop, Camera, Counter, Verdict, rise } from "../fx";
import { C, body, clamp, display, lineStart, mono, scene, wordAt } from "../theme";

const Redaction: React.FC<{ at: number; width: number }> = ({ at, width }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ height: 26, marginTop: 14, width, position: "relative", backgroundColor: "rgba(22,19,15,0.18)" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: C.ink,
          width: `${interpolate(frame, [at, at + 6], [0, 100], { ...clamp, easing: Easing.out(Easing.quad) })}%`,
        }}
      />
    </div>
  );
};

export const Nsa: React.FC<{ clip?: string }> = ({ clip }) => {
  const frame = useCurrentFrame();
  const s = scene("nsa");
  const year = wordAt("nsa", "1996");
  const paper = wordAt("nsa", "Paper");
  const l1 = lineStart("nsa", 1);
  const proof = wordAt("nsa", "Beweis");
  return (
    <AbsoluteFill>
      <Backdrop clip={clip} tint={C.red} />
      <Camera punches={[year, paper, l1, proof]} shakes={[year, s.stamp]} origin="50% 40%">
        <div
          style={{
            position: "absolute",
            top: 300,
            left: 150,
            width: 780,
            padding: "40px 46px",
            backgroundColor: C.paper,
            color: C.ink,
            boxShadow: "0 40px 90px rgba(0,0,0,0.6)",
            rotate: "-3deg",
            ...rise(frame, 0, 140, 12),
          }}
        >
          <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 26, letterSpacing: 2 }}>NATIONAL SECURITY AGENCY</div>
          <div style={{ fontFamily: mono, fontSize: 19, opacity: 0.75, marginTop: 6 }}>
            OFFICE OF INFORMATION SECURITY RESEARCH AND TECHNOLOGY
          </div>
          <div style={{ fontFamily: display, fontSize: 84, lineHeight: 1, marginTop: 28 }}>HOW TO MAKE A MINT:</div>
          <div style={{ fontFamily: body, fontWeight: 800, fontSize: 36, lineHeight: 1.15, marginTop: 10 }}>
            The Cryptography of Anonymous Electronic Cash
          </div>
          <div style={{ marginTop: 22, fontFamily: display, fontSize: 64 }}>
            <Circle
              color={C.red}
              strokeWidth={6}
              padding={{ top: 14, right: 14, bottom: 14, left: 14 }}
              iterations={2}
              progress={interpolate(frame, [year, year + 10], [0, 1], clamp)}
            >
              1996
            </Circle>
          </div>
          <Redaction at={paper} width={640} />
          <Redaction at={paper + 3} width={560} />
          <Redaction at={paper + 6} width={680} />
          <Redaction at={paper + 9} width={420} />
        </div>
        {frame >= l1 ? (
          <div style={{ position: "absolute", top: 1010, left: 110, right: 110, ...rise(frame, l1, 50, 8) }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: display, fontSize: 64, color: C.white }}>
              <span>1996</span>
              <span style={{ color: C.orange }}>2008</span>
            </div>
            <div style={{ position: "relative", height: 14, backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 7 }}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 7,
                  backgroundColor: C.orange,
                  width: `${interpolate(frame, [l1, l1 + 22], [0, 100], { ...clamp, easing: Easing.inOut(Easing.cubic) })}%`,
                }}
              />
            </div>
            <div style={{ textAlign: "center", fontFamily: body, fontWeight: 900, fontSize: 48, color: C.orange, marginTop: 10 }}>
              {Math.round(interpolate(frame, [l1, l1 + 22], [0, 12], clamp))} JAHRE VOR BITCOIN
            </div>
          </div>
        ) : null}
      </Camera>
      <Counter n={1} />
      <Verdict at={s.stamp} tone="myth" title="KEIN BEWEIS" sub="Paper echt · NSA-Bitcoin unbelegt" />
    </AbsoluteFill>
  );
};
