// Compartición de paneles: shares completos, grupos, acceso granular por
// usuario Linux/llave SSH y enlaces de acceso — extraído de client.ts.
import { request } from "./request";

export async function respondPanelInvitation(shareId: string, decision: "accepted" | "rejected", token: string) {
  return request<{ ok: boolean }>(`/portal/panel-shares/${shareId}/respond`, token, {
    method: "POST",
    body: JSON.stringify({ decision }),
  });
}

export async function listPanelShares(panelId: string, token: string) {
  return request<{ shares?: Array<{ id: string; status: "pending" | "accepted"; target: { email: string | null; name: string | null } }> }>(`/portal/panels/${panelId}/shares`, token);
}

export async function createPanelShare(panelId: string, email: string, token: string) {
  return request<{ ok: boolean }>(`/portal/panels/${panelId}/shares`, token, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function deletePanelShare(shareId: string, token: string) {
  return request<{ ok: boolean }>(`/portal/panel-shares/${shareId}`, token, { method: "DELETE" });
}

// ── Compartición granular: grupos + acceso por usuario Linux/llave SSH ─────
export type CustomerGroupMember = {
  id: string;
  status: "pending" | "accepted";
  customer: { id: string; email: string | null; name: string | null };
};
export type CustomerGroup = {
  id: string;
  name: string;
  description: string | null;
  members: CustomerGroupMember[];
};
export type ServerUserShare = {
  id: string;
  sshKeyId: string;
  linuxUsername: string | null;
  status: "pending" | "accepted";
  permission: string;
  invitedAt: string | null;
  respondedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  targetType: "customer" | "group";
  targetCustomer: { id: string; email: string | null; name: string | null } | null;
  targetGroup: { id: string; name: string | null } | null;
};

export async function listGroups(token: string) {
  return request<{ groups: CustomerGroup[] }>(`/portal/groups`, token);
}
export async function createGroup(name: string, description: string | undefined, token: string) {
  return request<{ group: CustomerGroup }>(`/portal/groups`, token, {
    method: "POST",
    body: JSON.stringify({ name, description }),
  });
}
export async function updateGroup(groupId: string, patch: { name?: string; description?: string | null }, token: string) {
  return request<{ group: CustomerGroup }>(`/portal/groups/${groupId}`, token, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}
export async function deleteGroup(groupId: string, token: string) {
  return request<{ ok: boolean }>(`/portal/groups/${groupId}`, token, { method: "DELETE" });
}
export async function addGroupMember(groupId: string, email: string, token: string) {
  return request<{ ok: boolean }>(`/portal/groups/${groupId}/members`, token, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}
export async function removeGroupMember(groupId: string, memberId: string, token: string) {
  return request<{ ok: boolean }>(`/portal/groups/${groupId}/members/${memberId}`, token, { method: "DELETE" });
}
export async function listServerUserShares(panelId: string, token: string) {
  return request<{ shares: ServerUserShare[] }>(`/portal/panels/${panelId}/user-shares`, token);
}
export async function createServerUserShare(
  panelId: string,
  body: { sshKeyId: string; targetEmail?: string; targetGroupId?: string; expiresAt?: string },
  token: string,
) {
  return request<{ ok: boolean; share: { id: string; status: string } }>(`/portal/panels/${panelId}/user-shares`, token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
export async function revokeServerUserShare(shareId: string, token: string) {
  return request<{ ok: boolean }>(`/portal/user-shares/${shareId}`, token, { method: "DELETE" });
}

export type CreatePanelAccessLinkResponse = {
  ok: boolean;
  link?: { mode: string; kind?: "full" | "granular"; url: string; expiresAt?: string };
};

/**
 * Generate a panel access link. mode "guest" creates a guest-shareable
 * invitation (full panel, or granular for a specific Linux user via sshKeyId)
 * that an account-less guest exchanges at /public/guest/exchange.
 */
export async function createPanelAccessLink(
  panelId: string,
  mode: "private" | "public" | "guest",
  token: string,
  opts?: { kind?: "full" | "granular"; sshKeyId?: string; expiresAt?: string },
) {
  return request<CreatePanelAccessLinkResponse>(`/portal/panels/${panelId}/access-links`, token, {
    method: "POST",
    body: JSON.stringify({ mode, ...(opts ?? {}) }),
  });
}
export async function respondServerUserShare(shareId: string, decision: "accepted" | "rejected", token: string) {
  return request<{ ok: boolean }>(`/portal/user-shares/${shareId}/respond`, token, {
    method: "POST",
    body: JSON.stringify({ decision }),
  });
}
export async function respondGroupInvite(memberId: string, decision: "accepted" | "rejected", token: string) {
  return request<{ ok: boolean }>(`/portal/group-members/${memberId}/respond`, token, {
    method: "POST",
    body: JSON.stringify({ decision }),
  });
}
export async function leaveGroup(memberId: string, token: string) {
  return request<{ ok: boolean }>(`/portal/group-members/${memberId}/leave`, token, { method: "POST" });
}
