import "./StartTiles.css";
import type { ComponentType } from "react";
import { Activity, ArrowRight, ServerCog, ShieldCheck, Sparkles, TerminalSquare, Zap } from "lucide-react";
import type { Messages } from "../../i18n";

/**
 * Estado vacío "puntos de partida" del chat nuevo (paridad DOM con `StartTiles`
 * de la app móvil y con `START_TILES` de la web `ChatPane.tsx`): título +
 * subtítulo + rejilla de tarjetas de sugerencia con icono de color. Al pulsar una
 * se envía como primer mensaje (`onPick`); el enlace inferior enfoca el composer.
 * Se muestra SOLO en chat vacío sin agente activo.
 */

// Paleta rotativa: un cuadro de color por tarjeta con glifo blanco; la posición
// de la sugerencia indexa color+icono (indigo/emerald/sky/amber/rose/violet).
const START_TILES: { color: string; icon: ComponentType<{ size?: number }> }[] = [
  { color: "#6366f1", icon: Sparkles },
  { color: "#10b981", icon: ServerCog },
  { color: "#0ea5e9", icon: TerminalSquare },
  { color: "#f59e0b", icon: ShieldCheck },
  { color: "#f43f5e", icon: Activity },
  { color: "#8b5cf6", icon: Zap },
];

export function StartTiles({
  quickReplies,
  providerLabel,
  st,
  onPick,
  onFocusComposer,
}: {
  quickReplies: string[];
  providerLabel: string;
  st: Messages["serverStandalone"];
  onPick: (text: string) => void;
  onFocusComposer: () => void;
}) {
  return (
    <div className="sast-wrap">
      <div className="sast-inner">
        <h3 className="sast-title">{st.quickStartTitle.replace("{provider}", providerLabel)}</h3>
        <p className="sast-subtitle">{st.quickStartSubtitle}</p>
        <div className="sast-divider" aria-hidden />
        <div className="sast-grid">
          {quickReplies.map((ex, i) => {
            const tile = START_TILES[i % START_TILES.length];
            const TileIcon = tile.icon;
            return (
              <button key={i} type="button" className="sast-card" onClick={() => onPick(ex)}>
                <span className="sast-card-tile" style={{ backgroundColor: tile.color }}>
                  <TileIcon size={16} />
                </span>
                <span className="sast-card-text">{ex}</span>
                <ArrowRight size={15} className="sast-card-arrow" aria-hidden />
              </button>
            );
          })}
        </div>
        <button type="button" className="sast-type-below" onClick={onFocusComposer}>
          {st.quickStartOrTypeBelow}
        </button>
      </div>
    </div>
  );
}
