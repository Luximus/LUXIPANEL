import { describe, expect, it } from "vitest";
import type { AssistantProject, ConversationMeta } from "../assistant-api";
import { conversationInProjectScope, projectScopeIds } from "./project-search";

const project = (id: string, parentId: string | null = null) => ({ id, parentId, title: id }) as AssistantProject;
const conversation = (projectId: string | null) => ({ id: projectId ?? "loose", projectId }) as ConversationMeta;

describe("selected project search scope", () => {
  const projects = [project("root"), project("child", "root"), project("grandchild", "child"), project("other")];

  it("includes chats in the selected project and its descendants", () => {
    const ids = projectScopeIds("root", projects);
    expect([...ids]).toEqual(["root", "child", "grandchild"]);
    expect(conversationInProjectScope(conversation("grandchild"), "root", ids)).toBe(true);
    expect(conversationInProjectScope(conversation("other"), "root", ids)).toBe(false);
  });

  it("searches loose chats when Chats sueltos is selected", () => {
    const ids = projectScopeIds(null, projects);
    expect(conversationInProjectScope(conversation(null), null, ids)).toBe(true);
    expect(conversationInProjectScope(conversation("root"), null, ids)).toBe(false);
    expect(conversationInProjectScope({ ...conversation(null), agentId: "other-project-agent" }, null, ids)).toBe(false);
    expect(conversationInProjectScope({ ...conversation("root"), agentId: "agent" }, "root", projectScopeIds("root", projects))).toBe(true);
  });
});
