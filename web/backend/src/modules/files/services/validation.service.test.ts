// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, expect, it, vi } from "vitest";
import { validationService, validatorFor } from "./validation.service.js";

const noExec = { target: { id: "r", name: "R" }, exec: vi.fn(), writeFile: vi.fn() } as never;

describe("validatorFor", () => {
  it("maps names/extensions to validators", () => {
    expect(validatorFor("/x/.env")).toBe("env");
    expect(validatorFor("/x/.env.production")).toBe("env");
    expect(validatorFor("/x/composer.json")).toBe("json");
    expect(validatorFor("/x/index.php")).toBe("php");
    expect(validatorFor("/x/docker-compose.yml")).toBe("yaml");
    expect(validatorFor("/x/site.conf")).toBe("nginx");
    expect(validatorFor("/x/.htaccess")).toBe("braces");
    expect(validatorFor("/x/readme.md")).toBe("none");
  });
});

describe("validationService (in-process validators)", () => {
  it("accepts valid JSON", async () => {
    const r = await validationService.validate(noExec, "a.json", '{"a":1,"b":[2,3]}');
    expect(r.valid).toBe(true);
    expect(r.validator).toBe("json");
  });

  it("reports JSON errors with a line/column", async () => {
    const r = await validationService.validate(noExec, "a.json", '{\n  "a": 1,\n  "b" 2\n}');
    expect(r.valid).toBe(false);
    expect(r.errors[0]?.line).toBeGreaterThan(0);
    expect(r.errors[0]?.message).toBe("JSON no válido");
  });

  it("flags malformed .env lines", async () => {
    const r = await validationService.validate(noExec, ".env", "A=1\nthis is not valid\n# comment\nB=2");
    expect(r.valid).toBe(false);
    expect(r.errors[0]?.line).toBe(2);
  });

  it("detects unbalanced braces in nginx conf", async () => {
    const ok = await validationService.validate(noExec, "site.conf", "server {\n  listen 80;\n}");
    expect(ok.valid).toBe(true);
    const bad = await validationService.validate(noExec, "site.conf", "server {\n  listen 80;\n");
    expect(bad.valid).toBe(false);
  });

  it("returns none/valid for unknown types", async () => {
    const r = await validationService.validate(noExec, "notes.md", "# hi\nanything goes }{");
    expect(r).toEqual({ validator: "none", valid: true, errors: [] });
  });
});

describe("validationService (executor validators)", () => {
  it("skips PHP validation when php is not installed", async () => {
    const exec = vi.fn(async (cmd: string) => ({
      stdout: cmd.includes("command -v") ? "" : "", stderr: "", exitCode: 1, durationMs: 1,
    }));
    const r = await validationService.validate({ target: { id: "r", name: "R" }, exec, writeFile: vi.fn() } as never, "x.php", "<?php echo 1;");
    expect(r.skipped).toBe(true);
    expect(r.valid).toBe(true);
  });

  it("parses php -l parse errors with a line number", async () => {
    const writeFile = vi.fn(async () => undefined);
    const exec = vi.fn(async (cmd: string) => {
      if (cmd.includes("command -v")) return { stdout: "/usr/bin/php", stderr: "", exitCode: 0, durationMs: 1 };
      if (cmd.includes("rm")) return { stdout: "", stderr: "", exitCode: 0, durationMs: 1 };
      // php -l
      return { stdout: "", stderr: "PHP Parse error:  syntax error, unexpected ';' in /tmp/lxp-validate-x.php on line 3", exitCode: 255, durationMs: 1 };
    });
    const r = await validationService.validate({ target: { id: "r", name: "R" }, exec, writeFile } as never, "broken.php", "<?php\n$x = 1\n;;;");
    expect(r.validator).toBe("php");
    expect(r.valid).toBe(false);
    expect(r.errors[0]?.line).toBe(3);
    expect(writeFile).toHaveBeenCalled();
  });
});
