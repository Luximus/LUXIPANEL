import { FormDrawer } from "../../ui/FormDrawer";
// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * TeamTemplatesModal (RN) — "Grupos rápidos de agentes". Réplica nativa del
 * asistente de plantillas de equipo del web (WEB/TeamTemplatesModal.tsx).
 *
 * Dos modos:
 *  1. ASISTENTE (por defecto): flujo de 5 pasos — categoría → tipos → galería +
 *     vista previa (jerarquía de slots + feedback agregado) → personalizar por
 *     slot → confirmar. Materializa agentes reales vía `teamTemplatesApi.apply`.
 *  2. RESYNC (`resyncTarget` presente): compara un equipo ya creado con su
 *     plantilla y crea los agentes que falten (`resync` + `applyMissing`).
 *
 * Toda la red pasa por `teamTemplatesApi` (túnel SSO). Los strings del asistente
 * y los helpers de traducción viven en `./team-templates-i18n`; los pasos del
 * asistente en `./TeamTemplatesSteps`; el modo resync en `./TeamTemplatesResync`
 * (subconjunto de `TeamTemplatesMessages` del web, es/en con fallback es). Los
 * strings de resync sí viven en `AgentsStrings.resync` (prop `str`).
 */
import React, { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Button } from "../../ui/Button";
import { s } from "../styles";
import type { ThemeTokens } from "../../../theme/colors";
import type {
  ApplyRequest,
  ApplySlotOverrides,
  TeamTemplate,
  TeamTemplateCategory,
  TeamTemplateCategoryDef,
  TeamTemplateFeedbackStats,
  TeamTemplateSummary,
} from "../types";
import type { AgentsStrings } from "./agents-i18n";
import { teamTemplatesApi } from "./agents-api";
import {
  type SlotOverrides,
  type TemplatesStrings,
  tplStrings,
} from "./team-templates-i18n";
import { StepCategory, StepConfirm, StepCustomize, StepPreview, StepTags } from "./TeamTemplatesSteps";
import { ResyncView } from "./TeamTemplatesResync";

// ── Componente principal ─────────────────────────────────────────────────────

export function TeamTemplatesModal({
  visible,
  panelId,
  token,
  onApplied,
  onClose,
  tokens,
  str,
  language,
  resyncTarget,
}: {
  visible: boolean;
  panelId: string;
  token: string;
  /** Tras aplicar (o resync) con éxito: ids de agentes creados. */
  onApplied: (createdIds: string[]) => void;
  onClose: () => void;
  tokens: ThemeTokens;
  str: AgentsStrings;
  language?: string;
  /** Presente = modo RESYNC de un equipo existente con su plantilla. */
  resyncTarget?: { templateId: string; rootAgentId: string; teamName?: string } | null;
}) {
  const tpl = tplStrings(language);
  const locale = language;

  if (resyncTarget) {
    return (
      <ResyncView
        visible={visible}
        panelId={panelId}
        token={token}
        target={resyncTarget}
        onApplied={onApplied}
        onClose={onClose}
        tokens={tokens}
        str={str}
        language={language}
      />
    );
  }

  return (
    <WizardView
      visible={visible}
      panelId={panelId}
      token={token}
      onApplied={onApplied}
      onClose={onClose}
      tokens={tokens}
      tpl={tpl}
      locale={locale}
      language={language}
    />
  );
}

// ── Asistente de creación ────────────────────────────────────────────────────

