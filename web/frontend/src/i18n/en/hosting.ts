const hosting = {
  "pageTitle": "Shared hosting",
  "pageSubtitle": "Manage your clients' hosting accounts · WHM-style multi-tenant",
  "btnNewAccount": "New account",
  "options": {
    "planBasic": "Basic",
    "planPro": "Pro",
    "planBusiness": "Business",
    "planCustom": "Custom"
  },
  "stats": {
    "total": "Total accounts",
    "active": "Active",
    "suspended": "Suspended",
    "terminated": "Terminated",
    "title": "Usage of {username}",
    "disk": "Disk (MB)",
    "domains": "Domains",
    "emails": "Email accounts",
    "databases": "Databases",
    "subusers": "Sub-users",
    "bandwidth": "Bandwidth (MB)",
    "percentUsed": "% used",
    "method": "Measurement method",
    "methodDu": "du estimate (best-effort)",
    "methodQuotaTools": "System quota (quota-tools)"
  },
  "tableTitle": "accounts",
  "modal": {
    "titleNew": "New hosting account",
    "tabs": {
      "account": "Account",
      "resources": "Resources",
      "security": "Modules & security"
    },
    "labelUsername": "Username *",
    "labelPassword": "Password *",
    "labelName": "Name",
    "labelEmail": "Email",
    "labelPlan": "Plan",
    "resourcesTitle": "Resource limits",
    "labelDisk": "Disk (MB)",
    "labelBandwidth": "Bandwidth (MB)",
    "labelDomains": "Domains",
    "labelEmails": "Email accounts",
    "labelNotes": "Internal notes",
    "btnCancel": "Cancel",
    "btnCreate": "Create account",
    "hintUsername": "Lowercase, numbers, - and _ only",
    "phUsername": "exampleclient",
    "phPassword": "minimum 8 characters",
    "phName": "Company Inc.",
    "phEmail": "admin@company.com",
    "phNotes": "Optional notes…",
    "labelStatus": "Status",
    "labelTenantGroup": "Tenant group",
    "labelHomeRoot": "Home root",
    "hintTenantGroup": "The account's dedicated Linux group (read-only).",
    "hintHomeRoot": "The tenant's root on the VPS (read-only).",
    "labelDiskQuotaMb": "Disk quota (MB)",
    "labelBandwidthQuotaMb": "Bandwidth quota (MB)",
    "labelMaxDomains": "Max. domains",
    "labelMaxEmailAccounts": "Max. email accounts",
    "labelMaxDatabases": "Max. databases",
    "labelMaxSubUsers": "Max. sub-users",
    "labelAllowedModules": "Allowed modules",
    "labelJailEnabled": "Isolate shell (chroot)",
    "hintJailEnabled": "Confines this account's terminal/SSH to its own folder (chroot jail).",
    "modulesLoading": "Loading modules…",
    "labelExpiresAt": "Expiration date",
    "hintExpiresAt": "Leave empty for no expiration",
    "labelModules": "Allowed modules",
    "hintModules": "Define which panel modules this client can access.",
    "labelDatabases": "Databases",
    "labelSubUsers": "Sub-users",
    "labelJail": "Isolate shell (chroot)",
    "hintJail": "Confines this account's terminal/SSH to its folder (chroot jail).",
    "titleEdit": "Edit: {username}"
  },
  "pwdModal": {
    "title": "Change password",
    "labelNew": "New password",
    "phPassword": "minimum 8 characters",
    "btnCancel": "Cancel",
    "btnChange": "Change"
  },
  "apiPageTitle": "Hosting API Documentation",
  "apiSubtitle": "Automated management of shared hosting accounts",
  "apiIntro": "The Reseller API lets you automate the creation, update, suspension and deletion of hosting accounts from any external system — your own billing platform, WHMCS, Bash scripts, Zapier integrations, etc. It is compatible with any language or tool that can make HTTP requests.",
  "toc": {
    "label": "Contents",
    "items": [
      "1. Authentication",
      "2. Isolation and security",
      "3. Available endpoints",
      "4. Create account",
      "5. List accounts",
      "6. Get account",
      "7. Update account",
      "8. Suspend / Reactivate",
      "9. Change password",
      "10. Account statistics",
      "11. Delete account",
      "12. Hosting account login",
      "13. Error codes",
      "14. Complete examples"
    ]
  },
  "auth": {
    "title": "Authentication",
    "intro": "All Reseller API endpoints accept two authentication methods:",
    "apiKeyTitle": "API Key (recommended for automation)",
    "apiKeyDesc": "Generate an API key from Panel → Webhooks → API Keys. Send it in the Authorization header:",
    "sessionTitle": "Admin session (from the panel)",
    "sessionDesc": "If you are making requests from the LuxiPanel itself (for example, from JavaScript in the browser), your administrator session cookie is accepted automatically.",
    "warningTitle": "Important:",
    "warningText": "Never expose your API key in client-side code (JavaScript in the browser, mobile apps, etc.). Use it exclusively from servers or private environments."
  },
  "isolation": {
    "title": "Isolation and security",
    "intro": "Each hosting account is a completely isolated environment. This ensures that no client can view or modify another's resources, regardless of whether they attempt to do so via the web panel, API, SSH console or any other vector.",
    "features": [
      {
        "title": "Isolated data",
        "desc": "Mailboxes, domains, DNS, SSL and backups are tied to each account's tenant_id. SQL queries never cross tenants."
      },
      {
        "title": "File system",
        "desc": "Each account has its own home directory (/home/username). The file explorer and console are restricted to that directory."
      },
      {
        "title": "Independent sessions",
        "desc": "A hosting account's JWT includes its tenantId. The backend rejects any request that tries to access resources outside that scope."
      }
    ]
  },
  "endpoints": {
    "title": "Available endpoints",
    "colMethod": "Method",
    "colPath": "Path",
    "colDesc": "Description",
    "colAuth": "Auth",
    "rows": [
      [
        "POST",
        "/api/hosting/accounts",
        "Create hosting account",
        "Admin / API Key"
      ],
      [
        "GET",
        "/api/hosting/accounts",
        "List accounts (paginated)",
        "Admin / API Key"
      ],
      [
        "GET",
        "/api/hosting/accounts/:id",
        "Get a single account",
        "Admin / API Key"
      ],
      [
        "PUT",
        "/api/hosting/accounts/:id",
        "Update account",
        "Admin / API Key"
      ],
      [
        "DELETE",
        "/api/hosting/accounts/:id",
        "Delete account and all its data",
        "Admin / API Key"
      ],
      [
        "POST",
        "/api/hosting/accounts/:id/suspend",
        "Suspend account",
        "Admin / API Key"
      ],
      [
        "POST",
        "/api/hosting/accounts/:id/unsuspend",
        "Reactivate suspended account",
        "Admin / API Key"
      ],
      [
        "POST",
        "/api/hosting/accounts/:id/change-password",
        "Change password",
        "Admin / API Key"
      ],
      [
        "GET",
        "/api/hosting/accounts/:id/stats",
        "Usage statistics",
        "Admin / API Key"
      ],
      [
        "POST",
        "/api/hosting/auth/login",
        "Hosting account login",
        "Public"
      ],
      [
        "POST",
        "/api/hosting/auth/logout",
        "Hosting logout",
        "Hosting session"
      ]
    ]
  },
  "create": {
    "title": "Create account",
    "labelBody": "Body (JSON)",
    "labelResp": "201 Response"
  },
  "list": {
    "title": "List accounts",
    "labelParams": "Query params",
    "colParam": "Parameter",
    "colType": "Type",
    "colDefault": "Default",
    "colDesc": "Description",
    "labelResp": "200 Response",
    "params": [
      [
        "page",
        "integer",
        "1",
        "Current page"
      ],
      [
        "limit",
        "integer",
        "20",
        "Results per page (max 100)"
      ],
      [
        "search",
        "string",
        "—",
        "Search in username, displayName, email"
      ],
      [
        "status",
        "string",
        "—",
        "active | suspended | terminated"
      ]
    ]
  },
  "compactEndpoints": [
    {
      "id": "get",
      "num": "6",
      "title": "Get account",
      "method": "GET",
      "path": "/api/hosting/accounts/:id",
      "note": "Returns the account object without the passwordHash field."
    },
    {
      "id": "update",
      "num": "7",
      "title": "Update account",
      "method": "PUT",
      "path": "/api/hosting/accounts/:id",
      "note": "Accepts the same fields as create (except username and password). Only the fields sent are updated."
    },
    {
      "id": "suspend",
      "num": "8",
      "title": "Suspend / Reactivate",
      "method": "POST",
      "path": "/api/hosting/accounts/:id/suspend  |  /unsuspend",
      "note": "Suspending blocks the client's access immediately. Unsuspend restores the status to 'active'. No body required."
    },
    {
      "id": "password",
      "num": "9",
      "title": "Change password",
      "method": "POST",
      "path": "/api/hosting/accounts/:id/change-password",
      "note": "Body: {\"password\": \"NewPass123!\"} — minimum 8 characters."
    },
    {
      "id": "stats",
      "num": "10",
      "title": "Usage statistics",
      "method": "GET",
      "path": "/api/hosting/accounts/:id/stats",
      "note": "Returns configured quotas and current usage of disk, bandwidth, active domains and email accounts."
    },
    {
      "id": "delete",
      "num": "11",
      "title": "Delete account",
      "method": "DELETE",
      "path": "/api/hosting/accounts/:id",
      "note": "⚠️ Irreversible. Deletes the account and, via ON DELETE CASCADE, all its resources: mailboxes, domains, DNS, SSL and backups."
    }
  ],
  "login": {
    "title": "Hosting account login",
    "badgePublic": "· Public",
    "desc": "The client enters their credentials on the login panel. If valid, a session of kind: \"hosting\" is created that restricts access exclusively to the resources of their account.",
    "labelBody": "Body",
    "labelResp": "200 Response"
  },
  "errors": {
    "title": "Error codes",
    "intro": "All errors follow the same envelope:",
    "colHttp": "HTTP",
    "colCode": "Code",
    "colDesc": "Description",
    "rows": [
      [
        "400",
        "VALIDATION_ERROR",
        "Invalid or missing fields"
      ],
      [
        "401",
        "AUTH_ERROR",
        "Invalid, expired or missing API key"
      ],
      [
        "403",
        "FORBIDDEN",
        "You don't have permission for this operation"
      ],
      [
        "404",
        "NOT_FOUND",
        "The requested account does not exist"
      ],
      [
        "409",
        "CONFLICT",
        "The username is already in use"
      ],
      [
        "429",
        "RATE_LIMIT",
        "Too many requests — wait before retrying"
      ],
      [
        "500",
        "INTERNAL_ERROR",
        "Internal server error"
      ]
    ],
    "generic": "Error",
    "unknown": "Unknown error"
  },
  "examples": {
    "title": "Full examples",
    "labelCurl": "Create account",
    "labelSuspend": "Suspend account",
    "labelList": "List with filters",
    "labelNodeClient": "Reusable client",
    "labelPhpHelper": "Helper class in PHP"
  },
  "table": {
    "columnStatus": "Status",
    "columnPlan": "Plan",
    "columnModules": "Modules",
    "columnCreated": "Created",
    "columnUpdated": "Updated",
    "columnTenantGroup": "Group",
    "columnHomeRoot": "Home",
    "modulesCount": "{count} modules"
  },
  "audit": {
    "title": "Audit of {username}",
    "eventType": "Event",
    "actor": "Actor",
    "date": "Date",
    "empty": "No events recorded."
  },
  "actions": {
    "editModules": "Edit modules",
    "viewStats": "View usage",
    "viewAudit": "View audit",
    "enableJail": "Enable jail",
    "disableJail": "Disable jail",
    "save": "Save",
    "saveChanges": "Save changes",
    "saving": "Saving…"
  },
  "confirm": {
    "enableJailBody": "Enable the chroot jail for this account? Its terminal/SSH will be confined to its folder.",
    "disableJailBody": "Disable the chroot jail? The account will revert to a normal shell (/bin/bash).",
    "suspendBody": "Suspend this account? The client will lose access.",
    "suspendTitle": "Suspend account",
    "suspendOk": "Yes, suspend",
    "deleteBody": "Delete account \"{username}\" and ALL its data (emails, domains, files)? This action cannot be undone.",
    "deleteTitle": "Delete account"
  },
  "jail": {
    "degraded": "jailkit is not installed on the server; the jail was not activated. Install jailkit and retry.",
    "degradedTitle": "Jail not applied",
    "enabledOk": "Jail enabled successfully."
  },
  "toasts": {
    "jailAlready": "The jail is already active",
    "jailNotActive": "The jail is not active",
    "notActive": "Account is not active",
    "notSuspended": "Account is not suspended"
  },
  "labels": {
    "statusActive": "Active",
    "statusSuspended": "Suspended",
    "statusTerminated": "Terminated"
  },
  "dataTable": {
    "columns": {
      "username": "User",
      "plan": "Plan",
      "estado": "Status",
      "modulos": "Modules",
      "tenantGroup": "Group",
      "homeRoot": "Home",
      "creado": "Created",
      "actualizado": "Updated"
    },
    "filters": {
      "searchUser": "Search by user…",
      "estado": "Status",
      "plan": "Plan",
      "statusActive": "Active",
      "statusSuspended": "Suspended",
      "statusTerminated": "Terminated"
    },
    "rowActions": {
      "edit": "Edit",
      "viewStats": "View usage",
      "viewAudit": "View audit",
      "password": "Change password",
      "suspend": "Suspend",
      "unsuspend": "Republish",
      "enableJail": "Enable jail",
      "disableJail": "Disable jail",
      "delete": "Delete"
    }
  },
  "runtime": {
    "defaultsLoadError": "Could not load the defaults.",
    "defaultsSaveError": "Could not save the values.",
    "defaultsSaved": "Values saved on the active server."
  },
  "settingsUi": {
    "title": "Hosting settings",
    "description": "Hosting accounts table preferences",
    "table": "Table",
    "apiProviders": "API providers",
    "rowsPerPage": "Rows per page in the accounts table.",
    "newAccountDefaults": "Defaults for new accounts",
    "defaultsHint": "Saved on the active server. Existing accounts are not changed.",
    "emailAccounts": "Emails",
    "subusers": "Subusers",
    "defaultJail": "Enable jail by default",
    "defaultModules": "Default modules (comma-separated IDs)",
    "saveDefaults": "Save defaults",
    "relatedModules": "Related modules",
    "users": "Users",
    "domainsSsl": "Domains and SSL",
    "showAll": "Show all",
    "hideAll": "Hide all",
    "providerConnections": "Hosting manager connections",
    "providerConnectionsHint": "LUXIPANEL provides the API. Each manager receives a key and access limited to one server, selected modules and operations.",
    "newProvider": "New provider",
    "managedServer": "Managed server",
    "localServer": "Local server",
    "panelHttpsOrigin": "LUXIPANEL HTTPS origin",
    "siteEngine": "Site engine on the server",
    "accountModules": "Account modules",
    "modulesHint": "Comma-separated IDs; HOSTING validates the catalog.",
    "apiOperations": "API operations",
    "readAccounts": "Read accounts",
    "createAccounts": "Create accounts",
    "accountStatus": "Account status and details",
    "viewUsage": "View usage",
    "linkSites": "Link sites",
    "panelAccess": "Panel access",
    "deleteAccounts": "Delete accounts",
    "createProviderKey": "Create provider and key",
    "copyKeyNow": "Copy the key now: it is shown only once.",
    "groupPolicy": {
      "editProvider": "Edit provider",
      "saveProvider": "Save provider",
      "templateTitle": "Initial group permissions",
      "templateHint": "Each new account receives these permissions in its own group. For existing accounts, edit the group in Users.",
      "permissions": "Detailed permissions",
      "sidebar": "Menus",
      "views": "Views",
      "actions": "Actions",
      "filesScope": "File access",
      "relativeHint": "One path per line, relative to each account’s folder. Use . for the entire folder.",
      "allowPaths": "Allowed folders",
      "denyPaths": "Blocked folders",
      "readOnlyPaths": "Read-only folders",
      "defaultPath": "Start folder",
      "commands": "Terminal commands",
      "allowAllCommands": "Allow all commands available to the user",
      "commandGroups": "Command groups",
      "allowedCommands": "Allowed commands, one per line",
      "deniedCommands": "Blocked commands, one per line",
      "saving": "Saving…",
      "saved": "Provider saved. Applies to new accounts.",
      "created": "Provider created.",
      "loading": "Loading providers and permissions…",
      "loadError": "Could not load settings.",
      "active": "Active",
      "revoked": "Revoked",
      "rotateKey": "Rotate key",
      "rotateSuccess": "Key rotated. Copy the new key.",
      "revoke": "Revoke access",
      "reactivate": "Reactivate",
      "accessUpdated": "Access updated.",
      "emptyProviders": "No providers configured yet."
},
    "apiGuide": "API guide",
    "retry": "Retry"
  },
  "apiDocs": {
    "pageTitle": "Hosting provider API",
    "backToHosting": "Back to HOSTING",
    "contractVersion": "HTTP contract · version 1",
    "heading": "Connect your hosting manager",
    "intro": "LUXIPANEL exposes this API so your manager can create accounts, link sites, and grant access under the permissions set in HOSTING.",
    "guideContents": "Guide contents",
    "preparation": "Setup",
    "authentication": "Authentication",
    "operations": "Operations",
    "example": "Example",
    "panelAccess": "Panel access",
    "limitsErrors": "Limits and errors",
    "preparationHeading": "Set up in HOSTING",
    "administrator": "Administrator",
    "scope": "Scope",
    "key": "Key",
    "adminStep": "Open HOSTING → Settings → API providers and create a provider.",
    "scopeStep": "Set the server, site engine, modules, quotas, and permitted operations.",
    "keyStep": "Copy the lhp_… key once and store it only in the manager backend.",
    "providerScopeNote": "Each provider belongs to one server. Accounts get their own Linux user and directory; the manager neither chooses nor receives the password.",
    "anyProvider": "Any provider",
    "endpointCapabilities": "Get version, operations, modules, and assigned server.",
    "endpointPutAccount": "Create or retrieve an account with optional displayName and email.",
    "endpointGetAccount": "Get an account without exposing its password.",
    "endpointPatchAccount": "Update name, email, or active/suspended status.",
    "endpointDeleteAccount": "Delete an account with no linked sites. Disabled by default.",
    "endpointUsage": "Get quotas, available usage, and measurement warnings.",
    "endpointPutSite": "Link a domain to the site engine configured in HOSTING.",
    "endpointDeleteSite": "Remove only the site owned by this provider.",
    "endpointTicket": "Issue a one-time panel access ticket valid for 60 seconds.",
    "method": "Method",
    "pathFromBase": "Path from base URL",
    "permission": "Permission",
    "result": "Result",
    "operationsHeading": "Manager operations",
    "authNote": "Send requests to the panel over HTTPS. Admin cookies and lxp_… keys do not authenticate this API. Never expose the lhp_… key to the browser.",
    "baseNote": "Base URL: https://<panel>/api/hosting/v1. External IDs may contain 1–128 characters: letters, digits, _ . : -.",
    "idempotencyNote": "Account and site PUT requests are idempotent for the same reference and content. One provider cannot access another provider’s accounts.",
    "createAccount": "Create or retrieve an account",
    "accountResponseNote": "The response contains { \"ok\": true, \"data\": … } with the user, home directory, status, and quotas. It never includes the password hash.",
    "siteExampleNote": "For a site, send PUT /accounts/account-42/sites/site-1 with { \"domain\": \"example.com\" }. LUXIPANEL creates an NGINX proxy to the configured engine; the manager publishes content and routes TLS traffic to the server.",
    "clientAccessHeading": "Client access to LUXIPANEL",
    "clientAccessNote": "The manager backend verifies account ownership and requests POST /accounts/{accountId}/access-ticket. It passes the URL and ticket to the browser, which posts to /api/auth/sso/handoff. The ticket is single-use and expires in 60 seconds. If two-factor authentication is required, access returns 403 until a compatible flow exists.",
    "limitsHeading": "Limits and error responses",
    "limitsNote": "The API accepts only references, basic account data, and domains. The manager cannot send commands, file paths, target servers, or NGINX settings. A site can point only to the engine and port set by the admin.",
    "errorCodes": "400: invalid input · 401: missing or invalid key · 403: operation not granted · 404: unknown reference · 409: conflict or concurrent work · 5xx: server failure.",
    "bandwidthNote": "Bandwidth measurement is not yet reliable. Check warnings in the usage response."
  }
} as const;

export default hosting;
