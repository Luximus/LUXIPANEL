/** Trusted static analyzer. It reads third-party source without importing it. */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { validateManifest } from "../backend/src/modules/module-dev/services/manifest-validator.service.js";
const directory = path.resolve(process.argv[2] || "");
const manifestFile = path.join(directory, "module.manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
const events: { kind: string; result: "pass" | "warn" | "fail"; detail?: unknown }[] = [];
const validation = validateManifest(manifest);
const entry = path.resolve(directory, String(manifest.entry?.backend || "backend/index.js"));
if (!entry.startsWith(directory + path.sep) || !fs.existsSync(entry) || fs.lstatSync(entry).isSymbolicLink()) validation.valid = false;
const derived = JSON.parse(execFileSync(process.execPath, ["security/os-compat-derive.mjs", directory], { encoding: "utf8", timeout: 30000 }));
events.push({ kind: "intake", result: validation.valid ? "pass" : "fail", detail: { manifest, derived, errors: validation.errors } });
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "lxp-review-"));
try {
  const semgrep = execFileSync("semgrep", ["--json", "--metrics=off", "--config", "security/module-semgrep.yml", directory], { encoding: "utf8", timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
  const sastFile = path.join(temp, "sast.json"); fs.writeFileSync(sastFile, semgrep);
  try { const verdict = JSON.parse(execFileSync(process.execPath, ["security/capability-diff.mjs", manifestFile, sastFile], { encoding: "utf8", timeout: 30000 })); events.push({ kind: "sast", result: verdict.status, detail: verdict }); }
  catch { events.push({ kind: "sast", result: "fail", detail: { reason: "capability/architecture check failed" } }); }
  try { execFileSync("gitleaks", ["detect", "--no-git", "--redact", "--no-banner", "--source", directory], { stdio: "pipe", timeout: 120000 }); events.push({ kind: "secrets", result: "pass" }); }
  catch { events.push({ kind: "secrets", result: "fail", detail: { reason: "secret scan failed or unavailable" } }); }
} catch { events.push({ kind: "sast", result: "fail", detail: { reason: "Static analyzer unavailable or failed" } }); } finally { fs.rmSync(temp, { recursive: true, force: true }); }
console.log(JSON.stringify({ events }));
if (events.some((event) => event.result === "fail")) process.exitCode = 1;
