// Saved startup choice for new sessions. Existing sessions retain their mode.
import { api, TARGET_SCOPE_SESSION_KEY } from '@/lib/api-client';
import { getCli } from '@/components/floating-terminal/cli-registry';
let startupCommand: string | null = null;
let startupScope = '';
let startupRevision = 0;
let pendingStartupWrite: Promise<unknown> | null = null;
let startupLoad: { scope: string; revision: number; promise: Promise<void> } | null = null;
export function terminalTargetScope(): string {
  try { return sessionStorage.getItem(TARGET_SCOPE_SESSION_KEY) || 'local'; } catch { return 'local'; }
}
export function getModeInitialCommand(): string | null {
  return startupScope === terminalTargetScope() ? startupCommand : null;
}
export async function refreshStartupCli(): Promise<boolean> {
  const scope = terminalTargetScope();
  for (;;) {
    const pending = pendingStartupWrite;
    if (pending) await pending.catch(() => {});
    if (scope !== terminalTargetScope()) return false;
    if (pending !== pendingStartupWrite) continue;
    const revision = startupRevision;
    if (!startupLoad || startupLoad.scope !== scope || startupLoad.revision !== revision) {
      const promise = (async () => {
        try {
          const response = await api.get<{ active: string }>('/api/terminal-cli/state');
          if (scope !== terminalTargetScope() || revision !== startupRevision) return;
          if (response.ok && response.data) {
            startupCommand = getCli(response.data.active)?.command || null;
            startupScope = scope;
          } else if (startupScope !== scope) { startupCommand = null; startupScope = scope; }
        } catch {
          if (startupScope !== scope) { startupCommand = null; startupScope = scope; }
        }
      })();
      startupLoad = { scope, revision, promise };
    }
    const load = startupLoad;
    await load.promise;
    if (startupLoad === load) startupLoad = null;
    if (scope !== terminalTargetScope()) return false;
    if (revision === startupRevision) return true;
  }
}
window.addEventListener('lxp-terminal:cli-selecting', ((event: CustomEvent<{ scope: string; promise: Promise<unknown> }>) => {
  if (event.detail?.scope !== terminalTargetScope()) return;
  pendingStartupWrite = Promise.resolve(event.detail.promise).catch(() => {});
  startupRevision++;
}) as EventListener);
function resetStartupCli() { startupRevision++; startupCommand = null; startupScope = ''; pendingStartupWrite = null; startupLoad = null; }
window.addEventListener('luxipanel:target-changed', resetStartupCli);
window.addEventListener('luxipanel:logout', resetStartupCli);
