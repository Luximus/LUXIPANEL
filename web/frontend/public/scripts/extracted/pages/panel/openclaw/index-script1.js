import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js?v=3";

function showToast(msg, ok = true) {
  const toast = document.getElementById("toast");
  const msgEl = document.getElementById("toast-msg");
  if (!toast || !msgEl) return;
  msgEl.textContent = msg;
  toast.className = `fixed bottom-4 right-4 z-50 max-w-xs rounded-xl border px-4 py-3 shadow-lg text-sm font-medium ${
    ok
      ? "border-emerald-500/30 bg-card text-emerald-500"
      : "border-destructive/30 bg-card text-destructive"
  }`;
  setTimeout(() => toast.classList.add("hidden"), 3000);
}

function setStatus(state, title, desc) {
  const dot = document.getElementById("oc-status-dot");
  const titleEl = document.getElementById("oc-status-title");
  const descEl = document.getElementById("oc-status-desc");
  if (!dot || !titleEl || !descEl) return;
  dot.className = "h-2.5 w-2.5 rounded-full";
  if (state === "ok") dot.classList.add("bg-emerald-500", "animate-pulse");
  else if (state === "error") dot.classList.add("bg-destructive");
  else if (state === "loading") dot.classList.add("bg-amber-500", "animate-pulse");
  else dot.classList.add("bg-muted-foreground/40");
  titleEl.textContent = title;
  descEl.textContent = desc;
}

function showError(msg) {
  const el = document.getElementById("oc-error");
  if (!el) return;
  if (!msg) {
    el.classList.add("hidden");
    el.textContent = "";
    return;
  }
  el.textContent = msg;
  el.classList.remove("hidden");
}

async function refreshConfig() {
  const res = await api.get("/api/openclaw/config");
  if (!res.ok) return;
  const data = res.data ?? {};
  const endpointInput = document.getElementById("oc-endpoint");
  const modelInput = document.getElementById("oc-default-model");
  const keyInput = document.getElementById("oc-api-key");
  if (endpointInput && typeof data.endpoint === "string") endpointInput.value = data.endpoint;
  if (modelInput && typeof data.defaultModel === "string") modelInput.value = data.defaultModel;
  if (keyInput) {
    keyInput.value = "";
    keyInput.placeholder = data.apiKeySet
      ? `Configurada · ${data.apiKeyPreview ?? "***"}`
      : "sk-...";
  }
  if (data.apiKeySet) {
    setStatus("idle", "API key configurada", 'Pulsa "Probar conexión" para verificar.');
  } else {
    setStatus("idle", "Sin configurar", "Añade tu API key para comenzar.");
  }
}

function bindToggleKeyVisibility() {
  const btn = document.getElementById("btn-toggle-key");
  const icon = document.getElementById("btn-toggle-key-icon");
  const input = document.getElementById("oc-api-key");
  if (!btn || !input || !icon) return;
  btn.addEventListener("click", () => {
    if (input.type === "password") {
      input.type = "text";
      icon.className = "ti ti-eye-off";
    } else {
      input.type = "password";
      icon.className = "ti ti-eye";
    }
  });
}

function bindClearKey() {
  const btn = document.getElementById("btn-clear-key");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const ok = await openConfirm(
      "¿Eliminar la API key guardada? Tendrás que volver a introducirla para usar OpenClaw.",
      { title: "Borrar API key", confirmText: "Sí, borrar", variant: "danger" },
    );
    if (!ok) return;
    const res = await api.delete("/api/openclaw/api-key");
    if (res.ok) {
      showToast("API key eliminada");
      btn.remove();
      await refreshConfig();
    } else {
      showToast(res.error ?? "No se pudo eliminar", false);
    }
  });
}

function bindSave() {
  const form = document.getElementById("oc-form");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError(null);
    const endpoint = document.getElementById("oc-endpoint").value.trim();
    const defaultModel = document.getElementById("oc-default-model").value.trim();
    const apiKey = "";
    const payload = { endpoint, defaultModel };
    if (apiKey && apiKey.trim().length > 0) payload.apiKey = apiKey.trim();
    const btn = document.getElementById("btn-save");
    if (btn) btn.disabled = true;
    const res = await api.put("/api/openclaw/config", payload);
    if (btn) btn.disabled = false;
    if (res.ok) {
      showToast("Configuración guardada");
      await refreshConfig();
    } else {
      showError(res.error ?? "No se pudo guardar la configuración");
      showToast("Error al guardar", false);
    }
  });
}

function bindTest() {
  const btn = document.getElementById("btn-test");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    setStatus("loading", "Probando conexión…", "Llamando a OpenClaw con la configuración actual.");
    const res = await api.post("/api/openclaw/test");
    btn.disabled = false;
    if (res.ok && res.data?.connected) {
      setStatus(
        "ok",
        "Conectado a OpenClaw",
        res.data?.message ?? "La API key y el endpoint funcionan correctamente.",
      );
      showToast("Conexión correcta");
    } else {
      setStatus(
        "error",
        "Conexión fallida",
        res.data?.message ?? res.error ?? "Revisa la API key y el endpoint.",
      );
      showToast("No se pudo conectar", false);
    }
  });
}

let initLastAt = 0;
const INIT_COOLDOWN_MS = 4000;
function init() {
  if (!document.getElementById("oc-form")) return;
  if (Date.now() - initLastAt < INIT_COOLDOWN_MS) return;
  initLastAt = Date.now();
  bindToggleKeyVisibility();
  bindClearKey();
  bindSave();
  bindTest();
  refreshConfig();
}

document.addEventListener("astro:page-load", init);
document.addEventListener("astro:after-swap", init);
init();
