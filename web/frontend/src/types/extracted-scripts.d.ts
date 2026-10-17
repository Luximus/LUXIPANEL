// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Tipos para los imports por URL de los scripts extraídos.
 *
 * Los scripts extraídos (`src/scripts/extracted/**`) se importan entre sí por su
 * ruta de RUNTIME —`/scripts/extracted/lib/api-client.js?v=20260506a`— porque en
 * el navegador se sirven desde `dist/client`, no se empaquetan juntos. `tsc` no
 * sabe resolver ni la ruta absoluta ni el `?v=` de cache-busting, así que emitía
 * un TS2307 por cada import: ~123 errores.
 *
 * Eso no era ruido inocuo: enterraba los errores REALES del frontend y, peor,
 * dejaba esos ficheros efectivamente SIN TIPAR (todo import roto degradaba a
 * `any`). Aquí se declara cada módulo re-exportando su FUENTE real, así que el
 * import queda tipado de verdad; el `*` final absorbe cualquier `?v=…`.
 *
 * REGLA: si añades un script extraído nuevo a `scripts/build-extracted.mjs`,
 * añádelo también aquí. Si no, sus consumidores vuelven a quedar sin tipos.
 */

// ── lib/ compartidos (fuente en src/lib) ───────────────────────────────────
declare module "/scripts/reactbits-controls.*.js" {
  export { bindShredderOrder } from "@/components/reactbits-controls/native-controls";
}
declare module "/scripts/extracted/lib/startup-state.js*" {
  export * from "@/lib/startup-state";
}
declare module "/scripts/extracted/lib/live-data.js*" {
  export * from "@/lib/live-data";
}

declare module "/scripts/extracted/lib/api-client.js*" {
  export * from "@/lib/api-client";
}
declare module "/scripts/extracted/lib/branding-images.js*" {
  export * from "@/lib/branding-images";
}
declare module "/scripts/extracted/lib/assistant-request.js*" {
  export * from "@/lib/assistant-request";
}
declare module "/scripts/extracted/lib/confirm.js*" {
  export * from "@/lib/confirm";
}
declare module "/scripts/extracted/lib/datatable-events.js*" {
  export * from "@/lib/datatable-events";
}
declare module "/scripts/extracted/lib/job-poll.js*" {
  export * from "@/lib/job-poll";
}
declare module "/scripts/extracted/lib/script-init.js*" {
  export * from "@/lib/script-init";
}
declare module "/scripts/extracted/lib/scoped-preferences.js*" {
  export * from "@/lib/scoped-preferences";
}
declare module "/scripts/extracted/lib/toast.js*" {
  export * from "@/lib/toast";
}
declare module "/scripts/extracted/lib/page-i18n.js*" {
  export * from "@/lib/page-i18n";
}
declare module "/scripts/extracted/lib/format.js*" {
  export * from "@/lib/format";
}
declare module "/scripts/extracted/lib/layout-branding.js*" {
  export * from "@/lib/layout-branding";
}
declare module "/scripts/extracted/lib/login-effects-registry.js*" {
  export * from "@/lib/login-effects/registry";
}
declare module "/scripts/extracted/lib/api-routes.js*" {
  export * from "@/lib/api-routes";
}
declare module "/scripts/extracted/lib/panel-events.js*" {
  export * from "@/lib/panel-events";
}
declare module "/scripts/extracted/lib/search-catalog.js*" {
  export * from "@/lib/search-catalog";
}
declare module "/scripts/extracted/lib/search-target.js*" {
  export * from "@/lib/search-target";
}
declare module "/scripts/extracted/lib/branding-storage-keys.js*" {
  export * from "@/lib/branding-storage-keys";
}

