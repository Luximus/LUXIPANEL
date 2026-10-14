// @ts-nocheck
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { api, resolvePanelApiPath, scopeHeaders, resolveTargetScope } from "/scripts/extracted/lib/api-client.js";
import { createPageI18n } from "/scripts/extracted/lib/page-i18n.js";
const { loadI18n, t, fmt } = createPageI18n("repository-store-i18n");
const ui = (key, fallback) => t(`runtime.${key}`, fallback);
const pageLocale = () => document.documentElement.lang || undefined;
const STACKS = window.__REPO_STORE_STACKS__ ?? [];
const LEGACY_KEY = "lxp-github-store-installed-v1";
const VALID_NAME = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const QUERY_FRAGMENTS = {
  all: { all: "" },
  web: {
    all:        "topic:web",
    frontend:   "topic:frontend",
    backend:    "topic:backend",
    fullstack:  "topic:fullstack",
    framework:  "topic:framework",
    cms:        "topic:cms",
  },
  mobile: {
    all:           "topic:mobile",
    ios:           "topic:ios",
    android:       "topic:android",
    "react-native":"topic:react-native",
    flutter:       "topic:flutter",
  },
  desktop: {
    all:      "topic:desktop",
    electron: "topic:electron",
    tauri:    "topic:tauri",
    native:   "topic:gtk",
  },
  videogame: {
    all:    "topic:gamedev",
    unity:  "topic:unity",
    unreal: "topic:unreal-engine",
    godot:  "topic:godot",
    engine: "topic:game-engine",
  },
  ai: {
    all:    "topic:ai",
    llm:    "topic:llm",
    ml:     "topic:machine-learning",
    vision: "topic:computer-vision",
    nlp:    "topic:nlp",
  },
  devops: {
    all:        "topic:devops",
    containers: "topic:docker",
    iac:        "topic:terraform",
    "ci-cd":    "topic:ci-cd",
    monitoring: "topic:monitoring",
  },
  security: {
    all:     "topic:security",
    auth:    "topic:authentication",
    crypto:  "topic:cryptography",
    pentest: "topic:pentesting",
    scanner: "topic:vulnerability-scanner",
  },
};


