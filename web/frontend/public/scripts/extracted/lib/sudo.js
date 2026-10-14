/**
 * Sudo password helper.
 *
 * The backend stores an AES-encrypted sudo password per target. Once the
 * user has entered it once it is reused for every privileged action on
 * the same server until either the system password changes or the user
 * explicitly clears it (`api.delete("/api/sudo/credential")`).
 *
 * Surface from this module:
 *   - `withSudo(makeRequest)` — wraps any privileged backend call. On
 *     `code: SUDO_PASSWORD_REQUIRED` shows a modal, sends the entered
 *     password (which the backend validates and persists), and retries.
 *   - `ensureSudoOnEntry()` — call once on module entry. If no credential
 *     is stored, opens the modal so the user enters it before triggering
 *     any privileged action. Skipping is allowed.
 *   - `promptSudoPassword(message?)` — show the modal directly.
 *   - `clearSudoCache()` — wipe the in-memory cache (also wired to
 *     `astro:before-swap`).
 *
 * The plaintext password lives only in a closure variable on the client.
 * It is never written to localStorage / sessionStorage. It travels in the
 * `sudoPassword` field of the JSON body over HTTPS.
 */

import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";

let cachedPassword = null;

document.addEventListener?.("astro:before-swap", () => {
  cachedPassword = null;
});

function ensureModal() {
  let dlg = document.getElementById("dlg-sudo-prompt");
  if (dlg) return dlg;

  dlg = document.createElement("dialog");
  dlg.id = "dlg-sudo-prompt";
  dlg.className =
    "w-full max-w-md rounded-2xl border border-border bg-card p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm";
  dlg.innerHTML = `
    <form id="sudo-prompt-form" class="flex flex-col gap-4">
      <div class="flex items-center justify-between border-b border-border px-6 py-4">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-500/10 text-yellow-600">
            <i class="ti ti-shield-lock text-lg"></i>
          </div>
          <div>
            <h3 class="text-base font-semibold">Contraseña sudo requerida</h3>
            <p class="text-xs text-muted-foreground">Se guarda cifrada en el servidor para acciones futuras.</p>
          </div>
        </div>
        <button type="button" id="sudo-prompt-close" class="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
          <i class="ti ti-x text-lg"></i>
        </button>
      </div>
      <div class="px-6 py-2 space-y-3">
        <p id="sudo-prompt-message" class="text-sm text-muted-foreground">
          El panel necesita la contraseña sudo del usuario que lo ejecuta para realizar acciones privilegiadas
          (instalar paquetes, activar servicios systemd, ejecutar escaneos, etc.). La contraseña se valida y
          se guarda cifrada (AES-256-GCM) en <code class="font-mono text-[11px]">${"${LUXIPANEL_CONFIG_DIR}"}/sudo-credentials.json</code>
          de este servidor — no se persiste en el navegador.
        </p>
        <div id="sudo-prompt-error" class="hidden rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"></div>
        <div class="space-y-1.5">
          <label for="sudo-prompt-input" class="text-sm font-medium">Contraseña</label>
          <input id="sudo-prompt-input" type="password" autocomplete="current-password" required
            class="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
      </div>
      <div class="flex gap-3 border-t border-border px-6 py-4">
        <button type="button" id="sudo-prompt-cancel"
          class="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-accent">
          Cancelar
        </button>
        <button type="submit" id="sudo-prompt-submit"
          class="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          Guardar y continuar
        </button>
      </div>
    </form>
  `;
  document.body.appendChild(dlg);
  return dlg;
}

/**
 * Show the modal and resolve to a password string, or null if the user
 * cancelled.
 *
 * @param {{ message?: string; previousError?: string; validateAndStore?: boolean }} [opts]
 *   When `validateAndStore` is true (default), the modal POSTs the entered
 *   password to `/api/sudo/credential` for validation+persistence before
 *   resolving. On invalid sudo the modal stays open with the error.
 */
