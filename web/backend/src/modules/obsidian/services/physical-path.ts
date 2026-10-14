import type { Executor } from "../../../shared/executor/index.js";
import { execShell, quoteArg } from "../../../shared/executor/index.js";
import { ForbiddenError } from "../../../shared/errors/index.js";
import { isPathUnder } from "../../../shared/utils/path-containment.js";
import { resolveRel } from "./path-util.js";

/** Resolve existing symlink components on the target before authorizing note I/O. */
export async function physicalNotePath(executor: Executor, vaultPath: string, rel: string): Promise<{ root: string; target: string }> {
  const requested = resolveRel(vaultPath, rel);
  const result = await execShell(executor, `realpath -zm -- ${quoteArg(vaultPath)} ${quoteArg(requested)}`, { timeoutMs: 10_000 });
  const [root, target] = result.stdout.split("\0");
  if (result.exitCode !== 0 || !root?.startsWith("/") || !target?.startsWith("/") || !isPathUnder(root, target)) {
    throw new ForbiddenError("La ruta de la nota sale del vault o no se pudo verificar.");
  }
  return { root, target };
}
