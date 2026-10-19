import { assistantProjectStructureApi, type ProjectContextDocument } from "../assistant-api/project-structure";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * ProjectModalView orchestrator hook. Holds the ENTIRE stateful body of the
 * original `ProjectModalView` component — every hook + handler — moved here
 * VERBATIM and in the SAME order, so the flattened primitive React-hook
 * sequence is byte-identical to the monolith. The presentational overlay lives
 * in `./ProjectModalView`; it reads this VM. Public props are unchanged.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { openConfirm } from "@/lib/confirm";
import {
  assistantProjectsApi,
  fetchAssociatableConnections,
  fetchGraphAvailability,
  fetchProjectGraphIndex,
  fetchTerminalSnippetFilterOptions,
  type TerminalSnippetFilterOptions,
  startProjectGraphIndex,
  type AssistantProject,
  type AssistantProjectGraphIndex,
  type AssistantProjectServer,
  type AssistantSkillsMap,
  type StructureProviderId,
} from "../assistant-api";
import { formatAssistantMessage, mergeNamespaces, useAssistantI18n } from "../i18n";
import { projectModalFallback, type ProjectModalMessages } from "./messages";
import { reparentChild, getAncestorIds } from "./helpers";
import { type ProjectModalViewProps } from "./types";
import { useDeferredClose } from "@/components/ui/use-deferred-close";

