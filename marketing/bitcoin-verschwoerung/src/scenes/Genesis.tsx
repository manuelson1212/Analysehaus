import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Highlight } from "@remotion/rough-notation";
import { Backdrop, Camera, Counter, Verdict, rise } from "../fx";
import { C, body, clamp, display, lineStart, mono, scene, wordAt } from "../theme";

const HASH = "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f";
const HEX = "04ffff001d0104455468652054696d65732030332f4a616e2f32303039204368616e63656c6c6f72206f6e206272696e6b206f66207365636f6e64206261696c6f757420666f722062616e6b73";

export const Genesis: React.FC<{ clip?: string }> = ({ clip }) => {
  const frame = useCurrentFrame();
  const s = scene("genesis");
  const head = wordAt("genesis", "Zeitungsschlagzeile");
  const l1 = lineStart("genesis", 1);
  const banks = wordAt("genesis", "Banken");
  const forever = wordAt("genesis", "immer");
  const hexShown = Math.round(interpolate(frame, [6, head], [0, HEX.length], clamp));
  return (
    <AbsoluteFill>
      <Backdrop clip={clip} />
      <Camera punches={[head, banks, forever]} shakes={[head, s.stamp]} origin="50% 42%">
        <div
          style={{
            position: "absolute",
            top: 290,
            left: 90,
            right: 90,
            border: `4px solid ${C.orange}`,
            borderRadius: 20,
            padding: "26px 32px",
            backgroundColor: "rgba(247,147,26,0.07)",
            ...rise(frame, 0, 100, 10),
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontFamily: display, fontSize: 96, color: C.orange, lineHeight: 1 }}>BLOCK #0</div>
            <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 34, color: C.white }}>03.01.2009</div>
          </div>
          <div style={{ fontFamily: mono, fontSize: 24, color: C.dim, marginTop: 14, wordBreak: "break-all" }}>{HASH}</div>
          <div
            style={{
              fontFamily: mono,
              fontSize: 26,
              lineHeight: 1.35,
              color: C.green,
              marginTop: 16,
              wordBreak: "break-all",
              height: 210,
              overflow: "hidden",
            }}
          >
            {HEX.slice(0, hexShown)}
          </div>
        </div>
        {frame >= head ? (
          <div
            style={{
              position: "absolute",
              top: 640,
              left: 70,
              right: 70,
              backgroundColor: C.paper,
              color: C.ink,
              padding: "30px 38px 34px",
              rotate: "-2deg",
              boxShadow: "0 40px 100px rgba(0,0,0,0.7)",
              scale: String(interpolate(frame, [head, head + 7], [1.8, 1], { ...clamp, easing: Easing.out(Easing.cubic) })),
              opacity: interpolate(frame, [head, head + 2], [0, 1], clamp),
            }}
          >
            <div style={{ fontFamily: "DejaVu Serif, Georgia, serif", fontWeight: 700, fontSize: 30, letterSpacing: 3, borderBottom: `3px solid ${C.ink}`, paddingBottom: 8 }}>
              THE TIMES · 03/JAN/2009
            </div>
            <div style={{ fontFamily: "DejaVu Serif, Georgia, serif", fontWeight: 700, fontSize: 60, lineHeight: 1.12, marginTop: 16 }}>
              Chancellor on brink of second{" "}
              <Highlight color="rgba(247,147,26,0.75)" progress={interpolate(frame, [banks - 4, banks + 8], [0, 1], clamp)}>
                bailout for banks
              </Highlight>
            </div>
            <div style={{ fontFamily: body, fontWeight: 800, fontSize: 32, marginTop: 16, opacity: interpolate(frame, [l1, l1 + 8], [0, 0.8], clamp) }}>
              „Finanzminister kurz vor zweiter Bankenrettung“
            </div>
          </div>
        ) : null}
      </Camera>
      <Counter n={5} />
      <Verdict at={s.stamp} tone="fact" title="FAKT" sub="Steht bis heute in Block #0" y={1010} />
    </AbsoluteFill>
  );
};
