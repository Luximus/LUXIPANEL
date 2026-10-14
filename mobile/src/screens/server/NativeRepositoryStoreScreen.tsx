import { nativeText } from '../../i18n/native-text';
import { localizeServerError } from '../../lib/server-error-localization';
import { FormDrawer } from "../../components/ui/FormDrawer";
import { moduleInputMetrics } from "../../components/ui/ModuleUi";
import { NativeOperationCard } from "./NativeOperationCard";
import { serviceExtras } from "./native-extras/services";
import { Select } from "../../components/ui/Select";
import { ModuleGrid } from "../../components/server/ModuleLayouts";
import { NativeModuleContext } from "../main/native-module-visibility";
import { loadSessionState } from "../../lib/session-state";
import React, { useContext, useEffect, useRef, useState } from "react";
import { PanelText as Text } from "../../components/ui/PanelText";
import { ActivityIndicator, Linking, TextInput, View } from "react-native";
import { callServerApi, type HttpMethod } from "../../api/serverApi";
import { ServerModuleScreen } from "../../components/server/ServerModuleScreen";
import { ConfirmDialog, Field } from "../../components/server/Form";
import { Button } from "../../components/ui/Button";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { runServerMutation, useServerResource } from "../../hooks/useServerApi";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";

type Repo = { id: number; full_name: string; description?: string | null; html_url: string; stargazers_count: number; updated_at: string };
type Clone = { id: string; fullName: string; path: string; branch: string; dirty?: boolean; behind?: number; statusError?: string };
type State = { saved: string[]; clones: Clone[] };
type SearchResult = { items?: Repo[]; total_count?: number };
type ConfirmAction = { title: string; message: string; method: HttpMethod; path: string; body?: unknown };

