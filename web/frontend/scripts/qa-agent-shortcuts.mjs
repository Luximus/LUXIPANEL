// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Real ChatMain and its selectors; synthetic project data, no provider calls.
import path from "node:path";
import os from "node:os";
import { createServer } from "vite";
import tailwind from "@tailwindcss/vite";

const entry = `
import {createElement} from "react";
import {createRoot} from "react-dom/client";
import {useChatPane} from "/src/components/floating-assistant/chat-pane/use-chat-pane.tsx";
import {ChatMain} from "/src/components/floating-assistant/chat-pane/ChatMain.tsx";
import {assistantProjectsApi,assistantAgentsApi,assistantAgentRolesApi,assistantConversationsApi} from "/src/components/floating-assistant/assistant-api.ts";
import {chatUiState} from "/src/components/floating-assistant/chat-ui-state.ts";
import "/src/styles/starwind.css";
import "/src/styles/panel-workspace.css";
import "/src/styles/reactbits-kit.css";
const names=["Óscar","Sofía","Mateo","Valentina","Andrés","Lucía","Camila","Daniel"];
const roles=["Coordinación","Desarrollo","Pruebas","Diseño","Seguridad","Documentación","Infraestructura","Accesibilidad"];
assistantProjectsApi.list=async()=>[{id:"project",title:"Mi proyecto",teamId:"team",leaderAgentId:"agent-0"}];
assistantAgentsApi.list=async()=>names.map((name,index)=>({id:"agent-"+index,name,roleId:"role-"+index,providerId:"claude",teamId:"team"}));
assistantAgentRolesApi.list=async()=>roles.map((name,index)=>({id:"role-"+index,name}));
assistantConversationsApi.list=async()=>({items:[],total:0});
assistantConversationsApi.activity=async()=>[
  {id:"c-0",agentId:"agent-0",running:true,unreviewed:true,unreadCount:2},
  {id:"c-1",agentId:"agent-1",running:true,pendingPermission:true},
  {id:"c-2",agentId:"agent-2",unreviewed:true,unreadCount:5,lastReplyState:"done"},
  {id:"c-3",agentId:"agent-3",unreviewed:true,unreadCount:1,lastReplyState:"failed"}
];
chatUiState.patchPane("claude",{activeId:null,currentAgentId:null,currentProjectId:"project"});
function App(){
  const vm=useChatPane({provider:"claude",mode:"api",active:true,openProjectId:"project",openNonce:1});
  return createElement(ChatMain,{vm,attachmentImages:new Map()});
}
createRoot(document.getElementById("root")).render(createElement(App));
`;
const server = await createServer({
  configFile: false, envDir: false, root: process.cwd(), publicDir: "public",
  cacheDir: process.env.LXP_QA_CACHE || path.join(os.tmpdir(), "lxp-agent-shortcuts-qa", "vite"),
  resolve: { alias: { "@": path.resolve("src") } },
  plugins: [{
    name: "agent-shortcuts-fixture",
    resolveId(id) { if (id === "/qa-entry.js") return "\0qa-entry.js"; },
    load(id) { if (id === "\0qa-entry.js") return entry; },
    configureServer(s) { s.middlewares.use((req, res, next) => {
      if (req.url?.startsWith("/api/")) {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: true, items: [], projects: [], agents: [], tasks: [], runs: [], quota: null }));
        return;
      }
      if (req.url?.split("?")[0] !== "/") return next();
      const light = req.url?.includes("light");
      res.setHeader("Content-Type", "text/html");
      res.end(`<!doctype html><html lang="es" class="${light ? "" : "dark"}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Agentes del proyecto</title><style id="xterm-css-cdn"></style><style>html,body{margin:0;min-height:100%}#root{min-height:100vh}.lxp-workspace-chat{padding-top:2rem!important}</style></head><body class="bg-background text-foreground"><main data-workspace-shell><div id="root" class="lxp-workspace-chat flex flex-col"></div></main><script type="module" src="/qa-entry.js"></script></body></html>`);
    }); },
  }, tailwind()],
  server: { host: "127.0.0.1", port: Number(process.env.LXP_QA_PORT) || 0, strictPort: true, hmr: false, watch: null },
});
await server.listen();
console.log(`http://127.0.0.1:${server.httpServer.address().port}/`);
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, async () => { await server.close(); process.exit(0); });
