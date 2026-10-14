/**
 * Shared driver for the <InstallModal> component.
 *
 * Opens the modal, POSTs to a module's install endpoint, shows the live
 * package-manager log in the modal, and routes sudo-password prompts through
 * the shared `withSudo` flow. Reusable by any module that installs libraries
 * (firewall, bitninja, mail, …).
 *
 * Backend contract: the endpoint returns `{ ok, data: { output?: string,
 * code?: "SUDO_PASSWORD_REQUIRED" | "SUDO_PASSWORD_INVALID" } }`. `withSudo`
 * reads `data.code`; this helper renders `data.output`.
 */
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { withSudo } from "/scripts/extracted/lib/sudo.js?v=20260506c";

export interface InstallModalOptions {
  /** Base id matching the <InstallModal id="..."/> instance. */
  id: string;
  /** Install endpoint (POST). */
  endpoint: string;
  /** Extra body fields merged into the request (sudoPassword is added by the flow). */
  body?: Record<string, unknown>;
  /** Status text shown while the install runs. */
  runningText?: string;
  /** Status text shown on success. */
  successText?: string;
}

export interface InstallModalResult {
  ok: boolean;
  error?: string;
}

function el(id: string): HTMLElement | null {
  return document.getElementById(id);
}

// Textos por defecto del modal de instalación. Se pueden sobrescribir por
// página vía un <script type="application/json" id="install-modal-i18n">
// (components.installModal). Fallback en español verbatim si no existe.
type InstallModalI18n = {
  running: string;
  success: string;
  failed: string;
};

const INSTALL_I18N: InstallModalI18n = (() => {
  // Fallback intencional: las páginas que no inyectan `install-modal-i18n`
  // (componentes.installModal) en español usan este verbatim. Para i18n
  // completo, las páginas deben emitir `<script type="application/json"
  // id="install-modal-i18n">` con los strings localizados.
  const fallback: InstallModalI18n = {
    running: "Instalando… puede tardar unos minutos.",
    success: "Instalación completada.",
    failed: "La instalación falló. Revisa el registro.",
  };
  try {
    const node = document.getElementById("install-modal-i18n");
    if (node?.textContent) return { ...fallback, ...JSON.parse(node.textContent) };
  } catch {
    /* usa el fallback */
  }
  return fallback;
})();

/**
 * Run an install inside the modal. Resolves with `{ ok }` once the install
 * finished (success or error); the modal stays open so the user can read the
 * log and close it manually.
 */
export async function runInstall(opts: InstallModalOptions): Promise<InstallModalResult> {
  const dlg = el(`dlg-${opts.id}-install`) as HTMLDialogElement | null;
  const statusEl = el(`${opts.id}-install-status`);
  const spinner = el(`${opts.id}-install-spinner`);
  const output = el(`${opts.id}-install-output`);
  const closeBtn = el(`${opts.id}-install-close`) as HTMLButtonElement | null;

  if (dlg && !dlg.open) dlg.showModal();
  if (output) {
    output.textContent = "";
    output.classList.add("hidden");
  }
  // Running state: spinner on, close disabled (avoid interrupting apt mid-run).
  spinner?.classList.remove("hidden");
  if (statusEl) statusEl.textContent = opts.runningText ?? INSTALL_I18N.running;
  if (closeBtn) closeBtn.disabled = true;

  const res = await withSudo((sudoPassword?: string) =>
    api.post<any>(
      opts.endpoint,
      sudoPassword ? { ...(opts.body ?? {}), sudoPassword } : { ...(opts.body ?? {}) },
    ),
  );

  const data = (res.data as any) ?? {};
  const text = typeof data.output === "string" ? data.output : "";
  if (output && text) {
    output.textContent = text;
    output.classList.remove("hidden");
    output.scrollTop = output.scrollHeight;
  }

  spinner?.classList.add("hidden");
  if (closeBtn) closeBtn.disabled = false;
  if (statusEl) {
    if (res.ok) {
      statusEl.textContent = opts.successText ?? INSTALL_I18N.success;
      statusEl.className = "text-emerald-500 font-medium";
    } else {
      statusEl.textContent = res.error || INSTALL_I18N.failed;
      statusEl.className = "text-destructive font-medium";
    }
  }

  return { ok: res.ok, error: res.error };
}

/** Wire the close button of an install modal (idempotent per element). */
export function bindInstallModalClose(id: string): void {
  const dlg = el(`dlg-${id}-install`) as HTMLDialogElement | null;
  const closeBtn = el(`${id}-install-close`) as HTMLButtonElement | null;
  closeBtn?.addEventListener("click", () => {
    if (!closeBtn.disabled) dlg?.close();
  });
}
