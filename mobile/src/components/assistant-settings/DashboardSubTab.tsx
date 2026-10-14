import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { luxAssistantProxy } from "../../api/client";
import { callServerApi } from "../../api/serverApi";
import { runServerMutation } from "../../hooks/useServerApi";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { SegmentedControl } from "../ui/SegmentedControl";
import { ConfirmDialog, Field } from "../server/Form";
import { ServerDataTable } from "../server/ServerDataTable";
import { SvgLineChart } from "../server/SvgLineChart";
import { PROVIDER_ORDER, PROVIDER_META, ProviderIcon } from "../ProviderIcon";
import type { ThemeTokens } from "../../theme/colors";
import type { Messages } from "../../i18n/messages";
import { s } from "./styles";
import type { UsageCost } from "./types";

type T = Messages["assistantSettings"];
type UsageRow={id?:string;ts:string;model:string;mode:string;inputTokens:number;outputTokens:number;totalTokens:number};
type Usage={items:UsageRow[];total:number;totals?:{input:number;output:number;total:number}};
type Daily={day:string;inputTokens:number;outputTokens:number;total:number};
type Savings={rawInput:number;sentInput:number;savedTokens:number};
type Storage={imagesBytes:number;chatsBytes:number;totalBytes:number};
const fmtInt=(n:number)=>Math.round(n||0).toLocaleString("es");
const fmtUsd=(n:number)=>`$${(n||0).toFixed(n>=1?2:4)}`;
const bytes=(n:number)=>n>=1048576?`${(n/1048576).toFixed(1)} MB`:n>=1024?`${(n/1024).toFixed(1)} KB`:`${n||0} B`;

