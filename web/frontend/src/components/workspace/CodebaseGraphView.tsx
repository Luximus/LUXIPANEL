// SPDX-License-Identifier: AGPL-3.0-only
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { GraphOperations } from "./GraphOperations";
import { scopeHeaders } from "@/lib/api-client";
import { useModuleVisibility } from "./module-visibility";
import { useViewContext } from "./view-context";
import { indexesForProject, rootGraphProjects, type GraphIndex, type GraphProject } from "./graph-projects";
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
  const { messages, scope } = useViewContext();
  const t = messages.codebaseGraph;
  const visible = useModuleVisibility();
  const [projects, setProjects] = useState<GraphProject[]>([]);
  const [indexes, setIndexes] = useState<GraphIndex[]>([]);
  const [projectId, setProjectId] = useState("");
  const [project, setProject] = useState("");
  const [catalogBusy, setCatalogBusy] = useState(true);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [headerTarget, setHeaderTarget] = useState<HTMLElement | null>(null);
  const [tools, setTools] = useState(false);
  const [layout, setLayout] = useState<GraphLayout | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [details, setDetails] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const catalogGeneration = useRef(0);
  const detailGeneration = useRef(0);
  const selectedProject = projects.find((row) => row.id === projectId);
  const projectIndexes = useMemo(() => indexesForProject(selectedProject, indexes), [selectedProject, indexes]);

  useLayoutEffect(() => {
    const drawer = scope.root.closest(".lxp-workspace-quick-drawer");
    setHeaderTarget(visible ? drawer?.querySelector<HTMLElement>("[data-module-header-controls-slot]") ?? null : null);
  }, [scope, visible]);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    const run = ++catalogGeneration.current;
    setCatalogBusy(true);
    void Promise.all([
      fetch("/api/codebase-graph/projects", {
        credentials: "include",
        headers: scopeHeaders(false),
        signal: controller.signal,
      }).then(async (response) => {
        if (!response.ok) throw new Error("Projects unavailable");
        const result = await response.json();
        if (!result.ok || !Array.isArray(result.data?.projects)) throw new Error("Projects unavailable");
        return result.data.projects as GraphProject[];
      }),
      graphTool("list_projects", {}, controller.signal),
    ])
      .then(([visibleProjects, graphProjects]) => {
        if (controller.signal.aborted || run !== catalogGeneration.current) return;
        const roots = rootGraphProjects(visibleProjects);
        const nextIndexes = Array.isArray(graphProjects.projects) ? graphProjects.projects : [];
        setProjects(roots);
        setIndexes(nextIndexes);
        setProjectId((current) => current && roots.some((row) => row.id === current) ? current : "");
        setProject((current) => current && nextIndexes.some((row: GraphIndex) => row.name === current) ? current : "");
        setError("");
      })
      .catch((error) => {
        if (error.name !== "AbortError" && run === catalogGeneration.current) setError(t.projectsLoadFailed);
      })
      .finally(() => {
        if (!controller.signal.aborted && run === catalogGeneration.current) setCatalogBusy(false);
      });
    return () => {
      controller.abort();
      catalogGeneration.current++;
    };
  }, [visible, catalogRevision, t.projectsLoadFailed]);

  useEffect(() => {
    const onTargetChange = () => {
      generation.current++;
      catalogGeneration.current++;
      detailGeneration.current++;
      setProjectId("");
      setProject("");
      setProjects([]);
      setIndexes([]);
      setLayout(null);
      setSelected(null);
      setDetails(null);
      setBusy(false);
      setError("");
      setCatalogRevision((current) => current + 1);
    };
    window.addEventListener("luxipanel:target-changed", onTargetChange);
    return () => window.removeEventListener("luxipanel:target-changed", onTargetChange);
  }, []);

  useEffect(() => {
    if (project && !projectIndexes.some((index) => index.name === project)) {
      generation.current++;
      detailGeneration.current++;
      setProject("");
      setLayout(null);
      setSelected(null);
      setDetails(null);
      setBusy(false);
    }
  }, [project, projectIndexes]);
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
  useEffect(() => {
    if (project && visible) void load();
  }, [project, visible, load]);

  const changeProject = (id: string) => {
    generation.current++;
    detailGeneration.current++;
    setProjectId(id);
    setProject("");
    setLayout(null);
    setSelected(null);
    setDetails(null);
    setBusy(false);
    setError("");
  };
  const changeIndex = (name: string) => {
    generation.current++;
    detailGeneration.current++;
    setProject(name);
    setLayout(null);
    setSelected(null);
    setDetails(null);
    setBusy(false);
    setError("");
  };
  const select = async (node: GraphNode) => {
    const run = ++detailGeneration.current;
    setSelected(node);
    setDetails(null);
    if (node.qualified_name)
      try {
        const result = await graphTool("get_code_snippet", {
          project,
          qualified_name: node.qualified_name,
          include_neighbors: true,
        });
        if (run === detailGeneration.current) setDetails(result);
      } catch {
        if (run === detailGeneration.current) setError(t.graphUnavailable);
      }
  };
  const controls = (
    <div className="lxp-codebase-header-controls">
      <label className="lxp-codebase-header-field">
        <span>{t.project}</span>
        <select
          className="lxp-codebase-header-select"
          value={projectId}
          disabled={catalogBusy}
          onChange={(event) => changeProject(event.target.value)}
        >
          <option value="">{catalogBusy ? t.loadingProjects : t.selectProject}</option>
          {projects.map((row) => (
            <option key={row.id} value={row.id}>{row.title}</option>
          ))}
        </select>
      </label>
      <label className="lxp-codebase-header-field">
        <span>{t.indexation}</span>
        <select
          className="lxp-codebase-header-select"
          value={project}
          disabled={!projectId || catalogBusy || !projectIndexes.length}
          onChange={(event) => changeIndex(event.target.value)}
        >
          <option value="">{projectId && !projectIndexes.length ? t.noIndexes : t.selectIndex}</option>
          {projectIndexes.map((row) => (
            <option key={row.name} value={row.name}>
              {row.root_path.replace(/\/+$/, "") === selectedProject?.path.replace(/\/+$/, "")
                ? selectedProject?.title
                : row.root_path.slice((selectedProject?.path.replace(/\/+$/, "") || "").length + 1)}
            </option>
          ))}
        </select>
      </label>
      <label className="lxp-codebase-header-field lxp-codebase-header-search">
        <span className="sr-only">{t.querySymbolPattern}</span>
        <input
          type="search"
          className="lxp-codebase-header-input"
          value={query}
          disabled={!project}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.querySymbolPattern}
        />
      </label>
      <button
        className="lxp-codebase-header-button"
        type="button"
        disabled={!project || busy}
        onClick={() => void load()}
        aria-label={t.refreshGraph}
        title={t.refreshGraph}
      >
        <i className={`ti ti-refresh ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
      </button>
      <button
        className="lxp-codebase-header-button"
        type="button"
        aria-pressed={tools}
        onClick={() => setTools((value) => !value)}
      >
        {t.architecture}
      </button>
    </div>
  );
  return (
    <div className="flex h-full min-h-[500px] flex-col bg-card">
      {headerTarget
        ? createPortal(controls, headerTarget)
        : <div className="border-b border-border p-3">{controls}</div>}
      {error && (
        <p role="alert" className="p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {tools && (
        <GraphOperations
          project={project}
          onChange={() => setCatalogRevision((current) => current + 1)}
        />
      )}
      <div className="relative min-h-0 flex-1">
        {(!layout || layout.nodes.length === 0) && !error && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {catalogBusy
              ? t.loadingProjects
              : busy
                ? t.loadingGraph
                : !projects.length
                  ? t.noVisibleProjects
                  : !projectId
                    ? t.chooseProjectHint
                    : !project
                      ? (projectIndexes.length ? t.chooseIndexHint : t.noIndexes)
                      : t.noGraphData}
          </div>
        )}
        {layout && layout.nodes.length > 0 && (
          <span className="absolute left-3 top-3 z-10 rounded-md border border-border bg-card/90 px-2 py-1 text-xs text-muted-foreground">
            {layout.nodes.length} {t.symbols} · {layout.edges.length} {t.relations}
          </span>
        )}
        {layout && layout.nodes.length > 0 && (
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
