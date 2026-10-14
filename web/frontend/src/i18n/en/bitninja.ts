const bitninja = {
  "header": {
    "description": "Comprehensive security agent (WAF, anti-DoS, malware detection and IP reputation) on the connected server.",
    "statusChecking": "checking…"
  },
  "sudo": {
    "label": "Sudo password (your session passphrase)",
    "placeholder": "Only if the server requests it for sudo",
    "hint": "Used only for this action and never saved in the browser."
  },
  "installCard": {
    "title": "BitNinja is not installed",
    "description": "Enter your BitNinja account license key to install the agent on this server. The official installer (get.bitninja.io) is downloaded and run with sudo.",
    "licensePlaceholder": "License key (e.g.: ab12cd34-…)",
    "installButton": "Install BitNinja"
  },
  "stats": {
    "service": "Service",
    "license": "License",
    "version": "Version"
  },
  "serviceControl": {
    "title": "Service Control",
    "start": "Start",
    "restart": "Restart",
    "stop": "Stop"
  },
  "components": {
    "title": "Protection components",
    "checking": "checking…",
    "noReported": "Agent did not report components.",
    "active": "Active",
    "inactive": "Inactive"
  },
  "updateLicense": {
    "title": "Update license key",
    "placeholder": "New license key",
    "applyButton": "Apply"
  },
  "toasts": {
    "sudoRequired": "Enter your sudo password and try again.",
    "sudoInvalid": "Invalid sudo password.",
    "actionFailed": "Action failed. Check the output.",
    "installing": "Installing BitNinja… this may take a few minutes.",
    "installed": "BitNinja installed.",
    "serviceAction": "Service: {action} OK.",
    "componentToggleEnabled": "{component}: enabled.",
    "componentToggleDisabled": "{component}: disabled.",
    "licenseApplied": "License key applied."
  },
  "errors": {
    "unknown": "Unknown error"
  },
  "status": {
    "notInstalled": "Not installed",
    "running": "Active",
    "installedStopped": "Installed (stopped)",
    "serviceRunning": "Running",
    "serviceStopped": "Stopped",
    "licenseValid": "Valid",
    "licenseReview": "Review"
  },
  "validation": {
    "licenseKeyRequired": "Enter the license key.",
    "newLicenseKeyRequired": "Enter the new license key."
  },
  "settingsUi": {
    "settingsTitle": "BitNinja settings",
    "settingsButton": "Settings",
    "settingsDescription": "Diagnostic preferences for the active server.",
    "settingsSections": "BitNinja settings sections",
    "diagnostics": "Diagnostics",
    "related": "Related",
    "logSource": "The log is read from the BitNinja service on the selected server.",
    "autoRefresh": "Refresh status every 30 seconds",
    "logLines": "Log lines",
    "relatedModules": "Related modules",
    "firewallAudit": "Firewall and audit",
    "credentials": "BitNinja credentials"
  },
  "logsUi": {
    "loading": "Loading log…",
    "empty": "No recent events.",
    "loadError": "Could not load the log.",
    "logsTitle": "Recent log",
    "logsDescription": "Service events on the active server.",
    "refreshLogs": "Refresh log",
    "logsHint": "Select “Refresh log” to load the events."
  }
} as const;

export default bitninja;
