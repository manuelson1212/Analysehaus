import React from "react";
import { AbsoluteFill, Easing, interpolate, random, useCurrentFrame } from "remotion";
import { Backdrop, Camera, Counter, Glitch, Verdict, pop, rise } from "../fx";
import { C, body, clamp, display, lineStart, mono, scene, wordAt } from "../theme";

const COLS = 16;
const ROWS = 7;

const Padlock: React.FC<{ closed: number }> = ({ closed }) => (
  <svg width="150" height="180" viewBox="0 0 150 180">
    <path
      d="M35 80 V50 a40 40 0 0 1 80 0 V80"
      fill="none"
      stroke={C.orange}
      strokeWidth="16"
      strokeLinecap="round"
      transform={`translate(0 ${-26 * (1 - closed)})`}
    />
    <rect x="15" y="78" width="120" height="96" rx="16" fill={C.orange} />
    <circle cx="75" cy="118" r="12" fill={C.bg} />
    <rect x="70" y="122" width="10" height="28" rx="4" fill={C.bg} />
  </svg>
);

export const Coins: React.FC<{ clip?: string }> = ({ clip }) => {
  const frame = useCurrentFrame();
  const s = scene("coins");
  const million = wordAt("coins", "1");
  const l1 = lineStart("coins", 1);
  const key = wordAt("coins", "Schlüssel");
  const count = interpolate(frame, [million - 6, million + 22], [0, 1_000_000], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const lit = (count / 1_000_000) * COLS * ROWS;
  const year = Math.round(interpolate(frame, [l1, l1 + 30], [2010, 2026], { ...clamp, easing: Easing.out(Easing.quad) }));
  return (
    <AbsoluteFill>
      <Backdrop clip={clip} />
      <Camera punches={[million + 22, l1, key]} shakes={[million + 22, key, s.stamp]}>
        <div
          style={{
            position: "absolute",
            top: 330,
            left: 90,
            right: 90,
            display: "grid",
            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            gap: 10,
            ...rise(frame, 0, 60, 10),
          }}
        >
          {Array.from({ length: COLS * ROWS }).map((_, i) => {
            const order = random(`c${i}`) * COLS * ROWS;
            const on = order < lit;
            return (
              <div
                key={i}
                style={{
                  aspectRatio: "1",
                  borderRadius: "50%",
                  backgroundColor: on ? C.orange : "rgba(255,255,255,0.08)",
                  boxShadow: on ? `0 0 14px ${C.orange}aa` : "none",
                }}
              />
            );
          })}
        </div>
        <div style={{ position: "absolute", top: 730, left: 0, right: 0, textAlign: "center" }}>
          <div style={{ fontFamily: display, fontSize: 168, lineHeight: 1, color: C.white }}>
            {Math.round(count).toLocaleString("de-DE")}
          </div>
          <div style={{ fontFamily: display, fontSize: 70, color: C.orange, letterSpacing: 6 }}>BTC · SATOSHI (GESCHÄTZT)</div>
        </div>
        {frame >= l1 ? (
          <div
            style={{
              position: "absolute",
              top: 990,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 40,
              ...rise(frame, l1, 50, 8),
            }}
          >
            <div style={{ scale: pop(frame, l1) }}>
              <Padlock closed={interpolate(frame, [key, key + 5], [0, 1], { ...clamp, easing: Easing.in(Easing.quad) })} />
            </div>
            <div>
              <div style={{ fontFamily: mono, fontSize: 34, color: C.dim }}>LETZTE BEWEGUNG</div>
              <Glitch bursts={[key]} style={{ fontFamily: display, fontSize: 92, color: C.white, lineHeight: 1.05 }}>
                NIE
              </Glitch>
              <div style={{ fontFamily: body, fontWeight: 900, fontSize: 46, color: C.orange }}>2010 → {year}</div>
            </div>
          </div>
        ) : null}
      </Camera>
      <Counter n={3} />
      <Verdict at={s.stamp} tone="open" title="UNGEKLÄRT" sub="Menge geschätzt · Besitzer unbekannt" y={560} />
    </AbsoluteFill>
  );
};
