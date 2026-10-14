const firewall = {
  "pageTitle": "Firewall",
  "installWarning": {
    "title": "Firewall components not detected",
    "description": "The package manager (apt/dnf/apk/...) will be run with default configuration and services will be enabled when done.",
    "btnInstall": "Install now"
  },
  "statusCard": {
    "label": "Firewall Status (UFW)",
    "verifying": "Verifying...",
    "btnDisable": "Disable",
    "btnEnable": "Enable"
  },
  "securityAudit": {
    "title": "Security Audit (Premium)",
    "btnStartAudit": "Start scan",
    "scannerChecking": "checking…",
    "btnInstallScanner": "Install",
    "scanProgress": "Scan progress",
    "scanAi": "AI analysis: 0%",
    "noReports": "No completed audits. Start a new one to begin."
  },
  "ufwRules": {
    "title": "UFW Rules",
    "btnNewRule": "New rule",
    "loading": "Loading rules...",
    "btnAllowCloudflare": "Allow Cloudflare",
    "searchLabel": "Search rules",
    "searchPlaceholder": "Search port, IP, or comment…"
  },
  "fail2ban": {
    "btnBanIp": "Ban IP",
    "loading": "Loading jails..."
  },
  "ruleDialog": {
    "title": "New UFW Rule",
    "labelAction": "Action",
    "optionAllow": "Allow",
    "optionDeny": "Deny",
    "optionReject": "Reject",
    "labelProtocol": "Protocol",
    "optionAny": "Any",
    "labelPort": "Port",
    "placeholderPort": "25 or 8080:8090",
    "labelFromIp": "From IP",
    "placeholderFromIp": "any or 192.168.0.0/24",
    "labelComment": "Comment (optional)",
    "placeholderComment": "Inbound SMTP",
    "btnCancel": "Cancel",
    "btnAdd": "Add rule"
  },
  "banDialog": {
    "title": "Ban IP manually",
    "labelIp": "IP address",
    "placeholderIp": "192.168.1.100",
    "labelJail": "Jail",
    "btnCancel": "Cancel",
    "btnBan": "Ban"
  },
  "auditReportDialog": {
    "title": "Security audit report",
    "btnClose": "Close"
  },
  "aiAssistant": {
    "btnSuggestRules": "Suggest rules (AI)",
    "btnSuggestBans": "Suggest bans (AI)",
    "btnAnalyze": "AI analysis",
    "promptUfw": "Analyze the UFW firewall on the connected server: review its status and current rules (use the firewall.ufw_status tool) and suggest smart UFW rules to improve security without breaking services in use. For each proposed rule, explain why and include the exact `ufw` command to apply it.",
    "promptFail2ban": "Analyze Fail2ban on the connected server: review the configured jails and banned IPs (use the firewall.fail2ban_status tool) and suggest bans and configuration improvements to protect it from brute-force attacks. Indicate jail, IP/range and reason, and the commands to apply them.",
    "promptAnalyze": "Run a general security analysis of the firewall on the connected server. Review the status of UFW and Fail2ban (use the firewall.ufw_status and firewall.fail2ban_status tools), identify risks, exposed ports and weak configurations, and deliver prioritized recommendations with the commands to apply them.",
    "analyzeRule": "Analyze with AI",
    "promptRule": "Analyze this existing UFW rule on the connected server. Explain what traffic it allows or blocks, assess its risks, and recommend whether to keep, adjust, or replace it. If you propose changes, include the exact commands.\n\nRule #{number}\nAction: {action}\nDestination/port: {to}\nSource: {from}\nProtocol: {proto}\nComment: {comment}"
  },
  "labels": {
    "active": "Active",
    "inactive": "Inactive",
    "bannedCount": "{count} banned",
    "moreIps": "+{n} more",
    "installingText": "Installing UFW and Fail2ban… may take a few minutes.",
    "installSuccessText": "Firewall installed successfully.",
    "cfEdgeBlockQuestion": "Also block {ip} at Cloudflare edge?",
    "findingsCount": "{n} findings found",
    "completedAt": "Completed in {time}",
    "scanAiProgress": "AI analysis: {pct}%",
    "scanBitNinjaProgress": "BitNinja: {pct}%",
    "scanLynisProgress": "Lynis: {pct}%",
    "scanRkhunterProgress": "Rkhunter: {pct}%",
    "scanChkrootkitProgress": "Chkrootkit: {pct}%",
    "any": "any",
    "overallRisk": "Overall Risk",
    "unknown": "UNKNOWN",
    "keyThreats": "Key threats",
    "recommendations": "Recommendations",
    "findingsTitle": "Findings ({n})",
    "moreFindingsCount": "+{n} more findings",
    "from": "from"
  },
  "empty": {
    "noRules": "No rules",
    "noJails": "No active jails"
  },
  "actions": {
    "unban": "unban",
    "blockInCloudflare": "Block on Cloudflare",
    "dismiss": "Dismiss"
  },
  "confirm": {
    "deleteRuleMsg": "Delete rule #{number}?",
    "deleteRuleTitle": "Delete rule",
    "disableFwMsg": "Disable firewall? The server will have no network protection.",
    "disableFwTitle": "Disable firewall",
    "disableFwBtn": "Yes, disable",
    "cfAllowMsg": "UFW rules will be added to allow 80/443 from official Cloudflare ranges. Continue?",
    "cfAllowTitle": "Allow Cloudflare IPs",
    "cfAllowBtn": "Continue"
  },
  "toasts": {
    "ruleDeleted": "Rule deleted",
    "errorDelete": "Error deleting",
    "ipUnbanned": "{ip} unbanned",
    "errorUnban": "Error unbanning",
    "fwEnabled": "Firewall enabled",
    "errorEnable": "Error enabling",
    "fwDisabled": "Firewall disabled",
    "errorDisable": "Error disabling",
    "fwInstalled": "Firewall installed",
    "ruleAdded": "Rule added",
    "ipBanned": "{ip} banned in {jail}",
    "errorBan": "Error banning",
    "cfRulesApplied": "Cloudflare rules applied ({applied})",
    "errorCfRules": "Error applying Cloudflare rules",
    "errorStartAudit": "Error starting audit",
    "auditCompleted": "Audit completed",
    "auditFailed": "Audit failed",
    "errorLoadReport": "Error loading report",
    "reportOf": "Report of {date}"
  },
  "errors": {
    "addRule": "Error adding rule"
  },
  "runtime": {
    "statusError": "Could not check the status",
    "rulesLoadError": "Could not load the rules.",
    "noMatchingRules": "No rules match the filter.",
    "loggingSaved": "Logging level saved.",
    "loggingSaveError": "Could not save the logging level."
  },
  "settingsUi": {
    "rulesView": "Rule view",
    "ufwLog": "UFW log",
    "related": "Related",
    "title": "Firewall settings",
    "description": "Personal filters and the active server’s UFW log.",
    "sectionsLabel": "Firewall settings sections",
    "showActions": "Show actions",
    "all": "All",
    "limit": "Limit",
    "serverSettingHint": "This setting changes the active server configuration.",
    "logLevel": "Logging level",
    "off": "Disabled",
    "low": "Low",
    "medium": "Medium",
    "high": "High",
    "full": "Full",
    "saveLevel": "Save level",
    "relatedModules": "Related modules"
  }
} as const;

export default firewall;
