import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  get: vi.fn(), users: vi.fn(), roles: vi.fn(), scope: "server-a",
}));
vi.mock("/scripts/extracted/lib/api-client.js?v=20260506a", () => ({
  api: { get: mock.get }, resolveTargetScope: () => mock.scope,
}));
vi.mock("/scripts/extracted/lib/crud.js", () => ({ confirmMutateReload: vi.fn() }));
vi.mock("/scripts/extracted/lib/confirm.js?v=3", () => ({ openConfirm: vi.fn() }));
vi.mock("./table-bridge", () => ({ publishUsersRows: mock.users, publishRolesRows: mock.roles }));
vi.mock("./dom", () => ({
  t: (_key: string, fallback: string) => fallback, fmt: (value: string) => value,
  showToast: vi.fn(), escapeHtml: (value: string) => value,
  formatDateTime: (value: unknown) => value || "—", tsOf: (value: unknown) => value ? 1 : 0,
  linesFromTextarea: () => [], setTextareaLines: vi.fn(),
}));

import { loadUsers } from "./users-data";
import { loadGroups } from "./groups";
import { loadPermissionCatalog } from "./role-permissions";
import { capabilities, setCurrentUsername } from "./state";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const row = (username = "alice") => ({ id: 1, username, groups: ["sudo"], enabled: true });
const listResponse = (username = "alice") => ({ ok: true, data: [row(username)] });
const presenceResponse = (username = "alice") => ({ ok: true, data: {
  [username]: { online: true, connections: 2, lastLogin: "2026-09-29T12:00:00Z" },
} });
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

beforeEach(() => {
  vi.clearAllMocks();
  mock.scope = "server-a";
  document.body.innerHTML = '<div id="panel-users"></div><div id="role-module-tabs"></div><div id="role-module-panes"></div><div id="perm-command-groups-grid"></div>';
  history.replaceState({}, "", "/users");
  Object.assign(capabilities, { usersView: true, usersEdit: true, rolesView: true, canChangePw: false });
  setCurrentUsername("alice");
  (window as any).openUserEdit = vi.fn();
});

describe("users progressive loading", () => {
  it("publishes the list and resolves without waiting for live sessions", async () => {
    const sessions = deferred<any>();
    mock.get.mockImplementation((path) => path.endsWith("/sessions") ? sessions.promise : Promise.resolve(listResponse()));
    await loadUsers();
    expect(mock.users).toHaveBeenCalledTimes(1);
    const first = mock.users.mock.calls[0][0][0];
    expect(first.username).toBe("alice");
    expect(first.statusCell.label).toBe("…");
    expect(first.connections).toBeNull();
    expect(capabilities.canChangePw).toBe(true);
    sessions.resolve(presenceResponse());
    await flush();
    expect(mock.users).toHaveBeenCalledTimes(2);
    expect(mock.users.mock.calls[1][0][0]).toMatchObject({ connections: 2, lastLoginTs: 1, statusCell: { label: "En línea" } });
  });

  it("keeps the list and marks presence unknown when that read fails", async () => {
    const sessions = deferred<any>();
    mock.get.mockImplementation((path) => path.endsWith("/sessions") ? sessions.promise : Promise.resolve(listResponse()));
    await loadUsers();
    sessions.reject(new Error("SSH timeout"));
    await flush();
    expect(mock.users.mock.calls.at(-1)?.[0][0]).toMatchObject({ username: "alice", connections: null, statusCell: { label: "—" } });
  });

  it("does not replace a refreshed list with older sessions", async () => {
    const old = deferred<any>();
    let reads = 0;
    let lists = 0;
    mock.get.mockImplementation((path) => path.endsWith("/sessions")
      ? (++reads === 1 ? old.promise : Promise.resolve(presenceResponse("bob")))
      : Promise.resolve(listResponse(++lists === 1 ? "alice" : "bob")));
    await loadUsers();
    await loadUsers();
    await flush();
    const publications = mock.users.mock.calls.length;
    old.resolve(presenceResponse());
    await flush();
    expect(mock.users).toHaveBeenCalledTimes(publications);
    expect(mock.users.mock.calls.at(-1)?.[0][0].username).toBe("bob");
  });

  it.each(["scope", "DOM"])("discards delayed presence after a %s change", async (change) => {
    const sessions = deferred<any>();
    mock.get.mockImplementation((path) => path.endsWith("/sessions") ? sessions.promise : Promise.resolve(listResponse()));
    await loadUsers();
    if (change === "scope") mock.scope = "server-b";
    else document.getElementById("panel-users")!.outerHTML = '<div id="panel-users"></div>';
    sessions.resolve(presenceResponse());
    await flush();
    expect(mock.users).toHaveBeenCalledTimes(1);
  });

  it("discards a list that arrives after a server switch", async () => {
    const list = deferred<any>();
    mock.get.mockImplementation((path) => path.endsWith("/sessions") ? Promise.resolve(presenceResponse()) : list.promise);
    const loading = loadUsers();
    mock.scope = "server-b";
    list.resolve(listResponse());
    await loading;
    expect(mock.users).not.toHaveBeenCalled();
  });

  it("does not fetch when view permission is denied", async () => {
    capabilities.usersView = false;
    await loadUsers();
    expect(mock.get).not.toHaveBeenCalled();
  });

  it("opens the requested edit once, without reopening after presence", async () => {
    const sessions = deferred<any>();
    history.replaceState({}, "", "/users?user=alice");
    mock.get.mockImplementation((path) => path.endsWith("/sessions") ? sessions.promise : Promise.resolve(listResponse()));
    await loadUsers();
    expect((window as any).openUserEdit).toHaveBeenCalledTimes(1);
    sessions.resolve(presenceResponse());
    await flush();
    expect((window as any).openUserEdit).toHaveBeenCalledTimes(1);
    expect(location.search).toBe("");
  });
});

