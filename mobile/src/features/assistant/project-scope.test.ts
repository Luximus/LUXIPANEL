import { expect, it } from "vitest";
import { projectLocation, projectScopeIds, rootProjectId, rootProjects } from "./project-scope";

it("uses the selected root and every nested descendant for the chat history", () => {
  const projects = [
    { id: "root", parentId: null },
    { id: "child", parentId: "root" },
    { id: "grandchild", parentId: "child" },
    { id: "other", parentId: null },
  ];
  expect(rootProjectId("grandchild", projects)).toBe("root");
  expect(projectScopeIds("root", projects)).toEqual(["root", "child", "grandchild"]);
  expect(rootProjects(projects).map((project) => project.id)).toEqual(["root", "other"]);
});

it("shows the full subproject path in the active conversation", () => {
  const projects = [
    { id: "root", title: "LUXIPANEL", parentId: null },
    { id: "child", title: "LICENCIAS", parentId: "root" },
    { id: "grandchild", title: "APP", parentId: "child" },
  ];
  expect(projectLocation("grandchild", projects)).toEqual(["LUXIPANEL", "LICENCIAS", "APP"]);
  expect(projectLocation("root", projects)).toEqual(["LUXIPANEL"]);
});
