const settings = {
  "passkeyName": {
    "title": "Nombre de la passkey",
    "hint": "Usa un nombre que te ayude a reconocer el dispositivo.",
    "placeholder": "Ej. Portátil personal",
    "save": "Guardar nombre",
    "edit": "Editar nombre",
    "invalid": "Escribe un nombre de 1 a 128 caracteres.",
    "saved": "Nombre actualizado",
    "error": "No se pudo guardar el nombre.",
    "cancel": "Cancelar"
},
  "placeholders": {
    "logoUrl": "https://ejemplo.com/logo.png",
    "imageUrl": "https://…/image.jpg"
  },
  "pageTitle": "Ajustes",
  "loadFailure": {
    "title": "No se pudo cargar Ajustes",
    "sessionMessage": "No se pudo cargar Ajustes: la sesión con el servidor no está disponible. Vuelve a seleccionar el servidor en el selector, o cierra sesión e inicia de nuevo.",
    "genericMessage": "No se pudo cargar Ajustes. Revisa tu conexión e inténtalo de nuevo.",
    "retry": "Reintentar"
  },
  "header": {
    "title": "Ajustes del panel",
    "subtitle": "Configuración global de LUXIPANEL",
    "autosave": "Guardado automático"
  },
  "tabs": {
    "general": "General",
    "layoutUi": "Layout/UI",
    "security": "Seguridad",
    "modules": "Módulos",
    "system": "Sistema",
    "credentials": "Credenciales"
  },
  "credentials": {
    "hcaptcha": {
      "title": "hCaptcha",
      "desc": "Protege el inicio de sesión del panel con un desafío hCaptcha. Introduce las claves desde tu panel de hCaptcha.",
      "sitekeyLabel": "Clave del sitio",
      "sitekeyPlaceholder": "Tu site key de hCaptcha",
      "secretLabel": "Clave secreta",
      "secretPlaceholder": "Introduce una nueva secret key",
      "secretConfigured": "Ya hay una secret key configurada. Deja este campo vacío para conservarla.",
      "statusConfigured": "Configurado",
      "statusMissing": "Sin configurar",
      "saved": "Ajustes de hCaptcha guardados"
    },
    "tolqia": {
      "label": "Tolqia",
      "help": "Token de API de tu cuenta Tolqia (plan Plus o Premium) — habilita llamadas con traducción para los usuarios de este servidor",
      "guide": {
        "steps": [
          "Entra en tolqia.com e inicia sesión con tu cuenta (plan Plus o Premium).",
          "Abre «Ajustes» › «API» y crea un token nuevo.",
          "Copia el token (empieza por tq_live_) y pégalo en «Configurar»."
        ],
        "docUrl": "https://tolqia.com/settings/api",
        "docLabel": "Crear token en tolqia.com → Ajustes › API",
        "docUrl2": "https://tolqia.com/docs",
        "docLabel2": "Documentación"
      }
    },
    "elevenlabs": {
      "label": "ElevenLabs",
      "help": "Se usa para la traducción en tiempo real de las audiollamadas",
      "voiceIdLabel": "Voice ID por defecto",
      "voiceIdPlaceholder": "p. ej. 21m00Tcm4TlvDq8ikWAM",
      "guide": {
        "steps": [
          "Entra a elevenlabs.io e inicia sesión.",
          "Abre «My Account» → «Clave APIs» y crea una clave nueva.",
          "Copia la clave (empieza por sk_) y pégala en «Configurar»."
        ],
        "docUrl": "https://elevenlabs.io/app/settings/api-keys",
        "docLabel": "Claves de API de ElevenLabs"
      }
    },
    "title": "Credenciales de módulos",
    "subtitle": "Administra los Access Tokens y claves API que los módulos necesitan para funcionar.",
    "empty": "No hay módulos que requieran credenciales habilitados en este servidor.",
    "statusSet": "Configurado",
    "statusMissing": "Sin configurar",
    "tokenLabel": "Token de acceso / clave API",
    "tokenPlaceholder": "Pega el token…",
    "save": "Guardar",
    "test": "Probar",
    "clear": "Quitar",
    "manage": "Administrar",
    "show": "Mostrar",
    "hide": "Ocultar",
    "saved": "Credencial guardada",
    "cleared": "Credencial eliminada",
    "testOk": "Conexión válida",
    "testFail": "No se pudo validar la credencial",
    "confirmClear": "¿Quitar esta credencial?",
    "confirmClearTitle": "Quitar credencial",
    "error": "Ocurrió un error",
    "getDoc": "Obtener un token",
    "managedLabel": {
      "assistant": "Agentes IA"
    },
    "managedHint": {
      "assistant": "Las claves API de los proveedores del asistente se administran en su panel.",
      "backups": "Las llaves de almacenamiento (S3 / R2) se administran en el módulo Backups."
    },
    "managedSummary": {
      "assistant": "Proveedores de IA (Claude, OpenAI, Gemini, …)",
      "backups": "Credenciales de almacenamiento S3 / R2"
    },
    "storage": {
      "accountId": "ID de cuenta (Cloudflare)",
      "accessKeyId": "ID de clave de acceso",
      "secret": "Clave de acceso secreta",
      "endpoint": "Endpoint (opcional)",
      "region": "Región (opcional)",
      "r2Hint": "Credencial de cuenta R2 reutilizable por Backups: define las llaves una sola vez aquí y en Backups solo eliges el bucket.",
      "s3Hint": "Credencial S3 reutilizable por Backups: define las llaves una sola vez aquí y en Backups solo eliges el bucket."
    },
    "connector": {
      "connect": "Guardar y conectar",
      "disconnect": "Desconectar",
      "connected": "Conectado",
      "configured": "Configurado",
      "notConnected": "Sin conectar",
      "unavailable": "Requiere el módulo Agentes IA habilitado",
      "setupGuide": "Guía de configuración"
    },
    "help": {
      "tabConfig": "Configurar",
      "tabHelp": "Ayuda",
      "openLink": "Abrir enlace",
      "guides": {
        "cloudflare": {
          "steps": [
            "Entra a dash.cloudflare.com → «Mi perfil» → «Tokens de API».",
            "Pulsa «Crear token»: usa la plantilla «Editar zona DNS» o crea uno personalizado con los permisos que necesites (Zona:Lectura, DNS:Editar, etc.).",
            "Elige las zonas a las que dará acceso y crea el token.",
            "Copia el token (solo se muestra una vez) y pégalo en la pestaña «Configurar»."
          ],
          "docUrl": "https://dash.cloudflare.com/profile/api-tokens",
          "docLabel": "Tokens de API de Cloudflare"
        },
        "expo": {
          "steps": [
            "Entra a expo.dev e inicia sesión → «Account settings» → «Access tokens».",
            "Pulsa «Create token», ponle un nombre y copia el valor generado.",
            "Pégalo en la pestaña «Configurar»."
          ],
          "docUrl": "https://expo.dev/settings/access-tokens",
          "docLabel": "Access tokens de Expo"
        },
        "openclaw": {
          "steps": [
            "Entra a openclaw.ai e inicia sesión.",
            "Genera o copia tu clave API desde el panel de OpenClaw.",
            "Pégala en «Configurar» (ajusta el endpoint y el modelo por defecto si difieren)."
          ],
          "docUrl": "https://openclaw.ai",
          "docLabel": "OpenClaw"
        },
        "repository-store": {
          "steps": [
            "Entra a github.com → «Settings» → «Developer settings» → «Personal access tokens».",
            "Genera un token (classic o fine-grained) con permiso de lectura de repositorios (public_repo o Contents: Read).",
            "Copia el token (empieza por ghp_ o github_pat_) y pégalo en «Configurar»."
          ],
          "docUrl": "https://github.com/settings/tokens",
          "docLabel": "Tokens de GitHub"
        },
        "bitninja": {
          "steps": [
            "Entra al panel de BitNinja (admin.bitninja.io) e inicia sesión.",
            "Copia tu License Key desde la sección de licencias/servidores.",
            "Pégala en «Configurar»."
          ],
          "docUrl": "https://bitninja.io",
          "docLabel": "BitNinja"
        },
        "r2": {
          "steps": [
            "Entra a dash.cloudflare.com → «R2» → «Manage R2 API Tokens».",
            "Crea un «R2 API Token» (compatible S3) con permiso de lectura/escritura de objetos.",
            "Copia el Access Key ID y el Secret Access Key que muestra.",
            "Tu Account ID aparece en la página de R2 / resumen de la cuenta.",
            "Pega Account ID + Access Key ID + Secret en «Configurar» (el endpoint se deriva del Account ID)."
          ],
          "docUrl": "https://dash.cloudflare.com/?to=/:account/r2/api-tokens",
          "docLabel": "Tokens de API de R2"
        },
        "s3": {
          "steps": [
            "En la consola de AWS: «IAM» → «Users» → tu usuario → «Security credentials» → «Create access key».",
            "Copia el Access Key ID y el Secret Access Key.",
            "Si usas un servicio compatible con S3 (Wasabi, MinIO, etc.), anota su Endpoint y Región.",
            "Pega las llaves (y el Endpoint/Región si aplica) en «Configurar»."
          ],
          "docUrl": "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html",
          "docLabel": "Claves de acceso de AWS"
        }
      }
    }
  },
  "general": {
    "hcaptchaEnabled": "Requerir hCaptcha al iniciar sesión",
    "hcaptchaEnabledHint": "Muestra un desafío hCaptcha en el formulario de inicio de sesión del panel.",
    "sectionTitle": "General",
    "labelPanelName": "Nombre del panel",
    "labelTimezone": "Zona horaria",
    "labelLanguage": "Idioma",
    "languageOptions": {
      "en": "English",
      "es": "Español"
    },
    "labelSessionTtl": "Duración de sesión (horas)",
    "labelMaxLoginAttempts": "Intentos de login fallidos (bloqueo)",
    "labelRequire2fa": "Requerir 2FA para todos los usuarios",
    "btnViewLog": "Ver log",
    "labelAuditLog": "Habilitar log de auditoría",
    "labelSwitchNewTab": "Abrir el servidor en una pestaña nueva al cambiar"
  },
  "layout": {
    "sectionTitle": "Layout, branding y UI",
    "sectionSubtitle": "Personaliza logos, radios, sombras y colores base del frontend.",
    "branding": {
      "groupTitle": "Branding y logos",
      "groupDesc": "Logo único aplicado a sidebar, login, header, footer y favicon.",
      "labelLogoUrl": "URL del logo",
      "logoUrlHelp": "Logo único que se usa en todos los sitios: sidebar, login, header del panel, footer y pantallas públicas.",
      "btnUpload": "Subir",
      "btnPick": "Elegir",
      "btnDefault": "Predeterminado",
      "restoreLogos": "Restaurar logos",
      "loginLogoOpacity": "Opacidad del contenedor del logo (login)",
      "loginLogoOpacityHelp": "Translucidez del fondo del círculo del logo en /login (0 = transparente, 100 = sólido)."
    },
    "loginBg": {
      "groupTitle": "Fondo de login",
      "groupDesc": "Efecto animado del fondo en /login y su color de reserva.",
      "enableLabel": "Mostrar fondo animado en /login",
      "labelFallbackColor": "Color de fondo cuando está desactivado",
      "labelActiveEffect": "Efecto activo en /login",
      "previewTitle": "Vista previa del acceso"
    },
    "shape": {
      "groupTitle": "Forma y sombras",
      "groupDesc": "Radio global, sombras de tarjetas y modales del frontend.",
      "labelRadius": "Radio global",
      "radiusHelp": "Ej: 0.5rem, 12px.",
      "labelShadow": "Sombra base",
      "labelModalShadow": "Sombra modal",
      "labelModalBackdrop": "Overlay modal",
      "backdropHelp": "Fondo de diálogos.",
      "layer1": "Capa 1",
      "layer2": "Capa 2",
      "labelColor": "Color",
      "labelShadowSingle": "Sombra"
    },
    "palettes": {
      "title": "Tema de color",
      "subtitle": "Elige una paleta predefinida; se aplica a todo el panel (claro y oscuro).",
      "light": "Tema claro",
      "dark": "Tema oscuro",
      "intensity": "Intensidad"
    },
    "resetButton": "Restablecer estilos por defecto",
    "panelBg": {
      "groupTitle": "Fondo del panel",
      "groupDesc": "Efecto animado del fondo dentro del panel y su color de reserva.",
      "enableLabel": "Mostrar fondo animado en el panel",
      "labelFallbackColor": "Color de fondo cuando está desactivado",
      "labelActiveEffect": "Efecto activo del panel"
    }
  },
  "security": {
    "sectionTitle": "Seguridad",
    "loginMethodsTitle": "Métodos de inicio de sesión permitidos",
    "loginMethodsDesc": "Al menos un método debe permanecer activo. Los métodos desactivados no aparecerán en la pantalla de login.",
    "loginMethodsWarning": "Debe quedar al menos un método activo.",
    "passkey": {
      "name": "Passkey",
      "desc": "Autenticación biométrica / FIDO2. Los usuarios deben registrar su dispositivo.",
      "verifying": "Verificando...",
      "btnManage": "Gestionar"
    },
    "password": {
      "name": "Contraseña",
      "desc": "Login con usuario y contraseña. Siempre disponible sin configuración previa.",
      "configured": "Configurado"
    },
    "recovery": {
      "name": "Recuperación",
      "desc": "Códigos de un solo uso como respaldo de emergencia.",
      "verifying": "Verificando...",
      "btnManage": "Gestionar"
    },
    "twoFaStatus": {
      "groupTitle": "Estado 2FA para esta cuenta",
      "badgeDisabled": "Desactivado",
      "promptText": "Activa 2FA para proteger esta cuenta administrativa.",
      "btnSetup": "Configurar",
      "btnDelete": "Eliminar",
      "btnDisable": "Deshabilitar"
    }
  },
  "modules": {
    "sectionTitle": "Motores de caché por módulo",
    "sectionDesc1": "Estado y ajuste de la recolección programada en el servidor del cliente.",
    "sectionDescBold": "Activo/Inactivo deriva del módulo padre",
    "modulesLink": "Módulos",
    "sectionDesc2": ": al desactivar un módulo se apaga su recolección; al reactivarlo se vuelve a programar. Aquí solo se ajusta la frecuencia. Las DataTables leen datos pre-formados desde Redis dedicado en ese servidor; si está apagado o muy viejo se cae al JSON normal.",
    "loading": "Cargando…",
    "tableHeaders": {
      "module": "Módulo / colección",
      "source": "Origen",
      "active": "Activo",
      "interval": "Intervalo (s)",
      "lastRefresh": "Último refresco",
      "duration": "Duración",
      "size": "Tamaño",
      "hitRatio": "Tasa de aciertos"
    },
    "managedInPre": " (gestionado en ",
    "managedInPost": ")"
  },
  "system": {
    "factoryReset": {
      "sectionTitle": "Restablecer ajustes",
      "sectionSubtitle": "Restaura los ajustes del panel a los valores de fábrica.",
      "warningTitle": "Advertencia",
      "warningBefore": "Esta acción restablece ",
      "warningAllSettings": "todos los ajustes de configuración",
      "warningMiddle": " del panel (general, layout/UI, SMTP, seguridad y las preferencias guardadas por módulos) a sus valores por defecto. Los usuarios y módulos instalados ",
      "warningNotDeleted": "no se eliminan",
      "warningAfter": ".",
      "btnReset": "Restablecer ajustes de fábrica"
    },
    "backupRestore": {
      "sectionTitle": "Restaurar desde backup",
      "sectionSubtitle": "Restaura el panel desde un backup previo (módulo Backups requerido).",
      "loading": "Cargando backups...",
      "btnRestore": "Restaurar backup seleccionado"
    },
    "noBackup": {
      "title": "Restauración desde backup no disponible",
      "descBefore": "Instala el módulo ",
      "backupsModule": "Copias de seguridad",
      "descAfter": " desde el panel de módulos para habilitar esta función."
    }
  },
  "imagePicker": {
    "title": "Elegir imagen",
    "subtitle": "Imágenes disponibles en la carpeta pública del frontend.",
    "empty": "No hay imágenes en la carpeta pública.",
    "btnUpload": "Subir nueva imagen",
    "btnCancel": "Cancelar"
  },
  "smtpTest": {
    "dialogTitle": "Enviar correo de prueba",
    "labelRecipient": "Destinatario",
    "placeholderRecipient": "tu@ejemplo.com",
    "btnCancel": "Cancelar",
    "btnSend": "Enviar"
  },
  "passkeysDialog": {
    "title": "Gestionar Passkeys",
    "btnAdd": "Agregar passkey",
    "empty": "No hay passkeys registradas"
  },
  "recoveryDialog": {
    "title": "Códigos de recuperación",
    "btnGenerate": "Generar / regenerar",
    "loading": "Cargando...",
    "warningText": "Guarda estos códigos en un lugar seguro. Solo se muestran una vez.",
    "btnCopy": "Copiar todo",
    "btnPrint": "Imprimir"
  },
  "setup2faDialog": {
    "title": "Configurar 2FA",
    "subtitle": "Escanea este código QR con tu app de autenticación.",
    "secretLabel": "Secret manual:",
    "copyTitle": "Copiar",
    "verifyLabel": "Ingresa el código de 6 dígitos:",
    "btnCancel": "Cancelar",
    "btnActivate": "Activar 2FA"
  },
  "disable2faDialog": {
    "title": "¿Desactivar 2FA?",
    "body": "2FA quedará desactivado, pero el secreto se conservará para volver a activarlo después.",
    "btnCancel": "Cancelar",
    "btnConfirm": "Deshabilitar 2FA"
  },
  "delete2faDialog": {
    "title": "¿Eliminar 2FA?",
    "body": "Se borrará el secreto almacenado y tendrás que configurarlo de nuevo para volver a usar 2FA.",
    "btnCancel": "Cancelar",
    "btnConfirm": "Eliminar 2FA"
  },
  "auditLogDialog": {
    "title": "Log de auditoría",
    "empty": "Sin actividad registrada"
  },
  "modulesCache": {
    "agoSeconds": "hace {n}s",
    "agoMinutes": "hace {n}m",
    "agoHours": "hace {n}h",
    "agoDays": "hace {n}d",
    "collectionSingular": "colección",
    "collectionPlural": "colecciones",
    "activeSingular": "activa",
    "activePlural": "activas",
    "enabledTitle": "Recolección programada vía dispatcher del servidor cliente",
    "badgeEnabled": "Activa",
    "disabledTitle": "Módulo padre desactivado en /panel/modules — la recolección queda pausada",
    "badgeDisabled": "Inactiva",
    "buttonSave": "Guardar",
    "saving": "Guardando…",
    "savedStatus": "{module}/{collection} actualizado",
    "saveError": "Error guardando {module}/{collection}: {message}",
    "loadedSummary": "{count} colecciones cacheables en {modules} módulos. Los cambios se aplican en la siguiente vuelta del recolector (≤60s).",
    "loadError": "Error: {message}"
  },
  "imageList": {
    "labelJson": "(JSON)",
    "labelUrls": "(URLs de imagen)",
    "addButton": "Añadir imagen"
  },
  "labels": {
    "auditLogin": "Inicio de sesión",
    "auditLoginFailed": "Intento de login fallido",
    "auditLogout": "Cierre de sesión",
    "auditPasswordChange": "Cambio de contraseña",
    "auditPasskeyRegister": "Passkey registrada",
    "auditPasskeyDelete": "Passkey eliminada",
    "auditRecoveryCodeUsed": "Código de recuperación usado",
    "auditProfileUpdate": "Perfil actualizado",
    "auditSettingsUpdate": "Ajustes actualizados",
    "audit2faEnabled": "2FA habilitado",
    "audit2faDisabled": "2FA deshabilitado",
    "auditEventDefault": "Evento",
    "aiHintAnthropic": "Modelos recomendados: claude-fable-5 (más reciente), claude-sonnet-4-6 (equilibrio), claude-opus-4-6 (más potente)",
    "aiKeyHintAnthropic": "Obten tu clave API en console.anthropic.com",
    "aiHintOpenai": "gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna",
    "aiKeyHintOpenai": "Obten tu clave API en platform.openai.com",
    "aiHintOllama": "Nombre del modelo instalado en Ollama local. No soporta herramientas.",
    "aiKeyHintOllama": "No requiere clave API para Ollama local",
    "managedByLp": "Gestionado por LP-LICENSE-SERVER",
    "notAvailable": "No disponible",
    "managedExternally": "Gestionado externamente",
    "twoFaManagedByLp": "La autenticación se administra desde LP-LICENSE-SERVER en este modo.",
    "licenseNoStatus": "Sin estado",
    "licenseActive": "Activa",
    "licenseExpires": "vence {date}",
    "licenseActiveDesc": "Licencia activa",
    "licenseDegraded": "Degradada",
    "licensePending": "Pendiente",
    "licenseDegradedDesc": "La licencia no pudo validarse y el panel está en modo degradado.",
    "licenseNotActivated": "La licencia todavía no está activada.",
    "passkeyCount": "{count} passkey(s) registrada(s)",
    "noPasskeys": "Sin passkeys registradas",
    "recoveryCodesGenerated": "Códigos de recuperación generados",
    "noRecoveryCodes": "Sin códigos generados",
    "passkeyRegistered": "Registrada {date}",
    "recoveryCodesActive": "Tienes códigos de recuperación activos.",
    "recoveryCodesNone": "No tienes códigos de recuperación activos.",
    "recoveryCodesDisplayed": "{count} códigos generados. Guárdalos en un lugar seguro.",
    "twoFaEnabled": "Activado",
    "twoFaEnabledDesc": "Se pedirá este 2FA en el siguiente inicio de sesión. Puedes deshabilitarlo sin borrar el secreto.",
    "twoFaDisabled": "Desactivado",
    "twoFaDisabledDesc": "El secreto sigue guardado, pero no se pedirá en login hasta que lo actives de nuevo.",
    "twoFaSetupPrompt": "Activa 2FA para proteger esta cuenta administrativa.",
    "printRecoveryCodesTitle": "Códigos de recuperación - LUXIPANEL",
    "printRecoveryCodesDesc": "Guarda estos códigos en un lugar seguro. Cada uno solo puede usarse una vez."
  },
  "toasts": {
    "errorSaving": "Error al guardar ajustes",
    "errorSavingAppearance": "No se pudo guardar la apariencia en el servidor de licencias. Reintenta en unos segundos.",
    "licenseKeyAndRefRequired": "Ingresa la clave y la referencia de pago",
    "licenseActivated": "Licencia activada correctamente",
    "licenseActivateError": "No se pudo activar la licencia",
    "timezoneApplyError": "No se pudo aplicar la zona horaria al sistema",
    "timezoneSavedNotApplied": "Zona horaria guardada en el panel, pero no se pudo aplicar al sistema (revisa permisos sudo).",
    "passkeysInLp": "Passkeys se gestionan en LP-LICENSE-SERVER",
    "passkeyDeleted": "Passkey eliminada",
    "passkeyDeleteError": "Error al eliminar passkey",
    "passkeyBrowserUnsupported": "Tu navegador no soporta Passkey",
    "passkeyRegisterInitError": "No se pudo iniciar el registro",
    "passkeyRegisterCancelled": "Registro cancelado",
    "passkeyRegisterFinishError": "Error al finalizar registro",
    "passkeyRegistered": "Passkey registrada correctamente",
    "passkeyRegisterUserCancelled": "Registro cancelado por el usuario",
    "passkeyRegisterError": "Error al registrar passkey",
    "recoveryCodesInLp": "Los códigos de recuperación se gestionan en LP-LICENSE-SERVER",
    "recoveryCodesGenerateError": "Error al generar códigos",
    "twoFaInLp": "2FA se gestiona en LP-LICENSE-SERVER",
    "twoFaSetupInitError": "Error al iniciar configuración de 2FA",
    "twoFaQrError": "No se pudo generar el QR",
    "twoFaActivated": "2FA activado correctamente",
    "twoFaDisabled": "2FA deshabilitado para el inicio de sesión",
    "twoFaDisableError": "Error al desactivar 2FA",
    "twoFaReactivated": "2FA activado para el inicio de sesión",
    "twoFaActivateError": "Error al activar 2FA",
    "twoFaDeleted": "2FA eliminado",
    "twoFaDeleteError": "Error al eliminar 2FA",
    "backupRestoreUnavailable": "La restauracion de backups aun no esta disponible desde este panel.",
    "imageExceeds5mb": "La imagen excede 5MB",
    "uploadingImage": "Subiendo imagen...",
    "imageUploadError": "Error al subir imagen",
    "imageUploadInvalidResponse": "Respuesta inválida del servidor",
    "imageUploaded": "Imagen subida correctamente",
    "logosRestored": "Logos restaurados a los valores por defecto",
    "codesCopied": "Códigos copiados",
    "secretCopied": "Secret copiado",
    "smtpTestSent": "Correo de prueba enviado a {to}",
    "smtpTestError": "Error al enviar",
    "layoutReset": "Estilos restablecidos a los valores por defecto",
    "settingsReset": "Ajustes restablecidos",
    "settingsResetError": "Error al restablecer",
    "licenseRevalidated": "Licencia revalidada",
    "licenseRevalidateError": "No se pudo revalidar la licencia"
  },
  "actions": {
    "activating": "Activando...",
    "activateOrUpdate": "Activar / actualizar",
    "manage": "Administrar",
    "configure": "Configurar",
    "viewOrRegenerate": "Ver / regenerar",
    "generate": "Generar",
    "generating": "Generando...",
    "generateOrRegenerate": "Generar / regenerar",
    "disable": "Deshabilitar",
    "activate": "Activar",
    "activate2fa": "Activar 2FA",
    "continue": "Continuar",
    "sending": "Enviando...",
    "send": "Enviar",
    "resetting": "Restableciendo...",
    "factoryReset": "Restablecer ajustes de fabrica"
  },
  "errors": {
    "twoFaEnter6Digits": "Ingresa los 6 dígitos del código",
    "twoFaInvalidCode": "Código inválido"
  },
  "confirm": {
    "deletePasskeyTitle": "Eliminar passkey",
    "deletePasskeyBody": "¿Eliminar esta passkey?",
    "restoreBackupBody": "¿Restaurar el backup \"{id}\"?",
    "restoreBackupTitle": "Restaurar backup",
    "restoreLogosBody": "¿Restaurar el logo a los valores por defecto de LUXIPANEL?",
    "restoreLogosTitle": "Restaurar logos",
    "restoreLogosConfirm": "Sí, restaurar",
    "resetLayoutBody": "¿Restablecer los estilos de la interfaz a los valores por defecto de LUXIPANEL? Se perderán logos, colores, sombras y fondos personalizados.",
    "resetLayoutTitle": "Restablecer estilos",
    "resetLayoutConfirm": "Sí, restablecer",
    "factoryResetBody": "¿Estás seguro? Esto restablecerá todos los ajustes del panel.",
    "factoryResetTitle": "Restablecer ajustes",
    "factoryResetConfirm": "Sí, restablecer"
  },
  "empty": {
    "noBackups": "No hay backups disponibles."
  },
  "palettes": {
    "luxisoft": {
      "name": "Luxisoft",
      "description": "Azul marino y menta en claro; grafito y menta en oscuro."
    },
    "violet": {
      "name": "Violeta",
      "description": "Paleta por defecto de LUXIPANEL."
    },
    "ocean": {
      "name": "Océano",
      "description": "Azules profesionales y serenos."
    },
    "emerald": {
      "name": "Esmeralda",
      "description": "Verdes frescos y naturales."
    },
    "sunset": {
      "name": "Atardecer",
      "description": "Naranjas y ámbar cálidos."
    },
    "rose": {
      "name": "Rosa",
      "description": "Rosados y magentas vibrantes."
    },
    "indigo": {
      "name": "Índigo",
      "description": "Índigos elegantes y modernos."
    },
    "aqua": {
      "name": "Aqua",
      "description": "Turquesas y cian luminosos."
    },
    "graphite": {
      "name": "Grafito",
      "description": "Neutro monocromático y sobrio."
    },
    "amber": {
      "name": "Ámbar",
      "description": "Dorados y miel cálidos."
    },
    "fuchsia": {
      "name": "Fucsia",
      "description": "Magentas y púrpuras intensos."
    },
    "lime": {
      "name": "Lima",
      "description": "Verdes lima enérgicos."
    },
    "slate": {
      "name": "Pizarra",
      "description": "Gris azulado profesional."
    },
    "prisma": {
      "name": "Prisma",
      "description": "Combina los colores de todas las paletas en una transición continua e infinita.",
      "colors": "Colores",
      "addColorButton": "Añadir color",
      "addColorAria": "Seleccionar y agregar un color al efecto Prisma",
      "addColorInputAria": "Color para agregar al efecto Prisma",
      "editColorAria": "Editar color",
      "editColorInputAria": "Editar valor del color",
      "editColorHexAria": "Valor hexadecimal del color",
      "removeColorAria": "Quitar color",
      "moveUpAria": "Mover color arriba",
      "moveDownAria": "Mover color abajo",
      "helpText": "Reordena la lista con las flechas. Cada color define la secuencia del efecto."
    },
    "custom": {
      "name": "Personalizado",
      "description": "Elige tu color base y ajusta su intensidad.",
      "baseColor": "Color base",
      "baseColorAria": "Color base personalizado",
      "hexAria": "Hex del color base personalizado"
    }
  },
  "managers": {
    "default": "Gestor 1"
  },
  "git": {
    "errorFallback": "Error"
  }
} as const;

export default settings;
