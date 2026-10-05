import React from "react";
import { Composition, Folder } from "remotion";
import { BitcoinVerschwoerung } from "./BitcoinVerschwoerung";
import { Coins } from "./scenes/Coins";
import { Cta } from "./scenes/Cta";
import { Genesis } from "./scenes/Genesis";
import { Hook } from "./scenes/Hook";
import { Mac } from "./scenes/Mac";
import { Name } from "./scenes/Name";
import { Nsa } from "./scenes/Nsa";
import { scene, timeline } from "./theme";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="BitcoinVerschwoerung"
        component={BitcoinVerschwoerung}
        durationInFrames={timeline.durationInFrames}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ clips: { hook: "", nsa: "", name: "", coins: "", mac: "", genesis: "", cta: "" } }}
      />
      <Folder name="Szenen">
        <Composition id="Hook" component={Hook} durationInFrames={scene("hook").durationInFrames} fps={30} width={1080} height={1920} />
        <Composition id="Nsa" component={Nsa} durationInFrames={scene("nsa").durationInFrames} fps={30} width={1080} height={1920} />
        <Composition id="Name" component={Name} durationInFrames={scene("name").durationInFrames} fps={30} width={1080} height={1920} />
        <Composition id="Coins" component={Coins} durationInFrames={scene("coins").durationInFrames} fps={30} width={1080} height={1920} />
        <Composition id="Mac" component={Mac} durationInFrames={scene("mac").durationInFrames} fps={30} width={1080} height={1920} />
        <Composition id="Genesis" component={Genesis} durationInFrames={scene("genesis").durationInFrames} fps={30} width={1080} height={1920} />
        <Composition id="Cta" component={Cta} durationInFrames={scene("cta").durationInFrames} fps={30} width={1080} height={1920} />
      </Folder>
    </>
  );
};
