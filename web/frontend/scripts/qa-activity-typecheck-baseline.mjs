// SPDX-License-Identifier: AGPL-3.0-only
// Read-only compiler overlay: compare HEAD without a worktree, checkout or source copies.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import ts from "typescript";
const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repo = path.resolve(cwd, "../..");
const prefix = "web/frontend/";
const git = (...args) => execFileSync("git", args, { cwd: repo, maxBuffer: 256 * 1024 * 1024 });
const head = git("rev-parse", "HEAD").toString().trim();
const names = git("ls-tree", "-r", "--name-only", head, "--", prefix).toString().trim().split("\n")
  .filter(name => /\.(?:[cm]?[jt]sx?|json)$/.test(name));
const batch = execFileSync("git", ["cat-file", "--batch"], {
  cwd: repo, input: names.map(name => `${head}:${name}\n`).join(""), maxBuffer: 256 * 1024 * 1024,
});
const baseline = new Map();
let offset = 0;
for (const name of names) {
  const newline = batch.indexOf(10, offset);
  const header = batch.subarray(offset, newline).toString();
  const size = Number(header.split(" ")[2]);
  if (!Number.isSafeInteger(size)) throw new Error(`Missing baseline blob: ${name}`);
  offset = newline + 1;
  baseline.set(path.join(repo, name), batch.subarray(offset, offset + size).toString());
  offset += size + 1;
}
const changed = new Set([
  ...git("diff", "--name-only", head, "--", prefix).toString().trim().split("\n"),
  ...git("ls-files", "--others", "--exclude-standard", "--", prefix).toString().trim().split("\n"),
].filter(Boolean).map(name => name.slice(prefix.length)));
const isSource = file => file.startsWith(path.join(cwd, "src") + path.sep);
function diagnostics(useHead) {
  const readFile = file => useHead && baseline.has(path.resolve(file)) ? baseline.get(path.resolve(file))
    : useHead && isSource(path.resolve(file)) ? undefined : ts.sys.readFile(file);
  const fileExists = file => useHead && isSource(path.resolve(file)) ? baseline.has(path.resolve(file)) : ts.sys.fileExists(file);
  const configPath = path.join(cwd, "tsconfig.json");
  const config = ts.readConfigFile(configPath, readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
  const parsed = ts.parseJsonConfigFileContent(config.config, { ...ts.sys, readFile, fileExists }, cwd);
  const rootNames = parsed.fileNames.filter(file => !useHead || !isSource(file) || baseline.has(file));
  const host = ts.createCompilerHost(parsed.options);
  host.readFile = readFile;
  host.fileExists = fileExists;
  host.getSourceFile = (file, languageVersion) => {
    const text = readFile(file);
    return text === undefined ? undefined : ts.createSourceFile(file, text, languageVersion);
  };
  const program = ts.createProgram(rootNames, { ...parsed.options, noEmit: true }, host);
  const items = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)].map(d => {
    const loc = d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start) : undefined;
    return { file: d.file ? path.relative(cwd, d.file.fileName) : "config", line: loc ? loc.line + 1 : 0,
      column: loc ? loc.character + 1 : 0, code: d.code, message: ts.flattenDiagnosticMessageText(d.messageText, "\n") };
  });
  return { rootFiles: rootNames.length, items };
}
const before = diagnostics(true);
global.gc?.();
const current = diagnostics(false);
const key = item => JSON.stringify(item);
const old = new Set(before.items.map(key)), now = new Set(current.items.map(key));
const added = current.items.filter(item => !old.has(key(item)));
const removed = before.items.filter(item => !now.has(key(item)));
const touched = current.items.filter(item => changed.has(item.file));
const cacheFile = path.join(cwd, ".cache/api-activity-contract-qa/typecheck-before.txt");
const saved = fs.existsSync(cacheFile) ? fs.readFileSync(cacheFile, "utf8") : "";
const savedHeaders = new Set(saved.split("\n").filter(line => /^src\/.*error TS\d+:/.test(line)));
const headers = current.items.map(item => `${item.file}(${item.line},${item.column}): error TS${item.code}: ${item.message.split("\n")[0]}`);
const savedHeadersMatch = savedHeaders.size === headers.length && headers.every(line => savedHeaders.has(line));
console.log(JSON.stringify({ head, method: "HEAD compiler overlay in memory; installed dependencies and generated types unchanged",
  baselineRoots: before.rootFiles, currentRoots: current.rootFiles, baselineCount: before.items.length,
  currentCount: current.items.length, added, removed, touched, savedHeadersMatch, diagnostics: current.items }, null, 2));
process.exitCode = added.length || touched.length ? 1 : 0;
