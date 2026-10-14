import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const api = vi.hoisted(() => ({
  installed: vi.fn().mockResolvedValue({ ok: true, data: { ok: true, data: [{ id: "module-dev", enabled: true, showInSidebar: true }] } }),
  snapshot: vi.fn().mockResolvedValue({ ok: true, data: { ok: true, data: {} } }),
}));
vi.mock("../api/serverApi", () => ({
  ensureTarget: () => ({}),
  unregisterDirectServer: vi.fn(),
  serverModulesViewApi: { installed: api.installed },
  serverMonitorApi: { snapshot: api.snapshot },
  unwrap: (result: { data?: { data?: unknown } }) => result.data?.data ?? null,
}));
vi.mock("../lib/standalone-connect", () => ({ registerStandaloneTarget: vi.fn().mockResolvedValue(true) }));
vi.mock("./server/module-host", () => ({
  MODULE_COMPONENTS: {
    assistant: () => <div>Asistente local</div>,
    terminal: () => <div>Terminal local</div>,
    "module-dev": () => <div>Contenido Mis módulos<input aria-label="Borrador" defaultValue=""/></div>,
    "project-map": () => <div>Contenido Mapa proyecto</div>,
  },
  NativePendingPanel: () => <div>pendiente</div>,
}));

import { StandaloneServerScreen } from "./StandaloneServerScreen";

describe("navegación nativa Dev", () => {
  it("abre Mis módulos y Mapa proyecto en drawables distintos", async () => {
    render(<StandaloneServerScreen
      server={{ id: "managed:tab:panel", name: "Servidor", baseUrl: "https://box.example", username: "", savePassword: false }}
      session={{ jwt: "jwt", csrf: null, exp: 0 }} theme="dark" language="es" onBack={() => {}}
    />);
    await waitFor(() => expect(api.installed).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole("button", { name: /Mis módulos/i }));
    expect(screen.getByRole("dialog", { name: "Mis módulos" })).toHaveTextContent("Contenido Mis módulos");
    expect(screen.queryByText("Contenido Mapa proyecto")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar módulo" }));
    fireEvent.click(screen.getByRole("button", { name: /Mapa proyecto/i }));
    expect(screen.getByRole("dialog", { name: "Mapa proyecto" })).toHaveTextContent("Contenido Mapa proyecto");
    expect(screen.getByText("Contenido Mis módulos")).not.toBeVisible();
  });
});

it("closes without fetching and retains drafts, scroll and mounted module identity",async()=>{
 const server={id:'test-persistence',name:'Servidor',baseUrl:'https://box.example',username:'qa',savePassword:false};
 const view=render(<StandaloneServerScreen server={server} session={{jwt:'jwt',csrf:null,exp:0}} theme="dark" language="es" onBack={()=>{}}/>);
 fireEvent.click(await screen.findByRole('button',{name:/Mis módulos/i}));
 const draft=screen.getByRole('textbox',{name:'Borrador'});fireEvent.change(draft,{target:{value:'Sin guardar'}});
 const root=draft.closest('[data-native-module]') as HTMLElement;root.scrollTop=123;
 const fetchCount=api.installed.mock.calls.length;
 fireEvent.click(screen.getByRole('button',{name:'Cerrar módulo'}));
 expect(root).not.toBeVisible();expect(api.installed.mock.calls.length).toBe(fetchCount);
 fireEvent.click(screen.getByRole('button',{name:/Mis módulos/i}));
 expect(screen.getByRole('textbox',{name:'Borrador'})).toBe(draft);expect(draft).toHaveValue('Sin guardar');expect(root.scrollTop).toBe(123);
 view.rerender(<StandaloneServerScreen server={{...server,id:'different-server'}} session={{jwt:'different-jwt',csrf:null,exp:0}} theme="dark" language="es" onBack={()=>{}}/>);
 expect(screen.queryByDisplayValue('Sin guardar')).toBeNull();
});