// ── lib/ propios de los scripts extraídos ──────────────────────────────────
declare module "/scripts/extracted/lib/i18n-client.js*" {
  export * from "@/scripts/extracted/lib/i18n-client";
}
declare module "/scripts/extracted/lib/escape.js*" {
  export * from "@/scripts/extracted/lib/escape";
}
declare module "/scripts/extracted/lib/dom.js*" {
  export * from "@/scripts/extracted/lib/dom";
}
declare module "/scripts/extracted/lib/time.js*" {
  export * from "@/scripts/extracted/lib/time";
}
declare module "/scripts/extracted/lib/tabs.js*" {
  export * from "@/scripts/extracted/lib/tabs";
}
declare module "/scripts/extracted/lib/crud.js*" {
  export * from "@/scripts/extracted/lib/crud";
}
declare module "/scripts/extracted/lib/install-modal.js*" {
  export * from "@/scripts/extracted/lib/install-modal";
}
declare module "/scripts/extracted/lib/module-deps.js*" {
  export * from "@/scripts/extracted/lib/module-deps";
}
declare module "/scripts/extracted/lib/permission-editor.js*" {
  export * from "@/scripts/extracted/lib/permission-editor";
}
declare module "/scripts/extracted/lib/mail-server-settings.js*" {
  export * from "@/scripts/extracted/lib/mail-server-settings";
}
declare module "/scripts/extracted/lib/native-bridge.js*" {
  export * from "@/scripts/extracted/lib/native-bridge";
}
declare module "/scripts/extracted/lib/module-icons.generated.js*" {
  export * from "@/components/floating-assistant/module-icons.generated";
}

// ── layouts / páginas / vendor ─────────────────────────────────────────────
declare module "/scripts/extracted/layouts/tornasol-animation.js*" {
  export * from "@/scripts/extracted/layouts/tornasol-animation";
}
declare module "/scripts/extracted/pages/panel/files/file-icons.generated.js*" {
  export * from "@/scripts/extracted/pages/panel/files/file-icons.generated";
}
declare module "/scripts/extracted/pages/panel/files/panel-files-monaco.js*" {
  export * from "@/lib/panel-files-monaco";
}
declare module "/scripts/extracted/components/floating-terminal/terminal-monaco.js*" {
  export * from "@/scripts/extracted/components/floating-terminal/editor-monaco";
}
declare module "/scripts/extracted/vendor/qrcode-browser.js*" {
  // `export *` NO reexporta el default, y este módulo SOLO tiene default.
  export { default } from "@/scripts/qrcode-browser";
}

/**
 * `sudo.js` es el único SIN fuente TypeScript: es JS escrito a mano que vive
 * directamente en `public/scripts/extracted/lib/` (commiteado, sin entrada en
 * `build-extracted.mjs`). Como no hay `.ts` del que derivar tipos, se declaran
 * aquí a mano a partir de su implementación.
 */
declare module "/scripts/extracted/lib/sudo.js*" {
  /** Respuesta del api-client que estos helpers inspeccionan. */
  interface SudoAwareResponse {
    ok: boolean;
    error?: string;
    code?: string;
    data?: unknown;
  }

  /**
   * Abre el modal de contraseña sudo. Por defecto valida contra
   * `/api/sudo/credential` y la persiste antes de resolver; con
   * `validateAndStore: false` solo devuelve lo tecleado.
   * Resuelve a `null` si el usuario cancela.
   */
  export function promptSudoPassword(opts?: {
    validateAndStore?: boolean;
    title?: string;
    message?: string;
    previousError?: string;
  }): Promise<string | null>;

  /** Borra la contraseña cacheada en memoria para esta página. */
  export function clearSudoCache(): void;

  /**
   * Pide sudo al entrar si aún no hay credencial. `true` si acaba habiendo una
   * (previa o recién introducida), `false` si el usuario la omitió.
   */
  export function ensureSudoOnEntry(): Promise<boolean>;

  /**
   * Ejecuta `makeRequest` y, si el backend responde `SUDO_PASSWORD_REQUIRED`,
   * reintenta con la contraseña (cacheada o pedida por el modal). Ante
   * `SUDO_PASSWORD_INVALID` vuelve a preguntar; si el usuario cancela devuelve
   * un `{ ok: false, error }` sintético.
   */
  export function withSudo<T extends SudoAwareResponse>(
    makeRequest: (sudoPassword?: string) => Promise<T>,
  ): Promise<T>;
}

declare module "/scripts/extracted/lib/table-pages.js*" {
  export * from "@/lib/table-pages";
}

declare module "/scripts/extracted/lib/mail-api-client.js*" { export * from "@/scripts/extracted/lib/mail-api-client"; }
declare module "/scripts/extracted/lib/mail-job-poll.js*" { export * from "@/scripts/extracted/lib/mail-job-poll"; }
declare module "/scripts/extracted/lib/mail-sudo.js*" { export * from "@/scripts/extracted/lib/mail-sudo"; }
