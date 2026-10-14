const serverAlerts = {
  "pageTitle": "Notifications",
  "header": {
    "heading": "Notifications",
    "subheading": "Configure server notifications and create immediate, scheduled or metric-based alerts for this server."
  },
  "tabs": {
    "overview": "Overview",
    "prefs": "Preferences",
    "send": "Send now",
    "scheduled": "Scheduled",
    "rules": "Rules",
    "history": "History"
  },
  "overview": {
    "myAlerts": "My alerts", "devices": "Registered devices", "last": "Latest alert",
    "help": "Set your alert preferences and check delivery before scheduling a notification.",
    "active": "Active", "paused": "Paused"
  },
  "settings": {
    "title": "Notification settings", "buttonLabel": "Settings",
    "description": "Choose which alerts you receive and review your devices.",
    "sections": "Settings sections", "myAlerts": "My alerts", "channels": "Channels and devices", "table": "Tables",
    "prefsHelp": "Your choices are saved for this server.",
    "enabled": "Receive alerts from this server", "categories": "Alert types",
    "manual": "Administrator notices", "scheduled": "Scheduled notices", "rules": "Metric alerts",
    "web": "Browser notifications", "mobile": "Mobile app notifications",
    "channelsHelp": "The browser needs permission; connect the app to this panel to register your phone.",
    "enableWeb": "Enable this browser", "disableWeb": "Remove this browser", "test": "Send test", "save": "Save preferences",
    "webUnsupported": "This browser does not support push notifications",
    "permissionDenied": "Allow notifications in your browser settings",
    "webEnabled": "Browser enabled", "webDisabled": "Browser removed"
  },
  "history": {
    "title": "Delivery history", "hint": "Accepted means the provider received the alert; it does not confirm display on the device.",
    "refresh": "Refresh", "more": "Load more", "panel": "Panel", "empty": "No alerts have been sent yet.",
    "states": { "stored": "Saved", "existing": "Already recorded", "accepted": "Accepted", "failed": "Failed", "unavailable": "No device" }
  },
  "prefs": {
    "hint": "These preferences are delivered to your devices (web/desktop/app).",
    "enabled": "Notifications enabled",
    "enabledHint": "Master switch for this server's alerts.",
    "statusEnabled": "Status alerts",
    "accessEnabled": "Access alerts",
    "cpuPct": "CPU threshold",
    "ramPct": "RAM threshold",
    "diskPct": "Disk threshold",
    "saved": "Preferences saved"
  },
  "send": {
    "hint": "Send an immediate notification to your devices.",
    "title": "Title",
    "body": "Message",
    "signals": "Signals",
    "signalsPlaceholder": "deploy, critical",
    "signalsHint": "Optional comma-separated tags to classify the alert.",
    "submit": "Send",
    "required": "Title and message are required",
    "sent": "Notification sent",
    "adminOnly": "Only an administrator can send notices to all users."
  },
  "scheduled": {
    "title": "Scheduled notifications",
    "add": "New scheduled",
    "fieldTitle": "Title",
    "fieldBody": "Message",
    "mode": "Mode",
    "modeOnce": "Once",
    "modeCron": "Cron",
    "scheduleAt": "Date and time",
    "cron": "Cron expression",
    "cronPlaceholder": "0 9 * * 1",
    "cronHint": "5 fields: minute hour day-of-month month day-of-week (e.g. 0 9 * * 1).",
    "timeZone": "Time zone",
    "future": "Choose a future date",
    "recurring": "Recurring",
    "enabled": "Active",
    "when": "When",
    "lastFired": "Last fired",
    "empty": "No scheduled notifications.",
    "required": "Title and message are required",
    "cronRequired": "Enter a 5-field cron expression",
    "atRequired": "Enter date and time",
    "created": "Scheduled notification created",
    "deleted": "Notification deleted",
    "confirmDelete": "Delete the notification {name}?",
    "confirmDeleteTitle": "Delete notification"
  },
  "rules": {
    "title": "Metric rules",
    "add": "New rule",
    "name": "Name",
    "metric": "Metric",
    "metricCpu": "CPU",
    "metricRam": "RAM",
    "metricDisk": "Disk",
    "metricLoad": "Load",
    "metricServiceDown": "Service down",
    "op": "Operator",
    "threshold": "Threshold",
    "thresholdHint": "Comparison value (percent for CPU/RAM/disk; load average for load).",
    "service": "Service",
    "servicePlaceholder": "nginx",
    "serviceHint": "systemd unit name (e.g. nginx).",
    "cooldown": "Cooldown",
    "minutes": "min",
    "condition": "Condition",
    "isDown": "down",
    "enabled": "Active",
    "empty": "No metric rules.",
    "nameRequired": "Enter a name",
    "thresholdRequired": "Enter a threshold",
    "serviceRequired": "Enter the service name (systemd unit)",
    "created": "Rule created",
    "deleted": "Rule deleted",
    "confirmDelete": "Delete the rule {name}?",
    "confirmDeleteTitle": "Delete rule",
    "opDown": "down"
  },
  "common": {
    "loading": "Loading...",
    "error": "Error",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "yes": "Yes",
    "no": "No"
  },
  "units": {
    "percent": "%"
  }
} as const;

export default serverAlerts;
