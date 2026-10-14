// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
let refresh: (() => Promise<void>) | undefined;
export function setMcpToolsProvider(provider: () => Promise<void>): void { refresh = provider; }
export async function refreshMcpTools(): Promise<void> { await refresh?.(); }
