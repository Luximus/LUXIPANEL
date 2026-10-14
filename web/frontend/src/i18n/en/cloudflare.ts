const cloudflare = {
  "options": {
    "essentiallyOff": "Essentially Off",
    "low": "Low",
    "medium": "Medium",
    "high": "High"
  },
  "pageTitle": "Cloudflare",
  "header": {
    "heading": "Cloudflare",
    "subheading": "Manage DNS, cache, SSL/TLS and security for this server's Cloudflare zones."
  },
  "config": {
    "title": "Cloudflare connection",
    "tokenLabel": "API Token",
    "tokenPlaceholder": "Cloudflare API token",
    "tokenHint": "Create a token at dash.cloudflare.com → My Profile → API Tokens with zone permissions: DNS, Cache Purge, Zone Settings and Firewall Services.",
    "save": "Save",
    "test": "Test connection",
    "clear": "Remove token",
    "tokenSet": "Token configured",
    "tokenMissing": "Configure an API token to get started",
    "saved": "Token saved",
    "cleared": "Token removed",
    "confirmClear": "Remove Cloudflare token?",
    "confirmClearBtn": "Remove"
  },
  "zones": {
    "title": "Zone",
    "select": "Select a zone",
    "empty": "No zones visible with this token.",
    "status": "Status",
    "plan": "Plan",
    "nameServers": "Name Servers",
    "domainNotFound": "Domain {domain} does not belong to any zone in this token"
  },
  "runtime": {
    "active": "Active",
    "pending": "Pending",
    "initializing": "Initializing",
    "moved": "Moved",
    "paused": "paused",
    "pausedHint": "Paused zone: review the configuration before changing DNS.",
    "inactiveHint": "Zone {status}: check the name servers at your registrar.",
    "activeHint": "Active zone · {count} name servers configured."
  },
  "tabs": {
    "dns": "DNS",
    "cache": "Cache",
    "security": "SSL / Security",
    "access": "Access rules",
    "config": "Settings"
  },
  "dns": {
    "title": "DNS records",
    "add": "Add record",
    "type": "Type",
    "name": "Name",
    "content": "Content",
    "ttl": "TTL",
    "proxied": "Proxied",
    "pointsToServer": "Points to this server",
    "edit": "Edit",
    "delete": "Delete",
    "confirmDelete": "Delete record {name}?",
    "saved": "Record saved",
    "deleted": "Record deleted",
    "useServerIp": "Use server IP",
    "priority": "Priority",
    "confirmDeleteTitle": "Delete record",
    "typeA": "A",
    "typeAAAA": "AAAA",
    "typeCNAME": "CNAME",
    "typeTXT": "TXT",
    "typeMX": "MX",
    "typeNS": "NS",
    "ttlAuto": "Auto",
    "ttl60": "60",
    "ttl300": "300",
    "ttl1800": "1800",
    "ttl3600": "3600",
    "ttl86400": "86400"
  },
  "cache": {
    "title": "Cache",
    "purgeAll": "Purge everything",
    "purgeAllHint": "Removes all cached content for the zone on Cloudflare.",
    "confirmPurgeAll": "Purge ALL cache for this zone?",
    "purgeUrls": "Purge URLs",
    "purgeUrlsPlaceholder": "https://example.com/styles.css (one URL per line)",
    "purged": "Cache purged",
    "devMode": "Development mode",
    "devModeHint": "Temporarily bypasses Cloudflare cache (auto-disables after 3 hours).",
    "confirmPurgeTitle": "Purge cache",
    "confirmPurgeBtn": "Purge"
  },
  "security": {
    "title": "SSL / Security",
    "sslMode": "SSL/TLS mode",
    "alwaysHttps": "Always use HTTPS",
    "securityLevel": "Security level",
    "underAttack": "Under attack mode",
    "updated": "Setting updated",
    "sslOff": "Off",
    "sslFlexible": "Flexible",
    "sslFull": "Full",
    "sslFullStrict": "Full (strict)"
  },
  "access": {
    "title": "IP access rules",
    "add": "Add rule",
    "mode": "Action",
    "block": "Block",
    "allow": "Allow",
    "challenge": "Challenge",
    "ip": "IP / range",
    "notes": "Notes",
    "empty": "No access rules in this zone.",
    "confirmDelete": "Delete the rule for {ip}?",
    "created": "Rule created",
    "deleted": "Rule deleted",
    "ipHeader": "IP",
    "confirmDeleteTitle": "Delete rule"
  },
  "common": {
    "loading": "Loading...",
    "error": "Error",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "refresh": "Refresh",
    "serverIp": "Server IP",
    "noToken": "Configure the Cloudflare API token in the Settings tab."
  },
  "settingsUi": {
    "title": "Cloudflare settings",
    "description": "Table preferences for the Cloudflare module.",
    "access": "Access",
    "credentialsConnections": "Credentials and connections",
    "cloudflareToken": "Cloudflare token",
    "serverFirewall": "Server firewall",
    "dnsWebhooks": "DNS events in Webhooks"
  }
} as const;

export default cloudflare;
