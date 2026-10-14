import React from "react";
import Svg, { Path, SvgXml } from "react-native-svg";
import { BRAND_SVGS } from "./module-brand-svgs";

/**
 * Iconos Tabler (outline) inline con `react-native-svg` — los MISMOS que el
 * sidebar de LUXIPANEL (`ti-*`). El path data se extrajo de
 * `@tabler/icons-react-native` v3.44.0 (MIT) y se inlinea aquí para NO depender
 * de ese paquete: Metro no resolvía sus imports por-subpath y el barrel metía
 * ~12k iconos en el bundle. Estilo Tabler outline: viewBox 24, fill none, stroke
 * 2, linecap/linejoin round; `color` reemplaza el `currentColor`.
 */
export type TablerIconProps = { size?: number; color?: string };

function makeTablerIcon(paths: readonly string[]) {
  return function TablerIcon({ size = 24, color = "currentColor" }: TablerIconProps) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {paths.map((d, i) => (
          // stroke/fill por Path (no se confía en la herencia del Svg): garantiza
          // el trazo outline de Tabler aunque react-native-svg no propague.
          <Path
            key={i}
            d={d}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </Svg>
    );
  };
}

// Iconos de MARCA (logos simple-icons / custom) de LUXIPANEL: el SVG completo se
// renderiza con SvgXml (respeta su viewBox/fill/mask propios). `color` reemplaza
// `currentColor`. Mismos que muestra el sidebar del panel para módulos branded.
function makeBrandIcon(xml: string) {
  return function BrandIcon({ size = 24, color = "currentColor" }: TablerIconProps) {
    return <SvgXml xml={xml} width={size} height={size} color={color} />;
  };
}
export const BrandDns = makeBrandIcon(BRAND_SVGS.nginx);            // logo nginx (ruta /panel/nginx)
export const BrandCloudflare = makeBrandIcon(BRAND_SVGS.cloudflare);
export const BrandObsidian = makeBrandIcon(BRAND_SVGS.obsidian);
export const BrandExpo = makeBrandIcon(BRAND_SVGS.expo);
export const BrandBackups = makeBrandIcon(BRAND_SVGS.backups);
export const BrandOpenclaw = makeBrandIcon(BRAND_SVGS.openclaw);

// ti-users
export const TablerUsers = makeTablerIcon([
  "M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0",
  "M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2",
  "M16 3.13a4 4 0 0 1 0 7.75",
  "M21 21v-2a4 4 0 0 0 -3 -3.85",
]);
// ti-activity
export const TablerActivity = makeTablerIcon([
  "M3 12h4l3 8l4 -16l3 8h4",
]);
// ti-folder
export const TablerFolder = makeTablerIcon([
  "M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2",
]);
// ti-shield-lock
export const TablerShieldLock = makeTablerIcon([
  "M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3",
  "M11 11a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",
  "M12 12l0 2.5",
]);
// ti-shield-check
export const TablerShieldCheck = makeTablerIcon([
  "M11.46 20.846a12 12 0 0 1 -7.96 -14.846a12 12 0 0 0 8.5 -3a12 12 0 0 0 8.5 3a12 12 0 0 1 -.09 7.06",
  "M15 19l2 2l4 -4",
]);
// ti-mail
export const TablerMail = makeTablerIcon([
  "M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10",
  "M3 7l9 6l9 -6",
]);
// ti-server
export const TablerServer = makeTablerIcon([
  "M3 7a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3",
  "M3 15a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v2a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -2",
  "M7 8l0 .01",
  "M7 16l0 .01",
]);
// ti-archive
export const TablerArchive = makeTablerIcon([
  "M3 6a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2",
  "M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-10",
  "M10 12l4 0",
]);
// ti-clock
export const TablerClock = makeTablerIcon([
  "M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0",
  "M12 7v5l3 3",
]);
// ti-database
export const TablerDatabase = makeTablerIcon([
  "M4 6a8 3 0 1 0 16 0a8 3 0 1 0 -16 0",
  "M4 6v6a8 3 0 0 0 16 0v-6",
  "M4 12v6a8 3 0 0 0 16 0v-6",
]);
// ti-notebook
export const TablerNotebook = makeTablerIcon([
  "M6 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-11a1 1 0 0 1 -1 -1v-14a1 1 0 0 1 1 -1m3 0v18",
  "M13 8l2 0",
  "M13 12l2 0",
]);
// ti-brand-cloudflare
export const TablerBrandCloudflare = makeTablerIcon([
  "M13.031 7.007c2.469 -.007 3.295 1.293 3.969 2.993c4 0 4.994 3.825 5 6h-20c-.001 -1.64 1.36 -2.954 3 -3c0 -1.5 1 -3 3 -3c.66 -1.942 2.562 -2.986 5.031 -2.993",
  "M12 13h6",
  "M17 10l-2.5 6",
]);
// ti-brand-react-native (sustituto de ti-brand-expo: Tabler RN no trae BrandExpo)
export const TablerBrandReactNative = makeTablerIcon([
  "M6.357 9c-2.637 .68 -4.357 1.845 -4.357 3.175c0 2.107 4.405 3.825 9.85 3.825c.74 0 1.26 -.039 1.95 -.097",
  "M9.837 15.9c-.413 -.596 -.806 -1.133 -1.18 -1.8c-2.751 -4.9 -3.488 -9.77 -1.63 -10.873c1.15 -.697 3.047 .253 4.974 2.254",
  "M6.429 15.387c-.702 2.688 -.56 4.716 .56 5.395c1.783 1.08 5.387 -1.958 8.043 -6.804c.36 -.67 .683 -1.329 .968 -1.978",
  "M12 18.52c1.928 2 3.817 2.95 4.978 2.253c1.85 -1.102 1.121 -5.972 -1.633 -10.873c-.384 -.677 -.777 -1.204 -1.18 -1.8",
  "M17.66 15c2.612 -.687 4.34 -1.85 4.34 -3.176c0 -2.11 -4.408 -3.824 -9.845 -3.824c-.747 0 -1.266 .029 -1.955 .087",
  "M8 12c.285 -.66 .607 -1.308 .968 -1.978c2.647 -4.844 6.253 -7.89 8.046 -6.801c1.11 .679 1.262 2.706 .56 5.393",
  "M12.26 12.015h-.01c-.01 .13 -.12 .24 -.26 .24a.263 .263 0 0 1 -.25 -.26c0 -.14 .11 -.25 .24 -.25h-.01c.13 -.01 .25 .11 .25 .24",
]);
// ti-brand-github
export const TablerBrandGithub = makeTablerIcon([
  "M9 19c-4.3 1.4 -4.3 -2.5 -6 -3m12 5v-3.5c0 -1 .1 -1.4 -.5 -2c2.8 -.3 5.5 -1.4 5.5 -6a4.6 4.6 0 0 0 -1.3 -3.2a4.2 4.2 0 0 0 -.1 -3.2s-1.1 -.3 -3.5 1.3a12.3 12.3 0 0 0 -6.2 0c-2.4 -1.6 -3.5 -1.3 -3.5 -1.3a4.2 4.2 0 0 0 -.1 3.2a4.6 4.6 0 0 0 -1.3 3.2c0 4.6 2.7 5.7 5.5 6c-.6 .6 -.6 1.2 -.5 2v3.5",
]);
// ti-webhook
export const TablerWebhook = makeTablerIcon([
  "M4.876 13.61a4 4 0 1 0 6.124 3.39h6",
  "M15.066 20.502a4 4 0 1 0 1.934 -7.502c-.706 0 -1.424 .179 -2 .5l-3 -5.5",
  "M16 8a4 4 0 1 0 -8 0c0 1.506 .77 2.818 2 3.5l-3 5.5",
]);
// ti-brain
export const TablerBrain = makeTablerIcon([
  "M15.5 13a3.5 3.5 0 0 0 -3.5 3.5v1a3.5 3.5 0 0 0 7 0v-1.8",
  "M8.5 13a3.5 3.5 0 0 1 3.5 3.5v1a3.5 3.5 0 0 1 -7 0v-1.8",
  "M17.5 16a3.5 3.5 0 0 0 0 -7h-.5",
  "M19 9.3v-2.8a3.5 3.5 0 0 0 -7 0",
  "M6.5 16a3.5 3.5 0 0 1 0 -7h.5",
  "M5 9.3v-2.8a3.5 3.5 0 0 1 7 0v10",
]);
// ti-building
export const TablerBuilding = makeTablerIcon([
  "M3 21l18 0",
  "M9 8l1 0",
  "M9 12l1 0",
  "M9 16l1 0",
  "M14 8l1 0",
  "M14 12l1 0",
  "M14 16l1 0",
  "M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16",
]);
// ti-puzzle (fallback, como el item "Módulos" del sidebar)
export const TablerPuzzle = makeTablerIcon([
  "M4 7h3a1 1 0 0 0 1 -1v-1a2 2 0 0 1 4 0v1a1 1 0 0 0 1 1h3a1 1 0 0 1 1 1v3a1 1 0 0 0 1 1h1a2 2 0 0 1 0 4h-1a1 1 0 0 0 -1 1v3a1 1 0 0 1 -1 1h-3a1 1 0 0 1 -1 -1v-1a2 2 0 0 0 -4 0v1a1 1 0 0 1 -1 1h-3a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1h1a2 2 0 0 0 0 -4h-1a1 1 0 0 1 -1 -1v-3a1 1 0 0 1 1 -1",
]);
// ti-packages (module-dev / "Mis módulos" — mismo icono que el sidebar de LUXIPANEL)
export const TablerPackages = makeTablerIcon([
  "M7 16.5l-5 -3l5 -3l5 3v5.5l-5 3l0 -5.5",
  "M2 13.5v5.5l5 3",
  "M7 16.545l5 -3.03",
  "M17 16.5l-5 -3l5 -3l5 3v5.5l-5 3l0 -5.5",
  "M12 19l5 3",
  "M17 16.5l5 -3",
  "M12 13.5v-5.5l-5 -3l5 -3l5 3v5.5",
  "M7 5.03v5.455",
  "M12 8l5 -3",
]);
// ti-layout-dashboard
export const TablerLayoutDashboard = makeTablerIcon([
  "M5 4h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1",
  "M5 16h4a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1",
  "M15 12h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1",
  "M15 4h4a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1v-2a1 1 0 0 1 1 -1",
]);
// ti-bell-ringing (server-alerts / Notificaciones)
export const TablerBellRinging = makeTablerIcon([
  "M10 5a2 2 0 0 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6",
  "M9 17v1a3 3 0 0 0 6 0v-1",
  "M21 6.727a11.05 11.05 0 0 0 -2.794 -3.727",
  "M3 6.727a11.05 11.05 0 0 1 2.792 -3.727",
]);
// ti-settings (Ajustes)
export const TablerSettings = makeTablerIcon([
  "M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065",
  "M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0",
]);
// ti-sparkles (Asistente IA — mismo icono que el header del drawer flotante de LUXIPANEL)
export const TablerSparkles = makeTablerIcon([
  "M16 18a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2z",
  "M16 6a2 2 0 0 1 2 2a2 2 0 0 1 2 -2a2 2 0 0 1 -2 -2a2 2 0 0 1 -2 2z",
  "M9 18a6 6 0 0 1 6 -6a6 6 0 0 1 -6 -6a6 6 0 0 1 -6 6a6 6 0 0 1 6 6z",
]);
// ti-terminal-2 (Terminal — mismo icono que el drawer flotante de terminal de LUXIPANEL)
export const TablerTerminal2 = makeTablerIcon([
  "M8 9l3 3l-3 3",
  "M13 15l3 0",
  "M3 4m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z",
]);

// ── Iconos de UI/tablas/usuarios (ti-*) para las pantallas de módulos nativas ──
// ti-search
export const TablerSearch = makeTablerIcon([
  "M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0",
  "M21 21l-6 -6",
]);
// ti-x
export const TablerX = makeTablerIcon(["M18 6l-12 12", "M6 6l12 12"]);
// ti-selector (header sin ordenar)
export const TablerSelector = makeTablerIcon(["M8 9l4 -4l4 4", "M16 15l-4 4l-4 -4"]);
// ti-chevron-up (orden ascendente)
export const TablerChevronUp = makeTablerIcon(["M6 15l6 -6l6 6"]);
// ti-chevron-down (orden descendente)
export const TablerChevronDown = makeTablerIcon(["M6 9l6 6l6 -6"]);
// ti-chevron-left
export const TablerChevronLeft = makeTablerIcon(["M15 6l-6 6l6 6"]);
// ti-chevron-right
export const TablerChevronRight = makeTablerIcon(["M9 6l6 6l-6 6"]);
// ti-dots-vertical (menú de acción de fila)
export const TablerDotsVertical = makeTablerIcon([
  "M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",
  "M12 19m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",
  "M12 5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",
]);
// ti-tool (Configurar tabla)
export const TablerTool = makeTablerIcon([
  "M7 10h3v-3l-3.5 -3.5a6 6 0 0 1 8 8l6 6a2 2 0 0 1 -3 3l-6 -6a6 6 0 0 1 -8 -8l3.5 3.5",
]);
// ti-user-plus
export const TablerUserPlus = makeTablerIcon([
  "M8 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0",
  "M16 19h6",
  "M19 16v6",
  "M6 21v-2a4 4 0 0 1 4 -4h4",
]);
// ti-edit
export const TablerEdit = makeTablerIcon([
  "M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1",
  "M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z",
  "M16 5l3 3",
]);
// ti-trash
export const TablerTrash = makeTablerIcon([
  "M4 7l16 0",
  "M10 11l0 6",
  "M14 11l0 6",
  "M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12",
  "M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3",
]);
// ti-key
export const TablerKey = makeTablerIcon([
  "M16.555 3.843l3.602 3.602a2.877 2.877 0 0 1 0 4.069l-2.643 2.643a2.877 2.877 0 0 1 -4.069 0l-.301 -.301l-6.558 6.558a2 2 0 0 1 -1.239 .578l-.175 .008h-1.135a1 1 0 0 1 -.993 -.883l-.007 -.117v-1.135a2 2 0 0 1 .467 -1.284l.119 -.13l.414 -.414h2v-2h2v-2l2.144 -2.144l-.301 -.301a2.877 2.877 0 0 1 0 -4.069l2.643 -2.643a2.877 2.877 0 0 1 4.069 0z",
  "M15 9h.01",
]);
// ti-lock
export const TablerLock = makeTablerIcon([
  "M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6z",
  "M11 16a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",
  "M8 11v-4a4 4 0 1 1 8 0v4",
]);
// ti-lock-open
export const TablerLockOpen = makeTablerIcon([
  "M5 11m0 2a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2z",
  "M11 16a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",
  "M8 11v-5a4 4 0 0 1 8 0",
]);
// ti-lock-password
export const TablerLockPassword = makeTablerIcon([
  "M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6z",
  "M8 11v-4a4 4 0 1 1 8 0v4",
  "M9 16h.01",
  "M12 16h.01",
  "M15 16h.01",
]);
// ti-users-group
export const TablerUsersGroup = makeTablerIcon([
  "M10 13a2 2 0 1 0 4 0a2 2 0 0 0 -4 0",
  "M8 21v-1a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v1",
  "M15 5a2 2 0 1 0 4 0a2 2 0 0 0 -4 0",
  "M17 10h2a2 2 0 0 1 2 2v1",
  "M5 5a2 2 0 1 0 4 0a2 2 0 0 0 -4 0",
  "M3 13v-1a2 2 0 0 1 2 -2h2",
]);
// ti-plus
export const TablerPlus = makeTablerIcon(["M12 5l0 14", "M5 12l14 0"]);
// ti-copy
export const TablerCopy = makeTablerIcon([
  "M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z",
  "M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1",
]);
// ti-check
export const TablerCheck = makeTablerIcon(["M5 12l5 5l10 -10"]);
// ti-alert-triangle (confirmaciones / advertencias)
export const TablerAlertTriangle = makeTablerIcon([
  "M12 9v4",
  "M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z",
  "M12 16h.01",
]);
// ti-refresh
export const TablerRefresh = makeTablerIcon([
  "M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4",
  "M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4",
]);
// ti-cpu
export const TablerCpu = makeTablerIcon([
  "M5 5m0 1a1 1 0 0 1 1 -1h12a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1z",
  "M9 9h6v6h-6z",
  "M3 10h2", "M3 14h2", "M10 3v2", "M14 3v2", "M21 10h-2", "M21 14h-2", "M14 21v-2", "M10 21v-2",
]);
// ti-device-desktop-analytics (memoria)
export const TablerDeviceAnalytics = makeTablerIcon([
  "M3 4a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1z",
  "M7 20h10", "M9 16v4", "M15 16v4", "M9 12v-4", "M12 12v-1", "M15 12v-2", "M12 12v-1",
]);
// ti-wifi
export const TablerWifi = makeTablerIcon([
  "M12 18l.01 0",
  "M9.172 15.172a4 4 0 0 1 5.656 0",
  "M6.343 12.343a8 8 0 0 1 11.314 0",
  "M3.515 9.515c4.686 -4.687 12.284 -4.687 17 0",
]);
// ti-arrow-down
export const TablerArrowDown = makeTablerIcon(["M12 5l0 14", "M18 13l-6 6", "M6 13l6 6"]);
// ti-arrow-up
export const TablerArrowUp = makeTablerIcon(["M12 5l0 14", "M18 11l-6 -6", "M6 11l6 -6"]);
// ti-device-floppy (guardar)
export const TablerDeviceFloppy = makeTablerIcon([
  "M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2",
  "M12 14m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0",
  "M14 4l0 4l-6 0l0 -4",
]);
// ti-refresh-alert (watchdog)
export const TablerRefreshAlert = makeTablerIcon([
  "M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4",
  "M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4",
  "M12 9v2", "M12 14v.01",
]);
// ti-file
export const TablerFile = makeTablerIcon([
  "M14 3v4a1 1 0 0 0 1 1h4",
  "M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z",
]);
// ti-folder-plus
export const TablerFolderPlus = makeTablerIcon([
  "M12 19h-7a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2h4l3 3h7a2 2 0 0 1 2 2v3.5",
  "M16 19h6", "M19 16v6",
]);
// ti-download
export const TablerDownload = makeTablerIcon([
  "M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2",
  "M7 11l5 5l5 -5", "M12 4l0 12",
]);
// ti-upload
export const TablerUpload = makeTablerIcon([
  "M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2",
  "M7 9l5 -5l5 5", "M12 4l0 12",
]);
// ti-player-play (ejecutar ahora)
export const TablerPlayerPlay = makeTablerIcon([
  "M7 4v16l13 -8z",
]);
// ti-player-pause (pausar / activar)
export const TablerPlayerPause = makeTablerIcon([
  "M6 5m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z",
  "M14 5m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v12a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z",
]);
// ti-rocket (lanzar build EAS)
export const TablerRocket = makeTablerIcon([
  "M4 13a8 8 0 0 1 7 7a6 6 0 0 0 3 -5a9 9 0 0 0 6 -8a3 3 0 0 0 -3 -3a9 9 0 0 0 -8 6a6 6 0 0 0 -5 3",
  "M7 14a6 6 0 0 0 -3 6a6 6 0 0 0 6 -3",
  "M15 9m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0",
]);
// ti-inbox (bandeja de correo)
export const TablerInbox = makeTablerIcon([
  "M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z",
  "M4 13h3l3 3h4l3 -3h3",
]);
// ti-arrow-forward (reenvíos)
export const TablerArrowForward = makeTablerIcon([
  "M15 11l4 4l-4 4m4 -4h-11a4 4 0 0 1 0 -8h1",
]);
