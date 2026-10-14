// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT

// Tests del store module-level de llaves SSH (fase B4, dominio SSH).
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/client", () => ({
  getSshKeys: vi.fn(),
}));

import { getSshKeys as fetchSshKeys, type SshKeySummary } from "../../api/client";
import {
  __resetSshKeysForTests,
  applySshKeyCreated,
  applySshKeyDeleted,
  applySshKeyUpdated,
  getKeysAttachedToPanel,
  getSshKeys,
  refreshSshKeys,
} from "./ssh-keys-store";

const fetchMock = vi.mocked(fetchSshKeys);

const key = (id: string, extra: Partial<SshKeySummary> = {}): SshKeySummary =>
  ({ id, linuxUsername: "root", ...extra }) as SshKeySummary;

beforeEach(() => {
  __resetSshKeysForTests();
  fetchMock.mockReset();
});

describe("refreshSshKeys", () => {
  it("carga la lista desde la API", async () => {
    fetchMock.mockResolvedValueOnce([key("a"), key("b")]);
    await refreshSshKeys("tok");
    expect(fetchMock).toHaveBeenCalledWith("tok");
    expect(getSshKeys().map((k) => k.id)).toEqual(["a", "b"]);
  });

  it("un fallo de red conserva la lista vigente (no lanza)", async () => {
    fetchMock.mockResolvedValueOnce([key("a")]);
    await refreshSshKeys("tok");
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new Error("net"));
    await expect(refreshSshKeys("tok")).resolves.toBeUndefined();
    errSpy.mockRestore();
    expect(getSshKeys().map((k) => k.id)).toEqual(["a"]);
  });
});

describe("mutadores locales", () => {
  it("created añade, o reemplaza si el id ya existe", () => {
    applySshKeyCreated(key("a"));
    applySshKeyCreated(key("b"));
    applySshKeyCreated(key("a", { linuxUsername: "deploy" }));
    expect(getSshKeys().map((k) => k.id)).toEqual(["a", "b"]);
    expect(getSshKeys()[0].linuxUsername).toBe("deploy");
  });

  it("updated reemplaza por id y deleted la quita", () => {
    applySshKeyCreated(key("a"));
    applySshKeyUpdated(key("a", { linuxUsername: "admin" }));
    expect(getSshKeys()[0].linuxUsername).toBe("admin");
    applySshKeyDeleted("a");
    expect(getSshKeys()).toEqual([]);
  });
});

describe("getKeysAttachedToPanel", () => {
  it("filtra por panelIds y tolera llaves sin panelIds", () => {
    applySshKeyCreated(key("a", { panelIds: ["p1", "p2"] }));
    applySshKeyCreated(key("b", { panelIds: ["p2"] }));
    applySshKeyCreated(key("c"));
    expect(getKeysAttachedToPanel("p1").map((k) => k.id)).toEqual(["a"]);
    expect(getKeysAttachedToPanel("p2").map((k) => k.id)).toEqual(["a", "b"]);
    expect(getKeysAttachedToPanel("p3")).toEqual([]);
  });
});
