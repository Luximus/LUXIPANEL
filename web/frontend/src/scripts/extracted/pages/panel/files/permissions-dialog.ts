// Files page — permissions-dialog submodule (code-move from index-script1.ts; no behavior change).
import { fmt, t } from "./i18n";
import { escapeHtml } from "./paths";
import { S } from "./state";
import { api } from "/scripts/extracted/lib/api-client.js?v=20260506a";


  export function formatPermissionsSymbolic(mode: string): string {
    const clean = mode.replace(/^0/, "").padStart(3, "0").slice(-3);
    const bits = clean.split("").map((digit) => Number.parseInt(digit, 10));
    const groups = bits.map((digit) => `${digit & 4 ? "r" : "-"}${digit & 2 ? "w" : "-"}${digit & 1 ? "x" : "-"}`);
    return groups.join("");
  }

  export function digitsFromPermissionCheckboxes(): string {
    const triples: Array<[string, string, string]> = [
      ["perm-u-r", "perm-u-w", "perm-u-x"],
      ["perm-g-r", "perm-g-w", "perm-g-x"],
      ["perm-o-r", "perm-o-w", "perm-o-x"],
    ];
    return triples.map((ids) => {
      const value =
        ((document.getElementById(ids[0]) as HTMLInputElement | null)?.checked ? 4 : 0) +
        ((document.getElementById(ids[1]) as HTMLInputElement | null)?.checked ? 2 : 0) +
        ((document.getElementById(ids[2]) as HTMLInputElement | null)?.checked ? 1 : 0);
      return String(value);
    }).join("");
  }

  export function applyPermissionsMode(mode: string) {
    const clean = mode.replace(/^0/, "").padStart(3, "0").slice(-3);
    const digits = clean.split("").map((digit) => Number.parseInt(digit, 10));
    const ids = [
      ["perm-u-r", "perm-u-w", "perm-u-x"],
      ["perm-g-r", "perm-g-w", "perm-g-x"],
      ["perm-o-r", "perm-o-w", "perm-o-x"],
    ];
    digits.forEach((digit, index) => {
      const [r, w, x] = ids[index]!;
      const rEl = document.getElementById(r) as HTMLInputElement | null;
      const wEl = document.getElementById(w) as HTMLInputElement | null;
      const xEl = document.getElementById(x) as HTMLInputElement | null;
      if (rEl) rEl.checked = Boolean(digit & 4);
      if (wEl) wEl.checked = Boolean(digit & 2);
      if (xEl) xEl.checked = Boolean(digit & 1);
    });
    const octal = document.getElementById("permissions-octal") as HTMLInputElement | null;
    const symbolic = document.getElementById("permissions-symbolic");
    if (octal) octal.value = clean;
    if (symbolic) symbolic.textContent = formatPermissionsSymbolic(clean);
  }

  /** Render the #5 recommender panel from the backend analysis payload. */
  export function renderPermissionRecommendation(info: any) {
    const headline = document.getElementById("perm-recommend-headline");
    const reasonsEl = document.getElementById("perm-recommend-reasons");
    const wrap = document.getElementById("perm-recommend");
    const level = String(info?.level ?? "ok");
    const recommended = String(info?.recommended ?? (S.permissionTargetIsDir ? "755" : "644"));
    if (wrap) {
      wrap.className = `rounded-xl border px-4 py-3 ${
        level === "danger" ? "border-destructive/40 bg-destructive/5"
        : level === "warning" ? "border-amber-500/40 bg-amber-500/5"
        : "border-emerald-500/30 bg-emerald-500/5"
      }`;
    }
    if (headline) {
      const txt = level === "danger" ? t("permRecommend.danger", "⚠ Permisos peligrosos") : level === "warning" ? t("permRecommend.warning", "Permisos mejorables") : t("permRecommend.ok", "✓ Permisos correctos");
      headline.textContent = fmt(t("permRecommend.headline", "{label} · recomendado {recommended}"), { label: txt, recommended });
      headline.className = `text-sm font-medium ${
        level === "danger" ? "text-destructive" : level === "warning" ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
      }`;
    }
    if (reasonsEl) {
      const reasons: string[] = Array.isArray(info?.reasons) ? info.reasons : [];
      reasonsEl.innerHTML = reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("");
    }
    // Recursive options only make sense on a directory.
    document.getElementById("perm-recursive-wrap")?.classList.toggle("hidden", !S.permissionTargetIsDir);
    const recCb = document.getElementById("perm-recursive") as HTMLInputElement | null;
    if (recCb) recCb.checked = false;
    document.getElementById("perm-recursive-opts")?.classList.add("hidden");
  }

  /** Render the Directory Privacy panel (Basic auth) from a status payload. */
  export function renderDirectoryPrivacy(status: any) {
    const wrap = document.getElementById("dir-privacy-wrap");
    if (!wrap) return;
    wrap.classList.toggle("hidden", !S.permissionTargetIsDir);
    const isProtected = Boolean(status?.protected);
    const users: string[] = Array.isArray(status?.users) ? status.users : [];
    const enf = status?.enforcement ?? { enforced: false };
    const statusEl = document.getElementById("dir-privacy-status");
    if (statusEl) {
      if (!isProtected) {
        statusEl.textContent = t("privacy.statusUnprotected", "Sin protección");
      } else if (enf.enforced) {
        const where = enf.site ? ` (nginx: ${escapeHtml(String(enf.site))} ${escapeHtml(String(enf.url ?? ""))})` : "";
        statusEl.innerHTML = `🔒 <span class="text-emerald-600 dark:text-emerald-400">${escapeHtml(t("privacy.statusActiveNginx", "Activa en nginx"))}</span>${where} · ${fmt(t("privacy.usersCount", "{n} usuario(s)"), { n: users.length })}`;
      } else {
        const why = enf.reason === "no-site"
          ? t("privacy.reasonNoSite", "esta carpeta no pertenece a ningún sitio de nginx, así que no se puede aplicar")
          : enf.reason
            ? escapeHtml(String(enf.reason))
            : t("privacy.reasonNotApplied", "nginx aún no la aplica");
        statusEl.innerHTML = `⚠ <span class="text-amber-600 dark:text-amber-400">${escapeHtml(t("privacy.statusSavedNotActive", "Credenciales guardadas, pero NO activa"))}</span> — ${why} · ${fmt(t("privacy.usersCount", "{n} usuario(s)"), { n: users.length })}`;
      }
    }
    document.getElementById("dir-privacy-unprotect")?.classList.toggle("hidden", !isProtected);
    // Copyable public URL — only when the protection is actually live and a
    // concrete host could be derived from the nginx site (server_name).
    const urlRow = document.getElementById("dir-privacy-url-row");
    if (urlRow) {
      if (isProtected && enf.enforced && enf.publicUrl) {
        urlRow.classList.remove("hidden");
        urlRow.innerHTML =
          `<div class="flex items-center gap-2">` +
          `<input id="dir-privacy-url" type="text" readonly value="${escapeHtml(String(enf.publicUrl))}" class="h-8 flex-1 rounded-lg border border-input bg-card px-2 font-mono text-xs text-foreground focus:outline-none" />` +
          `<button type="button" id="dir-privacy-copy-url" class="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-accent"><i class="ti ti-copy text-sm"></i> ${escapeHtml(t("privacy.btnCopyUrl", "Copiar URL"))}</button>` +
          `</div>`;
      } else {
        urlRow.classList.add("hidden");
        urlRow.innerHTML = "";
      }
    }
    // "Publish via nginx site" — only when protected but not enforceable because
    // the folder isn't under any nginx site (offer to expose it under one).
    const pubRow = document.getElementById("dir-privacy-publish-row");
    if (pubRow) {
      if (isProtected && !enf.enforced && enf.reason === "no-site") {
        const base = (S.permissionTargetPath || "").replace(/\/+$/, "").split("/").pop() || "files";
        pubRow.classList.remove("hidden");
        pubRow.innerHTML =
          `<div class="space-y-2 rounded-lg border border-border bg-card p-2">` +
          `<p class="text-xs text-muted-foreground">${escapeHtml(t("privacy.publishIntro", "Esta carpeta no la sirve ningún sitio de nginx. Elige un dominio nginx para publicarla y obtener una URL con acceso por usuario y contraseña:"))}</p>` +
          `<div class="flex items-center gap-2">` +
          `<select id="dir-privacy-pub-site" class="h-8 flex-1 rounded-lg border border-input bg-card px-2 text-xs text-foreground focus:outline-none"><option value="">${escapeHtml(t("privacy.loadingDomains", "Cargando dominios…"))}</option></select>` +
          `<input id="dir-privacy-pub-path" type="text" value="/${escapeHtml(base)}/" class="h-8 w-28 rounded-lg border border-input bg-card px-2 font-mono text-xs text-foreground focus:outline-none" />` +
          `<button type="button" id="dir-privacy-pub-go" class="shrink-0 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"><i class="ti ti-world-share text-sm"></i> ${escapeHtml(t("privacy.btnPublish", "Publicar"))}</button>` +
          `</div>` +
          `<p class="text-[11px] text-muted-foreground">${escapeHtml(t("privacy.httpsHint", "Se intentará HTTPS automático (Certbot) si el sitio elegido aún no tiene TLS."))}</p>` +
          `</div>`;
        void fillPublishSites();
      } else {
        pubRow.classList.add("hidden");
        pubRow.innerHTML = "";
      }
    }
    const realmInput = document.getElementById("dir-privacy-realm") as HTMLInputElement | null;
    if (realmInput && isProtected && status?.realm && !realmInput.value) realmInput.value = String(status.realm);
    const usersEl = document.getElementById("dir-privacy-users");
    if (usersEl) {
      usersEl.innerHTML = users
        .map(
          (u) =>
            `<li class="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-1.5 text-xs"><span class="truncate font-mono">${escapeHtml(u)}</span><button type="button" data-privacy-remove="${escapeHtml(u)}" class="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive" aria-label="${escapeHtml(t("privacy.removeUserAria", "quitar"))}"><i class="ti ti-trash text-sm"></i></button></li>`,
        )
        .join("");
    }
  }

  /** Load and render the current Directory Privacy state for a directory. */
  export async function loadDirectoryPrivacy(dirPath: string) {
    const userInput = document.getElementById("dir-privacy-user") as HTMLInputElement | null;
    const passInput = document.getElementById("dir-privacy-pass") as HTMLInputElement | null;
    const realmInput = document.getElementById("dir-privacy-realm") as HTMLInputElement | null;
    if (userInput) userInput.value = "";
    if (passInput) passInput.value = "";
    if (realmInput) realmInput.value = "";
    const res = await api.get<any>("/api/files/privacy", { params: { path: dirPath } });
    renderDirectoryPrivacy(res.ok ? res.data : { protected: false, users: [] });
  }

  /** Populate the "Publish via nginx site" <select> with the nginx domains. */
  export async function fillPublishSites() {
    const sel = document.getElementById("dir-privacy-pub-site") as HTMLSelectElement | null;
    if (!sel) return;
    const res = await api.get<any[]>("/api/files/privacy/sites");
    const domains = res.ok && Array.isArray(res.data) ? res.data : [];
    if (!domains.length) {
      sel.innerHTML = `<option value="">${escapeHtml(t("privacy.noDomainsAvailable", "No hay dominios nginx disponibles"))}</option>`;
      return;
    }
    sel.innerHTML = domains
      .map((d) => `<option value="${escapeHtml(String(d.domain))}" data-site="${escapeHtml(String(d.site))}">${escapeHtml(String(d.domain))}${d.ssl ? " 🔒" : ""}</option>`)
      .join("");
  }

  export function refreshPermissionsPreview() {
    const clean = digitsFromPermissionCheckboxes();
    const octal = document.getElementById("permissions-octal") as HTMLInputElement | null;
    const symbolic = document.getElementById("permissions-symbolic");
    if (octal) octal.value = clean;
    if (symbolic) symbolic.textContent = formatPermissionsSymbolic(clean);
  }