export function promptSudoPassword(opts = {}) {
  const validateAndStore = opts.validateAndStore !== false;
  return new Promise((resolve) => {
    const dlg = ensureModal();
    const form = dlg.querySelector("#sudo-prompt-form");
    const input = dlg.querySelector("#sudo-prompt-input");
    const submitBtn = dlg.querySelector("#sudo-prompt-submit");
    const errorEl = dlg.querySelector("#sudo-prompt-error");
    const messageEl = dlg.querySelector("#sudo-prompt-message");
    const closeBtn = dlg.querySelector("#sudo-prompt-close");
    const cancelBtn = dlg.querySelector("#sudo-prompt-cancel");

    if (typeof opts.message === "string" && opts.message.length > 0) {
      messageEl.textContent = opts.message;
    }
    if (opts.previousError) {
      errorEl.textContent = opts.previousError;
      errorEl.classList.remove("hidden");
    } else {
      errorEl.classList.add("hidden");
      errorEl.textContent = "";
    }
    input.value = "";

    const cleanup = () => {
      form.removeEventListener("submit", onSubmit);
      closeBtn.removeEventListener("click", onCancel);
      cancelBtn.removeEventListener("click", onCancel);
      dlg.removeEventListener("close", onClose);
    };
    const onSubmit = async (e) => {
      e.preventDefault();
      const value = input.value;
      if (!value) {
        errorEl.textContent = "La contraseña no puede estar vacía.";
        errorEl.classList.remove("hidden");
        return;
      }
      if (!validateAndStore) {
        cleanup();
        dlg.close();
        input.value = "";
        resolve(value);
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = "Validando…";
      const res = await api.post("/api/sudo/credential", { password: value });
      submitBtn.disabled = false;
      submitBtn.textContent = "Guardar y continuar";
      if (res.ok) {
        cleanup();
        dlg.close();
        cachedPassword = value;
        input.value = "";
        resolve(value);
      } else {
        errorEl.textContent = res.error ?? "Contraseña sudo inválida.";
        errorEl.classList.remove("hidden");
        input.select();
      }
    };
    const onCancel = () => {
      cleanup();
      input.value = "";
      dlg.close();
      resolve(null);
    };
    const onClose = () => {
      cleanup();
      input.value = "";
      resolve(null);
    };

    form.addEventListener("submit", onSubmit);
    closeBtn.addEventListener("click", onCancel);
    cancelBtn.addEventListener("click", onCancel);
    dlg.addEventListener("close", onClose);

    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "open");
    setTimeout(() => input.focus(), 50);
  });
}

/** Reset the in-memory cached password. */
export function clearSudoCache() {
  cachedPassword = null;
}

/**
 * Call once when a module that needs sudo loads. Checks if the server
 * already has a stored credential. If not, opens the modal and validates+
 * stores whatever the user types. Returns true if a credential ends up
 * stored (either previously or now), false if the user skipped.
 */
export async function ensureSudoOnEntry() {
  try {
    const status = await api.get("/api/sudo/status");
    if (status.ok && status.data?.stored) return true;
  } catch {
    // best-effort
  }
  const password = await promptSudoPassword({
    message:
      "Para que el panel pueda gestionar este módulo (instalar paquetes, activar servicios, escanear, etc.) necesita la contraseña sudo del usuario del servidor. Se guarda cifrada y solo se vuelve a pedir si cambia.",
  });
  return Boolean(password);
}

/**
 * Run a privileged backend call. The callback receives an optional
 * `sudoPassword` (the password the user just entered in the modal) and
 * returns an api-client result.
 *
 * Behaviour:
 *  - First attempt: no password (backend will use NOPASSWD or stored credential).
 *  - On `code: SUDO_PASSWORD_REQUIRED` the modal opens. The modal validates
 *    + stores the password via /api/sudo/credential. On success we retry
 *    the original action without the password (the backend now reads it
 *    from storage).
 *  - On `code: SUDO_PASSWORD_INVALID` we re-prompt with an error banner.
 *  - On user cancel we return a synthetic `{ ok: false, error: ... }`.
 */
export async function withSudo(makeRequest) {
  const codeOf = (r) => r?.data?.code ?? r?.code;

  let res = await makeRequest(undefined);
  if (res.ok || codeOf(res) !== "SUDO_PASSWORD_REQUIRED") return res;

  // Try cached password (best-effort: avoids a round-trip to the modal
  // when the user already entered it earlier in this page session).
  if (cachedPassword) {
    res = await makeRequest(cachedPassword);
    if (res.ok) return res;
    if (codeOf(res) === "SUDO_PASSWORD_INVALID") {
      cachedPassword = null;
    } else if (codeOf(res) !== "SUDO_PASSWORD_REQUIRED") {
      return res;
    }
  }

  let previousError;
  for (let attempt = 0; attempt < 3; attempt++) {
    const password = await promptSudoPassword({ previousError });
    if (!password) {
      return { ok: false, error: "Operación cancelada (contraseña sudo requerida)", status: 0 };
    }
    res = await makeRequest(password);
    if (res.ok) {
      cachedPassword = password;
      return res;
    }
    const code = codeOf(res);
    if (code !== "SUDO_PASSWORD_INVALID" && code !== "SUDO_PASSWORD_REQUIRED") {
      return res;
    }
    previousError = code === "SUDO_PASSWORD_INVALID"
      ? "Contraseña sudo inválida."
      : "La contraseña no fue aceptada por sudo.";
    cachedPassword = null;
  }
  return res;
}
