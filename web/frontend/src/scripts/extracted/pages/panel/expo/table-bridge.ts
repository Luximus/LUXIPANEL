// Expo page — DataTable bridge: publishes the (already-filtered) row datasets to
// the builds / store / env DataTable islands, and owns the READY handshake
// LISTENER + ready/cache state. The REQUEST_READY emit stays in the entry.
//
// F-09: el par `ready[tableId]` / `cache[tableId]` con su `publish()` y el
// listener de READY vive ahora en `createTableFeed` (lib/datatable-events).
import { createTableFeed } from "/scripts/extracted/lib/datatable-events.js";
import { EXPO_BUILDS_TABLE_ID, EXPO_STORE_TABLE_ID, EXPO_ENV_TABLE_ID } from "./state";

const feed = createTableFeed([EXPO_BUILDS_TABLE_ID, EXPO_STORE_TABLE_ID, EXPO_ENV_TABLE_ID]);

export function publishExpoRows(tableId: string, rows: Record<string, unknown>[]) {
  feed.publish(tableId, rows);
}

export function setExpoTableLoading(tableId: string, loading: boolean) {
  feed.setLoading(tableId, loading);
}

export function bindExpoTableReady() {
  feed.bindReady();
}
