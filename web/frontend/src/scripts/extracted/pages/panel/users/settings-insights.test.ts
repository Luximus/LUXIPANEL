import { describe, expect, it } from "vitest";
import { csvCell, summarizeVisibleUsers } from "./settings-insights";

describe("Users settings insights", () => {
  it("restricts access rows and counts to users visible to the caller", () => {
    const summary = summarizeVisibleUsers(
      [{ username: "tenant", enabled: true }, { username: "locked", enabled: false }],
      {
        tenant: { online: true, connections: 2, lastLogin: "2026-09-26T12:00:00Z" },
        locked: { online: false, connections: 0, lastLogin: null },
        outsider: { online: true, connections: 4, lastLogin: "2026-09-26T13:00:00Z" },
      },
    );
    expect(summary).toMatchObject({ users: 2, locked: 1, connections: 2 });
    expect(summary.recent.map((row) => row.username)).toEqual(["tenant"]);
  });

  it("quotes CSV cells and prevents formula execution", () => {
    expect(csvCell('=IMPORTXML("url")')).toBe('"\'=IMPORTXML(""url"")"');
    expect(csvCell("  +SUM(1,2)")).toBe('"\'  +SUM(1,2)"');
  });
});
