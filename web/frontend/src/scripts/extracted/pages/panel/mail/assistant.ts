// Mail page — hand a mailbox off to the floating AI assistant (inbox depuration).
import { requestAssistant } from "/scripts/extracted/lib/assistant-request.js?v=1";
import { fmt, t } from "./dom";

export function depurarCuentaConIa(accountId: number, address: string): void {
  const accountRef = address || fmt(t("assistant.accountNumber", "Cuenta #{id}"), { id: accountId });
  const prompt = fmt(t("assistant.cleanupPrompt", "Depura INBOX de {account} (accountId: {id}). Recorre todos los mensajes por páginas. Lee los dudosos y revisa SPF, DKIM, DMARC, Return-Path y adjuntos. Clasifica spam, phishing y malware sin tocar correo legítimo, contactos conocidos, respuestas ni facturas. Mueve lo sospechoso a Revisar-IA; no borres nada. Resume cuántos moviste y por qué."), { account: accountRef, id: accountId });
  requestAssistant({
    kind: "prompt",
    prompt,
    submit: "prefill",
    conversation: "new",
    origin: { module: "mail", action: "depurar" },
  });
}
