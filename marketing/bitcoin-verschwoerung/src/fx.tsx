import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  random,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Video } from "@remotion/media";
import { staticFile } from "remotion";
import { C, body, clamp, display, mono } from "./theme";

/**
 * Virtual camera for a scene: slow push-in, jump-cut zooms and impact shake.
 * Every frame in `punches` toggles between the wide and the tight framing (like a jump cut
 * in a talking-head edit); every frame in `shakes` kicks the frame and lets it settle.
 */
export const Camera: React.FC<{
  children: React.ReactNode;
  punches?: number[];
  shakes?: number[];
  tight?: number;
  origin?: string;
}> = ({ children, punches = [], shakes = [], tight = 1.16, origin = "50% 45%" }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const passed = punches.filter((p) => frame >= p);
  const last = passed.length ? passed[passed.length - 1] : -100;
  const zoomTarget = passed.length % 2 === 1 ? tight : 1;
  const zoomPrev = passed.length % 2 === 1 ? 1 : tight;
  const snap = interpolate(frame, [last, last + 3], [zoomPrev, zoomTarget], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const drift = interpolate(frame, [0, durationInFrames], [1, 1.05], clamp);
  let dx = 0;
  let dy = 0;
  let rot = 0;
  for (const s of shakes) {
    if (frame < s) continue;
    const k = Math.exp(-(frame - s) / 4.5) * (frame - s < 18 ? 1 : 0);
    dx += (random(`sx${frame}${s}`) - 0.5) * 46 * k;
    dy += (random(`sy${frame}${s}`) - 0.5) * 46 * k;
    rot += (random(`sr${frame}${s}`) - 0.5) * 2.4 * k;
  }
  return (
    <AbsoluteFill
      style={{
        scale: String((passed.length ? snap : 1) * drift),
        translate: `${dx}px ${dy}px`,
        rotate: `${rot}deg`,
        transformOrigin: origin,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/** Dark grid background, or the user's own clip (public/clips/...) zoomed and darkened. */
export const Backdrop: React.FC<{ clip?: string; tint?: string }> = ({ clip, tint = C.orange }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      {clip ? (
        <Video
          src={staticFile(clip)}
          muted
          premountFor={fps}
          objectFit="cover"
          style={{
            width: "100%",
            height: "100%",
            filter: "saturate(0.7) contrast(1.15) brightness(0.55)",
            scale: String(interpolate(frame, [0, durationInFrames], [1.08, 1.22], clamp)),
          }}
        />
      ) : (
        <AbsoluteFill
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.045) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,0.045) 2px, transparent 2px)",
            backgroundSize: "90px 90px",
            backgroundPosition: `0px ${frame * 1.5}px`,
          }}
        />
      )}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 45% at 50% 42%, ${tint}2e, transparent 70%)`,
        }}
      />
    </AbsoluteFill>
  );
};

/** Film grain, scanlines and vignette over the whole video. */
export const Finish: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 2px, transparent 2px, transparent 5px)",
          opacity: 0.5,
        }}
      />
      <svg width="100%" height="100%" style={{ position: "absolute", opacity: 0.13, mixBlendMode: "overlay" }}>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={frame % 12} />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
      <AbsoluteFill
        style={{ background: "radial-gradient(ellipse 85% 70% at 50% 45%, transparent 55%, rgba(0,0,0,0.75) 100%)" }}
      />
    </AbsoluteFill>
  );
};

/** White flash plus chromatic tear on hard cuts. `at` = frames of the cuts in this timeline. */
export const CutFlash: React.FC<{ at: number[] }> = ({ at }) => {
  const frame = useCurrentFrame();
  const d = Math.min(...at.map((c) => (frame >= c ? frame - c : 99)));
  if (d > 6) return null;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.white,
        opacity: interpolate(d, [0, 6], [0.85, 0], clamp),
        mixBlendMode: "screen",
      }}
    />
  );
};

/** Text with an RGB-split glitch that flares up around `burst` frames. */
export const Glitch: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  bursts?: number[];
  base?: number;
}> = ({ children, style, bursts = [], base = 0.15 }) => {
  const frame = useCurrentFrame();
  const flare = Math.max(0, ...bursts.map((b) => (frame >= b && frame < b + 10 ? 1 - (frame - b) / 10 : 0)));
  const on = random(`g${Math.floor(frame / 2)}`) < 0.12 + flare;
  const amt = (on ? 6 + 22 * flare : 2) * (base + flare);
  const jx = on ? (random(`gx${frame}`) - 0.5) * 30 * (flare + base) : 0;
  return (
    <div
      style={{
        ...style,
        textShadow: `${amt * 6}px 0 ${C.red}, ${-amt * 6}px 0 #00e5ff`,
        translate: `${jx}px 0px`,
      }}
    >
      {children}
    </div>
  );
};

