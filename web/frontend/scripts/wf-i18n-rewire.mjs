export const meta = {
  name: 'luxipanel-i18n-rewire',
  description: 'Audit every LUXIPANEL module/page/script/component, extract hardcoded UI strings into the i18n namespace and rewire references (Spanish verbatim, no translation).',
  phases: [{ title: 'Rewire', detail: 'one agent per module group; disjoint files + namespaces' }],
};

const RULES = `
You are auditing & internationalizing part of LUXIPANEL (an Astro SSR + React
server-control panel). Spanish is the source language. Your job: find EVERY
user-facing string that is still HARDCODED in your assigned files and move it
into the i18n system, then reference it. DO NOT TRANSLATE — keep the Spanish text
byte-for-byte (exact words, accents, punctuation). English strings that are
clearly UI text (e.g. "Loading", "Save") must also be extracted, kept verbatim.

=========================  STRICT SCOPE  =========================
You may ONLY edit the files listed under "YOUR FILES". You must NOT touch:
  - any src/i18n/<locale>/*.ts (the per-module locale dictionaries — handled later)
  - src/i18n/*.generated.ts and src/i18n/namespaces.generated.ts (generated)
  - any other module's files
You must NOT run builds, astro check, tsc, pnpm, or pm2. Just edit your files.

=====================  WHAT TO EXTRACT  =====================
Every human-visible Spanish/English string:
  - visible text nodes in .astro templates and JSX
  - attributes shown to users: title=, aria-label=, placeholder=, alt=
  - button/link/menu/tab labels, dialog & confirm text, empty/loading states
  - toast / alert / notification / error messages
  - <option> visible labels (NOT their value= machine codes)
  - strings built in scripts/TSX and injected into the DOM (textContent,
    innerHTML, insertAdjacentHTML, template literals rendered to the user,
    confirm()/toast messages)
DO NOT extract / leave untouched: class names, id, data-* keys, icon classes
(ti ti-*), <option> value= codes, activeModule=, URLs/hrefs/paths, shell
commands, code samples, numbers, console.log/console.error debug text, and brand
/ tech tokens that are identical in every language (LUXIPANEL, LUXISOFT, NGINX,
CPU, RAM, SSL, TLS, DNS, SSH, UFW, Fail2ban, BitNinja, TOTP, Passkey, API, API
Key, SMTP, IMAP, DKIM, SPF, DMARC, S3, R2, AWS, MB, GB, KB, RX, TX, HTTP(S),
URL, JSON, cron, PID, UID, GID, systemd, SIGTERM). Leave purely technical text.
If a string interpolates a runtime value, use a {placeholder} token in the i18n
value and format it at the call site (keep existing interpolation working).

=====================  HOW TO REFERENCE (by file type)  =====================
Read each file first and FOLLOW THE PATTERN ALREADY USED in that file/module.

(1) .astro pages/components:
  The frontmatter defines  const t = await getMessages(locale, [<namespaces>]).
  Ensure YOUR namespace "<NS>" is in that array (add it if missing — do not
  remove existing ones). Reference text as {t.<NS>.someKey} and attributes as
  title={t.<NS>.someKey}. Pages serialize the namespace for their script via
  <script type="application/json" set:html={JSON.stringify(t["<NS>"])}> — if such
  a tag exists keep it; new keys flow to the script automatically.

(2) scripts/extracted/**/*.ts (browser scripts):
  They read their slice via  document.getElementById("<x>-i18n")  -> JSON.parse
  into a module-level object (often named I18N / MSG / messages), OR they read
  data-* attributes that the .astro filled from t.<NS>.*. To add a string:
  reference it through that existing i18n object (e.g. I18N.someKey) — and make
  sure the corresponding key exists in your returned delta so the page emits it.
  If the script has NO i18n object yet, add the minimal loader following the
  sibling scripts' pattern (getElementById("<NS>-i18n") JSON.parse, with a {}
  fallback) and ensure the page emits <script type="application/json"
  id="<NS>-i18n" set:html={JSON.stringify(t["<NS>"])}></script>.

(3) React .tsx that ALREADY consume i18n (floating-assistant):
  Use the existing hook:  const t = useAssistantI18n().<section>;  then t.someKey.
  Add your keys under  assistant.<section>.*  (the <section> matching this
  component, e.g. providersTab, dashboardTab, modulesTab, serversTab). Never
  invent a second copy of a shared key.

(4) React .tsx that do NOT consume i18n yet (terminal, files islands, DataTable):
  Establish the bridge like AssistantPanel.tsx does:
    - import { getClientMessages } from "@/i18n/client";
    - accept a  locale: string  prop (thread it from the .astro mount, e.g.
      <Island client:only="react" locale={locale} /> — add  const locale =
      localeFromCookieHeader(Astro.request.headers.get("cookie"))  in the .astro
      frontmatter if absent),
    - keep a typed fallback messages object (Spanish verbatim) and
      useState/useEffect to load getClientMessages(locale, ["<NS>"]).
    - reference messages.<key>. Be conservative: do not break the island's
      existing behavior; if wiring a component is genuinely unsafe, leave it and
      describe it in "notes" rather than half-wiring it.

=====================  KEY NAMING  =====================
All NEW keys you create live under YOUR namespace root "<NS>" ONLY. Use nested,
descriptive camelCase keys grouped by section/component, so two agents can never
collide (e.g. <NS>.<section>.<thing>). Reuse an existing key in your namespace if
it already holds the exact same Spanish string. Every reference you write MUST
have a matching entry in your returned delta, and vice-versa (no dangling refs,
no unused keys).

=====================  RETURN  =====================
Return the structured fields. "deltaJson" = a COMPLETE valid JSON string of an
object ROOTED AT YOUR NAMESPACE, i.e. { "<NS>": { ...only the NEW keys you added,
nested exactly as referenced, Spanish values verbatim... } }. If you added keys
under more than one namespace you own, include each as a top-level root. If you
added NO keys, return "{}".
`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    group: { type: 'string' },
    deltaJson: { type: 'string', description: 'Valid JSON: { "<ns>": { ...new keys, Spanish verbatim... } }, or "{}"' },
    keyCount: { type: 'number' },
    filesEdited: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string', description: 'Anything skipped/risky, plumbing added, or follow-ups.' },
  },
  required: ['group', 'deltaJson', 'keyCount', 'filesEdited', 'notes'],
};

