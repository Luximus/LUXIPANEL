import { nativeOptionLabel } from '../../i18n/native-options';
import { nativeText } from '../../i18n/native-text';
import { localizeServerError } from '../../lib/server-error-localization';
import { FormDrawer } from "../../components/ui/FormDrawer";
import { Select } from "../../components/ui/Select";
import React, { useContext, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, TextInput, View, ScrollView } from "react-native";
import { callServerApi, unwrap, type HttpMethod, type GatewayResponse } from "../../api/serverApi";
import { useServerResource, runServerMutation } from "../../hooks/useServerApi";
import { HtmlView } from "../../components/HtmlView";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
import { Checkbox, Field, ConfirmDialog } from "../../components/server/Form";
import { Button } from "../../components/ui/Button";
import { NativeModuleContext } from "../main/native-module-context";
import { ModuleSettingsDrawer, SettingsColumns } from "../../components/ui/ModuleSettingsDrawer";
import { loadSessionState } from "../../lib/session-state";
import { WorkspaceResultTable } from "./WorkspaceResultTable";
import { SegmentedControl } from "../../components/ui/SegmentedControl";

export type NativeField = { group?: string; heading?: string; key: string; label: string; type?: "number" | "boolean" | "lines" | "code" | "secret" | "records" | "json"; fields?: NativeField[]; options?: Array<{ key: string; label: string }>; required?: boolean; min?: number; max?: number; hint?: string };
import { fieldValue, putField, normalizeOperationValues, clearOperationSecrets } from "./native-operation-values";
export { fieldValue, putField } from "./native-operation-values";
/** Native form with a read-before-write, preserving unknown fields and dirty drafts. */
export function NativeOperationCard({ panelId, token, title, fields = [], fieldGroups, afterField, readPath, path, method = "PUT", initial = {}, toBody, actionLabel = nativeText("Guardar"), confirmation, selectData, onSaved, children, embedded = false }: {
  panelId: string; token: string; title: string; fields?: NativeField[]; afterField?:(key:string)=>React.ReactNode; fieldGroups?: Array<{key:string;label:string}>; readPath?: string; path?: string | ((values: Record<string, unknown>) => string); method?: HttpMethod; initial?: Record<string, unknown>; toBody?: (values: Record<string, unknown>, original: Record<string, unknown>) => unknown; actionLabel?: string; confirmation?: string; selectData?: (data: unknown) => Record<string, unknown>; onSaved?: () => void; children?: React.ReactNode; embedded?: boolean;
}) {
  const colors = getThemeTokens(useTheme().theme === "dark");
  const workspace = useContext(NativeModuleContext)?.insideWorkspace;
  const [fieldGroup,setFieldGroup] = useState(fieldGroups?.[0]?.key);
  const [expanded, setExpanded] = useState(embedded);
  const [values, setValues] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [confirm, setConfirm] = useState(false);
  const resource = useServerResource<unknown>(() => readPath ? callServerApi(panelId, token, "GET", readPath) : Promise.resolve({ ok: true, data: initial }), [panelId, token, readPath], { enabled: expanded && !!readPath });
  const original = selectData ? selectData(resource.data) : (resource.data && typeof resource.data === "object" && !Array.isArray(resource.data) ? resource.data as Record<string, unknown> : {});
  useEffect(() => { if (resource.data && !dirty) setValues(clearOperationSecrets({ ...initial, ...original }, fields)); }, [resource.data]);
  const change = (key: string, value: unknown) => { if (pending.current || (readPath && (resource.loading || !!resource.error || !resource.data))) return; setDirty(true); setValues(current => { const next = { ...current }; putField(next, key, value); return next; }); };
  const submit = async () => {
    if (!path || pending.current || (readPath && (resource.loading || !!resource.error || !resource.data))) return;
    pending.current = true;
    try {
      const body = normalizeOperationValues(values, fields);
      setBusy(true); setError(null);
      let raw: GatewayResponse = { ok: false };
      const route = typeof path === "function" ? path(body) : path;
      const operation = async () => { raw = await callServerApi(panelId, token, method, route, method === "GET" ? undefined : toBody ? toBody(body, original) : body); return raw; };
      const response = method === "GET" ? await operation() : await runServerMutation(panelId, token, operation);
      if (!response.ok) throw new Error(response.error ?? nativeText("No se pudo completar la operación."));
      setConfirm(false);
      setResult(unwrap(raw) ?? nativeText("Operación completada.")); setDirty(false);
      // Write-only secrets are cleared after success, never restored from server responses.
      setValues(current => clearOperationSecrets(current, fields));
      if (readPath) await resource.reload();
      if (method !== "GET") onSaved?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : nativeText("No se pudo completar la operación.")); }
    finally { pending.current = false; setBusy(false); }
  };
  const content = <>
      {resource.loading ? <ActivityIndicator color={colors.brand} /> : null}
      {error || resource.error ? <><Text accessibilityRole="alert" style={{ color: colors.danger }}>{localizeServerError(error ?? resource.error)}</Text>{readPath ? <Button label={nativeText("Reintentar")} variant="ghost" onPress={() => void resource.reload()} /> : null}</> : null}
      {fieldGroups ? <SegmentedControl scroll items={fieldGroups} value={fieldGroup ?? fieldGroups[0].key} onChange={setFieldGroup}/> : null}
      {fields.filter(field => !fieldGroups || field.group === fieldGroup).map(field => { const value = fieldValue(values, field.key); return <View key={field.key} style={{gap:12}}>{field.heading ? <Text style={{color:colors.textPrimary,fontWeight:"700",fontSize:14,marginTop:12}}>{nativeText(field.heading)}</Text> : null}<Field label={nativeText(field.label)} hint={field.hint ? nativeText(field.hint) : undefined}>
        {field.type === "records" ? <NativeRecords fields={field.fields ?? []} value={Array.isArray(value) ? value as Record<string, unknown>[] : []} disabled={busy} onChange={rows => change(field.key, rows)} /> : field.type === "boolean" ? <Checkbox label={nativeText(field.label)} value={value === true} disabled={busy} onChange={checked => change(field.key, checked)} /> : field.options ? <Select options={field.options.map(option=>({value:option.key,label:nativeOptionLabel(option.label)}))} value={String(value ?? "")} onChange={selected => change(field.key, selected)} /> : <TextInput value={field.type === "json" && typeof value === "object" ? JSON.stringify(value, null, 2) : Array.isArray(value) ? value.join("\n") : String(value ?? "")} autoCorrect={false} autoCapitalize="none" secureTextEntry={field.type === "secret"} multiline={field.type === "lines" || field.type === "code" || field.type === "json"} keyboardType={field.type === "number" ? "numeric" : "default"} editable={!busy && (!readPath || !!resource.data)} onChangeText={text => change(field.key, text)} style={{ minHeight: field.type === "code" ? 140 : 42, padding: 12, color: colors.textPrimary, borderColor: colors.border, borderWidth: 1, borderRadius: 10, backgroundColor: colors.bgInput, textAlignVertical: "top", ...(field.type === "code" ? { fontFamily: "monospace" } : {}) }} />}
      </Field>{afterField?.(field.key)}</View>; })}
      {children}
      {!fields.length && resource.data != null ? <NativeResult value={resource.data} /> : null}
      {path ? <Button label={nativeText(actionLabel)} loading={busy} disabled={!!readPath && (!resource.data || resource.loading || !!resource.error)} onPress={() => confirmation ? setConfirm(true) : void submit()} /> : null}
      {result != null ? <NativeResult value={result} /> : null}
