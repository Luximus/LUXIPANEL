// Cloudflare page — DataTable feed (cache por tableId + flag ready) + READY
// handshake LISTENER and ROW_ACTION dispatch. REQUEST_READY emit stays in the entry.
// F-09: el par `ready[tableId]` / `cache[tableId]` con su `publish()` y el
// listener de READY vive ahora en `createTableFeed` (lib/datatable-events);
// aquí solo queda el despacho de ROW_ACTION, que sí es propio del módulo.
import { createTableFeed, DATATABLE_EVENTS } from "/scripts/extracted/lib/datatable-events.js";
import { state, CF_DNS_TABLE_ID, CF_ACCESS_TABLE_ID } from "./state";
import { openDnsDialog, deleteDnsRecord } from "./dns";
import { deleteAccessRule } from "./access";

const feed = createTableFeed([CF_DNS_TABLE_ID, CF_ACCESS_TABLE_ID]);

export const tableCache = feed.cache;

export function publishRows(tableId: string, rows: Record<string, unknown>[]) {
  feed.publish(tableId, rows);
}

// ── DataTable events (ready handshake + row actions, gated by tableId) ───────
let cfTablesBound = false;
export function bindCfTables() {
  if (cfTablesBound) return;
  cfTablesBound = true;

  feed.bindReady();

  window.addEventListener(DATATABLE_EVENTS.ROW_ACTION, (event: Event) => {
    const detail = (event as CustomEvent<{ tableId?: string; actionId?: string; row?: Record<string, unknown> }>).detail;
    if (!detail?.row || !detail.actionId) return;
    const id = String(detail.row._id ?? "");
    if (detail.tableId === CF_DNS_TABLE_ID) {
      const rec = state.records.find((r) => r.id === id);
      if (!rec) return;
      if (detail.actionId === "edit") openDnsDialog("edit", rec);
      else if (detail.actionId === "delete") void deleteDnsRecord(rec);
      return;
    }
    if (detail.tableId === CF_ACCESS_TABLE_ID) {
      const rule = state.rules.find((r) => r.id === id);
      if (rule && detail.actionId === "delete") void deleteAccessRule(rule);
      return;
    }
  });
}
