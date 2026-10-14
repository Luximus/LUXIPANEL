import { resolveTargetScope, scopeHeaders } from "@/lib/api-client";

/** Short lived shared reads, confined to this window and authenticated target. */
export function createLoadCoordinator(scope: () => string, ttl = 2000) {
  let generation = 0;
  const reads = new Map<string, { promise: Promise<unknown>; expires: number }>();
  const repairs = new Map<string, Promise<void>>();
  const reset = () => { generation++; reads.clear(); repairs.clear(); };
  const invalidate = () => { generation++; reads.clear(); };
  function read<T>(group: string, args: unknown[], load: () => Promise<T>): Promise<T> {
    const target = scope(), epoch = generation;
    const key = JSON.stringify([target, group, args]);
    const cached = reads.get(key);
    if (cached && cached.expires > Date.now()) return cached.promise as Promise<T>;
    const entry = { expires: Infinity, promise: Promise.resolve().then(load).then(value => {
      if (scope() !== target || generation !== epoch) throw new Error("Assistant request scope changed");
      entry.expires = Date.now() + ttl;
      return value;
    }).catch(error => { if (reads.get(key) === entry) reads.delete(key); throw error; }) };
    if (reads.size >= 128) for (const [key, value] of reads) if (value.expires < Date.now()) reads.delete(key);
    reads.set(key, entry);
    return entry.promise;
  }
  async function repair(load: () => Promise<void>): Promise<boolean> {
    const target = scope(), epoch = generation;
    const pending = repairs.get(target);
    if (pending) { await pending; return false; }
    const task = new Promise<void>(resolve => setTimeout(resolve, 500)).then(async () => {
      if (scope() !== target || epoch !== generation) return;
      await load();
      if (scope() === target) invalidate();
    }).catch(error => { if (repairs.get(target) === task) repairs.delete(target); throw error; });
    repairs.set(target, task);
    await task;
    return scope() === target && repairs.get(target) === task;
  }
  return { read, repair, reset, invalidate };
}

const coordinator = createLoadCoordinator(() => JSON.stringify([resolveTargetScope(), scopeHeaders(), typeof document === "undefined" ? "" : document.documentElement.lang]));
const installed = new WeakSet<object>();
export function shareAssistantReads<T extends object>(client: T, group: string): void {
  if (installed.has(client)) return;
  installed.add(client);
  const methods = client as Record<string, (...args: unknown[]) => Promise<unknown>>;
  for (const [name, method] of Object.entries(methods)) {
    if (name === "list") methods[name] = (...args) => coordinator.read(group, args, () => method.apply(client, args));
    else if (/^(create|update|remove|delete|merge|move|rename|connect|disconnect|clone|set)/.test(name)) {
      methods[name] = async (...args) => {
        coordinator.invalidate();
        try { return await method.apply(client, args); }
        finally { coordinator.invalidate(); }
      };
    }
  }
}
export const runAssistantRepair = coordinator.repair;
if (typeof window !== "undefined") {
  for (const event of ["luxipanel:target-changed", "luxipanel:logout", "luxipanel:session-ended", "luxipanel:session-started", "luxipanel:permissions-changed"]) window.addEventListener(event, coordinator.reset);
  for (const event of ["lxp:assistant:agents-updated", "lxp:assistant:projects-updated", "lxp:assistant:connectors-updated", "lxp:assistant:conversations-updated"]) window.addEventListener(event, coordinator.invalidate);
}