// Each group owns a disjoint set of files. New keys go under `ns` (the assistant
// tab group shares the `assistant` root but uses per-component sub-sections, so
// subtrees stay disjoint and deep-merge cleanly).
const GROUPS = [
  { id: 'monitor', ns: 'monitor', model: 'sonnet', files: ['src/pages/panel/monitor/index.astro','src/scripts/extracted/pages/panel/monitor/index-script1.ts','src/scripts/extracted/pages/panel/monitor/charts.ts'] },
  { id: 'users', ns: 'users', model: 'sonnet', files: ['src/pages/panel/users/index.astro','src/scripts/extracted/pages/panel/users/index-script1.ts'] },
  { id: 'mail', ns: 'mail', model: 'sonnet', files: ['src/pages/panel/mail/index.astro','src/pages/panel/mail/compose.astro','src/pages/panel/mail/[id]/inbox.astro','src/scripts/extracted/pages/panel/mail/index-script1.ts','src/scripts/extracted/pages/panel/mail/compose-script1.ts','src/scripts/extracted/pages/panel/mail/[id]/inbox-script1.ts'] },
  { id: 'firewall', ns: 'firewall', model: 'sonnet', files: ['src/pages/panel/firewall/index.astro','src/scripts/extracted/pages/panel/firewall/index-script1.ts'] },
  { id: 'cron', ns: 'cron', model: 'sonnet', files: ['src/pages/panel/cron/index.astro','src/scripts/extracted/pages/panel/cron/index-script1.ts'] },
  { id: 'nginx', ns: 'nginx', model: 'sonnet', files: ['src/pages/panel/nginx/index.astro','src/scripts/extracted/pages/panel/nginx/index-script1.ts'] },
  { id: 'backups', ns: 'backups', model: 'sonnet', files: ['src/pages/panel/backups/index.astro','src/scripts/extracted/pages/panel/backups/index-script1.ts'] },
  { id: 'bitninja', ns: 'bitninja', model: 'sonnet', files: ['src/pages/panel/bitninja/index.astro','src/scripts/extracted/pages/panel/bitninja/index-script1.ts'] },
  { id: 'webhooks', ns: 'webhooks', model: 'sonnet', files: ['src/pages/panel/webhooks/index.astro','src/scripts/extracted/pages/panel/webhooks/index-script1.ts'] },
  { id: 'modules', ns: 'modules', model: 'sonnet', files: ['src/pages/panel/modules/index.astro','src/scripts/extracted/pages/panel/modules/index-script1.ts'] },
  { id: 'preferences', ns: 'preferences', model: 'sonnet', files: ['src/pages/panel/preferences/index.astro','src/scripts/extracted/pages/panel/preferences/index-script1.ts'] },
  { id: 'repositoryStore', ns: 'repositoryStore', model: 'sonnet', files: ['src/pages/panel/repository-store/index.astro','src/pages/panel/repository-store/[owner]/[repo].astro','src/scripts/extracted/pages/panel/repository-store/index-script1.ts','src/scripts/extracted/pages/panel/repository-store/[owner]/[repo]-define-vars-script1.ts'] },
  { id: 'hosting', ns: 'hosting', model: 'sonnet', files: ['src/pages/panel/hosting/index.astro','src/pages/panel/docs/hosting-api.astro','src/scripts/extracted/pages/panel/hosting/index-script1.ts'] },
  { id: 'expo', ns: 'expo', model: 'sonnet', files: ['src/pages/panel/expo/index.astro','src/scripts/extracted/pages/panel/expo/index-script1.ts'] },
  { id: 'cloudflare', ns: 'cloudflare', model: 'sonnet', files: ['src/pages/panel/cloudflare/index.astro','src/scripts/extracted/pages/panel/cloudflare/index-script1.ts'] },
  { id: 'databases', ns: 'databases', model: 'sonnet', files: ['src/pages/panel/databases/index.astro','src/scripts/extracted/pages/panel/databases/index-script1.ts'] },
  { id: 'obsidian', ns: 'obsidian', model: 'sonnet', files: ['src/pages/panel/obsidian/index.astro','src/scripts/extracted/pages/panel/obsidian/index-script1.ts'] },
  { id: 'serverAlerts', ns: 'serverAlerts', model: 'sonnet', files: ['src/pages/panel/server-alerts/index.astro','src/scripts/extracted/pages/panel/server-alerts/index-script1.ts'] },
  { id: 'moduleDev', ns: 'moduleDev', model: 'sonnet', files: ['src/pages/panel/module-dev/index.astro','src/scripts/extracted/pages/panel/module-dev/index-script1.ts'] },
  { id: 'dashboard', ns: 'dashboard', model: 'sonnet', files: ['src/pages/panel/index.astro','src/scripts/extracted/pages/panel/index-redirect-script1.ts'] },
  { id: 'settings', ns: 'settings', model: 'sonnet', files: ['src/pages/panel/settings/index.astro','src/scripts/extracted/pages/panel/settings/index-script1.ts','src/scripts/extracted/pages/panel/settings/index-script2.ts','src/scripts/extracted/pages/panel/settings/index-script3.ts','src/scripts/extracted/pages/panel/settings/credentials-script1.ts','src/scripts/extracted/pages/panel/settings/modules-cache.ts','src/components/settings/LoginEffectControl.astro'] },
  { id: 'assistant-core', ns: 'assistant', model: 'opus', files: ['src/pages/panel/assistant/index.astro','src/components/floating-assistant/AssistantPanel.tsx','src/components/floating-assistant/AssistantView.tsx','src/components/floating-assistant/FloatingAssistantDrawer.tsx','src/components/floating-assistant/ChatPane.tsx','src/components/floating-assistant/assistant-api.ts','src/components/floating-assistant/chat-engine.ts'] },
  { id: 'assistant-tabs', ns: 'assistant', model: 'opus', files: ['src/components/floating-assistant/DashboardTab.tsx','src/components/floating-assistant/ModulesTab.tsx','src/components/floating-assistant/ProvidersTab.tsx','src/components/floating-assistant/ServersTab.tsx','src/components/floating-assistant/McpConfigPanel.tsx','src/components/floating-assistant/ProjectModal.tsx','src/components/floating-assistant/OfficeConnectors.tsx','src/components/floating-assistant/CliUsageBars.tsx','src/components/floating-assistant/ConversationMedia.tsx'] },
  { id: 'terminal', ns: 'terminal', model: 'opus', files: ['src/components/floating-terminal/FloatingTerminal.astro','src/components/floating-terminal/FloatingTerminalDrawer.tsx','src/components/floating-terminal/TerminalPanel.tsx','src/components/floating-terminal/TerminalView.tsx','src/components/floating-terminal/cli-registry.ts','src/scripts/extracted/components/floating-terminal/floating-terminal.ts','src/pages/panel/terminal/index.astro'] },
  { id: 'files', ns: 'files', model: 'opus', files: ['src/pages/panel/files/index.astro','src/scripts/extracted/pages/panel/files/index-script1.ts','src/components/panel-files/FilesWorkspace.tsx','src/components/panel-files/ProjectMapDrawer.tsx'] },
  { id: 'shared-chrome', ns: 'components', model: 'opus', extraNs: ['panelLayout','common','baseLayout','login','entry'], files: ['src/layouts/PanelLayout.astro','src/scripts/extracted/layouts/PanelLayout-define-vars-script1.ts','src/scripts/extracted/layouts/branding-runtime.ts','src/scripts/extracted/layouts/server-clock.ts','src/scripts/extracted/layouts/server-switcher.ts','src/components/auth/AuthWizardFooter.astro','src/components/ui/DataTable.tsx','src/pages/login.astro','src/scripts/extracted/pages/login-define-vars-script1.ts','src/pages/enter.astro','src/scripts/extracted/pages/sso/callback-script1.ts','src/scripts/extracted/lib/install-modal.ts','src/scripts/extracted/lib/native-bridge.ts'] },
];

