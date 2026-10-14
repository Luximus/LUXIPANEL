/* eslint-disable react-refresh/only-export-components -- registro y fallback comparten contrato */
/**
 * module-host (desktop) — contrato y registro de las PANTALLAS NATIVAS de módulo
 * de un servidor LUXIPANEL standalone (conexión DIRECTA por `serverApi`).
 *
 * Cada entrada del catálogo se abre en un drawable React local; los módulos
 * comunitarios sin implementación confiable muestran un estado nativo.
 */
import { Puzzle } from "lucide-react";
import { lazy } from "react";
import type { ComponentType } from "react";
import type { ThemeMode } from "../../features/app/types";
import { getMessages } from "../../i18n";

/**
 * Props que recibe TODA pantalla nativa de módulo. En modo directo el `token` es
 * irrelevante (`serverApi` lo ignora cuando el `serverId` está registrado como
 * DirectTarget), por eso no se pasa: cada módulo llama a `serverApi` con `""`.
 */
export interface ModuleProps {
  serverId: string;
  /** Nombre visible del módulo (título del catálogo), para cabeceras/placeholder. */
  moduleLabel: string;
  language?: string;
  theme: ThemeMode;
}

export type ModuleComponent = ComponentType<ModuleProps>;

// Drawables load only when opened. Mail/Files and their dependencies no longer
// hold the main workspace behind a large initial JavaScript bundle.
const MonitorModule = lazy(() => import("./monitor/MonitorModule").then((m) => ({ default: m.MonitorModule })));
const FilesModule = lazy(() => import("./files/FilesModule").then((m) => ({ default: m.FilesModule })));
const UsersModule = lazy(() => import("./users/UsersModule").then((m) => ({ default: m.UsersModule })));
const CronModule = lazy(() => import("./cron/CronModule").then((m) => ({ default: m.CronModule })));
const AlertsModule = lazy(() => import("./alerts/AlertsModule").then((m) => ({ default: m.AlertsModule })));
const SettingsModule = lazy(() => import("./settings/SettingsModule").then((m) => ({ default: m.SettingsModule })));
const ModulesModule = lazy(() => import("./modules/ModulesModule").then((m) => ({ default: m.ModulesModule })));
const ExpoModule = lazy(() => import("./expo/ExpoModule").then((m) => ({ default: m.ExpoModule })));
const ObsidianModule = lazy(() => import("./obsidian/ObsidianModule").then((m) => ({ default: m.ObsidianModule })));
const MailModule = lazy(() => import("./mail/MailModule").then((m) => ({ default: m.MailModule })));
const TerminalModule = lazy(() => import("./terminal/TerminalModule").then((m) => ({ default: m.TerminalModule })));
const AssistantModule = lazy(() => import("./assistant/AssistantModule").then((m) => ({ default: m.AssistantModule })));
const ModuleDevModule = lazy(() => import("./module-dev/ModuleDevModule").then((m) => ({ default: m.ModuleDevModule })));
const ProjectMapModule = lazy(() => import("./module-dev/ProjectMapModule").then((m) => ({ default: m.ProjectMapModule })));
const FirewallModule = lazy(() => import("./firewall/FirewallModule").then((m) => ({ default: m.FirewallModule })));
const DatabasesModule = lazy(() => import("./databases/DatabasesModule").then((m) => ({ default: m.DatabasesModule })));
const BitNinjaModule = lazy(() => import("./integrations/IntegrationModules").then((m) => ({ default: m.BitNinjaModule })));
const OpenClawModule = lazy(() => import("./integrations/IntegrationModules").then((m) => ({ default: m.OpenClawModule })));
const BackupsModule = lazy(() => import("./backups/BackupsModule").then((m) => ({ default: m.BackupsModule })));
const NginxModule = lazy(() => import("./nginx/NginxModule").then((m) => ({ default: m.NginxModule })));
const CloudflareModule = lazy(() => import("./cloudflare/CloudflareModule").then((m) => ({ default: m.CloudflareModule })));
const WebhooksModule = lazy(() => import("./webhooks/WebhooksModule").then((m) => ({ default: m.WebhooksModule })));
const CodebaseGraphModule = lazy(() => import("./codebase-graph/CodebaseGraphModule").then((m) => ({ default: m.CodebaseGraphModule })));
const HostingModule = lazy(() => import("./hosting/HostingModule").then((m) => ({ default: m.HostingModule })));
const RepositoryStoreModule = lazy(() => import("./repository-store/RepositoryStoreModule").then((m) => ({ default: m.RepositoryStoreModule })));
const FilesystemMcpModule = lazy(() => import("./integrations/McpModule").then((m) => ({ default: m.FilesystemMcpModule })));
const GithubMcpModule = lazy(() => import("./integrations/McpModule").then((m) => ({ default: m.GithubMcpModule })));
const GoogleDriveMcpModule = lazy(() => import("./integrations/McpModule").then((m) => ({ default: m.GoogleDriveMcpModule })));
const OnedriveMcpModule = lazy(() => import("./integrations/McpModule").then((m) => ({ default: m.OnedriveMcpModule })));
const DropboxMcpModule = lazy(() => import("./integrations/McpModule").then((m) => ({ default: m.DropboxMcpModule })));
const NotionMcpModule = lazy(() => import("./integrations/McpModule").then((m) => ({ default: m.NotionMcpModule })));

/**
 * Registro moduleId → pantalla nativa.
 */
export const MODULE_COMPONENTS: Record<string, ModuleComponent> = {
  chat: lazy(()=>import("./messaging/MessagingModule").then(m=>({default:m.MessagingModule}))),
  preferences: lazy(()=>import("./preferences/PreferencesModule").then(m=>({default:m.PreferencesModule}))),
  monitor: MonitorModule,
  files: FilesModule,
  users: UsersModule,
  cron: CronModule,
  "server-alerts": AlertsModule,
  settings: SettingsModule,
  modules: ModulesModule,
  expo: ExpoModule,
  obsidian: ObsidianModule,
  mail: MailModule,
  // Sintéticos (no vienen del catálogo del box): terminal SSH + asistente IA
  // nativos, montados como entradas fijas del rail (ver StandaloneServerScreen).
  terminal: TerminalModule,
  assistant: AssistantModule,
  "module-dev": ModuleDevModule,
  "project-map": ProjectMapModule,
  firewall: FirewallModule,
  databases: DatabasesModule,
  bitninja: BitNinjaModule,
  openclaw: OpenClawModule,
  backups: BackupsModule,
  dns: NginxModule,
  cloudflare: CloudflareModule,
  webhooks: WebhooksModule,
  "codebase-graph": CodebaseGraphModule,
  hosting: HostingModule,
  "repository-store": RepositoryStoreModule,
  "filesystem-mcp": FilesystemMcpModule,
  "github-mcp": GithubMcpModule,
  "google-drive": GoogleDriveMcpModule,
  onedrive: OnedriveMcpModule,
  dropbox: DropboxMcpModule,
  notion: NotionMcpModule,
};

/** Placeholder nativo (NUNCA webview) para módulos aún no portados. */
export function NativePendingPanel({ title, language }: { title: string; language?: string }) {
  const t = getMessages(language).serverStandalone;
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="flex max-w-xl flex-col items-start gap-2 rounded-xl border border-base-300 bg-base-100 p-5">
        <span className="inline-flex items-center gap-2 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning">
          <Puzzle size={13} /> {t.nativePending}
        </span>
        <p className="text-sm text-base-content/70">{t.nativePendingHint}</p>
      </div>
    </div>
  );
}
