const login = {
  "pageTitle": "Sign in",
  "panelSubtitle": "Administration panel",
  "authError": "Authentication error",
  "forgotPassword": "Forgot my password",
  "forgotHint": "Enter your email and we'll send you a link to change your password.",
  "backToLogin": "Back to sign in",
  "recoverLinkSent": "If the email exists, we've sent a recovery link.",
  "recoverLinkError": "The recovery link could not be sent.",
  "languageLabel": "Language",
  "hostLabelFallback": "this panel",
  "tabs": {
    "password": "Password",
    "passkey": "Passkey",
    "recovery": "Recovery"
  },
  "labels": {
    "user": "User",
    "password": "Password",
    "sshPassphrase": "SSH key passphrase",
    "remember": "Remember me",
    "email": "Email",
    "recoveryCode": "Recovery code",
    "code6Digits": "6-digit code"
  },
  "placeholders": {
    "user": "admin",
    "email": "user@example.com",
    "password": "********",
    "sshPassphrase": "Your SSH key passphrase",
    "recoveryCode": "XXXX-XXXX-XXXX",
    "totp": "000000"
  },
  "text": {
    "biometricAuth": "Biometric authentication",
    "biometricHelp": "Use Face ID, fingerprint, or a security key",
    "usePasskey": "Use Passkey",
    "signIn": "Sign in",
    "sendRecoveryLink": "Send recovery link",
    "recoveryWarning": "Use a one-time recovery code if you've lost access to your device.",
    "verifyCode": "Verify code",
    "twoFactorTitle": "Two-step verification",
    "twoFactorHelp": "Enter the code from your authenticator app",
    "verify": "Verify",
    "footer": "LuxiPanel v2.0 - Secure Mail Administration"
  },
  "errors": {
    "captchaRequired": "Please complete the hCaptcha challenge.",
    "enterEmail": "Enter an email",
    "browserNoPasskey": "Your browser does not support Passkey. Use a recent version of Chrome, Firefox, Safari, or Edge.",
    "passkeyOptionsFailed": "Could not retrieve authentication options",
    "passkeyCanceled": "Authentication canceled",
    "passkeyCanceledByUser": "Authentication canceled by the user",
    "passkeyError": "Passkey error",
    "enterUserRecoveryCode": "Enter your user and recovery code",
    "enterTotp6Digits": "Enter the 6 digits of the code",
    "invalidTotpCode": "Invalid 2FA code"
  },
  "status": {
    "passkeyInit": "Starting authentication...",
    "passkeyWaiting": "Waiting for your passkey...",
    "passkeyVerifying": "Verifying..."
  },
  "authErrors": {
    "AUTH_ERROR": "Authentication error.",
    "NO_SSH_KEY": "There is no SSH key associated with this user on this panel.",
    "PANEL_UNRESOLVED": "The access panel could not be determined.",
    "PANEL_NO_IP": "The panel does not have an IP configured.",
    "USER_PROVISION_FAILED": "The user could not be provisioned on the panel.",
    "ACCOUNT_DISABLED": "The account is disabled.",
    "ACCOUNT_NOT_FOUND": "Account not found or disabled.",
    "USER_NOT_FOUND": "User not found.",
    "TWO_FA_REQUIRED": "This account requires 2FA. Set it up from Settings › Security before signing in.",
    "INVALID_PASSPHRASE": "Incorrect passphrase.",
    "PASSPHRASE_REQUIRED": "You must enter the user's passphrase.",
    "PASSPHRASE_VERIFY_FAILED": "The password could not be verified against the server.",
    "SERVER_SSH_KEY_MISSING": "The server's SSH key is not configured.",
    "PANEL_SSH_KEY_REJECTED": "The panel's SSH key is not accepted by the server.",
    "SSH_CONNECT_FAILED": "Could not connect to the SSH server.",
    "SSH_CONNECTION_CLOSED": "The SSH connection closed unexpectedly.",
    "PASSWORD_LOGIN_DISABLED": "Password sign-in is disabled.",
    "PASSKEY_LOGIN_DISABLED": "Passkey sign-in is disabled.",
    "RECOVERY_LOGIN_DISABLED": "Recovery code sign-in is disabled.",
    "PASSKEY_INVALID": "Invalid passkey.",
    "INVALID_AUTH_RESPONSE": "Invalid authentication response.",
    "INVALID_TOTP": "Invalid TOTP code.",
    "CAPTCHA_REQUIRED": "Captcha verification is required.",
    "CAPTCHA_FAILED": "Captcha verification failed."
  }
} as const;

export default login;
