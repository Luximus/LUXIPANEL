// Files page — bind-controls submodule (code-move; no behavior change): file
// operations — rename, mkdir, permissions dialog, directory privacy (.htpasswd),
// compression, upload, refresh, back, copy path.
import { fmt, t } from "./i18n";
import { getBaseName, getParentPath, joinPath, normalizeZipName } from "./paths";
import { applyPermissionsMode, digitsFromPermissionCheckboxes, loadDirectoryPrivacy, refreshPermissionsPreview, renderDirectoryPrivacy, renderPermissionRecommendation } from "./permissions-dialog";
import { S, navHistory } from "./state";
import { updateBackButton } from "./target-scope";
import { setStatus, showToast } from "./toast";
import { api, uploadFile } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openDialog } from "/scripts/extracted/lib/dom.js";

export function bindFsOps() {
    // ── Rename ─────────────────────────────────────────────────
    (window as any).handleRename = (path: string, name: string) => {
      S.renameFrom = path;
      (document.getElementById("rename-value") as HTMLInputElement).value = name;
      openDialog("dialog-rename");
    };

    document.getElementById("rename-close")?.addEventListener("click", () => (document.getElementById("dialog-rename") as HTMLDialogElement).close());
    document.getElementById("rename-cancel")?.addEventListener("click", () => (document.getElementById("dialog-rename") as HTMLDialogElement).close());
    document.getElementById("form-rename")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const newName = (document.getElementById("rename-value") as HTMLInputElement).value;
      const to = S.renameFrom.replace(/[^/]+$/, newName);
      const res = await api.put("/api/files/rename", { from: S.renameFrom, to });
      if (res.ok) {
        const renamedParent = getParentPath(S.renameFrom);
        (document.getElementById("dialog-rename") as HTMLDialogElement).close();
        showToast(t("toasts.renamed", "Renombrado"));
        (window as any).navigate(S.currentPath);
        // Resync the tree folder that held the renamed item (may differ from the
        // current dir when renamed from a tree node in another expanded folder).
        (window as any).__lxpFilesTreeRefresh?.([renamedParent]);
      } else showToast(t("toasts.renameError", "Error al renombrar"), false);
    });

    // ── Mkdir ──────────────────────────────────────────────────
    document.getElementById("btn-mkdir")?.addEventListener("click", () => {
      (document.getElementById("mkdir-name") as HTMLInputElement).value = "";
      openDialog("dialog-mkdir");
    });
    document.getElementById("mkdir-close")?.addEventListener("click", () => (document.getElementById("dialog-mkdir") as HTMLDialogElement).close());
    document.getElementById("mkdir-cancel")?.addEventListener("click", () => (document.getElementById("dialog-mkdir") as HTMLDialogElement).close());
    document.getElementById("form-mkdir")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = (document.getElementById("mkdir-name") as HTMLInputElement).value;
      const res = await api.post("/api/files/mkdir", { path: `${S.currentPath}/${name}` });
      if (res.ok) {
        (document.getElementById("dialog-mkdir") as HTMLDialogElement).close();
        showToast(t("toasts.folderCreated", "Carpeta creada"));
        (window as any).navigate(S.currentPath);
        (window as any).__lxpFilesTreeRefresh?.([S.currentPath]);
      } else showToast(t("toasts.createFolderError", "Error al crear carpeta"), false);
    });

    // ── Permissions ──────────────────────────────────────────
    const permissionsDialog = document.getElementById("dialog-permissions") as HTMLDialogElement | null;
    const permissionsPathInput = document.getElementById("permissions-path") as HTMLInputElement | null;
    const permissionsTarget = document.getElementById("permissions-target");
    const permissionsModeInput = document.getElementById("permissions-octal") as HTMLInputElement | null;

    const permissionCheckboxIds = [
      "perm-u-r",
      "perm-u-w",
      "perm-u-x",
      "perm-g-r",
      "perm-g-w",
      "perm-g-x",
      "perm-o-r",
      "perm-o-w",
      "perm-o-x",
    ];

    permissionCheckboxIds.forEach((id) => {
      document.getElementById(id)?.addEventListener("change", refreshPermissionsPreview);
    });

    const closePermissions = () => permissionsDialog?.close();
    document.getElementById("permissions-close")?.addEventListener("click", closePermissions);
    document.getElementById("permissions-cancel")?.addEventListener("click", closePermissions);

    (window as any).openPermissionsDialog = async (path: string, name: string) => {
      const res = await api.get<any>("/api/files/permissions/recommend", { params: { path } });
      if (!res.ok) {
        showToast(res.error ?? t("toasts.loadPermissionsError", "No se pudieron cargar los permisos"), false);
        return;
      }
      const info = res.data as any;
      const mode = String(info?.mode ?? "644");
      S.permissionTargetPath = path;
      S.permissionTargetName = name || getBaseName(path);
      S.permissionTargetIsDir = Boolean(info?.isDir);
      if (permissionsPathInput) permissionsPathInput.value = path;
      if (permissionsTarget) permissionsTarget.textContent = `${S.permissionTargetName} · ${path}`;
      applyPermissionsMode(mode);
      renderPermissionRecommendation(info);
      if (S.permissionTargetIsDir) {
        void loadDirectoryPrivacy(path);
      } else {
        document.getElementById("dir-privacy-wrap")?.classList.add("hidden");
      }
      permissionsDialog?.showModal();
      permissionsModeInput?.focus();
    };

    // "Corregir": set the checkboxes to the recommended mode (644 file / 755 dir).
    document.getElementById("perm-fix")?.addEventListener("click", () => {
      applyPermissionsMode(S.permissionTargetIsDir ? "755" : "644");
    });
    // Toggle the recursive sub-options when the recursive checkbox flips.
    document.getElementById("perm-recursive")?.addEventListener("change", (e) => {
      const on = (e.target as HTMLInputElement).checked;
      document.getElementById("perm-recursive-opts")?.classList.toggle("hidden", !on);
    });

    document.getElementById("form-permissions")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!S.permissionTargetPath) return;
      const mode = digitsFromPermissionCheckboxes();
      const recursive = S.permissionTargetIsDir && (document.getElementById("perm-recursive") as HTMLInputElement | null)?.checked;

      let res;
      if (recursive) {
        const applyTo = (document.querySelector('input[name="perm-apply-to"]:checked') as HTMLInputElement | null)?.value || "all";
        res = await api.put("/api/files/chmod-recursive", {
          path: S.permissionTargetPath,
          fileMode: "644",
          dirMode: "755",
          applyTo,
        });
      } else {
        res = await api.put("/api/files/chmod", { path: S.permissionTargetPath, mode });
      }
      if (!res.ok) {
        showToast(res.error ?? t("toasts.chmodError", "Error al cambiar permisos"), false);
        return;
      }
      const permParent = getParentPath(S.permissionTargetPath);
      permissionsDialog?.close();
      showToast(recursive ? t("toasts.permsAppliedFolder", "Permisos aplicados a la carpeta") : t("toasts.permsUpdated", "Permisos actualizados"));
      (window as any).navigate(S.currentPath, { skipHistory: true });
      (window as any).__lxpFilesTreeRefresh?.([permParent]);
    });

    // ── Directory Privacy (Basic auth vía .htaccess + .htpasswd) ──
    document.getElementById("dir-privacy-save")?.addEventListener("click", async () => {
      if (!S.permissionTargetPath) return;
      const username = ((document.getElementById("dir-privacy-user") as HTMLInputElement | null)?.value ?? "").trim();
      const password = (document.getElementById("dir-privacy-pass") as HTMLInputElement | null)?.value ?? "";
      const realm = ((document.getElementById("dir-privacy-realm") as HTMLInputElement | null)?.value ?? "").trim();
      if (!username || !password) {
        showToast(t("toasts.indicateUserAndPassword", "Indica usuario y contraseña"), false);
        return;
      }
      const res = await api.post<any>("/api/files/privacy/protect", {
        path: S.permissionTargetPath,
        username,
        password,
        realm: realm || undefined,
      });
      if (!res.ok) {
        showToast(res.error ?? t("toasts.privacyProtectError", "No se pudo proteger la carpeta"), false);
        return;
      }
      const userInput = document.getElementById("dir-privacy-user") as HTMLInputElement | null;
      const passInput = document.getElementById("dir-privacy-pass") as HTMLInputElement | null;
      if (userInput) userInput.value = "";
      if (passInput) passInput.value = "";
      showToast(t("toasts.privacyProtected", "Carpeta protegida con contraseña"));
      renderDirectoryPrivacy(res.data);
    });

    document.getElementById("dir-privacy-unprotect")?.addEventListener("click", async () => {
      if (!S.permissionTargetPath) return;
      const res = await api.post<any>("/api/files/privacy/unprotect", { path: S.permissionTargetPath });
      if (!res.ok) {
        showToast(res.error ?? t("toasts.privacyUnprotectError", "No se pudo quitar la protección"), false);
        return;
      }
      showToast(t("toasts.privacyRemoved", "Protección eliminada"));
      renderDirectoryPrivacy(res.data);
    });

    // Copy the protected folder's public URL (delegated — the row is re-rendered).
    document.getElementById("dir-privacy-url-row")?.addEventListener("click", async (e) => {
      if (!(e.target as HTMLElement).closest("#dir-privacy-copy-url")) return;
      const url = (document.getElementById("dir-privacy-url") as HTMLInputElement | null)?.value || "";
      if (!url) return;
      try {
        await navigator.clipboard.writeText(url);
        showToast(t("toasts.urlCopied", "URL copiada"));
      } catch {
        showToast(t("toasts.copyFailed", "No se pudo copiar"), false);
      }
    });

    // Publish the folder under a chosen nginx site (delegated — row re-renders).
    document.getElementById("dir-privacy-publish-row")?.addEventListener("click", async (e) => {
      if (!(e.target as HTMLElement).closest("#dir-privacy-pub-go")) return;
      if (!S.permissionTargetPath) return;
      const sel = document.getElementById("dir-privacy-pub-site") as HTMLSelectElement | null;
      const domain = sel?.value || "";
      const site = sel?.selectedOptions[0]?.getAttribute("data-site") || undefined;
      const urlPath = ((document.getElementById("dir-privacy-pub-path") as HTMLInputElement | null)?.value || "").trim();
      if (!domain) {
        showToast(t("toasts.privacyChooseDomain", "Elige un dominio nginx"), false);
        return;
      }
      const btn = document.getElementById("dir-privacy-pub-go") as HTMLButtonElement | null;
      if (btn) {
        btn.disabled = true;
        btn.textContent = t("toasts.publishing", "Publicando…");
      }
      const res = await api.post<any>("/api/files/privacy/publish", {
        path: S.permissionTargetPath,
        domain,
        site,
        urlPath: urlPath || undefined,
      });
      if (!res.ok) {
        showToast(res.error ?? t("toasts.privacyPublishError", "No se pudo publicar la carpeta"), false);
        await loadDirectoryPrivacy(S.permissionTargetPath);
        return;
      }
      showToast(res.data?.note || t("toasts.privacyPublished", "Carpeta publicada"));
      renderDirectoryPrivacy(res.data);
    });

    // Remove a single user (event delegation on the list).
    document.getElementById("dir-privacy-users")?.addEventListener("click", async (e) => {
      const btn = (e.target as HTMLElement).closest("[data-privacy-remove]");
      if (!btn || !S.permissionTargetPath) return;
      const username = btn.getAttribute("data-privacy-remove");
      if (!username) return;
      const res = await api.post<any>("/api/files/privacy/user/remove", { path: S.permissionTargetPath, username });
      if (!res.ok) {
        showToast(res.error ?? t("toasts.privacyRemoveUserError", "No se pudo eliminar el usuario"), false);
        return;
      }
      renderDirectoryPrivacy(res.data);
    });

    // Enter inside the privacy inputs triggers protect, not the chmod form.
    ["dir-privacy-user", "dir-privacy-pass", "dir-privacy-realm"].forEach((id) => {
      document.getElementById(id)?.addEventListener("keydown", (e) => {
        if ((e as KeyboardEvent).key === "Enter") {
          e.preventDefault();
          (document.getElementById("dir-privacy-save") as HTMLButtonElement | null)?.click();
        }
      });
    });

    // ── Compression ─────────────────────────────────────────
    const compressDialog = document.getElementById("dialog-compress") as HTMLDialogElement | null;
    const compressNameInput = document.getElementById("compress-name") as HTMLInputElement | null;
    const closeCompress = () => compressDialog?.close();
    document.getElementById("compress-close")?.addEventListener("click", closeCompress);
    document.getElementById("compress-cancel")?.addEventListener("click", closeCompress);
    document.getElementById("form-compress")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!S.compressTargetPaths.length) return;
      const rawName = compressNameInput?.value ?? "";
      const archiveName = normalizeZipName(rawName);
      const dest = joinPath(S.currentPath || "/", archiveName);
      const res = await api.post("/api/files/compress", {
        sources: S.compressTargetPaths,
        dest,
        format: "zip",
      });
      if (!res.ok) {
        showToast(res.error ?? t("toasts.compressError", "Error al comprimir"), false);
        return;
      }
      compressDialog?.close();
      showToast(fmt(t("toasts.zipCreated", "Archivo ZIP creado: {name}"), { name: archiveName }));
      (window as any).navigate(S.currentPath || "/", { skipHistory: true });
      // The zip lands in the current dir regardless of the sources' location.
      (window as any).__lxpFilesTreeRefresh?.([S.currentPath || "/"]);
    });

    // ── Upload ─────────────────────────────────────────────────
    document.getElementById("btn-upload")?.addEventListener("click", () => {
      document.getElementById("upload-input")!.click();
    });
    document.getElementById("files-upload-progress-close")?.addEventListener("click", () => document.getElementById("files-upload-progress")?.classList.add("hidden"));

    document.getElementById("upload-input")?.addEventListener("change", async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files?.length) return;
      const progress = document.getElementById("files-upload-progress");
      const count = document.getElementById("files-upload-progress-count");
      const bar = document.getElementById("files-upload-progress-bar") as HTMLElement | null;
      const list = document.getElementById("files-upload-progress-list");
      progress?.classList.remove("hidden");
      if (list) list.replaceChildren();
      if (bar) bar.style.width = "0%";
      const rows = Array.from(files).map((file) => {
        const row = document.createElement("div");
        row.className = "flex items-center justify-between gap-2 rounded-md px-1 py-0.5";
        const name = document.createElement("span");
        name.className = "min-w-0 truncate";
        name.textContent = file.name;
        const state = document.createElement("span");
        state.className = "shrink-0 text-muted-foreground";
        state.textContent = t("upload.pending", "Pendiente");
        row.append(name, state);
        list?.append(row);
        return state;
      });
      setStatus(fmt(t("status.uploading", "Subiendo {n} archivo(s)..."), { n: files.length }));
      let ok = 0;
      for (const [index, file] of Array.from(files).entries()) {
        if (count) count.textContent = `${index + 1}/${files.length} · ${file.name}`;
        rows[index]!.textContent = t("upload.inProgress", "Subiendo…");
        const res = await uploadFile(`/api/files/upload?dest=${encodeURIComponent(S.currentPath)}&filename=${encodeURIComponent(file.name)}`, file);
        if (res.ok) { ok++; rows[index]!.textContent = t("upload.done", "Listo"); rows[index]!.className = "shrink-0 text-emerald-600"; }
        else { rows[index]!.textContent = res.error || t("status.error", "Error"); rows[index]!.title = res.error || ""; rows[index]!.className = "max-w-32 truncate text-destructive"; }
        if (bar) bar.style.width = `${Math.round(((index + 1) / files.length) * 100)}%`;
      }
      if (count) count.textContent = `${ok}/${files.length} ${t("upload.completed", "archivos subidos")}`;
      showToast(ok === files.length ? fmt(t("toasts.uploadedAll", "{n} archivo(s) subido(s)"), { n: ok }) : fmt(t("toasts.uploadedPartial", "{ok}/{total} subido(s)"), { ok, total: files.length }), ok === files.length);
      (e.target as HTMLInputElement).value = "";
      (window as any).navigate(S.currentPath);
      (window as any).__lxpFilesTreeRefresh?.([S.currentPath]);
    });

    // ── Refresh ────────────────────────────────────────────────
    document.getElementById("btn-refresh")?.addEventListener("click", () => {
      if (S.currentPath) (window as any).navigate(S.currentPath, { skipHistory: true });
    });

    // ── Back button ─────────────────────────────────────────────
    document.getElementById("btn-back")?.addEventListener("click", () => {
      const previous = navHistory.pop();
      updateBackButton();
      if (previous) (window as any).navigate(previous, { skipHistory: true });
    });

    // ── Copy current path ──────────────────────────────────────
    document.getElementById("btn-copy-path")?.addEventListener("click", async () => {
      const path = S.currentPath || "/";
      try {
        await navigator.clipboard.writeText(path);
        showToast(fmt(t("toasts.pathCopied", "Ruta copiada: {path}"), { path }));
      } catch {
        showToast(t("toasts.copyPathError", "Error al copiar ruta"), false);
      }
    });
}
