import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { Backdrop, Camera, Glitch, pop, rise } from "../fx";
import { C, body, clamp, display, lineStart, mono, wordAt } from "../theme";

export const BitcoinCoin: React.FC<{ size: number; spin: number }> = ({ size, spin }) => (
  <svg width={size} height={size} viewBox="0 0 200 200" style={{ scale: `${Math.cos(spin)} 1`, overflow: "visible" }}>
    <circle cx="100" cy="100" r="96" fill={C.orange} />
    <circle cx="100" cy="100" r="84" fill="none" stroke="#ffb54d" strokeWidth="4" />
    <g transform="rotate(14 100 100)" fill={C.white}>
      <rect x="86" y="38" width="9" height="20" rx="2" />
      <rect x="104" y="38" width="9" height="20" rx="2" />
      <rect x="86" y="142" width="9" height="20" rx="2" />
      <rect x="104" y="142" width="9" height="20" rx="2" />
      <text x="100" y="146" textAnchor="middle" fontFamily={body} fontWeight={900} fontSize="118">
        B
      </text>
    </g>
  </svg>
);

const FileCard: React.FC<{ n: number; at: number; hot: number }> = ({ n, at, hot }) => {
  const frame = useCurrentFrame();
  const glow = frame >= hot ? 0.6 + 0.4 * Math.sin((frame - hot) / 2.5) : 0;
  const angle = (n - 3) * 9;
  return (
    <div
      style={{
        width: 170,
        height: 230,
        borderRadius: 12,
        backgroundColor: n === 4 && glow ? C.orange : "#c9a96a",
        boxShadow: n === 4 && glow ? `0 0 ${70 * glow}px ${C.orange}` : "0 20px 40px rgba(0,0,0,0.5)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: display,
        color: C.ink,
        rotate: `${angle}deg`,
        translate: `0px ${Math.abs(n - 3) * 26}px`,
        scale: pop(frame, at),
      }}
    >
      <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 24 }}>AKTE</div>
      <div style={{ fontSize: 110, lineHeight: 1 }}>0{n}</div>
      {n === 4 && glow ? <div style={{ fontSize: 44 }}>?!</div> : null}
    </div>
  );
};

export const Hook: React.FC<{ clip?: string }> = ({ clip }) => {
  const frame = useCurrentFrame();
  const secret = wordAt("hook", "Geheimdienst");
  const l1 = lineStart("hook", 1);
  const nr4 = wordAt("hook", "4");
  return (
    <AbsoluteFill>
      <Backdrop clip={clip} />
      <Camera punches={[secret, l1, nr4]} shakes={[secret, l1, nr4]}>
        {/* Coin: big and spinning, then shrinks to the top when the five files arrive */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            top: interpolate(frame, [l1, l1 + 10], [330, -20], { ...clamp, easing: Easing.out(Easing.cubic) }),
            scale: String(
              interpolate(frame, [0, 10, l1, l1 + 10], [0, 1, 1, 0.42], {
                ...clamp,
                easing: Easing.out(Easing.back(1.5)),
              }),
            ),
          }}
        >
          <BitcoinCoin size={560} spin={frame / 9} />
        </div>
        {frame < l1 ? (
          <div
            style={{
              position: "absolute",
              top: 600,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
              opacity: interpolate(frame, [secret, secret + 2], [0, 1], clamp),
              scale: String(interpolate(frame, [secret, secret + 5], [2.6, 1], { ...clamp, easing: Easing.out(Easing.cubic) })),
              rotate: "-9deg",
            }}
          >
            <div
              style={{
                border: `12px solid ${C.red}`,
                color: C.red,
                fontFamily: display,
                fontSize: 170,
                padding: "0 40px",
                lineHeight: 1.15,
                backgroundColor: "rgba(6,8,11,0.6)",
                letterSpacing: 8,
              }}
            >
              GEHEIM
            </div>
          </div>
        ) : null}
        {frame >= l1 ? (
          <>
            <div style={{ position: "absolute", top: 420, left: 0, right: 0, textAlign: "center", ...rise(frame, l1, 80, 8) }}>
              <Glitch bursts={[l1, nr4]} style={{ fontFamily: display, fontSize: 250, lineHeight: 0.9, color: C.white }}>
                5
              </Glitch>
              <div style={{ fontFamily: display, fontSize: 92, color: C.orange, letterSpacing: 3, lineHeight: 1.05 }}>
                BITCOIN-
                <br />
                VERSCHWÖRUNGEN
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                top: 860,
                left: 0,
                right: 0,
                display: "flex",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <FileCard n={1} at={l1 + 12} hot={nr4} />
              <FileCard n={2} at={l1 + 15} hot={nr4} />
              <FileCard n={3} at={l1 + 18} hot={nr4} />
              <FileCard n={4} at={l1 + 21} hot={nr4} />
              <FileCard n={5} at={l1 + 24} hot={nr4} />
            </div>
          </>
        ) : null}
      </Camera>
    </AbsoluteFill>
  );
};
