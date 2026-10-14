import { api, resolveTargetScope } from "/scripts/extracted/lib/mail-api-client.js?v=20260930a";
type Job = { id?: string; mode?: string } | null | undefined;
type Options = { maxMs?: number; intervalMs?: number };
export async function pollJob(job: Job, opts: Options = {}): Promise<void> {
  if (!job?.id || job.mode === "applied") return;
  const scope = resolveTargetScope();
  const deadline = Date.now() + (opts.maxMs ?? 30000);
  while (Date.now() < deadline && scope === resolveTargetScope() && !document.hidden) {
    const result = await api.get<{ state: string; viewReady?: boolean }>(`/api/mail/jobs/${encodeURIComponent(job.id)}`);
    if (scope !== resolveTargetScope()) return;
    if (result.data?.state === "done" && result.data.viewReady === false) window.dispatchEvent(new CustomEvent("lxp:data:refresh-failed", {detail:{resource:"mail/accounts"}}));
    if (!result.ok || ["done", "failed", "unknown"].includes(result.data?.state ?? "unknown")) return;
    await new Promise(resolve => globalThis.setTimeout(resolve, opts.intervalMs ?? 700));
  }
}
export function awaitJob(res: any, opts?: Options): Promise<void> {
  return pollJob(res?.data?.job ?? res?.job, opts);
}
