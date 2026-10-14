// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it, vi } from "vitest";
import {
  bindSurface,
  getSurface,
  requestSurfaceMeasure,
  subscribeSurface,
  subscribeSurfaceMeasure,
  surfaceKey,
  unbindSurface,
} from "./surface-registry";

describe("surface-registry", () => {
  it("surfaceKey compone tabId:sessionId", () => {
    expect(surfaceKey("tab-1", "con-abc")).toBe("tab-1:con-abc");
  });

  it("bind publica el rect y unbind vuelve a hidden", () => {
    const key = "t1:s1";
    expect(getSurface(key)).toEqual({ status: "hidden" });
    bindSurface(key, { x: 10, y: 20, width: 300, height: 400 });
    expect(getSurface(key)).toEqual({ status: "bound", rect: { x: 10, y: 20, width: 300, height: 400 } });
    unbindSurface(key);
    expect(getSurface(key)).toEqual({ status: "hidden" });
  });

  it("ignora rects vacíos (sin layout aún / medición inválida)", () => {
    const key = "t1:s2";
    bindSurface(key, { x: 0, y: 0, width: 0, height: 0 });
    expect(getSurface(key).status).toBe("hidden");
  });

  it("notifica por clave y deduplica rects sub-píxel", () => {
    const key = "t1:s3";
    const listener = vi.fn();
    const off = subscribeSurface(key, listener);
    bindSurface(key, { x: 0, y: 0, width: 100, height: 100 });
    expect(listener).toHaveBeenCalledTimes(1);
    // Mismo rect con ruido < 0.5px: no re-emite (evita repintar el host por byte).
    bindSurface(key, { x: 0.2, y: 0.1, width: 100.3, height: 99.8 });
    expect(listener).toHaveBeenCalledTimes(1);
    // Cambio real: sí.
    bindSurface(key, { x: 0, y: 40, width: 100, height: 60 });
    expect(listener).toHaveBeenCalledTimes(2);
    // unbind de algo ya oculto: no emite.
    unbindSurface(key);
    expect(listener).toHaveBeenCalledTimes(3);
    unbindSurface(key);
    expect(listener).toHaveBeenCalledTimes(3);
    off();
    bindSurface(key, { x: 0, y: 0, width: 10, height: 10 });
    expect(listener).toHaveBeenCalledTimes(3);
    unbindSurface(key);
  });

  it("la señal global de re-medición llega a los suscriptores", () => {
    const measure = vi.fn();
    const off = subscribeSurfaceMeasure(measure);
    requestSurfaceMeasure();
    expect(measure).toHaveBeenCalledTimes(1);
    off();
    requestSurfaceMeasure();
    expect(measure).toHaveBeenCalledTimes(1);
  });
});
