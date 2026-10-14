import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame } from "remotion";

const P = {
  ink: "#0a1020", navy: "#151c2c", surface: "#202c3f", white: "#f8fafc",
  mint: "#63e6ae", cyan: "#22d3ee", violet: "#818cf8", amber: "#fbbf24",
  soft: "#cbd5e1", muted: "#91a5bd", line: "rgba(175,204,228,.20)",
};
const D = '"Chakra Petch", sans-serif';
const B = '"Inter", sans-serif';
const M = '"JetBrains Mono", monospace';
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ORDER = "Haz backup de datos, prueba en staging y despliega la API en producción.";
export const IMPACT_CUTS = [0, 113, 338, 675, 1013, 1238, 1350] as const;

function tween(f: number, start: number, end: number, a = 0, b = 1) {
  return interpolate(f, [start, end], [a, b], clamp);
}
function pop(f: number, at = 0, distance = 45): React.CSSProperties {
  const s = spring({ frame: f - at, fps: 30, config: { damping: 19, stiffness: 180, mass: .65 } });
  return { opacity: Math.min(1, Math.max(0, s)), transform: `translateY(${(1 - s) * distance}px) scale(${.94 + .06 * s})` };
}
const glyphs: Record<string, React.ReactNode> = {
  spark: <><path d="m16 2 3 10 10 3-10 3-3 12-3-12-10-3 10-3 3-10Z"/><path d="M27 25v5M24.5 27.5h5"/></>,
  server: <><rect x="4" y="4" width="24" height="9" rx="2"/><rect x="4" y="19" width="24" height="9" rx="2"/><path d="M9 8.5h.01M9 23.5h.01M15 8.5h9M15 23.5h9"/></>,
  check: <path d="m6 16 6 6L26 8"/>,
  send: <><path d="m4 5 24 11L4 27l5-11-5-11Z"/><path d="M9 16h19"/></>,
  activity: <path d="M3 17h6l4-10 5 18 4-8h7"/>,
  backup: <><path d="M7 11a10 10 0 1 1-1 10M7 5v6h6"/><path d="M16 10v7l5 3"/></>,
  code: <><path d="m11 8-8 8 8 8M21 8l8 8-8 8M19 5l-6 22"/></>,
  shield: <><path d="M16 3 5 7v8c0 7 4.6 11.7 11 14 6.4-2.3 11-7 11-14V7L16 3Z"/><path d="m11 16 3.5 3.5L22 12"/></>,
  globe: <><circle cx="16" cy="16" r="13"/><path d="M3 16h26M16 3c5 4 7 9 7 13s-2 9-7 13C11 25 9 20 9 16s2-9 7-13Z"/></>,
  folder: <path d="M3 8a3 3 0 0 1 3-3h7l3 3h10a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8Z"/>,
  logs: <><rect x="5" y="3" width="22" height="26" rx="3"/><path d="M10 10h12M10 16h12M10 22h7"/></>,
};
function Glyph({ name, size = 44, color = P.mint }: { name: string; size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{glyphs[name]}</svg>;
}
function Avatar({ letter, color = P.mint, size = 68 }: { letter: string; color?: string; size?: number }) {
  return <div style={{ width: size, height: size, flex: "none", borderRadius: size * .31, display: "grid", placeItems: "center", color, background: `${color}18`, border: `1px solid ${color}66`, boxShadow: `0 0 30px ${color}10`, font: `700 ${size * .49}px ${D}` }}>{letter}</div>;
}
function Plate({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ border: `1px solid ${P.line}`, borderRadius: 28, background: "linear-gradient(140deg,#24334a,#151e30)", boxShadow: "0 30px 85px rgba(0,0,0,.38),inset 0 1px 0 rgba(255,255,255,.08)", ...style }}>{children}</div>;
}
function Chip({ children, color = P.mint, size = 24 }: { children: React.ReactNode; color?: string; size?: number }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 15px", borderRadius: 10, border: `1px solid ${color}55`, background: `${color}12`, color, font: `400 ${size}px ${M}`, whiteSpace: "nowrap" }}>{children}</span>;
}
function KineticTitle({ f, lines, size = 100, top = 272 }: { f: number; lines: { text: string; color?: string }[]; size?: number; top?: number }) {
  return <div style={{ position: "absolute", top, left: 70, width: 940, font: `700 ${size}px/.99 ${D}`, letterSpacing: -4 }}>
    {lines.map((line, i) => <div key={line.text} style={{ overflow: "hidden", paddingBottom: 8 }}><div style={{ color: line.color ?? P.white, transform: `translateX(${tween(f, i * 3, i * 3 + 10, 80, 0)}px)`, clipPath: `inset(0 ${tween(f, i * 3, i * 3 + 10, 100, 0)}% 0 0)` }}>{line.text}</div></div>)}
  </div>;
}
function Masthead({ f }: { f: number }) {
  if (f >= IMPACT_CUTS[5]) return null;
  return <div style={{ position: "absolute", left: 65, right: 65, top: 105, height: 60, display: "flex", alignItems: "center", gap: 15, zIndex: 10 }}>
    <Img src={staticFile("logo-luxipanel.webp")} style={{ width: 62, height: 62, objectFit: "contain" }}/>
    <span style={{ color: P.white, font: `700 31px ${D}`, letterSpacing: 2 }}>LUXIPANEL</span>
    <span style={{ marginLeft: "auto", color: P.mint, font: `400 23px ${M}`, letterSpacing: 1 }}>IA PARA SERVIDORES</span>
  </div>;
}
function World({ f }: { f: number }) {
  const beat = Math.exp(-((f / 30 * 128 / 60) % 1) * 7);
  return <AbsoluteFill style={{ background: P.ink }}>
    <div style={{ position: "absolute", inset: -180, transform: `translate(${Math.sin(f / 160) * 30}px,${Math.cos(f / 180) * 35}px)`, background: "radial-gradient(ellipse at 85% 20%,rgba(34,211,238,.14),transparent 50%),radial-gradient(ellipse at 15% 75%,rgba(99,230,174,.12),transparent 50%),radial-gradient(ellipse at 95% 95%,rgba(129,140,248,.13),transparent 45%)" }}/>
    <div style={{ position: "absolute", inset: 0, opacity: .14, backgroundImage: "linear-gradient(rgba(176,215,240,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(176,215,240,.16) 1px,transparent 1px)", backgroundSize: "120px 120px", transform: `translateY(${f * .055 % 120}px)` }}/>
    <svg width="1080" height="1920" style={{ position: "absolute", inset: 0 }}>
      <path d="M-50 1600 540 1000 1160 520" fill="none" stroke={P.cyan} strokeWidth="1" opacity=".10"/>
      <path d="M-50 1790 550 1200 1160 800" fill="none" stroke={P.mint} strokeWidth="2" opacity={.10 + beat * .07}/>
      <circle cx="1090" cy="740" r={450 + beat * 15} fill="none" stroke={P.cyan} strokeWidth="1" opacity=".14"/>
    </svg>
  </AbsoluteFill>;
}
function Cursor({ f, start, x, y }: { f: number; start: number; x: number; y: number }) {
  const arrive = tween(f, start, start + 13);
  const click = tween(f, start + 13, start + 17) * (1 - tween(f, start + 17, start + 26));
  return <div style={{ position: "absolute", left: x + (1 - arrive) * 95, top: y + (1 - arrive) * 110, opacity: tween(f, start, start + 3) * (1 - tween(f, start + 27, start + 32)), zIndex: 8, transform: `scale(${1 - click * .16})` }}>
    <div style={{ position: "absolute", left: -25, top: -25, width: 64, height: 64, borderRadius: "50%", border: `3px solid ${P.mint}`, opacity: click * .8, transform: `scale(${1 + click * 1.2})` }}/>
    <svg width="50" height="58" viewBox="0 0 38 46"><path d="M3 2v35l10-8 7 14 7-4-8-13 13-3L3 2Z" fill={P.white} stroke={P.ink} strokeWidth="3"/></svg>
  </div>;
}

