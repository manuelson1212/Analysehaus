import React from "react";
import { AbsoluteFill, Series, staticFile, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { Captions } from "./Captions";
import { CutFlash, Finish } from "./fx";
import { Coins } from "./scenes/Coins";
import { Cta } from "./scenes/Cta";
import { Genesis } from "./scenes/Genesis";
import { Hook } from "./scenes/Hook";
import { Mac } from "./scenes/Mac";
import { Name } from "./scenes/Name";
import { Nsa } from "./scenes/Nsa";
import { scene, timeline } from "./theme";

/** Optional own footage per scene: put a file in public/clips/ and set e.g. clips.nsa = "clips/nsa.mp4". */
export type Props = {
  readonly clips: Record<string, string>;
};

// Scene lengths come from src/timeline.json, which tools/build.py writes from the voice-over,
// so picture, captions and soundtrack stay frame-exact when the script changes.
export const BitcoinVerschwoerung: React.FC<Props> = ({ clips }) => {
  const { fps } = useVideoConfig();
  const clip = (id: string) => clips[id] || undefined;
  return (
    <AbsoluteFill style={{ backgroundColor: "#06080b" }}>
      <Series>
        <Series.Sequence name="Hook" durationInFrames={scene("hook").durationInFrames} premountFor={fps}>
          <Hook clip={clip("hook")} />
        </Series.Sequence>
        <Series.Sequence name="1 · NSA-Paper" durationInFrames={scene("nsa").durationInFrames} premountFor={fps}>
          <Nsa clip={clip("nsa")} />
        </Series.Sequence>
        <Series.Sequence name="2 · Name" durationInFrames={scene("name").durationInFrames} premountFor={fps}>
          <Name clip={clip("name")} />
        </Series.Sequence>
        <Series.Sequence name="3 · Coins" durationInFrames={scene("coins").durationInFrames} premountFor={fps}>
          <Coins clip={clip("coins")} />
        </Series.Sequence>
        <Series.Sequence name="4 · Mac" durationInFrames={scene("mac").durationInFrames} premountFor={fps}>
          <Mac clip={clip("mac")} />
        </Series.Sequence>
        <Series.Sequence name="5 · Genesis" durationInFrames={scene("genesis").durationInFrames} premountFor={fps}>
          <Genesis clip={clip("genesis")} />
        </Series.Sequence>
        <Series.Sequence name="CTA" durationInFrames={scene("cta").durationInFrames} premountFor={fps}>
          <Cta clip={clip("cta")} />
        </Series.Sequence>
      </Series>
      <Captions />
      <CutFlash at={timeline.scenes.slice(1).map((s) => s.from)} />
      <Finish />
      <Audio name="Soundtrack" src={staticFile("soundtrack.wav")} />
    </AbsoluteFill>
  );
};
