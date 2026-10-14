import React from "react";
import { BusinessLanguageContext, useBusinessCopy, type BusinessLanguage } from "./business-copy";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame } from "remotion";

// Business-facing creative. The price refers to the Free subscription;
// AI consumption and third-party store publishing are explicitly separate.
export const BUSINESS_CUTS = [0, 120, 330, 570, 750, 930, 1050, 1200, 1350] as const;
const C = { navy: "#151c2c", mint: "#24e1c5", lime: "#68da60", paper: "#f3f8f6", ice: "#dff7f2", white: "#ffffff", muted: "#566779", food: "#e85b35" };
const D = '"Chakra Petch", sans-serif';
const B = '"Poppins", sans-serif';
const I = '"Inter", sans-serif';
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const t = (f: number, a: number, b: number, from = 0, to = 1) => interpolate(f, [a, b], [from, to], clamp);
const pop = (f: number, at = 0, distance = 45): React.CSSProperties => {
  const s = spring({ frame: f - at, fps: 30, config: { damping: 18, stiffness: 190, mass: .7 } });
  return { opacity: t(f, at, at + 7), transform: `translateY(${(1 - s) * distance}px) scale(${.93 + .07 * s})` };
};

function Icon({ name, size = 40, color = C.navy }: { name: string; size?: number; color?: string }) {
  const icons: Record<string, React.ReactNode> = {
    send: <><path d="m4 5 24 11L4 27l5-11-5-11Z"/><path d="M9 16h19"/></>,
    check: <path d="m6 16 6 6L26 8"/>,
    chat: <><path d="M5 5h22v17H12l-7 6V5Z"/><path d="M10 11h12M10 16h8"/></>,
    bag: <><rect x="5" y="10" width="22" height="19" rx="3"/><path d="M11 11V8a5 5 0 0 1 10 0v3"/></>,
    home: <><path d="m3 15 13-12 13 12M7 12v17h18V12"/><path d="M13 29V18h6v11"/></>,
    heart: <path d="M16 27 5 16C-2 8 8-1 16 8 24-1 34 8 27 16L16 27Z"/>,
    phone: <><rect x="8" y="2" width="16" height="28" rx="4"/><path d="M13 6h6M14 26h4"/></>,
    globe: <><circle cx="16" cy="16" r="13"/><path d="M3 16h26M16 3c8 9 8 17 0 26-8-9-8-17 0-26Z"/></>,
    arrow: <path d="M4 16h24M18 6l10 10-10 10"/>,
    spark: <path d="m16 2 4 10 10 4-10 4-4 10-4-10-10-4 10-4 4-10Z"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icons[name]}</svg>;
}
function Logo({ dark = false, width = 310 }: { dark?: boolean; width?: number }) {
  return <Img src={staticFile(`luxisoft/lockup-${dark ? "dark" : "light"}.webp`)} style={{ width, height: width * 128 / 484, objectFit: "contain" }}/>;
}
function Brand({ dark = false, label = "TU NEGOCIO EN LÍNEA" }: { dark?: boolean; label?: string }) {
  const copy = useBusinessCopy();
  return <div style={{ position: "absolute", top: 99, left: 66, right: 66, display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 5 }}><Logo dark={dark} width={287}/><span style={{ color: dark ? C.mint : C.muted, font: `600 23px ${B}`, letterSpacing: 1 }}>{copy(label)}</span></div>;
}
function Title({ f, lines, top = 274, size = 106, dark = false }: { f: number; lines: string[]; top?: number; size?: number; dark?: boolean }) {
  const copy = useBusinessCopy();
  return <div style={{ position: "absolute", top, left: 65, width: 945, color: dark ? C.white : C.navy, font: `700 ${size}px/1.02 ${D}`, letterSpacing: -4 }}>
    {lines.map((line, i) => <div key={line} style={{ overflow: "hidden", paddingBottom: 9 }}><div style={{ transform: `translateY(${t(f, i * 3, i * 3 + 12, 110, 0)}%)` }}>{copy(line)}</div></div>)}
  </div>;
}
function Tag({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return <div style={{ display: "inline-flex", alignItems: "center", gap: 11, padding: "14px 21px", borderRadius: 14, background: dark ? C.mint : C.navy, color: dark ? C.navy : C.white, font: `600 26px ${B}`, boxShadow: "0 10px 25px rgba(21,28,44,.12)" }}>{children}</div>;
}
function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: C.white, border: "2px solid rgba(21,28,44,.12)", borderRadius: 32, boxShadow: "0 25px 55px rgba(21,28,44,.13)", ...style }}>{children}</div>;
}
function Cursor({ f, at, x, y }: { f: number; at: number; x: number; y: number }) {
  const arrive = t(f, at, at + 13);
  const click = t(f, at + 13, at + 17) * (1 - t(f, at + 17, at + 25));
  return <div style={{ position: "absolute", left: x + (1 - arrive) * 70, top: y + (1 - arrive) * 95, opacity: t(f, at, at + 3) * (1 - t(f, at + 27, at + 32)), zIndex: 8, transform: `scale(${1 - click * .18})` }}>
    <div style={{ position: "absolute", left: -25, top: -25, width: 66, height: 66, border: `3px solid ${C.mint}`, borderRadius: "50%", opacity: click, transform: `scale(${1 + click * 1.4})` }}/>
    <svg width="53" height="60" viewBox="0 0 38 46"><path d="M3 2v35l10-8 7 14 7-4-8-13 13-3L3 2Z" fill={C.navy} stroke={C.white} strokeWidth="3"/></svg>
  </div>;
}
function Backdrop({ f, dark = false }: { f: number; dark?: boolean }) {
  return <AbsoluteFill style={{ background: dark ? C.navy : C.paper }}>
    <div style={{ position: "absolute", right: -260, top: 540, width: 800, height: 800, borderRadius: "50%", border: `2px solid ${dark ? "#24e1c526" : "#24b7a62b"}`, transform: `translateY(${Math.sin(f / 70) * 20}px)` }}/>
    <div style={{ position: "absolute", right: -170, top: 630, width: 620, height: 620, borderRadius: "50%", border: `2px solid ${dark ? "#68da6025" : "#68da602b"}` }}/>
    <div style={{ position: "absolute", bottom: 0, left: 0, height: 8, width: `${f / 1350 * 100}%`, background: `linear-gradient(90deg,${C.lime},${C.mint})` }}/>
  </AbsoluteFill>;
}

