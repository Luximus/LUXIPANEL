// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * "Grupos rápidos de agentes" — wizard modal.
 *
 * 5-step flow:
 *   1. Pick a category (web/app/desktop/…)
 *   2. Pick tags (filtered by category)
 *   3. Pick a template (preview with Mermaid hierarchy)
 *   4. Customise per-slot (name, provider, model, paths…)
 *   5. Confirm + create
 *
 * Materialises into real `AssistantAgent` records via
 * `assistantTeamTemplatesApi.apply()`. Reuses the visual palette, lucide
 * icons and avatar set already used in AgentsTab.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  assistantTeamTemplatesApi,
  type ApplyRequest,
  type ApplySlotOverrides,
  type TeamTemplate,
  type TeamTemplateCategory,
  type TeamTemplateCategoryDef,
  type TeamTemplateSummary,
} from "./assistant-api";
import { ModalNavbar } from "@/components/ui/ModalNavbar";
import { drawerCardClass, backdropMotionClass } from "@/components/ui/ModalShell";
import { useDeferredClose } from "@/components/ui/use-deferred-close";
import { ViewTransition, useViewDirection } from "@/components/ui/ViewTransition";
import { cn } from "@/lib/utils";
import { useEscapeToClose } from "@/lib/use-escape-to-close";
import { openConfirm } from "@/lib/confirm";
import { useAssistantI18n } from "./i18n";
import { type SlotOverrides } from "./team-templates-modal/constants";
import { categoryLabel } from "./team-templates-modal/labels";
import {
  StepCategory,
  StepTags,
  StepPreview,
  StepCustomize,
  StepConfirm,
} from "./team-templates-modal/steps";

interface Props {
  onClose(): void;
  /** Called after a successful apply so the parent can reload its list. */
  onCreated(agentIds: string[]): void;
  /**
   * Active platform locale (ISO 639-1: "es" | "en" | "fr" | …). Drives which
   * translation we read out of `template.translations[locale]` for names,
   * descriptions and per-slot systemPrompts. Falls back to the seed Spanish
   * strings when the locale has no entry.
   */
  locale?: string;
}

const WIZARD_STEPS = [0, 1, 2, 3, 4] as const;

