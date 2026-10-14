/**
 * cron-icons — iconos locales del módulo Cron (no se tocan tabler-icons):
 * mismo estilo outline Tabler. Extraídos de CronScreen para compartirlos entre
 * la pantalla y sus diálogos.
 */
import React from "react";
import Svg, { Path } from "react-native-svg";

/** Icono local (ti-file-text) para la acción "Registros". */
export function TablerFileText({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {[
        "M14 3v4a1 1 0 0 0 1 1h4",
        "M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z",
        "M9 9l1 0",
        "M9 13l6 0",
        "M9 17l6 0",
      ].map((d, i) => (
        <Path key={i} d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}

/** Icono local (ti-download) para el botón "Instalar" del daemon cron. */
export function TablerDownload({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {["M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2", "M7 11l5 5l5 -5", "M12 4l0 12"].map((d, i) => (
        <Path key={i} d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}

/** Icono local (ti-adjustments-horizontal) para el botón "Presets". */
export function TablerAdjustments({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {[
        "M14 6m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0",
        "M4 6l8 0",
        "M16 6l4 0",
        "M8 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0",
        "M4 12l2 0",
        "M10 12l10 0",
        "M17 18m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0",
        "M4 18l11 0",
        "M19 18l1 0",
      ].map((d, i) => (
        <Path key={i} d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}

/** Icono local (ti-x) para quitar chips de categorías/etiquetas. */
export function TablerX({ size = 13, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {["M18 6l-12 12", "M6 6l12 12"].map((d, i) => (
        <Path key={i} d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}
