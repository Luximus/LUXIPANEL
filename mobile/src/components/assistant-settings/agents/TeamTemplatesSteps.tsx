// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Pasos del asistente de plantillas de equipo (extraídos de
 * `TeamTemplatesModal.tsx`): categoría → tipos → galería + vista previa →
 * personalizar por slot → confirmar. Sin estado propio salvo el borrador local
 * de `ProjectPathsEditor`; todo el estado del flujo vive en el WizardView.
 */
import React, { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { X } from "lucide-react-native";
import { Input } from "../../ui/Input";
import { Button } from "../../ui/Button";
import { Select } from "../../ui/Select";
import { s } from "../styles";
import type { ThemeTokens } from "../../../theme/colors";
import { PROVIDER_META, PROVIDER_MODELS, PROVIDER_ORDER } from "../../ProviderIcon";
import type {
  AssistantProviderId,
  ApplySlotOverrides,
  TeamTemplate,
  TeamTemplateCategory,
  TeamTemplateCategoryDef,
  TeamTemplateFeedbackStats,
  TeamTemplateSlot,
  TeamTemplateSummary,
} from "../types";
import { formatStr } from "./agents-i18n";
import { AgentAvatar } from "./AgentAvatar";
import { randomAvatarSeed } from "./agent-avataaars";
import {
  type SlotOverrides,
  type TemplatesStrings,
  pickSlotLabel,
  pickTemplateLabel,
} from "./team-templates-i18n";

const PROVIDER_OPTIONS: AssistantProviderId[] = PROVIDER_ORDER;

// ── Paso 1: categoría ────────────────────────────────────────────────────────

export function StepCategory({
  categories,
  picked,
  onPick,
  tokens,
  tpl,
}: {
  categories: TeamTemplateCategoryDef[];
  picked: TeamTemplateCategory | null;
  onPick: (c: TeamTemplateCategory) => void;
  tokens: ThemeTokens;
  tpl: TemplatesStrings;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={[s.cardTitle, { color: tokens.textPrimary }]}>{tpl.categoryHeading}</Text>
      <Text style={[s.cardDesc, { color: tokens.textMuted }]}>{tpl.categoryHint}</Text>
      <View style={{ gap: 8 }}>
        {categories.map((c) => {
          const on = picked === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => onPick(c.id)}
              style={[
                s.card,
                {
                  backgroundColor: on ? tokens.brandDim : tokens.bgInput,
                  borderColor: on ? tokens.brand : tokens.border,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[s.cardTitle, { color: tokens.textPrimary }]}>{c.label}</Text>
                <Text style={[s.cardDesc, { color: tokens.textMuted }]}>
                  {formatStr(tpl.slotsLabel, { count: c.tags.length })}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ── Paso 2: tags ─────────────────────────────────────────────────────────────

export function StepTags({
  tags,
  tagSearch,
  onSearch,
  pickedTags,
  onToggle,
  matchingCount,
  tokens,
  tpl,
}: {
  tags: TeamTemplateCategoryDef["tags"];
  tagSearch: string;
  onSearch: (v: string) => void;
  pickedTags: string[];
  onToggle: (id: string) => void;
  matchingCount: number;
  tokens: ThemeTokens;
  tpl: TemplatesStrings;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={[s.cardTitle, { color: tokens.textPrimary }]}>{tpl.tagsHeading}</Text>
      <Text style={[s.cardDesc, { color: tokens.textMuted }]}>{tpl.tagsHint}</Text>
      <Input value={tagSearch} onChangeText={onSearch} placeholder={tpl.searchTagsPlaceholder} />
      {tags.length === 0 ? (
        <Text style={[s.cardDesc, { color: tokens.textMuted }]}>{tpl.noTagsForCategory}</Text>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
          {tags.map((tag) => {
            const on = pickedTags.includes(tag.id);
            return (
              <Pressable
                key={tag.id}
                onPress={() => onToggle(tag.id)}
                style={{
                  borderRadius: 999,
                  borderWidth: 1,
                  paddingHorizontal: 11,
                  paddingVertical: 6,
                  backgroundColor: on ? tokens.brandDim : tokens.bgInput,
                  borderColor: on ? tokens.brand : tokens.border,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: on ? tokens.brand : tokens.textSecondary }}>
                  {tag.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <Text style={[s.cardDesc, { color: tokens.textMuted, marginTop: 4 }]}>
        {matchingCount > 0 ? formatStr(tpl.templatesAvailable, { count: matchingCount }) : tpl.noTemplatesForTags}
      </Text>
    </View>
  );
}

// ── Paso 3: galería + vista previa ───────────────────────────────────────────

export function StepPreview({
  templates,
  pickedId,
  onPick,
  fullTemplate,
  fbStats,
  tokens,
  tpl,
  locale,
}: {
  templates: TeamTemplateSummary[];
  pickedId: string | null;
  onPick: (id: string) => void;
  fullTemplate: TeamTemplate | null;
  fbStats: TeamTemplateFeedbackStats | null;
  tokens: ThemeTokens;
  tpl: TemplatesStrings;
  locale?: string;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={[s.cardTitle, { color: tokens.textPrimary }]}>{tpl.previewHeading}</Text>
      <Text style={[s.cardDesc, { color: tokens.textMuted }]}>{tpl.previewDescription}</Text>
      <View style={{ gap: 8 }}>
        {templates.map((tmpl) => {
          const on = pickedId === tmpl.id;
          return (
            <Pressable
              key={tmpl.id}
              onPress={() => onPick(tmpl.id)}
              style={[
                s.card,
                {
                  backgroundColor: on ? tokens.brandDim : tokens.bgInput,
                  borderColor: on ? tokens.brand : tokens.border,
                  gap: 6,
                },
              ]}
            >
              <Text style={[s.cardTitle, { color: tokens.textPrimary }]}>
                {pickTemplateLabel(tmpl, locale, "name")}
              </Text>
              <Text style={[s.cardDesc, { color: tokens.textMuted }]} numberOfLines={2}>
                {pickTemplateLabel(tmpl, locale, "description")}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                <View style={[s.badge, { backgroundColor: tokens.bgSecondary }]}>
                  <Text style={[s.badgeText, { color: tokens.textMuted }]}>
                    {formatStr(tpl.slotsLabel, { count: tmpl.slotCount })}
                  </Text>
                </View>
                {tmpl.recommendMultiAgent ? (
                  <View style={[s.badge, { backgroundColor: tokens.brandDim }]}>
                    <Text style={[s.badgeText, { color: tokens.brand }]}>{tpl.multiAgentHint}</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {fullTemplate ? (
        <View style={[s.card, { backgroundColor: tokens.bgInput, borderColor: tokens.border, gap: 8 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <Text style={[s.cardTitle, { color: tokens.textPrimary }]}>
              {pickTemplateLabel(fullTemplate, locale, "name")}
            </Text>
            {fbStats && fbStats.total > 0 ? (
              <View style={[s.badge, { backgroundColor: tokens.bgSecondary }]}>
                <Text style={[s.badgeText, { color: tokens.success }]}>
                  {formatStr(tpl.feedbackChip, {
                    pct: Math.round((fbStats.ratio ?? 0) * 100),
                    count: fbStats.total,
                  })}
                </Text>
              </View>
            ) : null}
          </View>
          <SlotTree template={fullTemplate} tokens={tokens} tpl={tpl} locale={locale} />
        </View>
      ) : null}
    </View>
  );
}

/** Árbol nativo de slots (indentado por profundidad de `parentSlotId`). */
function SlotTree({
  template,
  tokens,
  tpl,
  locale,
}: {
  template: TeamTemplate;
  tokens: ThemeTokens;
  tpl: TemplatesStrings;
  locale?: string;
}) {
  const byId = useMemo(() => new Map(template.slots.map((sl) => [sl.slotId, sl])), [template]);
  const depthOf = (slot: TeamTemplateSlot): number => {
    let d = 0;
    let p = slot.parentSlotId;
    const seen = new Set<string>();
    while (p && byId.has(p) && !seen.has(p)) {
      seen.add(p);
      d++;
      p = byId.get(p)!.parentSlotId;
    }
    return d;
  };
  return (
    <View style={{ gap: 4 }}>
      {template.slots.map((slot) => {
        const depth = depthOf(slot);
        const isRoot = slot.parentSlotId === null;
        return (
          <View
            key={slot.slotId}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, marginLeft: depth * 16 }}
          >
            <AgentAvatar config={slot.avatarConfig} seed={slot.slotId} size={24} tokens={tokens} />
            <Text style={[s.cardDesc, { color: tokens.textSecondary, flex: 1 }]} numberOfLines={1}>
              {pickSlotLabel(slot, template, locale, "name")}
            </Text>
            {isRoot ? (
              <View style={[s.badge, { backgroundColor: tokens.bgSecondary }]}>
                <Text style={[s.badgeText, { color: tokens.success }]}>{tpl.ceoBadge}</Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

// ── Paso 4: personalizar por slot ────────────────────────────────────────────

export function StepCustomize({
  template,
  overrides,
  onChange,
  onReset,
  tokens,
  tpl,
  locale,
}: {
  template: TeamTemplate;
  overrides: SlotOverrides;
  onChange: (slotId: string, patch: Partial<ApplySlotOverrides>) => void;
  onReset: (slotId: string) => void;
  tokens: ThemeTokens;
  tpl: TemplatesStrings;
  locale?: string;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={[s.cardTitle, { color: tokens.textPrimary }]}>{tpl.customizeHeading}</Text>
      <Text style={[s.cardDesc, { color: tokens.textMuted }]}>{tpl.customizeHint}</Text>
      {template.slots.map((slot) => (
        <SlotCard
          key={slot.slotId}
          slot={slot}
          template={template}
          ov={overrides[slot.slotId] ?? {}}
          onChange={(patch) => onChange(slot.slotId, patch)}
          onReset={() => onReset(slot.slotId)}
          tokens={tokens}
          tpl={tpl}
          locale={locale}
        />
      ))}
    </View>
  );
}

function SlotCard({
  slot,
  template,
  ov,
  onChange,
  onReset,
  tokens,
  tpl,
  locale,
}: {
  slot: TeamTemplateSlot;
  template: TeamTemplate;
  ov: ApplySlotOverrides;
  onChange: (patch: Partial<ApplySlotOverrides>) => void;
  onReset: () => void;
  tokens: ThemeTokens;
  tpl: TemplatesStrings;
  locale?: string;
}) {
  const isRoot = slot.parentSlotId === null;
  const defaultName = pickSlotLabel(slot, template, locale, "name");
  const defaultDesc = pickSlotLabel(slot, template, locale, "description");
  const defaultPrompt = pickSlotLabel(slot, template, locale, "systemPrompt");
  const effectiveAvatar = ov.avatarConfig ?? slot.avatarConfig;
  const modelOptions = ov.providerId ? PROVIDER_MODELS[ov.providerId] ?? [] : [];
  const dirty = Object.keys(ov).length > 0;

  const providerSelectOptions = [
    { value: "", label: tpl.providerNone },
    ...PROVIDER_OPTIONS.map((p) => ({ value: p, label: PROVIDER_META[p]?.label ?? p })),
  ];
  const modelSelectOptions = [
    { value: "", label: ov.providerId ? tpl.overrideModelPlaceholder : tpl.overrideModelNoProvider },
    ...modelOptions.map((m) => ({ value: m, label: m })),
  ];

  return (
    <View style={[s.card, { backgroundColor: tokens.bgInput, borderColor: tokens.border, gap: 8 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <AgentAvatar config={effectiveAvatar} seed={slot.slotId} size={32} tokens={tokens} />
        <View style={{ flex: 1 }}>
          <Text style={[s.cardTitle, { color: tokens.textPrimary }]} numberOfLines={1}>
            {ov.name ?? defaultName}
          </Text>
          <Text style={[s.cardDesc, { color: tokens.textMuted }]} numberOfLines={2}>
            {ov.description ?? defaultDesc}
          </Text>
        </View>
        {isRoot ? (
          <View style={[s.badge, { backgroundColor: tokens.bgSecondary }]}>
            <Text style={[s.badgeText, { color: tokens.success }]}>{tpl.ceoBadge}</Text>
          </View>
        ) : null}
      </View>

      {/* Avatar override */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={[s.fieldLabel, { color: tokens.textMuted, marginBottom: 0 }]}>{tpl.overrideAvatar}</Text>
        <Button size="sm" variant="ghost" label={tpl.overrideAvatarClear} onPress={() => onChange({ avatarConfig: undefined })} />
        <Button
          size="sm"
          variant="ghost"
          label={tpl.overrideAvatarRandom}
          onPress={() => onChange({ avatarConfig: { seed: randomAvatarSeed() } })}
        />
      </View>

      <Input
        label={tpl.overrideName}
        value={ov.name ?? defaultName}
        onChangeText={(v) => onChange({ name: v === defaultName ? undefined : v || undefined })}
      />

      <View style={s.field}>
        <Text style={[s.fieldLabel, { color: tokens.textMuted }]}>{tpl.overrideProvider}</Text>
        <Select
          value={ov.providerId ?? ""}
          options={providerSelectOptions}
          placeholder={tpl.providerNone}
          onChange={(v) => onChange({ providerId: (v || undefined) as AssistantProviderId | undefined, model: undefined })}
        />
      </View>

      <View style={s.field}>
        <Text style={[s.fieldLabel, { color: tokens.textMuted }]}>{tpl.overrideModel}</Text>
        <Select
          value={ov.model ?? ""}
          options={modelSelectOptions}
          placeholder={ov.providerId ? tpl.overrideModelPlaceholder : tpl.overrideModelNoProvider}
          onChange={(v) => onChange({ model: v || undefined })}
        />
      </View>

      <Input
        label={tpl.multiAgentCopiesLabel}
        value={ov.multiAgentCount != null ? String(ov.multiAgentCount) : slot.multiAgentCount != null ? String(slot.multiAgentCount) : ""}
        onChangeText={(v) => {
          const n = parseInt(v, 10);
          onChange({ multiAgentCount: Number.isFinite(n) && n > 0 ? n : undefined });
        }}
        keyboardType="number-pad"
        placeholder="3"
      />

      <Input
        label={tpl.overrideDescription}
        value={ov.description ?? defaultDesc}
        onChangeText={(v) => onChange({ description: v === defaultDesc ? undefined : v.slice(0, 500) || undefined })}
        multiline
        maxLength={500}
      />

      <Input
        label={tpl.overrideSystemPrompt}
        value={ov.systemPrompt ?? defaultPrompt}
        onChangeText={(v) => onChange({ systemPrompt: v === defaultPrompt ? undefined : v.slice(0, 20000) || undefined })}
        multiline
        maxLength={20000}
      />

      <ProjectPathsEditor
        value={ov.projectPaths ?? template.defaultProjectPaths ?? []}
        onChange={(paths) => onChange({ projectPaths: paths })}
        tokens={tokens}
        tpl={tpl}
      />

      {dirty ? (
        <Button size="sm" variant="ghost" label={tpl.resetToDefaultsBtn} onPress={onReset} />
      ) : null}
    </View>
  );
}

function ProjectPathsEditor({
  value,
  onChange,
  tokens,
  tpl,
}: {
  value: string[];
  onChange: (paths: string[]) => void;
  tokens: ThemeTokens;
  tpl: TemplatesStrings;
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const p = draft.trim();
    if (!p || value.includes(p)) return;
    onChange([...value, p]);
    setDraft("");
  }
  return (
    <View style={s.field}>
      <Text style={[s.fieldLabel, { color: tokens.textMuted }]}>{tpl.overrideProjectPaths}</Text>
      {value.map((p) => (
        <View key={p} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Text style={[s.mono, { color: tokens.textSecondary, flex: 1 }]} numberOfLines={1}>
            {p}
          </Text>
          <Pressable onPress={() => onChange(value.filter((x) => x !== p))} hitSlop={6}>
            <X size={16} color={tokens.textMuted} />
          </Pressable>
        </View>
      ))}
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Input value={draft} onChangeText={setDraft} placeholder={tpl.pathPlaceholder} onSubmitEditing={add} />
        </View>
        <Button size="sm" variant="secondary" label={tpl.addPathBtn} onPress={add} disabled={!draft.trim()} />
      </View>
    </View>
  );
}

// ── Paso 5: confirmar ────────────────────────────────────────────────────────

export function StepConfirm({
  template,
  namePrefix,
  onChangePrefix,
  overrides,
  tokens,
  tpl,
  locale,
}: {
  template: TeamTemplate;
  namePrefix: string;
  onChangePrefix: (v: string) => void;
  overrides: SlotOverrides;
  tokens: ThemeTokens;
  tpl: TemplatesStrings;
  locale?: string;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={[s.cardTitle, { color: tokens.textPrimary }]}>{tpl.confirmHeading}</Text>
      <Text style={[s.cardDesc, { color: tokens.textMuted }]}>{tpl.confirmHint}</Text>
      <View style={[s.card, { backgroundColor: tokens.bgInput, borderColor: tokens.border, gap: 6 }]}>
        {template.slots.map((slot) => {
          const ov = overrides[slot.slotId] ?? {};
          const slotName = pickSlotLabel(slot, template, locale, "name");
          const finalName = namePrefix.trim()
            ? `${namePrefix.trim().slice(0, 60)} · ${ov.name ?? slotName}`
            : ov.name ?? slotName;
          return (
            <View key={slot.slotId} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <AgentAvatar config={ov.avatarConfig ?? slot.avatarConfig} seed={slot.slotId} size={20} tokens={tokens} />
              <Text style={[s.cardDesc, { color: tokens.textSecondary, flex: 1 }]} numberOfLines={1}>
                {finalName}
              </Text>
              {ov.providerId ? (
                <View style={[s.badge, { backgroundColor: tokens.bgSecondary }]}>
                  <Text style={[s.badgeText, { color: tokens.textMuted }]}>{ov.providerId}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <Input
        label={tpl.namePrefixLabel}
        value={namePrefix}
        onChangeText={(v) => onChangePrefix(v.slice(0, 60))}
        placeholder={tpl.namePrefixPlaceholder}
        maxLength={60}
        hint={tpl.namePrefixHint}
      />

      <Text style={[s.cardDesc, { color: tokens.textMuted }]}>
        {formatStr(tpl.willCreate, { count: template.slots.length })} · {tpl.rootCanSpawnHint}
      </Text>
    </View>
  );
}
