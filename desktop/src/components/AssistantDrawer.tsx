import { useEffect } from "react";
import { SupportChatPanel, type ChatAction } from "./SupportChatWidget";

export type { ChatAction };

/**
 * Panel deslizante (estilo drawer) del asistente de soporte, anclado a la
 * izquierda. Se renderiza como overlay fijo hermano del contenido y conserva
 * el espacio y el foco del workspace al abrirse.
 *
 * Lo dispara el botón "asistente" del navbar. `available` refleja si aplica en
 * la vista activa (autenticado, no invitado, vistas con soporte).
 */
export function AssistantDrawer({
  open,
  onOpenChange,
  token,
  language,
  onAction,
  available,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string | null;
  language: string;
  onAction: (action: ChatAction) => void;
  available: boolean;
}) {
  const isOpen = open && available && Boolean(token);

  // Cierra por Escape (además del click en el backdrop). Mismo efecto que el
  // botón X: el panel se desmonta al cerrar.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onOpenChange(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onOpenChange]);

  return (
    <>
      {isOpen ? (
        // Un click en el backdrop cierra el drawer (mismo efecto que el botón X).
        <div
          className="fixed inset-0 z-[1304] bg-black/40"
          aria-hidden="true"
          onClick={() => onOpenChange(false)}
        />
      ) : null}
      <aside
        className={`lp-assistant-drawer flex flex-col border-e border-base-300 bg-base-100 shadow-2xl dark:border-zinc-700 ${isOpen ? "is-open" : ""}`}
        aria-hidden={!isOpen}
      >
        {isOpen && token ? (
          <SupportChatPanel
            token={token}
            language={language}
            onAction={onAction}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </aside>
    </>
  );
}
