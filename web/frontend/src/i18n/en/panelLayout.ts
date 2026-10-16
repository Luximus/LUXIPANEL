const panelLayout = {
  "community": {
    "localChangesBlocked": "Local changes still need to be integrated. The update was not started so they remain intact.",
    "branchNotesUnavailable": "A public description of these updates is not available yet.",
    "branchNotesPartial": "Some changes do not have explanatory notes yet.",
    "branches": "Branch",
    "releases": "Published releases",
    "branchChanges": "Branch changes",
    "branchUpdate": "Update from {branch}",
    "branchCurrent": "This revision is already installed.",
    "branchUnavailable": "This branch does not contain a complete panel installation.",
    "branchPreview": "Branches may include changes in development. Installation only starts when you click Update.",
    "colorHelp": "Badge colors",
    "releaseColorHelp": "Green: a new published LUXIPANEL release.",
    "branchColorHelp": "{branch}: new changes available.",
    "installedRevision": "Installed revision",
    "selectedRevision": "Selected revision",
    "noBranchChanges": "No new changes compared with the local code.",
    "unregisteredRevision": "Local code without a recorded installed revision",
    "branchLoadError": "Could not load changes for this branch.",
    "notesTab": "Notes",
    "activityTab": "Activity",
    "contributors": "Contributors",
    "contributorsUnavailable": "Contributors could not be loaded.",
    "translationInsufficientBalance": "The AI provider has insufficient API credit for translation. The original text is shown.",
    "newBadge": "new",
    "updateTo": "Update to {version}",
    "title": "Community and releases",
    "comments": "Comments",
    "read": "Mark as read",
    "empty": "No updates",
    "notes": "Release notes",
    "update": "Update",
    "updating": "Updating…",
    "installed": "Installed",
    "version": "Version",
    "openGithub": "Open on GitHub",
    "close": "Close",
    "newVersion": "New version available",
    "translating": "Translating with AI…",
    "showOriginal": "Show original",
    "showTranslation": "Show translation",
    "translationUnavailable": "AI translation is unavailable. Showing the original text.",
    "allComments": "See all comments on GitHub",
    "activity": "Community activity",
    "loading": "Loading…",
    "loadError": "Could not load this information."
},
  "groups": {
    "main": "Main",
    "system": "System",
    "admin": "Administration",
    "tools": "Tools",
    "modules": "Modules"
  },
  "nav": {
    "monitor": "Monitor",
    "files": "Files",
    "firewall": "Firewall",
    "bitninja": "BitNinja",
    "users": "Users",
    "assistant": "AI Agents",
    "terminal": "Terminal",
    "modules": "Modules",
    "githubStore": "GitHub",
    "settings": "Settings",
    "mail": "Mail",
    "dns": "NGINX",
    "backups": "Backups",
    "cron": "Cron",
    "databases": "Databases",
    "obsidian": "Obsidian",
    "cloudflare": "Cloudflare",
    "serverAlerts": "Notifications",
    "ssl": "SSL",
    "webhooks": "Webhooks",
    "hosting": "Hosting",
    "openclaw": "OpenClaw",
    "preferences": "My preferences",
    "moduleDev": "Module Dev",
    "expo": "Expo",
    "codebaseGraph": "Codebase Graph"
  },
  "actions": {
    "closeSession": "Sign out",
    "closingSession": "Signing out…",
    "openMenu": "Open menu",
    "openHistory": "Open history",
    "openCommandPalette": "Open command palette",
    "search": "Search...",
    "settings": "Settings",
    "switchTheme": "Switch theme",
    "notifications": "Notifications",
    "chat": "Messages",
    "navigate": "Navigate",
    "open": "Open",
    "close": "Close",
    "toggleFilesEditor": "File editor",
    "noResults": "No results for",
    "lightMode": "Switch to light mode",
    "darkMode": "Switch to dark mode"
  },
  "superSearch": {
    "placeholder": "Search LUXIPANEL and chats…",
    "triggerLabel": "Search LUXIPANEL",
    "recent": "Recent",
    "suggestions": "Suggestions",
    "aiSuggested": "AI suggested",
    "noResults": "No results",
    "hint": "Search views, actions, and chat messages in the selected project.",
    "kinds": {
      "view": "View",
      "subview": "Page",
      "tab": "Tab",
      "drawer-section": "Section",
      "action": "Action"
    },
    "groups": {
      "actions": "Actions",
      "views": "Views"
    }
  },
  "clock": {
    "serverTimeTitle": "Server time"
  },
  "serverSwitcher": {
    "label": "Switch server",
    "title": "Switch server",
    "currentOption": "{server} (switch)",
    "connectingTitle": "Connecting to server...",
    "connectingStatus": "Preparing new connection session.",
    "changeServer": "Change server...",
    "localOption": "Local (this box)",
    "manageServers": "Manage servers...",
    "viewServers": "View servers...",
    "noOtherServers": "No servers registered",
    "sshKeyFallback": "Key {n}",
    "chooseSshKey": "Choose SSH key",
    "chooseSshKeyHelp": "There is more than one user configured for this server. Select which one to connect with.",
    "cancel": "Cancel",
    "openingConnection": "Opening secure connection to the new server...",
    "unknownError": "Unknown error",
    "switchFailedStatus": "Could not switch server ({detail}).",
    "switchFailedAlert": "Could not establish connection with the new server: {detail}",
    "connectionErrorTitle": "Connection error",
    "returnButton": "Return",
    "returnTitle": "Return to the local server"
  },
  "notificationsPanel": {
    "title": "Notifications",
    "subtitle": "System, module, and AI messages",
    "markAllTitle": "Mark all as read",
    "filters": {
      "all": "All",
      "system": "System",
      "module": "Modules",
      "ai": "AI",
      "security": "Security",
      "user": "Chat"
    },
    "loading": "Loading...",
    "clearAll": "Clear all",
    "connecting": "Connecting...",
    "live": "Live",
    "retrying": "Retrying...",
    "disconnected": "Disconnected",
    "errorLoad": "Notifications could not be loaded.",
    "empty": "No notifications.",
    "emptyFiltered": "No notifications in this filter.",
    "dismiss": "Delete notification",
    "sources": {
      "system": "System",
      "module": "Module",
      "ai": "AI",
      "security": "Security",
      "user": "Chat"
    },
    "severity": {
      "info": "Info",
      "success": "Success",
      "warning": "Warning",
      "error": "Error"
    },
    "relative": {
      "now": "just now",
      "min": "{n} min ago",
      "h": "{n} h ago",
      "d": "{n} d ago",
      "mo": "{n} mo ago",
      "y": "{n} y ago"
    }
  },
  "chatPanel": {
    "title": "Messages",
    "newConversation": "New conversation",
    "seeMore": "See more",
    "loading": "Loading...",
    "empty": "You have no conversations yet.",
    "errorLoad": "Could not load the chats.",
    "connecting": "Connecting...",
    "live": "Live",
    "retrying": "Retrying...",
    "disconnected": "Disconnected",
    "you": "You",
    "attachment": "Attachment",
    "newMessage": "New message",
    "newMessageIn": "New message in {title}",
    "unknownUser": "User",
    "callIncoming": "Incoming call",
    "callIncomingHint": "Audio with real-time translation",
    "callAccept": "Accept",
    "callReject": "Decline"
  },
  "commandSub": {
    "main": "Main",
    "system": "System",
    "admin": "Administration",
    "tools": "Tools",
    "account": "Account",
    "action": "Action"
  },
  "defaultUser": "User",
  "logoAlt": "LUXIPANEL",
  "searchEntries": {
    "view.chat": "Internal chat",
    "chat.action.new-conversation": "New conversation",
    "chat.media": "Conversation media",
    "chat.call": "Start a call",
    "chat.settings": "Messaging settings",
    "chat.settings.general": "Chat · General",
    "chat.settings.presence": "Chat · Presence",
    "chat.settings.calls": "Chat · Calls",
    "chat.settings.appearance": "Chat · Appearance",
    "chat.settings.groups": "Chat · Groups",
    "users.tab.users": "Users",
    "users.tab.roles": "Roles",
    "users.action.new-user": "New user",
    "users.action.new-role": "New role",
    "mail.tab.emails": "Accounts",
    "mail.action.new-account": "New mail account",
    "mail.tab.spam": "Spam filters",
    "mail.tab.track": "Delivery tracking",
    "mail.tab.global-filters": "Global filters",
    "mail.settings.routing": "Mail routing",
    "mail.settings.domain-redirect": "Domain forwarders",
    "mail.settings.default-address": "Default address",
    "mail.settings.archive": "Mail archive",
    "mail.settings.encryption": "Encryption",
    "mail.settings.outbound": "Outbound mail",
    "mail.subview.compose": "Compose email",
    "nginx.action.new-site": "New site",
    "nginx.action.https": "Enable HTTPS / SSL certificate",
    "nginx.action.proxy": "Reverse proxy upstream",
    "nginx.action.edit-conf": "Edit nginx.conf",
    "firewall.action.new-rule": "New rule",
    "firewall.action.ban-ip": "Block IP",
    "firewall.action.audit": "Security audit",
    "backups.action.now": "Backup now",
    "backups.action.new-storage": "New storage",
    "backups.action.new-schedule": "New schedule",
    "cron.action.new-agent": "New AI job",
    "databases.tab.rows": "Rows",
    "databases.tab.structure": "Structure",
    "databases.tab.console": "SQL console",
    "cloudflare.tab.dns": "DNS",
    "cloudflare.tab.cache": "Cache",
    "cloudflare.tab.security": "Security",
    "cloudflare.tab.access": "Access",
    "cloudflare.tab.config": "Configuration",
    "webhooks.tab.receive": "Receive",
    "webhooks.tab.mailhook": "Mailhook",
    "webhooks.tab.response": "Responses",
    "webhooks.tab.webhooks": "Outgoing webhooks",
    "webhooks.tab.keys": "API keys",
    "webhooks.tab.discovered": "Discovered",
    "server-alerts.tab.prefs": "Preferences",
    "server-alerts.tab.send": "Send",
    "server-alerts.tab.scheduled": "Scheduled",
    "server-alerts.tab.rules": "Alert rules",
    "repository-store.tab.saved": "Saved",
    "repository-store.tab.cloned": "Cloned",
    "repository-store.tab.update": "Updates",
    "modules.tab.installed": "Installed",
    "modules.tab.integrations": "Integrations",
    "settings.tab.general": "General",
    "settings.tab.layout": "Design & branding",
    "settings.tab.security": "Security",
    "settings.tab.credentials": "Credentials",
    "settings.credentials.elevenlabs": "ElevenLabs credential",
    "settings.credentials.tolqia": "Tolqia API token",
    "settings.tab.servers": "Servers",
    "settings.tab.modules": "Modules & cache",
    "settings.tab.system": "System",
    "preferences.section.profile": "Profile",
    "preferences.section.password": "Change password",
    "preferences.section.passkeys": "Passkeys",
    "preferences.section.2fa": "Two-factor (2FA)",
    "preferences.section.audit": "Activity log",
    "assistant.settings.general": "General",
    "assistant.settings.agentes": "Agents",
    "assistant.settings.providers": "Providers",
    "assistant.settings.modules": "Modules & tools",
    "assistant.settings.stats": "Usage & costs",
    "assistant.settings.access": "Access & approvals",
    "assistant.action.new-conversation": "New AI conversation",
    "assistant.action.new-project": "New project",
    "action.theme-dark": "Switch to dark mode",
    "action.theme-light": "Switch to light mode",
    "action.language": "Change language",
    "action.server-switcher": "Switch server",
    "action.sidebar-toggle": "Collapse or expand menu",
    "action.logout": "Sign out"
  },
  "workspaceViews": {
    "assistant": {
      "chat": "Conversations"
    },
    "users": {
      "users": "Users",
      "roles": "Groups"
    },
    "monitor": {
      "history": "History",
      "processes": "Processes"
    },
    "files": {
      "browser": "Browser",
      "editor": "Editor"
    },
    "firewall": {
      "audit": "Audit",
      "rules": "UFW rules",
      "fail2ban": "Fail2ban"
    },
    "bitninja": {
      "status": "Status",
      "components": "Components",
      "logs": "Log"
    },
    "mail": {
      "emails": "Mail",
      "spam-filters": "Spam filters",
      "track-delivery": "Delivery",
      "global-filters": "Filters"
    },
    "dns": {
      "overview": "Overview",
      "sites": "Sites and HTTPS",
      "proxy": "Traffic",
      "perf": "Performance",
      "logs": "Logs",
      "status": "Service"
    },
    "nginx": {
      "overview": "Overview",
      "sites": "Sites and HTTPS",
      "proxy": "Traffic",
      "perf": "Performance",
      "logs": "Logs",
      "status": "Service"
    },
    "backups": {
      "overview": "Overview",
      "schedules": "Schedules",
      "history": "History"
    },
    "cron": {
      "jobs": "Jobs",
      "agents": "AI agents"
    },
    "databases": {
      "databases": "Databases",
      "tables": "Tables",
      "console": "SQL console"
    },
    "obsidian": {
      "vaults": "Vaults and notes",
      "editor": "Editor"
    },
    "cloudflare": {
      "dns": "DNS",
      "cache": "Cache",
      "security": "Security",
      "access": "Access",
      "config": "Settings"
    },
    "server-alerts": {
      "prefs": "Preferences",
      "send": "Send",
      "scheduled": "Scheduled",
      "rules": "Rules",
      "history": "History"
    },
    "expo": {
      "account": "Account",
      "projects": "Projects",
      "builds": "Builds",
      "store": "Stores",
      "environment": "Environment"
    },
    "module-dev": {
      "my-modules": "My modules",
      "project-map": "Project map"
    },
    "terminal": {
      "terminal": "Terminal"
    },
    "repository-store": {
      "all": "Explore",
      "saved": "Saved",
      "cloned": "Cloned",
      "update": "Updates"
    },
    "webhooks": {
      "receive": "Receive",
      "webhooks": "Webhooks",
      "keys": "Keys",
      "discovered": "Discovered"
    },
    "openclaw": {
      "assistant": "Assistant"
    },
    "hosting": {
      "accounts": "Accounts",
      "new": "New account"
    },
    "codebase-graph": {
      "graph": "Visual graph",
      "symbols": "Symbols"
    },
    "preferences": {
      "profile": "Profile",
      "security": "Security",
      "audit": "Activity"
    },
    "settings": {
      "settings": "Settings"
    },
    "modules": {
      "catalog": "Catalog"
    },
    "chat": {
      "chat": "Chat"
    },
    "_default": {
      "overview": "Overview"
    }
  },
  "workspace": {
    "closeModuleBackToChat": "Close module and return to chat",
    "module": "Module",
    "loadingModule": "Loading module…",
    "moduleFrameTitle": "LUXIPANEL module",
    "loadingSettings": "Loading settings…",
    "closeHistory": "Close history"
  }
} as const;

export default panelLayout;
