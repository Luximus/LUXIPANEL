import { request } from "./request";

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

export async function getSshKeys(token: string): Promise<SshKeySummary[]> {
  const data = await request<{ keys?: SshKeySummary[] }>("/portal/ssh-keys", token);
  return Array.isArray(data?.keys) ? data.keys : [];
}

export async function createSshKey(
  // `passphrase` es obligatorio en el backend (z.string().min(1)) para que LP
  // pueda elevar con `sudo -S`. Se marca opcional en el tipo solo para no
  // romper a otros llamadores heredados (import / editor de panel) que aún no
  // lo recogen; el formulario de la bóveda SSH sí lo exige y lo envía.
  payload: { sshKey: string; linuxUsername: string; passphrase?: string; panelIds?: string[] },
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
  // Editar una llave SSH está gateado por 2FA (scope "ssh-key-manage"): el
  // backend exige el token step-up. Sin él responde 403 STEP_UP_REQUIRED.
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
