import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
} from "remotion";

const C = {
  deep: "#0b1220",
  navy: "#151c2c",
  panel: "#1e2939",
  panel2: "#253449",
  mint: "#63e6ae",
  cyan: "#22d3ee",
  violet: "#818cf8",
  text: "#f8fafc",
  soft: "#cbd5e1",
  muted: "#8ca0b7",
  line: "rgba(205,225,240,.15)",
};
const display = '"Chakra Petch", sans-serif';
const body = '"Inter", sans-serif';
const mono = '"JetBrains Mono", monospace';
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const icons: Record<string, React.ReactNode> = {
  server: <><rect x="4" y="4" width="24" height="9" rx="2"/><rect x="4" y="19" width="24" height="9" rx="2"/><path d="M9 8.5h.01M9 23.5h.01M15 8.5h9M15 23.5h9"/></>,
  terminal: <><rect x="3" y="5" width="26" height="22" rx="3"/><path d="m9 12 4 4-4 4M16 21h8"/></>,
  activity: <><path d="M3 17h6l4-10 5 18 4-8h7"/></>,
  shield: <><path d="M16 3 5 7v8c0 7 4.6 11.7 11 14 6.4-2.3 11-7 11-14V7L16 3Z"/><path d="m11 16 3.5 3.5L22 12"/></>,
  folder: <><path d="M3 8a3 3 0 0 1 3-3h7l3 3h10a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8Z"/></>,
  backup: <><path d="M7 11a10 10 0 1 1-1 10M7 5v6h6"/><path d="M16 10v7l5 3"/></>,
  modules: <><rect x="3" y="3" width="11" height="11" rx="2"/><rect x="18" y="3" width="11" height="11" rx="2"/><rect x="3" y="18" width="11" height="11" rx="2"/><path d="M23.5 18v11M18 23.5h11"/></>,
  git: <><circle cx="7" cy="7" r="3"/><circle cx="25" cy="25" r="3"/><circle cx="7" cy="25" r="3"/><path d="M7 10v12M10 7h7a8 8 0 0 1 8 8v7"/></>,
  code: <><path d="m11 8-8 8 8 8M21 8l8 8-8 8M19 5l-6 22"/></>,
  spark: <><path d="m16 2 2.5 10.5L29 15l-10.5 2.5L16 28l-2.5-10.5L3 15l10.5-2.5L16 2Z"/><path d="M26 25v5M23.5 27.5h5"/></>,
  globe: <><circle cx="16" cy="16" r="13"/><path d="M3 16h26M16 3c5 4 7 9 7 13s-2 9-7 13C11 25 9 20 9 16s2-9 7-13Z"/></>,
};

function Icon({ name, size = 48, color = C.mint }: { name: string; size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[name]}</svg>;
}

function FadeScene({ frame, start, end, children, last = false }: { frame: number; start: number; end: number; children: React.ReactNode; last?: boolean }) {
  const input = last ? [start, start + 16] : [start, start + 16, end - 16, end];
  const output = last ? [0, 1] : [0, 1, 1, 0];
  const opacity = interpolate(frame, input, output, clamp);
  return <AbsoluteFill style={{ opacity, pointerEvents: "none" }}>{children}</AbsoluteFill>;
}

function rise(frame: number, at: number, distance = 54): React.CSSProperties {
  const progress = spring({ fps: 30, frame: frame - at, config: { damping: 21, mass: .8, stiffness: 115 } });
  return { opacity: Math.max(0, Math.min(1, progress)), transform: `translateY(${(1 - progress) * distance}px)` };
}

function Label({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return <div style={{ position: "absolute", top: 168, left: 80, right: 80, display: "flex", alignItems: "center", justifyContent: "space-between", font: `400 27px ${mono}`, letterSpacing: 3, color: C.mint }}>
    <span>{children}</span><span style={{ color: C.muted }}>{right}</span>
  </div>;
}

function Headline({ children, top = 286, size = 108 }: { children: React.ReactNode; top?: number; size?: number }) {
  return <h1 style={{ position: "absolute", top, left: 80, width: 920, margin: 0, font: `700 ${size}px/.98 ${display}`, letterSpacing: -5, color: C.text }}>{children}</h1>;
}

function Line({ width = "100%" }: { width?: string | number }) {
  return <div style={{ width, height: 1, background: C.line }} />;
}

function Glass({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ borderRadius: 30, border: `1px solid ${C.line}`, background: "linear-gradient(145deg,rgba(36,51,72,.98),rgba(20,30,47,.98))", boxShadow: "0 28px 80px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.06)", ...style }}>{children}</div>;
}

