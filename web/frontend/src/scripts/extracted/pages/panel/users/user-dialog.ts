// Users page — create/edit user dialog. Importing this module registers
// window.openUserEdit.
import { api, resolveTargetScope } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { awaitJob } from "/scripts/extracted/lib/job-poll.js?v=1";
import { requestAssistant } from "/scripts/extracted/lib/assistant-request.js?v=1";
import { capabilities } from "./state";
import { t, fmt, showToast } from "./dom";
import { readChecked } from "./role-permissions";
import { applyUserGroupFilter, loadGroups } from "./groups";
import { loadUsers } from "./users-data";
import { openDialog } from "/scripts/extracted/lib/dom.js";

let editUserId: number | null = null;
let editUserUsername = "";

/** Reset the password field to the hidden state and sync the toggle button to
 *  the input's disabled state (password is read-only when editing). */
function resetPasswordVisibility(disabled: boolean) {
  const input = document.getElementById("user-password") as HTMLInputElement;
  const icon = document.getElementById("user-password-toggle-icon");
  const btn = document.getElementById("user-password-toggle") as HTMLButtonElement | null;
  input.type = "password";
  icon?.classList.add("ti-eye");
  icon?.classList.remove("ti-eye-off");
  if (btn) {
    btn.disabled = disabled;
    btn.setAttribute("aria-pressed", "false");
    btn.setAttribute("aria-label", t("actions.showPassword", "Mostrar contraseña"));
  }
}

(window as any).openUserEdit = async (u: any) => {
  if (!capabilities.usersEdit) return;
  // Rows can now arrive before groups. Fill membership only after the current
  // checklist exists, so its later response cannot erase checked groups.
  const root = document.getElementById("dialog-user");
  const scope = resolveTargetScope();
  await loadGroups();
  if (!capabilities.usersEdit || root !== document.getElementById("dialog-user") || scope !== resolveTargetScope()) return;
  editUserId = u.id;
  editUserUsername = u.username;
  document.getElementById("user-dialog-title")!.textContent = t("titles.editUser", "Editar usuario");
  (document.getElementById("user-username") as HTMLInputElement).value = u.username;
  (document.getElementById("user-display") as HTMLInputElement).value = u.displayName ?? "";
  (document.getElementById("user-email") as HTMLInputElement).value = u.email ?? "";
  const passwordInput = document.getElementById("user-password") as HTMLInputElement;
  passwordInput.value = "";
  // Password is never edited inline: the change requires a 2FA code, so it goes
  // through the dedicated dialog. For sudo/wheel members offer a button to that
  // flow; for everyone else show the "ask an admin" hint (and keep it disabled).
  passwordInput.disabled = true;
  resetPasswordVisibility(true);
  const passHint = document.getElementById("pass-hint")!;
  if (capabilities.canChangePw) {
    passwordInput.placeholder = t("labels.passwordChangeViaButton", "Usa el botón → requiere 2FA");
    passHint.innerHTML = "";
    const link = document.createElement("button");
    link.type = "button";
    link.id = "edit-open-change-pw";
    link.className = "underline hover:text-foreground";
    link.textContent = t("labels.passwordChangeLink", "Cambiar contraseña (requiere 2FA)");
    link.addEventListener("click", () => {
      (document.getElementById("dialog-user") as HTMLDialogElement).close();
      (window as any).openChangePasswordDialog(u);
    });
    passHint.appendChild(link);
  } else {
    passwordInput.placeholder = t("labels.passwordNotEditable", "No editable desde panel");
    passHint.textContent = t("labels.passwordHintEdit", "(deshabilitado: solicitar a un administrador del servidor)");
  }
  (document.getElementById("user-enabled") as HTMLInputElement).checked =
    u.enabled === true || u.enabled === 1 || u.enabled === "true" || u.enabled === "1";
  const memberOf = new Set(Array.isArray(u.groups) ? u.groups : []);
  document.querySelectorAll<HTMLInputElement>("input[name='user-group']").forEach((cb) => {
    cb.checked = memberOf.has(cb.value);
  });
  const search = document.getElementById("user-groups-search") as HTMLInputElement | null;
  if (search) search.value = "";
  applyUserGroupFilter();
  openDialog("dialog-user");
};

