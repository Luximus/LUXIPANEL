// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Unit tests — cron/services/cron-parser.service.ts
 *
 * CHARACTERIZATION: these tests pin the PURE parser/validator/describe logic and
 * the managed-line build/round-trip, plus the executor WRITE path (via a fake
 * Executor). They are the safety net for the execSync-local → executor
 * migration: the parsers/contract are unchanged; only the I/O boundary moved.
 */

import { describe, it, expect, vi } from "vitest";
import type { Executor } from "../../../shared/executor/index.js";
import { cronParserService } from "./cron-parser.service.js";

/**
 * In-memory fake crontab executor. Simulates `crontab -l` (read), staged tmp
 * files via `writeFile`, `crontab <tmp>` (install) and `unlink`. Captures every
 * exec command and writeFile payload so tests can assert the crontab body is
 * written BYTE-FOR-BYTE over SFTP — never interpolated into a shell string.
 */
function makeFakeCrontabExecutor(initial = "") {
  const files = new Map<string, string>();
  let current = initial;
  const execCalls: string[] = [];
  const writes: Array<{ path: string; data: string }> = [];
  const unlinks: string[] = [];
  const tmpRe = /\/tmp\/\.lxp-cron-[\w.-]+/;

  const executor = {
    target: { id: "local", name: "Local" },
    async exec(cmd: string) {
      execCalls.push(cmd);
      const m = tmpRe.exec(cmd);
      if (/crontab/.test(cmd) && m) {
        // Install: `crontab <tmp>` promotes the staged file to the crontab.
        current = files.get(m[0]) ?? "";
        return { stdout: "", stderr: "", exitCode: 0, durationMs: 0 };
      }
      if (/crontab/.test(cmd)) {
        // Read: `crontab -l` returns the current crontab body.
        return { stdout: current, stderr: "", exitCode: 0, durationMs: 0 };
      }
      return { stdout: "", stderr: "", exitCode: 0, durationMs: 0 };
    },
    async writeFile(path: string, data: string | Buffer) {
      const s = typeof data === "string" ? data : data.toString("utf-8");
      files.set(path, s);
      writes.push({ path, data: s });
    },
    async unlink(path: string) {
      files.delete(path);
      unlinks.push(path);
    },
  } as unknown as Executor;

  return {
    executor,
    execCalls,
    writes,
    unlinks,
    get current() {
      return current;
    },
  };
}

describe("cronParserService.validate", () => {
  it("accepts valid 5-field expressions", () => {
    const cases = [
      "* * * * *",
      "0 2 * * *",
      "*/5 * * * *",
      "0 0 1 1 *",
      "30 18 * * 1-5",
      "0 */6 * * *",
    ];
    for (const expr of cases) {
      const result = cronParserService.validate(expr);
      expect(result.valid, `Expected valid: "${expr}"`).toBe(true);
    }
  });

  it("rejects expressions with wrong field count", () => {
    expect(cronParserService.validate("* * * *").valid).toBe(false);
    expect(cronParserService.validate("* * * * * * *").valid).toBe(false);
  });

  it("rejects out-of-range minute values", () => {
    const result = cronParserService.validate("60 * * * *");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/rango|range/);
  });

  it("accepts @aliases", () => {
    for (const a of ["@daily", "@hourly", "@weekly", "@reboot", "@monthly"]) {
      expect(cronParserService.validate(a).valid, a).toBe(true);
    }
  });

  it("accepts range-with-step syntax", () => {
    expect(cronParserService.validate("0 9-17/2 * * 1-5").valid).toBe(true);
  });

  it("rejects out-of-range hour values", () => {
    const result = cronParserService.validate("0 24 * * *");
    expect(result.valid).toBe(false);
  });

  it("rejects out-of-range day-of-month", () => {
    const result = cronParserService.validate("0 0 32 * *");
    expect(result.valid).toBe(false);
  });

  it("rejects out-of-range month", () => {
    const result = cronParserService.validate("0 0 * 13 *");
    expect(result.valid).toBe(false);
  });

  it("rejects out-of-range day-of-week", () => {
    const result = cronParserService.validate("0 0 * * 8");
    expect(result.valid).toBe(false);
  });

  it("accepts step syntax */N", () => {
    expect(cronParserService.validate("*/15 */2 * * *").valid).toBe(true);
  });

  it("accepts range syntax in fields", () => {
    expect(cronParserService.validate("0 9-17 * * 1-5").valid).toBe(true);
  });
});

