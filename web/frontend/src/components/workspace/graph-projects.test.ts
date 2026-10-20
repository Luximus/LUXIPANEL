import { describe, expect, it } from "vitest";
import { indexesForProject, rootGraphProjects } from "./graph-projects";

describe("graph project selector", () => {
  it("shows root projects and groups only their descendant indexes", () => {
    const projects = [
      { id: "child", title: "Web", path: "/srv/lux/web", parentId: "root" },
      { id: "root", title: "Lux", path: "/srv/lux", parentId: null },
      { id: "other", title: "Other", path: "/srv/other", parentId: null },
    ];
    const indexes = [
      { name: "root", root_path: "/srv/lux" },
      { name: "web", root_path: "/srv/lux/web" },
      { name: "similar", root_path: "/srv/lux-extra" },
      { name: "other", root_path: "/srv/other" },
    ];

    expect(rootGraphProjects(projects).map((project) => project.id)).toEqual(["root", "other"]);
    expect(indexesForProject(projects[1], indexes).map((index) => index.name)).toEqual(["root", "web"]);
    expect(indexesForProject(projects[2], indexes).map((index) => index.name)).toEqual(["other"]);
  });
});
