// SPDX-License-Identifier: AGPL-3.0-only
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { GraphOperations } from "./GraphOperations";
import { scopeHeaders } from "@/lib/api-client";
import { useModuleVisibility } from "./module-visibility";
import { useViewContext } from "./view-context";
type GraphNode = {
  id: string | number;
  name?: string;
  qualified_name?: string;
  label?: string;
  file_path?: string;
  x: number;
  y: number;
  z: number;
};
type GraphEdge = { source: string | number; target: string | number };
type GraphLayout = { nodes: GraphNode[]; edges: GraphEdge[] };
const COLORS = [
  "#8b5cf6",
  "#14b8a6",
  "#f59e0b",
  "#60a5fa",
  "#f472b6",
  "#a3e635",
];
async function graphJson(path: string, body?: unknown, signal?: AbortSignal) {
  const response = await fetch("/cgraph/" + path, {
    method: body ? "POST" : "GET",
    credentials: "include",
    headers: {
      ...scopeHeaders(Boolean(body)),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  if (!response.ok) throw new Error(`Graph API: ${response.status}`);
  return response.json();
}
async function graphTool(
  name: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
) {
  const response = await graphJson(
    "rpc",
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    },
    signal,
  );
  if (response.error) throw new Error(response.error.message);
  const text = response.result?.content?.[0]?.text;
  return text ? JSON.parse(text) : response.result;
}
function Scene({
  layout,
  query,
  onSelect,
}: {
  layout: GraphLayout;
  query: string;
  onSelect: (node: GraphNode) => void;
}) {
  const points = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(layout.nodes.length * 3);
    const colors = new Float32Array(layout.nodes.length * 3);
    layout.nodes.forEach((node, index) => {
      positions.set([node.x || 0, node.y || 0, node.z || 0], index * 3);
      const highlighted =
        !query ||
        `${node.name} ${node.qualified_name} ${node.file_path}`
          .toLowerCase()
          .includes(query.toLowerCase());
      const color = new THREE.Color(
        highlighted
          ? COLORS[
              Math.abs(
                String(node.label || "")
                  .split("")
                  .reduce((sum, char) => sum + char.charCodeAt(0), 0),
              ) % COLORS.length
            ]
          : "#30303d",
      );
      colors.set([color.r, color.g, color.b], index * 3);
    });
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry;
  }, [layout.nodes, query]);
  const edges = useMemo(() => {
    const nodes = new Map(layout.nodes.map((node) => [String(node.id), node]));
    const coordinates: number[] = [];
    for (const edge of layout.edges) {
      const from = nodes.get(String(edge.source));
      const to = nodes.get(String(edge.target));
      if (from && to)
        coordinates.push(from.x, from.y, from.z, to.x, to.y, to.z);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(coordinates, 3),
    );
    return geometry;
  }, [layout]);
  useEffect(
    () => () => {
      points.dispose();
      edges.dispose();
    },
    [points, edges],
  );
  const click = (event: ThreeEvent<MouseEvent>) => {
    if (event.index !== undefined && layout.nodes[event.index])
      onSelect(layout.nodes[event.index]);
  };
  return (
    <>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#7c789b" opacity={0.2} transparent />
      </lineSegments>
      <points geometry={points} onClick={click}>
        <pointsMaterial size={5} sizeAttenuation vertexColors />
      </points>
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} />
    </>
  );
}
/** Native graph surface. All reads go to authenticated JSON APIs, never HTML. */
export default function CodebaseGraphView() {
  const { messages } = useViewContext();
  const t = messages.codebaseGraph;
  const visible = useModuleVisibility();
  const [projects, setProjects] = useState<
    Array<{ name: string; root_path?: string }>
  >([]);
  const [project, setProject] = useState("");
  const [tools, setTools] = useState(false);
  const [layout, setLayout] = useState<GraphLayout | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [details, setDetails] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    void graphTool("list_projects", {}, controller.signal)
      .then((data) => setProjects(data.projects || []))
      .catch((error) => {
        if (error.name !== "AbortError") setError(t.projectsLoadFailed);
      });
    return () => controller.abort();
  }, [t.projectsLoadFailed]);
  const load = useCallback(async () => {
    if (!project) return;
    const run = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const data = await graphJson(
        "api/layout?" + new URLSearchParams({ project, max_nodes: "50000" }),
      );
      if (run !== generation.current) return;
      setLayout({
        nodes: Array.isArray(data.nodes) ? data.nodes : [],
        edges: Array.isArray(data.edges) ? data.edges : [],
      });
      setSelected(null);
    } catch {
      if (run === generation.current) setError(t.graphUnavailable);
    } finally {
      if (run === generation.current) setBusy(false);
    }
  }, [project, t.graphUnavailable]);
  const select = async (node: GraphNode) => {
    setSelected(node);
    setDetails(null);
    if (node.qualified_name)
      try {
        setDetails(
          await graphTool("get_code_snippet", {
            project,
            qualified_name: node.qualified_name,
            include_neighbors: true,
          }),
        );
      } catch {
        setError(t.graphUnavailable);
      }
  };
  return (
    <div className="flex h-full min-h-[500px] flex-col bg-card">
      <div className="flex shrink-0 flex-wrap items-end gap-3 border-b border-border p-3">
        <label className="text-xs">
          {t.project}
          <select
            className="ml-2 rounded-lg border border-border bg-background px-2 py-2"
            value={project}
            onChange={(event) => setProject(event.target.value)}
          >
            <option value="">{t.selectProject}</option>
            {projects.map((row) => (
              <option key={row.name} value={row.name}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="rounded-lg bg-primary px-3 py-2 text-xs text-primary-foreground"
          disabled={!project || busy}
          onClick={() => void load()}
        >
          {busy ? t.loadingProjects : t.visualGraph}
        </button>
        <input
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.querySymbolPattern}
        />
        {layout && (
          <span className="text-xs text-muted-foreground">
            {layout.nodes.length} · {layout.edges.length}
          </span>
        )}
        <button
          className="rounded-lg border border-border px-3 py-2 text-xs"
          aria-pressed={tools}
          onClick={() => setTools((value) => !value)}
        >
          {t.architecture}
        </button>
      </div>
      {error && (
        <p role="alert" className="p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {tools && (
        <GraphOperations
          project={project}
          onChange={() =>
            void graphTool("list_projects", {})
              .then((data) => setProjects(data.projects || []))
              .catch(() => setError(t.projectsLoadFailed))
          }
        />
      )}
      <div className="relative min-h-0 flex-1">
        {layout && (
          <Canvas
            frameloop={visible ? "always" : "never"}
            camera={{ position: [0, 0, 1500], near: 0.1, far: 100000 }}
            dpr={[1, 1.5]}
            raycaster={{
              params: { Mesh: {}, LOD: {}, Sprite: {}, Points: { threshold: 8 }, Line: { threshold: 1 } },
            }}
          >
            <Scene
              layout={layout}
              query={query}
              onSelect={(node) => void select(node)}
            />
          </Canvas>
        )}
        {selected && (
          <aside className="absolute inset-y-3 right-3 w-80 max-w-[80%] overflow-auto rounded-xl border border-border bg-card/95 p-4 shadow-xl">
            <button
              className="float-right"
              onClick={() => setSelected(null)}
              aria-label={t.visualGraph}
            >
              ×
            </button>
            <h3 className="break-words text-sm font-semibold">
              {selected.name || selected.qualified_name}
            </h3>
            <p className="mt-2 break-all text-xs text-muted-foreground">
              {selected.file_path}
            </p>
            <pre className="mt-3 whitespace-pre-wrap break-words text-xs">
              {typeof details === "object" && details && "source" in details
                ? String(details.source)
                : details
                  ? JSON.stringify(details, null, 2)
                  : ""}
            </pre>
          </aside>
        )}
      </div>
    </div>
  );
}
