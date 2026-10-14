const settings = {
  "passkeyName": {
    "title": "Passkey name",
    "hint": "Use a name that helps you recognize the device.",
    "placeholder": "e.g. Personal laptop",
    "save": "Save name",
    "edit": "Edit name",
    "invalid": "Enter a name between 1 and 128 characters.",
    "saved": "Name updated",
    "error": "Could not save the name.",
    "cancel": "Cancel"
},
  "placeholders": {
    "logoUrl": "https://example.com/logo.png",
    "imageUrl": "https://…/image.jpg"
  },
  "pageTitle": "Settings",
  "loadFailure": {
    "title": "Couldn't load Settings",
    "sessionMessage": "Couldn't load Settings: your session with the server isn't available. Reselect the server in the selector, or sign out and sign back in.",
    "genericMessage": "Couldn't load Settings. Check your connection and try again.",
    "retry": "Retry"
  },
  "header": {
    "title": "Panel settings",
    "subtitle": "Global LuxiPanel configuration",
    "autosave": "Auto-save"
  },
  "tabs": {
    "general": "General",
    "layoutUi": "Layout/UI",
    "security": "Security",
    "modules": "Modules",
    "system": "System",
    "credentials": "Credentials"
  },
  "credentials": {
    "hcaptcha": {
      "title": "hCaptcha",
      "desc": "Protect the panel login with an hCaptcha challenge. Enter the keys from your hCaptcha dashboard.",
      "sitekeyLabel": "Site key",
      "sitekeyPlaceholder": "Your hCaptcha site key",
      "secretLabel": "Secret key",
      "secretPlaceholder": "Enter a new secret key",
      "secretConfigured": "A secret key is already set. Leave this field empty to keep it.",
      "statusConfigured": "Configured",
      "statusMissing": "Not configured",
      "saved": "hCaptcha settings saved"
    },
    "tolqia": {
      "label": "Tolqia",
      "help": "API token for your Tolqia account (Plus or Premium plan) — enables translated calls for the users of this server",
      "guide": {
        "steps": [
          "Go to tolqia.com and sign in to your account (Plus or Premium plan).",
          "Open “Settings” › “API” and create a new token.",
          "Copy the token (it starts with tq_live_) and paste it under “Configure”."
        ],
        "docUrl": "https://tolqia.com/settings/api",
        "docLabel": "Create a token at tolqia.com → Settings › API",
        "docUrl2": "https://tolqia.com/docs",
        "docLabel2": "Documentation"
      }
    },
    "elevenlabs": {
      "label": "ElevenLabs",
      "help": "Used for real-time translation of audio calls",
      "voiceIdLabel": "Default Voice ID",
      "voiceIdPlaceholder": "e.g. 21m00Tcm4TlvDq8ikWAM",
      "guide": {
        "steps": [
          "Go to elevenlabs.io and sign in.",
          "Open «My Account» → «API Keys» and create a new key.",
          "Copy the key (it starts with sk_) and paste it into «Configure»."
        ],
        "docUrl": "https://elevenlabs.io/app/settings/api-keys",
        "docLabel": "ElevenLabs API keys"
      }
    },
    "title": "Module credentials",
    "subtitle": "Manage the Access Tokens and API keys that modules need to work.",
    "empty": "No modules requiring credentials are enabled on this server.",
    "statusSet": "Configured",
    "statusMissing": "Not configured",
    "tokenLabel": "Access Token / API key",
    "tokenPlaceholder": "Paste the token…",
    "save": "Save",
    "test": "Test",
    "clear": "Remove",
    "manage": "Manage",
    "show": "Show",
    "hide": "Hide",
    "saved": "Credential saved",
    "cleared": "Credential removed",
    "testOk": "Connection valid",
    "testFail": "Could not validate the credential",
    "confirmClear": "Remove this credential?",
    "confirmClearTitle": "Remove credential",
    "error": "Something went wrong",
    "getDoc": "Get a token",
    "managedLabel": {
      "assistant": "AI Agents"
    },
    "managedHint": {
      "assistant": "The assistant's provider API keys are managed in its panel.",
      "backups": "Storage keys (S3 / R2) are managed in the Backups module."
    },
    "managedSummary": {
      "assistant": "AI providers (Claude, OpenAI, Gemini, …)",
      "backups": "S3 / R2 storage credentials"
    },
    "storage": {
      "accountId": "Account ID (Cloudflare)",
      "accessKeyId": "Access Key ID",
      "secret": "Secret Access Key",
      "endpoint": "Endpoint (optional)",
      "region": "Region (optional)",
      "r2Hint": "Account-level R2 credential reused by Backups: set the keys once here and just pick a bucket in Backups.",
      "s3Hint": "S3 credential reused by Backups: set the keys once here and just pick a bucket in Backups."
    },
    "connector": {
      "connect": "Save and connect",
      "disconnect": "Disconnect",
      "connected": "Connected",
      "configured": "Configured",
      "notConnected": "Not connected",
      "unavailable": "Requires the AI Agents module enabled",
      "setupGuide": "Setup guide"
    },
    "help": {
      "tabConfig": "Configure",
      "tabHelp": "Help",
      "openLink": "Open link",
      "guides": {
        "cloudflare": {
          "steps": [
            "Go to dash.cloudflare.com → \"My Profile\" → \"API Tokens\".",
            "Click \"Create Token\": use the \"Edit zone DNS\" template or create a custom one with the permissions you need (Zone:Read, DNS:Edit, etc.).",
            "Choose the zones it will have access to and create the token.",
            "Copy the token (shown only once) and paste it in the \"Configure\" tab."
          ],
          "docUrl": "https://dash.cloudflare.com/profile/api-tokens",
          "docLabel": "Cloudflare API Tokens"
        },
        "expo": {
          "steps": [
            "Go to expo.dev and sign in → \"Account settings\" → \"Access tokens\".",
            "Click \"Create token\", give it a name and copy the generated value.",
            "Paste it in the \"Configure\" tab."
          ],
          "docUrl": "https://expo.dev/settings/access-tokens",
          "docLabel": "Expo access tokens"
        },
        "openclaw": {
          "steps": [
            "Go to openclaw.ai and sign in.",
            "Generate or copy your API key from the OpenClaw dashboard.",
            "Paste it in \"Configure\" (adjust the endpoint and default model if they differ)."
          ],
          "docUrl": "https://openclaw.ai",
          "docLabel": "OpenClaw"
        },
        "repository-store": {
          "steps": [
            "Go to github.com → \"Settings\" → \"Developer settings\" → \"Personal access tokens\".",
            "Generate a token (classic or fine-grained) with repository read permission (public_repo or Contents: Read).",
            "Copy the token (starts with ghp_ or github_pat_) and paste it in \"Configure\"."
          ],
          "docUrl": "https://github.com/settings/tokens",
          "docLabel": "GitHub tokens"
        },
        "bitninja": {
          "steps": [
            "Go to the BitNinja panel (admin.bitninja.io) and sign in.",
            "Copy your License Key from the licenses/servers section.",
            "Paste it in \"Configure\"."
          ],
          "docUrl": "https://bitninja.io",
          "docLabel": "BitNinja"
        },
        "r2": {
          "steps": [
            "Go to dash.cloudflare.com → \"R2\" → \"Manage R2 API Tokens\".",
            "Create an \"R2 API Token\" (S3-compatible) with object read/write permission.",
            "Copy the Access Key ID and Secret Access Key that are displayed.",
            "Your Account ID appears on the R2 page / account overview.",
            "Paste Account ID + Access Key ID + Secret in \"Configure\" (the endpoint is derived from the Account ID)."
          ],
          "docUrl": "https://dash.cloudflare.com/?to=/:account/r2/api-tokens",
          "docLabel": "R2 API Tokens"
        },
        "s3": {
          "steps": [
            "In the AWS console: \"IAM\" → \"Users\" → your user → \"Security credentials\" → \"Create access key\".",
            "Copy the Access Key ID and Secret Access Key.",
            "If you use an S3-compatible service (Wasabi, MinIO, etc.), note its Endpoint and Region.",
            "Paste the keys (and Endpoint/Region if applicable) in \"Configure\"."
          ],
          "docUrl": "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html",
          "docLabel": "AWS access keys"
        }
      }
    }
  },
  "general": {
    "hcaptchaEnabled": "Require hCaptcha on login",
    "hcaptchaEnabledHint": "Show an hCaptcha challenge on the panel login form.",
    "sectionTitle": "General",
    "labelPanelName": "Panel name",
    "labelTimezone": "Timezone",
    "labelLanguage": "Language",
    "languageOptions": {
      "en": "English",
      "es": "Español"
    },
    "labelSessionTtl": "Session duration (hours)",
    "labelMaxLoginAttempts": "Failed login attempts (lockout)",
    "labelRequire2fa": "Require 2FA for all users",
    "btnViewLog": "View log",
    "labelAuditLog": "Enable audit log",
    "labelSwitchNewTab": "Open the switched server in a new tab"
  },
  "imageList": {
    "labelJson": "(JSON)",
    "labelUrls": "(Image URLs)",
    "addButton": "Add image"
  },
  "layout": {
    "sectionTitle": "Layout, branding and UI",
    "sectionSubtitle": "Customize logos, radii, shadows and base colors of the frontend.",
    "branding": {
      "groupTitle": "Branding and logos",
      "groupDesc": "Single logo applied to sidebar, login, header, footer and favicon.",
      "labelLogoUrl": "Logo URL",
      "logoUrlHelp": "Single logo used everywhere: sidebar, login, panel header, footer and public screens.",
      "btnUpload": "Upload",
      "btnPick": "Choose",
      "btnDefault": "Default",
      "restoreLogos": "Restore logos",
      "loginLogoOpacity": "Login logo container opacity",
      "loginLogoOpacityHelp": "Translucency of the logo circle background on /login (0 = transparent, 100 = solid)."
    },
    "loginBg": {
      "groupTitle": "Login background",
      "groupDesc": "Animated background effect on /login and its fallback color.",
      "enableLabel": "Show animated background on /login",
      "labelFallbackColor": "Background color when disabled",
      "labelActiveEffect": "Active effect on /login",
      "previewTitle": "Login preview"
    },
    "shape": {
      "groupTitle": "Shape and shadows",
      "groupDesc": "Global radius, card and modal shadows of the frontend.",
      "labelRadius": "Global radius",
      "radiusHelp": "e.g.: 0.5rem, 12px.",
      "labelShadow": "Base shadow",
      "labelModalShadow": "Modal shadow",
      "labelModalBackdrop": "Modal overlay",
      "backdropHelp": "Dialog background.",
      "layer1": "Layer 1",
      "layer2": "Layer 2",
      "labelColor": "Color",
      "labelShadowSingle": "Shadow"
    },
    "palettes": {
      "title": "Color theme",
      "subtitle": "Pick a predefined palette; it applies to the whole panel (light and dark).",
      "light": "Light theme",
      "dark": "Dark theme",
      "intensity": "Intensity"
    },
    "resetButton": "Reset styles to defaults",
    "panelBg": {
      "groupTitle": "Panel background",
      "groupDesc": "Animated background effect inside the panel and its fallback color.",
      "enableLabel": "Show animated background in panel",
      "labelFallbackColor": "Background color when disabled",
      "labelActiveEffect": "Panel active effect"
    }
  },
  "security": {
    "sectionTitle": "Security",
    "loginMethodsTitle": "Allowed sign-in methods",
    "loginMethodsDesc": "At least one method must remain active. Disabled methods will not appear on the login screen.",
    "loginMethodsWarning": "At least one method must remain active.",
    "passkey": {
      "name": "Passkey",
      "desc": "Biometric authentication / FIDO2. Users must register their device.",
      "verifying": "Verifying...",
      "btnManage": "Manage"
    },
    "password": {
      "name": "Password",
      "desc": "Login with username and password. Always available with no prior configuration.",
      "configured": "Configured"
    },
    "recovery": {
      "name": "Recovery",
      "desc": "Single-use codes as an emergency backup.",
      "verifying": "Verifying...",
      "btnManage": "Manage"
    },
    "twoFaStatus": {
      "groupTitle": "2FA status for this account",
      "badgeDisabled": "Disabled",
      "promptText": "Enable 2FA to protect this administrative account.",
      "btnSetup": "Set up",
      "btnDelete": "Delete",
      "btnDisable": "Disable"
    }
  },
  "modules": {
    "sectionTitle": "Cache engines per module",
    "sectionDesc1": "Status and adjustment of scheduled collection on the client server.",
    "sectionDescBold": "Active/Inactive derives from the parent module",
    "modulesLink": "Modules",
    "sectionDesc2": ": disabling a module turns off its collection; re-enabling it reschedules it. Only frequency is adjusted here. DataTables read pre-formed data from dedicated Redis on that server; if it is off or very stale it falls back to plain JSON.",
    "loading": "Loading…",
    "tableHeaders": {
      "module": "Module / collection",
      "source": "Source",
      "active": "Active",
      "interval": "Interval (s)",
      "lastRefresh": "Last refresh",
      "duration": "Duration",
      "size": "Size",
      "hitRatio": "Hit ratio"
    },
    "managedInPre": " (managed in ",
    "managedInPost": ")"
  },
  "system": {
    "factoryReset": {
      "sectionTitle": "Reset settings",
      "sectionSubtitle": "Restore panel settings to factory defaults.",
      "warningTitle": "Warning",
      "warningBefore": "This action resets ",
      "warningAllSettings": "all configuration settings",
      "warningMiddle": " of the panel (general, layout/UI, SMTP, security and preferences saved by modules) to their default values. Users and installed modules ",
      "warningNotDeleted": "are not deleted",
      "warningAfter": ".",
      "btnReset": "Restore factory settings"
    },
    "backupRestore": {
      "sectionTitle": "Restore from backup",
      "sectionSubtitle": "Restore the panel from a previous backup (Backups module required).",
      "loading": "Loading backups...",
      "btnRestore": "Restore selected backup"
    },
    "noBackup": {
      "title": "Restore from backup not available",
      "descBefore": "Install the ",
      "backupsModule": "Backups",
      "descAfter": " module from the modules panel to enable this feature."
    }
  },
  "imagePicker": {
    "title": "Choose image",
    "subtitle": "Images available in the frontend's public folder.",
    "empty": "No images in the public folder.",
    "btnUpload": "Upload new image",
    "btnCancel": "Cancel"
  },
  "smtpTest": {
    "dialogTitle": "Send test email",
    "labelRecipient": "Recipient",
    "placeholderRecipient": "you@example.com",
    "btnCancel": "Cancel",
    "btnSend": "Send"
  },
  "passkeysDialog": {
    "title": "Manage Passkeys",
    "btnAdd": "Add passkey",
    "empty": "No passkeys registered"
  },
  "recoveryDialog": {
    "title": "Recovery codes",
    "btnGenerate": "Generate / regenerate",
    "loading": "Loading...",
    "warningText": "Store these codes in a safe place. They are only shown once.",
    "btnCopy": "Copy all",
    "btnPrint": "Print"
  },
  "setup2faDialog": {
    "title": "Set up 2FA",
    "subtitle": "Scan this QR code with your authenticator app.",
    "secretLabel": "Manual secret:",
    "copyTitle": "Copy",
    "verifyLabel": "Enter the 6-digit code:",
    "btnCancel": "Cancel",
    "btnActivate": "Activate 2FA"
  },
  "disable2faDialog": {
    "title": "Disable 2FA?",
    "body": "2FA will be disabled, but the secret will be kept so you can re-enable it later.",
    "btnCancel": "Cancel",
    "btnConfirm": "Disable 2FA"
  },
  "delete2faDialog": {
    "title": "Delete 2FA?",
    "body": "The stored secret will be deleted and you will need to set it up again to use 2FA.",
    "btnCancel": "Cancel",
    "btnConfirm": "Delete 2FA"
  },
  "auditLogDialog": {
    "title": "Audit log",
    "empty": "No activity recorded"
  },
  "modulesCache": {
    "agoSeconds": "{n}s ago",
    "agoMinutes": "{n}m ago",
    "agoHours": "{n}h ago",
    "agoDays": "{n}d ago",
    "collectionSingular": "collection",
    "collectionPlural": "collections",
    "activeSingular": "active",
    "activePlural": "active",
    "enabledTitle": "Scheduled collection via client server dispatcher",
    "badgeEnabled": "Active",
    "disabledTitle": "Parent module disabled in /panel/modules — collection is paused",
    "badgeDisabled": "Inactive",
    "buttonSave": "Save",
    "saving": "Saving…",
    "savedStatus": "{module}/{collection} updated",
    "saveError": "Error saving {module}/{collection}: {message}",
    "loadedSummary": "{count} cacheable collections in {modules} modules. Changes apply at the next collector cycle (≤60s).",
    "loadError": "Error: {message}"
  },
  "labels": {
    "auditLogin": "Login",
    "auditLoginFailed": "Failed login attempt",
    "auditLogout": "Logout",
    "auditPasswordChange": "Password change",
    "auditPasskeyRegister": "Passkey registered",
    "auditPasskeyDelete": "Passkey deleted",
    "auditRecoveryCodeUsed": "Recovery code used",
    "auditProfileUpdate": "Profile updated",
    "auditSettingsUpdate": "Settings updated",
    "audit2faEnabled": "2FA enabled",
    "audit2faDisabled": "2FA disabled",
    "auditEventDefault": "Event",
    "aiHintAnthropic": "Recommended models: claude-fable-5 (latest), claude-sonnet-4-6 (balanced), claude-opus-4-6 (most capable)",
    "aiKeyHintAnthropic": "Get your API key at console.anthropic.com",
    "aiHintOpenai": "gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna",
    "aiKeyHintOpenai": "Get your API key at platform.openai.com",
    "aiHintOllama": "Name of the model installed in local Ollama. Does not support tools.",
    "aiKeyHintOllama": "No API key required for local Ollama",
    "managedByLp": "Managed by LP-LICENSE-SERVER",
    "notAvailable": "Not available",
    "managedExternally": "Externally managed",
    "twoFaManagedByLp": "Authentication is managed from LP-LICENSE-SERVER in this mode.",
    "licenseNoStatus": "No status",
    "licenseActive": "Active",
    "licenseExpires": "expires {date}",
    "licenseActiveDesc": "Active license",
    "licenseDegraded": "Degraded",
    "licensePending": "Pending",
    "licenseDegradedDesc": "The license could not be validated and the panel is in degraded mode.",
    "licenseNotActivated": "The license has not been activated yet.",
    "passkeyCount": "{count} passkey(s) registered",
    "noPasskeys": "No passkeys registered",
    "recoveryCodesGenerated": "Recovery codes generated",
    "noRecoveryCodes": "No codes generated",
    "passkeyRegistered": "Registered {date}",
    "recoveryCodesActive": "You have active recovery codes.",
    "recoveryCodesNone": "You have no active recovery codes.",
    "recoveryCodesDisplayed": "{count} codes generated. Store them in a safe place.",
    "twoFaEnabled": "Enabled",
    "twoFaEnabledDesc": "This 2FA will be required at the next login. You can disable it without deleting the secret.",
    "twoFaDisabled": "Disabled",
    "twoFaDisabledDesc": "The secret is still saved but will not be required at login until you activate it again.",
    "twoFaSetupPrompt": "Enable 2FA to protect this admin account.",
    "printRecoveryCodesTitle": "Recovery codes - LUXIPANEL",
    "printRecoveryCodesDesc": "Store these codes in a safe place. Each one can only be used once."
  },
  "toasts": {
    "errorSaving": "Error saving settings",
    "errorSavingAppearance": "Could not save appearance to the license server. Please retry in a few seconds.",
    "licenseKeyAndRefRequired": "Enter the license key and payment reference",
    "licenseActivated": "License activated successfully",
    "licenseActivateError": "Could not activate the license",
    "timezoneApplyError": "Could not apply the timezone to the system",
    "timezoneSavedNotApplied": "Timezone saved in the panel but could not be applied to the system (check sudo permissions).",
    "passkeysInLp": "Passkeys are managed in LP-LICENSE-SERVER",
    "passkeyDeleted": "Passkey deleted",
    "passkeyDeleteError": "Error deleting passkey",
    "passkeyBrowserUnsupported": "Your browser does not support Passkey",
    "passkeyRegisterInitError": "Could not start registration",
    "passkeyRegisterCancelled": "Registration cancelled",
    "passkeyRegisterFinishError": "Error completing registration",
    "passkeyRegistered": "Passkey registered successfully",
    "passkeyRegisterUserCancelled": "Registration cancelled by user",
    "passkeyRegisterError": "Error registering passkey",
    "recoveryCodesInLp": "Recovery codes are managed in LP-LICENSE-SERVER",
    "recoveryCodesGenerateError": "Error generating codes",
    "twoFaInLp": "2FA is managed in LP-LICENSE-SERVER",
    "twoFaSetupInitError": "Error starting 2FA setup",
    "twoFaQrError": "Could not generate QR code",
    "twoFaActivated": "2FA activated successfully",
    "twoFaDisabled": "2FA disabled for login",
    "twoFaDisableError": "Error disabling 2FA",
    "twoFaReactivated": "2FA activated for login",
    "twoFaActivateError": "Error activating 2FA",
    "twoFaDeleted": "2FA deleted",
    "twoFaDeleteError": "Error deleting 2FA",
    "backupRestoreUnavailable": "Backup restore is not yet available from this panel.",
    "imageExceeds5mb": "Image exceeds 5 MB",
    "uploadingImage": "Uploading image...",
    "imageUploadError": "Error uploading image",
    "imageUploadInvalidResponse": "Invalid server response",
    "imageUploaded": "Image uploaded successfully",
    "logosRestored": "Logos restored to defaults",
    "codesCopied": "Codes copied",
    "secretCopied": "Secret copied",
    "smtpTestSent": "Test email sent to {to}",
    "smtpTestError": "Error sending",
    "layoutReset": "Styles reset to defaults",
    "settingsReset": "Settings reset",
    "settingsResetError": "Error resetting",
    "licenseRevalidated": "License revalidated",
    "licenseRevalidateError": "Could not revalidate the license"
  },
  "actions": {
    "activating": "Activating...",
    "activateOrUpdate": "Activate / update",
    "manage": "Manage",
    "configure": "Configure",
    "viewOrRegenerate": "View / regenerate",
    "generate": "Generate",
    "generating": "Generating...",
    "generateOrRegenerate": "Generate / regenerate",
    "disable": "Disable",
    "activate": "Activate",
    "activate2fa": "Activate 2FA",
    "continue": "Continue",
    "sending": "Sending...",
    "send": "Send",
    "resetting": "Resetting...",
    "factoryReset": "Factory reset"
  },
  "errors": {
    "twoFaEnter6Digits": "Enter the 6-digit code",
    "twoFaInvalidCode": "Invalid code"
  },
  "confirm": {
    "deletePasskeyTitle": "Delete passkey",
    "deletePasskeyBody": "Delete this passkey?",
    "restoreBackupBody": "Restore backup \"{id}\"?",
    "restoreBackupTitle": "Restore backup",
    "restoreLogosBody": "Restore logo to LUXIPANEL defaults?",
    "restoreLogosTitle": "Restore logos",
    "restoreLogosConfirm": "Yes, restore",
    "resetLayoutBody": "Reset the UI styles to LUXIPANEL defaults? Custom logos, colors, shadows and backgrounds will be lost.",
    "resetLayoutTitle": "Reset styles",
    "resetLayoutConfirm": "Yes, reset",
    "factoryResetBody": "Are you sure? This will reset all panel settings.",
    "factoryResetTitle": "Reset settings",
    "factoryResetConfirm": "Yes, reset"
  },
  "empty": {
    "noBackups": "No backups available."
  },
  "palettes": {
    "luxisoft": {
      "name": "Luxisoft",
      "description": "Navy blue and mint in light mode; graphite and mint in dark mode."
    },
    "violet": {
      "name": "Violet",
      "description": "LUXIPANEL's default palette."
    },
    "ocean": {
      "name": "Ocean",
      "description": "Professional, serene blues."
    },
    "emerald": {
      "name": "Emerald",
      "description": "Fresh, natural greens."
    },
    "sunset": {
      "name": "Sunset",
      "description": "Warm oranges and amber."
    },
    "rose": {
      "name": "Rose",
      "description": "Vibrant pinks and magentas."
    },
    "indigo": {
      "name": "Indigo",
      "description": "Elegant, modern indigos."
    },
    "aqua": {
      "name": "Aqua",
      "description": "Luminous turquoise and cyan."
    },
    "graphite": {
      "name": "Graphite",
      "description": "Sober monochrome neutral."
    },
    "amber": {
      "name": "Amber",
      "description": "Warm gold and honey."
    },
    "fuchsia": {
      "name": "Fuchsia",
      "description": "Intense magentas and purples."
    },
    "lime": {
      "name": "Lime",
      "description": "Energetic lime greens."
    },
    "slate": {
      "name": "Slate",
      "description": "Professional blue-gray."
    },
    "prisma": {
      "name": "Prism",
      "description": "Blends every palette color into a continuous, infinite transition.",
      "colors": "Colors",
      "addColorButton": "Add color",
      "addColorAria": "Pick and add a color to the Prisma effect",
      "addColorInputAria": "Color to add to the Prisma effect",
      "editColorAria": "Edit color",
      "editColorInputAria": "Edit color value",
      "editColorHexAria": "Hex value of the color",
      "removeColorAria": "Remove color",
      "moveUpAria": "Move color up",
      "moveDownAria": "Move color down",
      "helpText": "Reorder the list with the arrows. Each color defines the sequence of the effect."
    },
    "custom": {
      "name": "Custom",
      "description": "Pick your base color and adjust its intensity.",
      "baseColor": "Base color",
      "baseColorAria": "Custom base color",
      "hexAria": "Hex value of the custom base color"
    }
  },
  "managers": {
    "default": "Manager 1"
  },
  "git": {
    "errorFallback": "Error"
  }
} as const;

export default settings;
