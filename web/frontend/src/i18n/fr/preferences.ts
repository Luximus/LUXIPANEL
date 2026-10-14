const preferences = {
  "pageTitle": "Préférences",
  "header": {
    "title": "Préférences",
    "subtitle": "Gérez votre profil et la sécurité du compte"
  },
  "placeholders": {
    "phone": "+33 6 00 00 00 00"
  },
  "profile": {
    "sectionTitle": "Profil",
    "labelDisplayName": "Nom d'affichage",
    "labelPhone": "Téléphone",
    "labelUsername": "Nom d'utilisateur",
    "labelRole": "Rôle",
    "btnSave": "Enregistrer le profil"
  },
  "password": {
    "sectionTitle": "Changer le mot de passe",
    "disabledNotice": "Le changement de mot de passe est désactivé dans LuxiPanel. Vous devez contacter un administrateur du serveur."
  },
  "passkeys": {
    "sectionTitle": "Passkeys",
    "sectionSubtitle": "Authentification biométrique / FIDO2",
    "btnAdd": "Ajouter une passkey",
    "emptyState": "Vous n'avez pas encore de clés d'accès enregistrées"
  },
  "recoveryCodes": {
    "sectionTitle": "Codes de récupération",
    "sectionSubtitle": "Utilisez-les si vous perdez l'accès à votre appareil",
    "btnRegenerate": "Régénérer",
    "loading": "Chargement...",
    "warning": "Conservez ces codes dans un endroit sûr. Ils ne sont affichés qu'une seule fois.",
    "btnCopy": "Tout copier",
    "btnPrint": "Imprimer"
  },
  "twoFactor": {
    "sectionTitle": "Authentification à deux facteurs (2FA)",
    "sectionSubtitle": "Protégez votre compte avec un code supplémentaire",
    "badgeDisabled": "Désactivé",
    "enabledDescription": "Votre compte est protégé par l'authentification en deux étapes. Vous aurez besoin d'un code de votre application d'authentification à chaque connexion.",
    "btnEnable": "Activer 2FA",
    "btnDisable": "Désactiver 2FA"
  },
  "auditLog": {
    "sectionTitle": "Activité récente",
    "emptyState": "Aucune activité enregistrée"
  },
  "dialogRegenCodes": {
    "title": "Régénérer les codes ?",
    "body": "Les codes précédents seront invalidés. Cette action est irréversible.",
    "btnCancel": "Annuler",
    "btnConfirm": "Régénérer"
  },
  "dialogSetup2fa": {
    "title": "Activer l'authentification en deux étapes",
    "subtitle": "Scannez ce code QR avec votre application d'authentification (Google Authenticator, Authy, etc.)",
    "manualEntryLabel": "Si vous ne pouvez pas scanner, saisissez manuellement :",
    "titleCopySecret": "Copier",
    "verifyCodeLabel": "Entrez le code à 6 chiffres pour confirmer :",
    "btnCancel": "Annuler",
    "btnConfirm": "Activer 2FA"
  },
  "dialogDisable2fa": {
    "title": "Désactiver le 2FA ?",
    "body": "Votre compte sera moins sécurisé. Vous pourrez le réactiver à tout moment.",
    "btnCancel": "Annuler",
    "btnConfirm": "Désactiver 2FA"
  },
  "toasts": {
    "profileUpdated": "Profil mis à jour",
    "errorUpdate": "Erreur lors de la mise à jour",
    "passwordUpdated": "Mot de passe mis à jour",
    "passkeyDeleted": "Passkey supprimée",
    "error": "Erreur",
    "registrationCancelled": "Inscription annulée",
    "passkeyRegistered": "Passkey enregistrée avec succès",
    "registrationCancelledByUser": "Inscription annulée par l'utilisateur",
    "codesCopied": "Codes copiés dans le presse-papiers",
    "secretCopied": "Secret copié dans le presse-papiers",
    "twoFaActivated": "2FA activé avec succès",
    "twoFaDeactivated": "2FA désactivé"
  },
  "errors": {
    "passwordMismatch": "Les mots de passe ne correspondent pas",
    "passwordTooShort": "Le mot de passe doit contenir au moins 8 caractères",
    "passwordChangeError": "Erreur lors du changement de mot de passe",
    "passkeyNotSupported": "Votre navigateur ne supporte pas Passkey. Veuillez utiliser Chrome, Firefox, Safari ou Edge récent.",
    "passkeyInitFailed": "Impossible de démarrer l'inscription",
    "passkeyFinishError": "Erreur lors de la finition de l'inscription",
    "generateCodesError": "Erreur lors de la génération des codes",
    "twoFaSetupError": "Erreur lors du démarrage de la configuration 2FA",
    "enterSixDigits": "Entrez les 6 chiffres du code",
    "invalidCode": "Code invalide",
    "twoFaDeactivateError": "Erreur lors de la désactivation de 2FA",
    "genericWithMessage": "Erreur : {message}"
  },
  "labels": {
    "passkeyRegistered": "Enregistrée {date}",
    "hasActiveCodes": "Vous avez des codes de récupération actifs.",
    "noActiveCodes": "Vous n'avez pas de codes de récupération actifs.",
    "notAvailable": "Non disponible",
    "codesGenerated": "{count} codes générés. Enregistrez-les dans un endroit sûr.",
    "printTitle": "Codes de récupération — LUXIPANEL",
    "printWarning": "Enregistrez ces codes dans un endroit sûr. Chaque code ne peut être utilisé qu'une seule fois.",
    "twoFaBadgeEnabled": "Activé",
    "twoFaBadgeDisabled": "Désactivé"
  },
  "confirm": {
    "deletePasskey": "Supprimer cette passkey ?",
    "deletePasskeyTitle": "Supprimer la passkey"
  },
  "actions": {
    "login": "Connexion",
    "logout": "Déconnexion",
    "passwordChange": "Changement de mot de passe",
    "passkeyRegister": "Passkey enregistrée",
    "passkeyDelete": "Passkey supprimée",
    "recoveryCodeUsed": "Code de récupération utilisé",
    "profileUpdate": "Profil mis à jour",
    "twoFaEnabled": "2FA activé",
    "twoFaDisabled": "2FA désactivé",
    "activateTwoFa": "Activer 2FA"
  }
} as const;

export default preferences;