const capabilities = [
  { icon: "folder", name: "Archivos", color: P.mint }, { icon: "server", name: "Servicios", color: P.cyan },
  { icon: "backup", name: "Backups", color: P.violet }, { icon: "globe", name: "Dominios", color: P.cyan },
  { icon: "logs", name: "Logs", color: P.mint }, { icon: "shield", name: "Firewall", color: P.violet },
];

function Hook() {
  const f = useCurrentFrame();
  const exit = tween(f, 91, 113);
  const hit = Math.exp(-f / 8);
  return <AbsoluteFill>
    <div style={{ position: "absolute", top: 266 - exit * 130, left: 65 - exit * 40, opacity: 1 - exit * .5, transform: `scale(${1 + hit * .025})`, transformOrigin: "left center", font: `700 117px/.99 ${D}`, letterSpacing: -6, color: P.white }}>
      <div>TODO TU</div><div>SERVIDOR.</div>
    </div>
    <div style={{ position: "absolute", top: 552 - exit * 130, left: 70, color: P.soft, font: `400 36px ${M}`, letterSpacing: 12, opacity: 1 - exit }}>DESDE</div>
    <div style={{ position: "absolute", top: 603 - exit * 125, left: 60, color: P.mint, font: `700 161px ${D}`, letterSpacing: -9, transformOrigin: "left center", transform: `translateX(${Math.sin(f / 22) * 3}px) scale(${1 + hit * .12}) rotate(${-hit * 1.5}deg)`, opacity: 1 - exit * .8 }}>UN CHAT.</div>
    <div style={{ position: "absolute", top: 830, left: 75, font: `400 37px ${B}`, color: P.soft, opacity: 1 - exit }}>Agentes IA. Una sola pantalla.</div>
    <div style={{ position: "absolute", left: 70, top: 990 - exit * 100, width: 940, height: 635, transform: `perspective(1600px) rotateX(${5 * (1 - exit)}deg) rotateY(${-4 * (1 - exit)}deg) scale(${1 + exit * .14})`, transformOrigin: "center", opacity: 1 }}>
      <svg width="940" height="635" style={{ position: "absolute", inset: 0 }}>
        <ellipse cx="470" cy="315" rx="425" ry="262" stroke={P.mint} strokeWidth="1.5" fill="none" strokeDasharray="6 18" strokeDashoffset={-f * 2.8} opacity=".35"/>
        {capabilities.map((cap, i) => {
          const angle = Math.PI * (i / 3) - Math.PI / 2;
          const x = 470 + Math.cos(angle) * 360;
          const y = 315 + Math.sin(angle) * 227;
          return <path key={cap.name} d={`M470 315 L${x} ${y}`} stroke={cap.color} strokeWidth="2" opacity=".25" strokeDasharray="7 17" strokeDashoffset={-f * 4}/>;
        })}
      </svg>
      {capabilities.map((cap, i) => {
        const angle = Math.PI * (i / 3) - Math.PI / 2;
        return <div key={cap.name} style={{ position: "absolute", left: 470 + Math.cos(angle) * 360 - 97, top: 315 + Math.sin(angle) * 227 - 43 + Math.sin(f / 14 + i) * 5, width: 194, height: 86, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, border: `1px solid ${cap.color}66`, borderRadius: 18, background: P.navy, boxShadow: `0 0 30px ${cap.color}12`, color: P.soft, font: `700 25px ${B}` }}><Glyph name={cap.icon} size={32} color={cap.color}/>{cap.name}</div>;
      })}
      <Plate style={{ position: "absolute", top: 226, left: 130, width: 680, height: 183, borderColor: `${P.mint}88`, padding: "27px 30px", transform: `scale(${1 + Math.exp(-((f - 12) % 28 + 28) % 28 / 10) * .018})` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: P.mint, font: `700 22px ${B}`, marginBottom: 17 }}><Glyph name="spark" size={27}/>Agente coordinador</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}><span style={{ color: P.white, font: `700 39px ${B}` }}>Despliega mi API.</span><div style={{ marginLeft: "auto", width: 58, height: 58, display: "grid", placeItems: "center", background: P.mint, borderRadius: 16 }}><Glyph name="send" size={31} color={P.ink}/></div></div>
      </Plate>
    </div>
    <div style={{ position: "absolute", top: 1690, left: 70, color: P.mint, font: `400 25px ${M}`, letterSpacing: 1, ...pop(f, 17) }}>GESTIÓN · ORQUESTACIÓN · MULTISERVIDOR</div>
  </AbsoluteFill>;
}

