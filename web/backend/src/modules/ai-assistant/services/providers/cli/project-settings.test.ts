import { describe, expect, it } from "vitest";
import { codexProjectOverrides } from "./project-settings.js";
it("loads native preferences without overriding run policy or protected channels", () => {
  expect(codexProjectOverrides({ model: "test", approval_policy: "never", sandbox_mode: "danger-full-access", features: { example: true }, mcp_servers: { "luxipanel-modules": { url: "wrong" }, "codebase-graph": { command: "wrong" }, external: { url: "https://example.test" } } })).toEqual({ model: "test", "features.example": true, "mcp_servers.external.url": "https://example.test" });
});
