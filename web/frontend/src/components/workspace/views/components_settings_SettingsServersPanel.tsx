// SPDX-License-Identifier: AGPL-3.0-only
// Internal component migrated from src/components/settings/SettingsServersPanel.astro.
import { SlotFragment as Fragment } from "../view-context";
import {
  useViewContext,
  splitSlots,
  classList,
  cssStyle,
} from "../view-context";

// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Settings → Servidores tab.
 *
 * The SINGLE SSH target vault (CRUD + TOFU test/approve), moved here from the
 * old `/panel/servers` page and the assistant's "Servers" tab. Data source:
 * `GET /api/servers` (no secrets); mutations `POST/PUT/DELETE /api/servers/:id`;
 * `POST /api/servers/:id/test` → 409 HOST_FINGERPRINT_PENDING_APPROVAL surfaces
 * the fingerprint + approve. Admins manage global targets; non-admins their own
 * private ones (the backend filters per user). This is also the registry the AI
 * agent's servers.* tools resolve against.
 *
 * Wrapper is a `.tab-panel` whose id ENDS WITH "servers" (see settings/tabs.ts
 * activateTab). Lazy-loaded by servers-script1.ts when the tab becomes visible.
 */
import ModalNavbar from "./components_ui_ModalNavbar";
import DataTable from "@/components/ui/DataTable";
import {
  buildServersTableColumns,
  buildServersTableRowActions,
  buildServersValueBadges,
} from "@/config/tables/servers-table-config";
export default function components_settings_SettingsServersPanel(props: any) {
  const context = useViewContext();
  const slots = splitSlots(props.children);
  const Astro = context.forView(props, slots);
  const document = context.scope.document;
  const window = context.scope.window;
  interface Props {
    t: any;
  }
  const { t } = Astro.props;
  const s: any = t.servers ?? {};
  const dataTableI18n = t.components?.dataTable;
  const tbl = {
    table: s?.table,
    common: s?.common,
    authTypes: s?.authTypes,
    status: s?.status,
  };
  const d = (k: string, fb: string) =>
    (typeof s?.dialog?.[k] === "string" ? s.dialog[k] : fb) as string;

  return (
    <Fragment>
      <div className="tab-panel hidden" id="panel-servers">
        <div id="servers-root">
          <div className="mb-4 flex justify-between items-start gap-4">
            <p className="text-sm text-muted-foreground max-w-2xl">
              {s.description}
            </p>
            <button
              id="srv-new"
              className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90 active:scale-[0.98]"
            >
              <i className="ti ti-plus text-base"></i>
              {s.btnNew}
            </button>
          </div>

          <DataTable
            i18n={dataTableI18n}
            tableId="servers-table"
            title={s.pageTitle}
            columns={buildServersTableColumns(tbl)}
            data={[]}
            rowActions={buildServersTableRowActions(tbl)}
            valueBadges={buildServersValueBadges(tbl)}
            selectable={false}
          />
        </div>

        {/** ══ New / edit server dialog ══ */}
        <dialog
          id="dlg-server"
          className="w-full max-w-lg rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
        >
          <ModalNavbar
            title={d("titleNew", "Añadir servidor")}
            titleId="srv-dialog-title"
            closeId="srv-close"
          />
          <form
            id="form-server"
            className="flex flex-col gap-4 px-6 py-5 max-h-[80vh] overflow-y-auto"
          >
            <div
              id="srv-error"
              className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
            ></div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="srv-name">
                {d("name", "Nombre")}{" "}
                <span className="text-destructive">*</span>
              </label>
              <input
                id="srv-name"
                type="text"
                required
                maxLength={128}
                placeholder={d("namePlaceholder", "Mi servidor")}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <label className="text-sm font-medium" htmlFor="srv-host">
                  {d("host", "Host o IP")}{" "}
                  <span className="text-destructive">*</span>
                </label>
                <input
                  id="srv-host"
                  type="text"
                  required
                  placeholder={d("hostPlaceholder", "203.0.113.10")}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="w-24 space-y-1.5">
                <label className="text-sm font-medium" htmlFor="srv-port">
                  {d("port", "Puerto")}
                </label>
                <input
                  id="srv-port"
                  type="number"
                  min="1"
                  max="65535"
                  defaultValue="22"
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="srv-username">
                {d("username", "Usuario")}{" "}
                <span className="text-destructive">*</span>
              </label>
              <input
                id="srv-username"
                type="text"
                required
                placeholder={d("usernamePlaceholder", "root")}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="srv-authtype">
                {d("authType", "Tipo de autenticación")}
              </label>
              <select
                id="srv-authtype"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="key">{s.authTypes?.key ?? "Clave SSH"}</option>
                <option value="password">
                  {s.authTypes?.password ?? "Contraseña"}
                </option>
              </select>
            </div>

            {/** Secret: SSH key */}
            <div id="srv-key-wrap" className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="srv-secret-key">
                  {d("secretKey", "Clave privada SSH")}
                </label>
                <textarea
                  id="srv-secret-key"
                  rows={4}
                  placeholder={d(
                    "secretKeyPlaceholder",
                    "-----BEGIN OPENSSH PRIVATE KEY-----",
                  )}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                ></textarea>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="srv-passphrase">
                  {d("passphrase", "Passphrase de la clave (opcional)")}
                </label>
                <input
                  id="srv-passphrase"
                  type="password"
                  autoComplete="new-password"
                  placeholder={d("passphrasePlaceholder", "Passphrase")}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/** Secret: password */}
            <div id="srv-password-wrap" className="hidden space-y-1.5">
              <label
                className="text-sm font-medium"
                htmlFor="srv-secret-password"
              >
                {d("secretPassword", "Contraseña")}
              </label>
              <input
                id="srv-secret-password"
                type="password"
                autoComplete="new-password"
                placeholder={d("secretPasswordPlaceholder", "Contraseña")}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <p
              id="srv-keep-hint"
              className="hidden text-xs text-muted-foreground"
            >
              {d(
                "secretKeepHint",
                "Déjalo vacío para conservar el secreto actual.",
              )}
            </p>

            {/** Panel-to-panel MCP (optional): mark a target that also runs LUXIPANEL
         so the AI agent can reach it over the target's MCP endpoint (typed
         tools + its own permission/audit) instead of raw SSH. */}
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2.5">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input
                  id="srv-has-luxipanel"
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                />
                {d("hasLuxipanel", "Este servidor también corre LUXIPANEL")}
              </label>
              <div id="srv-luxipanel-url-wrap" className="hidden space-y-1.5">
                <label
                  className="text-xs font-medium text-muted-foreground"
                  htmlFor="srv-luxipanel-url"
                >
                  {d("luxipanelBaseUrl", "URL base de su LUXIPANEL")}
                </label>
                <input
                  id="srv-luxipanel-url"
                  type="url"
                  placeholder="https://panel-b.example.com"
                  className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p className="text-xs text-muted-foreground">
                  {d(
                    "pairHint",
                    "Tras guardar, usa la acción 'Emparejar' en la tabla para provisionar la credencial por SSH.",
                  )}
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                id="srv-cancel"
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                {d("btnCancel", "Cancelar")}
              </button>
              <button
                type="submit"
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {d("btnSave", "Guardar")}
              </button>
            </div>
          </form>
        </dialog>

        {/** ══ Fingerprint approval dialog ══ */}
        <dialog
          id="dlg-fingerprint"
          className="w-full max-w-md rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
        >
          <ModalNavbar
            title={s.fingerprint?.title ?? "Aprobar huella del host"}
            closeId="fp-close"
          />
          <div className="flex flex-col gap-4 px-6 py-5">
            <p className="text-sm text-muted-foreground">
              {s.fingerprint?.intro ??
                "Verifica que esta huella SSH corresponde al servidor antes de aprobarla."}
            </p>
            <code
              id="fp-value"
              className="block rounded-lg bg-card border border-border px-3 py-2 text-xs font-mono break-all"
            ></code>
            <div
              id="fp-error"
              className="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive"
            ></div>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                id="fp-cancel"
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                {s.common?.cancel ?? "Cancelar"}
              </button>
              <button
                type="button"
                id="fp-approve"
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {s.fingerprint?.approve ?? "Aprobar"}
              </button>
            </div>
          </div>
        </dialog>

        <div
          id="servers-toast"
          className="fixed bottom-4 right-4 z-50 hidden max-w-xs rounded-xl border border-border bg-card px-4 py-3 shadow-lg"
        >
          <p id="servers-toast-msg" className="text-sm font-medium"></p>
        </div>

        <script
          id="servers-i18n"
          type="application/json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }}
        ></script>
      </div>
    </Fragment>
  );
}
