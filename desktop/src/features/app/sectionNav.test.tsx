import { describe, it, expect, vi } from "vitest";
import { buildSectionNav } from "./sectionNav";
import { getMessages } from "../../i18n";

const t = getMessages("en");

describe("buildSectionNav", () => {
  it("devuelve servers/jobs/publicaciones/support/payments/notifications sin admin", () => {
    const items = buildSectionNav({ t });
    expect(items.map((i) => i.key)).toEqual([
      "servers",
      "jobs",
      "publicaciones",
      "support",
      "payments",
      "notifications",
    ]);
  });

  it("añade admin al final cuando showAdmin es true", () => {
    const items = buildSectionNav({ t, showAdmin: true });
    expect(items.map((i) => i.key)).toEqual([
      "servers",
      "jobs",
      "publicaciones",
      "support",
      "payments",
      "notifications",
      "admin",
    ]);
  });

  it("oculta support y notifications con sus flags en false", () => {
    const items = buildSectionNav({ t, showSupport: false, showNotifications: false });
    expect(items.map((i) => i.key)).toEqual(["servers", "jobs", "publicaciones", "payments"]);
  });

  it("nunca incluye un item 'security'", () => {
    const without = buildSectionNav({ t });
    const withAdmin = buildSectionNav({ t, showAdmin: true });
    // `security` no es un SectionKey (TS lo marcaría como sin solapamiento): el
    // cast a string mantiene la intención del test (verificar su ausencia).
    expect(without.some((i) => (i.key as string) === "security")).toBe(false);
    expect(withAdmin.some((i) => (i.key as string) === "security")).toBe(false);
  });

  it("usa las etiquetas i18n correspondientes", () => {
    const items = buildSectionNav({ t, showAdmin: true });
    const byKey = Object.fromEntries(items.map((i) => [i.key, i.label]));
    expect(byKey.servers).toBe(t.titleBar.fabServers);
    expect(byKey.support).toBe(t.titleBar.fabSupport);
    expect(byKey.payments).toBe(t.titleBar.fabPayments);
    expect(byKey.admin).toBe(t.admin.section);
  });

  it("marca servers activo en las vistas de servidor (dashboard/loading-panel/ssh)", () => {
    for (const view of ["dashboard", "loading-panel", "ssh"]) {
      const items = buildSectionNav({ t, activeView: view });
      const byKey = Object.fromEntries(items.map((i) => [i.key, i.active]));
      expect(byKey.servers).toBe(true);
      expect(byKey.support).toBe(false);
      expect(byKey.payments).toBe(false);
    }
  });

  it("marca support activo cuando activeView es 'support'", () => {
    const items = buildSectionNav({ t, activeView: "support" });
    const byKey = Object.fromEntries(items.map((i) => [i.key, i.active]));
    expect(byKey.support).toBe(true);
    expect(byKey.servers).toBe(false);
    expect(byKey.payments).toBe(false);
  });

  it("payments se resalta vía paymentsActive (no es una vista)", () => {
    const items = buildSectionNav({ t, activeView: "payments", paymentsActive: true });
    const byKey = Object.fromEntries(items.map((i) => [i.key, i.active]));
    // activeView "payments" no existe como vista: solo paymentsActive resalta.
    expect(byKey.payments).toBe(true);
    expect(byKey.servers).toBe(false);
    expect(byKey.support).toBe(false);
  });

  it("admin activo cuando activeView es 'admin'", () => {
    const items = buildSectionNav({ t, showAdmin: true, activeView: "admin" });
    expect(items.find((i) => i.key === "admin")?.active).toBe(true);
  });

  it("cablea cada onSelect a su item correcto", () => {
    const onServers = vi.fn();
    const onSupport = vi.fn();
    const onPayments = vi.fn();
    const onAdmin = vi.fn();
    const items = buildSectionNav({
      t,
      showAdmin: true,
      onServers,
      onSupport,
      onPayments,
      onAdmin,
    });
    const byKey = Object.fromEntries(items.map((i) => [i.key, i.onSelect]));

    byKey.servers?.();
    expect(onServers).toHaveBeenCalledTimes(1);
    expect(onSupport).not.toHaveBeenCalled();
    expect(onPayments).not.toHaveBeenCalled();
    expect(onAdmin).not.toHaveBeenCalled();

    byKey.support?.();
    expect(onSupport).toHaveBeenCalledTimes(1);

    byKey.payments?.();
    expect(onPayments).toHaveBeenCalledTimes(1);

    byKey.admin?.();
    expect(onAdmin).toHaveBeenCalledTimes(1);
  });
});
