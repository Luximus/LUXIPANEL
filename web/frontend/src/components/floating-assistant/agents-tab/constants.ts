// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { initialsFrom } from "@/lib/format";

// Icono/color: presets del editor de ROLES (el avatar de agente es Avataaars
// generado localmente a partir de `avatarConfig` — ver ./agent-avataaars).
export const ICON_PRESETS = ["Zap", "Wrench", "Terminal", "Shield", "Code", "Cpu", "Server", "FlaskConical"];
export const COLOR_PRESETS = ["violet", "blue", "emerald", "amber", "red", "slate", "cyan", "pink"];

// Quick AI-assist archetypes: selecting one sends its brief to the LLM, which
// drafts the whole agent (name, description, system prompt, tool subset).
export const AI_ARCHETYPES: Array<{ value: string; label: string; brief: string }> = [
  { value: "devops", label: "DevOps / SRE", brief: "Agente DevOps/SRE experto: despliegues, servicios systemd, Nginx, monitoreo de recursos y automatización segura de servidores Linux." },
  { value: "security", label: "Auditor de seguridad", brief: "Auditor de seguridad: revisa configuraciones, permisos, firewall (UFW), hardening del sistema y detecta riesgos, explicando severidad y remediación." },
  { value: "dba", label: "Administrador de BBDD", brief: "Administrador de bases de datos (MySQL/MariaDB y PostgreSQL): consultas, optimización, backups, restauración y mantenimiento seguro." },
  { value: "support", label: "Soporte técnico", brief: "Asistente de soporte técnico: diagnostica problemas y guía paso a paso a usuarios no técnicos con lenguaje claro y empático." },
  { value: "nginx", label: "Administrador web / Nginx", brief: "Administrador web/Nginx: virtual hosts, reverse proxy, certificados SSL/TLS, dominios, rendimiento y resolución de errores 5xx." },
  { value: "backups", label: "Especialista en backups", brief: "Especialista en backups: estrategias de respaldo programado, cifrado, múltiples destinos, verificación de integridad y restauración guiada." },
  { value: "logs", label: "Analista de logs", brief: "Analista de logs e incidencias: investiga errores, correlaciona eventos del sistema y servicios, y resume causas y acciones." },
  { value: "automation", label: "Automatización / Cron", brief: "Ingeniero de automatización: diseña tareas cron y scripts seguros, idempotentes y con notificaciones de resultado." },
];

// Static class maps — Tailwind JIT cannot see dynamically-built class names, so
// every literal (`bg-violet-500`, `text-violet-500`, `bg-violet-500/15`) must
// appear verbatim in the source to be generated.
export const COLOR_DOT: Record<string, string> = {
  violet: "bg-violet-500", blue: "bg-blue-500", emerald: "bg-emerald-500", amber: "bg-amber-500",
  red: "bg-red-500", slate: "bg-slate-500", cyan: "bg-cyan-500", pink: "bg-pink-500",
};
export const COLOR_TEXT: Record<string, string> = {
  violet: "text-violet-500", blue: "text-blue-500", emerald: "text-emerald-500", amber: "text-amber-500",
  red: "text-red-500", slate: "text-slate-500", cyan: "text-cyan-500", pink: "text-pink-500",
};
export const COLOR_TINT: Record<string, string> = {
  violet: "bg-violet-500/15", blue: "bg-blue-500/15", emerald: "bg-emerald-500/15", amber: "bg-amber-500/15",
  red: "bg-red-500/15", slate: "bg-slate-500/15", cyan: "bg-cyan-500/15", pink: "bg-pink-500/15",
};
export const colorText = (c?: string) => COLOR_TEXT[c || "violet"] ?? COLOR_TEXT.violet;
export const colorTint = (c?: string) => COLOR_TINT[c || "violet"] ?? COLOR_TINT.violet;

// ── Team "initials avatar" (grid-list · Simple cards pattern) ────────────────
// Cuadrado de color sólido con las iniciales del equipo en blanco. El color se
// deriva de forma determinista del nombre/id (hash → paleta viva); si el equipo
// tiene un color elegido se respeta ese. Tailwind JIT necesita los literales
// `bg-*-600` verbatim, de ahí los mapas estáticos.
export const AVATAR_BG_PALETTE = [
  "bg-pink-600", "bg-violet-600", "bg-amber-500", "bg-emerald-600",
  "bg-blue-600", "bg-cyan-600", "bg-fuchsia-600", "bg-rose-600",
];
export const AVATAR_BG_BY_COLOR: Record<string, string> = {
  violet: "bg-violet-600", blue: "bg-blue-600", emerald: "bg-emerald-600", amber: "bg-amber-500",
  red: "bg-rose-600", slate: "bg-slate-600", cyan: "bg-cyan-600", pink: "bg-pink-600",
};
export function hashKey(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
/** Fondo sólido del avatar: color del equipo si existe, si no hash determinista. */
export function teamAvatarBg(key: string, teamColor?: string): string {
  if (teamColor && AVATAR_BG_BY_COLOR[teamColor]) return AVATAR_BG_BY_COLOR[teamColor];
  return AVATAR_BG_PALETTE[hashKey(key) % AVATAR_BG_PALETTE.length];
}
/** Iniciales en mayúscula: 2 primeras letras de una palabra, o iniciales de dos. */
export const teamInitials = (name: string): string => initialsFrom(name);
