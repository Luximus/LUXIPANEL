import { resolvePanelApiPath, resolveTargetScope, scopeHeaders } from "/scripts/extracted/lib/api-client.js";

type AssetState = { key: string; objectUrl?: string };
const assets = new Map<Element, AssetState>();
const pending = new Map<string, Promise<Blob>>();

/** Image/link elements cannot send the tab's SSH bridge header themselves. */
export async function applyBrandedAsset(element: Element, value: string, scope = resolveTargetScope()): Promise<void> {
  if (!value) return;
  for (const [target, state] of assets) {
    if (target.isConnected) continue;
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    assets.delete(target);
  }
  const attribute = element instanceof HTMLImageElement ? "src" : "href";
  const name = /^\/branding\/([a-zA-Z0-9_-][a-zA-Z0-9._-]*)$/.exec(value)?.[1];
  const url = scope !== "local" && name
    ? `/api/admin/branding/asset?${new URLSearchParams({ name, target: scope })}` : value;
  const headers = scopeHeaders();
  const key = JSON.stringify([scope, headers, url]);
  const previous = assets.get(element);
  if (previous?.key === key) return;
  if (previous?.objectUrl) URL.revokeObjectURL(previous.objectUrl);
  const state: AssetState = { key };
  assets.set(element, state);
  if (element instanceof HTMLImageElement) {
    element.removeAttribute("srcset");
    element.removeAttribute("sizes");
  }
  if (!url.startsWith("/api/")) { element.setAttribute(attribute, url); return; }
  // Do not leave the preceding server's logo visible while fetching this one.
  element.removeAttribute(attribute);
  if (scope !== resolveTargetScope() || new URL(url, window.location.origin).searchParams.get("target") !== scope) {
    assets.delete(element); return;
  }
  try {
    let request = pending.get(key);
    if (!request) {
      request = fetch(resolvePanelApiPath(url), { credentials: "include", cache: "no-store", headers })
        .then(response => {
          if (!response.ok) throw new Error("Branding image unavailable");
          return response.blob();
        });
      pending.set(key, request);
      void request.finally(() => { if (pending.get(key) === request) pending.delete(key); }).catch(() => {});
    }
    const blob = await request;
    if (assets.get(element) !== state || !element.isConnected || scope !== resolveTargetScope()
      || key !== JSON.stringify([scope, scopeHeaders(), url])) return;
    state.objectUrl = URL.createObjectURL(blob);
    element.setAttribute(attribute, state.objectUrl);
  } catch {
    if (assets.get(element) === state) assets.delete(element);
  }
}
