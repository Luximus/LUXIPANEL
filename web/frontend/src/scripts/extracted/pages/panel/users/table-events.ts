// Users page — DataTable row/quick action wiring (both tables) + the
// "review activity" assistant handoff.
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js?v=3";
import { pollJob } from "/scripts/extracted/lib/job-poll.js?v=1";
import { DATATABLE_EVENTS } from "/scripts/extracted/lib/datatable-events.js";
import { requestAssistant } from "/scripts/extracted/lib/assistant-request.js?v=1";
import { capabilities } from "./state";
import { t, fmt, showToast } from "./dom";
import { openGroupEdit } from "./role-dialog";
import { deleteGroup, loadGroups } from "./groups";
import { loadUsers } from "./users-data";

/** Abre el Asistente IA en un chat NORMAL nuevo y le pide investigar la
 *  actividad del usuario en los últimos 30 días. El bus unificado abre el
 *  drawer, auto-envía el prompt y conserva el fail-closed del módulo. */
function reviewUserActivity(row: any) {
  if (!capabilities.usersView) return;
  const username = String(row?.username ?? "").trim();
  if (!username) return;
  const displayName = String(row?.displayName ?? "").trim();
  const uidGid = String(row?.uidGid ?? "—");
  const homeDir = String(row?.homeDir ?? "—");
  const groupsLabel = String(row?.groupsLabel ?? "—");
  const modulesLabel = String(row?.modulesLabel ?? "—");
  const lastLogin = String(row?.lastLoginLabel ?? "—");
  const connections = Number(row?.connections ?? 0) || 0;

  // Prompt i18n: el texto vive en el namespace `users` (reviewActivityPrompt.*);
  // se construye con t()/fmt() para que el asistente reciba la instrucción en el
  // idioma del usuario. Los tokens {var} y comandos en backticks se preservan.
  const displaySuffix = displayName
    ? fmt(t("reviewActivityPrompt.displaySuffix", " ({displayName})"), { displayName })
    : "";
  const prompt = [
    fmt(t("reviewActivityPrompt.intro", `Investiga y resume la actividad del usuario del sistema "{username}"{displaySuffix} en este servidor durante los ÚLTIMOS 30 DÍAS.`), { username, displaySuffix }),
    ``,
    t("reviewActivityPrompt.dataHeader", "Datos conocidos (módulo Usuarios de LUXIPANEL):"),
    fmt(t("reviewActivityPrompt.dataUser", "- Usuario Linux: {username}"), { username }),
    fmt(t("reviewActivityPrompt.dataUidGid", "- UID/GID: {uidGid}"), { uidGid }),
    fmt(t("reviewActivityPrompt.dataHome", "- Home: {homeDir}"), { homeDir }),
    fmt(t("reviewActivityPrompt.dataGroups", "- Grupos: {groupsLabel}"), { groupsLabel }),
    fmt(t("reviewActivityPrompt.dataModules", "- Módulos del panel: {modulesLabel}"), { modulesLabel }),
    fmt(t("reviewActivityPrompt.dataLastLogin", "- Último acceso (panel): {lastLogin}"), { lastLogin }),
    fmt(t("reviewActivityPrompt.dataConnections", "- Conexiones activas ahora: {connections}"), { connections }),
    ``,
    t("reviewActivityPrompt.pleaseHeader", "Por favor:"),
    fmt(t("reviewActivityPrompt.step1", "1. Revisa inicios de sesión y sesiones SSH/locales (p.ej. `last {username}`, `lastlog -u {username}`, `/var/log/auth.log` o `journalctl _COMM=sshd`), con IPs de origen y fallos de autenticación."), { username }),
    t("reviewActivityPrompt.step2", "2. Revisa uso de sudo y comandos relevantes si hay registro disponible."),
    fmt(t("reviewActivityPrompt.step3", "3. Revisa archivos modificados recientemente bajo su home ({homeDir}) y cambios que haya hecho."), { homeDir }),
    t("reviewActivityPrompt.step4", "4. Señala patrones inusuales o señales de riesgo (horarios raros, IPs desconocidas, escaladas de privilegios, fuerza bruta)."),
    t("reviewActivityPrompt.step5", "5. Acota TODO a los últimos 30 días."),
    ``,
    t("reviewActivityPrompt.outro", "Usa las herramientas de servidor disponibles (terminal/SSH, logs) para obtener datos reales; no inventes. Entrega un resumen claro y conciso con los hallazgos y, si procede, recomendaciones."),
  ].join("\n");

  requestAssistant({
    kind: "prompt",
    prompt,
    submit: "auto",
    conversation: "new",
    origin: { module: "users", action: "reviewActivity" },
    target: { agentId: null, projectId: null },
  });
}

