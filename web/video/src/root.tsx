import React from "react";
import { Composition } from "remotion";
import { LuxiPanelPortrait } from "./video";
import { LuxiPanelChatImpact } from "./chat-impact";
import { LuxiSoftBusinessFree } from "./business-free";

export const RemotionRoot: React.FC = () => (
  <>
  <Composition
    id="LuxiPanelPortrait"
    component={LuxiPanelPortrait}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={1350}
  />
  <Composition
    id="LuxiPanelChatImpact"
    component={LuxiPanelChatImpact}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={1350}
  />
  <Composition
    id="LuxiSoftBusinessFree"
    component={LuxiSoftBusinessFree}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={1350}
  />
  <Composition
    id="LuxiSoftBusinessFreeEnglish"
    component={LuxiSoftBusinessFree}
    defaultProps={{ language: "en" as const, includeMusic: false }}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={1350}
  />
  </>
);
