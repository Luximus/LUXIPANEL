import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { archiveDeliveryScript, archiveListScript, archivePurgeScript } from "./archive.service.js";

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe("Maildir archive delivery", () => {
  it("writes a separate message, lists it, and purges only after retention", () => {
    const root = mkdtempSync(join(tmpdir(), "luxipanel-archive-test-"));
    dirs.push(root);
    const raw = Buffer.from("From: Alice <alice@example.com>\r\nTo: Bob <bob@example.com>\r\nSubject: archived\r\n\r\nbody\r\n");
    const delivery = archiveDeliveryScript.replace(JSON.stringify("/var/lib/luxipanel/mail-archive"), JSON.stringify(root));
    const result = spawnSync("python3", ["-c", delivery, "in--example.com@archive.luxipanel.invalid"], { input: raw });
    expect(result.status, result.stderr.toString()).toBe(0);
    const newDir = join(root, "example.com", "incoming", "Maildir", "new");
    const filename = readdirSync(newDir)[0]!;
    expect(readFileSync(join(newDir, filename))).toEqual(raw);
    const listed = spawnSync("python3", ["-c", archiveListScript, root, "example.com", "incoming", "10"]);
    expect(listed.status, listed.stderr.toString()).toBe(0);
    expect(JSON.parse(listed.stdout.toString())[0].subject).toBe("archived");

    const config = join(root, "retention.json");
    writeFileSync(config, JSON.stringify({ "example.com": 1 }));
    const purge = archivePurgeScript
      .replace(JSON.stringify("/var/lib/luxipanel/mail-archive"), JSON.stringify(root))
      .replace(JSON.stringify("/etc/luxipanel/mail-archive-retention.json"), JSON.stringify(config));
    const recent = spawnSync("python3", ["-c", purge]);
    expect(recent.status, recent.stderr.toString()).toBe(0);
    expect(statSync(join(newDir, filename)).size).toBe(raw.length);
    const old = new Date(Date.now() - 3 * 86400_000);
    utimesSync(join(newDir, filename), old, old);
    const expired = spawnSync("python3", ["-c", purge]);
    expect(expired.status, expired.stderr.toString()).toBe(0);
    expect(readdirSync(newDir)).toHaveLength(0);
  });
});