function ChatHeader({ compact = false }: { compact?: boolean }) {
  return <>
    <div style={{ height: compact ? 92 : 117, display: "flex", alignItems: "center", gap: 17, padding: "0 30px", borderBottom: `1px solid ${P.line}` }}>
      <Avatar letter="C" size={compact ? 53 : 64}/><div><div style={{ color: P.white, font: `700 ${compact ? 29 : 31}px ${B}` }}>Agente coordinador</div><div style={{ color: P.muted, font: `400 21px ${M}`, marginTop: 5 }}>Proyecto · Mi API</div></div>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 9, color: P.mint, font: `400 21px ${M}` }}><span style={{ width: 10, height: 10, background: P.mint, borderRadius: "50%" }}/>ACTIVO</div>
    </div>
    <div style={{ display: "flex", gap: 10, padding: "17px 30px", borderBottom: `1px solid ${P.line}`, background: "rgba(5,12,25,.25)" }}><Chip color={P.cyan} size={20}>staging</Chip><Chip color={P.violet} size={20}>datos</Chip><Chip size={20}>producción</Chip><span style={{ marginLeft: "auto", alignSelf: "center", color: P.muted, font: `400 19px ${M}` }}>3 servidores</span></div>
  </>;
}

function PromptScene() {
  const f = useCurrentFrame();
  const sent = f >= 91;
  const typed = ORDER.slice(0, Math.max(0, Math.floor(tween(f, 10, 80, 0, ORDER.length))));
  return <AbsoluteFill>
    <KineticTitle f={f} lines={[{ text: "ESCRIBE LO QUE" }, { text: "NECESITAS.", color: P.mint }]} size={96}/>
    <div style={{ position: "absolute", top: 536, left: 75, color: P.soft, font: `400 36px ${B}`, ...pop(f, 10) }}>Tu infraestructura entiende tu intención.</div>
    <Plate style={{ position: "absolute", top: 664, left: 65, width: 950, height: 958, overflow: "hidden", transform: `perspective(1800px) rotateY(${tween(f, 0, 20, -3, 0)}deg) scale(${tween(f, 0, 25, 1.045, 1)})` }}>
      <ChatHeader/>
      <div style={{ position: "absolute", top: 221, left: 33, right: 33, height: 245, border: `1px solid ${sent ? P.cyan + "55" : P.mint + "77"}`, borderRadius: 23, background: sent ? "rgba(34,211,238,.08)" : "rgba(8,16,30,.6)", padding: "25px 28px", transform: `translateY(${sent ? -12 : 0}px)`, boxShadow: sent ? "none" : "0 0 40px rgba(99,230,174,.06)" }}>
        <div style={{ color: sent ? P.cyan : P.muted, font: `400 22px ${M}`, marginBottom: 22 }}>{sent ? "TÚ · MENSAJE ENVIADO" : "¿QUÉ QUIERES HACER?"}</div>
        <div style={{ color: P.white, font: `400 37px/1.35 ${B}`, paddingRight: sent ? 0 : 55 }}>{typed}<span style={{ color: P.mint, opacity: sent ? 0 : f % 12 < 7 ? 1 : .2 }}>▍</span></div>
        {!sent && <div style={{ position: "absolute", bottom: 20, right: 23, width: 58, height: 58, display: "grid", placeItems: "center", background: P.mint, borderRadius: 15 }}><Glyph name="send" size={30} color={P.ink}/></div>}
      </div>
      <Cursor f={f} start={74} x={845} y={414}/>
      {sent && <div style={{ position: "absolute", top: 485, left: 33, right: 33, ...pop(f, 97) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 15, color: P.mint, font: `700 28px ${B}`, marginBottom: 20 }}><Avatar letter="C" size={45}/>COORDINANDO EL EQUIPO</div>
        <div style={{ color: P.white, font: `400 34px/1.4 ${B}` }}>Voy a organizar el backup,<br/>las pruebas y el despliegue.</div>
        <div style={{ display: "flex", gap: 12, marginTop: 25 }}>{[P.cyan, P.violet, P.mint].map((color, i) => <div key={color} style={{ flex: 1, height: 5, borderRadius: 5, background: `${color}25`, overflow: "hidden" }}><div style={{ width: `${tween(f, 126 + i * 9, 206, 0, 100)}%`, height: "100%", background: color }}/></div>)}</div>
      </div>}
      {!sent && <div style={{ position: "absolute", top: 511, left: 35, right: 35, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>{capabilities.map((cap, i) => <div key={cap.name} style={{ height: 93, display: "flex", alignItems: "center", gap: 13, color: P.soft, padding: "0 18px", borderRadius: 17, background: `${cap.color}0a`, border: `1px solid ${cap.color}33`, font: `700 25px ${B}`, ...pop(f, 8 + i * 7, 25) }}><Glyph name={cap.icon} size={34} color={cap.color}/>{cap.name}</div>)}</div>}
      <div style={{ position: "absolute", left: 25, right: 25, bottom: 23, height: 133, borderRadius: 24, border: `1px solid ${P.line}`, background: "rgba(9,17,30,.7)", padding: "22px 25px" }}>
        <div style={{ color: P.muted, font: `400 28px ${B}` }}>{sent ? "Tu siguiente instrucción…" : "Habla con tu infraestructura"}</div>
        <div style={{ marginTop: 19, display: "flex", alignItems: "center", gap: 15, color: P.muted, font: `400 19px ${M}` }}><span style={{ fontSize: 28 }}>+</span><span>Mi API</span><span style={{ marginLeft: "auto" }}>Modelo Auto</span><Glyph name="spark" size={24}/></div>
      </div>
    </Plate>
    <div style={{ position: "absolute", top: 1680, left: 75, color: P.mint, font: `400 29px ${M}`, ...pop(f, 145) }}>Una pantalla para dirigirlo todo.</div>
  </AbsoluteFill>;
}

const workers = [
  { name: "DevOps", letter: "D", icon: "code", color: P.mint, task: "Despliegue", target: "PRODUCCIÓN" },
  { name: "Backups", letter: "B", icon: "backup", color: P.violet, task: "Respaldo", target: "DATOS" },
  { name: "QA", letter: "Q", icon: "activity", color: P.cyan, task: "Pruebas", target: "STAGING" },
];
function AgentScene() {
  const f = useCurrentFrame();
  const detailIndex = Math.min(2, Math.floor(Math.max(0, f - 97) / 61));
  const detail = workers[detailIndex];
  const closeup = f >= 97 && f < 280;
  const local = (f - 97) % 61;
  return <AbsoluteFill>
    <KineticTitle f={f} lines={[{ text: "UNA ORDEN." }, { text: "VARIOS AGENTES.", color: P.mint }]} size={94}/>
    <div style={{ position: "absolute", top: 534, left: 75, color: P.soft, font: `400 34px/1.3 ${B}`, ...pop(f, 9) }}>El coordinador reparte.<br/>Los especialistas trabajan en paralelo.</div>
    <div style={{ position: "absolute", top: 711, left: 65, width: 950, height: 590, transform: `perspective(1800px) rotateX(${Math.sin(f / 85) * 2}deg) scale(${closeup ? .96 : 1})`, opacity: closeup ? .30 : 1, filter: closeup ? "blur(2px)" : "none" }}>
      <svg width="950" height="590" style={{ position: "absolute", inset: 0 }}>
        {workers.map((worker, i) => <g key={worker.name}>
          <path d={`M475 140 V193 Q475 218 ${157 + i * 317} 218 V290`} fill="none" stroke={worker.color} strokeWidth="3" opacity={tween(f, 13 + i * 8, 35 + i * 8, 0, .35)}/>
          <path d={`M475 140 V193 Q475 218 ${157 + i * 317} 218 V290`} fill="none" stroke={worker.color} strokeWidth="5" pathLength="100" strokeDasharray="3 19" strokeDashoffset={-f * .85} opacity={tween(f, 13 + i * 8, 35 + i * 8, 0, .9)}/>
        </g>)}
      </svg>
      <Plate style={{ position: "absolute", left: 203, top: 0, width: 544, height: 143, borderColor: `${P.mint}77`, display: "flex", alignItems: "center", gap: 22, padding: "0 27px", ...pop(f, 1) }}><Avatar letter="C" size={74}/><div><div style={{ color: P.white, font: `700 32px ${B}` }}>Coordinador IA</div><div style={{ color: P.mint, font: `400 22px ${M}`, marginTop: 7 }}>Planifica · delega · reúne</div></div></Plate>
      {workers.map((worker, i) => <Plate key={worker.name} style={{ position: "absolute", left: i * 317, top: 287 + Math.sin(f / 31 + i * 1.3) * 4, width: 300, height: 283, borderColor: `${worker.color}70`, padding: "24px 22px", ...pop(f, 29 + i * 10) }}>
        <div style={{ display: "flex", gap: 15, alignItems: "center", marginBottom: 20 }}><Avatar letter={worker.letter} color={worker.color} size={58}/><div style={{ color: P.white, font: `700 29px ${B}` }}>{worker.name}</div></div>
        <div style={{ color: worker.color, font: `400 23px ${M}` }}>{worker.task}</div>
        <div style={{ color: P.muted, font: `400 19px ${M}`, marginTop: 9 }}>{worker.target}</div>
        <div style={{ background: `${worker.color}24`, height: 5, borderRadius: 4, marginTop: 29, overflow: "hidden" }}><div style={{ height: 5, width: `${tween(f, 52 + i * 17, 285, 3, 84 - i * 9)}%`, background: worker.color }}/></div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: P.soft, font: `400 19px ${M}`, marginTop: 17 }}><span style={{ width: 8, height: 8, background: worker.color, borderRadius: "50%", opacity: .5 + .5 * Math.sin(f / 8 + i) ** 2 }}/>En curso</div>
      </Plate>)}
    </div>
    {closeup && <Plate style={{ position: "absolute", top: 864, left: 65, width: 950, height: 419, padding: "35px 40px", borderColor: `${detail.color}99`, transform: `perspective(1500px) rotateY(${tween(local, 0, 10, -7, 0)}deg) scale(${tween(local, 0, 12, .91, 1)})`, opacity: tween(local, 0, 5) * (1 - tween(local, 55, 61)), boxShadow: `0 35px 100px #050a16,0 0 50px ${detail.color}16` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 26 }}><Avatar letter={detail.letter} color={detail.color} size={95}/><div><div style={{ color: P.white, font: `700 53px ${D}` }}>{detail.name} IA</div><div style={{ color: detail.color, font: `400 27px ${M}`, marginTop: 5 }}>ESPECIALISTA · EN CURSO</div></div><Glyph name={detail.icon} size={62} color={detail.color}/></div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 31, paddingTop: 25, borderTop: `1px solid ${P.line}` }}><span style={{ color: P.white, font: `700 37px ${B}` }}>{detailIndex === 0 ? "Preparar despliegue" : detailIndex === 1 ? "Preparar backup" : "Probar la API"}</span><Chip color={detail.color} size={22}>{detail.target}</Chip></div>
      <div style={{ color: P.soft, font: `400 29px ${M}`, marginTop: 26 }}>{detailIndex === 0 ? "nginx → servicio API" : detailIndex === 1 ? "datos → plan de respaldo" : "staging → endpoints y salud"}</div>
      <div style={{ height: 6, background: `${detail.color}22`, borderRadius: 5, marginTop: 28, overflow: "hidden" }}><div style={{ height: "100%", background: detail.color, width: `${tween(local, 3, 55, 8, 92)}%` }}/></div>
    </Plate>}
    <Plate style={{ position: "absolute", top: 1355, left: 65, width: 950, height: 212, padding: "27px 31px", ...pop(f, 91) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 19 }}><Glyph name={detail.icon} size={35} color={detail.color}/><span style={{ color: detail.color, font: `700 26px ${B}` }}>{detail.name}</span><span style={{ marginLeft: "auto", color: P.muted, font: `400 20px ${M}` }}>ACTIVIDAD DEL EQUIPO</span></div>
      <div style={{ color: P.white, font: `400 33px/1.3 ${B}` }}>{detailIndex === 0 ? "Preparando el despliegue de la API." : detailIndex === 1 ? "Preparando el respaldo de datos." : "Verificando los endpoints en staging."}</div>
      <div style={{ color: P.muted, font: `400 23px ${M}`, marginTop: 15 }}>Todo vuelve a la misma conversación.</div>
    </Plate>
    <div style={{ position: "absolute", top: 1639, left: 73, right: 73, display: "flex", alignItems: "center", gap: 20, color: P.white, font: `700 47px ${D}`, ...pop(f, 137) }}><span style={{ color: P.mint }}>EN PARALELO.</span><div style={{ flex: 1, height: 2, background: `linear-gradient(90deg,${P.mint},${P.cyan},transparent)` }}/></div>
  </AbsoluteFill>;
}

