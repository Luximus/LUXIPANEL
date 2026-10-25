import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("../../../shared/github/public-api.js", () => ({ CANONICAL_GITHUB: "/repos/Luxisoft/LUXIPANEL", publicGithub: vi.fn() }));
vi.mock("../../../config/env.js", () => ({ env: { LOG_LEVEL: "silent", NODE_ENV: "test" } }));
import { publicGithub } from "../../../shared/github/public-api.js";
import { releaseBranches, releaseBranchDetails, verifyBranchRevision } from "./release-branches.service.js";
const sha = "a".repeat(40), base = "b".repeat(40);
beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.unstubAllGlobals());
it("compares exact branch heads and does not mark an older branch as new", async () => {
  vi.mocked(publicGithub).mockImplementation(async route => route.includes("/branches?") ? [
    { name: "developer", commit: { sha } }, { name: "main", commit: { sha: base } }, { name: "untrusted", commit: { sha } },
  ] : { ahead_by: 3, behind_by: 0 });
  const result = await releaseBranches(base);
  expect(result.branches).toEqual([{ name: "main", commit: base, ahead: 0, updateAvailable: false }, { name: "developer", commit: sha, ahead: 3, updateAvailable: true }]);
  expect(publicGithub).toHaveBeenCalledWith(`/repos/Luxisoft/LUXIPANEL/compare/${base}...${sha}`);
});
it("does not advertise an update when comparison fails", async () => {
  vi.mocked(publicGithub).mockImplementation(async route => { if (route.includes("/branches?")) return [{ name: "developer", commit: { sha } }]; throw new Error("offline"); });
  const result = await releaseBranches(base); expect(result.branches[0]?.updateAvailable).toBe(false); expect(result.branches[0]?.error).toBeTruthy();
});
it("loads history for the selected SHA and detects component-only branches", async () => {
  vi.mocked(publicGithub).mockImplementation(async route => route.includes("/branches?") ? [{ name: "mobile", commit: { sha } }] : route.includes("/commits?") ? [{ sha, commit: { message: "Fix mobile", author: { name: "Author", date: "2026-10-16" } } }] : []);
  const details = await releaseBranchDetails("mobile", sha);
  expect(details.installable).toBe(false); expect(details.commits[0]?.url).toBe(`https://github.com/Luxisoft/LUXIPANEL/commit/${sha}`);
  expect(publicGithub).toHaveBeenCalledWith(`/repos/Luxisoft/LUXIPANEL/commits?sha=${sha}&per_page=30`);
});
it.each([["../main", sha], ["developer", "--upload-pack=bad"], ["developer;id", sha]])("rejects invalid branch selections before network access", async (branch, commit) => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  await expect(verifyBranchRevision(branch, commit, base)).rejects.toThrow(); expect(fetch).not.toHaveBeenCalled();
});
it("revalidates mutations without the catalog cache and rejects an advanced branch", async () => {
  const fetch = vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes("/compare/") ? { ahead_by: 1, behind_by: 0 } : { commit: { sha: base } } })); vi.stubGlobal("fetch", fetch);
  await expect(verifyBranchRevision("developer", sha, base)).rejects.toMatchObject({ statusCode: 409, code: "RELEASE_BRANCH_CHANGED" });
  expect(publicGithub).toHaveBeenCalledExactlyOnceWith("/repos/Luxisoft/LUXIPANEL/branches?per_page=100", { maxAgeMs: 300000, fresh: true });
  await expect(verifyBranchRevision("developer", base, sha)).resolves.toBeUndefined();
});

it("requests live branch heads when the user refreshes the catalog", async () => {
  vi.mocked(publicGithub).mockResolvedValue([{ name: "developer", commit: { sha } }]);
  expect((await releaseBranches(sha, true)).branches[0]?.commit).toBe(sha);
  expect(publicGithub).toHaveBeenCalledExactlyOnceWith("/repos/Luxisoft/LUXIPANEL/branches?per_page=100", { maxAgeMs: 300000, fresh: true });
});

it("does not describe an invalid GitHub response as a new revision", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ commit: {} }) }));
  await expect(verifyBranchRevision("developer", sha, base)).rejects.toMatchObject({ statusCode: 503 });
});

it("does not label an unavailable contents check as a component-only branch", async () => {
  vi.mocked(publicGithub).mockImplementation(async route => {
    if (route.includes("/branches?")) return [{ name: "developer", commit: { sha } }];
    if (route.includes("/commits?")) return [];
    throw new Error("network unavailable");
  });
  await expect(releaseBranchDetails("developer", sha)).rejects.toThrow("No se pudo comprobar");
});

