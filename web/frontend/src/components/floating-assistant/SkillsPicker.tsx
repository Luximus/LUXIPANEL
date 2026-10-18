// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Compact skills multi-select reused by the Agent editor and the Project modal.
 * Builds a SPARSE override map (skillId → {enabled, options}) layered over the
 * global skills only in that agent's/project's chats. A skill's checkbox shows
 * the EFFECTIVE state (override value falling back to the global default); the
 * override only records explicit deviations.
 */
import { useEffect, useMemo, useState } from "react";
import { skillsApi, type AssistantSkill, type AssistantSkillsMap } from "./assistant-api";
import { formatAssistantMessage, mergeNamespaces, useAssistantI18n } from "./i18n";

type SkillsPickerMessages = {
  searchPlaceholder: string;
  resetTitle: string;
  reset: string;
  loading: string;
  empty: string;
  globalNote: string;
};

// Type-only fallback string shape; actual strings live in the i18n locale files
// (assistant.skillsPicker.*) and are deep-merged at runtime via mergeNamespaces.
const skillsPickerFallback: SkillsPickerMessages = {
  searchPlaceholder: "",
  resetTitle: "",
  reset: "",
  loading: "",
  empty: "",
  globalNote: "",
};

export function SkillsPicker({
  value,
  onChange,
  fill = false,
}: {
  fill?: boolean;
  value: AssistantSkillsMap;
  onChange: (next: AssistantSkillsMap) => void;
}) {
  const i18n = useAssistantI18n() as ReturnType<typeof useAssistantI18n> & {
    skillsPicker?: Partial<SkillsPickerMessages>;
  };
  const tt = mergeNamespaces(skillsPickerFallback, i18n.skillsPicker);
  // Localize backend-sourced skill metadata (Spanish) via the shared catalog
  // i18n maps; fall back to the backend string when a locale lacks the entry.
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
  const [skills, setSkills] = useState<AssistantSkill[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void skillsApi.list().then((s) => { if (alive) setSkills(s); }).catch(() => { /* ignore */ }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter((s) => `${skillName(s)} ${skillDesc(s)} ${skillCatLabel(s)}`.toLowerCase().includes(q));
  }, [skills, query]);

  const isOn = (s: AssistantSkill) => value[s.id]?.enabled ?? s.enabled;
  const optOf = (s: AssistantSkill, key: string, dflt: string) => value[s.id]?.options?.[key] ?? dflt;

  const toggle = (s: AssistantSkill) => {
    const next = { ...value, [s.id]: { ...value[s.id], enabled: !isOn(s) } };
    onChange(next);
  };
  const setOption = (s: AssistantSkill, key: string, v: string) => {
    const prev = value[s.id] ?? {};
    onChange({ ...value, [s.id]: { ...prev, options: { ...(prev.options ?? {}), [key]: v } } });
  };

  const overridden = Object.keys(value).length;

  return (
    <div className={`flex min-w-0 flex-col gap-2 ${fill ? "min-h-0 w-full flex-1" : ""}`}>
      <div className="flex shrink-0 items-center justify-between gap-2">
        <input
          type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder={tt.searchPlaceholder}
          className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs focus:border-primary focus:outline-none"
        />
        {overridden > 0 && (
          <button type="button" onClick={() => onChange({})} className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground" title={tt.resetTitle}>
            {formatAssistantMessage(tt.reset, { count: overridden })}
          </button>
        )}
      </div>
      {loading && <p className="text-[11px] text-muted-foreground">{tt.loading}</p>}
      <div className={`flex flex-col gap-1 overflow-y-auto pr-1 ${fill ? "min-h-0 flex-1" : "max-h-56"}`}>
        {filtered.map((s) => (
          <div key={s.id} className="shrink-0 rounded-md bg-muted/30 px-2 py-1.5">
            <label className="flex items-start gap-2 text-[11px]">
              <input type="checkbox" className="mt-0.5" checked={isOn(s)} onChange={() => toggle(s)} />
              <span className="min-w-0 flex-1">
                <span className="font-medium text-foreground">{skillName(s)}</span>
                <span className="ml-1 rounded bg-muted px-1 text-[9px] text-muted-foreground">{skillCatLabel(s)}</span>
                <span className="block truncate text-muted-foreground" title={skillDesc(s)}>{skillDesc(s)}</span>
              </span>
            </label>
            {isOn(s) && s.options.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-2 pl-6">
                {s.options.map((o) => (
                  <label key={o.key} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    {skillOptLabel(s, o.key, o.label)}
                    <select
                      value={optOf(s, o.key, o.value)}
                      onChange={(e) => setOption(s, o.key, e.target.value)}
                      className="rounded border border-input bg-background px-1 py-0.5 text-[10px] focus:border-primary focus:outline-none"
                    >
                      {o.choices.map((c) => <option key={c.value} value={c.value}>{skillChoiceLabel(s, o.key, c.value, c.label)}</option>)}
                    </select>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
        {!loading && filtered.length === 0 && <p className="text-[11px] text-muted-foreground">{tt.empty}</p>}
      </div>
      <p className="shrink-0 text-[10px] text-muted-foreground/70">
        {tt.globalNote}
      </p>
    </div>
  );
}
