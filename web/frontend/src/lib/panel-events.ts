// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * panel-events.ts — single source of truth for cross-island panel CustomEvent
 * names that are NOT owned by a more specific module (the DataTable vocabulary
 * lives in `datatable-events.ts`, the assistant WS names in `assistant-ws.ts`).
 *
 * These `lxp:*` names used to be re-typed as raw string literals at each
 * dispatch/listen site; a single typo silently broke the wiring with no compile
 * error. Defining them once here removes that risk.
 *
 * Consumed by React/Astro islands and `src/lib/**` via `@/lib/panel-events`.
 * Inline / define-vars / `bundle:false` extracted scripts that cannot import
 * (or that reference these before this module is a runtime lib entry) keep the
 * literal and carry a `// MUST match lib/panel-events.ts <SYMBOL>` coupling
 * comment. Values are byte-identical to the former literals — do not change
 * them without updating every emitter/listener in lockstep.
 */

/** Emitted when the assistant's agent roster changes (create/edit/delete). */
export const ASSISTANT_AGENTS_UPDATED_EVENT = "lxp:assistant:agents-updated";
/** Emitted when the assistant's visible scope becomes / leaves "Agentes IA". */
export const ASSISTANT_AGENTS_SCOPE_EVENT = "lxp:assistant:agents-scope";
/** Emitted after the panel session is refreshed (re-auth / target switch). */
export const SESSION_REFRESHED_EVENT = "lxp:session-refreshed";
/** Request to open the Files project-map view at a given path. */
export const PROJECT_MAP_OPEN_EVENT = "lxp:project-map:open";
