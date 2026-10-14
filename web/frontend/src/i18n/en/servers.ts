const servers = {
  "pageTitle": "Servers",
  "description": "Local registry of SSH targets this panel can connect to. Secrets (keys/passwords) are stored encrypted and are never shown here.",
  "btnNew": "Add server",
  "table": {
    "name": "Name",
    "host": "Host",
    "username": "User",
    "authType": "Authentication",
    "status": "Status"
  },
  "authTypes": {
    "key": "SSH key",
    "password": "Password"
  },
  "status": {
    "approved": "Approved",
    "pending": "Pending",
    "untested": "Untested"
  },
  "common": {
    "test": "Test",
    "edit": "Edit",
    "delete": "Delete",
    "cancel": "Cancel",
    "save": "Save",
    "close": "Close",
    "error": "Error",
    "yes": "Yes",
    "no": "No"
  },
  "dialog": {
    "titleNew": "Add server",
    "titleEdit": "Edit server",
    "name": "Name",
    "namePlaceholder": "My production server",
    "host": "Host or IP",
    "hostPlaceholder": "203.0.113.10 or server.example.com",
    "port": "Port",
    "username": "User",
    "usernamePlaceholder": "root",
    "authType": "Authentication type",
    "secretKey": "SSH private key",
    "secretKeyPlaceholder": "-----BEGIN OPENSSH PRIVATE KEY-----",
    "passphrase": "Key passphrase (optional)",
    "passphrasePlaceholder": "Passphrase to unlock the key",
    "secretPassword": "Password",
    "secretPasswordPlaceholder": "SSH user password",
    "secretKeepHint": "Leave empty to keep the current secret.",
    "btnCancel": "Cancel",
    "btnSave": "Save"
  },
  "fingerprint": {
    "title": "Approve host fingerprint",
    "intro": "This is the first connection to this server. Verify the host key fingerprint matches the expected one before approving it.",
    "approve": "Approve fingerprint",
    "approving": "Approving...",
    "approved": "Fingerprint approved",
    "approveError": "Could not approve the fingerprint"
  },
  "toasts": {
    "created": "Server added",
    "updated": "Server updated",
    "deleted": "Server deleted",
    "testOk": "Connection successful",
    "testFailed": "Connection failed"
  },
  "validation": {
    "nameRequired": "Enter a name",
    "hostRequired": "Enter the host",
    "usernameRequired": "Enter the user",
    "secretRequired": "Enter the authentication secret"
  },
  "confirmDelete": "Delete server {name}? This cannot be undone.",
  "confirmDeleteTitle": "Delete server",
  "testing": "Testing connection..."
} as const;

export default servers;
