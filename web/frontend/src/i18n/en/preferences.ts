const preferences = {
  "pageTitle": "Preferences",
  "header": {
    "title": "Preferences",
    "subtitle": "Manage your profile and account security"
  },
  "placeholders": {
    "phone": "+1 555 000 0000"
  },
  "profile": {
    "sectionTitle": "Profile",
    "labelDisplayName": "Display name",
    "labelPhone": "Phone",
    "labelUsername": "Username",
    "labelRole": "Role",
    "btnSave": "Save profile"
  },
  "password": {
    "sectionTitle": "Change password",
    "disabledNotice": "Password change is disabled in LuxiPanel. You must contact a server administrator."
  },
  "passkeys": {
    "sectionTitle": "Passkeys",
    "sectionSubtitle": "Biometric authentication / FIDO2",
    "btnAdd": "Add passkey",
    "emptyState": "You have no passkeys registered yet"
  },
  "recoveryCodes": {
    "sectionTitle": "Recovery codes",
    "sectionSubtitle": "Use them if you lose access to your device",
    "btnRegenerate": "Regenerate",
    "loading": "Loading...",
    "warning": "Store these codes in a safe place. They are only shown once.",
    "btnCopy": "Copy all",
    "btnPrint": "Print"
  },
  "twoFactor": {
    "sectionTitle": "Two-factor authentication (2FA)",
    "sectionSubtitle": "Protect your account with an additional code",
    "badgeDisabled": "Disabled",
    "enabledDescription": "Your account is protected with two-step authentication. You will need a code from your authenticator app each time you sign in.",
    "btnEnable": "Enable 2FA",
    "btnDisable": "Disable 2FA"
  },
  "auditLog": {
    "sectionTitle": "Recent activity",
    "emptyState": "No activity recorded"
  },
  "dialogRegenCodes": {
    "title": "Regenerate codes?",
    "body": "Previous codes will be invalidated. This action cannot be undone.",
    "btnCancel": "Cancel",
    "btnConfirm": "Regenerate"
  },
  "dialogSetup2fa": {
    "title": "Enable two-step authentication",
    "subtitle": "Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)",
    "manualEntryLabel": "If you can't scan, enter manually:",
    "titleCopySecret": "Copy",
    "verifyCodeLabel": "Enter the 6-digit code to confirm:",
    "btnCancel": "Cancel",
    "btnConfirm": "Enable 2FA"
  },
  "dialogDisable2fa": {
    "title": "Disable 2FA?",
    "body": "Your account will be less secure. You can re-enable it at any time.",
    "btnCancel": "Cancel",
    "btnConfirm": "Disable 2FA"
  },
  "toasts": {
    "profileUpdated": "Profile updated",
    "errorUpdate": "Error updating",
    "passwordUpdated": "Password updated",
    "passkeyDeleted": "Passkey deleted",
    "error": "Error",
    "registrationCancelled": "Registration cancelled",
    "passkeyRegistered": "Passkey registered successfully",
    "registrationCancelledByUser": "Registration cancelled by user",
    "codesCopied": "Codes copied to clipboard",
    "secretCopied": "Secret copied to clipboard",
    "twoFaActivated": "2FA activated successfully",
    "twoFaDeactivated": "2FA deactivated"
  },
  "errors": {
    "passwordMismatch": "Passwords do not match",
    "passwordTooShort": "Password must be at least 8 characters",
    "passwordChangeError": "Error changing password",
    "passkeyNotSupported": "Your browser does not support Passkey. Please use a recent version of Chrome, Firefox, Safari, or Edge.",
    "passkeyInitFailed": "Could not start registration",
    "passkeyFinishError": "Error completing registration",
    "generateCodesError": "Error generating codes",
    "twoFaSetupError": "Error starting 2FA setup",
    "enterSixDigits": "Enter the 6-digit code",
    "invalidCode": "Invalid code",
    "twoFaDeactivateError": "Error deactivating 2FA",
    "genericWithMessage": "Error: {message}"
  },
  "labels": {
    "passkeyRegistered": "Registered {date}",
    "hasActiveCodes": "You have active recovery codes.",
    "noActiveCodes": "You do not have active recovery codes.",
    "notAvailable": "Not available",
    "codesGenerated": "{count} codes generated. Keep them in a safe place.",
    "printTitle": "Recovery codes — LUXIPANEL",
    "printWarning": "Keep these codes in a safe place. Each one can only be used once.",
    "twoFaBadgeEnabled": "Enabled",
    "twoFaBadgeDisabled": "Disabled"
  },
  "confirm": {
    "deletePasskey": "Delete this passkey?",
    "deletePasskeyTitle": "Delete passkey"
  },
  "actions": {
    "login": "Sign in",
    "logout": "Sign out",
    "passwordChange": "Password change",
    "passkeyRegister": "Passkey registered",
    "passkeyDelete": "Passkey deleted",
    "recoveryCodeUsed": "Recovery code used",
    "profileUpdate": "Profile updated",
    "twoFaEnabled": "2FA enabled",
    "twoFaDisabled": "2FA disabled",
    "activateTwoFa": "Enable 2FA"
  }
} as const;

export default preferences;
