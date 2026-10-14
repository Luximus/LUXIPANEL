import type { LocaleCode } from "../locales";
import { LOCALES } from "../locales";
import { sshFingerprint } from "./screens/sshFingerprint";
import { connectLocalKey } from "./screens/connectLocalKey";
import { connectMethod } from "./screens/connectMethod";
import { common } from "./screens/common";
import { offline } from "./screens/offline";
import { update } from "./screens/update";
import { account } from "./screens/account";
import { login } from "./screens/login";
import { titleBar } from "./screens/titleBar";
import { splash } from "./screens/splash";
import { auth } from "./screens/auth";
import { dashboard } from "./screens/dashboard";
import { importExport } from "./screens/importExport";
import { support } from "./screens/support";
import { ticketDetail } from "./screens/ticketDetail";
import { newTicket } from "./screens/newTicket";
import { panelEditor } from "./screens/panelEditor";
import { deletePanel } from "./screens/deletePanel";
import { assignLicense } from "./screens/assignLicense";
import { dataTable } from "./screens/dataTable";
import { settingsModals } from "./screens/settingsModals";
import { dataTableSettings } from "./screens/dataTableSettings";
import { uploads } from "./screens/uploads";
import { accessLinks } from "./screens/accessLinks";
import { panelTable } from "./screens/panelTable";
import { ticketTable } from "./screens/ticketTable";
import { security } from "./screens/security";
import { errors } from "./screens/errors";
import { connectionError } from "./screens/connectionError";
import { payments } from "./screens/payments";
import { payouts } from "./screens/payouts";
import { supportAssistant } from "./screens/supportAssistant";
import { admin } from "./screens/admin";
import { blog } from "./screens/blog";
import { jobs } from "./screens/jobs";
import { blogfeed } from "./screens/blogfeed";
import { publicaciones } from "./screens/publicaciones";
import { audit } from "./screens/audit";
import { sharing } from "./screens/sharing";
import { rateLimit } from "./screens/rateLimit";
import { modules } from "./screens/modules";
import { serverTable } from "./screens/serverTable";
import { serverUsers } from "./screens/server-users";
import { serverMonitor } from "./screens/server-monitor";
import { serverFiles } from "./screens/server-files";
import { serverAlerts } from "./screens/server-alerts";
import { serverCron } from "./screens/server-cron";
import { serverExpo } from "./screens/server-expo";
import { serverObsidian } from "./screens/server-obsidian";
import { serverMail } from "./screens/server-mail";
import { serverModulesView } from "./screens/server-modules";
import { serverSettings } from "./screens/server-settings";
import { serverStandalone } from "./screens/server-standalone";
import { assistantSettings } from "./screens/assistant-settings";
import { assistantComposer } from "./screens/assistant-composer";
import { assistantHeader } from "./screens/assistant-header";
import { assistantChat } from "./screens/assistant-chat";
import { assistantDrawer } from "./screens/assistant-drawer";

// Every per-screen module keyed by its namespace. Add a screen here once and
// it flows into both the `Messages` type and the assembled locale objects.
const SCREENS = {
  sshFingerprint,
  connectLocalKey,
  connectMethod,
  common,
  offline,
  update,
  account,
  login,
  titleBar,
  splash,
  auth,
  dashboard,
  importExport,
  support,
  ticketDetail,
  newTicket,
  panelEditor,
  deletePanel,
  assignLicense,
  dataTable,
  settingsModals,
  dataTableSettings,
  uploads,
  accessLinks,
  panelTable,
  ticketTable,
  security,
  errors,
  connectionError,
  payments,
  payouts,
  supportAssistant,
  admin,
  blog,
  jobs,
  blogfeed,
  publicaciones,
  audit,
  sharing,
  rateLimit,
  modules,
  serverTable,
  serverUsers,
  serverMonitor,
  serverFiles,
  serverAlerts,
  serverCron,
  serverExpo,
  serverObsidian,
  serverMail,
  serverModulesView,
  serverSettings,
  serverStandalone,
  assistantSettings,
  assistantComposer,
  assistantHeader,
  assistantChat,
  assistantDrawer,
} as const;

// Public message shape = Spanish slice of each screen (already widened to string).
export type Messages = {
  [K in keyof typeof SCREENS]: (typeof SCREENS)[K]["es"];
};

function assemble(locale: LocaleCode): Messages {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(SCREENS) as (keyof typeof SCREENS)[]) {
    out[key] = SCREENS[key][locale];
  }
  return out as Messages;
}

// One assembled object per supported locale, built once at module load.
export const ALL_MESSAGES = Object.fromEntries(
  LOCALES.map((l) => [l.code, assemble(l.code)]),
) as Record<LocaleCode, Messages>;
