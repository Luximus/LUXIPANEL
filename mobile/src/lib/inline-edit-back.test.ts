import { describe, expect, it, vi } from "vitest";
import { cancelActiveInlineEdit, registerInlineEditCancel, unregisterInlineEditCancel } from "./inline-edit-back";

describe("inline-edit-back", () => {
  it("sin edición registrada, no consume el atrás", () => {
    expect(cancelActiveInlineEdit()).toBe(false);
  });

  it("con edición registrada, atrás la cancela y consume el evento UNA vez", () => {
    const cancel = vi.fn();
    registerInlineEditCancel(cancel);
    expect(cancelActiveInlineEdit()).toBe(true);
    expect(cancel).toHaveBeenCalledTimes(1);
    // El siguiente atrás ya no está consumido (cierra el contenedor).
    expect(cancelActiveInlineEdit()).toBe(false);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("al salir de edición (unregister), atrás vuelve a no consumirse", () => {
    const cancel = vi.fn();
    registerInlineEditCancel(cancel);
    unregisterInlineEditCancel(cancel);
    expect(cancelActiveInlineEdit()).toBe(false);
    expect(cancel).not.toHaveBeenCalled();
  });

  it("unregister de un cancel viejo no pisa al registrado después", () => {
    const oldCancel = vi.fn();
    const newCancel = vi.fn();
    registerInlineEditCancel(oldCancel);
    registerInlineEditCancel(newCancel);
    unregisterInlineEditCancel(oldCancel);
    expect(cancelActiveInlineEdit()).toBe(true);
    expect(newCancel).toHaveBeenCalledTimes(1);
    expect(oldCancel).not.toHaveBeenCalled();
  });
});
