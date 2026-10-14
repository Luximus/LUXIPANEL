// Barrel del cliente de API del portal. El cuerpo COMPLETO vive dividido por
// DOMINIO en `client/*` (espejo del cliente de la app móvil); este archivo
// re-exporta TODO idéntico para no tocar los imports existentes de
// "../api/client". OJO con la resolución de módulos: `./client` resuelve a
// ESTE archivo (client.ts gana sobre el directorio client/); los módulos
// internos se importan entre sí por ruta relativa dentro de `client/`.
// Re-export de los tipos de ticket para los componentes que los importan desde
// `../api/client` (junto a las funciones de la API de soporte).
export type { Ticket, TicketAttachment, TicketDetail, TicketMessage } from "../types/models";

export * from "./client/request";
export * from "./client/panels";
export * from "./client/ssh-keys";
export * from "./client/snippets";
export * from "./client/notifications";
export * from "./client/assistant";
export * from "./client/taxonomy";
export * from "./client/metrics";
export * from "./client/panel-credential";
export * from "./client/guest";
export * from "./client/branding";
export * from "./client/shares";
export * from "./client/support";
export * from "./client/account";
export * from "./client/taxonomy-admin";
export * from "./client/security";
export * from "./client/integrations";
export * from "./client/payments";
