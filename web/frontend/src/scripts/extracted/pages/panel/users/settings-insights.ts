/** Read-only summary of the users and sessions already authorized by the API. */
export interface VisibleUser {
  username: string;
  displayName?: string | null;
  email?: string | null;
  enabled?: boolean;
  systemUid?: number;
  systemGid?: number;
  homeDir?: string;
  shell?: string;
  groups?: string[];
  modules?: string[];
}

export interface UserSession {
  online?: boolean;
  connections?: number;
  lastLogin?: string | null;
}

export interface AccessRow {
  username: string;
  online: boolean;
  connections: number;
  lastLogin: string | null;
}

export function summarizeVisibleUsers(users: VisibleUser[], sessions: Record<string, UserSession>) {
  const access: AccessRow[] = users.map((user) => {
    const session = sessions[user.username];
    const connections = session?.online ? Math.max(0, Math.floor(Number(session.connections) || 0)) : 0;
    const timestamp = session?.lastLogin ? Date.parse(session.lastLogin) : NaN;
    return {
      username: user.username,
      online: Boolean(session?.online),
      connections,
      lastLogin: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null,
    };
  });
  const recent = access.filter((row) => row.online || row.lastLogin).sort((a, b) =>
    Number(b.online) - Number(a.online) ||
    (b.lastLogin ? Date.parse(b.lastLogin) : 0) - (a.lastLogin ? Date.parse(a.lastLogin) : 0) ||
    a.username.localeCompare(b.username),
  );
  return {
    users: users.length,
    locked: users.filter((user) => user.enabled === false).length,
    connections: access.reduce((sum, row) => sum + row.connections, 0),
    recent,
  };
}

/** Quote CSV cells and neutralize spreadsheet formulas in user-controlled text. */
export function csvCell(value: unknown): string {
  const raw = String(value ?? "");
  const safe = /^[\s\u0000-\u001f]*[=+@-]/u.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function csvDocument(rows: unknown[][]): string {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}