</>;
  const confirmationDialog = <ConfirmDialog visible={confirm} title={nativeText(title)} message={nativeText(confirmation ?? nativeText("Aplicar los cambios."))} confirmLabel={nativeText(actionLabel)} cancelLabel={nativeText("Cancelar")} submitting={busy} error={error ?? undefined} onCancel={() => { if (!pending.current) setConfirm(false); }} onConfirm={() => void submit()} />;
  if (embedded) return <View style={{ gap: 12 }}>{content}{confirmationDialog}</View>;
  const settingsForm = !!readPath && !!path && (method === "PUT" || method === "PATCH");
  return <View style={{ borderRadius: workspace ? 8 : 14, borderWidth: 1, borderColor: colors.border, padding: workspace ? 4 : 14, gap: 10, backgroundColor: colors.bgCardSolid }}>
    <Button label={workspace ? nativeText(title) : `${expanded ? "−" : "+"} ${nativeText(title)}`} variant="ghost" onPress={() => { if (!pending.current) setExpanded(value => !value); }} />
    {workspace && settingsForm ? <ModuleSettingsDrawer visible={expanded} onClose={() => { if (!pending.current) setExpanded(false); }} title={nativeText(title)} language={loadSessionState().language}>
      <SettingsColumns language={loadSessionState().language} value="general" onChange={() => {}} sections={[{ key: "general", label: nativeText(title) }]}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 14, gap: 12 }}>{content}</ScrollView>
      </SettingsColumns>
    </ModuleSettingsDrawer> : workspace ? <FormDrawer visible={expanded} onClose={() => { if (!pending.current) setExpanded(false); }} title={nativeText(title)}><View style={{ gap: 12 }}>{content}</View></FormDrawer> : expanded ? content : null}
    {confirmationDialog}
  </View>;
}
export function NativeResult({ value, depth = 0 }: { value: unknown; depth?: number }) {
  const colors = getThemeTokens(useTheme().theme === "dark");
  const workspace = useContext(NativeModuleContext)?.insideWorkspace;
  const [limit, setLimit] = useState(25);
  useEffect(() => setLimit(25), [value]);
  if (value == null || depth > 5) return null;
  if (workspace && Array.isArray(value) && value.length > 0 && value.every(row=>row && typeof row === "object" && !Array.isArray(row))) return <WorkspaceResultTable rows={value as Record<string, unknown>[]} />;
  if (typeof value === "object" && "html" in value && typeof (value as {html?: unknown}).html === "string") return <HtmlView html={(value as {html:string}).html} tokens={colors} copyLabel={nativeText("Copiar")} copiedLabel={nativeText("Copiado")} />;
  if (typeof value !== "object") return <Text selectable style={{ color: colors.textSecondary, fontSize: 13 }}>{typeof value === "boolean" ? value ? nativeText("Sí") : nativeText("No") : String(value)}</Text>;
  return <View style={{ gap: 8, paddingLeft: depth ? 8 : 0 }}>{Object.entries(value).slice(0, limit).map(([key, item]) => <View key={key} style={{ gap: 4 }}><Text style={{ color: colors.textMuted, fontSize: 12 }}>{Array.isArray(value) ? Number(key) + 1 : key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ")}</Text><NativeResult value={item} depth={depth + 1} /></View>)}{Object.keys(value).length > limit ? <Button variant="ghost" label={nativeText("Mostrar más ({p0} de {p1})", {p0: String(Math.min(limit, Object.keys(value).length)), p1: String(Object.keys(value).length)})} onPress={()=>setLimit(current=>current+25)} /> : null}</View>;
}

function NativeRecords({ fields, value, disabled, onChange }: { fields: NativeField[]; value: Record<string, unknown>[]; disabled: boolean; onChange: (value: Record<string, unknown>[]) => void }) {
  const colors = getThemeTokens(useTheme().theme === "dark");
  const change = (index: number, key: string, next: unknown) => onChange(value.map((row, i) => i === index ? { ...row, [key]: next } : row));
  return <View style={{ gap: 10 }}>{value.map((row, index) => <View key={index} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, gap: 8 }}>{fields.map(field => <Field key={field.key} label={nativeText(field.label)}>{field.type === "boolean" ? <Checkbox label={nativeText(field.label)} disabled={disabled} value={row[field.key] === true} onChange={next => change(index, field.key, next)} /> : field.options ? <SegmentedControl scroll items={field.options.map(option => ({...option, label: nativeOptionLabel(option.label)}))} value={String(row[field.key] ?? "")} onChange={next => change(index, field.key, next)} /> : <TextInput value={Array.isArray(row[field.key]) ? (row[field.key] as string[]).join("\n") : String(row[field.key] ?? "")} editable={!disabled} multiline={field.type === "lines" || field.type === "code" || field.type === "json"} autoCapitalize="none" autoCorrect={false} secureTextEntry={field.type === "secret"} keyboardType={field.type === "number" ? "numeric" : "default"} onChangeText={next => change(index, field.key, field.type === "lines" ? next.split(/\r?\n/).map(line=>line.trim()).filter(Boolean) : next)} style={{ color: colors.textPrimary, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 10, minHeight: 42 }} />}</Field>)}<Button label={nativeText("Eliminar fila")} variant="ghost" disabled={disabled} onPress={() => onChange(value.filter((_, i) => i !== index))} /></View>)}<Button label={nativeText("Añadir fila")} variant="secondary" disabled={disabled} onPress={() => onChange([...value, Object.fromEntries(fields.map(field => [field.key, field.type === "boolean" ? false : field.type === "lines" ? [] : field.options?.[0]?.key ?? ""]))])} /></View>;
}
