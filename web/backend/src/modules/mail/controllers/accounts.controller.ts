// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Accounts controller — CRUD for mail accounts.
 *
 * FACADE: the implementation was split by concern into sibling modules under
 * `./accounts/` (util primitives, request schemas, privileged usage/quota
 * reads, forwards reader, desired-state application, live list builder, and the
 * HTTP handlers). This module preserves the ORIGINAL public surface — the
 * `accountsController` object referenced by `routes/mail.routes.ts` and the
 * `MailAccountListItem` row type — so consumers are unchanged.
 */

export { accountsController } from "./accounts/accounts-crud.controller.js";
export type { MailAccountListItem } from "./accounts/accounts-list.js";
