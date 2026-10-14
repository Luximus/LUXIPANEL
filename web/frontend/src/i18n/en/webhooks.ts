const webhooks = {
  "pageTitle": "Webhooks and API Keys",
  "tabs": {
    "webhooks": "Outbound",
    "apiKeys": "API Keys",
    "discovered": "Detected"
  },
  "categories": {
    "receiveData": "Receive data",
    "mailhook": "Mailhook",
    "response": "Webhook response",
    "soon": "Coming soon",
    "soonDesc": "Configuration and scanning for this category will be defined in a later phase."
  },
  "gateway": {
    "description": "Endpoints the panel hosts to receive incoming data (Make.com style). API-key auth (x-make-apikey), IP restriction and data-structure validation.",
    "btnNew": "New webhook",
    "detectedTitle": "Receivers detected on the server",
    "urlReveal": "Webhook URL — send requests here",
    "cols": {
      "name": "Name",
      "auth": "Auth",
      "recibidos": "Received",
      "ultima": "Last",
      "estado": "Status",
      "estadoActive": "Active",
      "estadoPaused": "Paused"
    },
    "dialog": {
      "titleNew": "Create a webhook",
      "titleEdit": "Edit webhook",
      "name": "Webhook name",
      "namePlaceholder": "My gateway webhook",
      "nameHint": "Must be between 1 and 128 characters long.",
      "apiAuth": "API Key authentication",
      "apiAuthHint": "Send the API key using the x-make-apikey header. Add one or more keys; if any matches, access is granted.",
      "apiKeyName": "Name",
      "apiKeyValue": "API key value",
      "apiKeyKeep": "(saved — leave empty to keep)",
      "addApiKey": "Add API key",
      "ipTitle": "IP restrictions",
      "ipHint": "Comma-delimited list of IPs. CIDR notation allowed. Empty = no check.",
      "dataStructure": "Data structure",
      "dataStructureHint": "Validation of incoming data. Empty = data is passed through without validation.",
      "dsValidate": "Validate data structure",
      "dsStrict": "Strict (reject unspecified fields)",
      "dsFieldName": "Name",
      "dsFieldDesc": "Description",
      "dsFieldType": "Type",
      "dsFieldDefault": "Default value",
      "dsFieldRequired": "Required",
      "dsFieldMultiline": "Multi-line",
      "addItem": "Add item",
      "getHeaders": "Get request headers",
      "getHeadersHint": "The headers will be added to the request body.",
      "getMethod": "Get request HTTP method",
      "getMethodHint": "The HTTP method (verb) will be added to the request body.",
      "jsonPassthrough": "Store JSON as text",
      "jsonPassthroughHint": "If enabled, the JSON payload is stored as a string.",
      "enabled": "Webhook enabled",
      "advanced": "Advanced settings",
      "btnCancel": "Cancel",
      "btnSave": "Save"
    },
    "payloads": {
      "title": "Received payloads",
      "empty": "No payload received yet.",
      "btnClose": "Close"
    },
    "confirm": {
      "deleteTitle": "Delete webhook",
      "deleteBody": "Delete webhook \"{name}\"? Stored payloads will be lost.",
      "deleteBtn": "Yes, delete"
    },
    "toasts": {
      "created": "Webhook created",
      "updated": "Webhook updated",
      "deleted": "Webhook deleted",
      "copied": "URL copied",
      "error": "Save error"
    }
  },
  "webhooksPanel": {
    "description": "Outgoing HTTP notifications with HMAC signature",
    "btnNew": "New webhook"
  },
  "apiKeysPanel": {
    "description": "Programmatic access with permanent tokens",
    "btnNew": "New API key"
  },
  "newKeyReveal": {
    "message": "API Key created — copy it now, it will not be shown again",
    "btnCopy": "Copy"
  },
  "webhookDialog": {
    "placeholderUrl": "https://example.com/webhook",
    "title": "New webhook",
    "labelUrl": "Endpoint URL",
    "labelEvents": "Events to listen for",
    "labelEnabled": "Webhook active",
    "btnCancel": "Cancel",
    "btnSave": "Save"
  },
  "apiKeyDialog": {
    "placeholderName": "My integration",
    "title": "New API Key",
    "labelName": "Descriptive name",
    "labelExpires": "Expires (optional)",
    "btnCancel": "Cancel",
    "btnCreate": "Create key"
  },
  "discovered": {
    "description": "Webhooks detected on the server (Git, nginx, cron, systemd, config files and projects)",
    "btnRescan": "Rescan",
    "scanning": "Scanning server…",
    "empty": "No webhooks detected on the server",
    "cols": {
      "source": "Source",
      "name": "Name",
      "target": "Target",
      "location": "Location",
      "estado": "Status"
    },
    "filters": {
      "searchTarget": "Search target…",
      "source": "Source"
    },
    "sources": {
      "sidecar": "Panel",
      "git-hook": "Git hook",
      "nginx": "Nginx",
      "cron": "Cron",
      "systemd": "systemd",
      "config": "Config",
      "project": "Project"
    },
    "status": {
      "enabled": "Active",
      "disabled": "Inactive",
      "unknown": "—"
    },
    "actions": {
      "detail": "View detail",
      "delete": "Delete"
    },
    "detail": {
      "title": "Detected webhook detail",
      "source": "Source",
      "target": "Target",
      "location": "Location",
      "info": "Information",
      "raw": "Configuration",
      "managedNote": "This webhook is managed by the panel",
      "readonlyNote": "Read-only: manage it from its corresponding module",
      "btnClose": "Close"
    },
    "confirm": {
      "deleteTitle": "Delete detected webhook",
      "deleteBody": "Delete \"{name}\"? This modifies the file on the server.",
      "deleteBtn": "Yes, delete"
    },
    "toasts": {
      "deleted": "Deleted",
      "errorDeleting": "Could not delete",
      "scanComplete": "Scan complete: {count}",
      "notManageable": "Manage it from its corresponding module"
    }
  },
  "labels": {
    "statusFailing": "Failing",
    "statusActive": "Active",
    "statusPaused": "Paused",
    "newWebhookTitle": "New webhook",
    "noExpiry": "No expiration"
  },
  "confirm": {
    "rotateSecretBody": "Rotate this webhook's secret? You will need to update the receiver.",
    "rotateSecretTitle": "Rotate secret",
    "rotateSecretBtn": "Yes, rotate",
    "deleteWebhookBody": "Delete this webhook?",
    "deleteWebhookTitle": "Delete webhook",
    "revokeKeyBody": "Revoke the API key \"{name}\"?",
    "revokeKeyTitle": "Revoke API key",
    "revokeKeyBtn": "Yes, revoke"
  },
  "toasts": {
    "secretRotated": "Secret rotated",
    "errorRotating": "Error rotating",
    "webhookDeleted": "Webhook deleted",
    "errorDeleting": "Error deleting",
    "webhookUpdated": "Webhook updated",
    "webhookCreated": "Webhook created",
    "errorSaving": "Error saving",
    "keyRevoked": "Key revoked",
    "errorRevoking": "Error revoking",
    "copiedToClipboard": "Copied to clipboard",
    "errorCreatingKey": "Error creating key"
  },
  "table": {
    "gateway": {
      "options": {
        "statusActive": "Active",
        "statusPaused": "Paused"
      },
      "columns": {
        "name": "Name",
        "auth": "Auth",
        "recibidos": "Received",
        "ultima": "Last",
        "estado": "Status"
      },
      "filters": {
        "searchName": "Search by name…",
        "estado": "Status"
      },
      "rowActions": {
        "copy": "Copy URL",
        "payloads": "View payloads",
        "edit": "Edit",
        "delete": "Delete"
      }
    },
    "webhooks": {
      "options": {
        "statusActive": "Active",
        "statusPaused": "Paused",
        "statusFailing": "Failing"
      },
      "columns": {
        "url": "URL",
        "eventos": "Events",
        "estado": "Status"
      },
      "filters": {
        "searchUrl": "Search URL…",
        "estado": "Status"
      },
      "rowActions": {
        "regenerate": "Rotate secret",
        "delete": "Delete"
      }
    },
    "apiKeys": {
      "columns": {
        "name": "Name",
        "prefix": "Prefix",
        "creada": "Created",
        "expira": "Expires"
      },
      "filters": {
        "searchName": "Search by name…"
      },
      "rowActions": {
        "revoke": "Revoke"
      }
    },
    "discovered": {
      "options": {
        "panel": "Panel",
        "gitHook": "Git hook",
        "nginx": "Nginx",
        "cron": "Cron",
        "systemd": "systemd",
        "config": "Configuration",
        "proyecto": "Project"
      },
      "columns": {
        "origen": "Source",
        "name": "Name",
        "target": "Target",
        "location": "Location",
        "estado": "Status"
      },
      "filters": {
        "searchTarget": "Search target…",
        "origen": "Source"
      },
      "rowActions": {
        "detail": "View detail",
        "delete": "Delete"
      }
    }
  },
  "runtime": {
    "testDelivered": "Test delivered successfully.",
    "testFailed": "Test delivery failed.",
    "loadingDeliveries": "Loading deliveries…",
    "loadDeliveriesError": "Could not load deliveries.",
    "noDeliveries": "No deliveries have been recorded yet.",
    "delivered": "Delivered",
    "failed": "Failed",
    "attempts": "Attempts: {count}",
    "selectEvent": "Select at least one event."
  },
  "settingsUi": {
    "title": "Webhooks settings",
    "description": "Pagination and visible actions for Webhooks tables.",
    "gateway": "Gateway",
    "webhooks": "Webhooks",
    "signingSecret": "Signing secret · copy it now",
    "signingSecretHint": "Shown only once. Configure it in the receiver to verify X-Luxipanel-Signature.",
    "recentDeliveries": "Recent deliveries"
  }
} as const;

export default webhooks;
