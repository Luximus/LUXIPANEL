// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { beforeEach, describe, expect, it, vi } from "vitest";
import { packageInstaller } from "../../../shared/system/index.js";
import { certbotService, classifySiteRenewal, certbotLineagesFromSite } from "./certbot.service.js";

const io = vi.hoisted(() => ({
  sh: vi.fn(), readMaybeSudo: vi.fn(), writeSudo: vi.fn(),
}));
vi.mock("./nginx-sudo-io.js", () => io);

const executor = { target: { id: "test-target" } } as any;
const result = (exitCode: number) => ({ exitCode, stdout: "", stderr: "" });

describe("Certbot automatic renewal", () => {
  const files = new Map<string, string>();
  let nativeTimer = true;
  let customTimer = false;
  let systemd = true;
  let liveCertificate = true;

  beforeEach(() => {
    files.clear();
    nativeTimer = true;
    customTimer = false;
    systemd = true;
    liveCertificate = true;
    vi.spyOn(packageInstaller, "isCommandAvailable").mockResolvedValue(true);
    io.readMaybeSudo.mockReset().mockImplementation(async (_executor: unknown, path: string) => files.get(path) ?? null);
    io.writeSudo.mockReset().mockImplementation(async (_executor: unknown, path: string, content: string) => { files.set(path, content); });
    io.sh.mockReset().mockImplementation(async (_executor: unknown, command: string) => {
      if (command.includes("test -d /run/systemd/system")) return result(systemd ? 0 : 1);
      if (command.includes("systemctl is-active --quiet certbot.timer")) return result(nativeTimer ? 0 : 1);
      if (command.includes("systemctl is-enabled --quiet certbot.timer")) return result(nativeTimer ? 0 : 1);
      if (command.includes("systemctl is-active --quiet snap.certbot.renew.timer")) return result(1);
      if (command.includes("systemctl is-active --quiet luxipanel-certbot-renew.timer")) return result(customTimer ? 0 : 1);
      if (command.includes("systemctl is-enabled --quiet luxipanel-certbot-renew.timer")) return result(customTimer ? 0 : 1);
      if (command.includes("systemctl cat certbot.timer")) return result(nativeTimer ? 0 : 1);
      if (command.includes("systemctl cat snap.certbot.renew.timer")) return result(1);
      if (command.includes("systemctl enable --now luxipanel-certbot-renew.timer")) customTimer = true;
      if (command.includes("test -x /etc/letsencrypt")) return result(files.has("/etc/letsencrypt/renewal-hooks/deploy/luxipanel-nginx-reload") ? 0 : 1);
      if (command.includes("pgrep -x cron")) return result(0);
      if (command.includes("sudo -n ls -1 -- /etc/letsencrypt/renewal")) return { ...result(0), stdout: "example.com.conf\n" };
      if (command.startsWith("for f in ")) return { ...result(0), stdout: liveCertificate ? "/etc/letsencrypt/live/example.com/fullchain.pem\n" : "" };
      return result(0);
    });
  });

  it("does not claim automation when the reload hook is absent", async () => {
    const status = await certbotService.renewalStatusWithExecutor(executor);
    expect(status.scheduler).toBe("certbot.timer");
    expect(status.automatic).toBe(false);
  });

  it("installs the reload hook and enables the native timer", async () => {
    const status = await certbotService.ensureAutoRenewalWithExecutor(executor);
    expect(status.automatic).toBe(true);
    expect(status.scheduler).toBe("certbot.timer");
    expect(io.writeSudo).toHaveBeenCalledWith(executor, "/etc/letsencrypt/renewal-hooks/deploy/luxipanel-nginx-reload", expect.stringContaining("nginx -t"), expect.objectContaining({ mode: "0755" }));
    expect(io.sh.mock.calls.some(([, cmd]) => cmd.includes("systemctl enable --now certbot.timer"))).toBe(true);
  });

  it("creates a dedicated timer when the package has none", async () => {
    nativeTimer = false;
    const status = await certbotService.ensureAutoRenewalWithExecutor(executor);
    expect(status.scheduler).toBe("luxipanel-certbot-renew.timer");
    expect(files.has("/etc/systemd/system/luxipanel-certbot-renew.service")).toBe(true);
    expect(files.has("/etc/systemd/system/luxipanel-certbot-renew.timer")).toBe(true);
  });

  it("installs cron scheduling on systems without systemd", async () => {
    nativeTimer = false;
    systemd = false;
    const status = await certbotService.ensureAutoRenewalWithExecutor(executor);
    expect(status.scheduler).toBe("cron");
    expect(files.get("/etc/cron.d/luxipanel-certbot-renew")).toContain("certbot renew --quiet");
  });

  it("marks a site active only when its exact Certbot lineage is scheduled", () => {
    const site = { ssl: true, content: "ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;\nssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;" };
    const global = { installed: true, automatic: true, scheduler: "certbot.timer", reloadHook: true };
    expect(certbotLineagesFromSite(site.content)).toEqual(["example.com"]);
    expect(classifySiteRenewal(site, new Set(["example.com"]), new Set(["example.com"]), global).state).toBe("active");
    expect(classifySiteRenewal(site, new Set(["another.com"]), new Set(["example.com"]), global)).toMatchObject({ state: "attention", reason: "renewal_config_missing" });
    expect(classifySiteRenewal(site, new Set(["example.com"]), new Set(), global)).toMatchObject({ state: "attention", reason: "certificate_missing" });
    expect(classifySiteRenewal(site, new Set(["example.com"]), new Set(["example.com"]), { ...global, automatic: false })).toMatchObject({ state: "attention", reason: "scheduler_missing" });
  });

  it("distinguishes sites without HTTPS, external certificates and inaccessible renewal data", () => {
    const global = { installed: true, automatic: true, scheduler: "certbot.timer", reloadHook: true };
    expect(classifySiteRenewal({ ssl: false, content: "" }, new Set(), new Set(), global).state).toBe("no_https");
    expect(classifySiteRenewal({ ssl: true, content: "ssl_certificate /custom/cert.pem;" }, new Set(), new Set(), global).state).toBe("external");
    expect(classifySiteRenewal({ ssl: true, content: "ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;" }, null, null, global).state).toBe("unknown");
  });

  it("reads the real certificate file before reporting an individual site as active", async () => {
    const site = { name: "example.com", ssl: true, content: "ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;" };
    await certbotService.ensureAutoRenewalWithExecutor(executor);
    const initial = await certbotService.siteRenewalStatusesWithExecutor(executor, [site]);
    expect(initial[site.name]).toMatchObject({ state: "active" });
    liveCertificate = false;
    const missing = await certbotService.siteRenewalStatusesWithExecutor(executor, [site]);
    expect(missing[site.name]).toMatchObject({ state: "attention", reason: "certificate_missing" });
  });
});