// The `#panel-users` node is replaced on every SPA entry (no transition:persist),
// so index-script1 calls bindUsersTableEvents() each visit. These listeners live
// on `window` (which persists), so without a guard they stacked up — after N
// visits one "delete user" click fired N confirms + N DELETEs. Bind once.
let usersTableEventsBound = false;

export function bindUsersTableEvents() {
  if (usersTableEventsBound) return;
  usersTableEventsBound = true;
  window.addEventListener(DATATABLE_EVENTS.ROW_ACTION, (event: Event) => {
    const detail = (event as CustomEvent<any>).detail;
    if (!detail) return;
    const row = detail.row;
    if (!row) return;

    if (detail.tableId === "users-main-table") {
      if (detail.actionId === "edit" && capabilities.usersEdit) {
        (window as any).openUserEdit(row);
        return;
      }
      if (detail.actionId === "ssh-keys" && capabilities.usersView) {
        (window as any).openSshKeysDialog(row);
        return;
      }
      if (detail.actionId === "gen-key" && capabilities.usersEdit) {
        (window as any).openGenKeyDialog(row);
        return;
      }
      if (detail.actionId === "change-password") {
        (window as any).openChangePasswordDialog(row);
        return;
      }
      if (detail.actionId === "review-activity" && capabilities.usersView) {
        reviewUserActivity(row);
        return;
      }
      if (detail.actionId === "toggle-block" && capabilities.usersEdit) {
        void (window as any).toggleBlockUser(row);
        return;
      }
      if (detail.actionId === "delete" && capabilities.usersDelete) {
        void (window as any).deleteUser(row.id, row.username);
      }
      return;
    }

    if (detail.tableId === "roles-main-table") {
      if (detail.actionId === "edit" && capabilities.rolesEdit) {
        openGroupEdit(row);
        return;
      }
      if (detail.actionId === "delete" && capabilities.rolesDelete) {
        void deleteGroup(row.name);
      }
    }
  });

  window.addEventListener(DATATABLE_EVENTS.QUICK_ACTION, async (event: Event) => {
    const detail = (event as CustomEvent<any>).detail;
    if (!detail) return;
    const rows = Array.isArray(detail.rows) ? detail.rows : [];
    if (rows.length === 0) return;

    if (detail.tableId === "users-main-table" && detail.actionId === "delete" && capabilities.usersDelete) {
      if (!await openConfirm(fmt(t("confirm.deleteUsers", "¿Eliminar {count} usuario(s) seleccionados?"), { count: rows.length }), { title: t("titles.deleteUsers", "Eliminar usuarios"), variant: "danger" })) return;
      let lastJob: any;
      for (const row of rows) {
        const r = await api.delete(`/api/users/${row.id}?username=${encodeURIComponent(row.username)}`);
        if (r.ok) lastJob = (r.data as any)?.job ?? lastJob;
      }
      showToast(t("toasts.usersDeleted", "Usuarios eliminados"));
      await pollJob(lastJob);
      void loadUsers();
      return;
    }

    if (detail.tableId === "roles-main-table" && detail.actionId === "delete" && capabilities.rolesDelete) {
      const deletable = rows.filter((r: any) => r.kind !== "system");
      if (deletable.length === 0) {
        showToast(t("toasts.cannotDeleteSystemGroups", "No se pueden eliminar grupos del sistema"), false);
        return;
      }
      if (!await openConfirm(fmt(t("confirm.deleteGroups", "¿Eliminar {count} grupo(s) seleccionados?"), { count: deletable.length }), { title: t("titles.deleteGroups", "Eliminar grupos"), variant: "danger" })) return;
      for (const row of deletable) {
        await api.delete(`/api/roles/${encodeURIComponent(row.name)}`);
      }
      showToast(t("toasts.groupsDeleted", "Grupos eliminados"));
      void loadGroups();
      void loadUsers();
      return;
    }

    if (
      detail.tableId === "users-main-table" &&
      (detail.actionId === "disable" || detail.actionId === "enable") &&
      capabilities.usersEdit
    ) {
      const enabled = detail.actionId === "enable";
      let lastJob: any;
      for (const row of rows) {
        const r = await api.put(`/api/users/${row.id}`, { enabled, _lookupUsername: row.username });
        if (r.ok) lastJob = (r.data as any)?.job ?? lastJob;
      }
      showToast(enabled ? t("toasts.usersEnabled", "Clave Linux habilitada en selección") : t("toasts.usersDisabled", "Clave Linux bloqueada en selección"));
      await pollJob(lastJob);
      void loadUsers();
    }
  });
}