export function TeamTemplatesModal({ onClose: onCloseProp, onCreated, locale }: Props) {
  // Exit animation (200ms ease-out) before the parent unmounts the wizard.
  const { closing, requestClose: playExit } = useDeferredClose(onCloseProp);
  const onClose = useCallback(() => playExit(), [playExit]);
  const msgs = useAssistantI18n();
  const t = msgs.teamTemplates;

  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  // Transición entre pasos del asistente: avanzar entra desde la derecha,
  // retroceder desde la izquierda (preset de vista de motion.css).
  const stepDirection = useViewDirection(step, WIZARD_STEPS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Escape closes the wizard. On the first step there's nothing to lose, so it
  // dismisses directly; past that we confirm to avoid discarding multi-step
  // progress (the reason this modal opts out of ModalShell's backdrop dismiss).
  const requestClose = useCallback(() => {
    if (step === 0) { onClose(); return; }
    void openConfirm(t.discardConfirm, { variant: "danger" }).then((ok) => { if (ok) onClose(); });
  }, [step, onClose, t.discardConfirm]);
  useEscapeToClose(requestClose);

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

  // Fetch list once.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    assistantTeamTemplatesApi
      .list()
      .then(({ categories: c, templates: ts }) => {
        if (cancelled) return;
        setCategories(c);
        setTemplates(ts);
        setError(null);
      })
      .catch((e) => !cancelled && setError((e as Error).message || t.errors.loadFailed))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [t.errors.loadFailed]);

  // Fetch full template (with systemPrompts) when the user picks one.
  useEffect(() => {
    if (!pickedTemplateId) {
      setPickedTemplate(null);
      return;
    }
    let cancelled = false;
    assistantTeamTemplatesApi
      .get(pickedTemplateId)
      .then((full) => {
        if (cancelled) return;
        setPickedTemplate(full);
        setSlotOverrides({}); // reset overrides when template changes
      })
      .catch((e) => !cancelled && setError((e as Error).message || t.errors.loadFailed));
    return () => {
      cancelled = true;
    };
  }, [pickedTemplateId, t.errors.loadFailed]);

  // Step 1: filter categories by user click; reset tag selection on category change.
  const visibleTags = useMemo(() => {
    if (!pickedCategory) return [];
    const cat = categories.find((c) => c.id === pickedCategory);
    if (!cat) return [];
    const q = tagSearch.trim().toLowerCase();
    return cat.tags.filter((tag) => !q || tag.label.toLowerCase().includes(q));
  }, [pickedCategory, categories, tagSearch]);

  // Step 2: filter templates that match the picked category and (any) selected tag.
  const matchingTemplates = useMemo(() => {
    if (!pickedCategory) return [];
    return templates.filter((tmpl) => {
      if (tmpl.category !== pickedCategory) return false;
      if (pickedTags.length === 0) return true;
      return pickedTags.some((tag) => tmpl.tags.includes(tag));
    });
  }, [pickedCategory, pickedTags, templates]);

  function toggleTag(tagId: string) {
    setPickedTags((cur) => (cur.includes(tagId) ? cur.filter((t) => t !== tagId) : [...cur, tagId]));
  }

  function updateSlotOverride(slotId: string, patch: Partial<ApplySlotOverrides>) {
    setSlotOverrides((cur) => ({
      ...cur,
      [slotId]: { ...(cur[slotId] ?? {}), ...patch },
    }));
  }

  function resetSlotOverride(slotId: string) {
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
    if (step === 3) return Boolean(pickedTemplate);
    return true;
  }

  async function submit() {
    if (!pickedTemplate) return;
    setApplying(true);
    setError(null);
    try {
      const body: ApplyRequest = {
        slotOverrides: Object.keys(slotOverrides).length > 0 ? slotOverrides : undefined,
        namePrefix: namePrefix.trim() || undefined,
      };
      const result = await assistantTeamTemplatesApi.apply(pickedTemplate.id, body);
      onCreated(result.createdIds);
      onClose();
    } catch (e) {
      const err = e as Error & { createdIds?: string[] };
      // Partial failure: the backend's TEMPLATE_APPLY_FAILED returns the ids
      // already created so the parent can offer a cleanup button.
      const created = (err as unknown as { createdIds?: string[] }).createdIds;
      if (Array.isArray(created) && created.length > 0) {
        onCreated(created);
      }
      setError(err.message || t.errors.applyFailed);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-templates-title"
      className={cn("fixed inset-0 z-50 bg-black/40", backdropMotionClass(closing), closing && "pointer-events-none")}
    >
      {/* Right drawer card — kept local (not ModalShell) because the wizard has
          NO backdrop/Escape dismiss on purpose (avoid losing multi-step
          progress). Same drawer metrics as ModalShell, rounded on its inner
          (left) edge. */}
      <div className={cn("absolute overflow-hidden text-card-foreground shadow-xl", drawerCardClass(closing))}>
        <ModalNavbar
          title={<span id="team-templates-title">{t.modalTitle}</span>}
          description={t.modalSubtitle}
          onClose={onClose}
          closeLabel={t.cancelBtn}
        />

        {/* Stepper */}
        <ol className="flex items-center gap-1.5 border-b border-border bg-muted/30 px-4 py-2 text-[11px]">
          {[t.steps.category, t.steps.tags, t.steps.preview, t.steps.customize, t.steps.confirm].map(
            (label, i) => (
              <li
                key={label}
                aria-current={i === step ? "step" : undefined}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 ${
                  i === step
                    ? "bg-primary/10 font-medium text-primary"
                    : i < step
                      ? "text-muted-foreground"
                      : "text-muted-foreground/60"
                }`}
              >
                <span className="font-mono">{i + 1}.</span> {label}
              </li>
            ),
          )}
        </ol>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loading && <p className="text-xs text-muted-foreground">…</p>}
          {error && step <= 2 && (
            <p className="mb-3 rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-600">{error}</p>
          )}
          <ViewTransition viewKey={loading ? "loading" : step} direction={stepDirection}>

          {!loading && step === 0 && (
            <StepCategory
              categories={categories}
              picked={pickedCategory}
              onPick={(c) => {
                setPickedCategory(c);
                setPickedTags([]);
                setTagSearch("");
                setPickedTemplateId(null);
              }}
              t={t}
            />
          )}

          {!loading && step === 1 && pickedCategory && (
            <StepTags
              tags={visibleTags}
              tagSearch={tagSearch}
              onSearch={setTagSearch}
              pickedTags={pickedTags}
              onToggle={toggleTag}
              matchingCount={matchingTemplates.length}
              categoryLabel={categoryLabel(categories, pickedCategory)}
              t={t}
            />
          )}

          {!loading && step === 2 && (
            <StepPreview
              templates={matchingTemplates}
              pickedId={pickedTemplateId}
              onPick={setPickedTemplateId}
              fullTemplate={pickedTemplate}
              t={t}
              locale={locale}
            />
          )}

          {!loading && step === 3 && pickedTemplate && (
            <StepCustomize
              template={pickedTemplate}
              overrides={slotOverrides}
              onChange={updateSlotOverride}
              onReset={resetSlotOverride}
              t={t}
              locale={locale}
            />
          )}

          {!loading && step === 4 && pickedTemplate && (
            <StepConfirm
              template={pickedTemplate}
              namePrefix={namePrefix}
              onChangePrefix={setNamePrefix}
              overrides={slotOverrides}
              t={t}
              locale={locale}
            />
          )}
          </ViewTransition>

          {error && step >= 3 && (
            <p className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-600">{error}</p>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-border bg-muted/30 px-4 py-3">
          <button
            type="button"
            onClick={step === 0 ? onClose : () => setStep((s) => (s - 1) as 0 | 1 | 2 | 3 | 4)}
            className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/50"
          >
            <i className="ti ti-arrow-left" aria-hidden></i>{" "}
            {step === 0 ? t.cancelBtn : t.backBtn}
          </button>
          {step < 4 ? (
            <button
              type="button"
              onClick={() => canAdvance() && setStep((s) => (s + 1) as 0 | 1 | 2 | 3 | 4)}
              disabled={!canAdvance()}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              {t.nextBtn} <i className="ti ti-arrow-right" aria-hidden></i>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void submit()}
              disabled={applying || !pickedTemplate}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              {applying ? t.creating : t.createBtn}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

// ── Step components ────────────────────────────────────────────────────────

