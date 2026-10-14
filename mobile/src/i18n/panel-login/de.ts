const login = {
  "pageTitle": "Anmelden",
  "panelSubtitle": "Verwaltungsbereich",
  "authError": "Authentifizierungsfehler",
  "forgotPassword": "Passwort vergessen",
  "forgotHint": "Gib deine E-Mail-Adresse ein und wir senden dir einen Link zum Ändern deines Passworts.",
  "backToLogin": "Zurück zur Anmeldung",
  "recoverLinkSent": "Falls die E-Mail-Adresse existiert, haben wir einen Wiederherstellungslink gesendet.",
  "recoverLinkError": "Der Wiederherstellungslink konnte nicht gesendet werden.",
  "languageLabel": "Sprache",
  "hostLabelFallback": "dieses Panel",
  "tabs": {
    "password": "Passwort",
    "passkey": "Passkey",
    "recovery": "Wiederherstellung"
  },
  "labels": {
    "user": "Benutzer",
    "password": "Passwort",
    "sshPassphrase": "Passphrase des SSH-Schlüssels",
    "remember": "Angemeldet bleiben",
    "email": "E-Mail-Adresse",
    "recoveryCode": "Wiederherstellungscode",
    "code6Digits": "6-stelliger Code"
  },
  "placeholders": {
    "user": "admin",
    "email": "benutzer@beispiel.com",
    "password": "********",
    "sshPassphrase": "Passphrase deines SSH-Schlüssels",
    "recoveryCode": "XXXX-XXXX-XXXX",
    "totp": "000000"
  },
  "text": {
    "biometricAuth": "Biometrische Authentifizierung",
    "biometricHelp": "Verwende Face ID, Fingerabdruck oder Sicherheitsschlüssel",
    "usePasskey": "Passkey verwenden",
    "signIn": "Anmelden",
    "sendRecoveryLink": "Wiederherstellungslink senden",
    "recoveryWarning": "Verwende einen einmaligen Wiederherstellungscode, wenn du den Zugriff auf dein Gerät verloren hast.",
    "verifyCode": "Code überprüfen",
    "twoFactorTitle": "Zwei-Faktor-Authentifizierung",
    "twoFactorHelp": "Gib den Code aus deiner Authentifizierungs-App ein",
    "verify": "Überprüfen",
    "footer": "LuxiPanel v2.0 - Sichere E-Mail-Verwaltung"
  },
  "errors": {
    "captchaRequired": "Bitte schließen Sie die hCaptcha-Abfrage ab.",
    "enterEmail": "Gib eine E-Mail-Adresse ein",
    "browserNoPasskey": "Dein Browser unterstützt keine Passkey. Verwende ein aktuelles Chrome, Firefox, Safari oder Edge.",
    "passkeyOptionsFailed": "Die Authentifizierungsoptionen konnten nicht abgerufen werden",
    "passkeyCanceled": "Authentifizierung abgebrochen",
    "passkeyCanceledByUser": "Authentifizierung vom Benutzer abgebrochen",
    "passkeyError": "Passkey-Fehler",
    "enterUserRecoveryCode": "Gib Benutzer und Wiederherstellungscode ein",
    "enterTotp6Digits": "Gib die 6 Ziffern des Codes ein",
    "invalidTotpCode": "Ungültiger 2FA-Code"
  },
  "status": {
    "passkeyInit": "Authentifizierung wird gestartet...",
    "passkeyWaiting": "Warte auf deine Passkey...",
    "passkeyVerifying": "Überprüfung läuft..."
  },
  "authErrors": {
    "AUTH_ERROR": "Authentifizierungsfehler.",
    "NO_SSH_KEY": "Für diesen Benutzer ist in diesem Panel kein SSH-Schlüssel hinterlegt.",
    "PANEL_UNRESOLVED": "Das Zugriffs-Panel konnte nicht ermittelt werden.",
    "PANEL_NO_IP": "Für das Panel ist keine IP-Adresse konfiguriert.",
    "USER_PROVISION_FAILED": "Der Benutzer konnte im Panel nicht bereitgestellt werden.",
    "ACCOUNT_DISABLED": "Das Konto ist deaktiviert.",
    "ACCOUNT_NOT_FOUND": "Konto nicht gefunden oder deaktiviert.",
    "USER_NOT_FOUND": "Benutzer nicht gefunden.",
    "TWO_FA_REQUIRED": "Für dieses Konto ist 2FA erforderlich. Richte es unter Einstellungen › Sicherheit ein, bevor du dich anmeldest.",
    "INVALID_PASSPHRASE": "Falsche Passphrase.",
    "PASSPHRASE_REQUIRED": "Du musst die Passphrase des Benutzers eingeben.",
    "PASSPHRASE_VERIFY_FAILED": "Das Passwort konnte nicht gegen den Server überprüft werden.",
    "SERVER_SSH_KEY_MISSING": "Der SSH-Schlüssel des Servers ist nicht konfiguriert.",
    "PANEL_SSH_KEY_REJECTED": "Der SSH-Schlüssel des Panels wird vom Server nicht akzeptiert.",
    "SSH_CONNECT_FAILED": "Die Verbindung zum SSH-Server konnte nicht hergestellt werden.",
    "SSH_CONNECTION_CLOSED": "Die SSH-Verbindung wurde unerwartet geschlossen.",
    "PASSWORD_LOGIN_DISABLED": "Die Anmeldung per Passwort ist deaktiviert.",
    "PASSKEY_LOGIN_DISABLED": "Die Anmeldung per Passkey ist deaktiviert.",
    "RECOVERY_LOGIN_DISABLED": "Die Anmeldung per Wiederherstellungscode ist deaktiviert.",
    "PASSKEY_INVALID": "Ungültige Passkey.",
    "INVALID_AUTH_RESPONSE": "Ungültige Authentifizierungsantwort.",
    "INVALID_TOTP": "Ungültiger TOTP-Code.",
    "CAPTCHA_REQUIRED": "Eine captcha-Verifizierung ist erforderlich.",
    "CAPTCHA_FAILED": "Die captcha-Verifizierung ist fehlgeschlagen."
  }
} as const;

export default login;
