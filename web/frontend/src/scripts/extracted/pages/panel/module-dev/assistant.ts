// Module-dev page — assistant deep-link (contrato v1 lxp:assistant:request).
import { requestAssistant } from "/scripts/extracted/lib/assistant-request.js?v=1";
import { t, fmt } from "./dom";

// ── Deep-link al asistente (contrato v1 lxp:assistant:request) ───────────────
export function createWithAssistant() {
  requestAssistant({
    kind: "prompt",
    prompt: t("seeds.createPrompt", "Quiero crear un módulo del marketplace de LUXIPANEL. Empieza por /mod vincular <slug-del-modulo> (elige conmigo un slug válido: ^[a-z][a-z0-9-]{2,38}$) y sigue el guion de alta para recoger los metadatos del módulo."),
    submit: "prefill",
    conversation: "new",
    origin: { module: "module-dev", action: "create" },
  });
}

export function openChatForModule(code: string) {
  requestAssistant({
    kind: "prompt",
    prompt: fmt(t("seeds.chatPrompt", "Estoy trabajando en mi módulo del marketplace \"{code}\" desde la página Dev de módulos de LUXIPANEL. Ejecuta /mod estado, cuéntame en qué estado está \"{code}\" y qué paso del ciclo sigue."), { code }),
    submit: "prefill",
    conversation: "new",
    origin: { module: "module-dev", action: "openChat" },
  });
}
