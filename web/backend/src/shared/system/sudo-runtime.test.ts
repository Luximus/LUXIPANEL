// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { describe, it, expect } from "vitest";
import { commandUsesSudo, redactSudoSecrets, rewriteSudoCommand } from "./sudo-runtime.js";

describe("sudo-runtime command-position regex", () => {
  // Cases pinned by cron/daily_work_plan_luxipanel.md §1.3 — the regex must only
  // match `sudo` at a command position (start of line, after `&&`/`||`/`;`,
  // or after a newline). Substring `sudo ` inside an echo'd string must NOT
  // be rewritten; the previous unanchored regex turned `echo sudo: hola`
  // into a syntax error and silently broke `fetchMiniMax` (MEMORY
  // `executor-forloop-join-breaks`).

  it("NO reescribe `echo sudo: hola` (palabra sudo en mid-string)", () => {
    expect(commandUsesSudo("echo sudo: hola")).toBe(false);
  });

  it("NO reescribe `'sudo foo'` como argumento (sudo dentro de comillas simples)", () => {
    // The leading `;` is a separator — that IS a command position. But the
    // body inside single quotes is still its own shell token, so rewriting
    // `; 'sudo foo'` would actually flip the literal `'sudo foo'` into a
    // real sudo invocation. To stay safe we restrict the regex to NON-quoted
    // contexts; this is enforced by the boundary check in this test.
    // Implementation note: a pure-regex solver cannot fully resolve quoted
    // regions; we pin the contract that mid-token `sudo` is left alone.
    expect(commandUsesSudo("echo 'sudo foo'")).toBe(false);
    expect(commandUsesSudo(`echo "sudo foo"`)).toBe(false);
  });

  it("SÍ reescribe `sudo -n foo` al inicio de línea", () => {
    expect(commandUsesSudo("sudo -n foo")).toBe(true);
    expect(commandUsesSudo("sudo foo")).toBe(true);
  });

  it("NO reescribe `sudo` dentro de un for-loop (`do sudo bar; done`)", () => {
    // The `do` keyword is NOT a command separator; `sudo bar` here is the
    // body of a for-loop, not a top-level command. We must leave it alone.
    expect(commandUsesSudo("for x in 1 2; do sudo bar; done")).toBe(false);
  });

  it("rewriteSudoCommand preserva `echo sudo:` y reescribe inicio de línea", () => {
    const unchanged = rewriteSudoCommand("echo sudo: hola", "PW");
    expect(unchanged).toBe("echo sudo: hola");

    const rewritten = rewriteSudoCommand("sudo -n systemctl reload nginx", "PW");
    // Confirm the prefix was injected and the trailing args are preserved
    expect(rewritten).toMatch(/sudo -S -p ''/);
    expect(rewritten).toContain("systemctl reload nginx");
  });
});

describe("redactSudoSecrets", () => {
  it("enmascara el payload base64 del prefijo inyectado", () => {
    const cmd = rewriteSudoCommand("sudo du -xb -d1 /", "S3cr3t!");
    const redacted = redactSudoSecrets(cmd);
    expect(redacted).not.toContain(Buffer.from("S3cr3t!", "utf-8").toString("base64"));
    expect(redacted).toContain("***REDACTED***");
    expect(redacted).toContain("du -xb -d1 /");
  });

  it("enmascara la forma re-quoteada que aparece en err.cmd de sh -lc", () => {
    // Shape real visto en pm2 logs: el wrapper añade capas '"'"' alrededor
    // de cada token del printf.
    const mangled =
      "sh '-lc' 'printf '\"'\"'%s'\"'\"' '\"'\"'Sm9zZTE5OTYzMUA='\"'\"' | base64 -d | sudo -S -p '\"'\"''\"'\"' du -xb -d1 / 2>/dev/null'";
    const redacted = redactSudoSecrets(mangled);
    expect(redacted).not.toContain("Sm9zZTE5OTYzMUA=");
    expect(redacted).toContain("***REDACTED***");
  });

  it("es no-op sobre texto sin el patrón", () => {
    const plain = "Command failed: df -B1 -P / | tail -1";
    expect(redactSudoSecrets(plain)).toBe(plain);
  });
});
