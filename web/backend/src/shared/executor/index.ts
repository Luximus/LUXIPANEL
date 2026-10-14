// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
export { getExecutor, getExecutorForRead, getExecutorAsync, getDirectExecutorByBridgeSessionId, disposeDirectExecutor, listLiveDirectExecutors } from "./factory.js";
export { runWithExecutor, getContextExecutor, getContextUserId, getContextUser, runOnPanelHost, setContextFileJail, getFileJailPaths, pathInFileJail } from "./context.js";
export { localExecutor, LOCAL_TARGET_ID } from "./local-executor.js";
export { quoteArg, quoteCmd } from "./quote.js";
export { execShell, shellCmd } from "./exec-shell.js";
export { requireExecutor, noServerExecutor, type MissingExecutorHandler } from "./require-executor.js";
export { pathExists, statOrNull } from "./fs-probe.js";
export { mapFsError } from "./fs-error.js";
export type {
  Executor,
  ExecOptions,
  ExecResult,
  FileStat,
  DirEntry,
  WriteOptions,
  SftpBatchOperation,
  SftpBatchResult,
} from "./types.js";