const hosts = [
  { name: "STAGING", role: "QA", letter: "Q", color: P.cyan, description: "Pruebas de la API", result: "Pruebas correctas", icon: "activity" },
  { name: "DATOS", role: "Backups", letter: "B", color: P.violet, description: "Respaldo de datos", result: "Backup preparado", icon: "backup" },
  { name: "PRODUCCIÓN", role: "DevOps", letter: "D", color: P.mint, description: "Despliegue de la API", result: "Listo para aprobar", icon: "code" },
];
function ServerScene() {
  const f = useCurrentFrame();
  const focus = Math.min(2, Math.floor(Math.max(0, f - 82) / 65));
  return <AbsoluteFill>
    <KineticTitle f={f} lines={[{ text: "VARIOS SERVIDORES." }, { text: "UN SOLO CHAT.", color: P.mint }]} size={84}/>
    <div style={{ position: "absolute", top: 522, left: 76, color: P.soft, font: `400 34px ${B}`, ...pop(f, 10) }}>Una conversación coordina tu infraestructura.</div>
    <Plate style={{ position: "absolute", top: 650, left: 65, width: 950, height: 276, overflow: "hidden", ...pop(f, 1) }}>
      <ChatHeader compact/>
      <div style={{ color: P.soft, padding: "15px 30px", font: `400 30px/1.35 ${B}` }}>«{ORDER}»</div>
    </Plate>
    <svg width="1080" height="1920" style={{ position: "absolute", inset: 0 }}>
      {hosts.map((host, i) => <g key={host.name}><path d={`M99 925 V${1009 + i * 181} H143`} stroke={host.color} strokeWidth="2" fill="none" opacity=".28"/><path d={`M99 925 V${1009 + i * 181} H143`} stroke={host.color} strokeWidth="5" fill="none" pathLength="100" strokeDasharray="4 26" strokeDashoffset={-f * .72 - i * 11} opacity={tween(f, 20 + i * 24, 44 + i * 24, 0, .95)}/></g>)}
    </svg>
    {hosts.map((host, i) => {
      const active = f >= 60 + i * 60;
      const spotlight = f > 82 && f < 278 && focus === i;
      return <Plate key={host.name} style={{ position: "absolute", left: 141, top: 963 + i * 181, width: 874, height: 160, padding: "22px 26px", display: "flex", alignItems: "center", gap: 21, borderColor: spotlight ? host.color : active ? `${host.color}88` : P.line, boxShadow: spotlight ? `0 20px 60px rgba(0,0,0,.38),0 0 48px ${host.color}33` : undefined, ...pop(f, 22 + i * 17), transform: f > 82 ? `translateX(${spotlight ? -12 : 0}px) scale(${spotlight ? 1.035 : 1})` : pop(f, 22 + i * 17).transform, opacity: f > 82 && f < 278 ? spotlight ? 1 : .68 : pop(f, 22 + i * 17).opacity }}>
        <div style={{ background: `${host.color}14`, width: 69, height: 77, borderRadius: 16, display: "grid", placeItems: "center", flex: "none" }}><Glyph name="server" size={45} color={host.color}/></div>
        <div style={{ flex: 1 }}><div style={{ color: host.color, font: `700 27px ${M}`, letterSpacing: 1 }}>{host.name}</div><div style={{ color: P.white, font: `400 28px ${B}`, marginTop: 9 }}>{active ? host.result : host.description}</div></div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, color: P.soft, font: `700 23px ${B}` }}><Avatar letter={host.letter} color={host.color} size={42}/>{host.role}</div>
      </Plate>;
    })}
    {f >= 90 && f < 278 && <div style={{ position: "absolute", top: 1564, left: 74, display: "flex", gap: 22, alignItems: "center", color: hosts[focus].color, font: `700 44px ${D}` }}><Avatar letter={hosts[focus].letter} color={hosts[focus].color} size={59}/>{hosts[focus].role} <span style={{ color: P.muted }}>→</span> {hosts[focus].name}</div>}
    <div style={{ position: "absolute", top: 1572, left: 72, width: 940, display: "flex", alignItems: "center", gap: 18, ...pop(f, 278) }}>
      <span style={{ font: `700 78px ${D}`, color: P.cyan }}>3</span><span style={{ color: P.soft, font: `700 32px ${B}` }}>servidores</span><span style={{ color: P.muted, margin: "0 16px", fontSize: 42 }}>→</span><span style={{ font: `700 78px ${D}`, color: P.mint }}>1</span><span style={{ color: P.soft, font: `700 32px ${B}` }}>conversación</span>
    </div>
    <div style={{ position: "absolute", top: 1692, left: 77, color: P.muted, font: `400 25px ${M}`, ...pop(f, 110) }}>Contexto y resultados dentro del mismo chat.</div>
  </AbsoluteFill>;
}

