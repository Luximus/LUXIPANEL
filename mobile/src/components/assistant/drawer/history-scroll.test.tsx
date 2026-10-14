// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import React from "react";
import { act, create } from "react-test-renderer";
import { expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  View: "View", Text: "Text", Pressable: "Pressable", ActivityIndicator: "Spinner",
  StyleSheet: { create: (styles: object) => styles },
}));
vi.mock("lucide-react-native", () => ({
  ChevronRight: "ChevronRight", Folder: "Folder", MessageSquare: "MessageSquare", Plus: "Plus",
}));
vi.mock("../../../theme/colors", () => ({ withAlpha: (color: string) => color }));
vi.mock("./ConvoRow", () => ({ ConvoRow: "ConvoRow" }));
vi.mock("./TimelineRow", () => ({ TimelineRowRN: "TimelineRow" }));
vi.mock("./AgentGroupHeader", () => ({ AgentGroupHeader: "AgentGroupHeader" }));

import { LOOSE_GROUP_ID } from "../../assistant-settings/agents/conversation-grouping";
import { AgentThreadedConvos, ROOT_GROUP_KEY } from "./AgentThreadedConvos";
import { ProjectTreeConvos } from "./ProjectTreeConvos";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const noop = () => undefined;
const common = {
  activeId: null,
  liveIds: new Set<string>(),
  onOpen: noop,
  onDelete: noop,
  onRename: noop,
  onTogglePin: noop,
  t: { noConversations: "Sin conversaciones", looseChats: "Chats sueltos" } as any,
  tokens: { textMuted: "#888", textPrimary: "#fff", border: "#444", bgInput: "#222", bgCardSolid: "#111" } as any,
};

it("muestra todos los chats sueltos y de proyecto recibidos sin cortar a cinco", async () => {
  const loose = Array.from({ length: 12 }, (_, i) => ({ id: `loose-${i}` }));
  const project = Array.from({ length: 12 }, (_, i) => ({ id: `project-${i}` }));
  const entries = [
    ...loose.map((convo) => ({ kind: "chat", convo })),
    { kind: "project", node: { projectId: "p1", totalConvos: 12, entries: project.map((convo) => ({ kind: "chat", convo })) } },
  ] as any;
  let tree: ReturnType<typeof create>;
  await act(async () => {
    tree = create(<ProjectTreeConvos {...common} entries={entries} projectTitleById={new Map([["p1", "Proyecto"]])}
      expanded={new Set([LOOSE_GROUP_ID, "p1"])} onToggle={noop} onNewLoose={noop} onNewProjectChat={noop} />);
  });
  expect(tree!.root.findAllByType("ConvoRow" as any)).toHaveLength(24);
  await act(async () => tree!.unmount());
});

it("muestra todas las conversaciones del agente abierto en una lista", async () => {
  const convos = Array.from({ length: 12 }, (_, i) => ({ id: `agent-${i}`, agentId: "a1", updatedAt: `2026-10-06T00:${String(i).padStart(2, "0")}:00Z` })) as any;
  let tree: ReturnType<typeof create>;
  await act(async () => {
    tree = create(<AgentThreadedConvos {...common} convos={convos} agentById={new Map([["a1", { id: "a1", name: "Agente" }]]) as any}
      rolesById={new Map()} projectTitleById={new Map()} openAgentByGroup={new Map([[ROOT_GROUP_KEY, "a1"]])}
      onToggle={noop} onNewAgentChat={noop} />);
  });
  expect(tree!.root.findAllByType("ConvoRow" as any)).toHaveLength(12);
  await act(async () => tree!.unmount());
});