/** Same section order as web StatsTab: storage, provider, filters, totals, cost, savings, chart, history. */
export function DashboardSubTab({panelId,token,t,tokens}:{panelId:string;token:string;t:T;tokens:ThemeTokens}) {
 const [provider,setProvider]=useState("claude");
 const [model,setModel]=useState(""),[from,setFrom]=useState(""),[sort,setSort]=useState("desc");
 const [projectId,setProjectId]=useState(""),[userId,setUserId]=useState(""),[conversationId,setConversationId]=useState("");
 const [models,setModels]=useState<string[]>([]),[projects,setProjects]=useState<{id:string;title:string}[]>([]);
 const [users,setUsers]=useState<string[]>([]),[chats,setChats]=useState<{id:string;title:string}[]>([]);
 const [cost,setCost]=useState<UsageCost|null>(null),[usage,setUsage]=useState<Usage|null>(null);
 const [series,setSeries]=useState<Daily[]>([]),[savings,setSavings]=useState<Savings|null>(null);
 const [loading,setLoading]=useState(false),[error,setError]=useState("");
 const [version,setVersion]=useState(0),[chart,setChart]=useState("bar"),[chartWidth,setChartWidth]=useState(250);
 const [loadingMore,setLoadingMore]=useState(false);
 const generation=useRef(0);
 const params=new URLSearchParams({provider,sort});
 for(const [key,value] of Object.entries({model,from,projectId,userId,conversationId}))if(value)params.set(key,value);
 const query=params.toString();
 const validDate=!from||(/^\d{4}-\d{2}-\d{2}$/.test(from)&&!Number.isNaN(Date.parse(from)));
 useEffect(()=>{
  let current=true;
  void Promise.all([
   luxAssistantProxy<{models:string[]}>(panelId,token,"GET","/api/ai/stats/models"),
   luxAssistantProxy<{projects:{id:string;title:string}[]}>(panelId,token,"GET","/api/ai/projects"),
  ]).then(([m,p])=>{if(current){setModels(m?.models??[]);setProjects(p?.projects??[]);}});
  return()=>{current=false;};
 },[panelId,token]);
 useEffect(()=>{
  let current=true;setUsers([]);setChats([]);
  void Promise.all([
   luxAssistantProxy<{users:string[]}>(panelId,token,"GET",`/api/ai/stats/users?provider=${encodeURIComponent(provider)}`),
   luxAssistantProxy<{items:{id:string;title:string}[]}>(panelId,token,"GET",`/api/ai/conversations?limit=200&provider=${encodeURIComponent(provider)}${projectId?`&projectId=${encodeURIComponent(projectId)}`:""}`),
  ]).then(([u,c])=>{if(current){setUsers(u?.users??[]);setChats(c?.items??[]);}});
  return()=>{current=false;};
 },[panelId,token,provider,projectId]);
 useEffect(()=>{
  const ticket=++generation.current;
  setUsage(null);setCost(null);setSeries([]);setSavings(null);setLoadingMore(false);
  if(!validDate){setLoading(false);setError("Introduce la fecha con el formato AAAA-MM-DD.");return;}
  setLoading(true);setError("");
  void Promise.all([
   luxAssistantProxy<UsageCost>(panelId,token,"GET",`/api/ai/stats/cost?${query}`),
   luxAssistantProxy<Usage>(panelId,token,"GET",`/api/ai/stats/usage?${query}&limit=100&offset=0`),
   luxAssistantProxy<{series:Daily[]}>(panelId,token,"GET",`/api/ai/stats/daily?${query}`),
   luxAssistantProxy<{savings:Savings}>(panelId,token,"GET",`/api/ai/stats/savings?${query}`),
  ]).then(([c,u,d,sv])=>{
   if(ticket!==generation.current)return;
   setCost(c);setUsage(u);setSeries(d?.series??[]);setSavings(sv?.savings??null);setLoading(false);
   if(!c||!u||!d||!sv)setError("No se pudieron cargar todas las estadísticas.");
  });
  return()=>{generation.current++;};
 },[panelId,token,query,version,validDate]);
 const loadMore=async()=>{
  if(!usage||loadingMore)return;
  const ticket=generation.current;setLoadingMore(true);
  const next=await luxAssistantProxy<Usage>(panelId,token,"GET",`/api/ai/stats/usage?${query}&limit=100&offset=${usage.items.length}`);
  if(ticket!==generation.current)return;
  setLoadingMore(false);
  if(next)setUsage(current=>current?{...next,items:[...current.items,...next.items]}:next);else setError("No se pudo cargar el historial.");
 };
 const totals=usage?.totals??usage?.items.reduce((a,m)=>({input:a.input+(m.inputTokens||0),output:a.output+(m.outputTokens||0),total:a.total+(m.totalTokens||0)}),{input:0,output:0,total:0})??{input:0,output:0,total:0};
 const card=[s.card,{backgroundColor:tokens.bgInput,borderColor:tokens.border}];
 const stats=(items:[string,string][])=> <View style={{flexDirection:"row",gap:8}}>{items.map(([label,value])=><View key={label} style={{flex:1,gap:6}}><Text style={{color:tokens.textMuted,fontSize:11}}>{label}</Text><Text style={{color:tokens.textPrimary,fontWeight:"700",fontSize:18}}>{value}</Text></View>)}</View>;
 const selector=(label:string,value:string,onChange:(v:string)=>void,options:{value:string;label:string}[])=><Field label={label}><Select accessibilityLabel={label} value={value} onChange={onChange} options={options}/></Field>;
 const all={value:"",label:"Todos"};
 const chartMax=Math.max(1,...series.map(day=>day.total));
 return <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} nestedScrollEnabled>
  <StoragePanel panelId={panelId} token={token} tokens={tokens}/>
  <ScrollView horizontal style={{flexGrow:0}} contentContainerStyle={{gap:6}}>{PROVIDER_ORDER.map(id=><Pressable key={id} accessibilityRole="button" accessibilityLabel={PROVIDER_META[id].label} accessibilityState={{selected:provider===id}} onPress={()=>{setProvider(id);setModel("");setUserId("");setConversationId("");}} style={{flexDirection:"row",alignItems:"center",gap:6,padding:10,borderRadius:8,backgroundColor:provider===id?tokens.brandDim:tokens.bgInput}}><ProviderIcon id={id} size={16}/><Text style={{color:tokens.textPrimary}}>{PROVIDER_META[id].label}</Text></Pressable>)}</ScrollView>
  <View style={{gap:12}}>
   {selector("Modelo",model,setModel,[all,...models.map(value=>({value,label:value}))])}
   <Field label="Desde"><TextInput accessibilityLabel="Desde" placeholder="AAAA-MM-DD" placeholderTextColor={tokens.textMuted} value={from} onChangeText={setFrom} maxLength={10} style={{color:tokens.textPrimary,borderColor:tokens.border,borderWidth:1,borderRadius:8,padding:12}}/></Field>
   {selector("Orden",sort,setSort,[{value:"desc",label:"Más recientes"},{value:"asc",label:"Más antiguos"}])}
   {selector("Proyecto",projectId,v=>{setProjectId(v);setConversationId("");},[all,{value:"none",label:"Sin proyecto"},...projects.map(p=>({value:p.id,label:p.title}))])}
   {selector("Usuario",userId,setUserId,[all,...users.map(value=>({value,label:value}))])}
   {selector("Chat",conversationId,setConversationId,[all,...chats.map(c=>({value:c.id,label:c.title||"Sin título"}))])}
  </View>
  {error?<Text accessibilityRole="alert" style={{color:tokens.danger}}>{error}</Text>:null}
  {loading?<ActivityIndicator color={tokens.brand}/>:null}
  <View style={card}>{stats([[t.dashInputTokens,fmtInt(totals.input)],[t.dashOutputTokens,fmtInt(totals.output)],[t.dashTotalTokens,fmtInt(totals.total)]])}</View>
  {cost&&cost.models.length>0?<View style={card}>
   <Text style={[s.cardTitle,{color:tokens.textPrimary}]}>{t.dashCostTitle} · {fmtUsd(cost.totalUsd)}</Text>
   <Text style={[s.cardDesc,{color:tokens.textMuted}]}>{t.dashCostEstimateNote}</Text>
   {cost.models.map((m,i)=><View key={`${m.model}/${i}`} style={[s.tableRow,{borderTopColor:tokens.border}]}><View style={{flex:1}}><Text style={{color:tokens.textPrimary}}>{m.model}</Text><Text style={{color:tokens.textMuted,fontSize:11}}>{fmtInt(m.inputTokens)} entrada · {fmtInt(m.outputTokens)} salida</Text></View><Text style={{color:tokens.textPrimary}}>{fmtUsd(m.usd)}</Text></View>)}
  </View>:null}
  {savings&&savings.savedTokens>0?<View style={card}><Text style={{color:tokens.success}}>Ahorro de contexto · {Math.round(savings.savedTokens/Math.max(1,savings.rawInput)*100)}%</Text>{stats([["Original",fmtInt(savings.rawInput)],["Enviado",fmtInt(savings.sentInput)],["Ahorrado",fmtInt(savings.savedTokens)]])}</View>:null}
  <View style={card} onLayout={e=>setChartWidth(Math.max(100,e.nativeEvent.layout.width-32))}>
   <Text style={{fontWeight:"600",color:tokens.textPrimary}}>Consumo diario</Text>
   <SegmentedControl scroll value={chart} onChange={setChart} items={[{key:"bar",label:"Barras"},{key:"line",label:"Líneas"},{key:"heatmap",label:"Mapa de calor"}]}/>
   {!series.length?<Text style={{color:tokens.textMuted}}>{loading?"Cargando…":"Sin datos para estos filtros."}</Text>:chart==="line"?<SvgLineChart width={chartWidth} height={160} maxY={chartMax} gridColor={tokens.border} series={[{color:tokens.brand,values:series.map(day=>day.total)}]}/>:chart==="bar"?<ScrollView horizontal><View style={{flexDirection:"row",alignItems:"flex-end",gap:8,height:185}}>{series.map(day=><View key={day.day} accessibilityLabel={`${day.day}: ${fmtInt(day.total)} tokens`} style={{width:42,alignItems:"center",gap:6}}><View style={{height:Math.max(2,150*day.total/chartMax),width:24,borderRadius:3,backgroundColor:tokens.brand}}/><Text style={{fontSize:9,color:tokens.textMuted}}>{day.day.slice(5)}</Text></View>)}</View></ScrollView>:<View style={{flexDirection:"row",flexWrap:"wrap",gap:4}}>{series.map(day=><View key={day.day} accessibilityLabel={`${day.day}: ${fmtInt(day.total)} tokens`} style={{width:22,height:22,borderRadius:3,backgroundColor:tokens.brand,opacity:.15+.85*day.total/chartMax}}/>)}</View>}
  </View>
  <View style={{gap:10}}><View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center"}}><Text style={{fontWeight:"600",color:tokens.textPrimary}}>Historial ({usage?.total??0})</Text><Button label="Actualizar" variant="secondary" size="sm" loading={loading} onPress={()=>setVersion(v=>v+1)}/></View>
   <ServerDataTable key={`${provider}:${query}`} title="Consumo" rows={usage?.items??[]} rowKey={(row)=>row.id??`${row.ts}:${row.model}:${row.totalTokens}`} columns={[{id:"ts",header:"Fecha",cell:r=>new Date(r.ts).toLocaleString(),width:160},{id:"model",header:"Modelo",cell:r=>r.model,width:170},{id:"mode",header:"Modo",cell:r=>r.mode,width:70},{id:"input",header:"Entrada",cell:r=>fmtInt(r.inputTokens),width:100},{id:"output",header:"Salida",cell:r=>fmtInt(r.outputTokens),width:100},{id:"total",header:"Total",cell:r=>fmtInt(r.totalTokens),width:100}]}/>
   {usage&&usage.items.length<usage.total?<Button label="Cargar más" loading={loadingMore} onPress={()=>void loadMore()}/>:null}
  </View>
 </ScrollView>;
}

