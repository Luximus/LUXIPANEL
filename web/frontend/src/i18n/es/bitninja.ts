const bitninja = {
  "header": {
    "description": "Agente de seguridad integral (WAF, anti-DoS, detección de malware y reputación de IP) en el servidor conectado.",
    "statusChecking": "comprobando…"
  },
  "sudo": {
    "label": "Contraseña sudo (passphrase de tu sesión)",
    "placeholder": "Solo si el servidor la pide para sudo",
    "hint": "Se usa solo para esta acción y nunca se guarda en el navegador."
  },
  "installCard": {
    "title": "BitNinja no está instalado",
    "description": "Introduce la license key de tu cuenta de BitNinja para instalar el agente en este servidor. Se descarga el instalador oficial (get.bitninja.io) y se ejecuta con sudo.",
    "licensePlaceholder": "License key (ej: ab12cd34-…)",
    "installButton": "Instalar BitNinja"
  },
  "stats": {
    "service": "Servicio",
    "license": "Licencia",
    "version": "Versión"
  },
  "serviceControl": {
    "title": "Control del servicio",
    "start": "Iniciar",
    "restart": "Reiniciar",
    "stop": "Detener"
  },
  "components": {
    "title": "Componentes de protección",
    "checking": "comprobando…",
    "noReported": "El agente no reportó componentes.",
    "active": "Activo",
    "inactive": "Inactivo"
  },
  "updateLicense": {
    "title": "Actualizar license key",
    "placeholder": "Nueva license key",
    "applyButton": "Aplicar"
  },
  "toasts": {
    "sudoRequired": "Introduce tu contraseña sudo y reintenta.",
    "sudoInvalid": "Contraseña sudo inválida.",
    "actionFailed": "La acción falló. Revisa la salida.",
    "installing": "Instalando BitNinja… puede tardar unos minutos.",
    "installed": "BitNinja instalado.",
    "serviceAction": "Servicio: {action} OK.",
    "componentToggleEnabled": "{component}: activado.",
    "componentToggleDisabled": "{component}: desactivado.",
    "licenseApplied": "License key aplicada."
  },
  "errors": {
    "unknown": "Error desconocido"
  },
  "status": {
    "notInstalled": "No instalado",
    "running": "Activo",
    "installedStopped": "Instalado (detenido)",
    "serviceRunning": "Corriendo",
    "serviceStopped": "Detenido",
    "licenseValid": "Válida",
    "licenseReview": "Revisar"
  },
  "validation": {
    "licenseKeyRequired": "Introduce la license key.",
    "newLicenseKeyRequired": "Introduce la nueva license key."
  },
  "settingsUi": {
    "settingsTitle": "Configuración de BitNinja",
    "settingsButton": "Configuración",
    "settingsDescription": "Preferencias de diagnóstico para el servidor activo.",
    "settingsSections": "Secciones de configuración de BitNinja",
    "diagnostics": "Diagnóstico",
    "related": "Relacionados",
    "logSource": "El registro se lee del servicio BitNinja del servidor seleccionado.",
    "autoRefresh": "Actualizar estado cada 30 segundos",
    "logLines": "Líneas del registro",
    "relatedModules": "Módulos relacionados",
    "firewallAudit": "Firewall y auditoría",
    "credentials": "Credenciales de BitNinja"
  },
  "logsUi": {
    "loading": "Cargando registro…",
    "empty": "No hay eventos recientes.",
    "loadError": "No se pudo cargar el registro.",
    "logsTitle": "Registro reciente",
    "logsDescription": "Eventos del servicio en el servidor activo.",
    "refreshLogs": "Actualizar registro",
    "logsHint": "Pulsa «Actualizar registro» para cargar los eventos."
  }
} as const;

export default bitninja;
