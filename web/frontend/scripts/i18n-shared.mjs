// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
//
// Shared i18n helpers for the per-module locale layout.
//
// Source of truth layout (since 2026-06-25): one file PER MODULE PER LOCALE at
//   src/i18n/<locale>/<namespace>.ts   e.g. src/i18n/en/users.ts
// Each file is `const <name> = { ... } as const;\nexport default <name>;`.
// The old monolithic src/i18n/locales/<locale>.ts files were retired — editing
// a 7000-line file is what this layout removes. These helpers load/serialize
// the per-module files and are reused by the build (i18n:split), the migration
// script and the translation-merge tooling so all paths stay byte-identical.

import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const I18N_DIR = path.join(ROOT, "src/i18n");
export const GENERATED_NAMESPACES = path.join(I18N_DIR, "namespaces.generated.ts");
export const ES_AGGREGATE = path.join(I18N_DIR, "es-aggregate.generated.ts");

// The 12 locale codes (mirrors src/i18n/config.ts). es is the canonical shape.
export const LOCALES = ["es", "en", "fr", "de", "it", "pt", "ar", "bn", "hi", "ja", "ko", "ru"];
export const SHAPE_LOCALE = "es";

// namespace key -> JS identifier (kept identical to the legacy split script).
export function varName(value) {
  return value.replace(/[^A-Za-z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""));
}

// Evaluate a per-module source file (`const X = {...} as const; export default X;`)
// into its plain object. Tolerates a leading license/comment header and an
// `import type` line so it also reads the legacy monolith chunks if ever needed.
// A namespace file MAY be an aggregator that spreads relative default imports
// (`import part1 from "./ns/part1"; const ns = { ...part1, ... }`) — used to keep
// big data namespaces under 1000 lines. Such relative default imports are
// resolved recursively and bound in the VM context so the spread works; the
// merged object is byte-identical to the pre-split single-file literal.
export function loadModuleFile(filePath) {
  let src = fs.readFileSync(filePath, "utf8");
  // Resolve `import NAME from "./rel";` (relative default imports) recursively
  // and expose each as a VM global before dropping the import lines.
  const context = { module: { exports: {} }, exports: {} };
  const relImportRe = /^\s*import\s+(\w+)\s+from\s+["'](\.[^"']+)["'];?\s*$/gm;
  let m;
  while ((m = relImportRe.exec(src)) !== null) {
    const [, name, rel] = m;
    const base = path.dirname(filePath);
    const candidates = [rel, `${rel}.ts`, path.join(rel, "index.ts")].map((r) => path.resolve(base, r));
    const resolved = candidates.find((c) => fs.existsSync(c));
    if (!resolved) throw new Error(`loadModuleFile: cannot resolve import "${rel}" from ${filePath}`);
    context[name] = loadModuleFile(resolved); // recursive; part files have no imports
  }
  src = src.replace(/^\s*import\s[\s\S]*?;\s*$/gm, ""); // drop ESM imports (vm can't run them)
  src = src.replace(/\bas const\b/g, ""); // strip const assertions
  src = src.replace(/^\s*const\s+\w+(?:\s*:\s*[^=]+?)?\s*=\s*/m, "module.exports = ");
  src = src.replace(/^\s*export default\s+\w+;?\s*$/m, "");
  vm.runInNewContext(src, context, { filename: filePath });
  return context.module.exports;
}

// Serialize a namespace value into the canonical per-module file body. This is
// byte-for-byte the format the runtime already consumed, so a round-trip
// (load -> serialize) is loss-free.
export function serializeModule(namespace, value) {
  const name = varName(namespace);
  return `const ${name} = ${JSON.stringify(value, null, 2)} as const;\n\nexport default ${name};\n`;
}

// Directory holding one locale's per-module files.
export function localeDirPath(locale) {
  return path.join(I18N_DIR, locale);
}

// Combine every per-module file of a locale into a single object, in `order`.
export function loadLocaleDir(locale, order) {
  const dir = localeDirPath(locale);
  const names =
    order ??
    fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".ts"))
      .map((f) => f.replace(/\.ts$/, ""))
      .sort();
  const out = {};
  for (const ns of names) {
    const fp = path.join(dir, `${ns}.ts`);
    if (fs.existsSync(fp)) out[ns] = loadModuleFile(fp);
  }
  return out;
}

