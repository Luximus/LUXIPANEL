const preferences = {
  "pageTitle": "Preferenze",
  "header": {
    "title": "Preferenze",
    "subtitle": "Gestisci il tuo profilo e la sicurezza dell'account"
  },
  "placeholders": {
    "phone": "+39 300 000 0000"
  },
  "profile": {
    "sectionTitle": "Profilo",
    "labelDisplayName": "Nome visualizzato",
    "labelPhone": "Telefono",
    "labelUsername": "Nome utente",
    "labelRole": "Ruolo",
    "btnSave": "Salva profilo"
  },
  "password": {
    "sectionTitle": "Cambia password",
    "disabledNotice": "Il cambio di password è disabilitato in LuxiPanel. Devi contattare un amministratore del server."
  },
  "passkeys": {
    "sectionTitle": "Passkeys",
    "sectionSubtitle": "Autenticazione biometrica / FIDO2",
    "btnAdd": "Aggiungi passkey",
    "emptyState": "Non hai ancora passkey registrate"
  },
  "recoveryCodes": {
    "sectionTitle": "Codici di recupero",
    "sectionSubtitle": "Usali se perdi l'accesso al tuo dispositivo",
    "btnRegenerate": "Rigenera",
    "loading": "Caricamento...",
    "warning": "Conserva questi codici in un luogo sicuro. Vengono mostrati una sola volta.",
    "btnCopy": "Copia tutto",
    "btnPrint": "Stampa"
  },
  "twoFactor": {
    "sectionTitle": "Autenticazione a due fattori (2FA)",
    "sectionSubtitle": "Proteggi il tuo account con un codice aggiuntivo",
    "badgeDisabled": "Disattivato",
    "enabledDescription": "Il tuo account è protetto con l'autenticazione in due passaggi. Avrai bisogno di un codice dalla tua app di autenticazione ogni volta che accedi.",
    "btnEnable": "Attiva 2FA",
    "btnDisable": "Disattiva 2FA"
  },
  "auditLog": {
    "sectionTitle": "Attività recente",
    "emptyState": "Nessuna attività registrata"
  },
  "dialogRegenCodes": {
    "title": "Rigenerare i codici?",
    "body": "I codici precedenti verranno invalidati. Questa azione non può essere annullata.",
    "btnCancel": "Annulla",
    "btnConfirm": "Rigenera"
  },
  "dialogSetup2fa": {
    "title": "Attiva l'autenticazione in due passaggi",
    "subtitle": "Scansiona questo codice QR con la tua app di autenticazione (Google Authenticator, Authy, ecc.)",
    "manualEntryLabel": "Se non puoi scansionare, inserisci manualmente:",
    "titleCopySecret": "Copia",
    "verifyCodeLabel": "Inserisci il codice a 6 cifre per confermare:",
    "btnCancel": "Annulla",
    "btnConfirm": "Attiva 2FA"
  },
  "dialogDisable2fa": {
    "title": "Disattivare il 2FA?",
    "body": "Il tuo account sarà meno sicuro. Potrai riattivarlo in qualsiasi momento.",
    "btnCancel": "Annulla",
    "btnConfirm": "Disattiva 2FA"
  },
  "toasts": {
    "profileUpdated": "Profilo aggiornato",
    "errorUpdate": "Errore nell'aggiornamento",
    "passwordUpdated": "Password aggiornata",
    "passkeyDeleted": "Passkey eliminata",
    "error": "Errore",
    "registrationCancelled": "Registrazione annullata",
    "passkeyRegistered": "Passkey registrata correttamente",
    "registrationCancelledByUser": "Registrazione annullata dall'utente",
    "codesCopied": "Codici copiati negli appunti",
    "secretCopied": "Secret copiato negli appunti",
    "twoFaActivated": "2FA attivato correttamente",
    "twoFaDeactivated": "2FA disattivato"
  },
  "errors": {
    "passwordMismatch": "Le password non coincidono",
    "passwordTooShort": "La password deve avere almeno 8 caratteri",
    "passwordChangeError": "Errore nel cambio della password",
    "passkeyNotSupported": "Il tuo browser non supporta Passkey. Usa Chrome, Firefox, Safari o Edge recente.",
    "passkeyInitFailed": "Impossibile iniziare la registrazione",
    "passkeyFinishError": "Errore al completamento della registrazione",
    "generateCodesError": "Errore nella generazione dei codici",
    "twoFaSetupError": "Errore nell'avvio della configurazione di 2FA",
    "enterSixDigits": "Inserisci le 6 cifre del codice",
    "invalidCode": "Codice non valido",
    "twoFaDeactivateError": "Errore nella disattivazione di 2FA",
    "genericWithMessage": "Errore: {message}"
  },
  "labels": {
    "passkeyRegistered": "Registrata {date}",
    "hasActiveCodes": "Hai codici di recupero attivi.",
    "noActiveCodes": "Non hai codici di recupero attivi.",
    "notAvailable": "Non disponibile",
    "codesGenerated": "{count} codici generati. Conservali in un luogo sicuro.",
    "printTitle": "Codici di recupero — LUXIPANEL",
    "printWarning": "Conserva questi codici in un luogo sicuro. Ogni codice può essere usato una sola volta.",
    "twoFaBadgeEnabled": "Abilitato",
    "twoFaBadgeDisabled": "Disabilitato"
  },
  "confirm": {
    "deletePasskey": "Eliminare questa passkey?",
    "deletePasskeyTitle": "Elimina passkey"
  },
  "actions": {
    "login": "Accesso",
    "logout": "Disconnessione",
    "passwordChange": "Cambio della password",
    "passkeyRegister": "Passkey registrata",
    "passkeyDelete": "Passkey eliminata",
    "recoveryCodeUsed": "Codice di recupero utilizzato",
    "profileUpdate": "Profilo aggiornato",
    "twoFaEnabled": "2FA abilitato",
    "twoFaDisabled": "2FA disabilitato",
    "activateTwoFa": "Attiva 2FA"
  }
} as const;

export default preferences;