it("returns authored update notes and never invents notes from an internal commit title", async () => {
  const note = { title: "Avisos de actualización", changes: ["El botón muestra solo mejoras pendientes de instalar."] };
  vi.mocked(publicGithub).mockImplementation(async route => {
    if (route.includes("/branches?")) return [{ name: "developer", commit: { sha } }];
    if (route.includes("/commits?")) return [
      { sha, commit: { message: "Update\nLUXIPANEL-NOTES-BEGIN\n" + JSON.stringify([note]) + "\nLUXIPANEL-NOTES-END", author: { name: "Author", date: "2026-10-16" } } },
      { sha: base, commit: { message: "chore: cambios del asistente private-task", author: { name: "Author", date: "2026-10-15" } } }
    ];
    return [];
  });
  const result = await releaseBranchDetails("developer", sha);
  expect(result.notes).toEqual([{ ...note, id: sha + ":0", date: "2026-10-16" }]);
  expect(result.notesIncomplete).toBe(true);
  expect(JSON.stringify(result.notes)).not.toContain("private-task");
});
it("uses reviewed historical descriptions only for exact commits in the selected branch", async () => {
  const known = "def82b35ca0555f7882a460fca0a22de224cd4b9";
  vi.mocked(publicGithub).mockImplementation(async route => {
    if (route.includes("/branches?")) return [{ name: "main", commit: { sha } }];
    if (route.includes("/commits?")) return [{ sha: known, commit: { message: "chore: cambios del asistente", author: { name: "Author", date: "2026-10-16" } } }];
    return [];
  });
  const result = await releaseBranchDetails("main", sha);
  expect(result.notes).toHaveLength(1);
  expect(result.notes[0]?.title).toBe("Avisos centrados en las actualizaciones");
  expect(result.notesIncomplete).toBe(false);
});
it("shows the reviewed notes for the deployed revisions that predate commit metadata", async () => {
  const globalProfiles = "335beabe6f4c186171c380fc67a450703fcd9d65";
  const luxisoftWorkspace = "c6285e342eac7fca5d67dd25515c9a7eb926c9cb";
  const providerFallback = "a66898ae4b45d80ccc4d33e1bf6fa843b242db7e";
  vi.mocked(publicGithub).mockImplementation(async route => {
    if (route.includes("/branches?")) return [{ name: "developer", commit: { sha: globalProfiles } }];
    if (route.includes("/commits?")) return [globalProfiles, luxisoftWorkspace, providerFallback].map((sha, index) => ({ sha, commit: { message: "chore: deployed change", author: { name: "Author", date: `2026-10-${25 - index}` } } }));
    return [];
  });
  const result = await releaseBranchDetails("developer", globalProfiles);
  expect(result.notes.map(note => note.title)).toEqual([
    "Perfiles globales y agentes privados por proyecto",
    "Más agentes IA con control de RAM",
    "Agentes IA con acceso al proyecto Luxisoft",
    "Modelos disponibles y continuidad del chat",
  ]);
  expect(result.notesIncomplete).toBe(false);
});

it.each([{ ahead_by: 0, behind_by: 4 }, { ahead_by: 2, behind_by: 4 }])("does not advertise a backward or divergent branch: %j", async comparison => {
  vi.mocked(publicGithub).mockImplementation(async route => route.includes("/branches?") ? [{ name: "main", commit: { sha } }] : comparison);
  const result = await releaseBranches(base);
  expect(result.branches[0]?.updateAvailable).toBe(false);
});
it.each([
  { ahead_by: 0, behind_by: 4 }, { ahead_by: 2, behind_by: 4 },
  { ahead_by: 0, behind_by: 0 }, { ahead_by: 2 }, { ahead_by: -1, behind_by: 0 },
])("blocks unsafe or unverifiable installation without cached comparisons: %j", async comparison => {
  const fetch = vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes("/compare/") ? comparison : { commit: { sha } } }));
  vi.stubGlobal("fetch", fetch);
  await expect(verifyBranchRevision("main", sha, base)).rejects.toThrow();
  expect(fetch).toHaveBeenCalledTimes(2); expect(publicGithub).not.toHaveBeenCalled();
});
it.each([undefined, "unknown", sha])("blocks an unknown or already installed revision: %s", async installed => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  await expect(verifyBranchRevision("developer", sha, installed)).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
it("does not install when the live comparison cannot be reached", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ commit: { sha } }) }).mockRejectedValueOnce(new Error("offline")));
  await expect(verifyBranchRevision("developer", sha, base)).rejects.toThrow("no se ha iniciado");
});
