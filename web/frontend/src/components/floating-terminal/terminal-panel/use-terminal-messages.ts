// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { useNamespaceMessages } from "@/lib/use-namespace-messages";
import { terminalMessagesFallback, type TerminalMessages } from "../i18n";

/**
 * Carga el slice i18n del namespace "terminal" para el `locale` dado,
 * partiendo del fallback estático y fusionando lo que devuelva el cliente.
 * Envoltorio tipado del hook compartido `useNamespaceMessages` (F-13).
 */
export function useTerminalMessages(locale: string): TerminalMessages {
  return useNamespaceMessages<TerminalMessages>(locale, "terminal", terminalMessagesFallback);
}
