// SPDX-License-Identifier: AGPL-3.0-only
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { releasesService, installationRoot } from "./releases.service.js";
import { notificationsService } from "../../notifications/services/notifications.service.js";
import { localExecutor } from "../../../shared/executor/index.js";

let pending: Promise<void> | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
export function checkReleaseNotifications(): Promise<void> {
  if (pending) return pending;
  pending = (async () => {
    const status = await releasesService.status();
    const file = path.join(installationRoot(), ".releases", "notified-updates.json");
    let seen: Record<string, string> = {};
    try {
      const saved: unknown = JSON.parse(await fs.readFile(file, "utf8"));
      if (saved && typeof saved === "object" && !Array.isArray(saved)) seen = saved as Record<string, string>;
    } catch { /* First check. */ }
    const updates = status.branches.filter(b => b.updateAvailable && !b.error).map(b => ({ key: b.name, revision: b.commit,
      title: `Nuevos cambios en ${b.name}`, message: `${b.ahead} cambios disponibles. Revisa la rama y actualiza manualmente desde Versiones.` }));
    if (status.updateAvailable && status.latest && !status.error) updates.push({ key: "releases", revision: status.latest.tag,
      title: `LUXIPANEL ${status.latest.tag} disponible`, message: "Hay una nueva versión publicada. Revisa sus novedades y actualiza cuando lo decidas." });
    for (const item of updates) {
      if (seen[item.key] === item.revision) continue;
      await notificationsService.create({ source: "system", module: "releases", severity: item.key === "releases" ? "success" : "info",
        title: item.title, message: item.message, target: { href: "/panel", query: { updates: item.key }, event: { name: "luxipanel:releases-open", detail: { branch: item.key } } },
        metadata: { branch: item.key, revision: item.revision },
      }, localExecutor);
      seen[item.key] = item.revision;
      await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
      const temp = file + "." + randomUUID();
      await fs.writeFile(temp, JSON.stringify(seen), { mode: 0o600 });
      await fs.rename(temp, file);
    }
  })().finally(() => { pending = null; });
  return pending;
}
export function startReleaseNotifications(): void {
  if (timer) return;
  const check = () => { void checkReleaseNotifications().catch(() => undefined); };
  timer = setInterval(check, 300000); timer.unref(); check();
}
