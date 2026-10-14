// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Shared OpenAPI registry singleton.
 *
 * All modules import this to register their schemas and paths.
 * The final spec is assembled by spec.ts at startup.
 */

import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";

export const registry = new OpenAPIRegistry();
