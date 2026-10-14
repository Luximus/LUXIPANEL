// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  activateConsole,
  classifyConsoleCommand,
  closeConsole,
  disposeConsolesTab,
  getConsolesTab,
  loadConsoles,
  minimizeConsoles,
  noteConsoleCommand,
  openConsole,
  renameConsole,
  restoreConsoles,
  saveConsoles,
} from "./console-sessions-store";

// Estado module-level: cada test usa un tabId propio y lo libera al final.
let tab = "";
let n = 0;
beforeEach(() => {
  tab = `tab-test-${++n}`;
  vi.useFakeTimers();
});
afterEach(() => {
  disposeConsolesTab(tab);
  vi.useRealTimers();
});

const session = (id: string) => ({ id, panelId: `p-${id}`, panelName: `Panel ${id}` });

describe("classifyConsoleCommand", () => {
  it("detecta conversaciones CLI, salidas y comandos normales", () => {
    expect(classifyConsoleCommand("codex resume")).toEqual({ kind: "conv", label: "Codex" });
    expect(classifyConsoleCommand("cd /srv && claude")).toEqual({ kind: "conv", label: "Claude" });
    expect(classifyConsoleCommand("/exit")).toEqual({ kind: "exit" });
    expect(classifyConsoleCommand("ls -la")).toEqual({ kind: "cmd" });
  });
});

describe("console-sessions-store (ciclo de vida)", () => {
  it("openConsole añade, monta y activa", () => {
    openConsole(tab, session("a"));
    const st = getConsolesTab(tab);
    expect(st.consoles.map((c) => c.id)).toEqual(["a"]);
    expect(st.activeConsoleId).toBe("a");
    expect(st.mountedIds).toContain("a");
  });

  it("minimize deja la consola viva (montada) pero sin activa", () => {
    openConsole(tab, session("a"));
    minimizeConsoles(tab);
    const st = getConsolesTab(tab);
    expect(st.activeConsoleId).toBeNull();
    expect(st.mountedIds).toContain("a"); // sigue montada: la sesión no muere
  });

  it("activateConsole monta consolas frías y no acepta ids desconocidos", () => {
    openConsole(tab, session("a"));
    minimizeConsoles(tab);
    activateConsole(tab, "a");
    expect(getConsolesTab(tab).activeConsoleId).toBe("a");
    activateConsole(tab, "no-existe");
    expect(getConsolesTab(tab).activeConsoleId).toBe("a");
  });

  it("cerrar la activa salta a la última viva; cerrar la última minimiza", () => {
    openConsole(tab, session("a"));
    openConsole(tab, session("b"));
    openConsole(tab, session("c"));
    closeConsole(tab, "c");
    expect(getConsolesTab(tab).activeConsoleId).toBe("b");
    closeConsole(tab, "a"); // cerrar una NO activa no cambia la activa
    expect(getConsolesTab(tab).activeConsoleId).toBe("b");
    closeConsole(tab, "b");
    const st = getConsolesTab(tab);
    expect(st.consoles).toEqual([]);
    expect(st.activeConsoleId).toBeNull();
  });

  it("auto-rótulo: comandos, conversación CLI (no pisa) y renombrado manual", () => {
    openConsole(tab, session("a"));
    noteConsoleCommand(tab, "a", "htop");
    expect(getConsolesTab(tab).consoles[0].autoLabel).toBe("htop");
    noteConsoleCommand(tab, "a", "claude");
    expect(getConsolesTab(tab).consoles[0].convMode).toBe("Claude");
    // Dentro del TUI: el tecleo no pisa el rótulo de conversación.
    noteConsoleCommand(tab, "a", "hola asistente");
    expect(getConsolesTab(tab).consoles[0].autoLabel).toBe("Claude");
    noteConsoleCommand(tab, "a", "exit");
    expect(getConsolesTab(tab).consoles[0].convMode).toBeUndefined();
    renameConsole(tab, "a", "  Mi consola  ");
    expect(getConsolesTab(tab).consoles[0].label).toBe("Mi consola");
    renameConsole(tab, "a", "   ");
    expect(getConsolesTab(tab).consoles[0].label).toBeUndefined();
  });

  it("restaura FRÍAS desde disco (sin activar ni montar) y luego persiste cambios", async () => {
    await saveConsoles(tab, [{ id: "r1", panelId: "p1", panelName: "P1" }]);
    await restoreConsoles(tab);
    const st = getConsolesTab(tab);
    expect(st.restored).toBe(true);
    expect(st.consoles.map((c) => c.id)).toEqual(["r1"]);
    expect(st.activeConsoleId).toBeNull();
    expect(st.mountedIds).toEqual([]); // fría: no reconecta al relanzar
    // Un cambio posterior se persiste con debounce (1200ms).
    openConsole(tab, session("n1"));
    await vi.advanceTimersByTimeAsync(1300);
    await expect(loadConsoles(tab)).resolves.toHaveLength(2);
  });
});