function WizardView({
  visible,
  panelId,
  token,
  onApplied,
  onClose,
  tokens,
  tpl,
  locale,
  language,
}: {
  visible: boolean;
  panelId: string;
  token: string;
  onApplied: (createdIds: string[]) => void;
  onClose: () => void;
  tokens: ThemeTokens;
  tpl: TemplatesStrings;
  locale?: string;
  language?: string;
}) {
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<TeamTemplateCategoryDef[]>([]);
  const [templates, setTemplates] = useState<TeamTemplateSummary[]>([]);
  const [pickedCategory, setPickedCategory] = useState<TeamTemplateCategory | null>(null);
  const [pickedTags, setPickedTags] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [pickedTemplateId, setPickedTemplateId] = useState<string | null>(null);
  const [pickedTemplate, setPickedTemplate] = useState<TeamTemplate | null>(null);
  const [slotOverrides, setSlotOverrides] = useState<SlotOverrides>({});
  const [namePrefix, setNamePrefix] = useState("");
  const [applying, setApplying] = useState(false);
  const [fbStats, setFbStats] = useState<TeamTemplateFeedbackStats | null>(null);

  // Reset al abrir.
  useEffect(() => {
    if (!visible) return;
    setStep(0);
    setPickedCategory(null);
    setPickedTags([]);
    setTagSearch("");
    setPickedTemplateId(null);
    setPickedTemplate(null);
    setSlotOverrides({});
    setNamePrefix("");
    setError(null);
  }, [visible]);

  // Carga la lista una vez al abrir.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    teamTemplatesApi
      .list(panelId, token)
      .then(({ categories: c, templates: ts }) => {
        if (cancelled) return;
        setCategories(c);
        setTemplates(ts);
        setError(null);
      })
      .catch(() => !cancelled && setError(tpl.loadFailed))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [visible, panelId, token, tpl.loadFailed]);

  // Carga la plantilla completa al elegir una.
  useEffect(() => {
    if (!pickedTemplateId) {
      setPickedTemplate(null);
      return;
    }
    let cancelled = false;
    teamTemplatesApi
      .get(panelId, token, pickedTemplateId)
      .then((full) => {
        if (cancelled) return;
        setPickedTemplate(full);
        setSlotOverrides({});
      })
      .catch(() => !cancelled && setError(tpl.loadFailed));
    return () => {
      cancelled = true;
    };
  }, [pickedTemplateId, panelId, token, tpl.loadFailed]);

  // Feedback agregado de la plantilla elegida (perezoso).
  useEffect(() => {
    setFbStats(null);
    if (!pickedTemplate?.id) return;
    let alive = true;
    teamTemplatesApi
      .feedbackStats(panelId, token, pickedTemplate.id)
      .then((st) => alive && setFbStats(st))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [pickedTemplate?.id, panelId, token]);

  const visibleTags = useMemo(() => {
    if (!pickedCategory) return [];
    const cat = categories.find((c) => c.id === pickedCategory);
    if (!cat) return [];
    const q = tagSearch.trim().toLowerCase();
    return cat.tags.filter((tag) => !q || tag.label.toLowerCase().includes(q));
  }, [pickedCategory, categories, tagSearch]);

  const matchingTemplates = useMemo(() => {
    if (!pickedCategory) return [];
    return templates.filter((tmpl) => {
      if (tmpl.category !== pickedCategory) return false;
      if (pickedTags.length === 0) return true;
      return pickedTags.some((tag) => tmpl.tags.includes(tag));
    });
  }, [pickedCategory, pickedTags, templates]);

  function toggleTag(tagId: string) {
    setPickedTags((cur) => (cur.includes(tagId) ? cur.filter((x) => x !== tagId) : [...cur, tagId]));
  }

  function updateOverride(slotId: string, patch: Partial<ApplySlotOverrides>) {
    setSlotOverrides((cur) => ({ ...cur, [slotId]: { ...(cur[slotId] ?? {}), ...patch } }));
  }

  function resetOverride(slotId: string) {
    setSlotOverrides((cur) => {
      const next = { ...cur };
      delete next[slotId];
      return next;
    });
  }

  function canAdvance(): boolean {
    if (step === 0) return Boolean(pickedCategory);
    if (step === 1) return matchingTemplates.length > 0;
    if (step === 2) return Boolean(pickedTemplate);
    return true;
  }

  async function submit() {
    if (!pickedTemplate || applying) return;
    setApplying(true);
    setError(null);
    const body: ApplyRequest = {
      slotOverrides: Object.keys(slotOverrides).length > 0 ? slotOverrides : undefined,
      namePrefix: namePrefix.trim() || undefined,
    };
    const result = await teamTemplatesApi.apply(panelId, token, pickedTemplate.id, body);
    setApplying(false);
    if (!result) {
      setError(tpl.applyFailed);
      return;
    }
    onApplied(result.createdIds);
    onClose();
  }

  const stepLabels = [tpl.stepCategory, tpl.stepTags, tpl.stepPreview, tpl.stepCustomize, tpl.stepConfirm];

  return (
    <FormDrawer
      visible={visible}
      onClose={onClose}
      title={tpl.modalTitle}
      language={language}
      fillHeight
      footer={
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Button
            size="sm"
            variant="ghost"
            label={step === 0 ? tpl.cancelBtn : tpl.backBtn}
            onPress={() => (step === 0 ? onClose() : setStep((v) => (v - 1) as 0 | 1 | 2 | 3 | 4))}
            disabled={applying}
          />
          {step < 4 ? (
            <Button
              size="sm"
              variant="primary"
              label={tpl.nextBtn}
              onPress={() => canAdvance() && setStep((v) => (v + 1) as 0 | 1 | 2 | 3 | 4)}
              disabled={!canAdvance()}
            />
          ) : (
            <Button
              size="sm"
              variant="primary"
              label={applying ? tpl.creating : tpl.createBtn}
              onPress={submit}
              loading={applying}
              disabled={!pickedTemplate}
            />
          )}
        </View>
      }
    >
      {/* Stepper */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {stepLabels.map((label, i) => (
          <View
            key={label}
            style={[
              s.badge,
              {
                backgroundColor: i === step ? tokens.brandDim : "transparent",
                borderWidth: 1,
                borderColor: i === step ? tokens.borderBrand : tokens.border,
              },
            ]}
          >
            <Text style={[s.badgeText, { color: i === step ? tokens.brand : tokens.textMuted }]}>
              {i + 1}. {label}
            </Text>
          </View>
        ))}
      </View>

      {loading ? (
        <Text style={[s.cardDesc, { color: tokens.textMuted }]}>…</Text>
      ) : null}
      {error ? (
        <View style={[s.card, { backgroundColor: tokens.bgInput, borderColor: tokens.danger, marginBottom: 10 }]}>
          <Text style={[s.cardDesc, { color: tokens.danger }]}>{error}</Text>
        </View>
      ) : null}

      {!loading && step === 0 ? (
        <StepCategory
          categories={categories}
          picked={pickedCategory}
          onPick={(c) => {
            setPickedCategory(c);
            setPickedTags([]);
            setTagSearch("");
            setPickedTemplateId(null);
          }}
          tokens={tokens}
          tpl={tpl}
        />
      ) : null}

      {!loading && step === 1 && pickedCategory ? (
        <StepTags
          tags={visibleTags}
          tagSearch={tagSearch}
          onSearch={setTagSearch}
          pickedTags={pickedTags}
          onToggle={toggleTag}
          matchingCount={matchingTemplates.length}
          tokens={tokens}
          tpl={tpl}
        />
      ) : null}

      {!loading && step === 2 ? (
        <StepPreview
          templates={matchingTemplates}
          pickedId={pickedTemplateId}
          onPick={setPickedTemplateId}
          fullTemplate={pickedTemplate}
          fbStats={fbStats}
          tokens={tokens}
          tpl={tpl}
          locale={locale}
        />
      ) : null}

      {!loading && step === 3 && pickedTemplate ? (
        <StepCustomize
          template={pickedTemplate}
          overrides={slotOverrides}
          onChange={updateOverride}
          onReset={resetOverride}
          tokens={tokens}
          tpl={tpl}
          locale={locale}
        />
      ) : null}

      {!loading && step === 4 && pickedTemplate ? (
        <StepConfirm
          template={pickedTemplate}
          namePrefix={namePrefix}
          onChangePrefix={setNamePrefix}
          overrides={slotOverrides}
          tokens={tokens}
          tpl={tpl}
          locale={locale}
        />
      ) : null}
    </FormDrawer>
  );
}
