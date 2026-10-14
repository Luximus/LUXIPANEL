import React from "react";
import { ModuleSettingsDrawer } from "./ui/ModuleSettingsDrawer";

/** Shared full-height settings drawer; section navigation belongs to its body. */
export function SettingsDrawerShell({ visible, onClose, title, language, children }: {
  visible: boolean; onClose: () => void; title: string; language: string; children: React.ReactNode;
  activeIndex: number; enableTabSwipe?: boolean; onSwipeNext?: () => boolean; onSwipePrev?: () => boolean;
}) {
  return <ModuleSettingsDrawer visible={visible} onClose={onClose} title={title} language={language}>{children}</ModuleSettingsDrawer>;
}
