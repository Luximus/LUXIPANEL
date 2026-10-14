// SPDX-License-Identifier: AGPL-3.0-only
import { MODULE_REGISTRY, type ModuleId } from "./module-registry";
export interface ModuleDescriptor {
  id: ModuleId;
  url: URL;
  params: Record<string, string>;
  key: string;
}
export function describeModule(
  input: string | URL,
  origin = location.origin,
): ModuleDescriptor | null {
  const url = new URL(input, origin);
  if (url.origin !== origin) return null;
  if (!url.pathname.startsWith("/panel/"))
    url.pathname = "/panel" + url.pathname;
  url.searchParams.delete("embed");
  url.searchParams.delete("settingsOverlay");
  if (url.pathname === "/panel/dns") url.pathname = "/panel/nginx";
  for (const [id, entry] of Object.entries(MODULE_REGISTRY)) {
    const names: string[] = [];
    const pattern = entry.route.replace(/\[([^\]]+)\]/g, (_match, name) => {
      names.push(name);
      return "([^/]+)";
    });
    const match = url.pathname
      .replace(/\/$/, "")
      .match(new RegExp(`^${pattern}$`));
    if (!match) continue;
    const params = Object.fromEntries(
      names.map((name, index) => [name, decodeURIComponent(match[index + 1])]),
    );
    const identity =
      id === "mail/compose"
        ? ["from", "replyTo", "forward", "draftUid"]
            .map((name) => url.searchParams.get(name) || "")
            .join(":")
        : "";
    return {
      id: id as ModuleId,
      url,
      params,
      key: id + ":" + Object.values(params).join(":") + ":" + identity,
    };
  }
  return null;
}
