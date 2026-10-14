import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AssistantProject, ConversationMeta } from "../assistant-api";
import type { ProjectTreeEntry } from "../conversation-grouping";
import { SelectedProjectConvos } from "./project-history-picker";

describe("project history sidebar", () => {
  it("keeps every subproject header above root and expanded child chats", () => {
    const rootId = "root";
    const projects = new Map<string, AssistantProject>([
      [rootId, { id: rootId, title: "Principal", path: "/work", icon: "folder" } as AssistantProject],
      ["child-a", { id: "child-a", title: "Subproyecto Alfa", parentId: rootId, icon: "folder" } as AssistantProject],
      ["child-b", { id: "child-b", title: "Subproyecto Beta", parentId: rootId, icon: "folder" } as AssistantProject],
    ]);
    const chat = (id: string, projectId: string) => ({ id, projectId, title: id, updatedAt: "2026-09-28T23:00:00Z" }) as ConversationMeta;
    const entries: ProjectTreeEntry<ConversationMeta>[] = [{
      kind: "project",
      node: { projectId: rootId, totalConvos: 2, entries: [
        { kind: "chat", convo: chat("Chat principal", rootId) },
        { kind: "project", node: { projectId: "child-a", totalConvos: 1, entries: [{ kind: "chat", convo: chat("Chat de Alfa", "child-a") }] } },
        { kind: "project", node: { projectId: "child-b", totalConvos: 0, entries: [] } },
      ] },
    }];
    const markup = renderToStaticMarkup(createElement(SelectedProjectConvos, {
      entries,
      projectById: projects,
      selectedProjectId: "child-a",
      expanded: new Set(["child-a"]),
      onToggle: () => {},
      onNewLoose: () => {},
      onNewProjectChat: () => {},
      onEditProject: () => {},
      inRail: true,
      rowProps: {
        activeId: null,
        agentById: new Map(),
        projectTitleById: new Map([...projects].map(([id, project]) => [id, project.title])),
        onOpen: () => {}, onDelete: () => {}, onRename: () => {}, onTogglePin: () => {},
      },
    }));
    expect(markup).toContain("data-pinned-subprojects");
    expect(markup).not.toContain(">Subproyectos<");
    expect(markup.indexOf("data-pinned-subprojects")).toBeLessThan(markup.indexOf("data-rail-history-list"));
    expect(markup.indexOf("data-rail-history-list")).toBeLessThan(markup.indexOf("Chat de Alfa"));
    expect(markup.indexOf("Subproyecto Alfa")).toBeLessThan(markup.indexOf("Subproyecto Beta"));
    expect(markup.indexOf("Subproyecto Beta")).toBeLessThan(markup.indexOf("Chat de Alfa"));
    expect(markup.indexOf("Chat de Alfa")).toBeLessThan(markup.indexOf("Chat principal"));
    expect(markup).toMatch(/data-current-project="true"[^>]*>\s*<button[^>]*aria-current="location"[^>]*>[^]*?Subproyecto Alfa/);
    expect(markup.match(/data-current-project="true"/g)).toHaveLength(1);
  });
});
