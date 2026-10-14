// Iconos SVG locales del módulo Mail (mismo patrón Tabler outline que
// `tabler-icons.tsx`, sin tocar ese archivo): viewBox 24, fill none,
// stroke=color, width 2.
import React from "react";
import Svg, { Path } from "react-native-svg";

export function makeMailIcon(paths: readonly string[]) {
  return function MailIcon({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {paths.map((d, i) => (
          <Path key={i} d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </Svg>
    );
  };
}

// ti-pencil (Redactar)
export const IconPencil = makeMailIcon(["M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4", "M13.5 6.5l4 4"]);
// ti-arrow-back-up (Responder)
export const IconReply = makeMailIcon(["M9 14l-4 -4l4 -4", "M5 10h11a4 4 0 1 1 0 8h-1"]);
// ti-settings (Administrar cuenta)
export const IconCog = makeMailIcon([
  "M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z",
  "M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0",
]);
// ti-filter (Filtros)
export const IconFilter = makeMailIcon(["M4 4h16v2.172a2 2 0 0 1 -.586 1.414l-4.414 4.414v7l-6 2v-8.5l-4.48 -4.928a2 2 0 0 1 -.52 -1.345v-2.172z"]);
// ti-message (Autorespuesta)
export const IconMessage = makeMailIcon(["M8 9h8", "M8 13h6", "M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3h12z"]);
// ti-signature (Firmas)
export const IconSignature = makeMailIcon(["M3 17c3.333 -3.333 5 -6 5 -8c0 -3 -1 -3 -2 -3s-2.032 1.085 -2 3c.034 2.048 1.658 4.877 2.5 6c1.5 2 2.5 2.5 3.5 1l2 -3c.667 2.667 2 4 4 4c1.333 0 2.667 -.667 4 -2"]);
// ti-user (Contactos)
export const IconUser = makeMailIcon(["M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0", "M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"]);
// ti-folder (Carpetas)
export const IconFolder = makeMailIcon(["M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2"]);
// ti-calendar-event (Calendarios)
export const IconCalendar = makeMailIcon([
  "M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z",
  "M16 3v4", "M8 3v4", "M4 11h16", "M11 15h1", "M12 15v3",
]);