// The demo is editorial motion graphics, not a screen recording or a promise
// of instantaneous generation. Food photography and brand marks are official assets.
function Website({ accent = C.food, build = 300, phone = false }: { accent?: string; build?: number; phone?: boolean }) {
  const copy = useBusinessCopy();
  return <div style={{ width: "100%", height: "100%", background: "#fffaf3", overflow: "hidden", position: "relative", color: C.navy }}>
    <div style={{ height: phone ? 85 : 82, background: "#fffaf3", display: "flex", alignItems: "center", padding: "0 27px", gap: 20, opacity: t(build, 0, 12) }}>
      <Img src={staticFile("luxisoft/fuego-pan-logo.svg")} style={{ width: phone ? 185 : 194, height: 56, objectFit: "contain" }}/>
      <span style={{ marginLeft: "auto", font: `600 ${phone ? 20 : 21}px ${B}` }}>{copy("Menú")}</span><Icon name="bag" size={31}/>
    </div>
    <div style={{ height: phone ? 327 : 355, position: "relative", overflow: "hidden", opacity: t(build, 14, 30), transform: `translateY(${t(build, 14, 30, 40, 0)}px)` }}>
      <Img src={staticFile("luxisoft/hero-fastfood.webp")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: phone ? "58% center" : "center", transform: `scale(${t(build, 20, 80, 1.10, 1)})` }}/>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(0,0,0,.7),transparent 95%)" }}/>
      <div style={{ position: "absolute", left: 29, top: phone ? 43 : 52, color: C.white, font: `600 ${phone ? 46 : 55}px/1.08 ${B}`, letterSpacing: -1 }}>{copy("Sabor que")}<br/>{copy("se comparte.")}</div>
      <div style={{ position: "absolute", left: 29, bottom: 39, background: accent, color: accent === C.food ? C.white : C.navy, font: `600 22px ${B}`, padding: "16px 22px", borderRadius: 12 }}>{copy("Ver nuestro menú ")}<span style={{ marginLeft: 8 }}>↗</span></div>
    </div>
    <div style={{ padding: phone ? "25px 23px" : "27px 30px", opacity: t(build, 32, 47), transform: `translateY(${t(build, 32, 47, 50, 0)}px)` }}>
      <div style={{ font: `600 ${phone ? 30 : 34}px ${B}`, marginBottom: 21 }}>{copy("Tus favoritos, aquí.")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 17 }}>
        {[{ name: "Burger de la casa", position: "55% 55%" }, { name: "Pizza para compartir", position: "100% 35%" }].map((item, i) => <div key={item.name} style={{ background: C.white, border: "1px solid #e5ddcf", borderRadius: 17, overflow: "hidden", ...pop(build, 43 + i * 7, 25) }}>
          <div style={{ height: phone ? 137 : 169, overflow: "hidden" }}><Img src={staticFile("luxisoft/hero-fastfood.webp")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: item.position, transform: "scale(2.3)", transformOrigin: item.position }}/></div>
          <div style={{ padding: "15px 14px", font: `600 ${phone ? 17 : 22}px ${B}`, lineHeight: 1.25 }}>{copy(item.name)}</div>
          <div style={{ margin: "0 14px 14px", height: 37, background: accent, color: accent === C.food ? C.white : C.navy, borderRadius: 9, display: "grid", placeItems: "center", font: `600 ${phone ? 15 : 18}px ${B}` }}>{copy("Añadir al pedido +")}</div>
        </div>)}
      </div>
    </div>
    {phone && <div style={{ padding: "8px 28px 25px", opacity: t(build, 55, 68), display: "flex", alignItems: "center", gap: 10, color: C.muted, font: `400 18px ${I}` }}><Icon name="chat" size={24} color={C.muted}/>{copy("Pedidos por WhatsApp")}</div>}
  </div>;
}
function Browser({ children, style, label = "fuegoypan.luxisoft.com" }: { children: React.ReactNode; style?: React.CSSProperties; label?: string }) {
  return <Panel style={{ overflow: "hidden", ...style }}>
    <div style={{ height: 71, display: "flex", alignItems: "center", padding: "0 24px", gap: 8, background: "#e9eff1", borderBottom: "1px solid #d8e0e5" }}>
      {["#f9a292", "#e6d17c", "#8ed6ac"].map(color => <span key={color} style={{ width: 13, height: 13, borderRadius: "50%", background: color }}/>)}
      <div style={{ margin: "0 15px", flex: 1, background: C.white, borderRadius: 10, height: 37, display: "flex", alignItems: "center", gap: 8, padding: "0 13px", color: C.muted, font: `400 20px ${I}` }}><Icon name="globe" size={19} color={C.muted}/>{label}</div>
    </div>{children}
  </Panel>;
}
function Phone({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ width: 464, height: 920, padding: "45px 13px 22px", background: C.navy, border: "3px solid #536375", borderRadius: 58, position: "relative", boxShadow: "0 35px 70px #151c2c30", ...style }}>
    <div style={{ position: "absolute", left: 161, right: 161, top: 15, height: 15, borderRadius: 15, background: "#020a15" }}/>
    <div style={{ width: "100%", height: "100%", overflow: "hidden", background: C.white, borderRadius: 32 }}>{children}</div>
  </div>;
}