export function useProjectModalView({
  project,
  allProjects = [],
  initialParentId,
  initialTab = "general",
  onClose: onCloseProp,
  onSaved,
  onDeleted,
  onRefresh,
  canGoBack,
  loading,
  onBack,
  onNavigate,
}: ProjectModalViewProps) {
  // Every close path (Escape, backdrop, ✕, footer Close, after save/delete)
  // plays the panel's 200ms ease-out exit before the parent unmounts us. The
  // view hands this controller to ModalShell (`closeController`) so the shell's
  // own close paths (backdrop/Escape/✕ — the shell also owns
  // body-pointer-events + Escape) share the SAME `closing` phase.
  const deferredClose = useDeferredClose(onCloseProp);
  const { closing, requestClose } = deferredClose;
  const onClose = useCallback(() => requestClose(), [requestClose]);
  const i18n = useAssistantI18n() as ReturnType<typeof useAssistantI18n> & {
    projectModal?: Partial<ProjectModalMessages>;
  };
  const t = mergeNamespaces(projectModalFallback, i18n.projectModal);
  const [tab, setTab] = useState<"general" | "context" | "servers" | "skills" | "structure" | "agents">(project ? initialTab : "general");
  const [title, setTitle] = useState(project?.title ?? "");
  const [teamName, setTeamName] = useState("");
  const [leaderName, setLeaderName] = useState("");
  const creationKey = useRef(crypto.randomUUID());
  const [icon, setIcon] = useState(project?.icon ?? "Folder");
  const [path, setPath] = useState(project?.path ?? "");
  const [webPreviewUrl, setWebPreviewUrl] = useState(project?.webPreviewUrl ?? "");
  const [appPreviewUrl, setAppPreviewUrl] = useState(project?.appPreviewUrl ?? "");
  const [fileProjectRef, setFileProjectRef] = useState(project?.fileProjectRef ?? null);
  const [instructions, setInstructions] = useState(project?.instructions ?? "");
  const [provider, setProvider] = useState<StructureProviderId>(project?.provider ?? "claude");
  const [autoCapture, setAutoCapture] = useState(project?.autoCapture ?? false);
  // Verify recipe ("definition of done"): one command per line, ≤10.
  const [verifyText, setVerifyText] = useState<string>((project?.verify?.commands ?? []).join("\n"));
  const [parentId] = useState<string>(project?.parentId ?? initialParentId ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [contextDocument, setContextDocument] = useState<ProjectContextDocument | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  useEffect(() => {
    if (tab !== "context" || !project?.id || (contextDocument && instructions !== contextDocument.content)) return;
    let alive = true;
    setContextLoading(true);
    setContextDocument(null);
    setContextError(null);
    assistantProjectStructureApi.readContext(project.id).then(document => {
      if (!alive) return;
      setContextDocument(document);
      setInstructions(document.content);
    }).catch(error => alive && setContextError((error as Error).message))
      .finally(() => alive && setContextLoading(false));
    return () => { alive = false; setContextLoading(false); };
  }, [tab, project?.id, project?.path]);

  // Working directory is set ONLY via the folder picker (browses the connected
  // server's filesystem) — the field itself is read-only.
  const [pickingDir, setPickingDir] = useState(false);

  // ── Codebase graph indexing (only rendered when the target ships the binary) ──
  const [graphAvail, setGraphAvail] = useState(false);
  const [graphEnabled, setGraphEnabled] = useState(project?.graphIndex?.enabled ?? false);
  const [graphState, setGraphState] = useState<AssistantProjectGraphIndex | null>(project?.graphIndex ?? null);
  const [graphBusy, setGraphBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    fetchGraphAvailability().then((r) => alive && setGraphAvail(r.available));
    return () => {
      alive = false;
    };
  }, []);
  // While an index run is in flight, poll its status every 4s until it settles.
  useEffect(() => {
    if (!project?.id || graphState?.status !== "indexing") return;
    const timer = setInterval(() => {
      fetchProjectGraphIndex(project.id).then((s) => {
        if (s) setGraphState(s);
        if (s && s.status !== "indexing") clearInterval(timer);
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [project?.id, graphState?.status]);

  async function indexNow() {
    if (!project?.id) return;
    setGraphBusy(true);
    setErr(null);
    try {
      await startProjectGraphIndex(project.id);
      setGraphEnabled(true);
      setGraphState((prev) => ({ ...(prev ?? { enabled: true }), enabled: true, status: "indexing" }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setGraphBusy(false);
    }
  }

  // Per-project skills override (only in this project's chats).
  const [skills, setSkills] = useState<AssistantSkillsMap>(project?.skills ?? {});

  // Pre-filtro de snippets de terminal (nombres de categoría/tags). Vacío = sin filtro.
  const [snippetCategory, setSnippetCategory] = useState<string>(project?.snippetCategory ?? "");
  const [snippetTags, setSnippetTags] = useState<string[]>(project?.snippetTags ?? []);
  // Opciones para los selects; null = cargando, ok:false = sin permiso de terminal.
  const [snippetOpts, setSnippetOpts] = useState<TerminalSnippetFilterOptions | null>(null);
  useEffect(() => {
    let alive = true;
    void fetchTerminalSnippetFilterOptions().then((r) => alive && setSnippetOpts(r));
    return () => {
      alive = false;
    };
  }, []);

  // Associated server connections (other servers from the bottom-left selector).
  const [servers, setServers] = useState<AssistantProjectServer[]>(project?.servers ?? []);
  const [availableConns, setAvailableConns] = useState<AssistantProjectServer[]>([]);
  const [connsLoading, setConnsLoading] = useState(true);

  // Load the connections the user can associate (same list as the sidebar
  // selector). Merge in any already-saved servers so they show even if the
  // SSO list (which excludes the current target) doesn't return them.
  useEffect(() => {
    let alive = true;
    setConnsLoading(true);
    fetchAssociatableConnections()
      .then((conns) => {
        if (!alive) return;
        const byId = new Map<string, AssistantProjectServer>();
        for (const c of conns) byId.set(c.id, c);
        for (const s of project?.servers ?? []) if (!byId.has(s.id)) byId.set(s.id, s);
        setAvailableConns([...byId.values()]);
      })
      .finally(() => alive && setConnsLoading(false));
    return () => {
      alive = false;
    };
  }, [project?.id]);

  function toggleServer(conn: AssistantProjectServer) {
    setServers((prev) =>
      prev.some((s) => s.id === conn.id) ? prev.filter((s) => s.id !== conn.id) : [...prev, conn],
    );
  }

  // Children already assigned (edit mode: from allProjects; create mode: local pending list)
  const [pendingChildIds, setPendingChildIds] = useState<string[]>([]);
  const [addBusy, setAddBusy] = useState(false);
  const [removeBusy, setRemoveBusy] = useState<string | null>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Defeat the drawer's Radix focus trap (vaul 1.1.2 never forwards `modal={false}`
  // to its underlying `Dialog.Root`, so the Dialog stays modal and its
  // `FocusScope trapped` keeps two document-level listeners: `focusin` (yanks
  // focus back when it lands OUTSIDE `DrawerContent`) and `focusout` (yanks it
  // back when an element INSIDE the drawer loses focus to an outside element).
  // This modal is portaled to <body> — a sibling of the drawer, i.e. outside that
  // scope — so clicking a field fired BOTH: `focusin` on our input and `focusout`
  // on the drawer's last-focused element (its chat textarea). The trap re-focused
  // that textarea, so typing went "to the background".
  //
  // Radix's listeners are on `document` in the BUBBLE phase. We register a
  // CAPTURE-phase listener on `document` (runs first) and stop the event before it
  // can reach them — but ONLY when the focus move enters or leaves this modal, so
  // the drawer's own focus handling is otherwise untouched. `input`/`change`/
  // `click`/`keydown` are different event types and never affected, so typing works
  // once focus is allowed to stay.
  useEffect(() => {
    const node = overlayRef.current;
    if (!node) return;
    const guard = (e: FocusEvent) => {
      const target = e.target as Node | null;
      const related = e.relatedTarget as Node | null;
      if ((target && node.contains(target)) || (related && node.contains(related))) {
        e.stopImmediatePropagation();
      }
    };
    document.addEventListener("focusin", guard, true);
    document.addEventListener("focusout", guard, true);
    return () => {
      document.removeEventListener("focusin", guard, true);
      document.removeEventListener("focusout", guard, true);
    };
  }, []);

  // In edit mode children come from allProjects (authoritative after onRefresh).
  // In create mode they come from local pendingChildIds.
  const assignedChildren = project
    ? allProjects.filter((p) => p.parentId === project.id)
    : allProjects.filter((p) => pendingChildIds.includes(p.id));

  const assignedChildIds = new Set(assignedChildren.map((c) => c.id));
  const ancestorIds = project ? getAncestorIds(project.id, allProjects) : new Set<string>();

  // Parent project (if this is a child) — for the header "open parent" nav button.
  const parentProject = project?.parentId
    ? allProjects.find((p) => p.id === project.parentId) ?? null
    : null;

  // Projects that can still be added as children: not self, not already assigned, not an ancestor.
  const availableForChild = allProjects.filter(
    (p) => p.id !== project?.id && !assignedChildIds.has(p.id) && !ancestorIds.has(p.id),
  );

  async function save() {
    if (!title.trim()) { setErr(t.titleRequired); return; }
    if (contextLoading || (tab === "context" && project?.id && !contextDocument)) return;
    setBusy(true);
    setErr(null);
    try {
      if (contextDocument && project) {
        const edited = instructions !== contextDocument.content;
        const sameSource = provider === contextDocument.provider;
        if (edited && !sameSource) throw new Error(t.contextSaveSettings);
        if (sameSource && (edited || contextDocument.needsMigration)) {
          const savedDocument = await assistantProjectStructureApi.saveContext(project.id, instructions, contextDocument.revision);
          setContextDocument(savedDocument);
        }
      }
      // Verify recipe: one command per line (≤10, ≤400 chars each); empty → null.
      const verifyCommands = verifyText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 10)
        .map((l) => l.slice(0, 400));
      const data = {
        title: title.trim(),
        icon,
        path: path.trim(),
        webPreviewUrl: webPreviewUrl.trim(),
        appPreviewUrl: appPreviewUrl.trim(),
        fileProjectRef,
        ...(!project ? { instructions } : { expectedPath: project.path }),
        provider,
        parentId: parentId || null,
        ...(!project && !parentId ? { teamName: teamName.trim() || title.trim(), leaderName: leaderName.trim() || `${title.trim()} · Líder`, creationKey: creationKey.current } : {}),
        servers,
        autoCapture,
        skills,
        graphIndexEnabled: graphEnabled,
        verify: verifyCommands.length
          ? { commands: verifyCommands, ...(project?.verify?.timeoutMs ? { timeoutMs: project.verify.timeoutMs } : {}) }
          : null,
        // Pre-filtro de snippets de terminal — siempre presentes (vacío = sin
        // filtro) para que quitar el filtro también persista.
        snippetCategory: snippetCategory.trim(),
        snippetTags: snippetCategory.trim() ? snippetTags.slice(0, 20) : [],
      };
      const saved = project
        ? await assistantProjectsApi.update(project.id, data)
        : await assistantProjectsApi.create(data);

      // CREATE mode with the graph toggle on: kick off the first indexing now
      // that we have the real project id (best-effort; the modal is closing).
      if (!project && graphEnabled && graphAvail && data.path) {
        startProjectGraphIndex(saved.id).catch(() => undefined);
      }

      // CREATE mode: assign pending children now that we have the real ID.
      if (!project && pendingChildIds.length > 0) {
        await Promise.all(
          pendingChildIds.map((childId) => {
            const child = allProjects.find((p) => p.id === childId);
            if (!child) return Promise.resolve();
            return reparentChild(child, saved.id);
          }),
        );
        onRefresh?.();
      }

      onSaved(saved);
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!project) return;
    if (allProjects.some((p) => p.parentId === project.id)) {
      setErr("Mueve o elimina los subproyectos antes de borrar este proyecto.");
      return;
    }
    if (
      !(await openConfirm(
        `${formatAssistantMessage(t.deleteConfirm, { title: project.title })} Los chats quedarán en Chats sueltos; el equipo y sus agentes se conservarán.`,
        { title: t.deleteTitle, confirmText: t.deleteConfirmBtn, variant: "danger" },
      ))
    )
      return;
    setBusy(true);
    try {
      await assistantProjectsApi.remove(project.id);
      onDeleted?.(project.id);
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function doAddChild() {
    const childId = selectRef.current?.value ?? "";
    if (!childId) return;

    if (!project) {
      // CREATE mode: only local state, no API call yet.
      setPendingChildIds((prev) => [...prev, childId]);
      if (selectRef.current) selectRef.current.value = "";
      return;
    }

    // EDIT mode: persist immediately.
    const child = allProjects.find((p) => p.id === childId);
    if (!child) return;
    setAddBusy(true);
    setErr(null);
    try {
      await reparentChild(child, project.id);
      if (selectRef.current) selectRef.current.value = "";
      onRefresh?.();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setAddBusy(false);
    }
  }

  async function doRemoveChild(child: AssistantProject) {
    if (!project) {
      // CREATE mode: remove from local list.
      setPendingChildIds((prev) => prev.filter((id) => id !== child.id));
      return;
    }

    // EDIT mode: unassign via API.
    setRemoveBusy(child.id);
    setErr(null);
    try {
      await reparentChild(child, null);
      onRefresh?.();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setRemoveBusy(null);
    }
  }

  const wide = tab === "structure" || tab === "skills" || tab === "agents";

  return {
    project, allProjects, initialParentId, onClose, closing, deferredClose, onSaved, onDeleted, onRefresh,
    canGoBack, loading, onBack, onNavigate, t, i18n,
    tab, setTab, title, setTitle, teamName, setTeamName, leaderName, setLeaderName, icon, setIcon, path, setPath,
    webPreviewUrl, setWebPreviewUrl, appPreviewUrl, setAppPreviewUrl, fileProjectRef, setFileProjectRef,
    instructions, setInstructions, provider, setProvider, autoCapture, setAutoCapture, contextDocument, contextLoading, contextError,
    verifyText, setVerifyText, parentId, busy, setBusy, err, setErr,
    pickingDir, setPickingDir, graphAvail, setGraphAvail, graphEnabled, setGraphEnabled,
    graphState, setGraphState, graphBusy, setGraphBusy, indexNow,
    skills, setSkills, snippetCategory, setSnippetCategory, snippetTags, setSnippetTags,
    snippetOpts, setSnippetOpts, servers, setServers, availableConns, setAvailableConns,
    connsLoading, setConnsLoading, toggleServer,
    pendingChildIds, setPendingChildIds, addBusy, setAddBusy, removeBusy, setRemoveBusy,
    selectRef, overlayRef, assignedChildren, assignedChildIds, ancestorIds,
    parentProject, availableForChild, save, del, doAddChild, doRemoveChild, wide,
  };
}

export type ProjectModalViewVM = ReturnType<typeof useProjectModalView>;
