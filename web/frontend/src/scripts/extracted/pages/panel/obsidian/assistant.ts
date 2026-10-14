// Obsidian page — AI assistant integration (prepare context / sync containers /
// analyze note).
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js";
import { requestAssistant } from "/scripts/extracted/lib/assistant-request.js?v=1";
import { state, currentVault, vaultApi } from "./state";
import type { AssistantContextResult, ContainersSyncResult } from "./state";
import { t, fmt, showToast, $ } from "./dom";
import { loadVaults } from "./vaults";

// ── Prepare for AI agents (CLAUDE.md / AGENTS.md / GEMINI.md) ────────────────
export async function prepareAssistantContext() {
  if (!state.vaultId) return;
  const btn = $("obs-prepare-ai") as HTMLButtonElement | null;
  if (btn) btn.disabled = true;
  let res = await api.post<AssistantContextResult>(vaultApi("/assistant-context"), {});
  if (res.ok && (res.data?.written?.length ?? 0) === 0 && (res.data?.skipped?.length ?? 0) > 0) {
    const skipped = res.data!.skipped.join(", ");
    if (
      await openConfirm(fmt(t("confirm.overwriteContextBody", "Los archivos de contexto ya existen ({skipped}). ¿Sobrescribirlos?"), { skipped }), {
        title: t("confirm.overwriteContextTitle", "Sobrescribir contexto"),
        confirmText: t("confirm.overwriteContextConfirm", "Sobrescribir"),
      })
    ) {
      res = await api.post<AssistantContextResult>(vaultApi("/assistant-context"), { overwrite: true });
    }
  }
  if (btn) btn.disabled = false;
  if (!res.ok) {
    showToast(res.error ?? t("errors.prepareContext", "No se pudo preparar el contexto IA"), false);
    return;
  }
  const written = res.data?.written ?? [];
  const skipped = res.data?.skipped ?? [];
  if (written.length > 0) {
    showToast(fmt(t("toasts.contextWritten", "Contexto IA escrito: {written}"), { written: written.join(", ") }));
  } else {
    showToast(fmt(t("toasts.contextNoChanges", "Sin cambios (ya existían: {skipped})"), { skipped: skipped.join(", ") || "—" }));
  }
  // Sólo tras éxito del POST emitimos la solicitud al Asistente con prompt
  // contextual: incluye los paths recién escritos + la ruta del vault, sin
  // autoSend — el usuario decide si enviar desde el composer.
  const vault = currentVault();
  const prompt = fmt(
    t(
      "actions.prepareAiPrompt",
      "Acabo de preparar el contexto IA para mi vault de Obsidian \"{vaultName}\" (ruta del vault en el servidor: {vaultPath}).\n\nArchivos de contexto escritos: {written}.\nArchivos ya existentes (sin cambios): {skipped}.\n\nEcha un vistazo a esos archivos si quieres entender cómo está organizado el vault y el resto del proyecto, y proponme qué hacer a continuación. No apliques cambios sin mi confirmación.",
    ),
    {
      vaultName: vault?.name ?? "",
      vaultPath: vault?.path ?? "",
      written: written.length ? written.join(", ") : "—",
      skipped: skipped.length ? skipped.join(", ") : "—",
    },
  );
  requestAssistant({
    kind: "prompt",
    prompt,
    submit: "prefill",
    conversation: "new",
    origin: { module: "obsidian", action: "prepareForAi" },
  });
}

// ── Sync context containers (repos / projects / chats → vaults) ──────────────
export async function syncContainers() {
  const btn = $("obs-sync-containers") as HTMLButtonElement | null;
  const icon = btn?.querySelector("i");
  const prevIcon = icon?.className ?? "";
  if (btn) btn.disabled = true;
  if (icon) icon.className = "ti ti-loader-2 animate-spin text-sm";
  // Reuses the shared api.post, which auto-injects the X-CSRF-Token header for
  // mutating requests (same mechanism as createVault / saveNote) — required or
  // the CSRF-protected endpoint 403s.
  const res = await api.post<ContainersSyncResult>("/api/obsidian/containers/sync", {});
  if (btn) btn.disabled = false;
  if (icon) icon.className = prevIcon || "ti ti-folders text-sm";
  if (!res.ok) {
    showToast(res.error ?? t("errors.syncContainers", "No se pudieron sincronizar los contenedores"), false);
    return;
  }
  const d = res.data;
  if (d) {
    showToast(fmt(t("toasts.containersSynced", "Creados {created} · existentes {existing} · repos {repos} · proyectos {projects} · chats {chats}"), { created: d.created, existing: d.existing, repos: d.repos, projects: d.projects, chats: d.chats }));
  } else {
    showToast(t("toasts.containersBasic", "Contenedores sincronizados"));
  }
  // Refresh the vault list so the newly created containers appear.
  await loadVaults();
}

// ── Assistant integration ────────────────────────────────────────────────────
export function analyzeWithAi() {
  const vault = currentVault();
  if (!vault || !state.notePath) return;
  const prompt = fmt(
    t("actions.analyzeAiPrompt", "Estoy trabajando en mi vault de Obsidian \"{vaultName}\" (ruta del vault en el servidor: {vaultPath}) desde el módulo Obsidian de LUXIPANEL, y quiero trabajar la nota \"{notePath}\".\n\nUsa tus herramientas obsidian.* (leer/buscar/crear/enlazar notas del vault) para:\n1. Leer la nota y resumir sus puntos clave.\n2. Revisar sus enlaces [[wikilink]] salientes y sus backlinks.\n3. Proponer mejoras de contenido, estructura y nuevos enlaces hacia otras notas relacionadas del vault.\n\nPregúntame antes de aplicar cualquier cambio sobre las notas."),
    { vaultName: vault.name, vaultPath: vault.path, notePath: state.notePath ?? "" },
  );
  requestAssistant({
    kind: "prompt",
    prompt,
    submit: "prefill",
    conversation: "new",
    origin: { module: "obsidian", action: "analyze" },
  });
}
