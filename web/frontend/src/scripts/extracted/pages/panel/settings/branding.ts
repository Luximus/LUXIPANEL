// Settings page — branding logo controls: URL input + preview, upload, image picker,
// restore-to-default. picker/upload target ids are module-local.
import { api, uploadFile, resolvePanelApiPath, resolveTargetScope, scopeHeaders } from "/scripts/extracted/lib/api-client.js?v=20260506a";
import { openConfirm } from "/scripts/extracted/lib/confirm.js?v=3";
import { t, showToast, normalizePanelAssetPath } from "./dom";
import { FIELDS, LAYOUT_DEFAULTS } from "./fields";
import { scheduleAutosave } from "./settings-io";
import { openDialog } from "/scripts/extracted/lib/dom.js";

export const LOGO_FIELDS = [
  { input: "s-layout-logo", preview: "preview-layout-logo" },
];

export interface BrandingImage {
  name: string;
  url: string;
  size: number;
  modifiedAt: string;
  previewUrl?: string;
}

const previewRequests = new WeakMap<HTMLImageElement, object>();
const previewBlobs = new WeakMap<HTMLImageElement, string>();

/** Load authenticated images with this tab's bridge header, including previews
 * opened while another tab's session cookie points at a different server. */
function assignImage(img: HTMLImageElement, url: string, onError?: () => void) {
  const request = {};
  previewRequests.set(img, request);
  const previous = previewBlobs.get(img);
  if (previous) { URL.revokeObjectURL(previous); previewBlobs.delete(img); }
  const scope = resolveTargetScope();
  if (!url.startsWith("/api/")) { img.src = url; return; }
  img.removeAttribute("src");
  void (async () => {
    const response = await fetch(resolvePanelApiPath(url), { credentials: "include", cache: "no-store", headers: scopeHeaders() });
    if (!response.ok) throw new Error("Branding preview unavailable");
    const blob = await response.blob();
    if (previewRequests.get(img) !== request || !img.isConnected || scope !== resolveTargetScope()) return;
    const objectUrl = URL.createObjectURL(blob);
    previewBlobs.set(img, objectUrl);
    img.onload = () => { URL.revokeObjectURL(objectUrl); previewBlobs.delete(img); };
    img.src = objectUrl;
  })().catch(() => { if (previewRequests.get(img) === request && scope === resolveTargetScope()) onError?.(); });
}

export let pickerTargetInputId: string | null = null;
export let uploadTargetInputId: string | null = null;

export function updateLogoPreview(inputId: string) {
  const field = LOGO_FIELDS.find((f) => f.input === inputId);
  if (!field) return;
  const input = document.getElementById(field.input) as HTMLInputElement | null;
  const img = document.getElementById(field.preview) as HTMLImageElement | null;
  if (!input || !img) return;

  const fallback = img.parentElement?.querySelector<HTMLElement>(".logo-preview-fallback");
  const value = input.value.trim();

  if (!value) {
    previewRequests.set(img, {});
    img.removeAttribute("src");
    img.classList.add("hidden");
    fallback?.classList.remove("hidden");
    return;
  }

  img.classList.remove("hidden");
  fallback?.classList.add("hidden");

  // Add cache-buster only on user-driven updates (not initial load) to avoid flicker.
  const stamp = img.dataset.stamped === "1" ? `?t=${Date.now()}` : "";
  const onError = () => {
    img.classList.add("hidden");
    fallback?.classList.remove("hidden");
  };
  img.onerror = onError;
  const scope = resolveTargetScope();
  const name = /^\/branding\/([a-zA-Z0-9_-][a-zA-Z0-9._-]*)$/.exec(value)?.[1];
  assignImage(img, scope !== "local" && name
    ? `/api/admin/branding/asset?${new URLSearchParams({ name, target: scope })}`
    : value + stamp, onError);
}

export function refreshAllLogoPreviews() {
  for (const f of LOGO_FIELDS) updateLogoPreview(f.input);
}

export function setLogoInputValue(inputId: string, value: string) {
  const input = document.getElementById(inputId) as HTMLInputElement | null;
  if (!input) return;
  input.value = value;
  // Force cache-buster so the preview reflects newly uploaded files even when the URL is unchanged.
  const field = LOGO_FIELDS.find((f) => f.input === inputId);
  if (field) {
    const img = document.getElementById(field.preview) as HTMLImageElement | null;
    if (img) img.dataset.stamped = "1";
  }
  updateLogoPreview(inputId);
  scheduleAutosave(true);
}

