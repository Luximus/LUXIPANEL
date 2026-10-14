import React from "react";
import { Image, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { Github } from "lucide-react-native";
import type { AccountProvider } from "../../storage/savedAccounts";
import { styles } from "./ProviderBadge.styles";

const GOOGLE_LOGO = require("../../../assets/google.png");

function AppleMark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#ffffff" d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l-.49.99zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </Svg>
  );
}

function MicrosoftMark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={3} y={3} width={8.5} height={8.5} fill="#F25022" />
      <Rect x={12.5} y={3} width={8.5} height={8.5} fill="#7FBA00" />
      <Rect x={3} y={12.5} width={8.5} height={8.5} fill="#00A4EF" />
      <Rect x={12.5} y={12.5} width={8.5} height={8.5} fill="#FFB900" />
    </Svg>
  );
}

/**
 * Small brand badge for the identity provider an account signed in with, shown
 * to the left of its avatar in the account selector. Email-based methods
 * (passkey/recovery) and unknown providers render an invisible spacer so every
 * avatar stays aligned in the column.
 */
export function ProviderBadge({
  provider,
  size = 18,
  borderColor = "rgba(127,127,127,0.35)",
}: {
  provider?: AccountProvider | null;
  size?: number;
  borderColor?: string;
}) {
  if (!provider || provider === "passkey" || provider === "recovery") {
    return <View style={{ width: size }} />;
  }
  const inner = Math.round(size * 0.62);
  const bg = provider === "apple" ? "#000000" : provider === "github" ? "#24292f" : "#ffffff";
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, borderColor }]}>
      {provider === "google" ? <Image source={GOOGLE_LOGO} style={{ width: inner, height: inner, resizeMode: "contain" }} /> : null}
      {provider === "apple" ? <AppleMark size={inner} /> : null}
      {provider === "github" ? <Github size={inner} color="#ffffff" /> : null}
      {provider === "microsoft" ? <MicrosoftMark size={inner} /> : null}
    </View>
  );
}
