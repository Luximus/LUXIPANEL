/**
 * Tabs de scope del sidebar (Agentes IA / Sueltos·Proyectos). Puerto DOM de
 * `app/src/components/assistant/drawer/ScopeTabs.tsx`; segmentado compacto.
 */
import { Bot, MessagesSquare } from "lucide-react";
import type { Messages } from "../../i18n";

/** Scope activo de la lista de conversaciones del sidebar. */
export type ConvScope = "agents" | "loose";

export function ScopeTabs({ value, onChange, st }: {
  value: ConvScope;
  onChange: (v: ConvScope) => void;
  st: Messages["serverStandalone"];
}) {
  const tabs: { id: ConvScope; label: string; Icon: typeof Bot }[] = [
    { id: "agents", label: st.scopeAgents, Icon: Bot },
    { id: "loose", label: st.scopeLoose, Icon: MessagesSquare },
  ];
  return (
    <div className="sat-scope-tabs" role="tablist">
      {tabs.map(({ id, label, Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`sat-scope-tab ${active ? "is-active" : ""}`}
            onClick={() => onChange(id)}
          >
            <Icon size={13} aria-hidden />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