function Base({ frame }: { frame: number }) {
  const drift = interpolate(frame, [0, 1350], [0, -120], clamp);
  return <AbsoluteFill style={{ background: `radial-gradient(ellipse 770px 800px at 70% 25%,rgba(34,211,238,.10),transparent 75%),radial-gradient(ellipse 660px 730px at 0% 86%,rgba(99,230,174,.09),transparent 76%),${C.deep}` }}>
    <div style={{ position: "absolute", inset: 0, opacity: .28, backgroundImage: "linear-gradient(rgba(169,204,226,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(169,204,226,.12) 1px,transparent 1px)", backgroundSize: "90px 90px", backgroundPosition: `0 ${drift}px`, maskImage: "linear-gradient(180deg,transparent,#000 25%,#000 85%,transparent)" }} />
    <div style={{ position: "absolute", top: 35, left: 35, right: 35, bottom: 35, border: "1px solid rgba(155,190,210,.06)", borderRadius: 34 }} />
  </AbsoluteFill>;
}

function CommandThread({ frame }: { frame: number }) {
  const draw = interpolate(frame, [0, 1220], [2700, 0], clamp);
  return <svg width="1080" height="1920" viewBox="0 0 1080 1920" style={{ position: "absolute", inset: 0, opacity: .4 }}>
    <defs><linearGradient id="thread" x1="0" y1="1" x2="1" y2="0"><stop stopColor={C.mint}/><stop offset=".52" stopColor={C.cyan}/><stop offset="1" stopColor={C.violet}/></linearGradient><filter id="glow"><feGaussianBlur stdDeviation="11"/></filter></defs>
    <path d="M 25 1740 H 130 Q 180 1740 180 1690 V 1400 Q 180 1360 220 1360 H 810 Q 900 1360 900 1270 V 800 Q 900 720 820 720 H 680 Q 615 720 615 655 V 190" stroke="url(#thread)" strokeWidth="16" fill="none" opacity=".55" filter="url(#glow)" strokeDasharray="2700" strokeDashoffset={draw} />
    <path d="M 25 1740 H 130 Q 180 1740 180 1690 V 1400 Q 180 1360 220 1360 H 810 Q 900 1360 900 1270 V 800 Q 900 720 820 720 H 680 Q 615 720 615 655 V 190" stroke="url(#thread)" strokeWidth="2.5" fill="none" strokeDasharray="2700" strokeDashoffset={draw} />
  </svg>;
}

function FilmFooter({ frame }: { frame: number }) {
  const active = frame >= 1170 ? 6 : frame >= 900 ? 5 : frame >= 630 ? 4 : frame >= 360 ? 3 : frame >= 150 ? 2 : 1;
  return <div style={{ position: "absolute", top: 1720, left: 80, right: 80, display: "flex", alignItems: "center", gap: 28, opacity: frame >= 1170 ? 0 : .95 }}>
    <span style={{ color: C.soft, font: `700 26px ${display}`, letterSpacing: 2 }}>LUXIPANEL</span>
    <div style={{ flex: 1, display: "flex", gap: 7 }}>{[1, 2, 3, 4, 5].map((n) => <div key={n} style={{ flex: 1, height: 3, background: n <= active ? C.mint : "rgba(203,213,225,.2)", boxShadow: n === active ? `0 0 13px ${C.mint}` : "none" }} />)}</div>
    <span style={{ color: C.muted, font: `400 23px ${mono}` }}>0{active}/05</span>
  </div>;
}

