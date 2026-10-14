// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Catálogo de módulos de comunidad cargados (estado de instancia, in-memory).
 * Lo PUEBLA el loader (modules/community) y lo LEE module-registry para fusionar
 * con el catálogo estático (getCatalog = estático ⊕ comunidad). Vive en shared/
 * para no acoplar módulos entre sí (regla del repo).
 */
import type { ModuleDefinition } from "../modules/admin/services/module-registry.service.js";

const defs = new Map<string, ModuleDefinition>();

export const communityCatalog = {
  set(def: ModuleDefinition): void { defs.set(def.id, def); },
  remove(id: string): void { defs.delete(id); },
  list(): ModuleDefinition[] { return [...defs.values()]; },
  has(id: string): boolean { return defs.has(id); },
};
