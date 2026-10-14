const login = {
  "pageTitle": "Accedi",
  "panelSubtitle": "Pannello di amministrazione",
  "authError": "Errore di autenticazione",
  "forgotPassword": "Ho dimenticato la password",
  "forgotHint": "Inserisci la tua email e ti invieremo un link per cambiare la password.",
  "backToLogin": "Torna al login",
  "recoverLinkSent": "Se l'email esiste, abbiamo inviato un link di recupero.",
  "recoverLinkError": "Impossibile inviare il link di recupero.",
  "languageLabel": "Lingua",
  "hostLabelFallback": "questo pannello",
  "tabs": {
    "password": "Password",
    "passkey": "Passkey",
    "recovery": "Recupero"
  },
  "labels": {
    "user": "Utente",
    "password": "Password",
    "sshPassphrase": "Passphrase della chiave SSH",
    "remember": "Ricordami",
    "email": "Email",
    "recoveryCode": "Codice di recupero",
    "code6Digits": "Codice di 6 cifre"
  },
  "placeholders": {
    "user": "admin",
    "email": "utente@esempio.com",
    "password": "********",
    "sshPassphrase": "Passphrase della tua chiave SSH",
    "recoveryCode": "XXXX-XXXX-XXXX",
    "totp": "000000"
  },
  "text": {
    "biometricAuth": "Autenticazione biometrica",
    "biometricHelp": "Usa Face ID, impronta digitale o chiave di sicurezza",
    "usePasskey": "Usa Passkey",
    "signIn": "Accedi",
    "sendRecoveryLink": "Invia link di recupero",
    "recoveryWarning": "Usa un codice di recupero monouso se hai perso l'accesso al tuo dispositivo.",
    "verifyCode": "Verifica il codice",
    "twoFactorTitle": "Verifica in due passaggi",
    "twoFactorHelp": "Inserisci il codice dalla tua app di autenticazione",
    "verify": "Verifica",
    "footer": "LuxiPanel v2.0 - Amministrazione email sicura"
  },
  "errors": {
    "captchaRequired": "Completa la verifica hCaptcha.",
    "enterEmail": "Inserisci un'email",
    "browserNoPasskey": "Il tuo browser non supporta Passkey. Usa Chrome, Firefox, Safari o Edge recente.",
    "passkeyOptionsFailed": "Impossibile ottenere le opzioni di autenticazione",
    "passkeyCanceled": "Autenticazione annullata",
    "passkeyCanceledByUser": "Autenticazione annullata dall'utente",
    "passkeyError": "Errore di passkey",
    "enterUserRecoveryCode": "Inserisci utente e codice di recupero",
    "enterTotp6Digits": "Inserisci le 6 cifre del codice",
    "invalidTotpCode": "Codice 2FA non valido"
  },
  "status": {
    "passkeyInit": "Avvio autenticazione...",
    "passkeyWaiting": "In attesa della tua passkey...",
    "passkeyVerifying": "Verifica in corso..."
  },
  "authErrors": {
    "AUTH_ERROR": "Errore di autenticazione.",
    "NO_SSH_KEY": "Nessuna chiave SSH associata a questo utente in questo pannello.",
    "PANEL_UNRESOLVED": "Impossibile determinare il pannello di accesso.",
    "PANEL_NO_IP": "Il pannello non ha un IP configurato.",
    "USER_PROVISION_FAILED": "Impossibile effettuare il provisioning dell'utente nel pannello.",
    "ACCOUNT_DISABLED": "L'account è disabilitato.",
    "ACCOUNT_NOT_FOUND": "Account non trovato o disabilitato.",
    "USER_NOT_FOUND": "Utente non trovato.",
    "TWO_FA_REQUIRED": "Questo account richiede la 2FA. Configurala da Impostazioni › Sicurezza prima di accedere.",
    "INVALID_PASSPHRASE": "Passphrase errata.",
    "PASSPHRASE_REQUIRED": "Devi inserire la passphrase dell'utente.",
    "PASSPHRASE_VERIFY_FAILED": "Impossibile verificare la password sul server.",
    "SERVER_SSH_KEY_MISSING": "La chiave SSH del server non è configurata.",
    "PANEL_SSH_KEY_REJECTED": "La chiave SSH del pannello non è accettata dal server.",
    "SSH_CONNECT_FAILED": "Impossibile connettersi al server SSH.",
    "SSH_CONNECTION_CLOSED": "La connessione SSH si è chiusa inaspettatamente.",
    "PASSWORD_LOGIN_DISABLED": "L'accesso tramite password è disabilitato.",
    "PASSKEY_LOGIN_DISABLED": "L'accesso tramite passkey è disabilitato.",
    "RECOVERY_LOGIN_DISABLED": "L'accesso tramite codice di recupero è disabilitato.",
    "PASSKEY_INVALID": "Passkey non valida.",
    "INVALID_AUTH_RESPONSE": "Risposta di autenticazione non valida.",
    "INVALID_TOTP": "Codice TOTP non valido.",
    "CAPTCHA_REQUIRED": "È richiesta la verifica captcha.",
    "CAPTCHA_FAILED": "La verifica captcha non è riuscita."
  }
} as const;

export default login;
