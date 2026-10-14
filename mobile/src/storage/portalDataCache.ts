import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Panel, PanelInvitation, Ticket } from "../types/models";
import { secureGetItem, secureSetItem } from "./secureStorage";

/**
 * The panels cache holds sensitive material — license keys, server IPs, SSH
 * usernames and SSH key references (`sshKeyId`/`sshKeyIds`) — so it is persisted
 * in SecureStore (Keychain/Keystore) instead of plain-text AsyncStorage. The
 * record can exceed SecureStore's ~2KB per-value limit, so `secureStorage`
 * transparently segments it across chunk keys. Tickets are support-thread
 * metadata (no secrets) and remain in AsyncStorage.
 */

const PANELS_KEY_PREFIX = "lp.app.cache.panels";
const TICKETS_KEY_PREFIX = "lp.app.cache.tickets";

type PanelsCacheRecord = {
  panels: Panel[];
  invitations: PanelInvitation[];
  updatedAt: number;
};

type TicketsCacheRecord = {
  tickets: Ticket[];
  updatedAt: number;
};

const panelsMemory = new Map<string, PanelsCacheRecord>();
const ticketsMemory = new Map<string, TicketsCacheRecord>();

function getCacheScope(userEmail: string | null | undefined): string {
  const clean = (userEmail ?? "").trim().toLowerCase();
  return clean || "anonymous";
}

function getPanelsKey(scope: string): string {
  return `${PANELS_KEY_PREFIX}:${scope}`;
}

function getTicketsKey(scope: string): string {
  return `${TICKETS_KEY_PREFIX}:${scope}`;
}

export async function loadPanelsCache(userEmail: string | null | undefined): Promise<PanelsCacheRecord | null> {
  const scope = getCacheScope(userEmail);
  const memory = panelsMemory.get(scope);
  if (memory) return memory;
  try {
    const raw = await secureGetItem(getPanelsKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PanelsCacheRecord;
    if (!Array.isArray(parsed?.panels) || !Array.isArray(parsed?.invitations)) return null;
    const record: PanelsCacheRecord = {
      panels: parsed.panels,
      invitations: parsed.invitations,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
    panelsMemory.set(scope, record);
    return record;
  } catch {
    return null;
  }
}

export async function savePanelsCache(
  userEmail: string | null | undefined,
  payload: { panels: Panel[]; invitations: PanelInvitation[] },
): Promise<void> {
  const scope = getCacheScope(userEmail);
  const record: PanelsCacheRecord = {
    panels: payload.panels,
    invitations: payload.invitations,
    updatedAt: Date.now(),
  };
  panelsMemory.set(scope, record);
  try {
    await secureSetItem(getPanelsKey(scope), JSON.stringify(record));
  } catch {
    /* ignore */
  }
}

export async function loadTicketsCache(userEmail: string | null | undefined): Promise<TicketsCacheRecord | null> {
  const scope = getCacheScope(userEmail);
  const memory = ticketsMemory.get(scope);
  if (memory) return memory;
  try {
    const raw = await AsyncStorage.getItem(getTicketsKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TicketsCacheRecord;
    if (!Array.isArray(parsed?.tickets)) return null;
    const record: TicketsCacheRecord = {
      tickets: parsed.tickets,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
    ticketsMemory.set(scope, record);
    return record;
  } catch {
    return null;
  }
}

export async function saveTicketsCache(
  userEmail: string | null | undefined,
  tickets: Ticket[],
): Promise<void> {
  const scope = getCacheScope(userEmail);
  const record: TicketsCacheRecord = {
    tickets,
    updatedAt: Date.now(),
  };
  ticketsMemory.set(scope, record);
  try {
    await AsyncStorage.setItem(getTicketsKey(scope), JSON.stringify(record));
  } catch {
    /* ignore */
  }
}

