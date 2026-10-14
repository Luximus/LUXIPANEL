import { promptSudoPassword as prompt } from "/scripts/extracted/lib/sudo.js?v=20260506c";
import { api, resolveTargetScope } from "/scripts/extracted/lib/mail-api-client.js?v=20260930a";
export async function promptSudoPassword(opts: { message?: string; previousError?: string } = {}): Promise<string | null> {
  const scope = resolveTargetScope();
  let previousError = opts.previousError;
  while (scope === resolveTargetScope()) {
    const password = await prompt({ ...opts, previousError, validateAndStore: false });
    if (!password || scope !== resolveTargetScope()) return null;
    const result = await api.post("/api/mail/sudo/credential", { password });
    if (result.ok) return password;
    previousError = result.error;
  }
  return null;
}
