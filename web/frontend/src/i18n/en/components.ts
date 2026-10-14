const components = {
  "setupWizardFooter": {
    "rights": "All rights reserved.",
    "madeBy": "Made by LUXISOFT",
    "termsAndConditions": "Terms and Conditions",
    "privacyPolicy": "Privacy Policy",
    "documentation": "Documentation",
    "refundPolicy": "Refund Policy"
  },
  "dataTable": {
    "boolTrue": "Yes",
    "boolFalse": "No",
    "selectPage": "Select page",
    "selectRow": "Select row",
    "actions": "Actions",
    "configure": "Configure table",
    "empty": "No results for {title}.",
    "total": "Total",
    "selectedSummary": "{selected} selected • showing {shown} of {pageSize} results, total results: {total}",
    "summary": "showing {shown} of {pageSize} results, total results: {total}",
    "prev": "Previous",
    "next": "Next",
    "pageOf": "Page {currentPage} of {totalPages}",
    "configureTitle": "Configure table",
    "columnsAndOrder": "Visible columns and order",
    "resultsPerPage": "Results per page",
    "moveUp": "Move {col} up",
    "moveDown": "Move {col} down",
    "defaultTitle": "table",
    "dragHandle": "Drag to reorder",
    "moveUpAria": "Move {col} up",
    "moveDownAria": "Move {col} down",
    "emptyCell": "-"
  },
  "confirmModal": {
    "title": "Confirm",
    "cancel": "Cancel",
    "confirm": "Confirm",
    "alertTitle": "Notice",
    "alertOk": "Got it",
    "promptTitle": "Enter a value",
    "promptCancel": "Cancel",
    "promptOk": "OK"
  },
  "modalNavbar": {
    "back": "Back",
    "close": "Close"
  },
  "viewSettingsModal": {
    "buttonLabel": "Settings",
    "description": "Settings specific to this module",
    "close": "Close"
  },
  "floatingTerminal": {
    "newSnippet": "New snippet",
    "close": "Close",
    "name": "Name",
    "namePlaceholder": "e.g. Restart Postfix",
    "category": "Category",
    "tags": "Tags",
    "tagsHelp": "Tags depend on the selected category",
    "command": "Command",
    "monacoHelp": "Monaco for shell syntax. Use Ctrl+Enter to save from the editor.",
    "cancel": "Cancel",
    "save": "Save"
  },
  "installModal": {
    "running": "Installing… this may take a few minutes.",
    "success": "Installation completed.",
    "failed": "Installation failed. Check the log."
  },
  "enterPage": {
    "pageTitle": "Enter with code",
    "heading": "Enter with access code",
    "subtitle": "Enter the code you received to access the panel.",
    "codeLabel": "Access code",
    "codePlaceholder": "e.g. a1b2c3d4e5f6g7",
    "continue": "Continue",
    "useAnotherCode": "Use another code",
    "codeShort": "Code",
    "terminalAi": "Terminal / AI",
    "enter": "Enter",
    "willBeRedirected": "You will be directed to panel login.",
    "featuresAvailable": "Available",
    "featuresUnavailable": "Unavailable",
    "invalidCode": "Invalid access code.",
    "verifyError": "Could not verify code. Try again.",
    "networkError": "Network error. Try again.",
    "guestSessionError": "Could not start guest session."
  },
  "dragHandle": "Drag to reorder",
  "logoAlt": "LUXIPANEL",
  "default": " (default)",
  "emptyCell": "-",
  "loginEffects": {
    "defaultSuffix": " (default)",
    "webGpuHint": "Requires WebGPU. Browsers without support show the default background."
  },
  "tableSettings": {
    "pagination": "Pagination",
    "rowsPerPage": "Rows per page in this table.",
    "visibleActions": "Actions to show",
    "actionsHint": "Choose which actions appear in the «···» menu of each row."
  }
} as const;

export default components;
