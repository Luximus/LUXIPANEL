/**
 * obsidian-helpers — helpers puros y de red del módulo Obsidian de desktop.
 * Extraídos de `ObsidianModule.tsx` (split conservador, sin cambios de forma).
 */
import { withJob, type GatewayResponse } from "../../../api/serverApi";
import type { NoteItem } from "./obsidian-types";

export const GUARDS = ["NO_CREDENTIALS", "FINGERPRINT_PENDING", "PANEL_UNAVAILABLE"];
export const enc = encodeURIComponent;

/** Espejo del `runServerMutation` de app (`app/src/hooks/useServerApi.ts`). */
export async function runServerMutation(
  serverId: string,
  op: () => Promise<GatewayResponse>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await op();
    if (res.code && GUARDS.includes(res.code)) return { ok: false, error: res.code };
    if (!res.ok) {
      const panel = res.data as { error?: string; message?: string } | undefined;
      return { ok: false, error: panel?.error ?? panel?.message ?? res.error };
    }
    await withJob(res, serverId, "");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network_error" };
  }
}

/** Extrae la lista de notas del árbol del vault de forma DEFENSIVA: el panel
 *  devuelve `{ folders, notes }`, pero puede llegar como array directo o con la
 *  lista de notas bajo otra clave; buscamos el primer array de objetos con path/name. */
export function extractNotes(tree: unknown): NoteItem[] {
  if (!tree) return [];
  let candidates: unknown[] = [];
  if (Array.isArray(tree)) {
    candidates = tree;
  } else if (typeof tree === "object") {
    const obj = tree as Record<string, unknown>;
    if (Array.isArray(obj.notes)) {
      candidates = obj.notes;
    } else {
      for (const value of Object.values(obj)) {
        if (Array.isArray(value) && value.some((x) => x && typeof x === "object" && ("path" in x || "name" in x))) {
          candidates = value;
          break;
        }
      }
    }
  }
  const out: NoteItem[] = [];
  for (const c of candidates) {
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    const path = typeof o.path === "string" ? o.path : typeof o.name === "string" ? o.name : "";
    if (!path) continue;
    const name = typeof o.name === "string" ? o.name : path.split("/").pop() ?? path;
    out.push({
      path,
      name,
      sizeBytes: typeof o.sizeBytes === "number" ? o.sizeBytes : undefined,
      modifiedAt: typeof o.modifiedAt === "string" ? o.modifiedAt : undefined,
    });
  }
  return out;
}

export function fmtBytes(n?: number): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  try {
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" } as Intl.DateTimeFormatOptions);
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}
