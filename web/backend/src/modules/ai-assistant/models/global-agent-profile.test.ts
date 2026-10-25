import { describe, expect, it } from "vitest";
import { canonicalManifest, globalAgentManifestSchema, mergeProfileUpdate, publicProfileIssues } from "./global-agent-profile.js";

const profile = () => globalAgentManifestSchema.parse({
  schemaVersion: 1, name: "API specialist", description: "Builds APIs", specialty: "Backend",
  technologies: ["TypeScript"], knowledge: "HTTP", systemPrompt: "Explain decisions.",
  allowedTools: ["files.read"], avatarConfig: { seed: "a81b988b-10ac-421a-83b6-b2b103809dfe" },
});
describe("portable agent contract", () => {
  it.each(["providerId", "model", "teamId", "parentAgentId", "projectPaths", "projectIds", "servers", "credential", "skills", "ownerId", "assignments"])("rejects private field %s", field => {
    expect(globalAgentManifestSchema.safeParse({ ...profile(), [field]: "private" }).success).toBe(false);
  });
  it("rejects nested extra fields and retains tools and a safe generated avatar", () => {
    expect(globalAgentManifestSchema.safeParse({ ...profile(), avatarConfig: { seed: "safe", secret: "private" } }).success).toBe(false);
    expect(publicProfileIssues(profile())).toEqual([]);
    expect(profile().allowedTools).toEqual(["files.read"]);
  });
  it.each(["/var/www/private-app/config", "/home/person/project", "password=fixture-password", "-----BEGIN PRIVATE KEY-----"])("flags private prose: %s", text => {
    expect(publicProfileIssues({ ...profile(), knowledge: text }).length).toBeGreaterThan(0);
  });
  it("preserves edited knowledge/tools but updates unchanged general fields", () => {
    const previous = profile();
    const current = { ...previous, knowledge: "Private project knowledge", allowedTools: [] };
    const incoming = { ...previous, name: "New name", knowledge: "New knowledge", allowedTools: null };
    const result = mergeProfileUpdate(current, previous, incoming);
    expect(result.manifest).toMatchObject({ name: "New name", knowledge: "Private project knowledge", allowedTools: [] });
    expect(result.preserved).toEqual(["knowledge", "allowedTools"]);
  });
  it("ignores object key order and clears an unmodified optional avatar", () => {
    const previous = { ...profile(), avatarConfig: { seed: "safe", top: "hat" } };
    const reordered = { ...previous, avatarConfig: { top: "hat", seed: "safe" } };
    expect(canonicalManifest(previous)).toBe(canonicalManifest(reordered));
    expect(mergeProfileUpdate(reordered, previous, { ...profile(), avatarConfig: {} }).manifest.avatarConfig).toEqual({});
  });
});
