/** Canonical action vocabulary. IDs are stable; every registered module gets
 * real read/mutation capabilities, including dynamically declared modules. */
export const MODULE_OPERATIONS = ["read", "create", "edit", "delete", "execute", "config", "service", "install"] as const;
export type ModuleOperation = typeof MODULE_OPERATIONS[number];
export const SPECIAL_ACTIONS: Record<string, string[]> = {
  mail: ["send", "connect", "export"], dns: ["ssl", "logs", "deploy"],
  backups: ["restore", "download"], databases: ["query", "import", "export"],
  cron: ["logs", "approve"], assistant: ["chat", "tools", "credentials"],
  expo: ["build", "submit", "credentials"], "repository-store": ["clone", "pull", "credentials"],
  monitor: ["processes", "alerts"], hosting: ["templates", "provision", "suspend", "providers"],
  "server-switcher": ["connect", "fingerprint"], "module-dev": ["build", "publish"],
};
export const ADMIN_MODULES = new Set(["admin", "modules", "monitor", "firewall", "bitninja", "webhooks", "module-dev"]);
export function moduleActionIds(module: string): string[] {
  if (["files", "users", "terminal"].includes(module)) return [];
  return [...MODULE_OPERATIONS, ...(SPECIAL_ACTIONS[module] ?? [])].map(op => `${module}.${op}`);
}
export function actionRequiresAdmin(action: string): boolean {
  const [module, operation] = action.split(".");
  return ADMIN_MODULES.has(module!) || operation === "install" || operation === "service" ||
    action === "assistant.credentials" || action === "hosting.templates" ||
    action === "hosting.provision" || action === "hosting.suspend" || action === "hosting.providers";
}
/** Explicit special operations precede method-based CRUD. Never infer that a
 * POST is safe just because its endpoint looks like a read. */
export function actionForHttp(module: string, method: string, url: string): string | null {
  if (["files", "users", "terminal"].includes(module)) return null; // existing per-route actions
  const p = url.split("?")[0]!.toLowerCase();
  let op: string | undefined;
  const mutation = !["GET", "HEAD"].includes(method);
  if (/\/(credentials|secrets)(\/|$)/.test(p) && SPECIAL_ACTIONS[module]?.includes("credentials")) return `${module}.credentials`;
  for (const special of SPECIAL_ACTIONS[module] ?? []) {
    if (new RegExp(`/(?:${special})(?:/|$)`).test(p) && (mutation || ["logs", "download", "export", "processes", "alerts"].includes(special))) return `${module}.${special}`;
  }
  if (/\/(install|uninstall|upgrade)(\/|$)/.test(p)) op = "install";
  else if (/\/service(\/|$)/.test(p)) op = "service";
  else if (module === "mail" && /\/(send|reply|forward)(\/|$)/.test(p) && method !== "GET") op = "send";
  else if (module === "mail" && /\/server-settings/.test(p) && method !== "GET") op = "connect";
  else if (module === "backups" && /\/restore(\/|$)/.test(p)) op = "restore";
  else if (module === "databases" && /\/(query|sql|execute)(\/|$)/.test(p)) op = "query";
  else if (module === "expo" && /\/submit(\/|$)/.test(p)) op = "submit";
  else if (["expo", "module-dev"].includes(module) && /\/build(s)?(\/|$)/.test(p) && method !== "GET") op = "build";
  else if (module === "module-dev" && /\/publish(\/|$)/.test(p)) op = "publish";
  else if (module === "dns" && /\/(ssl|certificates|certbot)(\/|$)/.test(p) && method !== "GET") op = "ssl";
  else if (/\/(run|trigger|execute|kill|restart|start|stop|scan)(\/|$)/.test(p) && method !== "GET") op = "execute";
  else if (/\/(config|settings|defaults|provider-creds)(\/|$)/.test(p) && method !== "GET") op = "config";
  else op = method === "GET" || method === "HEAD" ? "read" : method === "DELETE" ? "delete" : method === "PUT" || method === "PATCH" ? "edit" : "create";
  return `${module}.${op}`;
}

/** Capability handlers and HTTP routes use the same stable action IDs. */
export function actionForTool(module: string, name: string, kind: "read" | "action", declared?: string): string {
  if (declared?.includes(".")) return declared;
  if (kind === "read") return module === "users" ? "users.view" : `${module}.read`;
  const operation = name.slice(name.indexOf(".") + 1).replaceAll("_", "/");
  if (/^(delete|remove|drop)\b/.test(operation)) return `${module}.delete`;
  if (/^(update|edit|modify|set)\b/.test(operation)) return `${module}.edit`;
  return actionForHttp(module, "POST", `/${operation}`) ?? `${module}.execute`;
}
