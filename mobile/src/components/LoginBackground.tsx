import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import type { ThemeMode } from "../features/app/types";

/**
 * Reproduce el fondo del login de /desktop usando SVG:
 * - capa base: gradiente lineal diagonal (4 stops)
 * - dos manchas radiales suaves encima
 */
export function LoginBackground({ theme }: { theme: ThemeMode }) {
  const isDark = theme === "dark";

  const linearStops = isDark
    ? [
        { offset: "0%", color: "#0d1117" },
        { offset: "40%", color: "#11161c" },
        { offset: "72%", color: "#151b23" },
        { offset: "100%", color: "#10151c" },
      ]
    : [
        { offset: "0%", color: "#f6f9ff" },
        { offset: "38%", color: "#eef4ff" },
        { offset: "68%", color: "#eef6ff" },
        { offset: "100%", color: "#f6f0ff" },
      ];

  const radial1 = isDark
    ? { cx: "82%", cy: "12%", rx: "54%", ry: "42%", color: "rgb(148, 163, 184)", opacity: 0.12, fadeAt: "70%" }
    : { cx: "12%", cy: "12%", rx: "48%", ry: "44%", color: "rgb(167, 139, 250)", opacity: 0.24, fadeAt: "72%" };

  const radial2 = isDark
    ? { cx: "14%", cy: "84%", rx: "38%", ry: "34%", color: "rgb(113, 113, 122)", opacity: 0.10, fadeAt: "74%" }
    : { cx: "82%", cy: "86%", rx: "42%", ry: "38%", color: "rgb(87, 199, 207)", opacity: 0.18, fadeAt: "74%" };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <LinearGradient id="lxpBase" x1="0%" y1="0%" x2="100%" y2="100%">
            {linearStops.map((s, i) => (
              <Stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={1} />
            ))}
          </LinearGradient>
          <RadialGradient id="lxpR1" cx={radial1.cx} cy={radial1.cy} rx={radial1.rx} ry={radial1.ry} fx={radial1.cx} fy={radial1.cy}>
            <Stop offset="0%" stopColor={radial1.color} stopOpacity={radial1.opacity} />
            <Stop offset={radial1.fadeAt} stopColor={radial1.color} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="lxpR2" cx={radial2.cx} cy={radial2.cy} rx={radial2.rx} ry={radial2.ry} fx={radial2.cx} fy={radial2.cy}>
            <Stop offset="0%" stopColor={radial2.color} stopOpacity={radial2.opacity} />
            <Stop offset={radial2.fadeAt} stopColor={radial2.color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#lxpBase)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#lxpR1)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#lxpR2)" />
      </Svg>
    </View>
  );
}
