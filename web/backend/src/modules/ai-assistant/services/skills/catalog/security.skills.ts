// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import type { AssistantSkill } from "../skill.types.js";
import { catalogSkill } from "./factory.js";

export const securitySkills: AssistantSkill[] = [
  catalogSkill({
    id: "owasp-llm-top10",
    name: "OWASP Top 10 LLM",
    category: "security",
    source: "https://owasp.org/www-project-top-10-for-large-language-model-applications/",
    description: "Top 10 riesgos en apps LLM: prompt injection, output inseguro, excessive agency.",
    block: [
      "Defiende LLM01 Prompt Injection: separa instrucciones de datos no confiables, no des tools sensibles a entrada externa sin validación.",
      "LLM02 Insecure Output Handling: trata la salida como no confiable, no la ejecutes/inyectes sin sanear. LLM06 Sensitive Information Disclosure: limita datos en el contexto.",
      "Vigila LLM03/05 envenenamiento de datos y supply chain, LLM04 DoS (rate/coste), LLM07 Insecure Plugin Design, LLM08 Excessive Agency (limita permisos del agente), LLM09 Overreliance y LLM10 Model Theft.",
    ].join(" "),
  }),
  catalogSkill({
    id: "owasp-asvs",
    name: "OWASP ASVS",
    category: "security",
    source: "https://owasp.org/www-project-application-security-verification-standard/",
    description: "ASVS v5.0: estándar de requisitos verificables de seguridad por niveles.",
    block: [
      "Usa ASVS (v5.0, 2025) como checklist de requisitos verificables; elige nivel (L1 básico, L2 estándar, L3 crítico) según el riesgo de la app.",
      "Cubre codificación/sanitización (prevención de inyección), auth, gestión de sesión, control de acceso, criptografía, manejo de errores y logging con controles concretos (id chapter.section.requirement).",
      "Mapea cada requisito a una prueba; trátalos como criterios de aceptación, no sugerencias. Disponible en CSV/JSON.",
    ].join(" "),
  }),
  catalogSkill({
    id: "codeql",
    name: "CodeQL",
    category: "security",
    source: "https://codeql.github.com/docs/",
    description: "CodeQL: consulta el código como datos (data-flow/taint) para hallar vulnerabilidades.",
    block: [
      "Usa CodeQL para tratar el código como datos: data-flow/taint tracking detecta inyecciones, path traversal y XSS siguiendo fuentes no confiables hasta sinks (mapeado a CWEs).",
      "Corre los query suites estándar en CI (code scanning, CLI o extensión VS Code); escribe consultas a medida con la librería estándar para variantes propias y compártelas.",
      "Triaja por severidad y ruta real; suprime falsos positivos con anotaciones, no bajando el rigor global.",
    ].join(" "),
  }),
  catalogSkill({
    id: "semgrep",
    name: "Semgrep",
    category: "security",
    source: "https://semgrep.dev/",
    description: "Semgrep: SAST por reglas tipo-código + Supply Chain (SCA) y Secrets, alto signal.",
    block: [
      "Usa Semgrep Code (SAST) en CI con reglas oficiales más reglas propias en sintaxis tipo-código (metavariables) para vetar patrones inseguros y antipatrones del repo.",
      "Suma Supply Chain (SCA con reachability, solo lo explotable) y Secrets (credenciales hardcodeadas por entropía/validación). Integra en CLI, PRs (GitHub/GitLab/Bitbucket) e IDEs.",
      "Falla el build en alta severidad; usa autofix y baseline para deuda. Apunta a alto signal y bajos falsos positivos.",
    ].join(" "),
  }),
  catalogSkill({
    id: "snyk",
    name: "Snyk",
    category: "security",
    source: "https://snyk.io/",
    description: "Snyk: SCA, Code (SAST), Container, IaC y API/Web (DAST) con remediación guiada.",
    block: [
      "Escanea Open Source (SCA dependencias), Code (SAST en tiempo de escritura), Container (imágenes base), IaC (misconfigs) y API & Web (DAST); prioriza por exploitability.",
      "Integra en CI, PRs e IDE para bloquear vulnerabilidades y remediar upstream con parches/upgrades sugeridos; fija versiones y revisa transitivas.",
      "No ignores hallazgos sin justificar; usa políticas de ignore con fecha de caducidad y dueño.",
    ].join(" "),
  }),
  catalogSkill({
    id: "owasp-zap",
    name: "OWASP ZAP",
    category: "security",
    source: "https://www.zaproxy.org/",
    description: "OWASP ZAP: scanner web open source líder para DAST (passive/active scan).",
    block: [
      "Usa ZAP, el scanner web open source más usado, como proxy para DAST: passive scan mientras navegas y active scan controlado contra entornos de prueba (nunca prod sin permiso).",
      "Automatiza con el Automation Framework / baseline scan en CI; autentica la sesión y define contexto/alcance para cubrir rutas reales. Amplía con add-ons del Marketplace.",
      "Verifica manualmente los hallazgos (inyección, XSS, headers, auth) antes de reportar; ajusta reglas para reducir falsos positivos.",
    ].join(" "),
  }),
  catalogSkill({
    id: "skillspector",
    name: "SkillSpector (auditar Skills IA)",
    category: "security",
    source: "https://github.com/NVIDIA/SkillSpector",
    description:
      "Audita Skills de agentes IA (SKILL.md + scripts) buscando vulnerabilidades e intención maliciosa antes de instalarlas (NVIDIA, Apache-2.0).",
    block:
      "Antes de instalar un Skill de agente, escanéalo con SkillSpector (NVIDIA, Apache-2.0): `skillspector scan ./skill/`. Revisa SKILL.md y sus scripts contra 16 categorías: prompt injection, exfiltración de datos, escalada de privilegios, agencia excesiva, envenenamiento de memoria, fuga de system prompt, cadena de suministro y riesgos MCP (least-privilege, tool poisoning, rug-pull). Combina patrones estáticos + reglas YARA + CVEs de OSV.dev con análisis semántico LLM opcional (`--no-llm` lo omite). Exporta SARIF/JSON. Prioriza precisión sobre recall; revisa hallazgos de alta severidad y el score 0–100.",
  }),
];