type Tone = "myth" | "fact" | "open";
const toneColor: Record<Tone, string> = { myth: C.red, fact: C.green, open: C.orange };

/** Fact-check stamp that slams onto the frame at `at`. */
export const Verdict: React.FC<{ at: number; tone: Tone; title: string; sub?: string; y?: number }> = ({
  at,
  tone,
  title,
  sub,
  y = 760,
}) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const col = toneColor[tone];
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: y,
        display: "flex",
        justifyContent: "center",
        opacity: interpolate(frame, [at, at + 2], [0, 1], clamp),
        scale: String(
          interpolate(frame, [at, at + 5], [2.4, 1], { ...clamp, easing: Easing.out(Easing.back(1.4)) }),
        ),
        rotate: "-7deg",
      }}
    >
      <div
        style={{
          border: `10px solid ${col}`,
          borderRadius: 18,
          padding: "18px 40px 22px",
          backgroundColor: "rgba(6,8,11,0.88)",
          boxShadow: `0 0 60px ${col}88, inset 0 0 30px ${col}44`,
          textAlign: "center",
          maxWidth: 860,
        }}
      >
        <div style={{ fontFamily: display, fontSize: 104, lineHeight: 1, color: col, letterSpacing: 2 }}>{title}</div>
        {sub ? (
          <div style={{ fontFamily: body, fontWeight: 800, fontSize: 40, color: C.white, marginTop: 10 }}>{sub}</div>
        ) : null}
      </div>
    </div>
  );
};

/** "THEORIE 2/5" chip with progress pips, top of frame. */
export const Counter: React.FC<{ n: number }> = ({ n }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        top: 120,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 18,
        translate: `0px ${interpolate(frame, [0, 6], [-40, 0], { ...clamp, easing: Easing.out(Easing.cubic) })}px`,
      }}
    >
      <div
        style={{
          fontFamily: mono,
          fontWeight: 700,
          fontSize: 40,
          color: C.bg,
          backgroundColor: C.orange,
          padding: "8px 26px",
          borderRadius: 10,
          letterSpacing: 4,
        }}
      >
        THEORIE {n}/5
      </div>
      <div style={{ display: "flex", gap: 14 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              width: i === n ? 64 : 26,
              height: 12,
              borderRadius: 6,
              backgroundColor: i <= n ? C.orange : "rgba(255,255,255,0.25)",
            }}
          />
        ))}
      </div>
    </div>
  );
};

/** Pop-in helper: spring-ish scale from 0 at frame `at`. */
export const pop = (frame: number, at: number, len = 8) =>
  String(interpolate(frame, [at, at + len], [0, 1], { ...clamp, easing: Easing.out(Easing.back(1.8)) }));

/** Fade/slide-in helper. */
export const rise = (frame: number, at: number, dist = 60, len = 10) => ({
  opacity: interpolate(frame, [at, at + len * 0.6], [0, 1], clamp),
  translate: `0px ${interpolate(frame, [at, at + len], [dist, 0], { ...clamp, easing: Easing.out(Easing.cubic) })}px`,
});
