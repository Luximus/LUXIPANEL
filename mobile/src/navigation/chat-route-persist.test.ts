/**
 * Tests de `syncChatRoute`: guard contra el borrado prematuro del
 * `restoreChatPanelId` persistido (QA 2026-07-13). El listener de navegación
 * de MainTab dispara al montar con la ruta inicial (≠ Chat); sin el guard eso
 * persistía `null` y borraba de disco la pantalla `Chat` a restaurar antes de
 * que el efecto one-shot la consumiera.
 */
import { describe, expect, it } from "vitest";
import { syncChatRoute } from "./chat-route-persist";

describe("syncChatRoute", () => {
  it("REGRESIÓN: ruta inicial ≠ Chat con restore pendiente → NO persiste (no borra el restore de disco)", () => {
    expect(syncChatRoute(null, true)).toEqual({ action: "skip" });
  });

  it("ruta ≠ Chat sin restore pendiente → persiste null (salida real de la pantalla Chat)", () => {
    expect(syncChatRoute(null, false)).toEqual({ action: "persist", panelId: null });
  });

  it("ruta Chat → persiste su panelId, haya o no restore pendiente", () => {
    expect(syncChatRoute("panel-7", false)).toEqual({ action: "persist", panelId: "panel-7" });
    expect(syncChatRoute("panel-7", true)).toEqual({ action: "persist", panelId: "panel-7" });
  });
});