describe("cronParserService._parse (internal helper)", () => {
  const mockCrontab = `
# Daily backup
0 2 * * * /usr/local/bin/backup.sh # backup

# Every 5 minutes
*/5 * * * * /usr/local/bin/healthcheck.sh

0 0 * * 0 /usr/local/bin/weekly.sh
`.trim();

  it("parses standard crontab lines into CronJob objects", () => {
    const jobs = cronParserService._parse(mockCrontab, "root");
    expect(jobs).toHaveLength(3);
  });

  it("extracts schedule and command", () => {
    const jobs = cronParserService._parse(mockCrontab, "root");
    expect(jobs[0]?.schedule).toBe("0 2 * * *");
    expect(jobs[0]?.command).toBe("/usr/local/bin/backup.sh");
  });

  it("assigns stable IDs", () => {
    const jobs = cronParserService._parse(mockCrontab, "root");
    for (const job of jobs) {
      expect(typeof job.id).toBe("string");
      expect(job.id.length).toBeGreaterThan(0);
    }
  });

  it("assigns the user to each job", () => {
    const jobs = cronParserService._parse(mockCrontab, "admin");
    for (const job of jobs) {
      expect(job.user).toBe("admin");
    }
  });

  it("skips blank lines and standalone comments", () => {
    const raw = `\n\n# Just a comment\n\n* * * * * echo hello`;
    const jobs = cronParserService._parse(raw, "root");
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.command).toBe("echo hello");
  });

  it("returns empty array for empty crontab", () => {
    expect(cronParserService._parse("", "root")).toHaveLength(0);
  });

  it("keeps alias schedules and separates identical external entries", () => {
    const raw = "@daily /home/alice/backup.sh\n@daily /home/alice/backup.sh\n";
    const jobs = cronParserService._parse(raw, "alice");
    expect(jobs.map((job) => job.schedule)).toEqual(["@daily", "@daily"]);
    expect(jobs[0]?.command).toBe("/home/alice/backup.sh");
    expect(jobs[0]?.id).not.toBe(jobs[1]?.id);
    const removed = cronParserService.buildRemove(raw, "alice", jobs[1]!.id);
    expect(cronParserService._parse(removed.content, "alice")).toHaveLength(1);
  });
});

describe("cronParserService.describe", () => {
  it("describes common shapes", () => {
    expect(cronParserService.describe("* * * * *")).toBe("Cada minuto");
    expect(cronParserService.describe("@daily")).toMatch(/medianoche/);
    expect(cronParserService.describe("0 3 * * *")).toMatch(/03:00/);
    expect(cronParserService.describe("0 3 * * 1")).toMatch(/lunes/);
    expect(cronParserService.describe("0 0 15 * *")).toMatch(/día 15/);
  });
});