export async function loadBrandingImagesIntoPicker() {
  const scope = resolveTargetScope();
  const skeleton = document.getElementById("img-picker-skeleton")!;
  const grid = document.getElementById("img-picker-grid")!;
  const empty = document.getElementById("img-picker-empty")!;
  skeleton.classList.remove("hidden");
  grid.classList.add("hidden");
  empty.classList.add("hidden");
  grid.innerHTML = "";

  const res = await api.get<BrandingImage[]>("/api/admin/branding/images");
  if (scope !== resolveTargetScope() || !grid.isConnected) return;
  skeleton.classList.add("hidden");

  const images = res.ok && Array.isArray(res.data) ? res.data : [];
  if (images.length === 0) {
    empty.classList.remove("hidden");
    return;
  }

  grid.classList.remove("hidden");
  grid.innerHTML = images
    .map(
      (img) => `
      <button type="button" data-image-url="${img.url}"
        class="btn-pick-image group relative aspect-square overflow-hidden rounded-lg border-2 border-border bg-card transition-all hover:border-primary focus:outline-none focus:border-primary">
        <img ${img.previewUrl ? "" : `src="${img.url}"`} alt="${img.name}" class="h-full w-full object-contain p-2" loading="lazy" onerror="this.style.opacity='0.2'" />
        <span class="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-2 py-1 text-[10px] font-mono text-white text-left">${img.name}</span>
      </button>`,
    )
    .join("");

  grid.querySelectorAll<HTMLButtonElement>(".btn-pick-image").forEach((btn) => {
    const image = images.find(image => image.url === btn.dataset.imageUrl);
    const preview = btn.querySelector("img");
    if (image?.previewUrl && preview) assignImage(preview, image.previewUrl, () => { preview.style.opacity = "0.2"; });
    btn.addEventListener("click", () => {
      const url = btn.dataset.imageUrl;
      if (url && pickerTargetInputId) {
        setLogoInputValue(pickerTargetInputId, url);
      }
      (document.getElementById("dlg-image-picker") as HTMLDialogElement).close();
    });
  });
}

export async function handleLogoUpload(file: File) {
  if (!uploadTargetInputId) return;

  if (file.size > 5 * 1024 * 1024) {
    showToast(t("toasts.imageExceeds5mb", "La imagen excede 5MB"), false);
    return;
  }

  showToast(t("toasts.uploadingImage", "Subiendo imagen..."));
  const res = await uploadFile("/api/admin/branding/upload", file);
  if (!res.ok) {
    showToast((res.data as any)?.error ?? res.error ?? t("toasts.imageUploadError", "Error al subir imagen"), false);
    return;
  }

  const url =
    (res.data as any)?.data?.url ??
    (res.data as any)?.url ??
    null;
  if (!url) {
    showToast(t("toasts.imageUploadInvalidResponse", "Respuesta inválida del servidor"), false);
    return;
  }

  setLogoInputValue(uploadTargetInputId, url);
  showToast(t("toasts.imageUploaded", "Imagen subida correctamente"));
}

export function bindLogoControls() {
  for (const f of LOGO_FIELDS) {
    const input = document.getElementById(f.input) as HTMLInputElement | null;
    if (input) {
      input.addEventListener("input", () => updateLogoPreview(f.input));
    }
  }

  document.querySelectorAll<HTMLButtonElement>(".btn-logo-upload").forEach((btn) => {
    btn.addEventListener("click", () => {
      uploadTargetInputId = btn.dataset.uploadTarget ?? null;
      const fileInput = document.getElementById("logo-file-input") as HTMLInputElement | null;
      if (!fileInput) return;
      fileInput.value = "";
      fileInput.click();
    });
  });

  document.querySelectorAll<HTMLButtonElement>(".btn-logo-pick").forEach((btn) => {
    btn.addEventListener("click", async () => {
      pickerTargetInputId = btn.dataset.pickTarget ?? null;
      openDialog("dlg-image-picker");
      await loadBrandingImagesIntoPicker();
    });
  });

  document.querySelectorAll<HTMLButtonElement>(".btn-logo-default").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.clearTarget;
      const def = btn.dataset.default ?? "";
      if (!target) return;
      setLogoInputValue(target, def);
    });
  });

  // Restore ONLY the logo to LUXIPANEL's defaults (separate from the global
  // "reset styles" — colors/shadows/theme untouched).
  document.getElementById("btn-restore-logos")?.addEventListener("click", async () => {
    if (!await openConfirm(t("confirm.restoreLogosBody", "¿Restaurar el logo a los valores por defecto de LUXIPANEL?"), { title: t("confirm.restoreLogosTitle", "Restaurar logo"), confirmText: t("confirm.restoreLogosConfirm", "Sí, restaurar"), variant: "danger" })) return;
    const elId = FIELDS.layout_logo;
    const def = LAYOUT_DEFAULTS.layout_logo;
    const el = elId ? (document.getElementById(elId) as HTMLInputElement | null) : null;
    if (el && def !== undefined) el.value = normalizePanelAssetPath(def);
    // Force the logo preview to refresh its <img> even when the URL is unchanged.
    for (const f of LOGO_FIELDS) {
      const img = document.getElementById(f.preview) as HTMLImageElement | null;
      if (img) img.dataset.stamped = "1";
    }
    refreshAllLogoPreviews();
    scheduleAutosave(true);
    showToast(t("toasts.logosRestored", "Logo restaurado a los valores por defecto"));
  });

  document.getElementById("logo-file-input")?.addEventListener("change", (e) => {
    const inp = e.target as HTMLInputElement;
    const file = inp.files?.[0];
    if (file) void handleLogoUpload(file);
  });

  document.getElementById("btn-img-picker-upload")?.addEventListener("click", () => {
    uploadTargetInputId = pickerTargetInputId;
    const fileInput = document.getElementById("logo-file-input") as HTMLInputElement | null;
    if (!fileInput) return;
    fileInput.value = "";
    fileInput.click();
    (document.getElementById("dlg-image-picker") as HTMLDialogElement).close();
  });
}