function Hook({ frame }: { frame: number }) {
  const typed = "git push origin main".slice(0, Math.max(0, Math.floor((frame - 27) / 2.3)));
  return <>
    <Label right="01 / INTRO">LUXIPANEL · PARA DEVELOPERS</Label>
    <div style={rise(frame, 10)}><Headline>El código no termina<br/>en el <span style={{ color: C.mint }}>commit.</span></Headline></div>
    <div style={{ position: "absolute", top: 645, left: 85, color: C.soft, font: `400 43px/1.35 ${body}`, ...rise(frame, 21) }}>Lleva tu infraestructura al<br/>mismo ritmo que tus ideas.</div>
    <Glass style={{ position: "absolute", top: 870, left: 75, width: 930, height: 460, overflow: "hidden", ...rise(frame, 22, 90) }}>
      <div style={{ height: 85, display: "flex", alignItems: "center", padding: "0 35px", gap: 13, background: "rgba(5,13,25,.45)", borderBottom: `1px solid ${C.line}` }}>
        {[C.violet, C.cyan, C.mint].map((c) => <span key={c} style={{ width: 14, height: 14, borderRadius: 14, background: c, opacity: .85 }} />)}
        <span style={{ marginLeft: 20, font: `400 27px ${mono}`, color: C.muted }}>~/proyecto · main</span>
      </div>
      <div style={{ padding: "44px 48px", font: `400 35px/1.9 ${mono}`, color: C.soft }}>
        <div><span style={{ color: C.mint }}>$</span> pnpm build</div>
        <div style={{ color: C.muted }}>✓ build completado</div>
        <div><span style={{ color: C.mint }}>$</span> {typed}<span style={{ display: "inline-block", width: 17, height: 38, marginLeft: 7, background: C.mint, opacity: frame % 14 < 8 ? 1 : .18, verticalAlign: "-6px" }} /></div>
      </div>
    </Glass>
    <div style={{ position: "absolute", top: 1420, left: 85, display: "flex", alignItems: "center", gap: 20, ...rise(frame, 62) }}><Icon name="git" size={43}/><span style={{ color: C.muted, font: `400 31px ${mono}` }}>repo → servidor → producción</span></div>
  </>;
}

type Server = { name: string; region: string; cpu: number; memory: number; color: string; path: string };
const servers: Server[] = [
  { name: "app-producción", region: "VPS principal", cpu: 24, memory: 62, color: C.mint, path: "M 0 54 L 45 55 L 95 44 L 148 50 L 195 37 L 242 43 L 290 22 L 345 31" },
  { name: "api-staging", region: "Entorno de pruebas", cpu: 18, memory: 41, color: C.cyan, path: "M 0 60 L 45 52 L 95 56 L 148 33 L 195 37 L 242 28 L 290 35 L 345 20" },
  { name: "datos-prod", region: "Base de datos", cpu: 35, memory: 74, color: C.violet, path: "M 0 54 L 45 41 L 95 47 L 148 27 L 195 43 L 242 20 L 290 27 L 345 14" },
];

function ServerCard({ server, frame, at }: { server: Server; frame: number; at: number }) {
  const progress = spring({ fps: 30, frame: frame - at, config: { damping: 24, stiffness: 100 } });
  return <div style={{ display: "flex", alignItems: "center", height: 184, padding: "22px 30px", gap: 24, background: "rgba(9,19,32,.48)", border: `1px solid ${C.line}`, borderRadius: 18, opacity: Math.min(1, Math.max(0, progress)), transform: `translateX(${(1 - progress) * 100}px)` }}>
    <div style={{ width: 72, height: 72, borderRadius: 18, display: "grid", placeItems: "center", background: `${server.color}1c`, flex: "none" }}><Icon name="server" size={42} color={server.color}/></div>
    <div style={{ flex: 1 }}><div style={{ color: C.text, font: `700 35px ${body}` }}>{server.name}</div><div style={{ color: C.muted, font: `400 25px ${mono}`, marginTop: 8 }}>{server.region}</div></div>
    <div style={{ width: 220, textAlign: "right" }}><div style={{ color: server.color, font: `400 24px ${mono}`, marginBottom: 7 }}>● EN LÍNEA</div><svg width="180" height="64" viewBox="0 0 350 80"><path d={server.path} fill="none" stroke={server.color} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="440" strokeDashoffset={440 * (1 - progress)}/></svg></div>
  </div>;
}