describe("cronParserService managed round-trip (build/update/toggle/remove)", () => {
  it("uses a user's wrapper and preserves it across edits and pauses", () => {
    const wrapper = "/home/alice/.local/libexec/luxipanel/lxp-cron-run";
    const added = cronParserService.buildAdd("", "@daily", "/home/alice/task.sh", "daily", wrapper);
    expect(cronParserService._parse(added.content, "alice")[0]?.wrapperPath).toBe(wrapper);
    const edited = cronParserService.buildUpdate(added.content, "alice", added.jobId, "0 4 * * *", "/home/alice/new.sh", "new");
    const paused = cronParserService.buildToggle(edited.content, "alice", added.jobId);
    expect(cronParserService._parse(paused.content, "alice")[0]).toMatchObject({ wrapperPath: wrapper, enabled: false, command: "/home/alice/new.sh" });
  });
  it("adds a wrapped job and parses it back with the original command", () => {
    const { content, jobId } = cronParserService.buildAdd("", "0 3 * * *", "/opt/x.sh --flag", "nightly");
    const jobs = cronParserService._parse(content, "root");
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.id).toBe(jobId);
    expect(jobs[0]?.command).toBe("/opt/x.sh --flag");
    expect(jobs[0]?.comment).toBe("nightly");
    expect(jobs[0]?.enabled).toBe(true);
    expect(jobs[0]?.managed).toBe(true);
  });

  it("toggles a job to paused and back, keeping a stable id", () => {
    const { content, jobId } = cronParserService.buildAdd("", "0 3 * * *", "/opt/x.sh", null);
    const off = cronParserService.buildToggle(content, "root", jobId);
    expect(off.changed).toBe(true);
    expect(off.enabled).toBe(false);
    const paused = cronParserService._parse(off.content, "root");
    expect(paused[0]?.id).toBe(jobId);
    expect(paused[0]?.enabled).toBe(false);

    const on = cronParserService.buildToggle(off.content, "root", jobId);
    expect(on.enabled).toBe(true);
    expect(cronParserService._parse(on.content, "root")[0]?.enabled).toBe(true);
  });

  it("updates schedule/command by id", () => {
    const { content, jobId } = cronParserService.buildAdd("", "0 3 * * *", "/opt/x.sh", null);
    const upd = cronParserService.buildUpdate(content, "root", jobId, "*/5 * * * *", "/opt/y.sh", "edited");
    expect(upd.changed).toBe(true);
    const jobs = cronParserService._parse(upd.content, "root");
    expect(jobs[0]?.id).toBe(jobId);
    expect(jobs[0]?.schedule).toBe("*/5 * * * *");
    expect(jobs[0]?.command).toBe("/opt/y.sh");
  });

  it("removes a job by id", () => {
    const { content, jobId } = cronParserService.buildAdd("", "0 3 * * *", "/opt/x.sh", null);
    const rem = cronParserService.buildRemove(content, "root", jobId);
    expect(rem.changed).toBe(true);
    expect(cronParserService._parse(rem.content, "root")).toHaveLength(0);
  });

  it("normalizes a 6-field schedule to 5 fields so the managed line isn't corrupted", () => {
    // 6-field "30 0 3 * * *" (leading seconds): the system crontab has no
    // seconds field — emitting it verbatim would shift the wrapper/jobId/b64
    // tokens. The managed line must drop the seconds and round-trip cleanly.
    const { content, jobId } = cronParserService.buildAdd("", "30 0 3 * * *", "/opt/x.sh --flag", "sixfield");
    const jobs = cronParserService._parse(content, "root");
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.id).toBe(jobId);
    expect(jobs[0]?.schedule).toBe("0 3 * * *");
    expect(jobs[0]?.command).toBe("/opt/x.sh --flag");
    expect(jobs[0]?.comment).toBe("sixfield");
    expect(jobs[0]?.managed).toBe(true);
  });

  it("appends to an EXISTING multi-line crontab, preserving every prior line", () => {
    const existing = [
      "# header comment",
      "0 2 * * * /usr/local/bin/backup.sh # backup",
      "",
      "*/5 * * * * /usr/local/bin/healthcheck.sh",
    ].join("\n");
    const { content } = cronParserService.buildAdd(existing, "0 4 * * *", "/opt/new.sh", "added");
    // The header comment and both legacy lines survive verbatim.
    expect(content).toContain("# header comment");
    expect(content).toContain("/usr/local/bin/backup.sh");
    expect(content).toContain("/usr/local/bin/healthcheck.sh");
    // Now three job lines: 2 legacy + 1 managed.
    const jobs = cronParserService._parse(content, "root");
    expect(jobs).toHaveLength(3);
    expect(jobs.filter((j) => j.managed)).toHaveLength(1);
  });

  it("updates/removes only the targeted job in a mixed crontab, leaving others intact", () => {
    const base = cronParserService.buildAdd("30 1 * * * /legacy/keep.sh # keep", "0 3 * * *", "/opt/a.sh", "a");
    const two = cronParserService.buildAdd(base.content, "0 5 * * *", "/opt/b.sh", "b");
    // Update job a; job b and the legacy line are untouched.
    const upd = cronParserService.buildUpdate(two.content, "root", base.jobId, "*/10 * * * *", "/opt/a2.sh", "a2");
    expect(upd.changed).toBe(true);
    const afterUpd = cronParserService._parse(upd.content, "root");
    expect(afterUpd).toHaveLength(3);
    expect(afterUpd.find((j) => j.id === base.jobId)?.command).toBe("/opt/a2.sh");
    expect(afterUpd.find((j) => j.command === "/legacy/keep.sh")).toBeTruthy();
    // Remove job a; b + legacy remain.
    const rem = cronParserService.buildRemove(upd.content, "root", base.jobId);
    const afterRem = cronParserService._parse(rem.content, "root");
    expect(afterRem).toHaveLength(2);
    expect(afterRem.find((j) => j.id === base.jobId)).toBeUndefined();
  });
});

