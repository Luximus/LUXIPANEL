import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { showDownloadProgress } from "./download-progress";

const options = () => ({
  name: "app-debug.apk", downloading: "Descargando app-debug.apk…", retrying: "Reintentando la descarga…",
  cancelled: "Descarga cancelada", cancelLabel: "Cancelar", closeLabel: "Cerrar", onCancel: vi.fn(),
});
beforeEach(() => { document.body.innerHTML = '<main id="files-browser"><header>Archivos</header><div id="bulk-bar"></div></main>'; });
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

describe("download progress", () => {
  it("shows the file, received bytes and an accessible percentage above the list", () => {
    const progress = showDownloadProgress(options());
    progress.update({ received: 50 * 1024 * 1024, total: 100 * 1024 * 1024 });
    const panel = document.getElementById("files-download-progress")!;
    expect(panel.nextElementSibling?.id).toBe("bulk-bar");
    expect(panel.textContent).toContain("app-debug.apk");
    expect(panel.querySelector("[data-bytes]")?.textContent).toBe("50.0 MB / 100.0 MB");
    expect(panel.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("50");
    expect(panel.querySelector<HTMLElement>(".lxp-file-download-fill")?.style.width).toBe("50%");
  });
  it("does not invent a percentage when the server does not provide a total", () => {
    const progress = showDownloadProgress(options());
    progress.update({ received: 2048, total: null });
    const panel = document.getElementById("files-download-progress")!;
    expect(panel.dataset.indeterminate).toBe("true");
    expect(panel.querySelector('[role="progressbar"]')?.hasAttribute("aria-valuenow")).toBe(false);
    expect(panel.querySelector("[data-bytes]")?.textContent).toBe("2.0 KB");
  });
  it("cancels the underlying transfer and then lets the user dismiss the status", () => {
    const config = options();
    showDownloadProgress(config);
    const panel = document.getElementById("files-download-progress")!;
    const button = panel.querySelector("button")!;
    button.click();
    expect(config.onCancel).toHaveBeenCalledOnce();
    expect(panel.dataset.phase).toBe("cancelled");
    expect(panel.textContent).toContain("Descarga cancelada");
    expect(button.textContent).toBe("Cerrar");
    button.click();
    expect(panel.isConnected).toBe(false);
    expect(config.onCancel).toHaveBeenCalledOnce();
  });
  it("keeps an error visible with the last received percentage", () => {
    const progress = showDownloadProgress(options());
    progress.update({ received: 3, total: 10 });
    progress.retry();
    expect(document.querySelector(".lxp-file-download-state")?.textContent).toContain("Reintentando");
    progress.finish("Error de red", false);
    expect(document.getElementById("files-download-progress")?.dataset.phase).toBe("error");
    expect(document.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("30");
    progress.update({ received: 9, total: 10 });
    expect(document.querySelector(".lxp-file-download-state")?.textContent).toBe("Error de red");
  });
  it("finishes at 100% without hiding the result or retaining Cancel", () => {
    const progress = showDownloadProgress(options());
    progress.update({ received: 100, total: 100 });
    progress.finish("app-debug.apk descargado", true);
    const panel = document.getElementById("files-download-progress")!;
    expect(panel.getAttribute("aria-busy")).toBe("false");
    expect(panel.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe("100");
    expect(panel.querySelector("button")?.textContent).toBe("Cerrar");
    expect(panel.isConnected).toBe(true);
  });
  it("treats file names as text and replaces the previous transfer panel", () => {
    showDownloadProgress(options());
    showDownloadProgress({ ...options(), name: '<img src=x onerror="alert(1)">.apk' });
    expect(document.querySelectorAll("#files-download-progress")).toHaveLength(1);
    expect(document.querySelector("#files-download-progress img")).toBeNull();
    expect(document.querySelector(".lxp-file-download-name")?.textContent).toContain("<img");
  });
});
