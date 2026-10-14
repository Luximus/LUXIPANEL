import { repositoryRoot } from "../installation-layout.js";
import path from "node:path";
import { localExecutor, quoteArg } from "../executor/index.js";
import { sanitizeText } from "./sanitize.js";
export async function verifyRepairCheck(root: string, cwd: string, name: string, signal?: AbortSignal, moduleId?: string) {
  const command = `python3 ${quoteArg(path.join(root, "scripts/verify-repair.py"))} --cwd ${quoteArg(cwd)} --check ${quoteArg(name)} --lock ${quoteArg(path.join(repositoryRoot(root), ".lxp/build.lock"))}${moduleId ? ` --module ${quoteArg(moduleId)}` : ""}`;
  const result = await localExecutor.exec(command, { cwd, isolatedEnv: true, timeoutMs: 660_000, signal });
  if (result.exitCode !== 0) return { passed: false, output: sanitizeText(result.stderr || result.stdout).slice(-8000) };
  const data = JSON.parse(result.stdout) as { passed: boolean; output: string };
  return { passed: data.passed === true, output: sanitizeText(data.output).slice(-8000) };
}
