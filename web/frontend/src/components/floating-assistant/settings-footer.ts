// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Footer-action bridge for the AI Assistant settings modal: a section (e.g. the
 * agent editor inside AgentsTab) publishes its primary action here and the
 * modal renders it in the bottom bar next to "Close". Lives in its own file so
 * AgentsTab doesn't import AssistantSettingsModal (circular import).
 */
import { createContext, useContext } from "react";

export interface SettingsFooterAction {
  /** Button label — already localized by the publishing section. */
  label: string;
  onClick(): void;
  disabled?: boolean;
}

export const SettingsFooterContext = createContext<((action: SettingsFooterAction | null) => void) | null>(null);

/** Setter for the modal footer's primary action; null outside the modal. */
export function useSettingsFooterAction() {
  return useContext(SettingsFooterContext);
}

/**
 * Header override for the settings modal: a section (e.g. the agent editor
 * inside AgentsTab) publishes a title/description + a custom back handler so
 * the modal header reflects the sub-view AND the header's back arrow cancels
 * the sub-view instead of leaving the section. Cleared (null) when the
 * sub-view closes, restoring the section's own title/back behaviour.
 */
export interface SettingsHeaderOverride {
  /** Modal header title while the sub-view is open. */
  title: string;
  /** Modal header subtitle/description while the sub-view is open. */
  description?: string;
  /** Optional label for the header back button (defaults to the section one). */
  backLabel?: string;
  /** Invoked by the header back arrow instead of leaving the section. */
  onBack(): void;
}

export const SettingsHeaderContext = createContext<((override: SettingsHeaderOverride | null) => void) | null>(null);

/** Setter for the modal header override; null outside the modal. */
export function useSettingsHeaderOverride() {
  return useContext(SettingsHeaderContext);
}