describe("groups loading", () => {
  it("shares an ongoing list with an early edit, then allows a fresh read", async () => {
    const response = deferred<any>();
    mock.get.mockReturnValue(response.promise);
    const first = loadGroups();
    const second = loadGroups();
    expect(first).toBe(second);
    expect(mock.get).toHaveBeenCalledTimes(1);
    response.resolve({ ok: true, data: [{ name: "sudo", members: ["alice"] }] });
    await first;
    expect(mock.roles).toHaveBeenCalledTimes(1);
    await loadGroups();
    expect(mock.get).toHaveBeenCalledTimes(2);
  });

  it("discards membership after switching server", async () => {
    const response = deferred<any>();
    mock.get.mockReturnValue(response.promise);
    const loading = loadGroups();
    mock.scope = "server-b";
    response.resolve({ ok: true, data: [{ name: "sudo" }] });
    await loading;
    expect(mock.roles).not.toHaveBeenCalled();
  });
});

describe("role editor catalog", () => {
  const catalog = { ok: true, data: {
    sidebarItems: ["users"], views: ["panel.users"], actions: ["users.view"], commandGroups: [],
    modules: [{ module: "users", label: "Users", sidebar: ["users"], views: ["panel.users"], actions: ["users.view"] }],
  } };

  it("shares catalog loading and preserves selections on later openings", async () => {
    const response = deferred<any>();
    mock.get.mockReturnValue(response.promise);
    const first = loadPermissionCatalog();
    expect(loadPermissionCatalog()).toBe(first);
    response.resolve(catalog);
    await first;
    const checkbox = document.querySelector<HTMLInputElement>("input[name='perm-action']")!;
    checkbox.checked = true;
    await loadPermissionCatalog();
    expect(checkbox.isConnected).toBe(true);
    expect(checkbox.checked).toBe(true);
    expect(mock.get).toHaveBeenCalledTimes(1);
  });

  it("loads again for a replacement editor DOM", async () => {
    mock.get.mockResolvedValue(catalog);
    await loadPermissionCatalog();
    document.getElementById("role-module-panes")!.outerHTML = '<div id="role-module-panes"></div>';
    await loadPermissionCatalog();
    expect(mock.get).toHaveBeenCalledTimes(2);
    expect(document.querySelector("input[name='perm-action']")).not.toBeNull();
  });

  it("does not render a catalog from a previous server", async () => {
    const response = deferred<any>();
    mock.get.mockReturnValue(response.promise);
    const loading = loadPermissionCatalog();
    mock.scope = "server-b";
    response.resolve(catalog);
    await loading;
    expect(document.getElementById("role-module-panes")!.children.length).toBe(0);
  });

  it("retries after returning to a server whose pending catalog was discarded", async () => {
    const response = deferred<any>();
    mock.get.mockReturnValueOnce(response.promise).mockResolvedValue(catalog);
    const loading = loadPermissionCatalog();
    mock.scope = "server-b";
    response.resolve(catalog);
    await loading;
    mock.scope = "server-a";
    await loadPermissionCatalog();
    expect(mock.get).toHaveBeenCalledTimes(2);
    expect(document.querySelector("input[name='perm-action']")).not.toBeNull();
  });
});
