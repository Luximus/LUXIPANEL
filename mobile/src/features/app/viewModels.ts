import type { Panel, Ticket, TicketDetail, TicketResponseState } from "../../types/models";
import type { ServerMetrics, SshKeySummary } from "../../api/client";

/** Resultado del ping (test-connection SSH) al servidor del panel.
 *  `unknown` = no se puede sondear (sin IP/credenciales o panel compartido). */
export type ServerPingStatus = "checking" | "active" | "inactive" | "unknown";

/** Estado de las métricas de un panel para la UI (el detalle por métrica viva va
 *  en `metrics.liveStatus`). */
export type ServerMetricsState =
  | { status: "loading" }
  | { status: "ok"; metrics: ServerMetrics }
  | { status: "error" };

export type PanelRow = {
  id: string;
  nameLabel: string;
  serverIpMasked: string;
  serverIpRaw: string | null;
  categoryLabel: string;
  tags: string[];
  licenseState: string;
  sshState: string;
  /** Proveedor / origen del registro (Google Cloud, SSH directo, …). */
  provider: string;
  providerLabel: string;
  /** Estado en vivo del servidor según el último ping (test-connection SSH). */
  serverStatus: ServerPingStatus;
  accessDomain: string;
  searchBlob: string;
  canRecharge: boolean;
  canConnect: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  brandingLogoUrl?: string | null;
  source: Panel;
};

export type TicketRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  responseState: TicketResponseState;
  responseStateLabel: string;
  createdAtLabel: string;
  updatedAtLabel: string;
  closedAtLabel: string;
  searchBlob: string;
  source: Ticket;
};

export type PanelEditorState = {
  open: boolean;
  mode: "create" | "edit";
  panelId: string | null;
  ip: string;
  port: string;
  category: string;
  tags: string[];
  /** URL COMPLETA de acceso al LUXIPANEL (customDomain; esquema/puerto opcionales). */
  accessUrl: string;
  sshUsername: string;
  sshKeyIds: string[];
  sshPrivateKey: string;
  sshPassphrase: string;
  saving: boolean;
  error: string;
  /** Campo que falló la validación al guardar, para enfocar/resaltar en el modal.
   *  Se limpia al editar el campo correspondiente. `null` = sin error de campo. */
  invalidField: PanelEditorInvalidField;
};

/** Campos enfocables del PanelEditorModal que pueden señalarse como inválidos. */
export type PanelEditorInvalidField = "ip" | "accessUrl" | "sshUsername" | "sshPrivateKey" | "sshPassphrase" | null;

export type DeletePanelState = {
  open: boolean;
  panelId: string | null;
  panelName: string;
  saving: boolean;
  error: string;
};

export type ConnectionErrorState = {
  open: boolean;
  panelName: string;
  message: string;
  /** "connection" = no se pudo conectar / servidor caído; "session" = la sesión
   *  SSO del panel caducó. Cambia el título/copy del modal de reconexión. */
  kind?: "connection" | "session";
  /** Si true, el modal muestra el botón "Reconectar". El thunk de reintento real
   *  vive en un ref del controlador (`connectionRetryRef`), no aquí, para no
   *  guardar funciones en el estado. */
  canRetry?: boolean;
  /** True mientras corre el reintento de conexión (spinner en el botón). */
  reconnecting?: boolean;
};

/** Connect using a "local" SSH key that is NEVER persisted (not uploaded to
 *  the server, not stored on this device). Re-entered every session. */
export type ConnectLocalKeyState = {
  open: boolean;
  panelId: string | null;
  panelName: string;
  username: string;
  privateKey: string;
  passphrase: string;
  busy: boolean;
  error: string;
};

export type SshKeyOption = SshKeySummary;

export type TicketPriority = "critical" | "high" | "medium" | "low";

export type NewTicketState = {
  open: boolean;
  title: string;
  description: string;
  priority: TicketPriority;
  saving: boolean;
  error: string;
};

export type TicketDetailState = {
  open: boolean;
  loading: boolean;
  ticket: TicketDetail | null;
  replyContent: string;
  sending: boolean;
  error: string;
  pendingStatus: "open" | "in_progress" | "resolved" | "closed" | "";
  changingStatus: boolean;
};
