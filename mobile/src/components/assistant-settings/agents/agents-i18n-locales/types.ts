// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LUXISOFT
// Forma tipada de las cadenas del sub-módulo "Agentes IA" (module-local).
import type { AvatarAttr } from "../agent-avataaars";

export interface AgentsStrings {
  cancel: string; saving: string; saveChanges: string; noDescription: string;
  allTools: string; toolsCount: string; noActiveModules: string;
  removeAll: string; selectAll: string; sensitiveTool: string;
  confirmDeleteAgent: string; confirmDeleteRole: string; duplicateName: string;
  editBtn: string; deleteTitle: string; errorPrefix: string; saveFailed: string;
  backToAgents: string; createdBy: string;
  diagram: { empty: string; connection: string };
  archetypes: {
    devops: string; security: string; dba: string; support: string;
    nginx: string; backups: string; logs: string; automation: string;
  };
  editor: {
    titleNew: string; titleEdit: string;
    headerTitleNew: string; headerDescNew: string; headerTitleEdit: string; headerDescEdit: string;
    backToList: string;
    tabGeneral: string; tabModel: string; tabHierarchy: string; tabTools: string; tabResources: string; tabAccess: string;
    aiHelpTitle: string; aiHelpDesc: string; aiHelpSelect: string; aiHelpFromDesc: string; aiHelpFromDescTitle: string; aiHelpGenerating: string;
    fieldName: string; namePlaceholder: string; fieldDescription: string; descPlaceholder: string;
    fieldSystemPrompt: string; systemPromptPlaceholder: string; fieldAvatar: string;
    avatarRandomize: string; avatarAuto: string;
    avatarAttrs: Record<AvatarAttr, string>;
    fieldProvider: string; fieldModel: string; modelPlaceholder: string;
    realtimeLabel: string; realtimeDesc: string; realtimeUnavailable: string;
    multiAgentLabel: string; multiAgentDescPre: string; multiAgentDescBold: string; multiAgentDescPost: string;
    multiAgentCopies: string; multiAgentCopiesHint: string; multiAgentProvidersPre: string; multiAgentProvidersPost: string; multiAgentApiHint: string;
    roleHeading: string; roleAssigned: string; roleNone: string; roleHint: string;
    parentAgent: string; parentNone: string; parentHintPre: string; parentHintBold: string; parentHintPost: string;
    connectionsLabel: string; connectionsEmpty: string; connectionsHint: string;
    supervisorLabel: string; supervisorDesc: string;
    allowAllTools: string; toolsDesc: string;
    associatedServers: string; serversEmpty: string;
    attachedProjects: string; attachedProjectsDesc: string; noParentProjects: string;
    graphIndexesTitle: string; graphIndexesDesc: string; graphIndexesEmpty: string;
    snippetsSection: string; snippetsCategoryLabel: string; snippetsCategoryNone: string;
    snippetsTagsLabel: string; snippetsHelp: string; snippetsNoAccess: string; snippetsNoTags: string;
    saveObsidian: string; agentSkills: string; createAgent: string;
    credentialTitle: string; credentialHint: string; credentialWarn2fa: string; credentialSet: string;
    credentialUser: string; credentialPass: string; credentialLabel: string;
    credentialReplace: string; credentialRemove: string; credentialRemoved: string; credentialCancel: string;
  };
  roleEditor: {
    titleNew: string; titleEdit: string;
    fieldName: string; namePlaceholder: string; fieldDesc: string; descPlaceholder: string;
    fieldBasePrompt: string; basePromptPlaceholder: string; basePromptHint: string;
    noToolLimit: string; toolsDesc: string;
    supervisorLabel: string; supervisorDesc: string; createRole: string;
  };
  treeView: { title: string; reloadTitle: string; regenerating: string; regenerate: string; description: string };
  rolesList: { newRole: string; description: string; emptyTitle: string; emptyDesc: string; agentsCount: string };
  list: {
    description: string; treeBtn: string; treeBtnTitle: string; rolesBtn: string; rolesBtnTitle: string;
    newAgent: string; loading: string; emptyTitle: string; emptyDesc: string;
    multiAgentTitle: string; roleAssignedTitle: string; subordinateTitle: string; connectionsTitle: string;
    supervisorTitle: string; supervisorBadge: string; realtimeTitle: string; realtimeBadge: string;
    startChat: string; duplicateTitle: string;
    noRoleGroupTitle: string; groupAria: string; groupCount: string; noRoleGroupDesc: string;
    deleteGroupTitle: string; deleteGroupModalTitle: string; deleteGroupModalBody: string;
    deleteGroupSharedNote: string; deleteGroupConfirm: string; deleteGroupErrors: string;
  };
  teams: {
    newTeamBtn: string; newTeamTitle: string; editTeamTitle: string;
    nameLabel: string; namePlaceholder: string; descriptionLabel: string; colorLabel: string;
    createBtn: string; saveBtn: string; cancelBtn: string;
    addAgentsBtn: string; addAgentsTitle: string; addAgentsEmpty: string; addAgentsConfirm: string;
    alreadyInTeam: string; removeFromTeamBtn: string; removeFromTeamConfirm: string;
    deleteTeamBtn: string; deleteTeamConfirm: string; deleteTeamKeepsAgentsNote: string;
    teamSelectorLabel: string; groupRequired: string; teamSelectorPlaceholder: string;
    noTeamOption: string; emptyTeamHint: string; memberCount: string;
  };
  resync: {
    btn: string; btnTitle: string; modalTitle: string; loading: string; markersMissing: string;
    missingHeading: string; presentHeading: string; extraHeading: string; extraNote: string;
    nothingMissing: string; confirm: string; applying: string; close: string;
  };
}