export function bindUserDialog() {
  document.getElementById("btn-new-user")?.addEventListener("click", async () => {
    if (!capabilities.usersCreate) return;
    const root = document.getElementById("dialog-user");
    const scope = resolveTargetScope();
    await loadGroups();
    if (!capabilities.usersCreate || root !== document.getElementById("dialog-user") || scope !== resolveTargetScope()) return;
    editUserId = null;
    document.getElementById("user-dialog-title")!.textContent = t("titles.newUser", "Nuevo usuario");
    document.getElementById("pass-hint")!.textContent = t("labels.passwordHintNew", "(requerida: mín. 8 caracteres, con mayúscula, minúscula y dígito)");
    (document.getElementById("form-user") as HTMLFormElement).reset();
    (document.getElementById("user-email") as HTMLInputElement).value = "";
    const passwordInput = document.getElementById("user-password") as HTMLInputElement;
    passwordInput.disabled = false;
    passwordInput.placeholder = "••••••••";
    resetPasswordVisibility(false);
    document.querySelectorAll<HTMLInputElement>("input[name='user-group']").forEach((cb) => { cb.checked = false; });
    openDialog("dialog-user");
  });

  document.getElementById("user-password-toggle")?.addEventListener("click", () => {
    const input = document.getElementById("user-password") as HTMLInputElement;
    const icon = document.getElementById("user-password-toggle-icon");
    const btn = document.getElementById("user-password-toggle");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    icon?.classList.toggle("ti-eye", !show);
    icon?.classList.toggle("ti-eye-off", show);
    btn?.setAttribute("aria-pressed", String(show));
    btn?.setAttribute("aria-label", show ? t("actions.hidePassword", "Ocultar contraseña") : t("actions.showPassword", "Mostrar contraseña"));
  });

  document.getElementById("user-groups-search")?.addEventListener("input", applyUserGroupFilter);

  const closeUserDialog = () => (document.getElementById("dialog-user") as HTMLDialogElement).close();
  document.getElementById("user-dialog-close")?.addEventListener("click", closeUserDialog);
  document.getElementById("user-cancel")?.addEventListener("click", closeUserDialog);

  document.getElementById("user-ai-help")?.addEventListener("click", () => {
    const username = (document.getElementById("user-username") as HTMLInputElement).value.trim() || t("userDialog.unnamedUser", "sin definir");
    const displayName = (document.getElementById("user-display") as HTMLInputElement).value.trim() || "—";
    const email = (document.getElementById("user-email") as HTMLInputElement).value.trim() || "—";
    const groups = readChecked("user-group").join(", ") || t("userDialog.noSelectedGroups", "ninguno");
    const enabled = (document.getElementById("user-enabled") as HTMLInputElement).checked
      ? t("labels.statusAvailable", "Disponible")
      : t("labels.statusLocked", "Bloqueado");
    const editing = editUserId !== null;
    const prompt = fmt(
      t(
        editing ? "userDialog.aiEditPrompt" : "userDialog.aiCreatePrompt",
        editing
          ? "Ayúdame a revisar la edición propuesta para este usuario Linux del servidor conectado. Explica el impacto de sus grupos y permisos, detecta riesgos y recomienda los ajustes necesarios. No solicites ni expongas contraseñas.\n\nUsuario: {username}\nNombre: {displayName}\nEmail: {email}\nGrupos: {groups}\nEstado: {enabled}"
          : "Ayúdame a crear correctamente este usuario Linux en el servidor conectado. Explica qué grupos y permisos convienen, detecta riesgos y recomienda los ajustes necesarios antes de guardarlo. No solicites ni expongas contraseñas.\n\nUsuario: {username}\nNombre: {displayName}\nEmail: {email}\nGrupos: {groups}\nEstado: {enabled}",
      ),
      { username, displayName, email, groups, enabled },
    );
    closeUserDialog();
    requestAssistant({
      kind: "prompt",
      prompt,
      submit: "auto",
      conversation: "new",
      origin: { module: "users", action: editing ? "helpEdit" : "helpCreate" },
      target: { agentId: null, projectId: null },
    });
  });

  document.getElementById("form-user")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = document.getElementById("user-error")!;
    errEl.classList.add("hidden");

    const username = (document.getElementById("user-username") as HTMLInputElement).value;
    const displayName = (document.getElementById("user-display") as HTMLInputElement).value.trim();
    const email = (document.getElementById("user-email") as HTMLInputElement).value.trim();
    const password = (document.getElementById("user-password") as HTMLInputElement).value;
    const enabled = (document.getElementById("user-enabled") as HTMLInputElement).checked;
    const userGroups = readChecked("user-group");

    const body: any = { username, enabled, groups: userGroups };
    if (displayName) body.displayName = displayName;
    if (email) body.email = email;
    if (!editUserId && password) body.password = password;
    if (editUserId) body._lookupUsername = editUserUsername;

    const res = editUserId
      ? await api.put(`/api/users/${editUserId}`, body)
      : await api.post("/api/users", body);

    if (res.ok) {
      closeUserDialog();
      showToast(editUserId ? t("toasts.userUpdated", "Usuario actualizado") : t("toasts.userCreated", "Usuario creado"));
      await awaitJob(res);
      void loadUsers();
    } else {
      errEl.textContent = res.error ?? t("errors.saveFailed", "Error al guardar");
      errEl.classList.remove("hidden");
    }
  });
}
