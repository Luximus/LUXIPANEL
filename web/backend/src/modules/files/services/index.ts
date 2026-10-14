// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
//
// Convenience barrel for the module's service singletons — the controllers and
// the agent-capability import their service from here. Helper functions and
// per-service types are intentionally NOT re-exported: their only consumers
// (tests, sibling services) import them directly from the source file, so a
// barrel re-export would be dead weight. Add a re-export here only when a
// barrel consumer actually needs it.
export { filesystemService } from "./filesystem.service.js";
export { permissionsService } from "./permissions.service.js";
export { archiveService, type ArchiveFormat } from "./archive.service.js";
export { snapshotService } from "./snapshot.service.js";
export { contentSearchService } from "./content-search.service.js";
export { replaceService } from "./replace.service.js";
export { projectTypeService } from "./project-type.service.js";
export { exposureService } from "./exposure.service.js";
export { directoryPrivacyService } from "./directory-privacy.service.js";
export { validationService } from "./validation.service.js";
export { dirCompareService } from "./dir-compare.service.js";
export { fileHistoryService } from "./file-history.service.js";
export { gitService } from "./git.service.js";
export { gitCredentialsService } from "./git-credentials.service.js";
export { gitSshService } from "./git-ssh.service.js";
export { malwareService } from "./malware.service.js";
export { cleanupService } from "./cleanup.service.js";
export { imageOptimService } from "./image-optim.service.js";
export { fileMetaService } from "./file-meta.service.js";
export { filesPrefsService } from "./files-prefs.service.js";
export { shareService } from "./share.service.js";
