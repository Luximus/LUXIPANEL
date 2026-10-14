// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * IMAP service — manages IMAP connections for reading mailboxes.
 *
 * FACADE: the implementation was split into cohesive sub-services under
 * `./imap/` (types, parsing/auth helpers, connection management, folder,
 * message and bulk operations). This module preserves the ORIGINAL public
 * surface — the same named exports and the `imapService` object — so every
 * consumer (services/index, controllers, agent-capability, tests) is unchanged.
 */

export type { MailAuthResults } from "./imap/imap.types.js";
export { parseAuthResults } from "./imap/imap-parse.js";
export { withImap, verifyLogin } from "./imap/imap-connection.js";
export {
  listFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  listFolderUsage,
} from "./imap/imap-folders.js";
export {
  listMessages,
  fetchMessage,
  fetchRawMessage,
  fetchRawMessageBytes,
  moveMessage,
  deleteMessage,
  setFlag,
  moveMessages,
  deleteMessages,
  setFlagMany,
} from "./imap/imap-fetch.js";
export {
  deleteMessagesByDateRange,
  copyMessagesByDateRange,
  cloneMailbox,
} from "./imap/imap-bulk.js";

import { withImap, verifyLogin } from "./imap/imap-connection.js";
import {
  listFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  listFolderUsage,
} from "./imap/imap-folders.js";
import {
  listMessages,
  fetchMessage,
  fetchRawMessage,
  fetchRawMessageBytes,
  moveMessage,
  deleteMessage,
  setFlag,
  moveMessages,
  deleteMessages,
  setFlagMany,
} from "./imap/imap-fetch.js";
import {
  deleteMessagesByDateRange,
  copyMessagesByDateRange,
  cloneMailbox,
} from "./imap/imap-bulk.js";

export const imapService = {
  withImap,
  verifyLogin,
  cloneMailbox,
  listFolders,
  listMessages,
  fetchMessage,
  fetchRawMessage,
  fetchRawMessageBytes,
  createFolder,
  renameFolder,
  deleteFolder,
  moveMessage,
  deleteMessage,
  setFlag,
  moveMessages,
  deleteMessages,
  setFlagMany,
  listFolderUsage,
  deleteMessagesByDateRange,
  copyMessagesByDateRange,
};
