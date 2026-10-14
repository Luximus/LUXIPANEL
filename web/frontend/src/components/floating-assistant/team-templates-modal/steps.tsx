// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useEffect, useMemo, useState } from "react";
import {
  assistantTeamTemplatesApi,
  type ApplySlotOverrides,
  type TeamTemplate,
  type TeamTemplateCategory,
  type TeamTemplateCategoryDef,
  type TeamTemplateFeedbackStats,
  type TeamTemplateSummary,
  PROVIDER_META,
  PROVIDER_MODELS,
  type AssistantProviderId,
} from "../assistant-api";
import { LucideIcon } from "../LucideIcon";
import { agentAvatarUri, randomAvatarSeed } from "../agent-avataaars";
import { MermaidDiagram } from "../MermaidDiagram";
import { DirectoryPicker } from "../DirectoryPicker";
import { formatAssistantMessage, useAssistantI18n } from "../i18n";
import { COLOR_TINT, COLOR_TEXT, type SlotOverrides } from "./constants";
import { pickTemplateLabel, pickSlotLabel, categoryLabel } from "./labels";

export function StepCategory({
  categories,
  picked,
  onPick,
  t,
}: {
  categories: TeamTemplateCategoryDef[];
  picked: TeamTemplateCategory | null;
  onPick(c: TeamTemplateCategory): void;
  t: ReturnType<typeof useAssistantI18n>["teamTemplates"];
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{t.categoryHeading}</h3>
      <p className="mb-3 text-[11px] text-muted-foreground">{t.categoryHint}</p>
      <div className="grid grid-cols-2 gap-2 @2xl:grid-cols-3">
        {categories.map((c) => {
          const isPicked = picked === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(c.id)}
              className={`flex items-start gap-2 rounded-lg border p-3 text-left transition-colors ${
                isPicked
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background hover:bg-muted/50"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  COLOR_TINT[c.color] ?? "bg-muted"
                }`}
              >
                <LucideIcon
                  name={c.icon}
                  size={18}
                  className={COLOR_TEXT[c.color] ?? "text-muted-foreground"}
                />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{c.label}</p>
                <p className="text-[10px] text-muted-foreground">
                  {c.tags.length} {t.slotsLabel}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StepTags({
  tags,
  tagSearch,
  onSearch,
  pickedTags,
  onToggle,
  matchingCount,
  categoryLabel: catLabel,
  t,
}: {
  tags: TeamTemplateCategoryDef["tags"];
  tagSearch: string;
  onSearch(v: string): void;
  pickedTags: string[];
  onToggle(id: string): void;
  matchingCount: number;
  categoryLabel: string;
  t: ReturnType<typeof useAssistantI18n>["teamTemplates"];
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{t.tagsHeading}</h3>
      <p className="mb-3 text-[11px] text-muted-foreground">
        {formatAssistantMessage(t.tagsHint, { category: catLabel })}
      </p>
      <input
        type="text"
        value={tagSearch}
        onChange={(e) => onSearch(e.target.value)}
        placeholder={t.searchTagsPlaceholder}
        className="mb-3 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground"
      />
      {tags.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t.noTagsForCategory}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => {
            const isPicked = pickedTags.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => onToggle(tag.id)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  isPicked
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input bg-background text-foreground hover:bg-muted/50"
                }`}
              >
                {tag.label}
              </button>
            );
          })}
        </div>
      )}
      <p className="mt-4 text-[11px] text-muted-foreground">
        {matchingCount > 0
          ? formatAssistantMessage(t.templatesAvailable, { count: String(matchingCount) })
          : t.noTemplatesForTags}
      </p>
    </div>
  );
}

export function StepPreview({
  templates,
  pickedId,
  onPick,
  fullTemplate,
  t,
  locale,
}: {
  templates: TeamTemplateSummary[];
  pickedId: string | null;
  onPick(id: string): void;
  fullTemplate: TeamTemplate | null;
  t: ReturnType<typeof useAssistantI18n>["teamTemplates"];
  locale?: string;
}) {
  // Aggregated task-feedback of teams created from the picked template
  // (lazy — fetched only when a template's full preview is shown).
  const [fbStats, setFbStats] = useState<TeamTemplateFeedbackStats | null>(null);
  useEffect(() => {
    setFbStats(null);
    if (!fullTemplate?.id) return;
    let alive = true;
    assistantTeamTemplatesApi
      .feedbackStats(fullTemplate.id)
      .then((s) => {
        if (alive) setFbStats(s);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [fullTemplate?.id]);

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{t.previewHeading}</h3>
      <p className="mb-3 text-[11px] text-muted-foreground">{t.previewDescription}</p>
      <div className="grid grid-cols-1 gap-2">
        {templates.map((tmpl) => {
          const isPicked = pickedId === tmpl.id;
          return (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => onPick(tmpl.id)}
              className={`flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors ${
                isPicked
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background hover:bg-muted/50"
              }`}
            >
              <div className="flex items-start gap-2">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    COLOR_TINT[tmpl.color] ?? "bg-muted"
                  }`}
                >
                  <LucideIcon
                    name={tmpl.icon}
                    size={18}
                    className={COLOR_TEXT[tmpl.color] ?? "text-muted-foreground"}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{pickTemplateLabel(tmpl, locale, "name")}</p>
                  <p className="line-clamp-2 text-[11px] text-muted-foreground">{pickTemplateLabel(tmpl, locale, "description")}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="rounded bg-muted/50 px-1.5 py-0.5">
                  {formatAssistantMessage(t.slotsLabel, { count: String(tmpl.slotCount) })}
                </span>
                {tmpl.recommendMultiAgent && (
                  <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-violet-600">
                    {t.multiAgentHint}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {fullTemplate && (
        <div className="mt-4 rounded-lg border border-border bg-background p-3">
          <p className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-medium text-foreground">
            {pickTemplateLabel(fullTemplate, locale, "name")}
            {fbStats && fbStats.total > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-normal text-emerald-600">
                <i className="ti ti-thumb-up" aria-hidden></i>
                {formatAssistantMessage(t.feedbackChip, {
                  pct: Math.round((fbStats.ratio ?? 0) * 100),
                  count: fbStats.total,
                })}
              </span>
            )}
          </p>
          <div className="max-h-64 overflow-y-auto rounded-md border border-border bg-muted/20 p-2">
            <PreviewTree template={fullTemplate} t={t} locale={locale} />
          </div>
        </div>
      )}
    </div>
  );
}

export function PreviewTree({
  template,
  t,
  locale,
}: {
  template: TeamTemplate;
  t: ReturnType<typeof useAssistantI18n>["teamTemplates"];
  locale?: string;
}) {
  // Build a Mermaid `graph TD` from the slot graph (not from real agents).
  const code = useMemo(() => {
    if (template.slots.length === 0) return "graph TD\n  empty[\"empty\"]";
    const idMap = new Map<string, string>();
    template.slots.forEach((s, i) => idMap.set(s.slotId, `s_${i}`));
    const lines = ["graph TD"];
    for (const s of template.slots) {
      const localized = pickSlotLabel(s, template, locale, "name");
      const label = (localized || s.slotId).replace(/["\n\r]+/g, " ").slice(0, 48);
      lines.push(`  ${idMap.get(s.slotId)}["${label}"]`);
    }
    for (const s of template.slots) {
      if (s.parentSlotId) {
        lines.push(`  ${idMap.get(s.parentSlotId)} --> ${idMap.get(s.slotId)}`);
      }
    }
    const seen = new Set<string>();
    for (const s of template.slots) {
      for (const c of s.connectionSlotIds ?? []) {
        const a = idMap.get(s.slotId)!;
        const b = idMap.get(c);
        if (!b) continue;
        const key = [a, b].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        lines.push(`  ${a} -. ${t.connectionsLabel} .- ${b}`);
      }
    }
    return lines.join("\n");
  }, [template, t.connectionsLabel, locale]);

  const images = useMemo(() => {
    const m: Record<string, string> = {};
    template.slots.forEach((s, i) => {
      m[`s_${i}`] = agentAvatarUri(s.avatarConfig, s.slotId || `s_${i}`);
    });
    return m;
  }, [template]);

  return <MermaidDiagram code={code} nodeImages={images} />;
}

export function StepCustomize({
  template,
  overrides,
  onChange,
  onReset,
  t,
  locale,
}: {
  template: TeamTemplate;
  overrides: SlotOverrides;
  onChange(slotId: string, patch: Partial<ApplySlotOverrides>): void;
  onReset(slotId: string): void;
  t: ReturnType<typeof useAssistantI18n>["teamTemplates"];
  locale?: string;
}) {
  const providerOptions: AssistantProviderId[] = [
    "claude",
    "codex",
    "gemini",
    "deepseek",
    "grok",
    "minimax",
  ];

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{t.customizeHeading}</h3>
      <p className="mb-3 text-[11px] text-muted-foreground">{t.customizeHint}</p>
      <div className="space-y-3">
        {template.slots.map((slot) => {
          const ov = overrides[slot.slotId] ?? {};
          const isRoot = slot.parentSlotId === null;
          const effectiveAvatarConfig = ov.avatarConfig ?? slot.avatarConfig;
          const modelOptions = ov.providerId ? PROVIDER_MODELS[ov.providerId] ?? [] : [];
          return (
            <div
              key={slot.slotId}
              className="rounded-lg border border-border bg-background p-3"
            >
              <div className="mb-2 flex items-start gap-2">
                <img
                  src={agentAvatarUri(effectiveAvatarConfig, slot.slotId)}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-full bg-muted/40 object-cover"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{pickSlotLabel(slot, template, locale, "name")}</p>
                  <p className="line-clamp-2 text-[11px] text-muted-foreground">{pickSlotLabel(slot, template, locale, "description")}</p>
                </div>
                {isRoot && (
                  <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                    {t.ceo}
                  </span>
                )}
              </div>

              {/* Avatar override — Avataaars: reset to template / randomize */}
              <div className="mb-2 flex flex-wrap items-center gap-1">
                <span className="mr-1 text-[10px] font-medium text-muted-foreground">{t.overrideAvatar}</span>
                <button
                  type="button"
                  onClick={() => onChange(slot.slotId, { avatarConfig: undefined })}
                  className={`flex h-7 w-7 items-center justify-center rounded-md border text-[10px] ${
                    !ov.avatarConfig ? "border-primary bg-primary/10" : "border-input hover:bg-muted/50"
                  }`}
                  title={t.overrideAvatarClear}
                >
                  <LucideIcon name="X" size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => onChange(slot.slotId, { avatarConfig: { seed: randomAvatarSeed() } })}
                  className="flex h-7 items-center justify-center rounded-md border border-input px-2 text-[11px] hover:bg-muted/50"
                  title={t.overrideAvatarRandom}
                >
                  🎲
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 @xl:grid-cols-2">
                <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                  {t.overrideName}
                  <input
                    type="text"
                    value={ov.name ?? pickSlotLabel(slot, template, locale, "name")}
                    onChange={(e) =>
                      onChange(slot.slotId, {
                        name: e.target.value === pickSlotLabel(slot, template, locale, "name")
                          ? undefined
                          : e.target.value || undefined,
                      })
                    }
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground"
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                  {t.overrideProvider}
                  <select
                    value={ov.providerId ?? ""}
                    onChange={(e) =>
                      onChange(slot.slotId, {
                        providerId: (e.target.value || undefined) as AssistantProviderId | undefined,
                      })
                    }
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground"
                  >
                    <option value="">—</option>
                    {providerOptions.map((p) => (
                      <option key={p} value={p}>
                        {PROVIDER_META[p]?.label ?? p}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                  {t.overrideModel}
                  <select
                    value={ov.model ?? ""}
                    onChange={(e) => onChange(slot.slotId, { model: e.target.value || undefined })}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground"
                    disabled={!ov.providerId}
                  >
                    <option value="">{ov.providerId ? t.overrideModelPlaceholder : t.overrideModelNoProvider}</option>
                    {modelOptions.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                  {t.multiAgentCopiesLabel}
                  <input
                    type="number"
                    min={2}
                    max={8}
                    value={ov.multiAgentCount ?? slot.multiAgentCount ?? ""}
                    placeholder={t.copiesPlaceholder}
                    onChange={(e) =>
                      onChange(slot.slotId, {
                        multiAgentCount: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground"
                  />
                </label>
              </div>

              <label className="mt-2 flex flex-col gap-1 text-[11px] text-muted-foreground">
                {t.overrideDescription}
                <textarea
                  value={ov.description ?? pickSlotLabel(slot, template, locale, "description")}
                  maxLength={500}
                  rows={2}
                  onChange={(e) =>
                    onChange(slot.slotId, {
                      description:
                        e.target.value === pickSlotLabel(slot, template, locale, "description")
                          ? undefined
                          : e.target.value.slice(0, 500) || undefined,
                    })
                  }
                  className="resize-y rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground"
                />
              </label>

              <label className="mt-2 flex flex-col gap-1 text-[11px] text-muted-foreground">
                <span className="flex items-center justify-between">
                  <span>{t.overrideSystemPrompt}</span>
                  <span className="text-[10px] text-muted-foreground/70">
                    {(ov.systemPrompt ?? pickSlotLabel(slot, template, locale, "systemPrompt")).length}/20000
                  </span>
                </span>
                <p className="text-[10px] text-muted-foreground">{t.overrideSystemPromptHint}</p>
                <textarea
                  value={ov.systemPrompt ?? pickSlotLabel(slot, template, locale, "systemPrompt")}
                  maxLength={20000}
                  rows={6}
                  onChange={(e) =>
                    onChange(slot.slotId, {
                      systemPrompt:
                        e.target.value === pickSlotLabel(slot, template, locale, "systemPrompt")
                          ? undefined
                          : e.target.value.slice(0, 20000) || undefined,
                    })
                  }
                  className="resize-y rounded-md border border-input bg-background px-2 py-1 font-mono text-[11px] text-foreground"
                />
              </label>

              <details className="mt-2 text-[11px]">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  {t.overrideProjectPaths}
                </summary>
                <ProjectPathsEditor
                  slotId={slot.slotId}
                  value={ov.projectPaths ?? template.defaultProjectPaths ?? []}
                  onChange={(paths) => onChange(slot.slotId, { projectPaths: paths })}
                  t={t}
                />
              </details>

              {Object.keys(ov).length > 0 && (
                <button
                  type="button"
                  onClick={() => onReset(slot.slotId)}
                  className="mt-2 text-[11px] text-muted-foreground underline hover:text-foreground"
                >
                  {t.resetToDefaultsBtn}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ProjectPathsEditor({
  value,
  onChange,
  t,
}: {
  slotId: string;
  value: string[];
  onChange(paths: string[]): void;
  t: ReturnType<typeof useAssistantI18n>["teamTemplates"];
}) {
  const [draft, setDraft] = useState("");
  const [picking, setPicking] = useState(false);
  return (
    <div className="mt-2 space-y-1">
      {value.map((p) => (
        <div key={p} className="flex items-center gap-1.5">
          <code className="flex-1 truncate rounded bg-muted/50 px-1.5 py-0.5 text-[10px]">{p}</code>
          <button
            type="button"
            onClick={() => onChange(value.filter((x) => x !== p))}
            className="rounded border border-input px-1.5 py-0.5 text-[10px] hover:bg-muted/50"
          >
            {t.removePathBtn}
          </button>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const p = draft.trim();
              if (!p) return;
              onChange([...value, p]);
              setDraft("");
            }
          }}
          placeholder={t.pathPlaceholder}
          className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1 text-[11px] text-foreground"
        />
        <button
          type="button"
          onClick={() => {
            const p = draft.trim();
            if (!p) return;
            onChange([...value, p]);
            setDraft("");
          }}
          className="rounded-md border border-input px-2 py-1 text-[11px] hover:bg-muted/50"
        >
          {t.addPathBtn}
        </button>
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="rounded-md border border-input px-2 py-1 text-[11px] hover:bg-muted/50"
          title={t.browsePathBtn ?? t.browseTitle}
        >
          <i className="ti ti-folder-open" aria-hidden></i> {t.browsePathBtn ?? t.browseButton}
        </button>
      </div>
      {picking && (
        <DirectoryPicker
          initialPath={value[value.length - 1] || "/"}
          onClose={() => setPicking(false)}
          onSelect={(p) => {
            setPicking(false);
            if (!value.includes(p)) onChange([...value, p]);
          }}
        />
      )}
    </div>
  );
}

export function StepConfirm({
  template,
  namePrefix,
  onChangePrefix,
  overrides,
  t,
  locale,
}: {
  template: TeamTemplate;
  namePrefix: string;
  onChangePrefix(v: string): void;
  overrides: SlotOverrides;
  t: ReturnType<typeof useAssistantI18n>["teamTemplates"];
  locale?: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{t.confirmHeading}</h3>
      <p className="mb-3 text-[11px] text-muted-foreground">{t.confirmHint}</p>
      <ul className="mb-3 space-y-1 rounded-md border border-border bg-background p-3 text-[11px]">
        {template.slots.map((slot) => {
          const ov = overrides[slot.slotId] ?? {};
          const slotName = pickSlotLabel(slot, template, locale, "name");
          const finalName = namePrefix.trim()
            ? `${namePrefix.trim().slice(0, 60)} · ${ov.name ?? slotName}`
            : (ov.name ?? slotName);
          return (
            <li key={slot.slotId} className="flex items-center gap-2">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${
                  COLOR_TINT[slot.color] ?? "bg-muted"
                }`}
              >
                <LucideIcon
                  name={slot.icon || "Zap"}
                  size={12}
                  className={COLOR_TEXT[slot.color] ?? "text-muted-foreground"}
                />
              </span>
              <span className="truncate text-foreground">{finalName}</span>
              {ov.providerId && (
                <span className="rounded bg-muted/50 px-1 text-[10px] text-muted-foreground">
                  {ov.providerId}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <label className="mb-1 block text-[11px] text-muted-foreground">
        {t.namePrefixLabel}
      </label>
      <input
        type="text"
        value={namePrefix}
        onChange={(e) => onChangePrefix(e.target.value.slice(0, 60))}
        placeholder={t.namePrefixPlaceholder}
        maxLength={60}
        className="mb-1 w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground"
      />
      <p className="text-[10px] text-muted-foreground">{t.namePrefixHint}</p>

      <p className="mt-3 text-[11px] text-muted-foreground">
        {formatAssistantMessage(t.willCreate, { count: String(template.slots.length) })}
        {" · "}
        {t.rootCanSpawnHint}
      </p>
    </div>
  );
}
