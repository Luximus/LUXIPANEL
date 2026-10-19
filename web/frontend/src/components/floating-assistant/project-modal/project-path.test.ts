import { describe, expect, it } from "vitest";
import { isProjectPathWithinRoot } from "./project-path";

describe("subproject directory scope", () => {
  it.each([
    ["/var/www/panel/mobile", true],
    ["/var/www/panel/web/frontend", true],
    ["/var/www/panel", true],
    ["/var/www/panel/", true],
    ["/var/www/panel//web/./frontend", true],
    ["/var/www/panel/web/../mobile", true],
    ["/var/www/panel/../other", false],
    ["/var/www/panel-old", false],
    ["/var/www/other/mobile", false],
    ["/var/www", false],
    ["/var/www/PANEL/mobile", false],
    ["", false],
    ["mobile", false],
    ["/var/www/panel/\0", false],
  ])("filters %s (%s)", (path, expected) => {
    expect(isProjectPathWithinRoot(path, "/var/www/panel/")).toBe(expected);
  });
  it("does not offer projects before a working directory is selected", () => {
    expect(isProjectPathWithinRoot("/var/www/panel", "")).toBe(false);
    expect(isProjectPathWithinRoot("/var/www/panel", "var/www")).toBe(false);
  });
  it("handles the filesystem root and normalized parent paths", () => {
    expect(isProjectPathWithinRoot("/var/www/panel", "/")).toBe(true);
    expect(isProjectPathWithinRoot("/var/www/panel/mobile", "/var/www/./panel/web/..")).toBe(true);
  });
});
