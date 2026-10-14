// Compartición de paneles: invitaciones/shares, grupos, acceso granular por
// usuario Linux/llave SSH, links de acceso y sesión de invitado (guest).
import { ENV } from "../../config/env";
import { getStringField, request } from "./request";

export async function respondPanelInvitation(shareId: string, decision: "accepted" | "rejected", token: string) {
  return request<{ ok: boolean }>(`/portal/panel-shares/${shareId}/respond`, token, {
    method: "POST",
    body: JSON.stringify({ decision }),
  });
}

export async function listPanelShares(panelId: string, token: string) {
  return request<{
    shares?: Array<{
      id: string;
      status: "pending" | "accepted";
      target: { email: string | null; name: string | null };
    }>;
  }>(`/portal/panels/${panelId}/shares`, token);
}

export async function createPanelShare(panelId: string, email: string, token: string) {
  return request<{ ok: boolean }>(`/portal/panels/${panelId}/shares`, token, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
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

export type PanelAccessShareMode = "private" | "public" | "guest";

export type CreatePanelAccessLinkResponse = {
  ok: boolean;
  link?: {
    mode: string;
    kind?: "full" | "granular";
    url: string;
    expiresAt?: string;
  };
};

/**
 * Generate a panel access link. mode "guest" creates a guest-shareable
 * invitation (full panel, or granular for a Linux user via sshKeyId) that an
 * account-less guest exchanges at /public/guest/exchange.
 */
export async function createPanelAccessLink(
  panelId: string,
  mode: PanelAccessShareMode,
  token: string,
  opts?: { kind?: "full" | "granular"; sshKeyId?: string; expiresAt?: string },
) {
  return request<CreatePanelAccessLinkResponse>(`/portal/panels/${panelId}/access-links`, token, {
    method: "POST",
    body: JSON.stringify({ mode, ...(opts ?? {}) }),
  });
}

export async function claimPanelAccessLink(accessToken: string, token: string) {
  return request<{
    ok: boolean;
    share?: {
      id: string | null;
      panelId: string;
      panelName: string;
      subdomain: string;
    };
  }>("/portal/panel-access-links/claim", token, {
    method: "POST",
    body: JSON.stringify({ token: accessToken }),
  });
}

export async function resolvePublicPanelAccessLink(accessToken: string): Promise<{
  ok: boolean;
  mode?: "public";
  panel?: {
    subdomain: string;
    name: string;
    category: string | null;
    tags: string[];
  };
}> {
  const response = await fetch(`${ENV.apiUrl}/public/panel-access-links?token=${encodeURIComponent(accessToken)}`, {
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "x-client-platform": "app",
    },
  });
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(getStringField(data, "error") ?? "Request failed");
  return data as {
    ok: boolean;
    mode?: "public";
    panel?: {
      subdomain: string;
      name: string;
      category: string | null;
      tags: string[];
    };
  };
}

/**
 * Exchange one or more guest invitation links (access-link tokens and/or panel
 * subdomains/hosts) for an account-less guest session JWT. No Authorization
 * header — the link IS the credential. Expired/unknown links resolve to a 404,
 * surfaced as a thrown error here. The returned `guestToken` is then used as the
 * Bearer for the normal /portal/* endpoints (licenses, metrics, modules).
 */
export async function exchangeGuestSession(input: { tokens?: string[]; hosts?: string[] }): Promise<{
  guestToken: string;
  expiresAt: number;
  panels: { panelId: string; name: string; accessKind: string }[];
}> {
  const response = await fetch(`${ENV.apiUrl}/public/guest/exchange`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "x-client-platform": "app",
    },
    body: JSON.stringify({ tokens: input.tokens ?? [], hosts: input.hosts ?? [] }),
  });
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(getStringField(data, "error") ?? "Request failed");
  const rec = (data ?? {}) as Record<string, unknown>;
  return {
    guestToken: typeof rec.token === "string" ? rec.token : "",
    expiresAt: typeof rec.expiresAt === "number" ? rec.expiresAt : 0,
    panels: Array.isArray(rec.panels) ? (rec.panels as { panelId: string; name: string; accessKind: string }[]) : [],
  };
}

export async function deletePanelShare(shareId: string, token: string) {
  return request<{ ok: boolean }>(`/portal/panel-shares/${shareId}`, token, { method: "DELETE" });
}
