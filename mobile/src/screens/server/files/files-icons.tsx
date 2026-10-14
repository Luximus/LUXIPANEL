/**
 * files-icons — iconos locales del módulo Archivos (no tocan tabler-icons.tsx):
 * mismo estilo outline Tabler 24×24. Extraídos de FilesScreen para compartirlos
 * entre la pantalla y sus subcomponentes (diálogos / herramientas).
 */
import React from "react";
import Svg, { Path } from "react-native-svg";

/** ti-git-branch local (no toca tabler-icons.tsx): mismo estilo outline Tabler. */
export function GitBranchIcon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {[
        "M7 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0",
        "M7 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0",
        "M17 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0",
        "M7 8l0 8",
        "M9 18h6a2 2 0 0 0 2 -2v-5",
        "M14 14l3 -3l3 3",
      ].map((d, i) => (
        <Path key={i} d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}

/** Iconos locales (no tocan tabler-icons.tsx): mismo outline Tabler 24×24. */
function makeIcon(paths: string[]) {
  return function Icon({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {paths.map((d, i) => (
          <Path key={i} d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </Svg>
    );
  };
}
export const CopyIcon = makeIcon([
  "M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z",
  "M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1",
]);
export const LockIcon = makeIcon([
  "M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2z",
  "M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0",
  "M8 11v-4a4 4 0 1 1 8 0v4",
]);
export const UserCogIcon = makeIcon([
  "M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0",
  "M6 21v-2a4 4 0 0 1 4 -4h2",
  "M19.001 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0",
  "M19.001 15.5v1.5",
  "M19.001 21v1.5",
  "M22.032 17.25l-1.299 .75",
  "M17.27 20l-1.3 .75",
]);
export const ShareIcon = makeIcon([
  "M6 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0",
  "M18 6m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0",
  "M18 18m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0",
  "M8.7 10.7l6.6 -3.4",
  "M8.7 13.3l6.6 3.4",
]);
export const ShieldLockIcon = makeIcon([
  "M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3",
  "M12 11m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",
  "M12 12l0 2.5",
]);
export const FileZipIcon = makeIcon([
  "M6 20.735a2 2 0 0 1 -1 -1.735v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2",
  "M11 17a2 2 0 0 1 2 2v2l-2 2l-2 -2v-2a2 2 0 0 1 2 -2z",
  "M11 5l-1 0",
  "M13 7l-1 0",
  "M11 9l-1 0",
  "M13 11l-1 0",
  "M11 13l-1 0",
]);
export const ToolIcon = makeIcon([
  "M7 10h3v-3l-3.5 -3.5a6 6 0 0 1 8 8l6 6a2 2 0 0 1 -3 3l-6 -6a6 6 0 0 1 -8 -8l3.5 3.5",
]);
export const SearchIcon = makeIcon([
  "M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0",
  "M21 21l-6 -6",
]);
export const EyeIcon = makeIcon([
  "M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0",
  "M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6",
]);
export const GlobeIcon = makeIcon([
  "M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0",
  "M3.6 9h16.8",
  "M3.6 15h16.8",
  "M11.5 3a17 17 0 0 0 0 18",
  "M12.5 3a17 17 0 0 1 0 18",
]);
export const PhotoIcon = makeIcon([
  "M15 8h.01",
  "M3 6a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v12a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3v-12z",
  "M3 16l5 -5c.928 -.893 2.072 -.893 3 0l5 5",
  "M14 14l1 -1c.928 -.893 2.072 -.893 3 0l3 3",
]);
export const WandIcon = makeIcon([
  "M6 21l15 -15l-3 -3l-15 15l3 3",
  "M15 6l3 3",
  "M9 3a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2",
  "M19 13a2 2 0 0 0 2 2a2 2 0 0 0 -2 2a2 2 0 0 0 -2 -2a2 2 0 0 0 2 -2",
]);