function promptFor(g) {
  const nsLine = g.extraNs
    ? `YOUR NAMESPACE(S): primary "${g.ns}". You also OWN these namespaces (put keys where they belong): ${[g.ns, ...g.extraNs].join(', ')}. Each .astro already loads the ones it needs via getMessages; add any missing one to that array.`
    : `YOUR NAMESPACE: "${g.ns}". ALL new keys go under the "${g.ns}" root.`;
  return `${RULES}

============================================================
GROUP: "${g.id}"
${nsLine.replace(/<NS>/g, g.ns)}

YOUR FILES (edit ONLY these):
${g.files.map((f) => `  - ${f}`).join('\n')}

Read every file fully, extract ALL hardcoded user-facing strings per the rules,
rewire each reference, and return the structured summary with deltaJson rooted at
your namespace(s). Spanish stays verbatim. Touch no other files.`.replace(/<NS>/g, g.ns);
}

phase('Rewire');
const results = await parallel(
  GROUPS.map((g) => () =>
    agent(promptFor(g), {
      label: `rewire:${g.id}`,
      phase: 'Rewire',
      agentType: 'i18n-migrator',
      model: g.model,
      schema: SCHEMA,
    }),
  ),
);

const ok = results.filter(Boolean);
log(`Rewire done: ${ok.length}/${GROUPS.length} groups returned`);
return {
  groups: ok.map((r) => ({ group: r.group, keyCount: r.keyCount, files: r.filesEdited.length, notes: r.notes, deltaJson: r.deltaJson })),
  totalKeys: ok.reduce((s, r) => s + (r.keyCount || 0), 0),
};