// Split a locale object back into per-module files (only writes the given keys).
export function writeLocaleDir(locale, obj, order) {
  const dir = localeDirPath(locale);
  fs.mkdirSync(dir, { recursive: true });
  const names = order ?? Object.keys(obj);
  for (const ns of names) {
    if (!(ns in obj)) continue;
    fs.writeFileSync(path.join(dir, `${ns}.ts`), serializeModule(ns, obj[ns]), "utf8");
  }
}

// Canonical namespace order lives in namespaces.generated.ts (committed). Read
// it so the build, aggregate and NAMESPACES array stay stable across runs.
export function readCanonicalOrder() {
  if (!fs.existsSync(GENERATED_NAMESPACES)) return null;
  const src = fs.readFileSync(GENERATED_NAMESPACES, "utf8");
  const match = src.match(/\[([\s\S]*?)\]/);
  if (!match) return null;
  return match[1]
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

export function writeNamespacesGenerated(order) {
  const body = `export const NAMESPACES = ${JSON.stringify(order, null, 2)} as const;\n`;
  fs.writeFileSync(GENERATED_NAMESPACES, body, "utf8");
}

// ── Object helpers shared by the delta / apply / detect scripts ───────────
//
// Deep-merge `delta` into `base` in place. Objects recurse; everything else
// (strings, arrays, numbers) is overwritten by the delta's value.
// Re-exported from i18n-merge-delta.mjs so existing importers keep working.
export function deepMerge(base, delta) {
  for (const key of Object.keys(delta)) {
    const dv = delta[key];
    const bv = base[key];
    if (dv && typeof dv === "object" && !Array.isArray(dv) && bv && typeof bv === "object" && !Array.isArray(bv)) {
      deepMerge(bv, dv);
    } else {
      base[key] = dv;
    }
  }
  return base;
}

// Flatten a nested messages object to { "a.b.c": leaf }. Arrays are leaves
// (serialized) so they never get walked as objects.
export function flattenToDotted(o, p = "", out = {}) {
  for (const k of Object.keys(o || {})) {
    const v = o[k];
    const np = p ? `${p}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flattenToDotted(v, np, out);
    else out[np] = Array.isArray(v) ? JSON.stringify(v) : v;
  }
  return out;
}

// Same walk, but as [pathSegments, value] pairs — what the chunking scripts
// need so they can re-nest a slice of the leaves with setPath().
export function leafPaths(o, p = [], out = []) {
  for (const k of Object.keys(o || {})) {
    const v = o[k];
    if (v && typeof v === "object" && !Array.isArray(v)) leafPaths(v, p.concat(k), out);
    else out.push([p.concat(k), v]);
  }
  return out;
}

// Write `val` at `path` (array of segments), creating intermediate objects.
export function setPath(obj, path, val) {
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) {
    cur[path[i]] ??= {};
    cur = cur[path[i]];
  }
  cur[path[path.length - 1]] = val;
}

// setPath for a dotted key ("users.table.title").
export function setDotted(obj, dotted, val) {
  setPath(obj, dotted.split("."), val);
}

// ── {placeholder} parity ─────────────────────────────────────────────────
// Every apply-* script gates a translation on its {curly} tokens matching the
// reference's; a mismatch means the translator dropped/renamed an interpolation
// and the string would render broken.
export const placeholders = (s) => new Set(String(s).match(/\{[^}]+\}/g) || []);
export const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

// ── Wrong-language / untranslated detection ──────────────────────────────
// Locales written in a non-Latin script, and the Unicode range that proves a
// value is at least partially translated into each.
export const NON_LATIN = new Set(["ar", "bn", "hi", "ja", "ko", "ru"]);
export const SCRIPT = {
  ar: /[؀-ۿݐ-ݿ]/,
  bn: /[ঀ-৿]/,
  hi: /[ऀ-ॿ]/,
  ja: /[぀-ヿ一-鿿ｦ-ﾟ]/,
  ko: /[가-힯ᄀ-ᇿ㄰-㆏]/,
  ru: /[Ѐ-ӿ]/,
};

// Tokens/brands/units legitimately kept verbatim across languages.
// UNION of the two lists the detectors used to carry separately — they had
// already drifted (one knew JPEG/WebP/nftables/Tailwind, the other knew
// MCP/OTA/Endpoint/Bucket/OpenClaw), so each detector was flagging the other's
// vocabulary as untranslated.
export const TECH_ALLOW = new Set(
  (
    "API APIs CPU GPU RAM ROM SSL TLS DNS SSH SMTP IMAP POP3 HTTP HTTPS URL URI URLs URIs JSON " +
    "XML YAML CSV PDF PNG JPG JPEG GIF SVG WebP DKIM SPF DMARC DKIM/SPF UFW TOTP 2FA VAPID S3 R2 " +
    "AWS GCP MB GB KB TB PB KiB MiB GiB RX TX IP IPv4 IPv6 DB SQL ID UID GID PID OK CLI UI UX OS " +
    "VM VMs CDN WAF MTA MX TTL CA CSR PEM RSA ECDSA JWT OAuth SSO mTLS WS WSS TCP UDP QR AI LLM " +
    "LLMs NVMe SSD HDD RAID LVM NTP SFTP FTP SCP HSTS CSP CORS CRON ENV PATH HOME UTC GMT ISO " +
    "PNG/JPG cron tmux systemd nginx Nginx BitNinja Fail2ban LUXIPANEL LuxiPanel Luxisoft " +
    "Obsidian Expo EAS Cloudflare GnuPG PGP WhatsApp Linux Unix Ubuntu Debian root sudo Redis " +
    "Postgres PostgreSQL MySQL MariaDB SQLite Docker Certbot Dovecot Postfix OpenSSH OpenSSL " +
    "Argos DeepL Google OpenAI Claude Anthropic Grok Gemini DeepSeek Codex GitHub GitLab " +
    "Bitbucket npm pnpm yarn Node Node.js Vite Astro React Tailwind Webhook Webhooks Passkey " +
    "Passkeys Fail2Ban iptables nftables WireGuard OpenVPN Let's Encrypt Markdown Mermaid email " +
    "e-mail Email E-mail Ok URL/IP MCP OTA Endpoint Bucket OpenClaw"
  )
    .split(/\s+/)
    .filter(Boolean),
);

// Strip placeholders {x}, URLs, paths, emails, code-ish tokens and numbers
// before any language test — none of them say anything about the language.
export function strip(s) {
  return String(s)
    .replace(/\{[^}]*\}/g, " ") // {count}
    .replace(/https?:\/\/\S+/g, " ") // urls
    .replace(/\b[\w.-]+@[\w.-]+\b/g, " ") // emails
    .replace(/\/[\w./-]+/g, " ") // paths
    .replace(/`[^`]*`/g, " ") // inline code
    .replace(/\b\d[\d.,:%]*\b/g, " "); // numbers
}

// Latin words in a string that are NOT in the allowlist. Non-empty ⇒ the value
// carries real Latin-script words, i.e. it is (partly) untranslated.
export function offendingLatinWords(s, allow = TECH_ALLOW) {
  const words = strip(s).match(/[A-Za-z][A-Za-z'’-]{1,}/g) || [];
  return words.filter((w) => !allow.has(w) && !allow.has(w.replace(/['’-].*$/, "")));
}

// Generate the es aggregate that reconstructs the const-asserted shape used by
// src/i18n/types.ts (Messages = Translatable<typeof esDefault>).
export function writeEsAggregate(order) {
  const imports = order.map((ns) => `import ${varName(ns)} from "./${SHAPE_LOCALE}/${ns}";`).join("\n");
  const props = order.map((ns) => `  ${varName(ns)},`).join("\n");
  const body =
    "// SPDX-License-Identifier: AGPL-3.0-only\n" +
    "// Copyright (C) 2026 LUXISOFT\n" +
    "// AUTO-GENERATED by scripts/i18n-split-namespaces.mjs — do not edit by hand.\n" +
    "// Reconstructs the canonical Spanish shape from the per-module source files\n" +
    "// so src/i18n/types.ts can derive Messages = Translatable<typeof esDefault>.\n" +
    `${imports}\n\nconst es = {\n${props}\n} as const;\n\nexport default es;\n`;
  fs.writeFileSync(ES_AGGREGATE, body, "utf8");
}
