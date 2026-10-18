// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Real chat renderer with synthetic automatic phases; never calls a provider.
import path from "node:path";
import os from "node:os";
import { createServer } from "vite";
import tailwind from "@tailwindcss/vite";

// This fixture renders local data only, including a simulated event transport.
const transport = `window.WebSocket=class extends EventTarget {
  static CONNECTING=0; static OPEN=1; static CLOSING=2; static CLOSED=3;
  readyState=0;
  constructor(){super();queueMicrotask(()=>{this.readyState=1;this.onopen?.(new Event("open"));});}
  send(){}
  close(){this.readyState=3;this.onclose?.(new Event("close"));}
};`;

const entry = `
import {createElement,useState} from "react";
import {createRoot} from "react-dom/client";
import {ChatMain} from "/src/components/floating-assistant/chat-pane/ChatMain.tsx";
import {useAssistantI18n} from "/src/components/floating-assistant/i18n.tsx";
import "/src/styles/starwind.css";
import "/src/styles/panel-workspace.css";
import "/src/styles/reactbits-kit.css";
const query=new URLSearchParams(location.search);
const noop=()=>{};
const cli=query.get("mode")!=="api";
function App(){
  const {chatTab:ct}=useAssistantI18n();
  const [phase,setPhase]=useState(Number(query.get("phases"))||1);
  const [done,setDone]=useState(query.has("done"));
  const [next,setNext]=useState(false);
  const [draft,setDraft]=useState("");
  const turns=[{role:"user",text:"Completa la revisión del proyecto y comprueba los resultados.",tools:[]}];
  for(let index=0;index<phase;index++){
    if(index)turns.push({role:"user",text:"Informe automático del equipo "+index,tools:[],auto:true});
    const latest=index===phase-1;
    turns.push({role:"assistant",provider:"codex",text:latest&&done?"Revisión terminada. Los cambios y sus comprobaciones están consolidados en esta respuesta.":"",
      pending:latest&&!done,completionPending:!latest,cli,createdAt:1792231200000+index*60000,
      ...(cli?{cliHistoryLog:"Revisando la fase "+(index+1)+".\\nComprobando los resultados del equipo."}:{}),
      tools:cli?[]:[{id:"read-"+index,name:"files.read",input:{path:"ejemplo.txt"},result:{success:true,output:"Comprobación de fase "+(index+1)}}]});
  }
  if(next)turns.push({role:"user",text:"Una nueva petición independiente",tools:[]},{role:"assistant",text:"Esta respuesta pertenece a la nueva petición.",tools:[]});
  const vm={active:false,activeId:"qa-execution",chatKey:"qa-execution",provider:"codex",mode:cli?"cli":"api",uiMode:"advanced",
    turns,streaming:!done&&!next,chatLoading:false,ct,projects:[],projectTeamAgents:[],historicalProjectAgents:[],rolesById:new Map(),
    currentAgent:null,headerAgent:null,currentAgentId:null,currentProjectId:null,agentCatalogReady:true,
    draft,attachments:[],queued:[],modelOptions:[],quickStartSuggestions:[],visibleProviderOptions:[{id:"codex"}],selectedModel:"",selectedEffort:"Auto",
    chatTokens:{total:0,assistantTurns:phase},support:{enabled:false},contentRef:{current:null},scrollerRef:{current:null},textareaRef:{current:null},
    teamBoardGroups:{byTurn:new Map(),unanchored:[]},renderTeamBoard:()=>null,send:async()=>{},newConversation:noop,openConversation:noop,
    setDraft,setEditorPath:noop,setSelectedModel:noop,setSelectedEffort:noop,setListOpen:noop};
  return createElement("div",{className:"flex flex-1 flex-col"},
    createElement("nav",{"aria-label":"Controles de prueba",className:"flex flex-wrap gap-2 border-b border-border p-3 text-sm"},
      createElement("button",{onClick:()=>{setPhase(value=>value+1);setDone(false);},className:"rounded border border-border px-3 py-2"},"Siguiente fase"),
      createElement("button",{onClick:()=>setDone(true),className:"rounded border border-border px-3 py-2"},"Finalizar"),
      createElement("button",{onClick:()=>{setDone(true);setNext(true);},className:"rounded border border-border px-3 py-2"},"Nueva petición")),
    createElement(ChatMain,{vm,attachmentImages:new Map()}));
}
createRoot(document.getElementById("root")).render(createElement(App));
`;
const server = await createServer({
  configFile: false, envDir: false, root: process.cwd(), publicDir: "public",
  cacheDir: process.env.LXP_QA_CACHE || path.join(os.tmpdir(), "lxp-continuous-execution-qa", "vite"),
  resolve: { alias: { "@": path.resolve("src") } },
  plugins: [{
    name: "continuous-execution-fixture",
    resolveId(id) { if (id === "/qa-entry.js") return "\0qa-entry.js"; },
    load(id) { if (id === "\0qa-entry.js") return entry; },
    configureServer(s) { s.middlewares.use((req, res, next) => {
      if (req.url?.startsWith("/api/")) {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: true, items: [], projects: [], agents: [], tasks: [], runs: [], quota: null }));
        return;
      }
      if (req.url?.split("?")[0] !== "/") return next();
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(`<!doctype html><html lang="es" class="${req.url?.includes("light") ? "" : "dark"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ejecución continua del asistente</title><link rel="icon" href="data:,"><style id="xterm-css-cdn"></style><style>html,body{margin:0;min-height:100%}#root{min-height:100vh}</style></head><body class="bg-background text-foreground"><main data-workspace-shell><div id="root" class="lxp-workspace-chat flex flex-col"></div></main><script>${transport}</script><script type="module" src="/qa-entry.js"></script></body></html>`);
    }); },
  }, tailwind()],
  server: { host: "127.0.0.1", port: Number(process.env.LXP_QA_PORT) || 0, strictPort: true, hmr: false, watch: null },
});
await server.listen();
console.log(`http://127.0.0.1:${server.httpServer.address().port}/`);
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, async () => { await server.close(); process.exit(0); });
