const preferences = {
  "pageTitle": "Preferencias",
  "header": {
    "title": "Preferencias",
    "subtitle": "Gestiona tu perfil y seguridad de la cuenta"
  },
  "placeholders": {
    "phone": "+34 600 000 000"
  },
  "profile": {
    "sectionTitle": "Perfil",
    "labelDisplayName": "Nombre para mostrar",
    "labelPhone": "Teléfono",
    "labelUsername": "Nombre de usuario",
    "labelRole": "Rol",
    "btnSave": "Guardar perfil"
  },
  "password": {
    "sectionTitle": "Cambiar contraseña",
    "disabledNotice": "El cambio de contraseña está deshabilitado en LUXIPANEL. Debes contactar a un administrador del servidor."
  },
  "passkeys": {
    "sectionTitle": "Passkeys",
    "sectionSubtitle": "Autenticación biométrica / FIDO2",
    "btnAdd": "Agregar passkey",
    "emptyState": "No tienes passkeys registradas aún"
  },
  "recoveryCodes": {
    "sectionTitle": "Códigos de recuperación",
    "sectionSubtitle": "Úsalos si pierdes acceso a tu dispositivo",
    "btnRegenerate": "Regenerar",
    "loading": "Cargando...",
    "warning": "Guarda estos códigos en un lugar seguro. Solo se muestran una vez.",
    "btnCopy": "Copiar todo",
    "btnPrint": "Imprimir"
  },
  "twoFactor": {
    "sectionTitle": "Autenticación de dos factores (2FA)",
    "sectionSubtitle": "Protege tu cuenta con un código adicional",
    "badgeDisabled": "Desactivado",
    "enabledDescription": "Tu cuenta está protegida con autenticación en dos pasos. Necesitarás un código de tu aplicación de autenticación cada vez que inicies sesión.",
    "btnEnable": "Activar 2FA",
    "btnDisable": "Desactivar 2FA"
  },
  "auditLog": {
    "sectionTitle": "Actividad reciente",
    "emptyState": "Sin actividad registrada"
  },
  "dialogRegenCodes": {
    "title": "¿Regenerar códigos?",
    "body": "Los códigos anteriores quedarán invalidados. Esta acción no se puede deshacer.",
    "btnCancel": "Cancelar",
    "btnConfirm": "Regenerar"
  },
  "dialogSetup2fa": {
    "title": "Activar autenticación en dos pasos",
    "subtitle": "Escanea este código QR con tu app de autenticación (Google Authenticator, Authy, etc.)",
    "manualEntryLabel": "Si no puedes escanear, ingresa manualmente:",
    "titleCopySecret": "Copiar",
    "verifyCodeLabel": "Ingresa el código de 6 dígitos para confirmar:",
    "btnCancel": "Cancelar",
    "btnConfirm": "Activar 2FA"
  },
  "dialogDisable2fa": {
    "title": "¿Desactivar 2FA?",
    "body": "Tu cuenta será menos segura. Podrás volver a activarlo en cualquier momento.",
    "btnCancel": "Cancelar",
    "btnConfirm": "Desactivar 2FA"
  },
  "toasts": {
    "profileUpdated": "Perfil actualizado",
    "errorUpdate": "Error al actualizar",
    "passwordUpdated": "Contraseña actualizada",
    "passkeyDeleted": "Passkey eliminada",
    "error": "Error",
    "registrationCancelled": "Registro cancelado",
    "passkeyRegistered": "Passkey registrada correctamente",
    "registrationCancelledByUser": "Registro cancelado por el usuario",
    "codesCopied": "Códigos copiados al portapapeles",
    "secretCopied": "Secret copiado al portapapeles",
    "twoFaActivated": "2FA activado correctamente",
    "twoFaDeactivated": "2FA desactivado"
  },
  "errors": {
    "passwordMismatch": "Las contraseñas no coinciden",
    "passwordTooShort": "La contraseña debe tener al menos 8 caracteres",
    "passwordChangeError": "Error al cambiar contraseña",
    "passkeyNotSupported": "Tu navegador no soporta Passkey. Por favor, usa Chrome, Firefox, Safari o Edge reciente.",
    "passkeyInitFailed": "No se pudo iniciar el registro",
    "passkeyFinishError": "Error al finalizar registro",
    "generateCodesError": "Error al generar códigos",
    "twoFaSetupError": "Error al iniciar configuración de 2FA",
    "enterSixDigits": "Ingresa los 6 dígitos del código",
    "invalidCode": "Código inválido",
    "twoFaDeactivateError": "Error al desactivar 2FA",
    "genericWithMessage": "Error: {message}"
  },
  "labels": {
    "passkeyRegistered": "Registrada {date}",
    "hasActiveCodes": "Tienes códigos de recuperación activos.",
    "noActiveCodes": "No tienes códigos de recuperación activos.",
    "notAvailable": "No disponible",
    "codesGenerated": "{count} códigos generados. Guárdalos en un lugar seguro.",
    "printTitle": "Códigos de recuperación — LUXIPANEL",
    "printWarning": "Guarda estos códigos en un lugar seguro. Cada uno solo puede usarse una vez.",
    "twoFaBadgeEnabled": "Activado",
    "twoFaBadgeDisabled": "Desactivado"
  },
  "confirm": {
    "deletePasskey": "¿Eliminar esta passkey?",
    "deletePasskeyTitle": "Eliminar passkey"
  },
  "actions": {
    "login": "Inicio de sesión",
    "logout": "Cierre de sesión",
    "passwordChange": "Cambio de contraseña",
    "passkeyRegister": "Passkey registrada",
    "passkeyDelete": "Passkey eliminada",
    "recoveryCodeUsed": "Código de recuperación usado",
    "profileUpdate": "Perfil actualizado",
    "twoFaEnabled": "2FA habilitado",
    "twoFaDisabled": "2FA deshabilitado",
    "activateTwoFa": "Activar 2FA"
  }
} as const;

export default preferences;
