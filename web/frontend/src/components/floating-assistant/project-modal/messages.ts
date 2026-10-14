// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
/** ProjectModal i18n message shapes + Spanish fallback — extracted verbatim. */
export type ProjectModalMessages = {
  titleRequired: string;
  deleteConfirm: string;
  deleteTitle: string;
  deleteConfirmBtn: string;
  editProject: string;
  newSubproject: string;
  newProject: string;
  tabSettings: string;
  tabStructure: string;
  tabGeneral: string;
  tabContext: string;
  tabServers: string;
  tabSkills: string;
  tabChildren: string;
  sectionGeneralDesc: string;
  sectionContextDesc: string;
  sectionServersDesc: string;
  sectionSkillsDesc: string;
  sectionChildrenDesc: string;
  sectionStructureDesc: string;
  loadingProject: string;
  titleLabel: string;
  titlePlaceholder: string;
  providerLabel: string;
  iconLabel: string;
  workingDirLabel: string;
  workingDirPlaceholder: string;
  browse: string;
  clear: string;
  workingDirHint: string;
  instructionsLabel: string;
  instructionsPlaceholder: string;
  associatedServersLabel: string;
  associatedServersHint: string;
  loadingConnections: string;
  noServersToAssociate: string;
  associatedServersCount: string;
  autoCaptureTitle: string;
  autoCaptureHint: string;
  childProjectsLabel: string;
  selectProject: string;
  add: string;
  adding: string;
  noProjectsRegistered: string;
  noMoreProjects: string;
  editChild: string;
  removeChild: string;
  delete: string;
  cancel: string;
  saving: string;
  save: string;
  back: string;
  openParent: string;
  openChild: string;
  seeProjectInfo: string;
  skillsLabel: string;
  graphIndexLabel: string;
  graphIndexHint: string;
  graphIndexNow: string;
  graphReindex: string;
  graphIndexing: string;
  graphIndexedAt: string;
  graphIndexError: string;
  graphNeedsPath: string;
  graphPathChanged: string;
  verifyLabel: string;
  verifyPlaceholder: string;
  verifyHint: string;
  snippetsSection: string;
  snippetsCategoryLabel: string;
  snippetsCategoryNone: string;
  snippetsTagsLabel: string;
  snippetsHelp: string;
  snippetsNoAccess: string;
  snippetsNoTags: string;
};

// Type-only fallback string shape; actual strings live in the i18n locale files
// (assistant.projectModal.*) and are deep-merged at runtime via mergeNamespaces.
export const projectModalFallback: ProjectModalMessages = {
  titleRequired: "",
  deleteConfirm: "",
  deleteTitle: "",
  deleteConfirmBtn: "",
  editProject: "",
  newSubproject: "",
  newProject: "",
  tabSettings: "",
  tabStructure: "",
  tabGeneral: "",
  tabContext: "",
  tabServers: "",
  tabSkills: "",
  tabChildren: "",
  sectionGeneralDesc: "",
  sectionContextDesc: "",
  sectionServersDesc: "",
  sectionSkillsDesc: "",
  sectionChildrenDesc: "",
  sectionStructureDesc: "",
  loadingProject: "",
  titleLabel: "",
  titlePlaceholder: "",
  providerLabel: "",
  iconLabel: "",
  workingDirLabel: "",
  workingDirPlaceholder: "",
  browse: "",
  clear: "",
  workingDirHint: "",
  instructionsLabel: "",
  instructionsPlaceholder: "",
  associatedServersLabel: "",
  associatedServersHint: "",
  loadingConnections: "",
  noServersToAssociate: "",
  associatedServersCount: "",
  autoCaptureTitle: "",
  autoCaptureHint: "",
  childProjectsLabel: "",
  selectProject: "",
  add: "",
  adding: "",
  noProjectsRegistered: "",
  noMoreProjects: "",
  editChild: "",
  removeChild: "",
  delete: "",
  cancel: "",
  saving: "",
  save: "",
  back: "",
  openParent: "",
  openChild: "",
  seeProjectInfo: "",
  skillsLabel: "",
  graphIndexLabel: "",
  graphIndexHint: "",
  graphIndexNow: "",
  graphReindex: "",
  graphIndexing: "",
  graphIndexedAt: "",
  graphIndexError: "",
  graphNeedsPath: "",
  graphPathChanged: "",
  verifyLabel: "",
  verifyPlaceholder: "",
  verifyHint: "",
  // Snippets de terminal (pre-filtro): fallback ES local — las claves aún no
  // existen en los locales, así que el texto base vive aquí.
  snippetsSection: "Snippets de terminal",
  snippetsCategoryLabel: "Categoría de snippets",
  snippetsCategoryNone: "(ninguna)",
  snippetsTagsLabel: "Tags de la categoría",
  snippetsHelp: "Pre-filtra los snippets de terminal disponibles en los chats de este proyecto: elige una categoría y, opcionalmente, tags de esa categoría. Sin categoría = sin filtro.",
  snippetsNoAccess: "No se pudieron cargar los snippets de terminal (requiere permiso de terminal).",
  snippetsNoTags: "Esta categoría no tiene tags.",
};