function StoragePanel({panelId,token,tokens}:{panelId:string;token:string;tokens:ThemeTokens}) {
 const [usage,setUsage]=useState<Storage|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState("");
 const [confirm,setConfirm]=useState<"images"|"chats"|null>(null),[busy,setBusy]=useState(false);
 const sequence=useRef(0);
 const reload=async()=>{
  const ticket=++sequence.current;setLoading(true);setError("");
  const data=await luxAssistantProxy<Storage>(panelId,token,"GET","/api/ai/storage");
  if(sequence.current!==ticket)return;
  setUsage(data);setLoading(false);if(!data)setError("No se pudo cargar el almacenamiento.");
 };
 useEffect(()=>{void reload();return()=>{sequence.current++;};},[panelId,token]);
 const clear=async()=>{
  if(!confirm||busy)return;setBusy(true);setError("");
  try {
   const result=await runServerMutation(panelId,token,()=>callServerApi(panelId,token,"DELETE",`/api/ai/storage/${confirm}`));
   if(!result.ok)throw new Error(result.error??"No se pudo vaciar el almacenamiento.");
   setConfirm(null);await reload();
  }catch(cause){setError(cause instanceof Error?cause.message:"No se pudo completar la operación.");}
  finally{setBusy(false);}
 };
 return <View style={[s.card,{backgroundColor:tokens.bgInput,borderColor:tokens.border}]}>
  <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center"}}><Text style={{fontWeight:"600",color:tokens.textPrimary}}>Almacenamiento</Text><Button label="Actualizar" variant="secondary" size="sm" loading={loading} onPress={()=>void reload()}/></View>
  <View style={{flexDirection:"row",gap:8}}>{[["Imágenes y adjuntos",usage?.imagesBytes],["Chats e historial",usage?.chatsBytes],["Total",usage?.totalBytes]].map(([label,value])=><View key={label} style={{flex:1,gap:6}}><Text style={{fontSize:11,color:tokens.textMuted}}>{label}</Text><Text style={{fontWeight:"700",color:tokens.textPrimary}}>{loading?"…":usage?bytes(Number(value)):"—"}</Text></View>)}</View>
  <View style={{gap:8}}><Button label="Vaciar imágenes" variant="secondary" disabled={busy||!usage?.imagesBytes} onPress={()=>setConfirm("images")}/><Button label="Vaciar chats" variant="danger" disabled={busy||!usage} onPress={()=>setConfirm("chats")}/></View>
  {error?<Text accessibilityRole="alert" style={{color:tokens.danger}}>{error}</Text>:null}
  <ConfirmDialog visible={!!confirm} title={confirm==="images"?"Vaciar imágenes":"Vaciar chats"} message={confirm==="images"?"Se eliminarán todas las imágenes y adjuntos del asistente.":"Se eliminarán todos los chats y su historial. Esta acción es irreversible."} confirmLabel="Eliminar" cancelLabel="Cancelar" submitting={busy} onCancel={()=>setConfirm(null)} onConfirm={()=>void clear()}/>
 </View>;
}
export default DashboardSubTab;
