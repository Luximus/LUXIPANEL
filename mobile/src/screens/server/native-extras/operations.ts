import { nativeText } from '../../../i18n/native-text';
import type { NativeField } from "../NativeOperationCard";
import type { HttpMethod } from "../../../api/serverApi";
export type Values = Record<string, unknown>;
export type Operation = { title: string; fields?: NativeField[]; readPath?: string; path?: string | ((values: Values) => string); method?: HttpMethod; initial?: Values; toBody?: (values: Values, original: Values) => unknown; actionLabel?: string; confirmation?: string; selectData?: (data: unknown) => Values };
export type Group = { title: string; operations: Operation[] };
export const text = (key: string, label: string, required = false): NativeField => ({ key, get label() { return nativeText(label); }, required });
export const number = (key: string, label: string, min?: number, max?: number): NativeField => ({ key, get label() { return nativeText(label); }, type: "number", min, max });
export const flag = (key: string, label: string): NativeField => ({ key, get label() { return nativeText(label); }, type: "boolean" });
export const lines = (key: string, label: string): NativeField => ({ key, get label() { return nativeText(label); }, type: "lines" });
export const code = (key: string, label: string): NativeField => ({ key, get label() { return nativeText(label); }, type: "code" });
export const secret = (key: string, label: string): NativeField => ({ key, get label() { return nativeText(label); }, type: "secret" });
export const choice = (key: string, label: string, choices: string[]): NativeField => ({ key, get label() { return nativeText(label); }, options: choices.map(key => ({ key, label: key })) });
export const filePath = text("path", "Ruta del archivo o carpeta", true);
export function compact(values: Values): Values {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined && value !== ""));
}
export const pick = (values: Values, keys: string[]) => compact(Object.fromEntries(keys.map(key => [key, values[key]])));
export function query(path: string, values: Values): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(compact(values))) if (typeof value !== "object") params.set(key, String(value));
  return `${path}?${params}`;
}
export const read = (title: string, path: string): Operation => ({ title, readPath: path });
export const search = (title: string, path: string, fields: NativeField[], initial: Values = {}): Operation => ({ title, path: values => query(path, values), method: "GET", fields, initial, get actionLabel() { return nativeText("Consultar"); } });
export const post = (title: string, path: string | ((values: Values) => string), fields: NativeField[] = [], initial: Values = {}, confirmation?: string): Operation => ({ title, path, method: "POST", fields, initial, toBody: compact, get actionLabel() { return nativeText("Ejecutar"); }, confirmation });
export const settings = (title: string, path: string, fields: NativeField[], method: HttpMethod = "PUT", initial: Values = {}, toBody: Operation["toBody"] = compact): Operation => ({ title, readPath: path, path, fields, method, initial, toBody });
export const idField = text("id", "Identificador", true);
export const byId = (base: string, suffix = "") => (values: Values) => `${base}/${encodeURIComponent(String(values.id))}${suffix}`;

export const records = (key: string, label: string, fields: NativeField[]): NativeField => ({ key, get label() { return nativeText(label); }, type: "records", fields });
