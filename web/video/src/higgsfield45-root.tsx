import React from "react";
import { Composition, registerRoot } from "remotion";
import { Higgsfield45Preview } from "./higgsfield45";
import "./style.css";

const Root: React.FC = () => <Composition
  id="LuxiPanelHiggsfield45Preview"
  component={Higgsfield45Preview}
  width={1080}
  height={1920}
  fps={30}
  durationInFrames={1350}
/>;

registerRoot(Root);
