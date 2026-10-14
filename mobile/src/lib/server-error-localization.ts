import errors from '../i18n/native/errors.json';
import { getMessages } from '../i18n';
import { normalizeLocale } from '../i18n/locales';
import { translatedInterfaceText } from '../i18n/native-text';
import { loadSessionState } from './session-state';

type ErrorKey = keyof typeof errors.es;
function details(value: unknown, depth = 0): {message: string; code?: string; status?: number} {
  if (depth > 4 || value == null) return {message: ''};
  if (typeof value === 'string') {
    if (/^\s*[\[{]/.test(value)) { try { return details(JSON.parse(value), depth + 1); } catch { /* plain text */ } }
    return {message: value.trim()};
  }
  if (typeof value !== 'object') return {message: ''};
  if (Array.isArray(value)) return {message: 'VALIDATION_ERROR'};
  const item = value as Record<string, unknown>;
  const child = details(item.error ?? item.message ?? item.data, depth + 1);
  return {...child, code: typeof item.code === 'string' ? item.code : child.code, status: typeof item.status === 'number' ? item.status : child.status};
}

/** Localize presentation only. Transport codes and diagnostic payloads stay intact. */
export function localizeServerError(error: unknown, language = loadSessionState().language): string {
  const locale = normalizeLocale(language);
  const t = errors[locale];
  const {message, code, status} = details(error);
  const known = translatedInterfaceText(message, locale);
  if (known !== undefined) return known;
  const text = `${code ?? ''} ${message}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[_-]+/g, ' ');
  const rules: [RegExp, ErrorKey][] = [
    [/target scope changed|servidor seleccionado.*cambio/, 'scope'],
    [/direct auth required|connect required|bridge session required/, 'connect'],
    [/invalid credentials|invalid password|incorrect password|authentication failed|credenciales invalid|passphrase.*(incorrect|invalid)|invalid login/, 'credentials'],
    [/unauthorized|not authenticated|session expired|expired.*token|invalid.*token|auth error|http 401/, 'auth'],
    [/forbidden|permission denied|access denied|not authorized|not permitted|eacces|eperm|sin permisos|no tienes permiso|denegad|no autorizad|http 403/, 'forbidden'],
    [/rate limit|too many|demasiad.*(solicitudes|intentos)|http 429/, 'rateLimit'],
    [/timeout|timed out|etimedout|tiempo.*(limite|agotado)|http (408|504)/, 'timeout'],
    [/enospc|quota|disk.*full|no space|sin espacio|cuota/, 'quota'],
    [/payload too large|file too large|request entity too large|http 413/, 'size'],
    [/already exists|already in use|duplicate|conflict|ya existe|ya esta en uso|http 409/, 'conflict'],
    [/not found|does not exist|enoent|no existe|no encontrado|http 404/, 'notFound'],
    [/validation|invalid (input|field|value|request|email|url)|required|must be|expected .*received|obligatori|debe(n)? ser|http (400|422)/, 'validation'],
    [/invalid.*response|unexpected token|json.*(parse|position)|respuesta.*(invalida|no valida)/, 'invalidResponse'],
    [/panel unavailable|service unavailable|not installed|no esta instalado|http 503/, 'unavailable'],
    [/network|failed to fetch|fetch failed|econn|enotfound|ehostunreach|socket|error de red|sin red|no se pudo conectar/, 'network'],
    [/internal.*error|http 5\d\d/, 'internal'],
  ];
  if (text.includes('no credentials')) return getMessages(locale).serverTable.guardNoCredentials;
  if (text.includes('fingerprint pending')) return getMessages(locale).serverTable.guardFingerprintPending;
  for (const [pattern, key] of rules) if (pattern.test(text)) return t[key];
  const byStatus: Record<number, ErrorKey> = {400:'validation',401:'auth',403:'forbidden',404:'notFound',408:'timeout',409:'conflict',413:'size',422:'validation',429:'rateLimit',500:'internal',502:'unavailable',503:'unavailable',504:'timeout'};
  return t[byStatus[status ?? -1] ?? 'failed'];
}
