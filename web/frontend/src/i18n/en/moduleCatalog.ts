const moduleCatalog = {
  "users": {
    "name": "Users",
    "description": "Manage panel users, roles and permissions."
  },
  "mail": {
    "name": "Mail",
    "description": "SMTP / IMAP, domains and user mailboxes."
  },
  "monitor": {
    "name": "Monitor",
    "description": "Live CPU, RAM, disk and process metrics."
  },
  "files": {
    "name": "Files",
    "description": "Remote file explorer with a built-in editor."
  },
  "firewall": {
    "name": "Firewall",
    "description": "Manage UFW rules and IP blocking."
  },
  "bitninja": {
    "name": "BitNinja",
    "description": "All-in-one security agent: WAF, anti-DoS, malware detection and IP reputation."
  },
  "assistant": {
    "name": "AI Agents",
    "description": "AI assistant for diagnostics and automation."
  },
  "repository-store": {
    "name": "GitHub",
    "description": "Repository catalog with guided installation."
  },
  "dns": {
    "name": "Nginx",
    "description": "Nginx management: sites, reverse proxy, SSL, logs and status."
  },
  "backups": {
    "name": "Backups",
    "description": "Scheduled backups with encryption and multiple destinations."
  },
  "cron": {
    "name": "Cron",
    "description": "Scheduled tasks with a visual editor."
  },
  "databases": {
    "name": "Databases",
    "description": "Database manager (MySQL/MariaDB and PostgreSQL): browse schemas and run a SQL console."
  },
  "obsidian": {
    "name": "Obsidian",
    "description": "Obsidian note vaults on your server: markdown editor, wikilinks and notes operated by the assistant's AI agents."
  },
  "cloudflare": {
    "name": "Cloudflare",
    "description": "Cloudflare management for the server: DNS, cache, SSL/TLS, development mode and IP access rules."
  },
  "server-alerts": {
    "name": "Notifications",
    "description": "Server notifications for the panel owner: alert preferences, immediate notices, scheduled/recurring alerts and metric-based rules (CPU/RAM/disk/load/service down), delivered to their devices via LP."
  },
  "expo": {
    "name": "Expo",
    "description": "Manage Expo/React Native apps: EAS builds, store submissions, OTA updates, dev-client QR codes and quotas, using a client access token."
  },
  "webhooks": {
    "name": "Webhooks",
    "description": "HTTP notifications for panel events."
  },
  "openclaw": {
    "name": "OpenClaw",
    "description": "Connect to OpenClaw AI with a model selector."
  },
  "hosting": {
    "name": "Hosting",
    "description": "Sites, vhosts and assisted deployments."
  },
  "terminal": {
    "name": "Terminal",
    "description": "Floating terminal accessible from any panel view. Turn the floating button on or off."
  },
  "module-dev": {
    "name": "My modules",
    "description": "Lifecycle of your marketplace modules: review status, submissions, tests and private preview."
  },
  "filesystem-mcp": {
    "name": "Filesystem MCP",
    "description": "MCP for filesystem operations."
  },
  "github-mcp": {
    "name": "GitHub MCP",
    "description": "MCP for operations against the GitHub API."
  },
  "google-drive": {
    "name": "Google Drive",
    "description": "Search and attach documents from your Google Drive directly in the assistant chat."
  },
  "onedrive": {
    "name": "OneDrive",
    "description": "Access Microsoft OneDrive / SharePoint files from the chat."
  },
  "dropbox": {
    "name": "Dropbox",
    "description": "Search and attach Dropbox files from the chat."
  },
  "notion": {
    "name": "Notion",
    "description": "Browse Notion pages and databases from the chat."
  }
} as const;

export default moduleCatalog;