function ResultScene() {
  const f = useCurrentFrame();
  const approvalTwo = f >= 67;
  const approvalDone = f >= 112;
  const approved = (f >= 42 && f < 67) || f >= 99;
  const hideApproval = tween(f, 112, 130);
  return <AbsoluteFill>
    <KineticTitle f={f} lines={[{ text: "TÚ DIRIGES." }, { text: "LA IA EJECUTA.", color: P.mint }]} size={103}/>
    <div style={{ position: "absolute", top: 541, left: 76, color: P.soft, font: `400 35px ${B}`, ...pop(f, 9) }}>Aprueba los cambios. Mira el resultado.</div>
    <Plate style={{ position: "absolute", top: 685, left: 65, width: 950, height: 308, padding: "29px 31px", borderColor: `${approved ? P.mint : P.amber}66`, opacity: 1 - hideApproval, transform: `translateY(${-hideApproval * 50}px)` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, color: P.amber, font: `400 24px ${M}`, marginBottom: 23 }}><Glyph name="shield" size={32} color={P.amber}/>REQUIERE TU APROBACIÓN<span style={{ marginLeft: "auto", color: P.muted }}>{approvalTwo ? "02 / 02" : "01 / 02"}</span></div>
      <div style={{ color: P.white, font: `700 39px ${B}` }}>{approvalTwo ? "Desplegar API" : "Crear backup de datos"}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 17, marginTop: 25 }}><Chip color={approvalTwo ? P.mint : P.violet} size={23}>{approvalTwo ? "PRODUCCIÓN" : "DATOS"}</Chip><span style={{ marginLeft: "auto", color: P.soft, font: `400 26px ${B}` }}>Revisar</span><div style={{ marginLeft: 17, background: approved ? `${P.mint}22` : P.mint, border: `1px solid ${P.mint}`, color: approved ? P.mint : P.ink, borderRadius: 14, padding: "17px 28px", font: `700 30px ${B}` }}>{approved ? "Aprobado" : "Aprobar"}</div></div>
      <Cursor f={f} start={25} x={805} y={227}/><Cursor f={f} start={82} x={805} y={227}/>
    </Plate>
    {approvalDone && <div style={{ position: "absolute", top: 710, left: 71, display: "flex", alignItems: "center", gap: 28, ...pop(f, 130) }}><div style={{ width: 105, height: 105, display: "grid", placeItems: "center", borderRadius: "50%", background: `${P.mint}16`, border: `2px solid ${P.mint}` }}><Glyph name="check" size={65}/></div><span style={{ color: P.white, font: `700 135px ${D}`, letterSpacing: -5 }}>LISTO.</span></div>}
    {[
      { title: "Backup disponible", host: "DATOS", icon: "backup", at: 139 },
      { title: "API publicada", host: "PRODUCCIÓN", icon: "code", at: 155 },
      { title: "Servicios verificados", host: "STAGING + PRODUCCIÓN", icon: "activity", at: 171 },
    ].map((item, i) => {
      const done = f >= item.at;
      const executing = i === 0 ? f >= 42 : i === 1 ? f >= 99 : f >= 112;
      return <Plate key={item.title} style={{ position: "absolute", top: 1005 + i * 167, left: 65, width: 950, height: 147, padding: "23px 28px", display: "flex", alignItems: "center", gap: 24, borderColor: done ? `${P.mint}66` : P.line, ...pop(f, 10 + i * 9), opacity: done ? 1 : .68, transform: `scale(${done ? 1 + Math.exp(-(f - item.at) / 7) * .025 : 1})` }}><Glyph name={item.icon} size={45} color={done ? P.mint : P.muted}/><div><div style={{ color: done ? P.white : P.soft, font: `700 34px ${B}` }}>{done ? item.title : ["Preparar backup", "Desplegar API", "Verificar servicios"][i]}</div><div style={{ color: P.muted, font: `400 20px ${M}`, marginTop: 8 }}>{item.host}</div></div><div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, color: done ? P.mint : P.muted, font: `400 21px ${M}` }}>{done ? <><Glyph name="check" size={30}/>OK</> : executing ? "En curso…" : "Pendiente"}</div></Plate>;
    })}
    <div style={{ position: "absolute", top: 1590, left: 76, font: `700 43px/1.25 ${D}`, color: P.mint, ...pop(f, 188) }}>UN RESULTADO.<br/>UNA CONVERSACIÓN.</div>
  </AbsoluteFill>;
}

