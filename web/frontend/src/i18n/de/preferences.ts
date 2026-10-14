const preferences = {
  "pageTitle": "Präferenzen",
  "header": {
    "title": "Präferenzen",
    "subtitle": "Profil und Kontosicherheit verwalten"
  },
  "placeholders": {
    "phone": "+49 151 00000000"
  },
  "profile": {
    "sectionTitle": "Profil",
    "labelDisplayName": "Anzeigename",
    "labelPhone": "Telefon",
    "labelUsername": "Benutzername",
    "labelRole": "Rolle",
    "btnSave": "Profil speichern"
  },
  "password": {
    "sectionTitle": "Passwort ändern",
    "disabledNotice": "Die Passwortänderung ist in LuxiPanel deaktiviert. Du musst einen Serveradministrator kontaktieren."
  },
  "passkeys": {
    "sectionTitle": "Passkeys",
    "sectionSubtitle": "Biometrische Authentifizierung / FIDO2",
    "btnAdd": "Passkey hinzufügen",
    "emptyState": "Du hast noch keine Passkeys registriert"
  },
  "recoveryCodes": {
    "sectionTitle": "Wiederherstellungscodes",
    "sectionSubtitle": "Verwende sie, wenn du keinen Zugriff auf dein Gerät hast",
    "btnRegenerate": "Neu generieren",
    "loading": "Wird geladen...",
    "warning": "Bewahre diese Codes an einem sicheren Ort auf. Sie werden nur einmal angezeigt.",
    "btnCopy": "Alles kopieren",
    "btnPrint": "Drucken"
  },
  "twoFactor": {
    "sectionTitle": "Zwei-Faktor-Authentifizierung (2FA)",
    "sectionSubtitle": "Schütze dein Konto mit einem zusätzlichen Code",
    "badgeDisabled": "Deaktiviert",
    "enabledDescription": "Dein Konto ist mit zweistufiger Authentifizierung geschützt. Du benötigst bei jeder Anmeldung einen Code aus deiner Authentifizierungs-App.",
    "btnEnable": "2FA aktivieren",
    "btnDisable": "2FA deaktivieren"
  },
  "auditLog": {
    "sectionTitle": "Letzte Aktivität",
    "emptyState": "Keine Aktivität aufgezeichnet"
  },
  "dialogRegenCodes": {
    "title": "Codes neu generieren?",
    "body": "Die bisherigen Codes werden ungültig. Diese Aktion kann nicht rückgängig gemacht werden.",
    "btnCancel": "Abbrechen",
    "btnConfirm": "Neu generieren"
  },
  "dialogSetup2fa": {
    "title": "Zwei-Faktor-Authentifizierung aktivieren",
    "subtitle": "Scanne diesen QR-Code mit deiner Authentifizierungs-App (Google Authenticator, Authy usw.)",
    "manualEntryLabel": "Falls Scannen nicht möglich, manuell eingeben:",
    "titleCopySecret": "Kopieren",
    "verifyCodeLabel": "Gib den 6-stelligen Code zur Bestätigung ein:",
    "btnCancel": "Abbrechen",
    "btnConfirm": "2FA aktivieren"
  },
  "dialogDisable2fa": {
    "title": "2FA deaktivieren?",
    "body": "Dein Konto wird weniger sicher sein. Du kannst es jederzeit wieder aktivieren.",
    "btnCancel": "Abbrechen",
    "btnConfirm": "2FA deaktivieren"
  },
  "toasts": {
    "profileUpdated": "Profil aktualisiert",
    "errorUpdate": "Fehler beim Aktualisieren",
    "passwordUpdated": "Passwort aktualisiert",
    "passkeyDeleted": "Passkey gelöscht",
    "error": "Fehler",
    "registrationCancelled": "Registrierung abgebrochen",
    "passkeyRegistered": "Passkey erfolgreich registriert",
    "registrationCancelledByUser": "Registrierung vom Benutzer abgebrochen",
    "codesCopied": "Codes in die Zwischenablage kopiert",
    "secretCopied": "Secret in die Zwischenablage kopiert",
    "twoFaActivated": "2FA erfolgreich aktiviert",
    "twoFaDeactivated": "2FA deaktiviert"
  },
  "errors": {
    "passwordMismatch": "Passwörter stimmen nicht überein",
    "passwordTooShort": "Das Passwort muss mindestens 8 Zeichen lang sein",
    "passwordChangeError": "Fehler beim Ändern des Passworts",
    "passkeyNotSupported": "Ihr Browser unterstützt Passkey nicht. Bitte verwenden Sie Chrome, Firefox, Safari oder einen neueren Edge.",
    "passkeyInitFailed": "Registrierung konnte nicht initialisiert werden",
    "passkeyFinishError": "Fehler beim Abschließen der Registrierung",
    "generateCodesError": "Fehler beim Generieren von Codes",
    "twoFaSetupError": "Fehler beim Starten der 2FA-Konfiguration",
    "enterSixDigits": "Geben Sie die 6-stellige Nummer ein",
    "invalidCode": "Ungültiger Code",
    "twoFaDeactivateError": "Fehler beim Deaktivieren von 2FA",
    "genericWithMessage": "Fehler: {message}"
  },
  "labels": {
    "passkeyRegistered": "Registriert {date}",
    "hasActiveCodes": "Sie haben aktive Wiederherstellungscodes.",
    "noActiveCodes": "Sie haben keine aktiven Wiederherstellungscodes.",
    "notAvailable": "Nicht verfügbar",
    "codesGenerated": "{count} Codes generiert. Speichern Sie diese an einem sicheren Ort.",
    "printTitle": "Wiederherstellungscodes — LUXIPANEL",
    "printWarning": "Speichern Sie diese Codes an einem sicheren Ort. Jeder Code kann nur einmal verwendet werden.",
    "twoFaBadgeEnabled": "Aktiviert",
    "twoFaBadgeDisabled": "Deaktiviert"
  },
  "confirm": {
    "deletePasskey": "Diesen Passkey löschen?",
    "deletePasskeyTitle": "Passkey löschen"
  },
  "actions": {
    "login": "Anmeldung",
    "logout": "Abmeldung",
    "passwordChange": "Passwortänderung",
    "passkeyRegister": "Passkey registriert",
    "passkeyDelete": "Passkey gelöscht",
    "recoveryCodeUsed": "Wiederherstellungscode verwendet",
    "profileUpdate": "Profil aktualisiert",
    "twoFaEnabled": "2FA aktiviert",
    "twoFaDisabled": "2FA deaktiviert",
    "activateTwoFa": "2FA aktivieren"
  }
} as const;

export default preferences;