/** Native public repository catalog and connected-server clone controls. */
export function NativeRepositoryStoreScreen({ panelId, token, onBack }: { panelId: string; token: string; onBack: () => void }) {
  const { theme } = useTheme();
  const colors = getThemeTokens(theme === "dark");
  const language = loadSessionState().language;
  const context = useContext(NativeModuleContext);
  const [tab, setTab] = useState("all");
  useEffect(() => { if (["all", "saved", "cloned", "update"].includes(context?.selectedView ?? "")) setTab(context!.selectedView!); }, [context?.selectedView, context?.viewRevision]);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [sort, setSort] = useState("relevance");
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("luxipanel");
  const [searchQuery, setSearchQuery] = useState("luxipanel");
  const [cloneRepo, setCloneRepo] = useState("");
  const [cloneDest, setCloneDest] = useState("");
  const [transport, setTransport] = useState<"https" | "ssh">("https");
  const mutationPending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const state = useServerResource<State>(() => callServerApi(panelId, token, "GET", "/api/repository-store/state"), [panelId, token]);
  const search = useServerResource<SearchResult>(() => callServerApi(panelId, token, "GET", `/api/repository-store/search?q=${encodeURIComponent(searchQuery)}&per_page=36&page=${page}${sort === "relevance" ? "" : `&sort=${sort === "updated" ? "updated" : "stars"}&order=${sort === "stars_asc" ? "asc" : "desc"}`}`), [panelId, token, searchQuery, sort, page]);
  const repos = Array.isArray(search.data?.items) ? search.data.items : [];
  const clones = Array.isArray(state.data?.clones) ? state.data.clones : [];
  const saved = Array.isArray(state.data?.saved) ? state.data.saved : [];
  const inputStyle = { ...moduleInputMetrics, borderColor: colors.border, backgroundColor: colors.bgPrimary, color: colors.textPrimary } as const;
  const cardStyle = { borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCardSolid, padding: 14, gap: 9 } as const;
  const mutate = async (method: HttpMethod, path: string, body?: unknown) => {
    if (busy || mutationPending.current) return false;
    mutationPending.current = true;
    setBusy(true);
    try { setError(null); setNotice(null);
    const outcome = await runServerMutation(panelId, token, () => callServerApi(panelId, token, method, path, body));
    if (!outcome.ok) { setError(outcome.error ?? nativeText("No se pudo completar la operación.")); return false; }
    setNotice(nativeText("Cambio aplicado."));
    await state.reload();
    return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : nativeText("No se pudo completar la operación.")); return false; }
    finally { mutationPending.current = false; setBusy(false); }
  };
  const clone = async () => {
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(cloneRepo.trim()) || !cloneDest.trim().startsWith("/")) { setError(nativeText("Indica propietario/repositorio y una ruta absoluta de destino.")); return; }
    if (await mutate("POST", "/api/repository-store/clones", { fullName: cloneRepo.trim(), dest: cloneDest.trim(), transport })) { setCloneRepo(""); setCloneDest(""); setCloneOpen(false); }
  };
  const repoOps = serviceExtras["repository-store"][0].operations;
  const preferenceOp = repoOps.find(op=>op.title === "Preferencias del catálogo")!;
  const preferencesPage = (keys:string[]) => <NativeOperationCard embedded {...preferenceOp} fields={preferenceOp.fields?.filter(field=>keys.includes(field.key))} toBody={values=>Object.fromEntries(keys.map(key=>[key,key==="pageSize"?Number(values[key]):values[key]]))} panelId={panelId} token={token} onSaved={()=>void state.reload()}/>;
  const settingsPages = [
    {key:"catalog",get label() { return nativeText("Catálogo"); },content:preferencesPage(["defaultTab","sort","pageSize","showArchived"])},
    {key:"cloning",get label() { return nativeText("Clonación"); },content:<View style={{gap:20}}>{preferencesPage(["cloneParent","transport"])}<NativeOperationCard embedded {...repoOps.find(op=>op.title === "Vincular repositorio ya clonado")!} panelId={panelId} token={token} onSaved={()=>void state.reload()}/></View>},
    {key:"connection",get label() { return nativeText("Conexión"); },content:<View style={{gap:20}}>{repoOps.filter(op=>["Configuración de GitHub","Autenticación Git detectada"].includes(op.title)).map(op=><NativeOperationCard key={op.title} embedded {...op} panelId={panelId} token={token}/>)}{context?.openModule?<Button label={nativeText("Configurar credenciales")} variant="secondary" onPress={()=>context.openModule?.("settings","credentials")}/>:null}</View>},
  ];
  return <ServerModuleScreen settingsPages={settingsPages} title={nativeText("Tienda de repositorios")} tabs={[{key:"all",get label() { return nativeText("Todos"); }},{key:"saved",get label() { return nativeText("Guardados"); }},{key:"cloned",get label() { return nativeText("Clonados"); }},{key:"update",get label() { return nativeText("Actualizaciones"); }}]} activeTab={tab} onTabChange={setTab} action={{get label() { return nativeText("Clonar repositorio"); },onPress:()=>setCloneOpen(true)}} subtitle={nativeText("GitHub y clones del servidor")} onBack={onBack} error={error ?? state.error ?? search.error} guardCode={state.guardCode ?? search.guardCode} onRetry={() => { void state.reload(); void search.reload(); }} onRefresh={() => { void state.reload(); void search.reload(); }} refreshing={state.loading || search.loading}>
    {notice ? <Text accessibilityRole="alert" style={{ color: colors.brand }}>{notice}</Text> : null}
    <View style={{ flexDirection: "row", gap: 8 }}><TextInput value={query} onChangeText={setQuery} onSubmitEditing={() => { setPage(1); setSearchQuery(query.trim() || "luxipanel"); }} placeholder={nativeText("Buscar repositorios públicos")} placeholderTextColor={colors.textMuted} autoCapitalize="none" style={[inputStyle, { flex: 1 }]} /><Button label={nativeText("Buscar")} onPress={() => { setPage(1); setSearchQuery(query.trim() || "luxipanel"); }} disabled={!query.trim()} /></View>
    {search.loading && !search.data ? <ActivityIndicator color={colors.brand} /> : null}
    {tab === "all" ? <Select value={sort} onChange={value => {setSort(value); setPage(1);}} options={[{value:"relevance",get label() { return nativeText("Relevancia"); }},{value:"stars_desc",get label() { return nativeText("Más estrellas"); }},{value:"stars_asc",get label() { return nativeText("Menos estrellas"); }},{value:"updated",get label() { return nativeText("Actualizados recientemente"); }}]} /> : null}
    <FormDrawer visible={cloneOpen} onClose={()=>setCloneOpen(false)} title={nativeText("Clonar repositorio")} language={language}>
      {error ? <Text accessibilityRole="alert" style={{color:colors.danger}}>{localizeServerError(error)}</Text> : null}
    <View style={cardStyle}>
      <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{nativeText("Clonar repositorio")}</Text>
      <Field label={nativeText("Propietario/repositorio")}><TextInput value={cloneRepo} onChangeText={setCloneRepo} placeholder="owner/repo" placeholderTextColor={colors.textMuted} autoCapitalize="none" style={inputStyle} /></Field>
      <Field label={nativeText("Ruta de destino en el servidor")}><TextInput value={cloneDest} onChangeText={setCloneDest} placeholder="/home/usuario/proyecto" placeholderTextColor={colors.textMuted} autoCapitalize="none" style={inputStyle} /></Field>
      <SegmentedControl items={[{ key: "https", label: "HTTPS" }, { key: "ssh", get label() { return nativeText("SSH"); } }]} value={transport} onChange={(value) => setTransport(value as typeof transport)} />
      <Button label={nativeText("Clonar")} onPress={() => void clone()} disabled={busy || !cloneRepo.trim() || !cloneDest.trim()} />
    </View>
    </FormDrawer>
    {tab === "cloned" || tab === "update" ? <ModuleGrid columns={3}>    {false ? <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{nativeText("Clones del servidor")}</Text> : null}
    {clones.filter(clone => (tab !== "update" || !!clone.behind) && clone.fullName.toLowerCase().includes(query.toLowerCase())).map((clone) => <View key={clone.id} style={cardStyle}>
      <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{clone.fullName}</Text>
      <Text selectable style={{ color: colors.textSecondary, fontSize: 12 }}>{clone.path} · {clone.branch}</Text>
      {clone.statusError || clone.dirty || clone.behind ? <Text style={{ color: clone.statusError ? colors.danger : colors.warning, fontSize: 12 }}>{clone.statusError ?? (clone.dirty ? nativeText("Cambios locales") : nativeText("{p0} commits pendientes", {p0: String(clone.behind)}))}</Text> : null}
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}><Button label={nativeText("Comprobar")} variant="ghost" onPress={() => void mutate("POST", `/api/repository-store/clones/${encodeURIComponent(clone.id)}/check`, {})} disabled={busy} />{clone.behind && !clone.dirty && !clone.statusError ? <Button label={nativeText("Actualizar")} onPress={() => setConfirm({ get title() { return nativeText("Actualizar clone"); }, message: nativeText("Se actualizará {p0} desde GitHub.", {p0: String(clone.fullName)}), method: "POST", path: `/api/repository-store/clones/${encodeURIComponent(clone.id)}/update`, body: {} })} disabled={busy} /> : null}<Button label={nativeText("Desvincular")} variant="danger" onPress={() => setConfirm({ get title() { return nativeText("Desvincular clone"); }, message: nativeText("Se quitará {p0} del catálogo. Los archivos seguirán en el servidor.", {p0: String(clone.fullName)}), method: "DELETE", path: `/api/repository-store/clones/${encodeURIComponent(clone.id)}` })} disabled={busy} /></View>
    </View>)}
