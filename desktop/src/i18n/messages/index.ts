import type { LocaleCode } from "../locales";
import { LOCALES } from "../locales";
import { sshFingerprint } from "./screens/sshFingerprint";
import { connectLocalKey } from "./screens/connectLocalKey";
import { connectMethod } from "./screens/connectMethod";
import { connectSshKey } from "./screens/connectSshKey";
import { common } from "./screens/common";
import { toast } from "./screens/toast";
import { offline } from "./screens/offline";
import { update } from "./screens/update";
import { rateLimit } from "./screens/rateLimit";
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
import { dataTableSettings } from "./screens/dataTableSettings";
import { uploads } from "./screens/uploads";
import { panelTable } from "./screens/panelTable";
import { ticketTable } from "./screens/ticketTable";
import { errors } from "./screens/errors";
import { connectionError } from "./screens/connectionError";
import { security } from "./screens/security";
import { payments } from "./screens/payments";
import { payouts } from "./screens/payouts";
import { supportAssistant } from "./screens/supportAssistant";
import { admin } from "./screens/admin";
import { blog } from "./screens/blog";
import { feed } from "./screens/feed";
import { audit } from "./screens/audit";
import { sharing } from "./screens/sharing";
import { jobs } from "./screens/jobs";
import { publicaciones } from "./screens/publicaciones";
import { serverStandalone } from "./screens/serverStandalone";
import { serverMonitor } from "./screens/server-monitor";
import { serverFiles } from "./screens/server-files";
import { serverUsers } from "./screens/server-users";
import { serverCron } from "./screens/server-cron";
import { serverAlerts } from "./screens/server-alerts";
import { serverSettings } from "./screens/server-settings";
import { serverModulesView } from "./screens/server-modules";
import { serverExpo } from "./screens/server-expo";
import { serverObsidian } from "./screens/server-obsidian";
import { serverMail } from "./screens/server-mail";
import { devPortal } from "./screens/dev-portal";
import { moduleStore } from "./screens/module-store";

// Every per-screen module keyed by its namespace. Add a screen here once and
// it flows into both the `Messages` type and the assembled locale objects.
const SCREENS = {
  sshFingerprint,
  connectLocalKey,
  connectMethod,
  connectSshKey,
  common,
  toast,
  offline,
  update,
  rateLimit,
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
  dataTableSettings,
  uploads,
  panelTable,
  ticketTable,
  errors,
  connectionError,
  security,
  payments,
  payouts,
  supportAssistant,
  admin,
  blog,
  feed,
  audit,
  sharing,
  jobs,
  publicaciones,
  serverStandalone,
  serverMonitor,
  serverFiles,
  serverUsers,
  serverCron,
  serverAlerts,
  serverSettings,
  serverModulesView,
  serverExpo,
  serverObsidian,
  serverMail,
  devPortal,
  moduleStore,
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
