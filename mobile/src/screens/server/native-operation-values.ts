import { nativeText } from "../../i18n/native-text";
import type { NativeField } from './NativeOperationCard';

type Values = Record<string, unknown>;
export function fieldValue(object: Values, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Values)[key] : undefined, object);
}
export function putField(object: Values, path: string, value: unknown) {
  const keys = path.split('.'); let parent = object;
  for (const key of keys.slice(0, -1)) {
    const previous = parent[key];
    parent[key] = previous && typeof previous === 'object' && !Array.isArray(previous) ? {...previous} : {};
    parent = parent[key] as Values;
  }
  parent[keys.at(-1)!] = value;
}
/** Validate nested rows as well as top-level fields before making any request. */
export function normalizeOperationValues(values: Values, fields: NativeField[]): Values {
  const body = {...values};
  for (const field of fields) {
    let value = fieldValue(body, field.key);
    const empty = value == null || (typeof value === 'string' && !value.trim());
    if (field.required && (empty || (Array.isArray(value) && !value.length))) throw new Error(nativeText("Completa {p0}.", {p0:nativeText(field.label)}));
    if (field.type === 'number') {
      if (empty) value = undefined;
      else {
        if (typeof value !== 'number' && typeof value !== 'string') throw new Error(nativeText("Revisa {p0}.", {p0:nativeText(field.label)}));
        const number = Number(value);
        value = number;
        if (!Number.isFinite(number) || (field.min !== undefined && number < field.min) || (field.max !== undefined && number > field.max)) throw new Error(nativeText("Revisa {p0}.", {p0:nativeText(field.label)}));
      }
    }
    if (field.type === 'json' && typeof value === 'string') {
      try { value = JSON.parse(value); } catch { throw new Error(nativeText("Revisa el JSON de {p0}.", {p0:nativeText(field.label)})); }
    }
    if (field.type === 'lines' && typeof value === 'string') value = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (field.required && Array.isArray(value) && !value.length) throw new Error(nativeText("Completa {p0}.", {p0:nativeText(field.label)}));
    if (field.type === 'records' && value != null) {
      if (!Array.isArray(value)) throw new Error(nativeText("Revisa {p0}.", {p0:nativeText(field.label)}));
      value = value.map(row => {
        if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(nativeText("Revisa {p0}.", {p0:nativeText(field.label)}));
        return normalizeOperationValues(row, field.fields ?? []);
      });
    }
    putField(body, field.key, value);
  }
  return body;
}
export function clearOperationSecrets(values: Values, fields: NativeField[]): Values {
  const next = {...values};
  for (const field of fields) {
    if (field.type === 'secret') putField(next, field.key, '');
    const rows = fieldValue(next, field.key);
    if (field.type === 'records' && Array.isArray(rows)) putField(next, field.key, rows.map(row => clearOperationSecrets(row, field.fields ?? [])));
  }
  return next;
}