</ModuleGrid> : null}
    {tab === "saved" ? <ModuleGrid columns={3}>{saved.filter(name=>name.toLowerCase().includes(query.toLowerCase())).map(name=><View key={name} style={cardStyle}><Text style={{color:colors.textPrimary,fontWeight:"700"}}>{name}</Text><Button label={nativeText("Clonar")} onPress={()=>{setCloneRepo(name);setCloneOpen(true);}}/><Button label={nativeText("Quitar de guardados")} variant="ghost" onPress={()=>void mutate("POST","/api/repository-store/saved",{fullNames:[name],saved:false})}/><Button label={nativeText("GitHub ↗")} variant="ghost" onPress={()=>void Linking.openURL(`https://github.com/${name}`)}/></View>)}</ModuleGrid> : null}
    {tab === "all" ? <ModuleGrid columns={3}>
    {repos.map((repo) => { const bookmarked = saved.some((item) => item.toLowerCase() === repo.full_name.toLowerCase()); return <View key={repo.id} style={cardStyle}>
      <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{repo.full_name}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{repo.description || nativeText("Sin descripción")}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>★ {repo.stargazers_count} · {repo.updated_at ? new Date(repo.updated_at).toLocaleDateString() : "—"}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}><Button label={bookmarked ? nativeText("Quitar favorito") : nativeText("Guardar favorito")} variant="ghost" onPress={() => void mutate("POST", "/api/repository-store/saved", { fullNames: [repo.full_name], saved: !bookmarked })} disabled={busy} /><Button label={nativeText("Clonar")} onPress={() => {setCloneRepo(repo.full_name);setCloneOpen(true);}} /><Button label={nativeText("GitHub ↗")} variant="ghost" onPress={() => { void Linking.openURL(repo.html_url); }} /></View>
    </View>; })}
    </ModuleGrid> : null}
    {tab === "all" ? <View style={{flexDirection:"row",gap:8,alignItems:"center"}}><Button label={nativeText("Anterior")} variant="ghost" disabled={page === 1 || search.loading} onPress={()=>setPage(page-1)}/><Text style={{color:colors.textMuted}}>{nativeText("Página")}{" "}{page}</Text><Button label={nativeText("Siguiente")} variant="ghost" disabled={page*36 >= Math.min(search.data?.total_count ?? 0,1000) || search.loading} onPress={()=>setPage(page+1)}/></View> : null}
    {tab === "all" && !repos.length && !search.loading ? <Text style={{ color: colors.textMuted }}>{nativeText("No hay resultados.")}</Text> : null}
    <ConfirmDialog visible={!!confirm} title={confirm?.title ?? nativeText("Confirmar")} message={confirm?.message ?? ""} confirmLabel={nativeText("Continuar")} cancelLabel={nativeText("Cancelar")} submitting={busy} error={error ?? undefined} onCancel={() => { if (!mutationPending.current) setConfirm(null); }} onConfirm={() => { if (!confirm) return; const pending = confirm; void mutate(pending.method, pending.path, pending.body).then(ok => { if (ok) setConfirm(null); }); }} />
  </ServerModuleScreen>;
}