function Hook() {
  const copy = useBusinessCopy();
  const f = useCurrentFrame();
  return <AbsoluteFill>
    <Brand/>
    <div style={{ position: "absolute", left: 64, top: 285, font: `700 143px/.99 ${D}`, color: C.navy, letterSpacing: -7, transformOrigin: "left center", transform: `scale(${1 + Math.exp(-f / 9) * .035})` }}><div>{copy("TU WEB.")}</div><div>{copy("Y TU APP.")}</div></div>
    <div style={{ position: "absolute", top: 615, left: 72, font: `600 44px ${B}`, color: C.navy }}>{copy("Sin saber programar.")}</div>
    <div style={{ position: "absolute", top: 719, left: 70, background: C.mint, color: C.navy, borderRadius: 15, padding: "15px 28px", font: `700 61px ${D}`, letterSpacing: -1, transform: `rotate(${-3 + Math.sin(f / 15) * .7}deg) scale(${1 + Math.exp(-f / 8) * .14})`, boxShadow: "0 14px 0 #151c2c" }}>{copy("EMPIEZA GRATIS*")}</div>
    <Browser style={{ position: "absolute", top: 986, left: 88, width: 863, height: 691, transform: `perspective(1600px) rotateY(${t(f, 0, 90, -8, -2)}deg) rotateZ(-3deg) translateY(${Math.sin(f / 21) * 7}px)`, transformOrigin: "center" }}>
      <div style={{ height: 620 }}><Website/></div>
    </Browser>
    <Panel style={{ position: "absolute", top: 1446, left: 430, width: 570, padding: "23px 26px", background: C.navy, borderColor: C.mint, transform: `rotate(3deg) translateY(${Math.sin(f / 21 + 1) * 5}px)`, color: C.white }}>
      <div style={{ color: C.mint, font: `600 21px ${B}`, marginBottom: 10 }}>{copy("LUXI · TU ASISTENTE IA")}</div><div style={{ font: `400 31px/1.3 ${I}` }}>{copy("«Quiero una web")}<br/>{copy("para mi negocio.»")}</div>
    </Panel>
    <div style={{ position: "absolute", top: 1760, left: 70, right: 70, color: C.muted, font: `400 25px/1.3 ${I}` }}>{copy("*Plan Free sin mensualidad. Consumo de IA aparte.")}</div>
  </AbsoluteFill>;
}
function Describe() {
  const copy = useBusinessCopy();
  const f = useCurrentFrame();
  const prompt = copy("Tengo un restaurante. Quiero una web con menú y pedidos por WhatsApp.");
  const sent = f >= 105;
  return <AbsoluteFill>
    <Brand/>
    <Title f={f} lines={["SOLO CUENTA", "TU IDEA."]}/>
    <div style={{ position: "absolute", top: 540, left: 72, color: C.muted, font: `400 35px ${I}`, ...pop(f, 10) }}>{copy("Como si hablaras con una persona.")}</div>
    <Panel style={{ position: "absolute", left: 66, top: 689, width: 948, height: 908, padding: "29px 32px", ...pop(f, 0, 60) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 15, color: C.navy, font: `600 30px ${B}` }}><div style={{ display: "grid", placeItems: "center", width: 66, height: 66, borderRadius: 20, background: C.ice }}><Icon name="spark" color="#0c927e"/></div><div>{copy("Luxi · asistente de tu sitio")}<div style={{ color: C.muted, font: `400 23px ${I}`, marginTop: 5 }}>{copy("Tu proyecto empieza aquí.")}</div></div></div>
      <div style={{ marginTop: 37, background: C.paper, borderRadius: 22, padding: "25px 28px", color: C.navy, font: `400 31px/1.4 ${I}`, ...pop(f, 7) }}>{copy("Hola. Cuéntame qué quieres crear")}<br/>{copy("para tu negocio.")}</div>
      <div style={{ position: "absolute", top: 331, left: 32, right: 32, minHeight: 270, padding: "25px 27px", background: sent ? C.ice : C.white, border: `2px solid ${sent ? "#ace9de" : C.mint}`, borderRadius: 22 }}>
        <div style={{ color: C.muted, font: `600 21px ${B}`, marginBottom: 16 }}>{copy(sent ? "TÚ · MENSAJE ENVIADO" : "¿QUÉ QUIERES CREAR?")}</div>
        <div style={{ color: C.navy, font: `400 36px/1.4 ${I}`, paddingRight: 40 }}>{prompt.slice(0, Math.floor(t(f, 16, 84, 0, prompt.length)))}<span style={{ color: "#099f88", opacity: sent ? 0 : f % 13 < 8 ? 1 : 0 }}>▍</span></div>
        {!sent && <div style={{ position: "absolute", right: 24, bottom: 18, width: 61, height: 61, background: C.navy, borderRadius: 18, display: "grid", placeItems: "center" }}><Icon name="send" color={C.white} size={32}/></div>}
      </div>
      <Cursor f={f} at={88} x={831} y={538}/>
      {sent && <div style={{ position: "absolute", top: 640, left: 32, right: 32, ...pop(f, 111) }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#0c806f", font: `600 27px ${B}`, marginBottom: 17 }}><Icon name="spark" color="#0c806f" size={30}/>{copy("TU IDEA, EN MARCHA")}</div>
        <div style={{ display: "flex", gap: 12 }}>{["Diseño", "Menú", "WhatsApp"].map((s, i) => <div key={s} style={{ flex: 1, borderRadius: 13, background: C.paper, padding: "18px 12px", textAlign: "center", color: C.navy, font: `600 24px ${B}`, ...pop(f, 122 + i * 12) }}>{copy(s)}<div style={{ height: 4, borderRadius: 4, marginTop: 12, background: "#d8e7e3" }}><div style={{ height: "100%", width: `${t(f, 125 + i * 12, 196, 0, 100)}%`, background: C.mint }}/></div></div>)}</div>
      </div>}
    </Panel>
    <div style={{ position: "absolute", top: 1685, left: 74, color: C.navy, font: `600 34px ${B}`, ...pop(f, 146) }}>{copy("Tú explicas. Luxi te ayuda a crear.")}</div>
  </AbsoluteFill>;
}
function Reveal() {
  const copy = useBusinessCopy();
  const f = useCurrentFrame();
  return <AbsoluteFill>
    <Brand/>
    <Title f={f} lines={["TU IDEA", "TOMA FORMA."]} size={113}/>
    <div style={{ position: "absolute", top: 558, left: 73, color: C.muted, font: `400 34px ${I}`, ...pop(f, 14) }}>{copy("Una web que habla de tu negocio.")}</div>
    <Browser style={{ position: "absolute", top: 695 - t(f, 118, 179, 0, 54), left: 66, width: 948, height: 938, transform: `perspective(1800px) rotateX(${t(f, 0, 35, 7, 0)}deg) scale(${t(f, 0, 35, .91, 1) + t(f, 118, 179, 0, .025)})` }}>
      <div style={{ height: 867, transform: `translateY(${-t(f, 132, 190, 0, 24)}px)` }}><Website build={f - 9}/></div>
    </Browser>
    <div style={{ position: "absolute", top: 1681, left: 66, display: "flex", gap: 18 }}>
      {["Tus fotos", "Tu catálogo", "Tu estilo"].map((s, i) => <div key={s} style={{ ...pop(f, 86 + i * 16) }}><Tag><Icon name="check" size={27} color={C.mint}/>{copy(s)}</Tag></div>)}
    </div>
    <div style={{ position: "absolute", top: 1799, left: 72, color: C.muted, font: `400 23px ${I}` }}>{copy("Ejemplo ilustrativo · tiempos de creación variables.")}</div>
  </AbsoluteFill>;
}
function Edit() {
  const copy = useBusinessCopy();
  const f = useCurrentFrame();
  const changed = f >= 91;
  return <AbsoluteFill>
    <Brand/>
    <Title f={f} lines={["CAMBIA", "HABLANDO."]} size={119}/>
    <Browser style={{ position: "absolute", top: 613, left: 66, width: 948, height: 827, transform: `scale(${t(f, 84, 107, 1, 1.015)})`, borderColor: changed ? "#24e1c580" : undefined }}>
      <div style={{ height: 756 }}><Website accent={changed ? C.mint : C.food}/></div>
    </Browser>
    <Panel style={{ position: "absolute", left: 86, top: 1372, width: 908, height: 254, background: C.navy, borderColor: C.mint, padding: "24px 30px", ...pop(f, 17) }}>
      <div style={{ color: C.mint, font: `600 23px ${B}`, marginBottom: 16 }}>{copy("TU SIGUIENTE IDEA")}</div>
      <div style={{ color: C.white, font: `400 36px/1.3 ${I}`, width: 720 }}>{copy("«Cambia los botones a verde.»")}</div>
      <div style={{ position: "absolute", bottom: 23, right: 28, background: changed ? C.mint : C.white, color: C.navy, padding: "11px 18px", borderRadius: 12, font: `600 24px ${B}` }}>{copy(changed ? "Cambio aplicado ✓" : "Enviar →")}</div>
      <Cursor f={f} at={74} x={738} y={184}/>
    </Panel>
    <div style={{ position: "absolute", left: 72, top: 1707, color: C.navy, font: `600 38px/1.4 ${B}`, ...pop(f, 118) }}>{copy("Sin escribir código.")}<br/>{copy("Sin contratar un desarrollador.")}</div>
  </AbsoluteFill>;
}
function Orders() {
  const copy = useBusinessCopy();
  const f = useCurrentFrame();
  return <AbsoluteFill>
    <Brand/>
    <Title f={f} lines={["COMPARTE.", "RECIBE PEDIDOS."]} size={91}/>
    <div style={{ position: "absolute", left: 72, top: 514, color: C.muted, font: `400 34px ${I}`, ...pop(f, 10) }}>{copy("Tu negocio, también en el celular.")}</div>
    <Phone style={{ position: "absolute", left: 70, top: 668, transform: `rotate(${-5 + Math.sin(f / 37)}deg)` }}><Website accent={C.mint} phone/></Phone>
    <div style={{ position: "absolute", left: 575, top: 749, ...pop(f, 18) }}><Tag><Icon name="globe" color={C.mint} size={31}/>{copy("Comparte tu enlace")}</Tag></div>
    <svg width="1080" height="1920" style={{ position: "absolute", inset: 0 }}><path d="M465 1170 C690 1170 620 928 735 928" fill="none" stroke="#1eaa93" strokeWidth="4" strokeDasharray="8 14" strokeDashoffset={-f * 2.5} opacity={t(f, 23, 39)}/></svg>
    <Panel style={{ position: "absolute", left: 550, top: 1009, width: 466, padding: "26px 24px", background: "#e3f7e9", borderColor: "#b5dec5", ...pop(f, 56) }}>
      <div style={{ color: "#18744a", display: "flex", alignItems: "center", gap: 9, font: `600 24px ${B}`, marginBottom: 18 }}><Icon name="chat" color="#18744a" size={29}/>{copy("WhatsApp")}</div>
      <div style={{ color: C.navy, font: `400 30px/1.4 ${I}` }}>{copy("Hola 👋")}<br/>{copy("Vi tu menú.")}<br/>{copy("Quiero hacer un pedido.")}</div>
      <div style={{ color: "#488562", font: `400 19px ${I}`, textAlign: "right", marginTop: 19 }}>{copy("Mensaje de ejemplo ✓✓")}</div>
    </Panel>
    <div style={{ position: "absolute", top: 1482, left: 604, width: 410, color: C.navy, font: `600 35px/1.3 ${B}`, ...pop(f, 103) }}>{copy("Del enlace")}<br/>{copy("a la conversación.")}</div>
    <div style={{ position: "absolute", top: 1730, left: 72, right: 72, height: 2, background: "#cdded9" }}/>
    <div style={{ position: "absolute", top: 1782, left: 72, color: C.muted, font: `400 26px ${I}` }}>{copy("Ejemplo de web adaptable a móvil y flujo de pedidos.")}</div>
  </AbsoluteFill>;
}
function AppScene() {
  const copy = useBusinessCopy();
  const f = useCurrentFrame();
  return <AbsoluteFill>
    <Brand dark label="WEB + APP"/>
    <Title f={f} lines={["TU NEGOCIO.", "TAMBIÉN APP."]} size={105} dark/>
    <div style={{ position: "absolute", top: 550, left: 72, color: "#c8dadc", font: `400 34px ${I}`, ...pop(f, 10) }}>{copy("Una experiencia para tus clientes.")}</div>
    <div style={{ position: "absolute", top: 767, left: 603, width: 361, ...pop(f, 16) }}><div style={{ color: C.mint, font: `700 47px ${D}`, marginBottom: 25 }}>{copy("TU MARCA.")}</div><div style={{ color: C.white, font: `600 34px/1.4 ${B}` }}>{copy("Tu catálogo.")}<br/>{copy("Tus pantallas.")}<br/>{copy("Tu proyecto.")}</div></div>
    <Phone style={{ position: "absolute", top: 671, left: 110, height: 948, transform: `perspective(1800px) rotateY(${t(f, 0, 45, -14, -4)}deg) rotateZ(-4deg)` }}>
      <div style={{ height: "100%", position: "relative", background: "#fffaf3" }}>
        <div style={{ height: 767, overflow: "hidden" }}><Website phone accent={C.mint}/></div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 99, borderTop: "1px solid #dce5df", background: C.white, display: "flex", alignItems: "center", justifyContent: "space-around" }}>
          {[{ icon: "home", text: "Inicio" }, { icon: "heart", text: "Favoritos" }, { icon: "bag", text: "Pedidos" }].map((item, i) => <div key={item.text} style={{ color: i ? C.muted : "#078c77", textAlign: "center", font: `600 15px ${B}` }}><Icon name={item.icon} color={i ? C.muted : "#078c77"} size={28}/><div style={{ marginTop: 6 }}>{copy(item.text)}</div></div>)}
        </div>
      </div>
    </Phone>
    <div style={{ position: "absolute", top: 1456, left: 604, ...pop(f, 55) }}><Tag dark><Icon name="phone" size={29}/>{copy("Apps nativas")}</Tag></div>
    <div style={{ position: "absolute", top: 1720, left: 72, right: 72, color: "#c8dadc", font: `400 26px/1.5 ${I}` }}>{copy("Interfaz ilustrativa. Publicación en tiendas sujeta")}<br/>{copy("a revisión y condiciones de terceros.")}</div>
  </AbsoluteFill>;
}
function FreePlan() {
  const copy = useBusinessCopy();
  const f = useCurrentFrame();
  return <AbsoluteFill>
    <Brand/>
    <Title f={f} lines={["EMPIEZA GRATIS.", "CRECE A TU RITMO."]} size={87}/>
    <Panel style={{ position: "absolute", top: 654, left: 66, width: 948, height: 914, padding: "40px 45px", borderColor: "#92ddc8", ...pop(f) }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", font: `600 35px ${B}`, color: C.navy }}>{copy("Plan Free")}<span style={{ font: `600 21px ${B}`, color: "#0a7b68", padding: "10px 15px", background: C.ice, borderRadius: 12 }}>{copy("SIN MENSUALIDAD")}</span></div>
      <div style={{ display: "flex", alignItems: "baseline", marginTop: 27 }}><span style={{ font: `700 197px ${D}`, letterSpacing: -10, color: C.navy }}>$0</span><span style={{ marginLeft: 26, color: C.muted, font: `600 31px ${B}` }}>{copy("/ mes")}</span></div>
      <div style={{ height: 2, background: "#dcece5", margin: "24px 0 33px" }}/>
      {["Tu web + 1 app", "Hosting y 2 GB de espacio", "Catálogo y pedidos", "Gestión desde un solo lugar"].map((s, i) => <div key={s} style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 27, font: `600 31px ${B}`, color: C.navy, ...pop(f, 13 + i * 9, 20) }}><div style={{ width: 42, height: 42, borderRadius: "50%", background: C.ice, display: "grid", placeItems: "center" }}><Icon name="check" size={27} color="#0a7b68"/></div>{copy(s)}</div>)}
      <div style={{ position: "absolute", left: 44, right: 44, bottom: 38, background: C.paper, borderRadius: 17, padding: "22px 25px", color: C.muted, font: `400 27px/1.45 ${I}` }}>{copy("El consumo de IA se recarga por separado.")}<br/>{copy("Límites del plan y costos de terceros aplican.")}</div>
    </Panel>
    <div style={{ position: "absolute", left: 72, top: 1698, color: C.navy, font: `600 37px/1.4 ${B}`, ...pop(f, 76) }}>{copy("Empieza con tu idea.")}<br/>{copy("Elige cómo quieres crecer.")}</div>
  </AbsoluteFill>;
}
function Closing() {
  const copy = useBusinessCopy();
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ background: C.navy }}>
    <div style={{ position: "absolute", left: 70, top: 230, ...pop(f, 0) }}><Logo dark width={482}/></div>
    <div style={{ position: "absolute", top: 540, left: 65, font: `700 123px/1.02 ${D}`, color: C.white, letterSpacing: -5 }}><div style={{ ...pop(f, 5) }}>{copy("TU IDEA.")}</div><div style={{ ...pop(f, 10) }}>{copy("TU NEGOCIO.")}</div><div style={{ color: C.mint, ...pop(f, 15) }}>{copy("TU MOMENTO.")}</div></div>
    <div style={{ position: "absolute", top: 998, left: 75, color: "#dce8eb", font: `400 36px/1.4 ${I}`, ...pop(f, 23) }}>{copy("Crea tu proyecto sin saber programar.")}</div>
    <div style={{ position: "absolute", top: 1168, left: 72, right: 72, height: 132, borderRadius: 23, background: C.mint, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 36px", color: C.navy, font: `600 45px ${B}`, ...pop(f, 30) }}>{copy("Empieza gratis")}<Icon name="arrow" size={51}/></div>
    <div style={{ position: "absolute", top: 1435, left: 70, color: C.white, font: `700 84px ${D}`, letterSpacing: -2, ...pop(f, 37) }}>luxisoft.com</div>
    <div style={{ position: "absolute", top: 1710, left: 74, right: 74, color: "#c6d8dc", font: `400 28px/1.5 ${I}` }}>{copy("Plan Free sin mensualidad.")}<br/>{copy("IA por consumo y servicios de terceros aparte.")}</div>
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 11, background: `linear-gradient(90deg,${C.lime},${C.mint})` }}/>
  </AbsoluteFill>;
}

export const LuxiSoftBusinessFree: React.FC<{ language?: BusinessLanguage; includeMusic?: boolean }> = ({ language = "es", includeMusic = true }) => {
  const f = useCurrentFrame();
  const scenes = [Hook, Describe, Reveal, Edit, Orders, AppScene, FreePlan, Closing];
  const dark = f >= BUSINESS_CUTS[5] && f < BUSINESS_CUTS[6];
  return <BusinessLanguageContext.Provider value={language}><AbsoluteFill style={{ overflow: "hidden", fontFamily: I }}>
    <Backdrop f={f} dark={dark}/>
    {scenes.map((Scene, i) => <Sequence key={BUSINESS_CUTS[i]} from={BUSINESS_CUTS[i]} durationInFrames={BUSINESS_CUTS[i + 1] - BUSINESS_CUTS[i]}><Scene/></Sequence>)}
    {includeMusic && <Audio src={staticFile("audio/score-business.wav")}/>}
  </AbsoluteFill></BusinessLanguageContext.Provider>;
};
