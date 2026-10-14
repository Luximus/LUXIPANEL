import React, { createContext, useContext } from "react";
import { Text as RNText, type TextProps } from "react-native";
export const PanelFontsReady = createContext(false);
/** Uses the frontend's Inter assets; explicit code/terminal fonts are retained. */
export function PanelText({ style, ...props }: TextProps) {
  const ready = useContext(PanelFontsReady);
  const flatten = (value: any): any =>
    Array.isArray(value) ? Object.assign({}, ...value.map(flatten)) : (value ?? {});
  const flat = flatten(style);
  const font =
    ready && !flat.fontFamily
      ? { fontFamily: Number(flat.fontWeight) >= 600 ? "LUXIPANEL-Inter-Bold" : "LUXIPANEL-Inter" }
      : null;
  return <RNText {...props} style={[style, font]} />;
}
