// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
export {
  AppError,
  ValidationError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ServiceUnavailableError,
  QuotaExceededError,
  NoServerExecutorError,
  BridgeSessionRequiredError,
  KvReadError,
  KvWriteError,
} from "./errors.js";

export { errorHandler } from "./error-handler.js";

export { ErrorCodes } from "./codes.js";
export type { ErrorCode } from "./codes.js";