describe("cronParserService account selection", () => {
  it("uses an explicit Linux account for privileged reads and writes", async () => {
    const fake = makeFakeCrontabExecutor();
    await cronParserService.addWithExecutor("@daily", "/home/alice/task.sh", null, "alice", fake.executor, { direct: false, wrapperPath: "/home/alice/.local/libexec/luxipanel/lxp-cron-run" });
    expect(fake.execCalls.some((cmd) => cmd.includes("sudo 'crontab' '-u' 'alice' '-l'"))).toBe(true);
    expect(fake.execCalls.some((cmd) => cmd.includes("sudo 'crontab' '-u' 'alice' '/tmp/.lxp-cron-"))).toBe(true);
  });

  it("runs crontab directly when the executor is already the account owner", async () => {
    const fake = makeFakeCrontabExecutor();
    await cronParserService.listWithExecutor("alice", fake.executor, { direct: true });
    expect(fake.execCalls[0]).toBe("crontab '-l'");
  });
});

describe("cronParserService — special-char / injection neutralization (base64 wrapper)", () => {
  const nasty = [
    `/opt/x.sh --msg "hello world" # not-a-comment`,
    `/bin/sh -c 'echo $HOME; rm -rf /tmp/x'`,
    `echo a && echo b || echo c`,
    `printf 'line1\nline2\n'`, // embedded newline
    `/opt/y.sh $(whoami) \`id\``,
    `cmd 'with '\\''quotes'\\'' inside'`,
  ];

  it.each(nasty)("round-trips command %# through the managed line intact", (command) => {
    const { content, jobId } = cronParserService.buildAdd("", "0 3 * * *", command, "c");
    // The command is base64-encoded → a SINGLE token → cannot spawn extra
    // crontab lines nor shift the schedule/wrapper/jobId columns.
    const jobs = cronParserService._parse(content, "root");
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.id).toBe(jobId);
    expect(jobs[0]?.command).toBe(command);
    expect(jobs[0]?.managed).toBe(true);
  });

  it("a command containing ' # ' is NOT mistaken for a comment", () => {
    const { content } = cronParserService.buildAdd("", "0 3 * * *", "/opt/x.sh # inline", "real-comment");
    const jobs = cronParserService._parse(content, "root");
    expect(jobs[0]?.command).toBe("/opt/x.sh # inline");
    expect(jobs[0]?.comment).toBe("real-comment");
  });
});

