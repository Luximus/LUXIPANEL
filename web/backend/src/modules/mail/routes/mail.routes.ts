// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/**
 * Mail routes — all endpoints under /api/accounts and /api/mail.
 */

import { Router, type Router as ExpressRouter } from "express";
import { accountsController } from "../controllers/accounts.controller.js";
import { mailboxController } from "../controllers/mailbox.controller.js";
import { masterAccessController } from "../controllers/master-access.controller.js";
import { composeController } from "../controllers/compose.controller.js";
import { contactsController } from "../controllers/contacts.controller.js";
import { actionsController } from "../controllers/actions.controller.js";
import { forwardsController } from "../controllers/forwards.controller.js";
import { filtersController } from "../controllers/filters.controller.js";
import { signaturesController } from "../controllers/signatures.controller.js";
import { autoresponderController } from "../controllers/autoresponder.controller.js";
import { calendarsController } from "../controllers/calendars.controller.js";
import { domainForwardsController } from "../controllers/domain-forwards.controller.js";
import { domainRoutingController } from "../controllers/domain-routing.controller.js";
import { defaultAddressController } from "../controllers/default-address.controller.js";
import { trackDeliveryController } from "../controllers/track-delivery.controller.js";
import { globalFiltersController } from "../controllers/global-filters.controller.js";
import { spamFiltersController } from "../controllers/spam-filters.controller.js";
import { archiveController } from "../controllers/archive.controller.js";
import { encryptionController } from "../controllers/encryption.controller.js";
import { mailOutboundController } from "../controllers/outbound.controller.js";
import { requireAuth } from "../../auth/middlewares/session.middleware.js";
import { csrfProtection } from "../../auth/middlewares/csrf.middleware.js";
import { requireModule } from "../../auth/middlewares/require-module.middleware.js";
import { mailServerSettingsController } from "../controllers/server-settings.controller.js";
import { mailServerMiddleware } from "../middlewares/mail-server.middleware.js";
import { jobsController } from "../../jobs/controllers/jobs.controller.js";
import { sudoController } from "../../sudo/controllers/sudo.controller.js";

const router: ExpressRouter = Router();

// Mounted at root: authenticate only this module's paths so unrelated
// requests do not repeat JWT, bridge and live-permission resolution.
router.use(["/api/accounts", "/api/mail"], requireAuth);
router.use(["/api/accounts", "/api/mail"], requireModule("mail"));

// ---- Panel outbound identity (system emails: reports, approvals, tests) ----
router.get("/api/mail/outbound", requireModule("admin"), mailOutboundController.get);
router.put("/api/mail/outbound", requireModule("admin"), csrfProtection, mailOutboundController.save);
router.post("/api/mail/outbound/test", requireModule("admin"), csrfProtection, mailOutboundController.test);

// Selection stays reachable even if the chosen mail server is unavailable.
// Outbound notification identity above still belongs to the active panel server.
router.get("/api/mail/server-settings", mailServerSettingsController.list);
router.post("/api/mail/server-settings/validate", csrfProtection, mailServerSettingsController.validate);
router.use(["/api/accounts", "/api/mail"], mailServerMiddleware);
router.get("/api/mail/jobs/:id", jobsController.get);
router.post("/api/mail/sudo/credential", requireModule("admin"), csrfProtection, sudoController.set);

// ---- Accounts CRUD ----
router.get("/api/accounts", accountsController.list);
router.get("/api/accounts/domains", accountsController.listDomains);
router.get("/api/accounts/autoresponder/charsets", autoresponderController.charsets);
router.post("/api/accounts", csrfProtection, accountsController.create);
router.put("/api/accounts/:id", csrfProtection, accountsController.update);
router.delete("/api/accounts/:id", csrfProtection, accountsController.remove);

// ---- Forwards (per-account) ----
router.get("/api/accounts/:accountId/forwards", forwardsController.list);
router.put("/api/accounts/:accountId/forwards", csrfProtection, forwardsController.replace);
router.delete("/api/accounts/:accountId/forwards/:forwardId", csrfProtection, forwardsController.remove);

// ---- Contacts (per-account) ----
router.get("/api/accounts/:accountId/contacts", contactsController.list);
router.post("/api/accounts/:accountId/contacts", csrfProtection, contactsController.create);
router.put("/api/accounts/:accountId/contacts/:contactId", csrfProtection, contactsController.update);
router.delete("/api/accounts/:accountId/contacts/:contactId", csrfProtection, contactsController.remove);

// ---- Filters (per-account) ----
router.get("/api/accounts/:accountId/filters", filtersController.list);
router.post("/api/accounts/:accountId/filters", csrfProtection, filtersController.create);
router.put("/api/accounts/:accountId/filters/:filterId", csrfProtection, filtersController.update);
router.delete("/api/accounts/:accountId/filters/:filterId", csrfProtection, filtersController.remove);

// ---- Signatures (per-account) ----
router.get("/api/accounts/:accountId/signatures", signaturesController.list);
router.post("/api/accounts/:accountId/signatures", csrfProtection, signaturesController.create);
router.put("/api/accounts/:accountId/signatures/:signatureId", csrfProtection, signaturesController.update);
router.delete("/api/accounts/:accountId/signatures/:signatureId", csrfProtection, signaturesController.remove);

// ---- Autoresponder (per-account) ----
router.get("/api/accounts/:accountId/autoresponder", autoresponderController.get);
router.put("/api/accounts/:accountId/autoresponder", csrfProtection, autoresponderController.upsert);
router.delete("/api/accounts/:accountId/autoresponder", csrfProtection, autoresponderController.remove);

