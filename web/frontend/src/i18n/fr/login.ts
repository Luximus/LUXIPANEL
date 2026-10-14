const login = {
  "pageTitle": "Se connecter",
  "panelSubtitle": "Panneau d'administration",
  "authError": "Erreur d'authentification",
  "forgotPassword": "Mot de passe oublié",
  "forgotHint": "Saisissez votre adresse e-mail et nous vous enverrons un lien pour modifier votre mot de passe.",
  "backToLogin": "Retour à la connexion",
  "recoverLinkSent": "Si l'adresse e-mail existe, nous avons envoyé un lien de récupération.",
  "recoverLinkError": "Impossible d'envoyer le lien de récupération.",
  "languageLabel": "Langue",
  "hostLabelFallback": "ce panneau",
  "tabs": {
    "password": "Mot de passe",
    "passkey": "Passkey",
    "recovery": "Récupération"
  },
  "labels": {
    "user": "Utilisateur",
    "password": "Mot de passe",
    "sshPassphrase": "Phrase secrète de la clé SSH",
    "remember": "Se souvenir de moi",
    "email": "Adresse e-mail",
    "recoveryCode": "Code de récupération",
    "code6Digits": "Code à 6 chiffres"
  },
  "placeholders": {
    "user": "admin",
    "email": "utilisateur@exemple.com",
    "password": "********",
    "sshPassphrase": "Phrase secrète de votre clé SSH",
    "recoveryCode": "XXXX-XXXX-XXXX",
    "totp": "000000"
  },
  "text": {
    "biometricAuth": "Authentification biométrique",
    "biometricHelp": "Utilisez Face ID, l'empreinte digitale ou une clé de sécurité",
    "usePasskey": "Utiliser une Passkey",
    "signIn": "Se connecter",
    "sendRecoveryLink": "Envoyer le lien de récupération",
    "recoveryWarning": "Utilisez un code de récupération à usage unique si vous avez perdu l'accès à votre appareil.",
    "verifyCode": "Vérifier le code",
    "twoFactorTitle": "Vérification en deux étapes",
    "twoFactorHelp": "Saisissez le code de votre application d'authentification",
    "verify": "Vérifier",
    "footer": "LuxiPanel v2.0 - Administration de messagerie sécurisée"
  },
  "errors": {
    "captchaRequired": "Veuillez compléter le défi hCaptcha.",
    "enterEmail": "Saisissez une adresse e-mail",
    "browserNoPasskey": "Votre navigateur ne prend pas en charge les Passkey. Utilisez une version récente de Chrome, Firefox, Safari ou Edge.",
    "passkeyOptionsFailed": "Impossible d'obtenir les options d'authentification",
    "passkeyCanceled": "Authentification annulée",
    "passkeyCanceledByUser": "Authentification annulée par l'utilisateur",
    "passkeyError": "Erreur de passkey",
    "enterUserRecoveryCode": "Saisissez l'utilisateur et le code de récupération",
    "enterTotp6Digits": "Saisissez les 6 chiffres du code",
    "invalidTotpCode": "Code 2FA invalide"
  },
  "status": {
    "passkeyInit": "Démarrage de l'authentification...",
    "passkeyWaiting": "En attente de votre passkey...",
    "passkeyVerifying": "Vérification..."
  },
  "authErrors": {
    "AUTH_ERROR": "Erreur d'authentification.",
    "NO_SSH_KEY": "Aucune clé SSH associée à cet utilisateur sur ce panneau.",
    "PANEL_UNRESOLVED": "Impossible de déterminer le panneau d'accès.",
    "PANEL_NO_IP": "Le panneau n'a pas d'adresse IP configurée.",
    "USER_PROVISION_FAILED": "Impossible de provisionner l'utilisateur sur le panneau.",
    "ACCOUNT_DISABLED": "Le compte est désactivé.",
    "ACCOUNT_NOT_FOUND": "Compte introuvable ou désactivé.",
    "USER_NOT_FOUND": "Utilisateur introuvable.",
    "TWO_FA_REQUIRED": "Ce compte nécessite la 2FA. Configurez-la dans Paramètres › Sécurité avant de vous connecter.",
    "INVALID_PASSPHRASE": "Phrase secrète incorrecte.",
    "PASSPHRASE_REQUIRED": "Vous devez saisir la phrase secrète de l'utilisateur.",
    "PASSPHRASE_VERIFY_FAILED": "Impossible de vérifier le mot de passe auprès du serveur.",
    "SERVER_SSH_KEY_MISSING": "La clé SSH du serveur n'est pas configurée.",
    "PANEL_SSH_KEY_REJECTED": "La clé SSH du panneau n'est pas acceptée par le serveur.",
    "SSH_CONNECT_FAILED": "Impossible de se connecter au serveur SSH.",
    "SSH_CONNECTION_CLOSED": "La connexion SSH s'est fermée de manière inattendue.",
    "PASSWORD_LOGIN_DISABLED": "La connexion par mot de passe est désactivée.",
    "PASSKEY_LOGIN_DISABLED": "La connexion par passkey est désactivée.",
    "RECOVERY_LOGIN_DISABLED": "La connexion par code de récupération est désactivée.",
    "PASSKEY_INVALID": "Passkey invalide.",
    "INVALID_AUTH_RESPONSE": "Réponse d'authentification invalide.",
    "INVALID_TOTP": "Code TOTP invalide.",
    "CAPTCHA_REQUIRED": "Une vérification captcha est requise.",
    "CAPTCHA_FAILED": "La vérification captcha a échoué."
  }
} as const;

export default login;
