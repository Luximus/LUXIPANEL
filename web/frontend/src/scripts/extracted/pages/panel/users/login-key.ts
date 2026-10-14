// Users page — generate-login-key dialog + the one-time key-pair viewer.
// Importing this module registers window.openGenKeyDialog.
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { capabilities } from "./state";
import { t, fmt, showToast, escapeHtml } from "./dom";
import { openDialog } from "/scripts/extracted/lib/dom.js";

// Generate-login-key dialog target.
let genKeyUserId: number | null = null;
let genKeyUsername = "";

/** Show the one-time login key pair generated for a newly created user. The
 *  private key must be copied and registered manually in LP-LICENSE-SERVER. */
function showUserKeyDialog(key: { privateKey: string; publicKey: string; fingerprint: string }) {
  (document.getElementById("user-key-private") as HTMLTextAreaElement).value = key.privateKey ?? "";
  (document.getElementById("user-key-public") as HTMLTextAreaElement).value = key.publicKey ?? "";
  document.getElementById("user-key-fp")!.textContent = key.fingerprint ?? "—";
  openDialog("dialog-user-key");
}

(window as any).openGenKeyDialog = (u: any) => {
  if (!capabilities.usersEdit) return;
  genKeyUserId = u.id;
  genKeyUsername = u.username;
  document.getElementById("gen-key-title")!.innerHTML = `<i class="ti ti-folder-key text-lg text-primary"></i>${escapeHtml(fmt(t("titles.genKey", "Generar llave de acceso · {username}"), { username: u.username }))}`;
  const pass = document.getElementById("gen-key-pass") as HTMLInputElement;
  pass.value = "";
  pass.type = "password";
  document.getElementById("gen-key-pass-toggle-icon")?.classList.add("ti-eye");
  document.getElementById("gen-key-pass-toggle-icon")?.classList.remove("ti-eye-off");
  document.getElementById("gen-key-error")?.classList.add("hidden");
  openDialog("dialog-gen-key");
};

export function bindGenKeyDialog() {
  const dlg = () => document.getElementById("dialog-gen-key") as HTMLDialogElement;
  const close = () => dlg().close();
  document.getElementById("gen-key-close")?.addEventListener("click", close);
  document.getElementById("gen-key-cancel")?.addEventListener("click", close);
  document.getElementById("gen-key-pass-toggle")?.addEventListener("click", () => {
    const input = document.getElementById("gen-key-pass") as HTMLInputElement;
    const icon = document.getElementById("gen-key-pass-toggle-icon");
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    icon?.classList.toggle("ti-eye", !show);
    icon?.classList.toggle("ti-eye-off", show);
  });

  document.getElementById("form-gen-key")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = document.getElementById("gen-key-error")!;
    errEl.classList.add("hidden");
    const passphrase = (document.getElementById("gen-key-pass") as HTMLInputElement).value;
    if (!passphrase) return;
    const submit = document.getElementById("gen-key-submit") as HTMLButtonElement;
    submit.disabled = true;
    try {
      const res = await api.post(`/api/users/${genKeyUserId}/login-key`, { passphrase, username: genKeyUsername });
      if (res.ok && (res.data as any)) {
        close();
        showUserKeyDialog(res.data as any);
      } else {
        errEl.textContent = res.error ?? t("errors.genKeyFailed", "No se pudo generar la llave");
        errEl.classList.remove("hidden");
      }
    } finally {
      submit.disabled = false;
    }
  });
}

export function bindUserKeyDialog() {
  const dlg = () => document.getElementById("dialog-user-key") as HTMLDialogElement;
  const clear = () => {
    (document.getElementById("user-key-private") as HTMLTextAreaElement).value = "";
    (document.getElementById("user-key-public") as HTMLTextAreaElement).value = "";
    document.getElementById("user-key-fp")!.textContent = "";
  };
  const close = () => { dlg().close(); clear(); };
  document.getElementById("user-key-close")?.addEventListener("click", close);
  document.getElementById("user-key-done")?.addEventListener("click", close);
  const copyFrom = async (id: string) => {
    const el = document.getElementById(id) as HTMLTextAreaElement;
    try {
      await navigator.clipboard.writeText(el.value);
      showToast(t("toasts.copied", "Copiado al portapapeles"));
    } catch {
      el.select();
      document.execCommand("copy");
    }
  };
  document.getElementById("user-key-copy-priv")?.addEventListener("click", () => void copyFrom("user-key-private"));
  document.getElementById("user-key-copy-pub")?.addEventListener("click", () => void copyFrom("user-key-public"));
}
