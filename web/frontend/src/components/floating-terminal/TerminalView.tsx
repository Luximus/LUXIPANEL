// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import TerminalPanel from "./TerminalPanel";

/**
 * Vista de página dedicada del Terminal (`/panel/terminal`). Reutiliza el MISMO
 * componente compartido que el drawer flotante (`TerminalPanel`) → paridad
 * automática. El JS vanilla del terminal, el CSS de xterm, `#dialog-snippet` y
 * `#lxp-terminal-pocket` ya los provee `FloatingTerminal.astro` global (montado
 * en PanelLayout, presente también en esta página) — la vista los reutiliza, no
 * los duplica. El FAB del terminal se oculta en esta ruta (ver
 * FloatingTerminalDrawer) para garantizar una sola instancia montada.
 */
export default function TerminalView({ locale }: { locale: string }) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-card">
      <TerminalPanel variant="view" locale={locale} />
    </div>
  );
}
