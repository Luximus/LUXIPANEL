// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Barrel for the assistant module API. The implementation is split by domain
 * under ./assistant-api/*; this file re-exports the COMPLETE public surface so
 * `@/components/floating-assistant/assistant-api` keeps working unchanged.
 */
export * from "./assistant-api/providers";
export * from "./assistant-api/voice";
export * from "./assistant-api/agent-stream";
export * from "./assistant-api/team";
export * from "./assistant-api/modules";
export * from "./assistant-api/connectors";
export * from "./assistant-api/skills";
export * from "./assistant-api/conversations";
export * from "./assistant-api/storage";
export * from "./assistant-api/projects";
export * from "./assistant-api/project-structure";
export * from "./assistant-api/agents";
export * from "./assistant-api/team-templates";
export * from "./assistant-api/stats";