function EndScene() {
  const f = useCurrentFrame();
  return <AbsoluteFill>
    <div style={{ position: "absolute", top: 263, left: 100, width: 880, height: 890, borderRadius: "50%", background: "radial-gradient(circle,rgba(99,230,174,.16),rgba(34,211,238,.05) 42%,transparent 68%)", transform: `scale(${1 + Math.sin(f / 20) * .035})` }}/>
    <svg width="1080" height="1920" style={{ position: "absolute", inset: 0 }}>
      {[P.mint, P.cyan, P.violet].map((color, i) => <g key={color} transform={`rotate(${i * 55 + f * .14} 540 700)`}><ellipse cx="540" cy="700" rx="385" ry="290" stroke={color} strokeWidth="1.5" fill="none" opacity=".22"/><circle cx="925" cy="700" r="7" fill={color}/></g>)}
    </svg>
    <Img src={staticFile("logo-luxipanel.webp")} style={{ position: "absolute", top: 447, left: 325, width: 430, height: 430, objectFit: "contain", filter: "drop-shadow(0 0 40px rgba(34,211,238,.18))", transform: `scale(${tween(f, 0, 13, 1.16, 1)})` }}/>
    <div style={{ position: "absolute", top: 923, left: 55, width: 970, textAlign: "center", font: `700 110px ${D}`, letterSpacing: -4, color: P.white, ...pop(f, 0) }}>LUXIPANEL</div>
    <div style={{ position: "absolute", top: 1109, left: 70, width: 940, textAlign: "center", font: `700 61px/1.1 ${D}`, letterSpacing: -2, color: P.soft, ...pop(f, 5) }}>UNA PANTALLA.<br/><span style={{ color: P.mint }}>TODO CONECTADO.</span></div>
    <div style={{ position: "absolute", top: 1437, left: 205, width: 670, height: 117, background: P.mint, borderRadius: 22, boxShadow: "0 0 65px rgba(99,230,174,.13)", display: "flex", alignItems: "center", justifyContent: "center", gap: 23, ...pop(f, 9) }}><span style={{ color: P.ink, font: `700 47px ${B}` }}>luxisoft.com</span><span style={{ color: P.ink, fontSize: 49 }}>↗</span></div>
    <div style={{ position: "absolute", top: 1630, left: 70, width: 940, color: P.muted, textAlign: "center", font: `400 26px ${M}`, ...pop(f, 16) }}>TU INFRAESTRUCTURA. TU EQUIPO IA. TU CHAT.</div>
  </AbsoluteFill>;
}

const scenes = [Hook, PromptScene, AgentScene, ServerScene, ResultScene, EndScene];
function CutSweep({ f }: { f: number }) {
  const cut = IMPACT_CUTS.find((at) => at > 0 && f >= at && f < at + 9);
  if (cut === undefined) return null;
  const progress = (f - cut) / 9;
  return <div style={{ position: "absolute", top: -400, left: -540 + progress * 1800, width: 100, height: 2700, background: `linear-gradient(90deg,transparent,${P.mint}33,${P.cyan}55,transparent)`, transform: "rotate(18deg)", pointerEvents: "none" }}/>;
}
export const LuxiPanelChatImpact: React.FC = () => {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ fontFamily: B, overflow: "hidden", color: P.white }}>
    <World f={f}/>
    {scenes.map((Scene, i) => <Sequence key={IMPACT_CUTS[i]} from={IMPACT_CUTS[i]} durationInFrames={IMPACT_CUTS[i + 1] - IMPACT_CUTS[i]}><Scene/></Sequence>)}
    <CutSweep f={f}/>
    <Masthead f={f}/>
    <Audio src={staticFile("audio/score-impact.wav")}/>
  </AbsoluteFill>;
};
