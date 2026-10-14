// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import AssistantPanel, { type AssistantInitialOpen } from "./AssistantPanel";

/** Dedicated assistant page. The chat stays mounted in the workspace shell. */
export default function AssistantView({ locale, initialOpen }: { locale: string; initialOpen?: AssistantInitialOpen | null }) {
  return <div className="lxp-project-preview-layout">
    <div className="lxp-project-preview-chat">
      <AssistantPanel locale={locale} variant="view" initialOpen={initialOpen ?? null} />
    </div>
  </div>;
}
