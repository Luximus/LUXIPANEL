/**
 * Decide si el listener de navegación de MainTab debe propagar el cambio de
 * ruta `Chat` al tab-sessions-store (persistedRoute de B3).
 *
 * Regresión que evita (QA 2026-07-13): al montar la pestaña el listener de
 * `state` dispara con la ruta inicial (≠ Chat) y persistía `null`, borrando el
 * `restoreChatPanelId` de disco ANTES de que el efecto one-shot de restore
 * llegara a consumirlo (espera token/vista/panels/navigator listos). Si el
 * proceso moría en esa ventana, la pantalla `Chat` persistida se perdía.
 *
 * Reglas:
 *  - Ruta actual ES `Chat` → persistir su panelId (y el caller debe dar por
 *    consumido cualquier restore pendiente: la navegación real manda).
 *  - Ruta actual NO es `Chat` pero hay un restore PENDIENTE → no persistir
 *    nada: el valor en disco sigue siendo la fuente de verdad hasta consumirse.
 *  - Ruta actual NO es `Chat` y no hay restore pendiente → persistir `null`
 *    (el usuario salió de la pantalla Chat).
 */
export type ChatRouteSync = { action: "persist"; panelId: string | null } | { action: "skip" };

export function syncChatRoute(routePanelId: string | null, restorePending: boolean): ChatRouteSync {
  if (routePanelId !== null) return { action: "persist", panelId: routePanelId };
  return restorePending ? { action: "skip" } : { action: "persist", panelId: null };
}
