import { expect, it } from "vitest";
import type { AssistantProject } from "../assistant-api";
import { projectLocation } from "./project-location";

it("shows the full nested project route and omits unknown or loose chats", () => {
  const projects = [
    { id: "root", title: "LUXIPANEL" },
    { id: "license", title: "LICENCIAS", parentId: "root" },
    { id: "app", title: "APP", parentId: "license" },
  ] as AssistantProject[];
  expect(projectLocation("app", projects)).toEqual(["LUXIPANEL", "LICENCIAS", "APP"]);
  expect(projectLocation(null, projects)).toEqual([]);
  expect(projectLocation("deleted", projects)).toEqual([]);
});
