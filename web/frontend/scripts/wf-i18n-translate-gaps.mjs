export const meta = {
  name: 'luxipanel-i18n-translate-gaps',
  description: 'Re-translate only the missing keys per locale using small gap-chunks for reliable JSON; reassemble one gap-delta per locale.',
  phases: [{ title: 'TranslateGaps', detail: 'small chunks, only untranslated keys' }],
};

const LANG = {
  en: { label: 'English', model: 'haiku', rtl: false },
  fr: { label: 'French (Français)', model: 'haiku', rtl: false },
  de: { label: 'German (Deutsch)', model: 'haiku', rtl: false },
  it: { label: 'Italian (Italiano)', model: 'haiku', rtl: false },
  pt: { label: 'Portuguese (Português)', model: 'haiku', rtl: false },
  ru: { label: 'Russian (Русский)', model: 'sonnet', rtl: false },
  ar: { label: 'Arabic (العربية)', model: 'sonnet', rtl: true },
  bn: { label: 'Bengali (বাংলা)', model: 'sonnet', rtl: false },
  hi: { label: 'Hindi (हिन्दी)', model: 'sonnet', rtl: false },
  ja: { label: 'Japanese (日本語)', model: 'sonnet', rtl: false },
  ko: { label: 'Korean (한국어)', model: 'sonnet', rtl: false },
};

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    code: { type: 'string' },
    json: { type: 'string', description: 'Translated chunk: COMPLETE valid minified JSON, SAME keys/shape, only values translated.' },
  },
  required: ['code', 'json'],
};

function promptFor(task) {
  const lang = LANG[task.code];
  return `Translate a small fragment of the LUXIPANEL server-control-panel UI from Spanish (some entries may be English — translate those too) into ${lang.label}.

Read the source with the Read tool at this EXACT absolute path:
  /tmp/i18n-gap-${task.code}-${task.n}.json
It is a small nested JSON object of UI strings.

Return structured fields: code="${task.code}" and json = the translated fragment as a
COMPLETE, valid, parseable, MINIFIED JSON object with the EXACT same structure, keys
and nesting — translate ONLY the string values.

HARD RULES — never translate/alter:
- object keys (byte-for-byte);
- {curly} placeholders ({domain},{count},{host},{range},{folder},{mode},{name},{email},{path},{size},{rate},{time},{message},{vaultName},{code},{view},{destination},{total},{matched},{number},{jail},{ip},{pct},{n},{applied}...) keep verbatim, in place;
- inline HTML tags/entities (<b>,<strong>,<br>,&gt;,&lt;,&amp;) keep and position;
- brands LUXIPANEL, LuxiPanel, LUXISOFT;
- tech tokens identical across locales: CPU, RAM, SSL, TLS, DNS, NGINX, SSH, UFW, Fail2ban, BitNinja, TOTP, Passkey, API, API Key, PID, UID, GID, SIGTERM, systemd, SMTP, IMAP, POP3, DKIM, SPF, DMARC, S3, R2, AWS, MB, GB, KB, RX, TX, HTTP(S), URL, JSON, cron, tmux, VAPID, INBOX, regex; file paths, shell commands, code samples, email/URL examples, numbers, versions;
- emoji/symbols (⚠ ▲ 🔺 →) keep as-is.
Style: concise, idiomatic UI wording; keep it short.
${lang.rtl ? 'Right-to-left language: translate normally; no directional control characters.' : ''}
Output ONLY the structured fields. "json" MUST be the whole fragment as valid JSON, no fences, no commentary.`;
}

// args = { code: numChunks, ... }; derive the flat task list. (args may arrive
// as a JSON string depending on the caller — parse defensively.)
let spec = args || {};
if (typeof spec === 'string') { try { spec = JSON.parse(spec); } catch { spec = {}; } }
const tasks = [];
for (const [code, num] of Object.entries(spec)) {
  if (!LANG[code]) continue;
  for (let n = 0; n < Number(num); n++) tasks.push({ code, n });
}
log(`Gap tasks built: ${tasks.length}`);
phase('TranslateGaps');
const results = await parallel(
  tasks.map((task) => () =>
    agent(promptFor(task), {
      label: `g:${task.code}#${task.n}`,
      phase: 'TranslateGaps',
      model: LANG[task.code].model,
      schema: SCHEMA,
    }),
  ),
);

function deepMerge(b, d) {
  for (const k of Object.keys(d)) {
    const dv = d[k], bv = b[k];
    if (dv && typeof dv === 'object' && !Array.isArray(dv) && bv && typeof bv === 'object' && !Array.isArray(bv)) deepMerge(bv, dv);
    else b[k] = dv;
  }
  return b;
}

const perLocale = {};
let parseFails = 0;
const okByCode = {};
for (const r of results) {
  if (!r) { parseFails++; continue; }
  let obj;
  try { obj = JSON.parse(r.json); } catch { parseFails++; continue; }
  perLocale[r.code] ??= {};
  deepMerge(perLocale[r.code], obj);
  okByCode[r.code] = (okByCode[r.code] || 0) + 1;
}
log(`Gap translate done. tasks=${tasks.length} parseFails=${parseFails} ` + Object.entries(okByCode).map(([c, n]) => `${c}:${n}`).join(' '));
return { parseFails, okByCode, locales: Object.entries(perLocale).map(([code, obj]) => ({ code, json: JSON.stringify(obj) })) };
