/**
 * settings-icons — iconos locales del módulo Ajustes (no tocan tabler-icons):
 * SVG inline 24×24 outline. Extraídos de SettingsViewScreen para compartirlos.
 */
import React from "react";
import Svg, { Path } from "react-native-svg";

// ── Iconos locales (no tocar tabler-icons.tsx): SVG inline 24×24 outline ─────
function makeIcon(paths: string[]) {
  return function Icon({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {paths.map((d, i) => (
          <Path key={i} d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </Svg>
    );
  };
}
export const TablerLifebuoy = makeIcon([
  "M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0",
  "M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0",
  "M14.121 14.121l3.536 3.536",
  "M9.879 14.121l-3.536 3.536",
  "M14.121 9.879l3.536 -3.536",
  "M9.879 9.879l-3.536 -3.536",
]);
export const TablerTicket = makeIcon([
  "M15 5l0 2",
  "M15 11l0 2",
  "M15 17l0 2",
  "M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-3a2 2 0 0 0 0 -4v-3a2 2 0 0 1 2 -2",
]);
export const TablerSend = makeIcon([
  "M10 14l11 -11",
  "M21 3l-6.5 18a.55 .55 0 0 1 -1 0l-3.5 -7l-7 -3.5a.55 .55 0 0 1 0 -1l18 -6.5",
]);
export const TablerPhoto = makeIcon([
  "M15 8h.01",
  "M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12z",
  "M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5",
  "M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3",
]);
export const TablerPalette = makeIcon([
  "M12 21a9 9 0 0 1 0 -18c4.97 0 9 3.582 9 8c0 1.06 -.474 2.078 -1.318 2.828c-.844 .75 -1.989 1.172 -3.182 1.172h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25",
  "M8.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",
  "M12.5 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",
  "M16.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",
]);
export const TablerTag = makeIcon([
  "M7.5 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",
  "M3 6v5.172a2 2 0 0 0 .586 1.414l7.71 7.71a2.41 2.41 0 0 0 3.408 0l5.592 -5.592a2.41 2.41 0 0 0 0 -3.408l-7.71 -7.71a2 2 0 0 0 -1.414 -.586h-5.172a3 3 0 0 0 -3 3z",
]);
export const TablerUpload = makeIcon([
  "M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2",
  "M7 9l5 -5l5 5",
  "M12 4l0 12",
]);

