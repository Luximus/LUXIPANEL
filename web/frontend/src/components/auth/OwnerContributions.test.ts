import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/api-client", () => ({ api: { get: vi.fn(), post: vi.fn() } }));
import { api } from "@/lib/api-client";
import OwnerContributions from "./OwnerContributions";
let root: Root, container: HTMLDivElement;
const item = { id: "saved-task", status: "interrupted", updatedAt: "2026-10-16T20:33:00Z", canReview: true, canRetry: false };
const preview = { id: item.id, snapshotHash: "a".repeat(64), files: ["web/src/example.ts"], patch: "-old\n+reviewed\n" };
const button = (text: string) => [...container.querySelectorAll("button")].find(node => node.textContent === text)!;
const render = async () => { await act(async () => root.render(createElement(OwnerContributions, { locale: "es" }))); };
beforeEach(() => {
 vi.resetAllMocks(); vi.useFakeTimers();
 (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
 container = document.createElement("div"); document.body.append(container); root = createRoot(container);
 vi.mocked(api.get).mockImplementation(async route => ({ ok: true, status: 200, data: route.endsWith("/recovery") ? preview : [item] }) as any);
 vi.mocked(api.post).mockResolvedValue({ ok: true, status: 200, data: { id: "reviewed-task" } });
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.useRealTimers(); });
it("shows immutable changes before explicit publication and suppresses duplicate clicks", async () => {
 await render(); expect(button("Reintentar")).toBeUndefined(); expect(api.post).not.toHaveBeenCalled();
 await act(async () => button("Ver cambios conservados").click());
 expect(container.querySelector("pre")?.textContent).toBe(preview.patch); expect(api.post).not.toHaveBeenCalled();
 vi.mocked(api.get).mockResolvedValue({ ok: true, status: 200, data: [{ ...item, canReview: false, recoveredBy: "reviewed-task" }] });
 await act(async () => { const publish = button("Publicar cambios revisados"); publish.click(); publish.click(); });
 expect(api.post).toHaveBeenCalledExactlyOnceWith("/api/auth/github/contributions/recover", { id: item.id, snapshotHash: preview.snapshotHash });
 expect(container.textContent).toContain("Recuperación en cola"); expect(container.textContent).toContain("Recuperado en un aporte separado");
 expect(container.querySelector("pre")).toBeNull();
});
it.each(["recover", "retry"])("reports a rejected %s without claiming that it was sent", async operation => {
 if (operation === "retry") vi.mocked(api.get).mockResolvedValue({ ok: true, status: 200, data: [{ ...item, status: "blocked", canReview: false, canRetry: true }] });
 await render();
 if (operation === "recover") await act(async () => button("Ver cambios conservados").click());
 vi.mocked(api.post).mockResolvedValue({ ok: false, status: 409, error: "Los archivos cambiaron; revisa la tarea." });
 await act(async () => button(operation === "recover" ? "Publicar cambios revisados" : "Reintentar").click());
 expect(container.querySelector('[role="alert"]')?.textContent).toContain("Los archivos cambiaron");
 expect(container.textContent).not.toContain("Recuperación en cola");
});
it("ignores a late preview response after switching targets", async () => {
 await render(); let resolve!: (value: any) => void;
 vi.mocked(api.get).mockReturnValueOnce(new Promise(done => { resolve = done; }));
 await act(async () => button("Ver cambios conservados").click());
 vi.mocked(api.get).mockResolvedValue({ ok: true, status: 200, data: [] });
 await act(async () => window.dispatchEvent(new Event("luxipanel:target-changed")));
 await act(async () => resolve({ ok: true, status: 200, data: preview }));
 expect(container.querySelector("pre")).toBeNull(); expect(api.post).not.toHaveBeenCalled();
 expect(container.textContent).toContain("No hay aportes pendientes");
});
