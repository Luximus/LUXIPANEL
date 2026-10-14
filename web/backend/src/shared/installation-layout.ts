import path from "node:path";
import { existsSync } from "node:fs";
export function repositoryRoot(applicationRoot: string): string {
  return path.basename(applicationRoot) === "web" && existsSync(path.join(applicationRoot, "backend")) ? path.dirname(applicationRoot) : applicationRoot;
}
export function applicationRoot(repository: string): string { return existsSync(path.join(repository, "web", "backend")) ? path.join(repository, "web") : repository; }
