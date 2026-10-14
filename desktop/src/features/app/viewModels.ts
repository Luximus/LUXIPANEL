import type { Panel, Ticket, TicketDetail, TicketResponseState } from "../../types/models";
import type { ServerMetrics, SshKeySummary } from "../../api/client";

/** Resultado del ping (test-connection SSH) al servidor del panel.
 *  `unknown` = no se puede sondear (sin IP/credenciales o panel compartido). */
export type ServerPingStatus = "checking" | "active" | "inactive" | "unknown";

/** Estado de las métricas de un panel para la UI: cargando, ok (con datos; el
 *  detalle de disponibilidad por métrica viva va en `metrics.liveStatus`), o
 *  error de red. */
export type ServerMetricsState =
  | { status: "loading" }
  | { status: "ok"; metrics: ServerMetrics }
  | { status: "error" };

export type PanelRow = {
  id: string;
  nameLabel: string;
  serverIpMasked: string;
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
  accessSubdomain: string;
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
  /** Passphrase de la llave privada (obligatoria al registrar una llave nueva:
   *  el backend la exige para poder elevar con `sudo -S`). */
  sshPassphrase: string;
  saving: boolean;
  error: string;
  /** Campo obligatorio que falló la validación al guardar, para que el modal
   *  cambie a su pestaña y lo enfoque/resalte. Se limpia al editar cualquier
   *  campo o al reabrir. */
  failedField?: PanelEditorField | null;
};

/** Campos del editor de panel que la validación de obligatorios puede marcar. */
export type PanelEditorField = "ip" | "accessUrl" | "sshUsername" | "sshPrivateKey" | "sshPassphrase";

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
  /** Campo que falló la validación al enviar, para enfocarlo/resaltarlo. */
  failedField?: "username" | "privateKey" | null;
};

export type ConnectMethodState = {
  open: boolean;
  panelId: string | null;
  panelName: string;
  hasSavedSsh: boolean;
};

/** Picker shown when a panel has more than one assigned SSH key, so the user
 *  chooses which saved key to connect with (mirror of /frontend + /app). */
export type ConnectKeyState = {
  open: boolean;
  panelId: string | null;
  panelName: string;
  keys: SshKeySummary[];
  selectedKeyId: string;
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
  /** Campo que falló la validación al enviar, para enfocarlo/resaltarlo. */
  failedField?: "title" | "description" | null;
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
