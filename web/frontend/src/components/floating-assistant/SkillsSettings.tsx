// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Skills y métodos del asistente. Las skills son GLOBALES (universales): cada
 * una es un bloque de prompt/comportamiento que aplica a cualquier proveedor,
 * por eso vive como UNA sola sección en Proveedores → «Todos» (la vista General),
 * no por proveedor. (Antes estaba en el tab Accesos; se movió aquí.)
 *
 * UI: tarjetas pequeñas en cuadrícula (varias por fila) + barra superior con
 * filtro de texto y selector de categoría. El header del contenedor calca el de
 * sus hermanos (Auto-routing / Traducción / Voz): mismo `<section>` + `<h3>` con
 * icono `text-primary`.
 */
import { useEffect, useMemo, useState } from "react";
import { skillsApi, type AssistantSkill } from "./assistant-api";
import { CollapsibleSection } from "./CollapsibleSection";
import { useAssistantI18n, formatAssistantMessage, mergeNamespaces } from "./i18n";

/** Turn a skill `source` into a clickable URL: full http(s) URLs pass through;
 *  a bare "domain/path" (incl. the " · github.com/x" core format) is extracted. */
function linkifySource(src?: string): string | null {
  if (!src) return null;
  if (/^https?:\/\//.test(src)) return src;
  const m = src.match(/([a-z0-9-]+(?:\.[a-z0-9-]+)+\/[^\s]*)/i);
  return m ? `https://${m[1]}` : null;
}

// Type-only fallback string shape; actual strings live in the i18n locale files
// (assistant.skillsSettings.*) and are deep-merged at runtime via mergeNamespaces.
const skillsFallback = {
  title: "",
  helper: "",
  tokenNote: "",
  search: "",
  allCategories: "",
  loading: "",
  empty: "",
  noMatch: "",
  sourcePrefix: "",
  errorGeneric: "",
  activeShown: "",
};

export function SkillsSettings() {
  const i18n = useAssistantI18n() as ReturnType<typeof useAssistantI18n> & { skillsSettings?: Record<string, any> };
  const tt = mergeNamespaces(skillsFallback, i18n.skillsSettings);
  // Skill name/description/category come from the backend in Spanish; the
  // frontend i18n localizes them keyed by the stable skill/category id and
  // falls back to the backend string when a locale lacks the entry.
  const cat = i18n as unknown as {
    skillCatalog?: Record<string, { name?: string; description?: string }>;
    skillCategories?: Record<string, string>;
    skillOptions?: Record<string, Record<string, { label?: string; choices?: Record<string, string> }>>;
  };
  const skillName = (s: AssistantSkill) => cat.skillCatalog?.[s.id]?.name ?? s.name;
  const skillDesc = (s: AssistantSkill) => cat.skillCatalog?.[s.id]?.description ?? s.description;
  const skillCatLabel = (s: AssistantSkill) => cat.skillCategories?.[s.category] ?? s.categoryLabel;
  const skillOptLabel = (s: AssistantSkill, key: string, fb: string) =>
    cat.skillOptions?.[s.id]?.[key]?.label ?? fb;
  const skillChoiceLabel = (s: AssistantSkill, key: string, value: string, fb: string) =>
    cat.skillOptions?.[s.id]?.[key]?.choices?.[value] ?? fb;
  const [skills, setSkills] = useState<AssistantSkill[] | null>(null);
  const [skillsErr, setSkillsErr] = useState<string | null>(null);
  const [busySkill, setBusySkill] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    skillsApi
      .list()
      .then((rows) => {
        if (!cancelled) setSkills(rows);
      })
      .catch((e) => {
        if (!cancelled) setSkillsErr((e as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refetchSkills = () => {
    skillsApi
      .list()
      .then(setSkills)
      .catch((e) => setSkillsErr((e as Error).message));
  };

  const runSkillUpdate = async (
    id: string,
    patch: { enabled?: boolean; options?: Record<string, string> },
  ) => {
    setBusySkill(id);
    setSkillsErr(null);
    try {
      const next = await skillsApi.update(id, patch);
      setSkills(next);
    } catch {
      setSkillsErr(tt.errorGeneric);
      refetchSkills();
    } finally {
      setBusySkill(null);
    }
  };

  // Categories for the select, in backend (registry) order so they follow
  // SKILL_CATEGORIES. Deduped, with their display label.
  const categories = useMemo(() => {
    if (!skills) return [];
    const seen = new Set<string>();
    const out: Array<{ id: string; label: string }> = [];
    for (const s of skills) {
      if (!seen.has(s.category)) {
        seen.add(s.category);
        out.push({ id: s.category, label: skillCatLabel(s) });
      }
    }
    return out;
  }, [skills]);

  // Text + category filter (flat list → cards). Matches name/description/category.
  const filtered = useMemo(() => {
    if (!skills) return [];
    const q = query.trim().toLowerCase();
    return skills.filter((s) => {
      if (category !== "all" && s.category !== category) return false;
      if (!q) return true;
      return (
        skillName(s).toLowerCase().includes(q) ||
        skillDesc(s).toLowerCase().includes(q) ||
        skillCatLabel(s).toLowerCase().includes(q)
      );
    });
  }, [skills, query, category]);

  const totalEnabled = useMemo(() => (skills ?? []).filter((s) => s.enabled).length, [skills]);

  return (
    <CollapsibleSection
      icon={<i className="ti ti-sparkles text-lg" aria-hidden></i>}
      title={tt.title}
      description={tt.helper}
    >
      {/* Filter bar: search input + category select. */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <i className="ti ti-search pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground" aria-hidden></i>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            placeholder={tt.search}
            className="h-8 w-full rounded-md border border-input bg-background pl-7 pr-2 text-xs focus:border-primary focus:outline-none"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.currentTarget.value)}
          className="h-8 shrink-0 rounded-md border border-input bg-background px-2 text-xs focus:border-primary focus:outline-none"
        >
          <option value="all">{tt.allCategories}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>

      {skills !== null && (
        <p className="mb-2 text-[10px] text-muted-foreground/80">
          {formatAssistantMessage(tt.activeShown, { count: String(totalEnabled), shown: String(filtered.length) })} {tt.tokenNote}
        </p>
      )}

      {skillsErr && <p className="mb-2 text-xs text-amber-500">{skillsErr}</p>}

      {skills === null && !skillsErr && (
        <p className="text-xs text-muted-foreground">{tt.loading}</p>
      )}

      {skills && skills.length === 0 && (
        <p className="text-xs text-muted-foreground">{tt.empty}</p>
      )}

      {skills && skills.length > 0 && filtered.length === 0 && (
        <p className="text-xs text-muted-foreground">{tt.noMatch}</p>
      )}

      {filtered.length > 0 && (
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
          {filtered.map((skill) => {
            const busy = busySkill === skill.id;
            const sourceUrl = linkifySource(skill.source);
            return (
              <div
                key={skill.id}
                className={`flex flex-col gap-1 rounded-lg border bg-background p-2.5 transition-colors ${
                  skill.enabled ? "border-emerald-500/40" : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <p className="min-w-0 text-xs font-medium leading-tight line-clamp-2" title={skillName(skill)}>
                    {skillName(skill)}
                  </p>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={skill.enabled}
                    aria-label={skillName(skill)}
                    disabled={busy}
                    onClick={() => runSkillUpdate(skill.id, { enabled: !skill.enabled })}
                    className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                      skill.enabled ? "bg-emerald-500" : "bg-muted"
                    }`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        skill.enabled ? "translate-x-3.5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>

                <p className="text-[10px] leading-snug text-muted-foreground line-clamp-2" title={skillDesc(skill)}>
                  {skillDesc(skill)}
                </p>

                <div className="mt-auto flex items-center justify-between gap-1.5 pt-0.5">
                  <span className="truncate rounded bg-muted px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground" title={skillCatLabel(skill)}>
                    {skillCatLabel(skill)}
                  </span>
                  {sourceUrl && (
                    <a
                      href={sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-muted-foreground/70 hover:text-foreground"
                      title={`${tt.sourcePrefix} ${skill.source}`}
                      aria-label={tt.sourcePrefix}
                    >
                      <i className="ti ti-external-link text-[11px]" aria-hidden></i>
                    </a>
                  )}
                </div>

                {skill.enabled && skill.options.length > 0 && (
                  <div className="space-y-1 border-t border-border pt-1.5">
                    {skill.options.map((opt) => (
                      <label key={opt.key} className="flex items-center justify-between gap-1.5 text-[10px]">
                        <span className="truncate text-muted-foreground" title={skillOptLabel(skill, opt.key, opt.label)}>{skillOptLabel(skill, opt.key, opt.label)}</span>
                        <select
                          value={opt.value}
                          disabled={busy}
                          onChange={(e) =>
                            runSkillUpdate(skill.id, { options: { [opt.key]: e.currentTarget.value } })
                          }
                          className="min-w-0 shrink rounded border border-border bg-card px-1 py-0.5 text-[10px] disabled:opacity-50"
                        >
                          {opt.choices.map((c) => (
                            <option key={c.value} value={c.value}>{skillChoiceLabel(skill, opt.key, c.value, c.label)}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </CollapsibleSection>
  );
}
