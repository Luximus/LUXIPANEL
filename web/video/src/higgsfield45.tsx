import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import { HIGGSFIELD45 as C } from "./higgsfield45-data";

const P = { ink: "#080A12", white: "#EAF0F8", cyan: "#35D8F5", pink: "#EF5AD4", violet: "#A688FF", muted: "#9DA9BF", line: "rgba(180,195,225,.2)" };
const display = '"Chakra Petch", sans-serif';
const body = '"Inter", sans-serif';
const mono = '"JetBrains Mono", monospace';
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = (f: number, a: number, b: number, x = 0, y = 1) => interpolate(f, [a, b], [x, y], clamp);
const enter = (f: number, delay = 0): React.CSSProperties => {
  const s = spring({ frame: f - delay, fps: 30, config: { damping: 23, stiffness: 120 } });
  return { opacity: Math.max(0, Math.min(1, s)), transform: `translateY(${(1 - s) * 32}px)` };
};
function Icon({ type, color = P.cyan, size = 46 }: { type: string; color?: string; size?: number }) {
  const glyphs: Record<string, React.ReactNode> = {
    server: <><rect x="4" y="4" width="24" height="9" rx="2"/><rect x="4" y="19" width="24" height="9" rx="2"/><path d="M9 8.5h.01M9 23.5h.01M15 8.5h9M15 23.5h9"/></>,
    code: <path d="m11 7-8 9 8 9M21 7l8 9-8 9M19 3l-6 26"/>,
    terminal: <><rect x="3" y="4" width="26" height="24" rx="3"/><path d="m8 11 5 5-5 5M17 21h6"/></>,
    graph: <><circle cx="16" cy="5" r="3"/><circle cx="5" cy="24" r="3"/><circle cx="27" cy="24" r="3"/><path d="M15 8 6 21M17 8l9 13M8 24h16"/></>,
    shield: <><path d="M16 3 5 7v8c0 7 5 12 11 14 6-2 11-7 11-14V7Z"/><path d="m10 16 4 4 8-9"/></>,
    monitor: <><rect x="3" y="4" width="26" height="20" rx="3"/><path d="M9 29h14M16 24v5M7 16h5l3-6 4 9 3-4h3"/></>,
    mail: <><rect x="3" y="6" width="26" height="20" rx="3"/><path d="m4 8 12 9L28 8"/></>,
    database: <><ellipse cx="16" cy="7" rx="11" ry="4"/><path d="M5 7v18c0 6 22 6 22 0V7M5 16c0 6 22 6 22 0"/></>,
    globe: <><circle cx="16" cy="16" r="13"/><path d="M3 16h26M16 3c9 7 9 19 0 26-9-7-9-19 0-26Z"/></>,
    backup: <><path d="M6 12a11 11 0 1 1 0 10M6 5v7h7"/><path d="M16 10v7l5 3"/></>,
    module: <><path d="M5 4h8c-2 8 8 8 6 0h8v9c-8-2-8 8 0 6v9h-9c2-8-8-8-6 0H4v-9c8 2 8-8 0-6V4Z"/></>,
    check: <path d="m5 17 7 7L27 8"/>,
    phone: <><rect x="8" y="2" width="16" height="28" rx="4"/><path d="M13 6h6M15 26h2"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{glyphs[type] ?? glyphs.code}</svg>;
}
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: "linear-gradient(135deg,rgba(32,39,58,.96),rgba(12,16,29,.97))", border: `1px solid ${P.line}`, borderRadius: 26, boxShadow: "0 35px 80px rgba(0,0,0,.4), inset 0 1px rgba(255,255,255,.06)", ...style }}>{children}</div>;
}
function Pill({ children, color = P.cyan }: { children: React.ReactNode; color?: string }) {
  return <span style={{ color, border: `1px solid ${color}55`, background: `${color}0f`, padding: "12px 18px", borderRadius: 12, font: `400 25px ${mono}`, whiteSpace: "nowrap" }}>{children}</span>;
}
function Backdrop() {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ background: P.ink }}>
    <div style={{ position: "absolute", inset: -200, background: "radial-gradient(ellipse at 85% 20%,#35d8f526,transparent 50%),radial-gradient(ellipse at 10% 80%,#ef5ad424,transparent 50%)", transform: `translate(${Math.sin(f / 160) * 28}px,${Math.cos(f / 170) * 32}px)` }}/>
    <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(#c6d7fb09 1px,transparent 1px),linear-gradient(90deg,#c6d7fb09 1px,transparent 1px)", backgroundSize: "140px 140px", opacity: .6 }}/>
    <svg width="1080" height="1920" style={{ position: "absolute", inset: 0 }}>
      <defs><linearGradient id="orbit"><stop stopColor={P.cyan}/><stop offset=".55" stopColor={P.violet}/><stop offset="1" stopColor={P.pink}/></linearGradient></defs>
      <ellipse cx="540" cy="1120" rx={610 + Math.sin(f / 60) * 10} ry="460" fill="none" stroke="url(#orbit)" strokeWidth="1" opacity=".15" transform={`rotate(-25 540 1120)`}/>
      <ellipse cx="540" cy="1120" rx="690" ry="530" fill="none" stroke="url(#orbit)" strokeWidth="1" opacity=".1" transform="rotate(-25 540 1120)"/>
    </svg>
  </AbsoluteFill>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ color: P.muted, font: `400 19px ${mono}`, letterSpacing: 1.5, textAlign: "center", marginTop: 25 }}>{children}</div>;
}
function Hook({ f }: { f: number }) {
  return <div style={{ position: "absolute", top: 690, left: 80, width: 920, height: 750 }}>
    <svg width="920" height="750" style={{ position: "absolute" }}>
      <defs><linearGradient id="link"><stop stopColor={P.cyan}/><stop offset="1" stopColor={P.pink}/></linearGradient></defs>
      {[[150, 100], [770, 110], [100, 510], [800, 540]].map(([x, y], i) => <path key={i} d={`M${x} ${y} Q460 ${y} 460 350`} stroke="url(#link)" strokeWidth="2" strokeDasharray="6 12" strokeDashoffset={-f * 2} fill="none" opacity=".65"/>)}
    </svg>
    {[[70, 40], [650, 50], [20, 440], [680, 470]].map(([x, y], i) => <Card key={i} style={{ position: "absolute", top: y + Math.sin(f / 18 + i) * 6, left: x, width: 170, height: 130, display: "grid", placeItems: "center", ...enter(f, i * 5) }}><Icon type="server" size={62} color={i % 2 ? P.pink : P.cyan}/></Card>)}
    <div style={{ position: "absolute", width: 460, height: 460, left: 230, top: 140, borderRadius: "50%", background: "radial-gradient(circle,#a688ff15,transparent 70%)", boxShadow: "0 0 100px #35d8f518", transform: `scale(${1 + ease(f, 0, 110, 0, .05)})` }}><Img src={staticFile("higgsfield45/lp-icon.png")} style={{ width: "100%", height: "100%", objectFit: "contain" }}/></div>
    <div style={{ position: "absolute", top: 625, width: "100%", textAlign: "center", font: `400 28px ${mono}`, letterSpacing: 5, color: P.cyan }}>CÓDIGO · SERVIDORES · IA</div>
  </div>;
}
function Servers({ f }: { f: number }) {
  return <Card style={{ position: "absolute", top: 640, left: 80, width: 920, height: 830, padding: 40 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 16, color: P.white, font: `700 34px ${body}` }}><Icon type="server"/>Una infraestructura conectada</div>
    <div style={{ color: P.muted, font: `400 23px ${mono}`, marginTop: 16 }}>SSH · conexión a tus servidores</div>
    {["Desarrollo", "Datos", "Producción"].map((name, i) => <Card key={name} style={{ height: 138, marginTop: 32, display: "flex", alignItems: "center", padding: 28, gap: 25, borderColor: `${i === 1 ? P.pink : P.cyan}55`, ...enter(f, 12 + i * 12) }}><Icon type="server" size={52} color={i === 1 ? P.pink : P.cyan}/><div style={{ flex: 1, font: `700 35px ${body}`, color: P.white }}>{name}</div><span style={{ font: `400 21px ${mono}`, color: P.muted }}>VPS</span></Card>)}
    <Label>ESQUEMA CONCEPTUAL · CAPTURA REAL PENDIENTE</Label>
  </Card>;
}
function Assistant({ f }: { f: number }) {
  const prompt = "Analiza mi proyecto y prepara el despliegue.";
  const typed = prompt.slice(0, Math.floor(ease(f, 15, 60, 0, prompt.length)));
  return <Card style={{ position: "absolute", top: 640, left: 80, width: 920, height: 830, padding: 38 }}>
    <div style={{ display: "flex", gap: 20, alignItems: "center", color: P.cyan, font: `700 30px ${body}` }}><Icon type="graph"/>Agente · Contexto de proyecto</div>
    <div style={{ display: "flex", gap: 12, marginTop: 25 }}><Pill>Proyecto</Pill><Pill color={P.pink}>Herramientas</Pill><Pill color={P.violet}>MCP</Pill></div>
    <Card style={{ padding: 27, marginTop: 32, height: 180, background: "#262b37", font: `400 34px/1.45 ${body}`, color: P.white }}>{typed}<span style={{ color: P.cyan, opacity: f < 68 && f % 20 < 12 ? 1 : 0 }}>▍</span></Card>
    {["Revisar el contexto", "Preparar una propuesta", "Solicitar tu aprobación"].map((text, i) => <div key={text} style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 22, font: `400 29px ${body}`, color: i === 2 ? P.pink : P.white, ...enter(f, 74 + i * 21) }}><Icon type={i === 2 ? "shield" : "check"} color={i === 2 ? P.pink : P.cyan} size={34}/>{text}</div>)}
    <Label>ESQUEMA CONCEPTUAL · FLUJO REAL PENDIENTE</Label>
  </Card>;
}
function Development({ f }: { f: number }) {
  const stages = [{ title: "Repositorio", icon: "code", detail: "GitHub · archivos" }, { title: "Contexto", icon: "graph", detail: "Mapa · Obsidian" }, { title: "Desarrollo", icon: "terminal", detail: "Terminal · proyectos" }, { title: "Despliegue", icon: "globe", detail: "Web · Expo" }];
  return <div style={{ position: "absolute", top: 640, left: 80, width: 920, height: 830 }}>
    <svg width="920" height="830" style={{ position: "absolute", inset: 0 }}><path d="M460 50V750" stroke={P.cyan} strokeWidth="3" opacity=".25" strokeDasharray="8 14" strokeDashoffset={-f * 3}/></svg>
    {stages.map((stage, i) => <Card key={stage.title} style={{ position: "absolute", top: i * 185, left: i % 2 ? 145 : 0, width: 775, height: 154, display: "flex", gap: 24, alignItems: "center", padding: "28px 34px", ...enter(f, 8 + i * 13) }}><Icon type={stage.icon} color={i % 2 ? P.pink : P.cyan} size={55}/><div><div style={{ color: P.white, font: `700 36px ${body}` }}>{stage.title}</div><div style={{ color: P.muted, font: `400 24px ${mono}`, marginTop: 10 }}>{stage.detail}</div></div><span style={{ marginLeft: "auto", color: P.muted, font: `400 23px ${mono}` }}>0{i + 1}</span></Card>)}
    <div style={{ position: "absolute", top: 780, width: "100%" }}><Label>CONCEPTO DE MONTAJE · PANTALLAS REALES PENDIENTES</Label></div>
  </div>;
}
function Operations({ f }: { f: number }) {
  const modules = [{ name: "Monitor", icon: "monitor", sub: "Recursos y procesos" }, { name: "Firewall", icon: "shield", sub: "Control de acceso" }, { name: "Bases de datos", icon: "database", sub: "Gestión visual" }, { name: "Correo", icon: "mail", sub: "Cuentas y dominios" }, { name: "DNS y SSL", icon: "globe", sub: "Web y certificados" }, { name: "Backups", icon: "backup", sub: "Copias y tareas" }];
  return <div style={{ position: "absolute", top: 640, left: 80, width: 920 }}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>{modules.map((module, i) => <Card key={module.name} style={{ height: 216, padding: 29, ...enter(f, 5 + i * 6) }}><Icon type={module.icon} color={i % 2 ? P.pink : P.cyan} size={50}/><div style={{ color: P.white, font: `700 29px ${body}`, marginTop: 18 }}>{module.name}</div><div style={{ color: P.muted, font: `400 21px ${body}`, marginTop: 9 }}>{module.sub}</div></Card>)}</div>
    <div style={{ display: "flex", justifyContent: "center", gap: 15, marginTop: 28 }}><Pill>Hosting</Pill><Pill color={P.violet}>API</Pill></div>
    <Label>CONCEPTO DE MONTAJE · CAPTURAS REALES PENDIENTES</Label>
  </div>;
}
function Modules({ f }: { f: number }) {
  return <div style={{ position: "absolute", top: 640, left: 80, width: 920 }}>
    <Card style={{ height: 480, overflow: "hidden", position: "relative", ...enter(f, 5) }}><Img src={staticFile("higgsfield45/captures/public-modules.png")} style={{ width: 920, height: 480, objectFit: "cover", objectPosition: "top" }}/><div style={{ position: "absolute", bottom: 0, width: "100%", padding: "45px 30px 20px", color: P.white, font: `400 20px ${mono}`, background: "linear-gradient(transparent,#080a12)" }}>CATÁLOGO PÚBLICO · LUXIPANEL.COM</div></Card>
    <div style={{ display: "flex", gap: 20, marginTop: 32 }}>{["Crea", "Publica", "Monetiza"].map((text, i) => <Card key={text} style={{ flex: 1, height: 180, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 20, ...enter(f, 15 + i * 8) }}><Icon type="module" size={45} color={i === 1 ? P.pink : P.cyan}/><span style={{ color: P.white, font: `700 30px ${body}` }}>{text}</span></Card>)}</div>
    <Label>PUBLICACIÓN Y CÓDIGO ABIERTO: VALIDAR PARA EL ESTRENO</Label>
  </div>;
}
function Mobile({ f }: { f: number }) {
  return <div style={{ position: "absolute", top: 625, left: 80, width: 920, height: 870 }}>
    <div style={{ position: "absolute", left: 35, top: 105, width: 500, height: 365, border: `2px solid ${P.line}`, borderRadius: 25, background: "#111724", transform: "perspective(1300px) rotateY(8deg)", padding: 34, color: P.muted, font: `400 22px ${mono}` }}><Icon type="monitor" size={48}/><div style={{ marginTop: 25 }}>WEB Y ESCRITORIO</div><div style={{ font: `700 38px ${display}`, color: P.white, marginTop: 25 }}>LUXIPANEL</div><div style={{ color: P.cyan, marginTop: 22 }}>luxipanel.com</div></div>
    <div style={{ position: "absolute", top: 0, right: 45, width: 342, height: 662, borderRadius: 51, background: "linear-gradient(130deg,#4d5273,#131623 45%,#615874)", padding: 10, boxShadow: "0 40px 80px #0008", transform: `perspective(1600px) rotateY(${ease(f, 0, 35, -12, -3)}deg) translateY(${Math.sin(f / 30) * 4}px)` }}><div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 43, background: "radial-gradient(ellipse at 30% 20%,#35d8f518,#0b0e18 60%)", border: "1px solid #68708855", overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center" }}><div style={{ marginTop: 16, width: 85, height: 20, background: "#020306", borderRadius: 15 }}/><Img src={staticFile("higgsfield45/lp-icon.png")} style={{ width: 275, height: 275, objectFit: "contain", marginTop: 60 }}/><div style={{ color: P.white, font: `700 34px ${display}` }}>LUXIPANEL</div><div style={{ marginTop: 36, color: P.muted, font: `400 19px/1.6 ${mono}`, textAlign: "center" }}>APP NATIVA<br/>CAPTURA PENDIENTE</div></div></div>
    <div style={{ position: "absolute", top: 710, width: "100%", textAlign: "center", ...enter(f, 28) }}><Img src={staticFile("higgsfield45/google-play-badge.webp")} style={{ width: 300, height: 100, objectFit: "contain" }}/><div style={{ marginTop: 9, color: "#FFC879", font: `400 22px ${mono}` }}>ESTRENO TRAS PUBLICACIÓN EN GOOGLE PLAY</div></div>
  </div>;
}
function EndCard() {
  return <AbsoluteFill style={{ alignItems: "center" }}>
    <Img src={staticFile("higgsfield45/lp-icon.png")} style={{ position: "absolute", top: 280, width: 540, height: 540, objectFit: "contain" }}/>
    <div style={{ position: "absolute", top: 820, color: P.white, font: `700 112px ${display}`, letterSpacing: 3 }}>LUXIPANEL</div>
    <div style={{ position: "absolute", top: 1000, color: P.white, font: `700 58px/1.35 ${body}`, textAlign: "center" }}>Desarrolla más.<br/>Gestiona mejor.</div>
    <div style={{ position: "absolute", top: 1250, color: P.cyan, font: `700 75px ${body}`, letterSpacing: -2 }}>luxipanel.com</div>
    <div style={{ position: "absolute", top: 1390, color: P.muted, font: `400 24px ${mono}` }}>DESCUBRE EL CONTROL INTELIGENTE</div>
  </AbsoluteFill>;
}
function Scene({ index }: { index: number }) {
  const f = useCurrentFrame();
  const scene = C.scenes[index];
  const frames = (scene.end - scene.start) * C.fps;
  const fade = (index === 0 ? 1 : ease(f, 0, 12)) * (index === 7 ? 1 : 1 - ease(f, frames, frames + 12));
  const views = [Hook, Servers, Assistant, Development, Operations, Modules, Mobile];
  const Visual = views[index];
  return <AbsoluteFill style={{ opacity: fade, transform: index === 7 ? "none" : `translateX(${index ? ease(f, 0, 12, 35, 0) : 0}px)` }}>
    {index === 7 ? <EndCard/> : <>
      <div style={{ position: "absolute", left: 80, top: 268, color: P.cyan, font: `400 23px ${mono}`, letterSpacing: 2.2 }}>{scene.kicker}</div>
      <div style={{ position: "absolute", left: 75, right: 75, top: 329, color: P.white, font: `700 ${index === 5 ? 74 : 88}px/1.08 ${display}`, letterSpacing: -3 }}>
        {scene.title.map((text, i) => <div key={text} style={{ color: i ? (index % 2 ? P.cyan : P.pink) : P.white, ...enter(f + (index === 0 ? 30 : 0), i * 3) }}>{text}</div>)}
      </div>
      <Visual f={f}/>
    </>}
    {index > 0 && index < 7 && <div style={{ position: "absolute", inset: "0 auto 0 0", width: 80, height: 1920, opacity: ease(f, 0, 5, 0, .18) * (1 - ease(f, 5, 13)), transform: `translateX(${ease(f, 0, 13, -200, 1250)}px) skewX(-16deg)`, background: "linear-gradient(90deg,transparent,#35d8f5,transparent)", filter: "blur(20px)" }}/>}
  </AbsoluteFill>;
}
function Captions() {
  const frame = useCurrentFrame();
  const t = frame / C.fps;
  const scene = C.scenes.find(s => t >= s.start && t < s.end);
  if (!scene || t < scene.start + .25 || t >= scene.end - .25) return null;
  const phrases: readonly string[] = "previewCaptions" in scene ? scene.previewCaptions : scene.captions;
  const total = phrases.reduce((n, phrase) => n + phrase.split(/\s+/).length, 0);
  let at = scene.start + .25;
  let selected = phrases.at(-1);
  for (const phrase of phrases) {
    const until = at + (scene.end - scene.start - .5) * phrase.split(/\s+/).length / total;
    if (t < until) { selected = phrase; break; }
    at = until;
  }
  return <div style={{ position: "absolute", left: 85, right: 85, top: 1578, minHeight: 106, display: "flex", alignItems: "center", justifyContent: "center", color: P.white, font: `400 35px/1.4 ${body}`, textAlign: "center", padding: "16px 22px", background: "#080a12dd", borderRadius: 18, border: "1px solid #ffffff0d", zIndex: 50 }}>{selected}</div>;
}
export const Higgsfield45Preview: React.FC = () => {
  const f = useCurrentFrame();
  return <AbsoluteFill>
    <Backdrop/>
    {C.scenes.map((scene, i) => <Sequence key={scene.id} from={scene.start * C.fps} durationInFrames={(scene.end - scene.start) * C.fps + (i < 7 ? 12 : 0)}><Scene index={i}/></Sequence>)}
    <div style={{ position: "absolute", left: 80, right: 80, top: 108, display: "flex", alignItems: "center", gap: 15, zIndex: 30 }}><Img src={staticFile("higgsfield45/lp-icon.png")} style={{ width: 58, height: 58, objectFit: "contain" }}/><span style={{ color: P.white, font: `700 28px ${display}`, letterSpacing: 2 }}>LUXIPANEL</span><span style={{ marginLeft: "auto", color: P.muted, font: `400 20px ${mono}` }}>45 S · 9:16</span></div>
    <div style={{ position: "absolute", left: 80, right: 80, top: 186, color: "#FFC879", font: `400 19px ${mono}`, letterSpacing: 1, zIndex: 30 }}>PREVISUALIZACIÓN · PLANOS HIGGSFIELD Y VOZ PENDIENTES</div>
    <Captions/>
    <div style={{ position: "absolute", left: 80, right: 80, top: 1780, display: "flex", justifyContent: "space-between", color: P.muted, font: `400 23px ${mono}`, zIndex: 30 }}><span>luxipanel.com</span><span>CONCEPTO DE PRODUCCIÓN</span></div>
    <div style={{ position: "absolute", left: 80, right: 80, bottom: 75, height: 2, background: "#ffffff14", zIndex: 30 }}><div style={{ width: `${f / 1349 * 100}%`, height: "100%", background: `linear-gradient(90deg,${P.cyan},${P.pink})` }}/></div>
    <Audio src={staticFile("higgsfield45/score-120bpm.wav")}/>
  </AbsoluteFill>;
};