const state = {
  saved: [], clones: [], preferences: { defaultTab: "all", sort: "relevance", pageSize: 36, showArchived: false, cloneParent: "/var/www", transport: "https" },
  repos: [], total: 0, page: 1, tab: "all", stack: "all", category: "all", canGit: false,
};
let controller = null;
let searchController = null;
let searchTimer = null;
let currentClone = "";
let requestNumber = 0;
let loading = false;
const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const urlFor = (name) => `/panel/repository-store/${name.split("/").map(encodeURIComponent).join("/")}`;
function banner(message, bad = false) {
  const el = $("repo-banner");
  if (!el) return;
  el.textContent = message;
  el.classList.remove("hidden");
  el.classList.toggle("text-destructive", bad);
}
function clearBanner() { $("repo-banner")?.classList.add("hidden"); }
function queryFor(text) {
  if (VALID_NAME.test(text)) return `repo:${text}`;
  if (/^@[A-Za-z0-9_-]+$/.test(text)) return `user:${text.slice(1)}`;
  const topics = QUERY_FRAGMENTS[state.stack] ?? {};
  const topic = topics[state.category] || topics.all || "";
  const stars = text ? "" : (topic ? "stars:>40" : "stars:>500");
  return [text, topic, stars, state.preferences.showArchived ? "" : "archived:false"].filter(Boolean).join(" ");
}
function cloneFor(name) { return state.clones.filter((clone) => clone.fullName.toLowerCase() === name.toLowerCase()); }
function saved(name) { return state.saved.some((entry) => entry.toLowerCase() === name.toLowerCase()); }
function hasUpdate(clone) { return Boolean(clone?.checkedAt && !clone.statusError && clone.behind > 0 && clone.ahead === 0 && !clone.dirty); }
function setBusy(busy) {
  loading = busy;
  $("repo-loading")?.classList.toggle("hidden", !busy);
  $("repo-loading")?.classList.toggle("grid", busy);
  if (busy) $("repo-empty")?.classList.add("hidden");
}
async function requestSearch() {
  if (state.tab !== "all") { render(); return; }
  const seq = ++requestNumber;
  searchController?.abort();
  searchController = new AbortController();
  const text = $("repo-search")?.value?.trim() || "";
  const sort = $("repo-sort")?.value || "relevance";
  const params = new URLSearchParams({ q: queryFor(text), per_page: String(state.preferences.pageSize), page: String(state.page) });
  if (sort.startsWith("stars")) { params.set("sort", "stars"); params.set("order", sort === "stars_asc" ? "asc" : "desc"); }
  if (sort === "updated_desc") { params.set("sort", "updated"); params.set("order", "desc"); }
  setBusy(true);
  $("repo-grid")?.classList.add("hidden");
  try {
    const response = await fetch(`${resolvePanelApiPath("/api/repository-store/search")}?${params}`, { credentials: "include", headers: scopeHeaders(), signal: searchController.signal });
    const payload = await response.json();
    if (seq !== requestNumber) return;
    if (!response.ok || !payload.ok) throw new Error(payload.error || payload.githubBody?.message || `GitHub ${response.status}`);
    state.repos = (payload.data?.items || []).filter((repo) => VALID_NAME.test(repo.full_name));
    state.total = Math.min(Number(payload.data?.total_count || 0), 1000);
    updateRate(payload.rateLimit);
    clearBanner();
    render();
  } catch (error) {
    if (seq !== requestNumber || error?.name === "AbortError") return;
    state.repos = []; state.total = 0;
    banner(error?.message || ui("catalogLoadError", "No se pudo cargar el catálogo."), true);
    render();
  } finally { if (seq === requestNumber) { setBusy(false); render(); } }
}
function updateRate(rate) {
  const meter = $("repo-rate-meter");
  if (!meter) return;
  meter.textContent = Number.isFinite(rate?.remaining) && Number.isFinite(rate?.limit)
    ? `${fmt(t("labels.busquedasRestantes", "{remaining}/{limit} búsquedas restantes"), { remaining: rate.remaining, limit: rate.limit })}${rate.resetAt ? ` · ${fmt(ui("rateResetAt", "Se restablece a las {time}"), { time: new Date(rate.resetAt).toLocaleTimeString(pageLocale()) })}` : ""}`
    : ui("rateUnavailable", "Límite de búsqueda no disponible");
}
async function loadConfig() {
  const result = await api.get("/api/repository-store/config");
  if (!result.ok) return;
  const configured = !!result.data?.tokenConfigured;
  const invalid = result.data?.tokenValid === false;
  $("repo-token-state").textContent = invalid ? ui("invalidToken", "Token inválido") : configured ? t("labels.tokenConfigured", "Token configurado") : t("rateCard.sinToken", "Sin token");
  $("repo-token-icon").className = `ti ${configured ? "ti-circle-check" : "ti-circle-x"} text-[10px]`;
  $("repo-settings-token").textContent = invalid ? ui("tokenRejected", "El token de catálogo fue rechazado por GitHub") : configured ? ui("catalogTokenConfigured", "Token de catálogo configurado") : ui("noCatalogToken", "Sin token de catálogo");
  updateRate(result.data?.rateLimit);
}
async function loadState() {
  const response = await api.get("/api/repository-store/state");
  if (!response.ok || !response.data) { setBusy(false); banner(response.error || ui("stateLoadError", "No se pudo cargar el estado del catálogo."), true); render(); return; }
  state.saved = response.data.saved || [];
  state.clones = response.data.clones || [];
  state.preferences = { ...state.preferences, ...response.data.preferences };
  if (state.preferences.sort === "name_asc") state.preferences.sort = "relevance";
  const legacyKey = `${LEGACY_KEY}:${resolveTargetScope()}`;
  let legacy = [];
  try { legacy = Object.keys(JSON.parse(localStorage.getItem(legacyKey) || "{}") || {}).filter((name) => VALID_NAME.test(name)).slice(0, 500); } catch { /* ignore */ }
  if (legacy.length) {
    const migrated = await api.post("/api/repository-store/saved", { fullNames: legacy, saved: true });
    if (migrated.ok) { state.saved = migrated.data.saved; localStorage.removeItem(legacyKey); }
  }
  const form = $("repo-settings-form");
  if (form) {
    for (const [key, value] of Object.entries(state.preferences)) {
      const field = form.elements.namedItem(key);
      if (field?.type === "checkbox") field.checked = Boolean(value);
      else if (field) field.value = String(value);
    }
  }
  $("repo-sort").value = state.preferences.sort === "name_asc" ? "relevance" : state.preferences.sort;
  state.tab = state.preferences.defaultTab;
  setBusy(false);
  renderTabs(); render();
  if (state.tab === "all") void requestSearch();
}
async function detectGit() {
  const result = await api.get("/api/files/git/detect");
  state.canGit = Boolean(result.ok && result.data?.git?.installed);
  $("repo-settings-git").textContent = state.canGit
    ? fmt(ui("gitConnectionStatus", "{version} · SSH: {count} llaves · gh: {status}"), { version: result.data.git.version, count: result.data?.sshKeys?.length || 0, status: result.data?.gh?.authenticated ? ui("connected", "conectado") : ui("signedOut", "sin sesión") })
    : ui("gitUnavailable", "Sin permiso Git de Archivos o conexión Git no disponible");
  render();
}
function renderTabs() {
  document.querySelectorAll(".repo-tab-btn").forEach((button) => {
    const active = button.dataset.tab === state.tab;
    button.classList.toggle("border-primary", active);
    button.classList.toggle("text-primary", active);
    button.classList.toggle("border-transparent", !active);
    button.classList.toggle("text-muted-foreground", !active);
  });
  $("repo-catalog-filters")?.classList.toggle("hidden", state.tab !== "all");
}
function renderCategories() {
  const stack = STACKS.find((item) => item.id === state.stack) || STACKS[0];
  const categories = stack?.categories || [];
  if (!categories.some((item) => item.id === state.category)) state.category = "all";
  $("repo-category-pills").innerHTML = categories.map((item) => `<button type="button" data-category="${esc(item.id)}" class="category-filter-btn rounded-full border px-4 py-2 text-xs font-semibold ${state.category === item.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}"><i class="ti ${esc(item.icon)}"></i> ${esc(item.label)}</button>`).join("");
  $("repo-category-select").innerHTML = categories.map((item) => `<option value="${esc(item.id)}">${esc(item.label)}</option>`).join("");
  $("repo-category-select").value = state.category;
  $("repo-stack-select").value = state.stack;
  document.querySelectorAll(".stack-filter-btn").forEach((button) => {
    const active = button.dataset.stack === state.stack;
    button.classList.toggle("bg-primary", active); button.classList.toggle("text-primary-foreground", active);
    button.classList.toggle("bg-card", !active); button.classList.toggle("text-muted-foreground", !active);
  });
}
function stateCard(name, clone = null) {
  const safeName = esc(name);
  const status = clone ? (clone.statusError ? ui("checkFailed", "Comprobación fallida") : hasUpdate(clone) ? t("labels.updateDisponible", "Actualización disponible") : clone.checkedAt ? ui("upToDate", "Sin actualización pendiente") : ui("unchecked", "Sin comprobar")) : ui("saved", "Guardado");
  return `<article class="rounded-2xl border border-border bg-card p-5">
    <a class="font-semibold hover:text-primary" href="${urlFor(name)}">${safeName}</a>
    <p class="mt-1 text-xs text-muted-foreground">${clone ? esc(clone.path) : esc(ui("bookmarkSynced", "Marcador sincronizado en este servidor"))}</p>
    <p class="mt-3 text-xs ${hasUpdate(clone) ? "text-amber-600" : "text-muted-foreground"}">${esc(status)}${clone?.checkedAt ? ` · ${new Date(clone.checkedAt).toLocaleString(pageLocale())}` : ""}</p>
    <div class="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
      ${clone ? `<button data-action="check" data-id="${esc(clone.id)}" class="rounded-lg border border-border px-3 py-1.5 text-xs">${esc(ui("check", "Comprobar"))}</button>${hasUpdate(clone) ? `<button data-action="update" data-id="${esc(clone.id)}" class="rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground">${esc(t("actions.actualizar", "Actualizar"))}</button>` : ""}<button data-action="unlink" data-id="${esc(clone.id)}" class="rounded-lg border border-border px-3 py-1.5 text-xs">${esc(ui("unlink", "Desvincular"))}</button>` : `<button data-action="unsave" data-repo="${safeName}" class="rounded-lg border border-border px-3 py-1.5 text-xs">${esc(t("detailUi.removeSaved", "Quitar guardado"))}</button>`}
    </div>
  </article>`;
}
function catalogCard(repo) {
  const name = repo.full_name;
  const clones = cloneFor(name);
  const count = clones.length;
  const isSaved = saved(name);
  const safeName = esc(name);
  return `<article class="flex flex-col rounded-2xl border border-border bg-card p-5">
    <div class="flex items-start gap-3"><div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-500/10"><i class="ti ti-brand-github text-2xl"></i></div><div class="min-w-0"><a href="${urlFor(name)}" class="font-semibold hover:text-primary">${safeName}</a><p class="text-xs text-muted-foreground">${esc(count ? fmt(ui("serverCopiesCount", "{count} copias en el servidor"), { count }) : isSaved ? ui("saved", "Guardado") : ui("publicRepository", "Repositorio público"))}</p></div></div>
    <p class="mt-3 line-clamp-3 min-h-12 text-sm text-muted-foreground">${esc(repo.description || t("labels.sinDescripcion", "Sin descripción"))}</p>
    <div class="mt-3 flex gap-3 text-xs text-muted-foreground"><span>★ ${Number(repo.stargazers_count || 0).toLocaleString(pageLocale())}</span><span><i class="ti ti-git-fork"></i> ${Number(repo.forks_count || 0).toLocaleString(pageLocale())}</span><span>${esc(repo.language || "")}</span></div>
    <div class="mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
      <button data-action="${isSaved ? "unsave" : "save"}" data-repo="${safeName}" class="rounded-lg border border-border px-3 py-1.5 text-xs">${esc(isSaved ? t("detailUi.removeSaved", "Quitar guardado") : t("detailUi.save", "Guardar"))}</button>
      <button data-action="clone" data-repo="${safeName}" ${state.canGit ? "" : `disabled title="${esc(ui("gitPermissionRequired", "Requiere permiso Git de Archivos"))}"`} class="rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-40">${esc(t("catalogUi.cloneButton", "Clonar"))}</button>
    </div>
  </article>`;
}
function render() {
  if (!$("repo-grid")) return;
  const term = $("repo-search")?.value?.trim().toLowerCase() || "";
  const pageRows = state.tab === "all" ? state.repos
    : state.tab === "saved" ? state.saved.filter((name) => name.toLowerCase().includes(term)).map((name) => stateCard(name))
    : state.clones.filter((clone) => (state.tab !== "update" || hasUpdate(clone)) && clone.fullName.toLowerCase().includes(term)).map((clone) => stateCard(clone.fullName, clone));
  const markup = state.tab === "all" ? pageRows.map(catalogCard) : pageRows;
  $("repo-grid").innerHTML = markup.join("");
  $("repo-grid").classList.toggle("hidden", markup.length === 0);
  $("repo-grid").classList.toggle("grid", markup.length > 0);
  $("repo-empty").classList.toggle("hidden", markup.length > 0 || loading);
  $("repo-empty").classList.toggle("flex", markup.length === 0 && !loading);
  const updateCount = state.clones.filter(hasUpdate).length;
  $("tab-all-count").textContent = String(state.total);
  $("tab-saved-count").textContent = String(state.saved.length);
  $("tab-cloned-count").textContent = String(state.clones.length);
  $("tab-update-count").textContent = String(updateCount);
  $("stat-results").textContent = String(state.tab === "all" ? state.total : markup.length);
  $("stat-cloned").textContent = String(state.clones.length);
  $("stat-updates").textContent = String(updateCount);
  const pages = Math.max(1, Math.ceil(state.total / state.preferences.pageSize));
  $("repo-pagination").classList.toggle("hidden", state.tab !== "all" || pages <= 1);
  $("repo-pagination").classList.toggle("flex", state.tab === "all" && pages > 1);
  $("repo-page-label").textContent = fmt(ui("pagination", "Página {page} de {total}"), { page: state.page, total: pages }) + (state.total === 1000 ? ui("githubLimit", " (límite GitHub)") : "");
  $("repo-prev").disabled = state.page <= 1;
  $("repo-next").disabled = state.page >= pages;
}
async function changeSaved(name, value) {
  const result = await api.post("/api/repository-store/saved", { fullNames: [name], saved: value });
  if (!result.ok) { banner(result.error || ui("saveChangeError", "No se pudo guardar el cambio."), true); return; }
  state.saved = result.data.saved;
  render();
}
function openClone(name) {
  currentClone = name;
  $("repo-clone-name").textContent = name;
  $("repo-clone-dest").value = `${state.preferences.cloneParent.replace(/\/$/, "")}/${name.split("/")[1]}`;
  $("repo-clone-transport").value = state.preferences.transport;
  $("repo-clone-error").classList.add("hidden");
  $("repo-clone-dialog").showModal();
}
async function handleClone(event) {
  event.preventDefault();
  const result = await api.post("/api/repository-store/clones", { fullName: currentClone, dest: $("repo-clone-dest").value.trim(), transport: $("repo-clone-transport").value });
  if (!result.ok) { $("repo-clone-error").textContent = result.error || ui("cloneError", "No se pudo clonar."); $("repo-clone-error").classList.remove("hidden"); return; }
  $("repo-clone-dialog").close();
  state.clones.push(result.data);
  await changeSaved(currentClone, true);
  render();
}
async function cloneAction(action, id) {
  const clone = state.clones.find((item) => item.id === id);
  if (!clone) return;
  if (action === "unlink" && !confirm(fmt(ui("unlinkConfirm", "¿Desvincular {path}? La carpeta y sus archivos quedarán intactos."), { path: clone.path }))) return;
  if (action === "update" && !confirm(fmt(ui("updateConfirm", "¿Actualizar {path} mediante avance rápido de la rama actual?"), { path: clone.path }))) return;
  const url = `/api/repository-store/clones/${encodeURIComponent(id)}`;
  const response = action === "unlink" ? await api.delete(url) : await api.post(`${url}/${action}`, {});
  if (!response.ok) { banner(response.error || ui("gitOperationError", "La operación Git falló."), true); return; }
  if (action === "unlink") state.clones = state.clones.filter((item) => item.id !== id);
  else if (action === "check") state.clones = state.clones.map((item) => item.id === id ? response.data : item);
  else if (action === "update") state.clones = state.clones.map((item) => item.id === id ? response.data.clone : item);
  clearBanner(); render();
}
async function savePreferences(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const patch = { defaultTab: form.elements.namedItem("defaultTab").value, sort: form.elements.namedItem("sort").value, pageSize: Number(form.elements.namedItem("pageSize").value), showArchived: form.elements.namedItem("showArchived").checked, cloneParent: form.elements.namedItem("cloneParent").value.trim(), transport: form.elements.namedItem("transport").value };
  const result = await api.patch("/api/repository-store/preferences", patch);
  $("repo-settings-message").textContent = result.ok ? ui("settingsSaved", "Configuración guardada") : (result.error || ui("saveError", "No se pudo guardar"));
  if (!result.ok) return;
  state.preferences = result.data;
  state.page = 1;
  if (state.tab === "all") void requestSearch();
}
async function linkExisting(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const fullName = form.elements.namedItem("fullName").value.trim();
  const path = form.elements.namedItem("path").value.trim();
  if (!VALID_NAME.test(fullName)) { $("repo-link-message").textContent = ui("ownerRepoFormat", "Usa owner/repo."); return; }
  const result = await api.post("/api/repository-store/clones/link", { fullName, path });
  $("repo-link-message").textContent = result.ok ? ui("cloneLinked", "Copia vinculada") : (result.error || ui("linkError", "No se pudo vincular"));
  if (result.ok) { state.clones.push(result.data); form.reset(); render(); }
}
function scheduleSearch() {
  clearTimeout(searchTimer);
  searchController?.abort();
  ++requestNumber;
  searchTimer = setTimeout(() => { state.page = 1; if (state.tab === "all") void requestSearch(); else render(); }, 350);
}
function init() {
  if (!$("repo-grid")) return;
  if (controller?.root === $("repo-store-root")) return;
  controller?.abort(); searchController?.abort();
  controller = new AbortController(); controller.root = $("repo-store-root");
  const signal = controller.signal;
  loadI18n();
  const drawerView = new URLSearchParams(location.search).get("workspaceView");
  state.saved = []; state.clones = []; state.repos = []; state.total = 0; state.page = 1; state.tab = ["all", "saved", "cloned", "update"].includes(drawerView ?? "") ? drawerView : "all"; state.canGit = false;
  setBusy(true);
  $("repo-search").addEventListener("input", scheduleSearch, { signal });
  $("repo-sort").addEventListener("change", () => { state.page = 1; void requestSearch(); }, { signal });
  $("repo-refresh").addEventListener("click", () => { if (state.tab === "all") void requestSearch(); else render(); void loadConfig(); }, { signal });
  $("repo-prev").addEventListener("click", () => { state.page--; void requestSearch(); }, { signal });
  $("repo-next").addEventListener("click", () => { state.page++; void requestSearch(); }, { signal });
  $("repo-clone-close").addEventListener("click", () => $("repo-clone-dialog").close(), { signal });
  $("repo-clone-form").addEventListener("submit", handleClone, { signal });
  $("repo-settings-form").addEventListener("submit", savePreferences, { signal });
  $("repo-link-form").addEventListener("submit", linkExisting, { signal });
  $("repo-settings-trigger").addEventListener("click", () => { void loadConfig(); void detectGit(); }, { signal });
  document.querySelectorAll(".repo-tab-btn").forEach((button) => button.addEventListener("click", () => { state.tab = button.dataset.tab; renderTabs(); if (state.tab === "all") void requestSearch(); else { searchController?.abort(); ++requestNumber; setBusy(false); render(); } }, { signal }));
  $("repo-stack-pills").addEventListener("click", (event) => { const button = event.target.closest("[data-stack]"); if (!button) return; state.stack = button.dataset.stack; state.category = "all"; state.page = 1; renderCategories(); void requestSearch(); }, { signal });
  $("repo-category-pills").addEventListener("click", (event) => { const button = event.target.closest("[data-category]"); if (!button) return; state.category = button.dataset.category; state.page = 1; renderCategories(); void requestSearch(); }, { signal });
  $("repo-stack-select").addEventListener("change", (event) => { state.stack = event.target.value; state.category = "all"; state.page = 1; renderCategories(); void requestSearch(); }, { signal });
  $("repo-category-select").addEventListener("change", (event) => { state.category = event.target.value; state.page = 1; renderCategories(); void requestSearch(); }, { signal });
  $("repo-grid").addEventListener("click", (event) => { const button = event.target.closest("[data-action]"); if (!button) return; const { action, repo, id } = button.dataset; if (action === "save" || action === "unsave") void changeSaved(repo, action === "save"); else if (action === "clone") openClone(repo); else if (id) void cloneAction(action, id); }, { signal });
  renderCategories(); renderTabs();
  void loadState(); void loadConfig(); void detectGit();
  const cloneQuery = new URLSearchParams(location.search).get("clone");
  if (cloneQuery && VALID_NAME.test(cloneQuery)) { void detectGit().then(() => { if (state.canGit) openClone(cloneQuery); }); }
}
document.addEventListener("astro:page-load", init);
document.addEventListener("astro:after-swap", init);
init();
