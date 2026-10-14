export const meta = {
  name: 'luxipanel-i18n-translate',
  description: 'Translate the LUXIPANEL Spanish i18n delta (1999 new keys, 12 chunks) into 11 languages, then reassemble one translated delta per locale.',
  phases: [{ title: 'Translate', detail: '11 languages x 12 chunks' }],
};

const CHUNKS = 12;
const languages = [
  { code: 'en', label: 'English',            model: 'haiku',  rtl: false },
  { code: 'fr', label: 'French (Français)',  model: 'haiku',  rtl: false },
  { code: 'de', label: 'German (Deutsch)',   model: 'haiku',  rtl: false },
  { code: 'it', label: 'Italian (Italiano)', model: 'haiku',  rtl: false },
  { code: 'pt', label: 'Portuguese (Português)', model: 'haiku', rtl: false },
  { code: 'ru', label: 'Russian (Русский)',  model: 'sonnet', rtl: false },
  { code: 'ar', label: 'Arabic (العربية)',   model: 'sonnet', rtl: true  },
  { code: 'bn', label: 'Bengali (বাংলা)',     model: 'sonnet', rtl: false },
  { code: 'hi', label: 'Hindi (हिन्दी)',       model: 'sonnet', rtl: false },
  { code: 'ja', label: 'Japanese (日本語)',   model: 'sonnet', rtl: false },
  { code: 'ko', label: 'Korean (한국어)',      model: 'sonnet', rtl: false },
];

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    code: { type: 'string' },
    chunk: { type: 'number' },
    json: { type: 'string', description: 'Translated chunk: a COMPLETE valid minified JSON object, SAME keys/shape/order as the source, only string VALUES translated.' },
  },
  required: ['code', 'chunk', 'json'],
};

function promptFor(lang, n) {
  return `Translate a fragment of the LUXIPANEL server-control-panel UI from Spanish (some entries may already be in English — translate those too) into ${lang.label}.

Read the source fragment with the Read tool at this EXACT absolute path:
  /tmp/i18n-chunk-${n}.json
It is a nested JSON object of UI strings.

Return structured fields: code="${lang.code}", chunk=${n}, and json = the translated
fragment as a COMPLETE, valid, parseable, MINIFIED JSON object with the EXACT same
structure, keys, nesting and order — translate ONLY the string values.

HARD RULES — never translate/alter:
- object keys (keep byte-for-byte);
- {curly} placeholder tokens (e.g. {domain},{count},{host},{range},{folder},{mode},{name},{email},{path},{size},{rate},{time},{message},{vaultName},{code},{view},{destination},{total},{matched}) — keep verbatim and in place;
- inline HTML tags/entities inside values (<b>,<strong>,<br>,&gt;,&lt;,&amp;) — keep them and their position, translate only the surrounding words;
- brands: LUXIPANEL, LuxiPanel, LUXISOFT;
- tech tokens/acronyms identical across locales: CPU, RAM, SSL, TLS, DNS, NGINX, SSH, UFW, Fail2ban, BitNinja, TOTP, Passkey, API, API Key, PID, UID, GID, SIGTERM, systemd, SMTP, IMAP, POP3, DKIM, SPF, DMARC, S3, R2, AWS, MB, GB, KB, RX, TX, HTTP(S), URL, JSON, cron, tmux, VAPID, INBOX, regex, IMAP/POP3 — and file paths, shell commands, code samples, email/URL examples, numbers, version strings;
- emoji/symbols (⚠ ▲ →) keep as-is.
Style: concise, idiomatic UI wording for buttons/labels/menus/dialogs; keep it short.
${lang.rtl ? 'This is a right-to-left language: translate normally; the UI handles direction; insert no directional control characters.' : ''}
Output ONLY the structured fields. "json" MUST contain the whole fragment as valid JSON, no markdown fences, no commentary.`;
}

const tasks = [];
for (const lang of languages) for (let n = 0; n < CHUNKS; n++) tasks.push({ lang, n });

phase('Translate');
const results = await parallel(
  tasks.map((t) => () =>
    agent(promptFor(t.lang, t.n), {
      label: `t:${t.lang.code}#${t.n}`,
      phase: 'Translate',
      model: t.lang.model,
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

// Reassemble one translated delta per locale.
const perLocale = {};
const stats = {};
let parseFails = 0;
for (const r of results) {
  if (!r) { parseFails++; continue; }
  let obj;
  try { obj = JSON.parse(r.json); } catch { parseFails++; stats[r.code] = stats[r.code] || { chunks: 0, bad: 0 }; stats[r.code].bad++; continue; }
  perLocale[r.code] ??= {};
  deepMerge(perLocale[r.code], obj);
  stats[r.code] = stats[r.code] || { chunks: 0, bad: 0 };
  stats[r.code].chunks++;
}

log(`Translate done. parseFails=${parseFails}. ` + Object.entries(stats).map(([c, s]) => `${c}:${s.chunks}/${CHUNKS}`).join(' '));

return {
  parseFails,
  stats,
  locales: Object.entries(perLocale).map(([code, obj]) => ({ code, json: JSON.stringify(obj) })),
};
