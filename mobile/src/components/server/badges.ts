/**
 * badges — mapeo de las "pills" de estado del DataTable de LUXIPANEL
 * (`src/config/tables/badges.ts`: okPill/dangerPill/amberPill/skyPill/neutralPill/
 * primaryPill) al sistema de tokens de la app. El web pinta cada pill como
 * `bg-<color>-500/10 border-<color>-600/30 text-<color>-700`; aquí derivamos lo
 * mismo desde un color base con `withAlpha` para que SIGA la paleta del panel
 * activo en vez de codificar verdes/rojos a mano.
 */
import type { ThemeTokens } from "../../theme/colors";
import { withAlpha } from "../../theme/colors";

export type PillKind = "ok" | "danger" | "warn" | "amber" | "sky" | "neutral" | "primary";

/** Sky no tiene token propio en la app (no hay `info`); usamos sky-500 fijo. */
const SKY = "#0ea5e9";

export type PillColors = { bg: string; border: string; text: string };

/** Colores de una pill según su tipo, derivados de un color base semántico. */
export function pillColors(tokens: ThemeTokens, kind: PillKind): PillColors {
  const base: string = (() => {
    switch (kind) {
      case "ok":
        return tokens.success;
      case "danger":
        return tokens.danger;
      case "warn":
      case "amber":
        return tokens.warning;
      case "sky":
        return SKY;
      case "primary":
        return tokens.brand;
      case "neutral":
      default:
        return tokens.textMuted;
    }
  })();
  return { bg: withAlpha(base, 0.12), border: withAlpha(base, 0.3), text: base };
}

/** Color del punto de estado (status-dot) online/offline del web. */
export function statusDotColor(tokens: ThemeTokens, online: boolean): string {
  return online ? tokens.success : tokens.textMuted;
}