describe("cronParserService.writeWithExecutor (executor write path — no shell-out)", () => {
  it("stages the FULL multi-line body over SFTP and installs it with `crontab <tmp>`", async () => {
    const body = "# hdr\n0 2 * * * /a.sh\n*/5 * * * * /b.sh\n";
    const fake = makeFakeCrontabExecutor();
    await cronParserService.writeWithExecutor(body, "root", fake.executor);

    // The crontab body is written BYTE-FOR-BYTE via writeFile (SFTP), never
    // interpolated into an `echo '…' | crontab -` shell string.
    expect(fake.writes).toHaveLength(1);
    expect(fake.writes[0]?.data).toBe(body); // already ends with \n
    // Install command references the tmp path and `crontab`; no `echo`, and the
    // body never appears inside any exec command (no shell interpolation).
    const install = fake.execCalls.find((c) => /crontab/.test(c) && /lxp-cron/.test(c));
    expect(install).toBeTruthy();
    expect(install).toContain("crontab");
    for (const c of fake.execCalls) {
      expect(c).not.toContain("echo");
      expect(c).not.toContain("/a.sh"); // crontab content never rides in argv
    }
    // Tmp file is cleaned up.
    expect(fake.unlinks).toHaveLength(1);
  });

  it("appends a trailing newline when the body lacks one", async () => {
    const fake = makeFakeCrontabExecutor();
    await cronParserService.writeWithExecutor("0 2 * * * /a.sh", "root", fake.executor);
    expect(fake.writes[0]?.data).toBe("0 2 * * * /a.sh\n");
  });

  it("throws when the crontab install exits non-zero (surfaces crontab errors)", async () => {
    const fake = makeFakeCrontabExecutor();
    // Force the install step to fail.
    vi.spyOn(fake.executor, "exec").mockResolvedValue({ stdout: "", stderr: "bad cron", exitCode: 1, durationMs: 0 });
    await expect(cronParserService.writeWithExecutor("x\n", "root", fake.executor)).rejects.toThrow(/crontab install failed/);
  });
});

describe("cronParserService executor round-trip (add/list/toggle/remove via fake crontab)", () => {
  it("adds through the executor and lists it back with the original command", async () => {
    const fake = makeFakeCrontabExecutor();
    const jobId = await cronParserService.addWithExecutor("0 3 * * *", "/opt/deploy.sh --now", "nightly", "root", fake.executor);
    const jobs = await cronParserService.listWithExecutor("root", fake.executor);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.id).toBe(jobId);
    expect(jobs[0]?.command).toBe("/opt/deploy.sh --now");
    expect(jobs[0]?.enabled).toBe(true);
  });

  it("toggles paused/resumed and removes through the executor", async () => {
    const fake = makeFakeCrontabExecutor();
    const jobId = await cronParserService.addWithExecutor("0 3 * * *", "/opt/x.sh", null, "root", fake.executor);

    const off = await cronParserService.toggleWithExecutor(jobId, "root", fake.executor);
    expect(off).toEqual({ changed: true, enabled: false });
    expect((await cronParserService.listWithExecutor("root", fake.executor))[0]?.enabled).toBe(false);

    const removed = await cronParserService.removeWithExecutor(jobId, "root", fake.executor);
    expect(removed).toBe(true);
    expect(await cronParserService.listWithExecutor("root", fake.executor)).toHaveLength(0);
  });

  it("removeWithExecutor returns false (no write) for an unknown id", async () => {
    const fake = makeFakeCrontabExecutor("0 3 * * * /keep.sh\n");
    const removed = await cronParserService.removeWithExecutor("does-not-exist", "root", fake.executor);
    expect(removed).toBe(false);
    expect(fake.writes).toHaveLength(0); // no crontab install attempted
  });
});

describe("cronParserService.describe — additional shapes", () => {
  it("describes every-N-minutes and windows", () => {
    expect(cronParserService.describe("*/5 * * * *")).toBe("cada 5 minutos");
    expect(cronParserService.describe("*/10 8-18 * * *")).toMatch(/cada 10 minutos, de 08:00 a 18:59/);
  });
  it("describes minute-N each hour", () => {
    expect(cronParserService.describe("15 * * * *")).toMatch(/en el minuto 15/);
  });
  it("describes day-of-month with time", () => {
    expect(cronParserService.describe("0 6 15 * *")).toMatch(/día 15.*06:00/);
  });
  it("describes a weekday range at a time", () => {
    expect(cronParserService.describe("30 18 * * 1-5")).toMatch(/lunes a viernes.*18:30/);
  });
});
