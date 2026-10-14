import { nativeText } from '../../i18n/native-text';
import { moduleInputMetrics } from "../../components/ui/ModuleUi";
import { Select } from "../../components/ui/Select";
import { Field } from "../../components/server/Form";
import React, { useEffect, useContext, useState } from "react";
import { PanelText as Text } from "../../components/ui/PanelText";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { NativeGraphResult } from "./NativeGraphResult";
import { NativeModuleContext } from "../main/native-module-context";
import { callServerApi, unwrap } from "../../api/serverApi";
import { ServerModuleScreen } from "../../components/server/ServerModuleScreen";
import { Button } from "../../components/ui/Button";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { useServerResource } from "../../hooks/useServerApi";
import { useTheme } from "../../hooks/useTheme";
import { getThemeTokens } from "../../theme/colors";

type Project = { id: string; title: string; path?: string; graphIndex?: { enabled?: boolean } };
type Catalog = { availability?: { available?: boolean; reason?: string }; projects?: Project[] };
type Tool = "get_architecture" | "search_graph" | "trace_path" | "get_code_snippet" | "index_status" | "detect_changes";
const TOOLS: { key: Tool; label: string; input?: string }[] = [
  { key: "get_architecture", get label() { return nativeText("Arquitectura"); } },
  { key: "search_graph", get label() { return nativeText("Buscar"); }, input: "Nombre o patrón" },
  { key: "trace_path", get label() { return nativeText("Trazar"); }, input: "Función" },
  { key: "get_code_snippet", get label() { return nativeText("Código"); }, input: "Nombre completo" },
  { key: "index_status", get label() { return nativeText("Estado"); } },
  { key: "detect_changes", get label() { return nativeText("Cambios"); } },
];

