// Barrel del cliente de API del portal. El cuerpo se dividió por DOMINIO en
// `client/*` (espejo del cliente de desktop); este archivo re-exporta TODO
// idéntico para no tocar los ~100 imports existentes de "../api/client".
// Nota resolución: `./client` resuelve a ESTE archivo (client.ts gana a la
// carpeta `client/`, que a propósito NO tiene index.ts) — la fachada es única.
export * from "./client/request";
export * from "./client/panels";
export * from "./client/terminal";
export * from "./client/ssh-keys";
export * from "./client/snippets";
export * from "./client/notifications";
export * from "./client/assistant";
export * from "./client/taxonomy";
export * from "./client/metrics";
export * from "./client/panel-credential";
export * from "./client/branding";
export * from "./client/sharing";
export * from "./client/support-tickets";
export * from "./client/account";
export * from "./client/admin-views";
export * from "./client/security";
export * from "./client/integrations";
export * from "./client/payments";
