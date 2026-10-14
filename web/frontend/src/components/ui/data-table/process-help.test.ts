// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import DataTable from "../DataTable";
import { processTableColumns, PROCESSES_TABLE_ID } from "@/config/tables/processes-table-config";

const strings = {
  colHelp: "Ayuda",
  actionExplain: "Preguntar a IA",
  colPid: "PID", colName: "Proceso", colUser: "Usuario", colCpu: "CPU %",
  colRam: "RAM", colMem: "RAM %", filterSearch: "Buscar", filterUser: "Usuario",
  actionKill: "Terminar proceso",
};

afterEach(() => { document.body.replaceChildren(); });

it("places process help in the first cell and emits the selected row", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onAction = vi.fn();
  window.addEventListener("lxp:data-table:row-action", onAction);

  await act(async () => {
    root.render(createElement(DataTable, {
      tableId: PROCESSES_TABLE_ID,
      columns: processTableColumns(strings),
      data: [{ _id: "742", pid: 742, name: "nginx", cpuLabel: "4.0%" }],
    }));
  });
  const firstCell = host.querySelector("tbody tr td:first-child");
  const button = firstCell?.querySelector<HTMLButtonElement>("button");
  expect(button?.getAttribute("aria-label")).toBe("Preguntar a IA: nginx");
  await act(async () => { button?.click(); });
  expect(onAction).toHaveBeenCalledTimes(1);
  expect(onAction.mock.calls[0]?.[0].detail).toMatchObject({
    tableId: PROCESSES_TABLE_ID, actionId: "explain", row: { pid: 742, name: "nginx" },
  });

  window.removeEventListener("lxp:data-table:row-action", onAction);
  await act(async () => { root.unmount(); });
});
