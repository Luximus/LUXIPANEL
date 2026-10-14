// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
import { agentCapabilityRegistry } from "../agent-capability/registry.js";
import { moduleOperationRegistry } from "./registry.js";
export function registerManagementCapabilities(): void {
  const ids = new Set(moduleOperationRegistry.list().map(operation => operation.moduleId));
  for (const catalogId of ids) {
    const previous = agentCapabilityRegistry.list().find(cap => (cap.catalogModuleId ?? cap.moduleId) === catalogId);
    const moduleId = previous?.moduleId ?? catalogId;
    const tools = moduleOperationRegistry.list(catalogId).map(({ tool }) => ({ ...tool, name: `${moduleId}.${tool.name.split(".")[1]}` }));
    const native = previous?.tools.filter(tool => !tools.some(route => route.name === tool.name)) ?? [];
    agentCapabilityRegistry.register({ ...previous, moduleId, catalogModuleId: catalogId, version: 1, tools: [...native, ...tools] });
  }
}
