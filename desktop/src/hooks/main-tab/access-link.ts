// Parser puro de enlaces de acceso compartibles
// (`luxipanel://panel-share?token=…&mode=…`). Sin estado ni dependencias de
// React: extraído de `useMainTabController` para poder testear/reusar y aligerar
// el hook. Comportamiento idéntico al original.

export type AccessLinkMode = "private" | "public" | "guest";

export type ParsedAccessLink = { token: string; mode: AccessLinkMode | null };

/** Parsea un `luxipanel://panel-share?token=…&mode=…` (o `panel-access`).
 *  Devuelve `null` si no es un enlace de acceso válido o falta el token. */
export function parseAccessLink(rawUrl: string): ParsedAccessLink | null {
  const urlText = String(rawUrl ?? "").trim();
  if (!urlText) return null;
  let parsed: URL;
  try { parsed = new URL(urlText); } catch { return null; }
  const location = `${parsed.hostname ?? ""}${parsed.pathname ?? ""}`.toLowerCase();
  if (!location.includes("panel-share") && !location.includes("panel-access")) return null;
  const accessToken = parsed.searchParams.get("token")?.trim() ?? "";
  if (!accessToken) return null;
  const modeRaw = parsed.searchParams.get("mode")?.trim().toLowerCase();
  const mode: AccessLinkMode | null =
    modeRaw === "private" || modeRaw === "public" || modeRaw === "guest" ? modeRaw : null;
  return { token: accessToken, mode };
}
