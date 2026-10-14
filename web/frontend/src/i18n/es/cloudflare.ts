const cloudflare = {
  "options": {
    "essentiallyOff": "Esencialmente desactivado",
    "low": "Bajo",
    "medium": "Medio",
    "high": "Alto"
  },
  "pageTitle": "Cloudflare",
  "header": {
    "heading": "Cloudflare",
    "subheading": "Gestiona DNS, caché, SSL/TLS y seguridad de tus zonas de Cloudflare para este servidor."
  },
  "config": {
    "title": "Conexión con Cloudflare",
    "tokenLabel": "Token de API",
    "tokenPlaceholder": "Token de API de Cloudflare",
    "tokenHint": "Crea un token en dash.cloudflare.com → My Profile → API Tokens con permisos de zona: DNS, Cache Purge, Zone Settings y Firewall Services.",
    "save": "Guardar",
    "test": "Probar conexión",
    "clear": "Quitar token",
    "tokenSet": "Token configurado",
    "tokenMissing": "Configura un token de API para empezar",
    "saved": "Token guardado",
    "cleared": "Token eliminado",
    "confirmClear": "¿Quitar el token de Cloudflare?",
    "confirmClearBtn": "Quitar"
  },
  "zones": {
    "title": "Zona",
    "select": "Selecciona una zona",
    "empty": "No hay zonas visibles con este token.",
    "status": "Estado",
    "plan": "Plan",
    "nameServers": "Servidores de nombres",
    "domainNotFound": "El dominio {domain} no pertenece a ninguna zona del token"
  },
  "runtime": {
    "active": "Activa",
    "pending": "Pendiente",
    "initializing": "Inicializando",
    "moved": "Trasladada",
    "paused": "pausada",
    "pausedHint": "Zona pausada: revisa la configuración antes de cambiar DNS.",
    "inactiveHint": "Zona {status}: comprueba los servidores de nombres en el registrador.",
    "activeHint": "Zona activa · {count} servidores de nombres configurados."
  },
  "tabs": {
    "dns": "DNS",
    "cache": "Caché",
    "security": "SSL / Seguridad",
    "access": "Reglas de acceso",
    "config": "Configuración"
  },
  "dns": {
    "title": "Registros DNS",
    "add": "Añadir registro",
    "type": "Tipo",
    "name": "Nombre",
    "content": "Contenido",
    "ttl": "TTL",
    "proxied": "Proxy",
    "pointsToServer": "Apunta a este servidor",
    "edit": "Editar",
    "delete": "Eliminar",
    "confirmDelete": "¿Eliminar el registro {name}?",
    "saved": "Registro guardado",
    "deleted": "Registro eliminado",
    "useServerIp": "Usar IP del servidor",
    "priority": "Prioridad",
    "confirmDeleteTitle": "Eliminar registro",
    "typeA": "A",
    "typeAAAA": "AAAA",
    "typeCNAME": "CNAME",
    "typeTXT": "TXT",
    "typeMX": "MX",
    "typeNS": "NS",
    "ttlAuto": "Auto",
    "ttl60": "60",
    "ttl300": "300",
    "ttl1800": "1800",
    "ttl3600": "3600",
    "ttl86400": "86400"
  },
  "cache": {
    "title": "Caché",
    "purgeAll": "Purgar todo",
    "purgeAllHint": "Elimina todo el contenido cacheado de la zona en Cloudflare.",
    "confirmPurgeAll": "¿Purgar TODA la caché de la zona?",
    "purgeUrls": "Purgar URLs",
    "purgeUrlsPlaceholder": "https://ejemplo.com/estilos.css (una URL por línea)",
    "purged": "Caché purgada",
    "devMode": "Modo desarrollo",
    "devModeHint": "Desactiva temporalmente la caché de Cloudflare (se apaga solo a las 3 horas).",
    "confirmPurgeTitle": "Purgar caché",
    "confirmPurgeBtn": "Purgar"
  },
  "security": {
    "title": "SSL / Seguridad",
    "sslMode": "Modo SSL/TLS",
    "alwaysHttps": "Siempre HTTPS",
    "securityLevel": "Nivel de seguridad",
    "underAttack": "Modo bajo ataque",
    "updated": "Ajuste actualizado",
    "sslOff": "Desactivado",
    "sslFlexible": "Flexible",
    "sslFull": "Completo",
    "sslFullStrict": "Completo (estricto)"
  },
  "access": {
    "title": "Reglas de acceso IP",
    "add": "Añadir regla",
    "mode": "Acción",
    "block": "Bloquear",
    "allow": "Permitir",
    "challenge": "Desafío",
    "ip": "IP / rango",
    "notes": "Notas",
    "empty": "Sin reglas de acceso en esta zona.",
    "confirmDelete": "¿Eliminar la regla para {ip}?",
    "created": "Regla creada",
    "deleted": "Regla eliminada",
    "ipHeader": "IP",
    "confirmDeleteTitle": "Eliminar regla"
  },
  "common": {
    "loading": "Cargando...",
    "error": "Error",
    "save": "Guardar",
    "cancel": "Cancelar",
    "delete": "Eliminar",
    "refresh": "Actualizar",
    "serverIp": "IP del servidor",
    "noToken": "Configura el token de API de Cloudflare en la pestaña Configuración."
  },
  "settingsUi": {
    "title": "Configuración de Cloudflare",
    "description": "Preferencias de las tablas del módulo Cloudflare.",
    "access": "Acceso",
    "credentialsConnections": "Credenciales y conexiones",
    "cloudflareToken": "Token de Cloudflare",
    "serverFirewall": "Firewall del servidor",
    "dnsWebhooks": "Eventos DNS en Webhooks"
  }
} as const;

export default cloudflare;
