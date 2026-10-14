import { ALL_MESSAGES } from './messages';
import { normalizeLocale } from './locales';
import { loadSessionState } from '../lib/session-state';
import additions from './native/text.json';
import errors from './native/errors.json';
import type { LocaleCode } from './locales';

type Translations = Record<LocaleCode, string>;
const formatMessage = (text: string, params: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (match, key: string) => params[key] === undefined ? match : String(params[key]));
const known = new Map<string, Translations>();
function collect(nodes: Record<LocaleCode, unknown>) {
  const base = nodes.es;
  if (typeof base === 'string') {
    if (Object.values(nodes).every(value => typeof value === 'string')) {
      const row = nodes as Translations;
      for (const text of Object.values(row)) if (!known.has(text)) known.set(text, row);
    }
  } else if (base && typeof base === 'object') {
    for (const key of Object.keys(base)) collect(Object.fromEntries(Object.entries(nodes).map(([locale, node]) => [locale, (node as Record<string, unknown>)?.[key]])) as Record<LocaleCode, unknown>);
  }
}
collect(ALL_MESSAGES);
collect(errors);
for (const [source, row] of Object.entries(additions)) {
  const values = row as Translations;
  known.set(source, values);
  for (const value of Object.values(values)) if (!known.has(value)) known.set(value, values);
}

// Short unit templates such as "{days}d" must never match error messages.
const templates = [...known].flatMap(([template, row]) => {
  const literal = template.replace(/\{\w+\}/g, '');
  if (!/\{\w+\}/.test(template) || literal.trim().length < 4 || !/[\p{L}\p{M}]{3}/u.test(literal)) return [];
  const names: string[] = [];
  const pattern = template.split(/(\{\w+\})/).map(part => {
    if (/^\{\w+\}$/.test(part)) { names.push(part.slice(1, -1)); return '([\\s\\S]+?)'; }
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('');
  return [{ pattern: new RegExp(`^${pattern}$`), names, row }];
});

/** Only call for interface copy, never user content, logs, paths or API identifiers. */
export function nativeText(text: string, params?: Record<string, string | number>, language = loadSessionState().language): string {
  const translated = known.get(text)?.[normalizeLocale(language)] ?? text;
  return params ? formatMessage(translated, params) : translated;
}

export function translatedInterfaceText(text: string, language: string): string | undefined {
  const exact = known.get(text)?.[normalizeLocale(language)];
  if (exact !== undefined) return exact;
  // Validation and confirmation copy may already contain interpolated values.
  // Preserve those values (e.g. usernames and paths) while translating the template.
  for (const {pattern, names, row} of templates) {
    const match = text.match(pattern);
    if (match) {
      // These parameters are field labels; other parameters are user/server data.
      const fieldLabel = ['Completa {p0}.', 'Revisa {p0}.', 'Revisa el JSON de {p0}.', 'Escribe {p0}.'].includes(row.es);
      return formatMessage(row[normalizeLocale(language)], Object.fromEntries(names.map((name, i) => [name, fieldLabel ? nativeText(match[i + 1], undefined, language) : match[i + 1]])));
    }
  }
  return undefined;
}
