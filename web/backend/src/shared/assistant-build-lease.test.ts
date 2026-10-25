import { describe, expect, it } from "vitest";
import { isBuildOrDeployCommand, withAssistantBuildLease } from "./assistant-build-lease.js";

describe("assistant build lease", () => {
  it("reserves actual build and restart commands but leaves diagnostics concurrent", () => {
    expect(isBuildOrDeployCommand("pnpm run build && pm2 restart app")).toBe(true);
    expect(isBuildOrDeployCommand("astro build")).toBe(true);
    expect(isBuildOrDeployCommand("pnpm -C web/frontend build")).toBe(true);
    expect(isBuildOrDeployCommand("docker compose build")).toBe(true);
    expect(isBuildOrDeployCommand("sudo systemctl restart nginx")).toBe(true);
    expect(isBuildOrDeployCommand("free -h")).toBe(false);
  });
  it("wraps a build in the target-side lease runner", () => {
    expect(withAssistantBuildLease("pnpm build")).toContain("python3 -c");
  });
});