function Fleet({ frame }: { frame: number }) {
  return <>
    <Label right="02 / CONTROL">INFRAESTRUCTURA</Label>
    <div style={rise(frame, 165)}><Headline>Todas tus VPS.<br/><span style={{ color: C.mint }}>Un solo panel.</span></Headline></div>
    <div style={{ position: "absolute", top: 565, left: 83, color: C.soft, font: `400 42px ${body}`, ...rise(frame, 176) }}>Estado, recursos y herramientas<br/>en el mismo lugar.</div>
    <Glass style={{ position: "absolute", top: 785, left: 74, width: 932, height: 690, padding: "27px 25px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 72, padding: "0 9px" }}><span style={{ font: `700 33px ${body}`, color: C.text }}>Servidores</span><span style={{ font: `400 24px ${mono}`, color: C.mint }}>03 conectados</span></div>
      <div style={{ display: "grid", gap: 12 }}>{servers.map((server, i) => <ServerCard key={server.name} server={server} frame={frame} at={188 + i * 17} />)}</div>
    </Glass>
    <div style={{ position: "absolute", top: 1525, left: 85, display: "flex", alignItems: "center", gap: 16, ...rise(frame, 255) }}><span style={{ color: C.mint, font: `700 33px ${body}` }}>01</span><Line width={74}/><span style={{ color: C.soft, font: `400 30px ${body}` }}>contexto para cada servidor</span></div>
  </>;
}

function Deploy({ frame }: { frame: number }) {
  const lines = [
    { text: "$ git pull origin main", at: 440 },
    { text: "✓ 12 cambios recibidos", at: 464 },
    { text: "$ pnpm build", at: 482 },
    { text: "✓ compilación correcta", at: 508 },
    { text: "$ pm2 reload app", at: 522 },
    { text: "✓ servicio en línea", at: 548 },
  ];
  return <>
    <Label right="03 / FLUJO">DESARROLLO → PRODUCCIÓN</Label>
    <div style={rise(frame, 377)}><Headline>Del repositorio<br/><span style={{ color: C.mint }}>al servidor.</span></Headline></div>
    <div style={{ position: "absolute", top: 575, left: 85, font: `400 41px ${body}`, color: C.soft, ...rise(frame, 390) }}>Sigue el cambio. Ejecuta. Verifica.</div>
    <Glass style={{ position: "absolute", top: 760, left: 80, width: 920, height: 150, padding: "25px 38px", display: "flex", alignItems: "center", gap: 30, ...rise(frame, 405) }}>
      <div style={{ width: 75, height: 75, background: "rgba(99,230,174,.13)", borderRadius: 18, display: "grid", placeItems: "center" }}><Icon name="git" size={47}/></div>
      <div><div style={{ color: C.text, font: `700 32px ${body}` }}>Repositorio conectado</div><div style={{ color: C.muted, font: `400 25px ${mono}`, marginTop: 5 }}>main · c8e31f4</div></div>
      <span style={{ marginLeft: "auto", color: C.mint, font: `400 25px ${mono}` }}>ACTUALIZADO</span>
    </Glass>
    <div style={{ position: "absolute", top: 911, left: 143, width: 2, height: 55, background: C.mint, opacity: .65 }} />
    <Glass style={{ position: "absolute", top: 960, left: 80, width: 920, height: 435, overflow: "hidden", ...rise(frame, 425) }}>
      <div style={{ background: "rgba(4,11,23,.5)", padding: "24px 37px", color: C.muted, font: `400 24px ${mono}`, borderBottom: `1px solid ${C.line}` }}>TERMINAL · app-producción</div>
      <div style={{ padding: "22px 40px", font: `400 27px/1.5 ${mono}` }}>{lines.map((line) => <div key={line.text} style={{ color: line.text.startsWith("✓") ? C.mint : C.soft, opacity: interpolate(frame, [line.at, line.at + 11], [0, 1], clamp), transform: `translateY(${interpolate(frame, [line.at, line.at + 11], [8, 0], clamp)}px)` }}>{line.text}</div>)}</div>
    </Glass>
    <Glass style={{ position: "absolute", top: 1415, left: 170, width: 780, height: 155, padding: "28px 35px", display: "flex", alignItems: "center", gap: 25, ...rise(frame, 548) }}><Icon name="activity" size={47}/><div><div style={{ color: C.text, font: `700 29px ${body}` }}>Monitor en vivo</div><div style={{ color: C.muted, font: `400 25px ${mono}` }}>CPU 24% · RAM 62% · nginx activo</div></div><span style={{ marginLeft: "auto", color: C.mint, fontSize: 36 }}>●</span></Glass>
  </>;
}

function Assistant({ frame }: { frame: number }) {
  const prompt = "¿Por qué Nginx devuelve 502?";
  const typed = prompt.slice(0, Math.max(0, Math.floor((frame - 701) / 1.6)));
  return <>
    <Label right="04 / ASISTENTE">IA CON CONTEXTO REAL</Label>
    <div style={rise(frame, 648)}><Headline>Pregúntale<br/><span style={{ color: C.mint }}>a tu servidor.</span></Headline></div>
    <div style={{ position: "absolute", top: 567, left: 85, color: C.soft, font: `400 42px ${body}`, ...rise(frame, 665) }}>Analiza el problema. Mantén el control.</div>
    <Glass style={{ position: "absolute", top: 773, left: 80, width: 920, height: 188, padding: "31px 37px", ...rise(frame, 685) }}><div style={{ color: C.muted, font: `400 24px ${mono}`, marginBottom: 18 }}>TÚ / CONSULTA</div><div style={{ color: C.text, font: `400 38px ${body}` }}>{typed}<span style={{ color: C.mint, opacity: frame % 14 < 8 ? 1 : .2 }}>▍</span></div></Glass>
    <Glass style={{ position: "absolute", top: 987, left: 125, width: 875, height: 320, padding: "34px 39px", borderColor: "rgba(99,230,174,.34)", ...rise(frame, 735) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 30 }}><Icon name="spark" size={36}/><span style={{ color: C.mint, font: `700 28px ${body}` }}>Asistente IA</span><span style={{ marginLeft: "auto", color: C.muted, font: `400 21px ${mono}` }}>ANÁLISIS</span></div>
      <Line/><div style={{ color: C.text, font: `400 36px/1.3 ${body}`, marginTop: 29 }}>El upstream de la aplicación no responde.</div><div style={{ color: C.muted, font: `400 27px ${mono}`, marginTop: 18 }}>nginx → app:3000 · conexión rechazada</div>
    </Glass>
    <Glass style={{ position: "absolute", top: 1331, left: 125, width: 875, height: 181, padding: "25px 33px", display: "flex", alignItems: "center", gap: 20, ...rise(frame, 795) }}><Icon name="shield" size={45} color={C.cyan}/><div><div style={{ color: C.text, font: `700 28px ${body}` }}>Acción sensible</div><div style={{ color: C.muted, font: `400 24px ${body}`, marginTop: 5 }}>Reiniciar servicio · requiere aprobación</div></div><div style={{ marginLeft: "auto", background: C.mint, color: C.deep, borderRadius: 12, padding: "15px 20px", font: `700 24px ${body}` }}>Revisar</div></Glass>
    <div style={{ position: "absolute", top: 1555, left: 128, color: C.mint, font: `400 31px ${mono}`, ...rise(frame, 830) }}>Tú decides qué ejecutar.</div>
  </>;
}

const modules = [
  { icon: "globe", label: "Web y proxy", accent: C.cyan },
  { icon: "folder", label: "Archivos", accent: C.mint },
  { icon: "shield", label: "Firewall", accent: C.violet },
  { icon: "backup", label: "Backups", accent: C.mint },
  { icon: "activity", label: "Monitor", accent: C.cyan },
  { icon: "modules", label: "Tus módulos", accent: C.violet },
];

function Modules({ frame }: { frame: number }) {
  return <>
    <Label right="05 / EXTENSIBLE">TU PANEL, TU FLUJO</Label>
    <div style={rise(frame, 918)}><Headline size={100}>Activa lo que<br/><span style={{ color: C.mint }}>necesitas.</span></Headline></div>
    <div style={{ position: "absolute", top: 561, left: 83, color: C.soft, font: `400 41px ${body}`, ...rise(frame, 933) }}>Crea lo que falta.</div>
    <div style={{ position: "absolute", top: 700, left: 80, right: 80, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 17 }}>{modules.map((mod, i) => <Glass key={mod.label} style={{ height: 190, padding: "28px 30px", display: "flex", flexDirection: "column", justifyContent: "space-between", borderColor: i === 5 ? "rgba(129,140,248,.45)" : C.line, ...rise(frame, 966 + i * 16, 38) }}><Icon name={mod.icon} size={52} color={mod.accent}/><span style={{ color: C.text, font: `700 30px ${body}` }}>{mod.label}</span></Glass>)}</div>
    <Glass style={{ position: "absolute", top: 1342, left: 80, width: 920, height: 225, padding: "27px 33px", ...rise(frame, 1064) }}><div style={{ color: C.muted, font: `400 22px ${mono}`, marginBottom: 18 }}>module.manifest.json</div><div style={{ color: C.soft, font: `400 28px/1.4 ${mono}` }}><span style={{ color: C.violet }}>{"{"}</span><br/>&nbsp;&nbsp;<span style={{ color: C.cyan }}>"name"</span>: <span style={{ color: C.mint }}>"mi-modulo"</span>,<br/>&nbsp;&nbsp;<span style={{ color: C.cyan }}>"version"</span>: <span style={{ color: C.mint }}>"1.0.0"</span><br/><span style={{ color: C.violet }}>{"}"}</span></div></Glass>
    <div style={{ position: "absolute", top: 1600, left: 86, color: C.mint, font: `400 28px ${mono}`, ...rise(frame, 1110) }}>Código abierto · extensible por diseño</div>
  </>;
}

function Ending({ frame }: { frame: number }) {
  const halo = interpolate(frame, [1180, 1300], [.65, 1], clamp);
  return <>
    <div style={{ position: "absolute", left: 170, top: 330, width: 740, height: 740, borderRadius: "50%", background: `radial-gradient(circle,rgba(99,230,174,${.2 * halo}),rgba(34,211,238,.06) 42%,transparent 70%)`, filter: "blur(15px)" }} />
    <div style={{ position: "absolute", top: 510, left: 335, width: 410, height: 410, ...rise(frame, 1188, 80) }}><Img src={staticFile("logo-luxipanel.webp")} style={{ width: "100%", height: "100%", objectFit: "contain", filter: "drop-shadow(0 0 45px rgba(34,211,238,.25))" }} /></div>
    <div style={{ position: "absolute", top: 950, left: 80, width: 920, textAlign: "center", ...rise(frame, 1205) }}><div style={{ color: C.text, font: `700 98px ${display}`, letterSpacing: -4 }}>LUXIPANEL</div><div style={{ width: 210, height: 5, margin: "34px auto", borderRadius: 3, background: `linear-gradient(90deg,${C.mint},${C.cyan},${C.violet})` }} /><div style={{ color: C.soft, font: `400 44px/1.25 ${body}` }}>Construye. Despliega.<br/>Controla.</div></div>
    <div style={{ position: "absolute", top: 1410, left: 260, width: 560, height: 98, borderRadius: 22, border: "1px solid rgba(99,230,174,.48)", background: "rgba(99,230,174,.1)", display: "grid", placeItems: "center", boxShadow: "0 0 38px rgba(99,230,174,.12)", ...rise(frame, 1240) }}><span style={{ color: C.mint, font: `700 41px ${body}` }}>luxisoft.com <span style={{ marginLeft: 12 }}>↗</span></span></div>
    <div style={{ position: "absolute", top: 1580, left: 80, width: 920, textAlign: "center", color: C.muted, font: `400 26px ${mono}`, ...rise(frame, 1260) }}>EL WHM INTELIGENTE PARA VPS</div>
  </>;
}

export const LuxiPanelPortrait: React.FC = () => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{ overflow: "hidden", color: C.text, fontFamily: body }}>
    <Base frame={frame}/>
    <CommandThread frame={frame}/>
    <FadeScene frame={frame} start={0} end={166}><Hook frame={frame}/></FadeScene>
    <FadeScene frame={frame} start={150} end={376}><Fleet frame={frame}/></FadeScene>
    <FadeScene frame={frame} start={360} end={646}><Deploy frame={frame}/></FadeScene>
    <FadeScene frame={frame} start={630} end={916}><Assistant frame={frame}/></FadeScene>
    <FadeScene frame={frame} start={900} end={1186}><Modules frame={frame}/></FadeScene>
    <FadeScene frame={frame} start={1170} end={1350} last><Ending frame={frame}/></FadeScene>
    <FilmFooter frame={frame}/>
    <Audio src={staticFile("audio/score.wav")} volume={.92}/>
  </AbsoluteFill>;
};