// ---- Calendars (per-account) ----
router.get("/api/accounts/:accountId/calendars", calendarsController.list);
router.post("/api/accounts/:accountId/calendars", csrfProtection, calendarsController.create);
router.put("/api/accounts/:accountId/calendars/:calendarId", csrfProtection, calendarsController.update);
router.delete("/api/accounts/:accountId/calendars/:calendarId", csrfProtection, calendarsController.remove);

// ---- Master access (panel's Dovecot master user on the connected server) ----
router.get("/api/mail/master-access", requireModule("admin"), masterAccessController.status);
router.post("/api/mail/master-access", requireModule("admin"), csrfProtection, masterAccessController.ensure);
router.delete("/api/mail/master-access", requireModule("admin"), csrfProtection, masterAccessController.disable);

// ---- Mailbox (IMAP) ----
router.post("/api/mail/:accountId/credential", csrfProtection, mailboxController.setCredential);
router.get("/api/mail/:accountId/folders", mailboxController.listFolders);
router.post("/api/mail/:accountId/folders", csrfProtection, mailboxController.createFolder);
router.put("/api/mail/:accountId/folders", csrfProtection, mailboxController.renameFolder);
router.delete("/api/mail/:accountId/folders", csrfProtection, mailboxController.deleteFolder);
router.get("/api/mail/:accountId/messages", mailboxController.listMessages);
router.get("/api/mail/:accountId/messages/:uid", mailboxController.fetchMessage);
router.get("/api/mail/:accountId/disk-usage", mailboxController.diskUsage);
router.post("/api/mail/:accountId/disk-usage/delete-by-date", csrfProtection, mailboxController.deleteByDate);
router.post("/api/mail/:accountId/disk-usage/copy-by-date", csrfProtection, mailboxController.copyByDate);
router.post("/api/mail/:accountId/clone", csrfProtection, mailboxController.clone);
router.get("/api/mail/domain-forwards", domainForwardsController.list);
router.put("/api/mail/domain-forwards", requireModule("admin"), csrfProtection, domainForwardsController.replace);
router.put("/api/mail/domain-forwards/:domain", csrfProtection, domainForwardsController.upsert);
router.delete("/api/mail/domain-forwards/:domain", csrfProtection, domainForwardsController.remove);
router.get("/api/mail/domain-routing", domainRoutingController.list);
router.put("/api/mail/domain-routing", csrfProtection, domainRoutingController.upsert);
router.get("/api/mail/default-address", defaultAddressController.list);
router.put("/api/mail/default-address", csrfProtection, defaultAddressController.upsert);
router.get("/api/mail/track-delivery", trackDeliveryController.list);
// Global filters are injected into EVERY account's Sieve script, so a
// non-admin tenant with the `mail` module could otherwise redirect/discard the
// whole server's mail. Gate all four verbs behind admin (audit §5).
router.get("/api/mail/global-filters", requireModule("admin"), globalFiltersController.list);
router.get("/api/mail/spam-filters", requireModule("admin"), spamFiltersController.list);
router.get("/api/mail/spam-filters/score-types", requireModule("admin"), spamFiltersController.scoreTypes);
router.put("/api/mail/spam-filters", requireModule("admin"), csrfProtection, spamFiltersController.update);
router.get("/api/mail/archive", archiveController.list);
router.put("/api/mail/archive/defaults", requireModule("admin"), csrfProtection, archiveController.updateDefaults);
router.put("/api/mail/archive/domain", csrfProtection, archiveController.upsertDomain);
router.get("/api/mail/archive/:domain/messages", archiveController.messages);
router.get("/api/mail/archive/:domain/messages/:direction/:folder/:name/raw", archiveController.rawMessage);
router.post("/api/mail/archive/:domain/messages/:direction/:folder/:name/restore", csrfProtection, archiveController.restoreMessage);
router.get("/api/mail/encryption", encryptionController.list);
router.post("/api/mail/encryption/keys", csrfProtection, encryptionController.create);
router.post("/api/mail/encryption/import", csrfProtection, encryptionController.importPublic);
router.post("/api/mail/encryption/import-private", csrfProtection, encryptionController.importPrivate);
router.delete("/api/mail/encryption/keys/:keyId", csrfProtection, encryptionController.remove);
router.post("/api/mail/global-filters", requireModule("admin"), csrfProtection, globalFiltersController.create);
router.put("/api/mail/global-filters/:filterId", requireModule("admin"), csrfProtection, globalFiltersController.update);
router.delete("/api/mail/global-filters/:filterId", requireModule("admin"), csrfProtection, globalFiltersController.remove);
router.post("/api/mail/global-filters/test", requireModule("admin"), csrfProtection, globalFiltersController.test);

// ---- Message actions ----
router.get("/api/mail/:accountId/messages/:uid/raw", actionsController.raw);
router.get("/api/mail/:accountId/messages/:uid/attachments/:index", actionsController.attachment);
router.post("/api/mail/:accountId/messages/:uid/move", csrfProtection, actionsController.move);
router.post("/api/mail/:accountId/messages/:uid/flag", csrfProtection, actionsController.flag);
router.delete("/api/mail/:accountId/messages/:uid", csrfProtection, actionsController.delete);

// ---- Compose (SMTP) ----
router.post("/api/mail/:accountId/send", csrfProtection, composeController.send);
router.put("/api/mail/:accountId/drafts/:uid", csrfProtection, composeController.updateDraft);
router.post("/api/mail/:accountId/messages/:uid/decrypt", csrfProtection, encryptionController.decrypt);

// ---- Contacts ----
router.get("/api/mail/:accountId/contacts", contactsController.search);

export { router as mailRouter };
