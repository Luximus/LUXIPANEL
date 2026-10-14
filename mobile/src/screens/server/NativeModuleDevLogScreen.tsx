import React, { useEffect, useRef, useState } from "react";
import { View, Linking } from "react-native";
import { PanelText as Text } from "../../components/ui/PanelText";
import { Button } from "../../components/ui/Button";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { ServerModuleScreen } from "../../components/server/ServerModuleScreen";
import { NativeOperationCard, type NativeField } from "./NativeOperationCard";
import { configFields } from "./NativeModuleDevTools";
import { nativeText } from "../../i18n/native-text";
import { callServerApi } from "../../api/serverApi";
import { useServerResource } from "../../hooks/useServerApi";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";
type Incident = { id: string; severity: string; module: string; message: string; count: number };
type Repair = { id: string; status: string; result?: string; error?: string; prUrl?: string; publication?: string; pendingApproval?: { id: string; preview: string } };
type Setup = { ready: boolean; config: Record<string, any>; components: string[]; policyPrefix: string; issues: string[] };
export function NativeModuleDevLogScreen({ panelId, token, onBack }: { panelId: string; token: string; onBack: () => void }) {
 const colors = getThemeTokens(useTheme().theme === "dark");
 const [view, setView] = useState("luxipanel"), [selected, setSelected] = useState(""), [component, setComponent] = useState("luxipanel"), [busy, setBusy] = useState(false), [error, setError] = useState("");
 const generation = useRef(0);
 useEffect(() => { generation.current++; setSelected(""); setComponent("luxipanel"); setError(""); setBusy(false); return () => { generation.current++; }; }, [panelId, token]);
 const setup = useServerResource<Setup>(() => callServerApi(panelId, token, "GET", "/api/module-dev/logs/config"), [panelId, token]);
 const logs = useServerResource<{ items: Incident[] }>(() => callServerApi(panelId, token, "GET", `/api/module-dev/logs?view=${view}&limit=50`), [panelId, token, view]);
 const repairs = useServerResource<Repair[]>(() => callServerApi(panelId, token, "GET", `/api/module-dev/logs/repairs?view=${view}`), [panelId, token, view]);
 const action = async (path: string, body: unknown) => {
  if (busy) return; const current = generation.current; setBusy(true); setError("");
  try { const response = await callServerApi(panelId, token, "POST", path, body); if (current !== generation.current) return; if (!response.ok) throw new Error(response.error || nativeText("No se pudo completar la operación")); const result = response.data as { issueUrl?: string }; if (result?.issueUrl && /^https:\/\/github\.com\/Luxisoft\/LUXIPANEL\/issues\/\d+$/.test(result.issueUrl)) await Linking.openURL(result.issueUrl); await logs.reload(); await repairs.reload(); }
  catch (cause) { if (current === generation.current) setError((cause as Error).message); } finally { if (current === generation.current) setBusy(false); }
 };
 const policyFields: NativeField[] = [{ key: "autoEnabled", label: nativeText("Reparación automática"), type: "boolean" }, { key: "autoSeverities", label: nativeText("Gravedad (una por línea)"), type: "lines", hint: "warn, error, fatal" }];
 const policyKey = component === "luxipanel" ? component : `${setup.data?.policyPrefix}${component}`;
 const settings = <View style={{ gap: 16 }}>
  <NativeOperationCard embedded panelId={panelId} token={token} title={nativeText("Ajustes")} readPath="/api/module-dev/logs/config" path="/api/module-dev/logs/config" selectData={value => (value as Setup)?.config || {}} fields={configFields} toBody={values => ({ ...Object.fromEntries(configFields.map(field => [field.key, values[field.key]])), baseBranch: "", repairTarget: values.repairTarget || "auto" })} onSaved={() => { void setup.reload(); }} />
  <SegmentedControl items={(setup.data?.components || ["luxipanel"]).map(id => ({ key: id, label: id === "luxipanel" ? "LUXIPANEL" : id }))} value={component} onChange={setComponent} scroll />
  <NativeOperationCard key={component} embedded panelId={panelId} token={token} title={nativeText("Reparación automática")} readPath="/api/module-dev/logs/config" path="/api/module-dev/logs/config" fields={policyFields} selectData={value => { const config = (value as Setup)?.config; const item = config?.repairPolicies?.[policyKey]; return { ...config, autoEnabled: item?.enabled || false, autoSeverities: item?.severities || ["warn", "error", "fatal"] }; }} toBody={values => { const { autoEnabled, autoSeverities, ...config } = values; return { ...config, automation: { component, enabled: Boolean(autoEnabled), severities: autoSeverities } }; }} onSaved={() => { void setup.reload(); }} />
 </View>;
 return <ServerModuleScreen title="LOG" onBack={onBack} settingsPages={[{ key: "logs", label: "LOG", content: settings }]}>
  {!!(error || logs.error || setup.error) && <Text style={{ color: colors.danger }}>{error || logs.error || setup.error}</Text>}
  {logs.loading && <Text style={{ color: colors.textSecondary }}>{nativeText("Cargando…")}</Text>}
  <SegmentedControl items={[{ key: "luxipanel", label: "LUXIPANEL" }, { key: "modules", label: nativeText("Módulos") }]} value={view} onChange={next => { generation.current++; setView(next); setSelected(""); setError(""); setBusy(false); }} />
  {setup.data?.issues.map(issue => <Text key={issue} style={{ color: colors.textSecondary }}>{issue}</Text>)}
  {(logs.data?.items || []).map(incident => <View key={incident.id} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, gap: 8 }}>
   <Text style={{ color: colors.textSecondary }}>{incident.module} · {incident.severity} · ×{incident.count}</Text><Text style={{ color: colors.textPrimary }}>{incident.message}</Text>
   <Button label={nativeText("Ver detalle")} variant="secondary" onPress={() => setSelected(selected === incident.id ? "" : incident.id)} />
   <Button label={nativeText("Corregir")} disabled={busy || !setup.data?.ready} onPress={() => { void action(`/api/module-dev/logs/repairs?view=${view}`, { incidentId: incident.id }); }} />
   <Button label={nativeText("Reportar")} variant="secondary" disabled={busy} onPress={() => { void action(`/api/module-dev/logs/incidents/${incident.id}/report?view=${view}`, {}); }} />
   {selected === incident.id && <NativeOperationCard embedded panelId={panelId} token={token} title={nativeText("Detalle")} readPath={`/api/module-dev/logs/incidents/${incident.id}?view=${view}`} />}
  </View>)}
  <Button label={nativeText("Actualizar")} variant="secondary" onPress={() => { void logs.reload(); void repairs.reload(); }} />
  {(repairs.data || []).map(job => <View key={job.id} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, gap: 8 }}>
   <Text style={{ color: colors.textPrimary }}>{nativeText("Reparación")} · {job.status}{job.publication ? ` · ${job.publication}` : ""}</Text>
   {!!job.result && <Text style={{ color: colors.textSecondary }}>{job.result}</Text>}{!!job.error && <Text style={{ color: colors.danger }}>{job.error}</Text>}
   {job.prUrl && /^https:\/\/github\.com\/Luxisoft\/LUXIPANEL\/pull\/\d+$/.test(job.prUrl) && <Button label={nativeText("Abrir en GitHub")} variant="secondary" onPress={() => { void Linking.openURL(job.prUrl!); }} />}
   {job.pendingApproval && <><Text style={{ color: colors.textSecondary }}>{job.pendingApproval.preview}</Text><Button label={nativeText("Aprobar")} disabled={busy} onPress={() => { void action(`/api/module-dev/logs/repairs/${job.id}/approval?view=${view}`, { permissionId: job.pendingApproval!.id, allow: true }); }} /><Button label={nativeText("Rechazar")} variant="secondary" disabled={busy} onPress={() => { void action(`/api/module-dev/logs/repairs/${job.id}/approval?view=${view}`, { permissionId: job.pendingApproval!.id, allow: false }); }} /></>}
   {["failed", "canceled", "interrupted", "manual-action"].includes(job.status) && <Button label={nativeText("Reintentar")} variant="secondary" disabled={busy} onPress={() => { void action(`/api/module-dev/logs/repairs/${job.id}/retry?view=${view}`, {}); }} />}
   {!["failed", "canceled", "interrupted", "manual-action", "pr-created"].includes(job.status) && <Button label={nativeText("Cancelar")} variant="secondary" disabled={busy} onPress={() => { void action(`/api/module-dev/logs/repairs/${job.id}/cancel?view=${view}`, {}); }} />}
  </View>)}
 </ServerModuleScreen>;
}
