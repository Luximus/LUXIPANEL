// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * JSON-RPC 2.0 error codes used by the MCP transports (assistant + peer).
 *
 * The first four mirror the spec's reserved range; the `-32001/-32002/-32003`
 * codes are the panel's server-defined implementation errors (allowed by the
 * spec's `-32000..-32099` server-error band). Single source of truth so every
 * MCP controller/service uses the same numbers.
 */

/** Invalid JSON was received (parse error). */
export const MCP_PARSE_ERROR = -32700;
/** The JSON sent is not a valid Request object. */
export const MCP_INVALID_REQUEST = -32600;
/** The method does not exist / is not available. */
export const MCP_METHOD_NOT_FOUND = -32601;
/** Server error: auth/session resolution failure (token, executor). */
export const MCP_SERVER_ERROR = -32001;
/** Tool/executor error surfaced back to the caller as a JSON-RPC error. */
export const MCP_TOOL_ERROR = -32002;
/** Access denied (forbidden scope / module). */
export const MCP_ACCESS_DENIED = -32003;
