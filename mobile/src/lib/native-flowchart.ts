export type FlowNode = { id: string; label: string };
export type FlowEdge = { from: string; to: string; label?: string };
/** Restricted flowchart grammar emitted by the panel map generator. No HTML or evaluation. */
export function parseFlowchart(source: string): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const nodes = new Map<string, FlowNode>(), edges: FlowEdge[] = [];
  const clean = (text: string) => text.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]*>/g, "").replace(/^['"]|['"]$/g, "").trim();
  const nodePattern = /\b([A-Za-z][\w-]*)\s*(?:\[([^\]]*)\]|\(\((.*?)\)\)|\(([^)]*)\)|\{([^}]*)\})/g;
  const reserved = new Set(["flowchart", "graph", "subgraph", "end", "style", "classDef", "class", "click", "linkStyle", "direction"]);
  for (const match of source.matchAll(nodePattern)) if (!reserved.has(match[1])) nodes.set(match[1], { id: match[1], label: clean(match.slice(2).find(value => value !== undefined) ?? match[1]) });
  const flattened = source.replace(nodePattern, "$1");
  for (const line of flattened.split(/[\n;]/)) {
    if (/^\s*(?:%%|subgraph|style|classDef|class\s|click\s|linkStyle)/.test(line)) continue;
    const edgePattern = /\b([A-Za-z][\w-]*)\s*(?:-->|---|==>|-\.->|--\s+([^>\n]+?)\s+-->)(?:\s*\|([^|]*)\|)?\s*([A-Za-z][\w-]*)/g;
    let match: RegExpExecArray | null;
    while ((match = edgePattern.exec(line))) {
      const from = match[1], to = match[4];
      if (!nodes.has(from)) nodes.set(from, { id: from, label: from });
      if (!nodes.has(to)) nodes.set(to, { id: to, label: to });
      if (!edges.some(edge => edge.from === from && edge.to === to)) edges.push({ from, to, label: clean(match[3] ?? match[2] ?? "") || undefined });
      // Permit A --> B --> C chains by revisiting the destination.
      edgePattern.lastIndex -= to.length;
    }
  }
  return { nodes: [...nodes.values()], edges };
}
