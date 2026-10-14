// Files page — context-menu submodule (code-move from index-script1.ts; no behavior change).
import { getPasteTargetPath, pasteFilesClipboard, readFilesClipboard, writeFilesClipboard } from "./clipboard";
import { mediaKind, openMediaModal } from "./editor";
import { openCreateExpoAppDialog, openFolderSnippetsDialog, openProposeAgentsDialog } from "./folder-actions";
import { openFileHistory, openHistoryDialog } from "./history-file-versions";
import { fmt, t } from "./i18n";
import { escapeAttr, getBaseName, isArchiveFile } from "./paths";
import { filesCan } from "./perm-gating";
import { S } from "./state";
import { showToast } from "./toast";
import { openCleanupDialog, openImageDialog, openImageScanDialog, openMalwareDialog, openMetaDialog, openProjectMap, openShareDialog } from "./tools";
import { requestAssistant } from "/scripts/extracted/lib/assistant-request.js?v=1";


  // Setup delete button handlers with event delegation
  document.addEventListener("click", (evt: any) => {
    const btn = (evt.target as HTMLElement).closest("button.delete-btn");
    if (btn) {
      const path = btn.getAttribute("data-path");
      const name = btn.getAttribute("data-name");
      const isDir = btn.getAttribute("data-is-dir") === "true";
      if (path) (window as any).handleDelete(path, name, isDir);
    }
  });

  // ── Context menu (right-click actions) ────────────────────
  export function hideContextMenu() {
    const menu = document.getElementById("files-context-menu");
    if (menu) {
      menu.classList.add("hidden");
      menu.innerHTML = "";
    }
  }

  export function buildContextMenu(path: string, name: string, isDir: boolean, kind: "entry" | "route" = "entry"): string {
    const escName = name.replace(/'/g, "\\'");
    // Map each context-menu action to the file permission it needs. Actions not
    // listed (open/edit/copy-path/scans…) only need browse/read, always shown.
    const ACTION_PERM: Record<string, string> = {
      download: "files.download",
      "copy-item": "files.copy",
      "paste-item": "files.copy",
      compress: "files.compress",
      extract: "files.compress",
      delete: "files.delete",
      rename: "files.rename",
      permissions: "files.chmod",
      share: "files.share",
      meta: "files.tags",
      "copy-path": "files.copypath",
      edit: "files.read",
      "optimize-image": "files.images",
      "scan-images": "files.images",
      "project-map": "files.projects",
      "folder-snippets": "files.projects",
      "create-app": "files.create",
      "malware-scan": "files.security",
      cleanup: "files.security",
      versions: "files.history",
      history: "files.history",
    };
    const canAssistant = (window as any).__lxpCanAssistant !== false;
    const canExpo = (window as any).__lxpCanExpo === true;
    const item = (icon: string, label: string, action: string, danger = false) => {
      // AI-assistant actions hidden when the user lacks the assistant module.
      if (action === "open-agent" && !canAssistant) return "";
      if (action === "propose-agents" && !canAssistant) return "";
      // "Create Expo app" hidden when the Expo module isn't available.
      if (action === "create-app" && !canExpo) return "";
      const need = ACTION_PERM[action];
      if (need && !filesCan(need)) return "";
      return `
      <button data-action="${action}"
        class="ctx-item flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${danger ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-accent"} transition-colors">
        <i class="ti ${icon} text-sm"></i>
        <span>${label}</span>
      </button>`;
    };
    const sep = `<div class="my-1 border-t border-border"></div>`;
    const archiveFile = kind === "entry" && !isDir && isArchiveFile(name);
    const clipboard = readFilesClipboard();
    const canPaste = Boolean(clipboard);

    const items: string[] = [];

    // #25 client mode: minimal, low-risk menu (browse/download only).
    if (S.filesClientMode && kind === "entry") {
      if (isDir) {
        items.push(item("ti-folder-open", t("menu.open", "Abrir"), "open"));
        items.push(item("ti-file-zip", t("menu.downloadZip", "Descargar como ZIP"), "download"));
      } else {
        items.push(item("ti-eye", t("menu.view", "Ver"), "edit"));
        items.push(item("ti-download", t("actions.download", "Descargar"), "download"));
      }
      items.push(item("ti-copy", t("menu.copyPath", "Copiar ruta"), "copy-path"));
      return `<div data-menu-kind="entry" data-path="${escapeAttr(path)}" data-name="${escName}" data-is-dir="${isDir}">${items.join("")}</div>`;
    }

    if (kind === "route") {
      if (canPaste) items.push(item("ti-clipboard", t("menu.pasteHere", "Pegar aquí"), "paste-item"));
      items.push(item("ti-copy", t("menu.copyCurrentPath", "Copiar ruta actual"), "copy-path"));
      return `<div data-menu-kind="route" data-path="${escapeAttr(path)}">${items.join("")}</div>`;
    }

    if (isDir) {
      items.push(item("ti-folder-open", t("menu.open", "Abrir"), "open"));
      items.push(item("ti-sitemap", t("menu.projectMap", "Mapa del proyecto"), "project-map"));
      items.push(item("ti-terminal-2", t("menu.folderSnippets", "Generar snippets de terminal"), "folder-snippets"));
      items.push(item("ti-device-mobile-plus", t("menu.createExpoApp", "Crear app Expo aquí"), "create-app"));
      items.push(item("ti-users-group", t("menu.proposeAgents", "Proponer agentes IA para gestionar"), "propose-agents"));
      items.push(item("ti-shield-check", t("menu.analyzeSecurity", "Analizar seguridad"), "malware-scan"));
      items.push(item("ti-sparkles", t("menu.smartCleanup", "Limpieza inteligente"), "cleanup"));
      items.push(item("ti-photo-search", t("menu.heavyImages", "Imágenes pesadas"), "scan-images"));
      if (canPaste) items.push(item("ti-clipboard", t("menu.pasteHere", "Pegar aquí"), "paste-item"));
      items.push(item("ti-copy", t("actions.copyLink", "Copiar"), "copy-item"));
      items.push(item("ti-file-zip", t("menu.downloadZip", "Descargar como ZIP"), "download"));
      items.push(item("ti-lock", t("menu.permissions", "Permisos"), "permissions"));
      items.push(item("ti-archive", t("menu.compressZip", "Comprimir ZIP"), "compress"));
    } else {
      // "Editar" only when the user can write; otherwise it's read-only "Ver".
      if (filesCan("files.write")) items.push(item("ti-pencil", t("menu.edit", "Editar"), "edit"));
      else items.push(item("ti-eye", t("menu.view", "Ver"), "edit"));
      if (/\.(jpe?g|png|gif|webp|bmp|tiff?)$/i.test(name)) items.push(item("ti-photo-edit", t("menu.optimizeImage", "Optimizar imagen"), "optimize-image"));
      items.push(item("ti-versions", t("menu.versions", "Versiones (Git + snapshots)"), "versions"));
      items.push(item("ti-copy", t("actions.copyLink", "Copiar"), "copy-item"));
      if (canPaste) items.push(item("ti-clipboard", t("menu.pasteHere", "Pegar aquí"), "paste-item"));
      items.push(item("ti-download", t("actions.download", "Descargar"), "download"));
      items.push(item("ti-link", t("menu.shareLink", "Compartir enlace"), "share"));
      if (archiveFile) items.push(item("ti-package", t("menu.extractHere", "Extraer aquí"), "extract"));
      items.push(item("ti-lock", t("menu.permissions", "Permisos"), "permissions"));
      items.push(item("ti-archive", t("menu.compressZip", "Comprimir ZIP"), "compress"));
    }
    items.push(sep);
    items.push(item("ti-tags", t("menu.tagsAndNote", "Etiquetas y nota"), "meta"));
    items.push(item("ti-robot", t("menu.openWithAssistant", "Abrir con Asistente IA"), "open-agent"));
    items.push(item("ti-history", t("menu.changeHistory", "Historial de cambios"), "history"));
    items.push(item("ti-cursor-text", t("menu.rename", "Renombrar"), "rename"));
    items.push(item("ti-copy", t("menu.copyPath", "Copiar ruta"), "copy-path"));
    items.push(sep);
    items.push(item("ti-trash", t("actions.delete", "Eliminar"), "delete", true));
    return `<div data-menu-kind="entry" data-path="${escapeAttr(path)}" data-name="${escName}" data-is-dir="${isDir}">${items.join("")}</div>`;
  }

  (window as any).showFileContextMenu = (e: MouseEvent, path: string, name: string, isDir: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    const menu = document.getElementById("files-context-menu");
    if (!menu) return;
    menu.innerHTML = buildContextMenu(path, name, isDir, "entry");
    menu.classList.remove("hidden");

    const margin = 6;
    const { innerWidth, innerHeight } = window;
    const rect = menu.getBoundingClientRect();
    let x = e.clientX;
    let y = e.clientY;
    if (x + rect.width + margin > innerWidth) x = innerWidth - rect.width - margin;
    if (y + rect.height + margin > innerHeight) y = innerHeight - rect.height - margin;
    menu.style.left = `${Math.max(margin, x)}px`;
    menu.style.top = `${Math.max(margin, y)}px`;
  };

  (window as any).showRouteContextMenu = (e: MouseEvent, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    const menu = document.getElementById("files-context-menu");
    if (!menu) return;
    menu.innerHTML = buildContextMenu(path, getBaseName(path) || t("labels.route", "Ruta"), true, "route");
    menu.classList.remove("hidden");

    const margin = 6;
    const { innerWidth, innerHeight } = window;
    const rect = menu.getBoundingClientRect();
    let x = e.clientX;
    let y = e.clientY;
    if (x + rect.width + margin > innerWidth) x = innerWidth - rect.width - margin;
    if (y + rect.height + margin > innerHeight) y = innerHeight - rect.height - margin;
    menu.style.left = `${Math.max(margin, x)}px`;
    menu.style.top = `${Math.max(margin, y)}px`;
  };

  document.addEventListener("click", async (evt: any) => {
    const menu = document.getElementById("files-context-menu");
    if (!menu) return;
    const item = (evt.target as HTMLElement).closest(".ctx-item") as HTMLElement | null;
    if (!item) {
      if (!menu.contains(evt.target as Node)) hideContextMenu();
      return;
    }
    const wrap = item.parentElement!;
    const path = wrap.getAttribute("data-path") ?? "";
    const name = wrap.getAttribute("data-name") ?? "";
    const isDir = wrap.getAttribute("data-is-dir") === "true";
    const menuKind = wrap.getAttribute("data-menu-kind") ?? "entry";
    const action = item.getAttribute("data-action");
    hideContextMenu();
    if (!path) return;

    switch (action) {
      case "open":
        (window as any).navigate(path);
        break;
      case "edit": {
        const mk = mediaKind(name);
        if (mk) openMediaModal(path, name, mk);
        else (window as any).handleEdit(path, name);
        break;
      }
      case "download":
        await (window as any).downloadEntry(path, name, isDir);
        break;
      case "extract":
        await (window as any).extractArchive(path, name);
        break;
      case "permissions":
        await (window as any).openPermissionsDialog(path, name);
        break;
      case "compress":
        (window as any).openCompressDialog([path], name);
        break;
      case "copy-item":
        writeFilesClipboard({ path, name, isDir, copiedAt: Date.now() });
        showToast(fmt(t("toasts.itemCopied", "{kind} copiado: {name}"), { kind: isDir ? t("labels.folderCap", "Carpeta") : t("labels.fileCap", "Archivo"), name }));
        break;
      case "paste-item":
        await pasteFilesClipboard(menuKind === "route" ? path : getPasteTargetPath(path, isDir));
        break;
      case "history":
        openHistoryDialog(path);
        break;
      case "meta":
        void openMetaDialog(path);
        break;
      case "share":
        void openShareDialog(path);
        break;
      case "open-agent": {
        const kindLabel = isDir ? t("labels.theFolder", "la carpeta") : t("labels.theFile", "el archivo");
        const tasks = isDir
          ? t("seeds.agentTasksDir", "revisar la estructura del proyecto, encontrar bugs, detectar claves/tokens quemados, traducir textos a i18n, refactorizar, crear un README o preparar el despliegue")
          : t("seeds.agentTasksFile", "revisarlo, encontrar bugs, detectar claves quemadas o refactorizarlo");
        const prompt = fmt(t("seeds.openAgentPrompt", "Trabaja sobre {kind} del servidor: `{path}`.\n\nPrimero detecta el tipo de proyecto y resume su estructura (herramientas files.project_info / files.list_dir / files.grep / files.security_scan). Luego dime en qué puedo pedirte ayuda: {tasks}."), { kind: kindLabel, path, tasks });
        requestAssistant({
          kind: "prompt",
          prompt,
          submit: "auto",
          conversation: "new",
          origin: { module: "files", action: "openWithAssistant" },
        });
        break;
      }
      case "project-map":
        void openProjectMap(path);
        break;
      case "folder-snippets":
        void openFolderSnippetsDialog(path);
        break;
      case "create-app":
        void openCreateExpoAppDialog(path);
        break;
      case "propose-agents":
        void openProposeAgentsDialog(path);
        break;
      case "malware-scan":
        void openMalwareDialog(path);
        break;
      case "cleanup":
        void openCleanupDialog(path);
        break;
      case "optimize-image":
        void openImageDialog(path);
        break;
      case "scan-images":
        void openImageScanDialog(path);
        break;
      case "versions":
        void openFileHistory(path);
        break;
      case "rename":
        (window as any).handleRename(path, name);
        break;
      case "copy-path":
        try {
          await navigator.clipboard.writeText(path);
          showToast(fmt(t("toasts.pathCopied", "Ruta copiada: {path}"), { path }));
        } catch {
          showToast(t("toasts.copyError", "Error al copiar"), false);
        }
        break;
      case "delete":
        (window as any).handleDelete(path, name, isDir);
        break;
    }
  });

  document.addEventListener("scroll", hideContextMenu, true);
  window.addEventListener("resize", hideContextMenu);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") hideContextMenu(); });
