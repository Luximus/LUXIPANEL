export type Panel = {
  id: string;
  licenseName: string | null;
  licenseKey: string | null;
  category: string | null;
  /** Notas libres del registro. Su primera línea ("<Proveedor> VPS") la usa
   *  `detectPanelProvider` cuando la categoría no coincide con un proveedor. */
  notes?: string | null;
  tags: string[];
  status: string;
  /** Prioridad de reactivación (mayor = primero). */
  priority?: number;
  serverIp: string | null;
  serverPort?: number | null;
  sshUsername?: string | null;
  sshKeyId?: string | null;
  sshKeyIds?: string[];
  sshKeyNickname?: string | null;
  /** Subdominio de acceso estable del panel. Lo devuelve `/portal/licenses`. */
  accessSubdomain?: string | null;
  /** @deprecated RETIRADO — subdominio managed *.luxipanel.com. El backend
   *  emite siempre `null`; NO usar en código nuevo. La URL canónica de acceso
   *  es `customDomain`. */
  managedDomain?: string | null;
  /** URL COMPLETA de acceso al LUXIPANEL del usuario (canónica): esquema y
   *  puerto opcionales ("https://panel.midominio.com:8443", "1.2.3.4:8443"). */
  customDomain: string | null;
  brandingLogoUrl?: string | null;
  sshSaveCredentials?: boolean;
  licenseState?: string;
  sshState?: string;
  ownership?: "owner" | "shared" | "granular_shared";
  owner?: { id: string; email: string | null; name: string | null } | null;
  /** Acceso granular: usuarios Linux que el receptor puede usar (no dueño). */
  sharedUsers?: Array<{ sshKeyId: string; linuxUsername: string | null; permission: string; expiresAt: string | null }>;
};

export type PanelInvitation = {
  id: string;
  /** Tipo: panel completo, acceso granular o membresía de grupo. */
  kind?: "panel_share" | "server_user_share" | "group";
  panelId: string;
  invitedAt: string;
  panelName: string;
  /** server_user_share: usuario Linux concedido. */
  linuxUsername?: string | null;
  /** group: nombre del grupo. */
  groupName?: string | null;
  owner: { id: string; email: string | null; name: string | null };
};

export type TicketAttachment = {
  url: string;
  type: string;
  name?: string;
  size?: number;
  key?: string;
};

export type Ticket = {
  id: string;
  customerId?: string;
  title: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "critical" | "high" | "medium" | "low";
  createdAt: string;
  updatedAt?: string;
  closedAt?: string | null;
  lastResponderRole?: "user" | "admin" | null;
  lastResponseAt?: string | null;
  assignedAdminId?: string | null;
  customer?: { name?: string | null; email?: string | null } | null;
  assignedAdmin?: { name?: string | null; email?: string | null } | null;
  messageCount?: number;
  /** Triage de staff: marcado como spam (cola de triage). */
  triageSpam?: boolean | null;
  /** Motivo del triage (cuando triageSpam es true). */
  triageReason?: string | null;
};

/** Agente asignable (staff) en el admin de tickets. */
export type StaffAgent = {
  id: string;
  name?: string | null;
  email?: string | null;
  /** Casos activos asignados al agente (para mostrar carga). */
  activeCases?: number | null;
  isAdmin?: boolean | null;
};

export type TicketMessage = {
  id: string;
  ticketId?: string;
  senderId?: string | null;
  content: string;
  createdAt: string;
  isAdmin: boolean;
  attachments?: TicketAttachment[];
  sender?: { name?: string | null; email?: string | null } | null;
};

export type TicketStatusHistoryEntry = {
  id: string;
  ticketId: string;
  fromStatus: "open" | "in_progress" | "resolved" | "closed" | null;
  toStatus: "open" | "in_progress" | "resolved" | "closed";
  changedByCustomerId?: string | null;
  changedByEmail?: string | null;
  changedAt: string;
  changedBy?: { name?: string | null; email?: string | null } | null;
};

export type TicketDetail = Ticket & {
  messages?: TicketMessage[];
  statusHistory?: TicketStatusHistoryEntry[];
};

export type TicketResponseState = "responded" | "awaiting_user" | "awaiting_admin" | "no_response";
