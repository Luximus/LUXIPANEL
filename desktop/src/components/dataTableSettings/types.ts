import type { PanelTaxonomy, SshKeySummary } from "../../api/client";

// ── Public types (re-exported from ../DataTableSettings) ───────────────────

export type DataTableSettingsAdvanced = {
  token: string;
  taxonomy: PanelTaxonomy["categories"];
  sshKeys: SshKeySummary[];
  panels: Array<{ id: string; label: string }>;
  refreshTaxonomy: () => Promise<void>;
  refreshSshKeys: () => Promise<void>;
  refreshPanels?: () => Promise<void> | void;
  // Mutadores locales: tras la mutación en la API actualizan el estado en
  // memoria (taxonomía/ssh keys + reconciliación de paneles) sin refetch.
  applyCategoryCreated: (category: { id: string; name: string }) => void;
  applyCategoryRenamed: (id: string, name: string) => void;
  applyCategoryDeleted: (id: string) => void;
  applyTagCreated: (categoryId: string, tag: { id: string; name: string }) => void;
  applyTagRenamed: (id: string, name: string) => void;
  applyTagDeleted: (id: string) => void;
  applySshKeyCreated: (key: SshKeySummary) => void;
  applySshKeyUpdated: (key: SshKeySummary) => void;
  applySshKeyDeleted: (id: string) => void;
};

export type DataTableSettingsColumn = {
  id: string;
  header: string;
};

export type SettingsTab = "columns" | "categories" | "tags" | "ssh_keys" | "integrations" | "api";

// ── Sub-table row shapes ───────────────────────────────────────────────────

export type CategoryRow = Record<string, unknown> & {
  id: string;
  name: string;
  tagsCount: number;
  searchBlob: string;
};

export type TagRow = Record<string, unknown> & {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  searchBlob: string;
};

export type SshKeyRow = Record<string, unknown> & {
  id: string;
  linuxUsername: string;
  fingerprint: string;
  panelsCount: number;
  searchBlob: string;
};

export type ResourceRow = Record<string, unknown> & {
  id: string;
  name: string;
  region: string;
  size: string;
  status: string;
  ip: string;
  privateIp: string;
};
