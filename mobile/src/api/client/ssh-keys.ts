import { type ReadOptions, readCache, request, TTL } from "./request";

export type SshKeySummary = {
  id: string;
  nickname?: string;
  linuxUsername?: string | null;
  fingerprint?: string | null;
  panelsCount?: number;
  panelIds?: string[];
  createdAt?: string | null;
};

export type SshKeyOption = SshKeySummary;

export function getSshKeys(token: string, opts?: ReadOptions): Promise<SshKeySummary[]> {
  return readCache.fetch(`sshKeys|${token}`, async () => {
    const data = await request<{ keys?: SshKeySummary[] }>("/portal/ssh-keys", token);
    return Array.isArray(data?.keys) ? data.keys : [];
  }, { ttlMs: TTL.sshKeys, force: opts?.force });
}

/** Tira las llaves SSH cacheadas (tras crear/editar/borrar una llave). */
export function invalidateSshKeysCache(): void {
  readCache.invalidatePrefix("sshKeys|");
}

export async function createSshKey(
  payload: { sshKey: string; linuxUsername: string; panelIds?: string[]; passphrase?: string },
  token: string,
) {
  return request<{ ok: boolean; key?: SshKeySummary }>("/portal/ssh-keys", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateSshKeyApi(
  id: string,
  payload: { linuxUsername?: string; panelIds?: string[]; sshKey?: string; passphrase?: string },
  token: string,
  stepUpToken?: string,
) {
  // Editar una llave SSH está gateado por 2FA (scope "ssh-key-manage").
  return request<{ ok: boolean; key?: SshKeySummary }>(`/portal/ssh-keys/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify(payload),
    headers: stepUpToken ? { "X-Step-Up-Token": stepUpToken } : undefined,
  });
}

export async function deleteSshKey(id: string, token: string, stepUpToken?: string) {
  // Eliminar una llave SSH también está gateado por 2FA (scope "ssh-key-manage").
  return request<{ ok: boolean }>(`/portal/ssh-keys/${id}`, token, {
    method: "DELETE",
    headers: stepUpToken ? { "X-Step-Up-Token": stepUpToken } : undefined,
  });
}
