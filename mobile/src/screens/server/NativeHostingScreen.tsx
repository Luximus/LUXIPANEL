import { nativeOptionLabel } from '../../i18n/native-options';
import { nativeText } from '../../i18n/native-text';
import { localizeServerError } from '../../lib/server-error-localization';
import { FormDrawer } from "../../components/ui/FormDrawer";
import { moduleInputMetrics } from "../../components/ui/ModuleUi";
import { RelatedModuleSettings } from "../../components/server/RelatedModuleSettings";
import { ModuleSettingsDrawer } from "../../components/ui/ModuleSettingsDrawer";
import { ServerDataTable } from "../../components/server/ServerDataTable";
import { ScrollView } from "react-native";
import { loadSessionState } from "../../lib/session-state";
import { NativeHostingTools } from "./NativeHostingTools";
import React, { useEffect, useRef, useState } from "react";
import { PanelText as Text } from "../../components/ui/PanelText";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { callServerApi, type HttpMethod } from "../../api/serverApi";
import { ServerModuleScreen } from "../../components/server/ServerModuleScreen";
import { ConfirmDialog, Field } from "../../components/server/Form";
import { Button } from "../../components/ui/Button";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { runServerMutation, useServerResource } from "../../hooks/useServerApi";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";

type Account = { id: number; username: string; displayName?: string | null; email?: string | null; plan: string; status: string; homeRoot: string; diskQuotaMb: number; maxDomains: number; createdAt: string };
type Stats = { diskUsedMb?: number; diskQuotaMb?: number; diskPercentUsed?: number; domainsUsed?: number; maxDomains?: number; emailAccountsUsed?: number; maxEmailAccounts?: number; databasesUsed?: number; maxDatabases?: number; subUsersUsed?: number; maxSubUsers?: number };
type ConfirmAction = { title: string; message: string; method: HttpMethod; path: string };
const emptyStats = Promise.resolve({ ok: true, data: { ok: true, data: null } });

