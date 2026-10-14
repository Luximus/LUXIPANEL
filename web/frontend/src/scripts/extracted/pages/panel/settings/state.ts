// Settings page — shared module-level state hub.
// LEAF module: imports NOTHING, so every submodule can import it without cycles.
// The only cross-module reassignable state lives on the exported object `S`
// (importers read a live `S.foo`; the owner writes `S.foo = …` — a plain
// `export let` can't be reassigned by an importer). Shared config consts + the
// tab-id vocabulary also live here so every submodule shares one source.
// The Servidores tab (servers-script1.ts) owns the one DataTable on this page;
// it manages its own table-id + handshake, so no shared table-id list is needed.

export const TAB_IDS = ["general", "layout", "smtp", "security", "credentials", "servers", "modules", "system"] as const;
export type TabId = (typeof TAB_IDS)[number];

// Every authenticated panel user manages their own passkeys, recovery codes
// and TOTP. The backend authorizes each request for res.locals.user.
// Do not snapshot a window flag here: ESM dependencies execute before the
// workspace's inline initialization, which incorrectly disabled these controls.
export const CAN_MANAGE_LOCAL_AUTH = true;

export const S = {
  // Which palette the user explicitly picked (so refreshActivePalette highlights
  // the correct card even for Tornasol). Null = no user pick yet, fall back to
  // color matching. Written by layout-palettes AND the load/reset pipeline.
  activePaletteId: null as string | null,
  // Recovery codes last generated in the dialog (written in security, read by
  // the copy/print handlers in bindings).
  recoveryCodes: [] as string[],
  // Cached TOTP state (written by load2FAStatusSettings, read by the toggle
  // handler in bindings).
  currentTotpState: {
    configured: false,
    enabled: false,
  },
};