/** Native project selector and graph query console. */
export function NativeCodebaseGraphScreen({ panelId, token, onBack }: { panelId: string; token: string; onBack: () => void }) {
  const { theme } = useTheme();
  const colors = getThemeTokens(theme === "dark");
  const catalog = useServerResource<Catalog>(() => callServerApi(panelId, token, "GET", "/api/codebase-graph/projects"), [panelId, token]);
  const [resultLimit,setResultLimit]=useState("25");
  const [projectId, setProjectId] = useState("");
  const [tool, setTool] = useState<Tool>("get_architecture");
  const [input, setInput] = useState("");
  const [direction, setDirection] = useState<"inbound" | "outbound">("inbound");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const view = useContext(NativeModuleContext);
  useEffect(()=>{ if(view?.selectedView === "symbols") setTool("search_graph"); else if(view?.selectedView === "graph") setTool("trace_path"); },[view?.selectedView,view?.viewRevision]);
  const projects = Array.isArray(catalog.data?.projects) ? catalog.data.projects : [];
  const selected = projects.find((project) => project.id === projectId);
  const currentTool = TOOLS.find((item) => item.key === tool);
  const cardStyle = { borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgCardSolid, padding: 14, gap: 9 } as const;
  const run = async (selectedTool = tool, queryInput = input) => {
    if (!projectId || !selected?.graphIndex?.enabled || !catalog.data?.availability?.available) return;
    const value = queryInput.trim();
    if (TOOLS.find(item=>item.key===selectedTool)?.input && !value) { setError(nativeText("Escribe {p0}.", {p0: nativeText(currentTool?.input??"Consulta")})); return; }
    const args = selectedTool === "search_graph" ? { name_pattern: value } : selectedTool === "trace_path" ? { function_name: value, direction } : selectedTool === "get_code_snippet" ? { qualified_name: value } : {};
    setBusy(true); setError(null); setResult("");
    const response = await callServerApi(panelId, token, "POST", `/api/codebase-graph/projects/${encodeURIComponent(projectId)}/query`, { tool: selectedTool, args });
    setBusy(false);
    if (!response.ok) { setError(response.error ?? nativeText("No se pudo consultar el grafo.")); return; }
    const data = unwrap<unknown>(response);
    setResult(data);
  };
  return <ServerModuleScreen title={nativeText("Grafo de código")} settingsPages={[{key:"explorer",get label() { return nativeText("Explorador"); },content:<Field label={nativeText("Resultados")}><Select value={resultLimit} onChange={setResultLimit} options={["10","25","50"].map(value=>({value,label:value}))}/></Field>},...(view?.openModule?[{key:"related",get label() { return nativeText("Módulos relacionados"); },content:<View style={{gap:12}}><Button label={nativeText("Asistente IA")} onPress={()=>view.openModule?.("assistant")}/><Button label={nativeText("Archivos")} onPress={()=>view.openModule?.("files")}/></View>}]:[]),{key:"remote",get label() { return nativeText("Visor remoto"); },content:<View style={{gap:12}}><Text style={{color:colors.textPrimary,fontWeight:"600"}}>{nativeText("Visor remoto")}</Text><Text style={{color:colors.textSecondary}}>{nativeText("El visor del grafo está disponible en el puerto local 9749 del servidor. Puedes acceder desde tu equipo mediante un túnel local.")}</Text><Text selectable style={{color:colors.textSecondary,fontFamily:"monospace"}}>ssh -L 19749:127.0.0.1:9749 user@server</Text><Text selectable style={{color:colors.textMuted}}>http://127.0.0.1:19749/</Text></View>}]} subtitle={nativeText("Arquitectura y relaciones del proyecto")} onBack={onBack} error={error ?? catalog.error} guardCode={catalog.guardCode} onRetry={() => void catalog.reload()} onRefresh={() => void catalog.reload()} refreshing={catalog.loading}>
    {catalog.loading && !catalog.data ? <ActivityIndicator color={colors.brand} /> : null}
    <Text style={{ color: catalog.data?.availability?.available ? colors.brand : colors.warning, fontSize: 12 }}>{catalog.data?.availability?.available ? nativeText("Índice disponible") : catalog.data?.availability?.reason ?? nativeText("Índice no disponible")}</Text>
    <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{nativeText("Proyectos")}</Text>
    <Select value={projectId} onChange={value=>{setProjectId(value);setResult("");}} placeholder={nativeText("Seleccionar proyecto")} options={projects.map(project=>({value:project.id,label:project.title}))}/>
    {!projects.length && !catalog.loading ? <Text style={{ color: colors.textMuted }}>{nativeText("No hay proyectos visibles.")}</Text> : null}
    {selected ? <View style={cardStyle}>
      <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{nativeText("Consultar")}{" "}{selected.title}</Text>
      <SegmentedControl items={TOOLS.map((item) => ({ key: item.key, label: item.label }))} value={tool} onChange={(value) => { setTool(value as Tool); setInput(""); setResult(""); }} scroll />
      {currentTool?.input ? <TextInput value={input} onChangeText={setInput} placeholder={nativeText(currentTool.input)} placeholderTextColor={colors.textMuted} autoCapitalize="none" style={{ ...moduleInputMetrics, borderColor: colors.border, backgroundColor: colors.bgPrimary, color: colors.textPrimary }} /> : null}
      {tool === "trace_path" ? <SegmentedControl items={[{ key: "inbound", get label() { return nativeText("Quién llama"); } }, { key: "outbound", get label() { return nativeText("Qué llama"); } }]} value={direction} onChange={(value) => setDirection(value as typeof direction)} /> : null}
      <Button label={nativeText("Consultar grafo")} onPress={() => void run()} disabled={busy || !selected.graphIndex?.enabled || !catalog.data?.availability?.available} loading={busy} />
      {result != null && result !== "" ? <NativeGraphResult limit={Number(resultLimit)} value={result} tool={tool} onCode={name=>{setTool("get_code_snippet");setInput(name);void run("get_code_snippet",name);}}/> : null}
    </View> : null}
  </ServerModuleScreen>;
}
