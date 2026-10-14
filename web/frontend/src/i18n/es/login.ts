const login = {
  "pageTitle": "Iniciar sesión",
  "panelSubtitle": "Panel de administración",
  "authError": "Error de autenticación",
  "forgotPassword": "Olvidé mi contraseña",
  "forgotHint": "Ingresa tu correo y te enviaremos un enlace para cambiar tu contraseña.",
  "backToLogin": "Volver al inicio de sesión",
  "recoverLinkSent": "Si el correo existe, enviamos un enlace de recuperación.",
  "recoverLinkError": "No se pudo enviar el enlace de recuperación.",
  "languageLabel": "Idioma",
  "hostLabelFallback": "este panel",
  "tabs": {
    "password": "Contraseña",
    "passkey": "Passkey",
    "recovery": "Recuperación"
  },
  "labels": {
    "user": "Usuario",
    "password": "Contraseña",
    "sshPassphrase": "Passphrase de la llave SSH",
    "remember": "Recordarme",
    "email": "Correo electrónico",
    "recoveryCode": "Código de recuperación",
    "code6Digits": "Código de 6 dígitos"
  },
  "placeholders": {
    "user": "admin",
    "email": "usuario@dominio.com",
    "password": "********",
    "sshPassphrase": "Passphrase de tu llave SSH",
    "recoveryCode": "XXXX-XXXX-XXXX",
    "totp": "000000"
  },
  "text": {
    "biometricAuth": "Autenticación biométrica",
    "biometricHelp": "Usa Face ID, huella digital o llave de seguridad",
    "usePasskey": "Usar Passkey",
    "signIn": "Iniciar sesión",
    "sendRecoveryLink": "Enviar enlace de recuperación",
    "recoveryWarning": "Usa un código de recuperación de un solo uso si perdiste acceso a tu dispositivo.",
    "verifyCode": "Verificar código",
    "twoFactorTitle": "Verificación en dos pasos",
    "twoFactorHelp": "Ingresa el código de tu aplicación de autenticación",
    "verify": "Verificar",
    "footer": "LuxiPanel v2.0 - Administración de correo segura"
  },
  "errors": {
    "captchaRequired": "Completa el desafío hCaptcha.",
    "enterEmail": "Ingresa un correo electrónico",
    "browserNoPasskey": "Tu navegador no soporta Passkey. Usa Chrome, Firefox, Safari o Edge reciente.",
    "passkeyOptionsFailed": "No se pudieron obtener las opciones de autenticación",
    "passkeyCanceled": "Autenticación cancelada",
    "passkeyCanceledByUser": "Autenticación cancelada por el usuario",
    "passkeyError": "Error de passkey",
    "enterUserRecoveryCode": "Ingresa usuario y código de recuperación",
    "enterTotp6Digits": "Ingresa los 6 dígitos del código",
    "invalidTotpCode": "Código 2FA inválido"
  },
  "status": {
    "passkeyInit": "Iniciando autenticación...",
    "passkeyWaiting": "Esperando tu passkey...",
    "passkeyVerifying": "Verificando..."
  },
  "authErrors": {
    "AUTH_ERROR": "Error de autenticación.",
    "NO_SSH_KEY": "No hay llave SSH asociada a este usuario en este panel.",
    "PANEL_UNRESOLVED": "No se pudo determinar el panel de acceso.",
    "PANEL_NO_IP": "El panel no tiene una IP configurada.",
    "USER_PROVISION_FAILED": "No se pudo aprovisionar el usuario en el panel.",
    "ACCOUNT_DISABLED": "La cuenta está deshabilitada.",
    "ACCOUNT_NOT_FOUND": "Cuenta no encontrada o deshabilitada.",
    "USER_NOT_FOUND": "Usuario no encontrado.",
    "TWO_FA_REQUIRED": "Esta cuenta requiere 2FA. Configúralo desde Ajustes › Seguridad antes de iniciar sesión.",
    "INVALID_PASSPHRASE": "Passphrase incorrecta.",
    "PASSPHRASE_REQUIRED": "Debes ingresar la passphrase del usuario.",
    "PASSPHRASE_VERIFY_FAILED": "No se pudo verificar la contraseña contra el servidor.",
    "SERVER_SSH_KEY_MISSING": "La llave SSH del servidor no está configurada.",
    "PANEL_SSH_KEY_REJECTED": "La llave SSH del panel no es aceptada por el servidor.",
    "SSH_CONNECT_FAILED": "No se pudo conectar al servidor SSH.",
    "SSH_CONNECTION_CLOSED": "La conexión SSH se cerró inesperadamente.",
    "PASSWORD_LOGIN_DISABLED": "El inicio de sesión por contraseña está deshabilitado.",
    "PASSKEY_LOGIN_DISABLED": "El inicio de sesión por passkey está deshabilitado.",
    "RECOVERY_LOGIN_DISABLED": "El inicio de sesión por código de recuperación está deshabilitado.",
    "PASSKEY_INVALID": "Passkey inválida.",
    "INVALID_AUTH_RESPONSE": "Respuesta de autenticación inválida.",
    "INVALID_TOTP": "Código TOTP inválido.",
    "CAPTCHA_REQUIRED": "Se requiere verificación captcha.",
    "CAPTCHA_FAILED": "La verificación captcha falló."
  }
} as const;

export default login;
