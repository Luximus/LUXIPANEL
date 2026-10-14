import { describe, expect, it } from "vitest";
import { parseFlowchart } from "./native-flowchart";
describe("mapa nativo de flujo", () => {
 it("conserva etiquetas, caminos encadenados y decisiones", () => {
  const graph=parseFlowchart('flowchart TD\nA["Entrada"] --> B{¿Autorizado?}\nB -->|sí| C[Panel] --> D[(Datos)]\nB -->|no| E[Salir]');
  expect(graph.nodes.find(node=>node.id==="A")?.label).toBe("Entrada");
  expect(graph.edges).toEqual([{from:"A",to:"B",label:undefined},{from:"B",to:"C",label:"sí"},{from:"C",to:"D",label:undefined},{from:"B",to:"E",label:"no"}]);
 });
 it("omite estilos y elimina marcado HTML de etiquetas", () => {
  const graph=parseFlowchart('flowchart LR\nA[Uno<br/>Dos] --> B[Fin]\nstyle A fill:red\nclassDef default stroke:blue');
  expect(graph.nodes.map(node=>node.id)).toEqual(["A","B"]);
  expect(graph.nodes[0].label).toBe("Uno\nDos");
 });
 it("reconoce nodos sin etiquetas y ciclos sin duplicar", () => {
  const graph=parseFlowchart('graph LR\nA --> B\nB --> A\nA --> B');
  expect(graph.nodes).toHaveLength(2); expect(graph.edges).toHaveLength(2);
 });
});
