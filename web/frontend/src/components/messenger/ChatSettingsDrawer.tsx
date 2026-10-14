// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Bloque E — "Ajustes de mensajería". Same recipe as
 * `AssistantSettingsModal`: a wide `ModalShell` + `DrawerSectionNav` rail on
 * the left and the active section on the right, animated with the panel's view
 * transition preset.
 *
 * There is no Save button: every control autosaves (optimistic local write →
 * PUT → rollback + toast on failure).
 */
import { useCallback } from "react";
import { DrawerSectionNav } from "@/components/ui/DrawerSectionNav";
import { ModalShell } from "@/components/ui/ModalShell";
import { ViewTransition, useViewDirection } from "@/components/ui/ViewTransition";
import { showToast } from "@/lib/toast";
import { chatPrefs, useChatPrefs, type DeepPartialChatPrefs } from "./chat-prefs";
import { useChatI18n } from "./i18n";
import { GeneralSection } from "./settings/GeneralSection";
import { PresenceSection } from "./settings/PresenceSection";
import { CallsSection } from "./settings/CallsSection";
import { AppearanceSection } from "./settings/AppearanceSection";
import { GroupsSettingsSection } from "./settings/GroupsSettingsSection";

export type ChatSettingsSection = "general" | "presence" | "calls" | "appearance" | "groups";

export const CHAT_SETTINGS_ORDER: readonly ChatSettingsSection[] = [
  "general",
  "presence",
  "calls",
  "appearance",
  "groups",
];

const SECTION_ICONS: Record<ChatSettingsSection, string> = {
  general: "ti-adjustments-horizontal",
  presence: "ti-user-check",
  calls: "ti-phone",
  appearance: "ti-palette",
  groups: "ti-users-group",
};

export function isChatSettingsSection(value: string | null | undefined): value is ChatSettingsSection {
  return !!value && (CHAT_SETTINGS_ORDER as readonly string[]).includes(value);
}

export function ChatSettingsDrawer({
  section,
  onSectionChange,
  onClose,
  isAdmin = false,
}: {
  section: ChatSettingsSection;
  onSectionChange: (next: ChatSettingsSection) => void;
  onClose: () => void;
  /** Gobierna solo el enlace "Ajustes → Credenciales" del badge de Tolqia. */
  isAdmin?: boolean;
}) {
  const t = useChatI18n();
  const prefs = useChatPrefs();
  const direction = useViewDirection(section, CHAT_SETTINGS_ORDER);

  const items = CHAT_SETTINGS_ORDER.map((id) => ({
    id,
    label: t.settings.tabs[id],
    icon: SECTION_ICONS[id],
  }));

  const change = useCallback(
    (patch: DeepPartialChatPrefs) => {
      void chatPrefs.save(patch).then((ok) => {
        showToast(ok ? t.settings.saved : t.settings.saveError, ok);
      });
    },
    [t.settings.saved, t.settings.saveError],
  );

  const onProfileSaved = useCallback(
    (ok: boolean) => showToast(ok ? t.settings.saved : t.settings.saveError, ok),
    [t.settings.saved, t.settings.saveError],
  );

  return (
    <ModalShell
      onClose={onClose}
      cardClassName="w-[min(96vw,68rem)] max-lg:w-[85vw] max-sm:w-full"
      icon="ti-settings"
      title={t.settings.title}
      description={t.settings.description}
      closeLabel={t.close}
      bodyClassName="overflow-hidden p-0"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
        >
          {t.close}
        </button>
      }
    >
      <div className="flex h-full min-h-0">
        <DrawerSectionNav items={items} activeId={section} onSelect={(id) => onSectionChange(id as ChatSettingsSection)} />
        <div className="min-w-0 flex-1 overflow-y-auto px-0 py-5 @xl:px-6 @container">
          <ViewTransition viewKey={section} direction={direction}>
            {section === "general" && <GeneralSection prefs={prefs} onChange={change} />}
            {section === "presence" && <PresenceSection onSaved={onProfileSaved} />}
            {section === "calls" && <CallsSection prefs={prefs} onChange={change} isAdmin={isAdmin} />}
            {section === "appearance" && <AppearanceSection prefs={prefs} onChange={change} />}
            {section === "groups" && <GroupsSettingsSection prefs={prefs} onChange={change} />}
          </ViewTransition>
        </div>
      </div>
    </ModalShell>
  );
}
