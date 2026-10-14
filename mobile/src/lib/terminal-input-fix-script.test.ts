import { afterEach, describe, expect, it } from "vitest";
import { buildTerminalInputFixScript } from "./terminal-input-fix-script";

// El script se inyecta en el WebView del panel; aquí se evalúa en un sandbox con un
// `window` de mentira para verificar su semántica pura (dedup WS + parche onData por
// trampa instancia→prototype) sin navegador.
function runScript(win: Record<string, unknown>): void {
  const fn = new Function("window", buildTerminalInputFixScript());
  fn(win);
}

type Listener = (d: string) => void;
type Disposable = { dispose: () => void };

// Réplica de la forma del Terminal público de xterm 5.5.0: el constructor asigna
// `this._core = ...` (asignación plana → dispara la trampa) y `onData` es un GETTER del
// prototype que devuelve el IEvent del core.
function makeGetterTerminal() {
  class FakeCore {
    listeners: Listener[] = [];
    onData = (listener: Listener): Disposable => {
      this.listeners.push(listener);
      return {
        dispose: () => {
          this.listeners = this.listeners.filter((l) => l !== listener);
        },
      };
    };
    emit(d: string): void {
      for (const l of [...this.listeners]) l(d);
    }
  }
  class FakeTerminal {
    constructor() {
      (this as Record<string, unknown>)._core = new FakeCore();
    }
    get onData(): (listener: Listener) => Disposable {
      return ((this as Record<string, unknown>)._core as FakeCore).onData;
    }
    open(): void {}
    write(): void {}
    core(): FakeCore {
      return (this as Record<string, unknown>)._core as FakeCore;
    }
  }
  return FakeTerminal;
}

// Variante con `onData` como MÉTODO del prototype (la otra forma que contempla el parche).
function makeMethodTerminal() {
  class FakeTerminal {
    listeners: Listener[] = [];
    constructor() {
      (this as Record<string, unknown>)._core = {};
    }
    onData(listener: Listener): Disposable {
      this.listeners.push(listener);
      return {
        dispose: () => {
          this.listeners = this.listeners.filter((l) => l !== listener);
        },
      };
    }
    emit(d: string): void {
      for (const l of [...this.listeners]) l(d);
    }
    open(): void {}
    write(): void {}
  }
  return FakeTerminal;
}

afterEach(() => {
  // Si un test dejó la trampa instalada (no llegó a nacer ningún Terminal), retirarla para
  // no contaminar el Object.prototype del proceso de tests.
  delete (Object.prototype as Record<string, unknown>)._core;
});

describe("buildTerminalInputFixScript", () => {
  it("no referencia ningún dominio externo ni import dinámico (política sin CDN)", () => {
    const src = buildTerminalInputFixScript();
    expect(src).not.toMatch(/https?:\/\//);
    expect(src).not.toContain("import(");
    expect(src).not.toContain("jsdelivr");
  });

  it("es idempotente por documento (__lxpTermInputFix)", () => {
    const win: Record<string, unknown> = {};
    runScript(win);
    expect(win.__lxpTermInputFix).toBe(true);
    runScript(win); // segunda pasada: no debe fallar ni duplicar nada
    delete (Object.prototype as Record<string, unknown>)._core;
  });

  it("(2) dedup WS: descarta el mismo frame input repetido en el mismo tick, deja pasar el resto", async () => {
    class FakeWS {
      sent: string[] = [];
      send(d: string): void {
        this.sent.push(d);
      }
    }
    runScript({ WebSocket: FakeWS });
    const ws = new FakeWS();
    const frame = '{"type":"input","data":"a"}';
    ws.send(frame);
    ws.send(frame); // duplicado síncrono (handlers apilados) → descartado
    ws.send('{"type":"input","data":"b"}'); // frame distinto → pasa
    ws.send('{"type":"resize","cols":80}'); // no-input → nunca se filtra
    expect(ws.sent).toEqual([frame, '{"type":"input","data":"b"}', '{"type":"resize","cols":80}']);
    await Promise.resolve(); // siguiente microtask: la marca por socket se limpia
    ws.send(frame); // tecleo real repetido (otro tick) → pasa
    expect(ws.sent).toHaveLength(4);
  });

  it("(1) getter: captura el Terminal vía la asignación _core, parchea SU prototype y retira la trampa", () => {
    runScript({});
    expect(Object.getOwnPropertyDescriptor(Object.prototype, "_core")).toBeDefined();
    const FakeTerminal = makeGetterTerminal();
    const term = new FakeTerminal();
    // La trampa vio nacer la instancia: prototype real parcheado y trampa retirada.
    expect((FakeTerminal.prototype as unknown as Record<string, unknown>).__lxpOnDataPatched).toBe(true);
    expect(Object.getOwnPropertyDescriptor(Object.prototype, "_core")).toBeUndefined();
    // Semántica: un solo handler por terminal (el nuevo dispone al anterior).
    const calls: string[] = [];
    term.onData((d) => calls.push(`first:${d}`));
    const disp = term.onData((d) => calls.push(`second:${d}`));
    term.core().emit("x");
    expect(calls).toEqual(["second:x"]);
    expect(typeof disp.dispose).toBe("function");
    // Terminales DISTINTOS conservan cada uno su handler (no hay cross-dispose).
    const other = new FakeTerminal();
    other.onData((d) => calls.push(`other:${d}`));
    term.core().emit("y");
    other.core().emit("z");
    expect(calls).toEqual(["second:x", "second:y", "other:z"]);
  });

  it("(1) método: misma semántica cuando onData es un método del prototype", () => {
    runScript({});
    const FakeTerminal = makeMethodTerminal();
    const term = new FakeTerminal();
    expect((FakeTerminal.prototype as unknown as Record<string, unknown>).__lxpOnDataPatched).toBe(true);
    const calls: string[] = [];
    term.onData((d) => calls.push(`a:${d}`));
    term.onData((d) => calls.push(`b:${d}`));
    term.onData((d) => calls.push(`c:${d}`));
    term.emit("k");
    expect(calls).toEqual(["c:k"]);
  });

  it("(1) la trampa replica la asignación normal en objetos ajenos y no los parchea", () => {
    runScript({});
    const obj: Record<string, unknown> = {};
    obj._core = 42;
    expect(obj._core).toBe(42);
    const dd = Object.getOwnPropertyDescriptor(obj, "_core");
    expect(dd && dd.writable && dd.enumerable && dd.configurable).toBe(true);
    obj._core = 43; // reasignación posterior: propiedad propia normal
    expect(obj._core).toBe(43);
    // Ningún Terminal nació aún → la trampa sigue esperando.
    expect(Object.getOwnPropertyDescriptor(Object.prototype, "_core")).toBeDefined();
    // Y cuando por fin nace uno, se parchea igual.
    const FakeTerminal = makeGetterTerminal();
    new FakeTerminal();
    expect((FakeTerminal.prototype as unknown as Record<string, unknown>).__lxpOnDataPatched).toBe(true);
    expect(Object.getOwnPropertyDescriptor(Object.prototype, "_core")).toBeUndefined();
  });
});