/** Native reseller account management for the connected server. */
export function NativeHostingScreen({ panelId, token, onBack }: { panelId: string; token: string; onBack: () => void }) {
  const { theme } = useTheme();
  const colors = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const [createOpen, setCreateOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("basic");
  const [editPlan, setEditPlan] = useState("basic");
  const [diskQuotaMb, setDiskQuotaMb] = useState("");
  const [maxDomains, setMaxDomains] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const mutationPending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const accounts = useServerResource<Account[]>(() => callServerApi(panelId, token, "GET", `/api/hosting/accounts?limit=100&search=${encodeURIComponent(search)}`), [panelId, token, search]);
  const stats = useServerResource<Stats>(() => selectedId ? callServerApi(panelId, token, "GET", `/api/hosting/accounts/${selectedId}/stats`) : emptyStats, [panelId, token, selectedId]);
  const rows = Array.isArray(accounts.data) ? accounts.data : [];
  const selected = rows.find((item) => item.id === selectedId);
  useEffect(() => { setNewPassword(""); if (selected) { setEditPlan(selected.plan); setDiskQuotaMb(String(selected.diskQuotaMb)); setMaxDomains(String(selected.maxDomains)); } }, [selectedId]);
  const inputStyle = { ...moduleInputMetrics, borderColor: colors.border, backgroundColor: colors.bgPrimary, color: colors.textPrimary } as const;
  const cardStyle = { borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCardSolid, padding: 14, gap: 9 } as const;
  const reload = async () => { await Promise.all([accounts.reload(), stats.reload()]); };
  const mutate = async (method: HttpMethod, path: string, body?: unknown) => {
    if (busy || mutationPending.current) return false;
    mutationPending.current = true;
    setBusy(true);
    try { setError(null); setNotice(null);
    const outcome = await runServerMutation(panelId, token, () => callServerApi(panelId, token, method, path, body));
    if (!outcome.ok) { setError(outcome.error ?? nativeText("No se pudo completar la operación.")); return false; }
    setNotice(nativeText("Cuenta actualizada."));
    await reload();
    return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : nativeText("No se pudo completar la operación.")); return false; }
    finally { mutationPending.current = false; setBusy(false); }
  };
  const create = async () => {
    if (!/^[a-z][a-z0-9_-]{2,31}$/.test(username.trim()) || password.length < 8) { setError(nativeText("El usuario debe empezar por letra y la contraseña tener al menos 8 caracteres.")); return; }
    if (await mutate("POST", "/api/hosting/accounts", { username: username.trim(), password, plan, ...(email.trim() ? { email: email.trim() } : {}) })) { setUsername(""); setPassword(""); setEmail(""); setCreateOpen(false); }
  };
  const saveAccount = () => {
    if (!selectedId) return;
    const disk = Number(diskQuotaMb);
    const domains = Number(maxDomains);
    if (!Number.isInteger(disk) || disk < 256 || !Number.isInteger(domains) || domains < 1) { setError(nativeText("La cuota de disco debe ser al menos 256 MB y los dominios al menos 1.")); return; }
    void mutate("PUT", `/api/hosting/accounts/${selectedId}`, { plan: editPlan, diskQuotaMb: disk, maxDomains: domains });
  };
  return <ServerModuleScreen title={nativeText("Hosting")} action={{ get label() { return nativeText("Crear cuenta"); }, onPress: () => setCreateOpen(true) }} headerActions={<Button label={nativeText("Planes")} variant="secondary" size="sm" onPress={() => setPlansOpen(true)} />} subtitle={nativeText("Cuentas y cuotas del servidor")} onBack={onBack} error={error ?? accounts.error ?? stats.error} guardCode={accounts.guardCode ?? stats.guardCode} onRetry={() => void reload()} onRefresh={() => void reload()} refreshing={accounts.loading || stats.loading}>
    {notice ? <Text accessibilityRole="alert" style={{ color: colors.brand }}>{notice}</Text> : null}
    <View style={{ flexDirection: "row", gap: 8 }}><TextInput value={searchDraft} onChangeText={setSearchDraft} onSubmitEditing={() => setSearch(searchDraft.trim())} placeholder={nativeText("Buscar cuentas")} placeholderTextColor={colors.textMuted} style={[inputStyle, { flex: 1 }]} /><Button label={nativeText("Buscar")} onPress={() => setSearch(searchDraft.trim())} /></View>
    {accounts.loading && !accounts.data ? <ActivityIndicator color={colors.brand} /> : null}
    <ServerDataTable settingsBulkActions settingsId="accounts" settingsBeforeActions={<><NativeHostingTools panelId={panelId} token={token} selectedId={null} section="defaults" onSaved={() => void reload()} /><RelatedModuleSettings modules={["users","databases","dns"]}/></>} title={nativeText("Cuentas")} rows={rows} rowKey={row => String(row.id)} columns={[
      { id: "username", get header() { return nativeText("Usuario"); }, cell: row => row.username, width: 160 },
      { id: "email", get header() { return nativeText("Correo"); }, cell: row => row.email ?? "—", width: 220 },
      { id: "plan", get header() { return nativeText("Plan"); }, cell: row => row.plan, width: 120 },
      { id: "status", get header() { return nativeText("Estado"); }, cell: row => row.status, width: 120 },
      { id: "disk", get header() { return nativeText("Disco"); }, cell: row => `${row.diskQuotaMb} MB`, width: 130 },
      { id: "domains", get header() { return nativeText("Dominios"); }, cell: row => String(row.maxDomains), width: 100 },
    ]} rowActions={[{ id: "manage", get label() { return nativeText("Gestionar"); } }]} onRowAction={(_, row) => setSelectedId(row.id)} />
    <FormDrawer visible={createOpen} onClose={() => { if (!mutationPending.current) setCreateOpen(false); }} title={nativeText("Crear cuenta")} language={language}>
      {error ? <Text accessibilityRole="alert" style={{color: colors.danger}}>{localizeServerError(error)}</Text> : null}
    <View style={cardStyle}>
      <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{nativeText("Nueva cuenta")}</Text>
      <Field label={nativeText("Usuario")}><TextInput value={username} onChangeText={setUsername} autoCapitalize="none" maxLength={32} style={inputStyle} /></Field>
      <Field label={nativeText("Contraseña")}><TextInput value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" maxLength={128} style={inputStyle} /></Field>
      <Field label={nativeText("Correo")}><TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" style={inputStyle} /></Field>
      <SegmentedControl items={["basic", "pro", "business", "custom"].map((key) => ({ key, label: nativeOptionLabel(key) }))} value={plan} onChange={setPlan} scroll />
      <Button label={nativeText("Crear cuenta")} onPress={() => void create()} disabled={busy || !username.trim() || !password} />
    </View>
    </FormDrawer>
    <ModuleSettingsDrawer visible={plansOpen} onClose={() => setPlansOpen(false)} title={nativeText("Planes de hosting")} language={language}>
      <ScrollView contentContainerStyle={{padding: 16, gap: 16}}><NativeHostingTools panelId={panelId} token={token} selectedId={null} section="plans" onSaved={() => void reload()} /></ScrollView>
    </ModuleSettingsDrawer>
    {selected ? <ModuleSettingsDrawer visible onClose={() => { if (!mutationPending.current) setSelectedId(null); }} title={nativeText("Gestionar {p0}", {p0: String(selected.username)})} language={language}><ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>{error ? <Text accessibilityRole="alert" style={{color: colors.danger}}>{localizeServerError(error)}</Text> : null}<View style={cardStyle}>
      <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{nativeText("Gestionar")}{" "}{selected.username}</Text>
      {stats.data ? <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{nativeText("Disco:")}{" "}{stats.data.diskUsedMb ?? 0}/{stats.data.diskQuotaMb ?? selected.diskQuotaMb} {nativeText("MB · Dominios:")}{" "}{stats.data.domainsUsed ?? 0}/{stats.data.maxDomains ?? selected.maxDomains} {nativeText("· Correos:")}{" "}{stats.data.emailAccountsUsed ?? 0}/{stats.data.maxEmailAccounts ?? "—"} {nativeText("· Bases:")}{" "}{stats.data.databasesUsed ?? 0}/{stats.data.maxDatabases ?? "—"}</Text> : null}
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{nativeText("Plan")}</Text>
      <SegmentedControl items={["basic", "pro", "business", "custom"].map((key) => ({ key, label: nativeOptionLabel(key) }))} value={editPlan} onChange={setEditPlan} scroll />
      <Field label={nativeText("Cuota de disco (MB)")}><TextInput value={diskQuotaMb} onChangeText={setDiskQuotaMb} keyboardType="number-pad" style={inputStyle} /></Field>
      <Field label={nativeText("Máximo de dominios")}><TextInput value={maxDomains} onChangeText={setMaxDomains} keyboardType="number-pad" style={inputStyle} /></Field>
      <Button label={nativeText("Guardar cuenta")} onPress={saveAccount} disabled={busy} />
      <Field label={nativeText("Nueva contraseña")}><TextInput value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" style={inputStyle} /></Field>
      <Button label={nativeText("Cambiar contraseña")} variant="ghost" onPress={() => { if (!selectedId || newPassword.length < 8) { setError(nativeText("La contraseña debe tener al menos 8 caracteres.")); return; } void mutate("POST", `/api/hosting/accounts/${selectedId}/change-password`, { password: newPassword }).then((ok) => { if (ok) setNewPassword(""); }); }} disabled={busy || !newPassword} />
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>{selected.status === "active" ? <Button label={nativeText("Suspender")} variant="ghost" onPress={() => setConfirm({ get title() { return nativeText("Suspender cuenta"); }, message: nativeText("Se suspenderá {p0}.", {p0: String(selected.username)}), method: "POST", path: `/api/hosting/accounts/${selected.id}/suspend` })} disabled={busy} /> : selected.status === "suspended" ? <Button label={nativeText("Reactivar")} onPress={() => void mutate("POST", `/api/hosting/accounts/${selected.id}/unsuspend`)} disabled={busy} /> : null}<Button label={nativeText("Terminar cuenta")} variant="danger" onPress={() => setConfirm({ get title() { return nativeText("Terminar cuenta"); }, message: nativeText("Se terminará {p0}. Esta acción puede afectar sus recursos.", {p0: String(selected.username)}), method: "DELETE", path: `/api/hosting/accounts/${selected.id}` })} disabled={busy || selected.status === "terminated"} /></View>
    </View><NativeHostingTools panelId={panelId} token={token} selectedId={selectedId} section="account" onSaved={() => void reload()} /></ScrollView></ModuleSettingsDrawer> : null}
    <ConfirmDialog visible={!!confirm} title={confirm?.title ?? nativeText("Confirmar")} message={confirm?.message ?? ""} confirmLabel={nativeText("Continuar")} cancelLabel={nativeText("Cancelar")} submitting={busy} error={error ?? undefined} onCancel={() => { if (!mutationPending.current) setConfirm(null); }} onConfirm={() => { if (!confirm) return; const pending = confirm; void mutate(pending.method, pending.path).then(ok => { if (ok) setConfirm(null); }); }} />
  </ServerModuleScreen>;
}
