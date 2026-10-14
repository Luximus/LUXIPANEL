const firewall = {
  "pageTitle": "Firewall",
  "installWarning": {
    "title": "Componentes del firewall no detectados",
    "description": "Se ejecutará el gestor de paquetes (apt/dnf/apk/...) con configuración por defecto y se habilitarán los servicios al terminar.",
    "btnInstall": "Instalar ahora"
  },
  "statusCard": {
    "label": "Estado del Firewall (UFW)",
    "verifying": "Verificando...",
    "btnDisable": "Desactivar",
    "btnEnable": "Activar"
  },
  "securityAudit": {
    "title": "Auditoría de Seguridad (Premium)",
    "btnStartAudit": "Iniciar análisis",
    "scannerChecking": "comprobando…",
    "btnInstallScanner": "Instalar",
    "scanProgress": "Progreso de escaneo",
    "scanAi": "Análisis IA: 0%",
    "noReports": "No hay auditorías completadas. Inicia una nueva para comenzar."
  },
  "ufwRules": {
    "title": "Reglas UFW",
    "btnNewRule": "Nueva regla",
    "loading": "Cargando reglas...",
    "btnAllowCloudflare": "Permitir Cloudflare",
    "searchLabel": "Buscar regla",
    "searchPlaceholder": "Buscar puerto, IP o comentario…"
  },
  "fail2ban": {
    "btnBanIp": "Banear IP",
    "loading": "Cargando jails..."
  },
  "ruleDialog": {
    "title": "Nueva regla UFW",
    "labelAction": "Acción",
    "optionAllow": "Permitir",
    "optionDeny": "Denegar",
    "optionReject": "Rechazar",
    "labelProtocol": "Protocolo",
    "optionAny": "Cualquiera",
    "labelPort": "Puerto",
    "placeholderPort": "25 o 8080:8090",
    "labelFromIp": "Desde IP",
    "placeholderFromIp": "any o 192.168.0.0/24",
    "labelComment": "Comentario (opcional)",
    "placeholderComment": "SMTP entrante",
    "btnCancel": "Cancelar",
    "btnAdd": "Agregar regla"
  },
  "banDialog": {
    "title": "Banear IP manualmente",
    "labelIp": "Dirección IP",
    "placeholderIp": "192.168.1.100",
    "labelJail": "Jaula de Fail2ban",
    "btnCancel": "Cancelar",
    "btnBan": "Banear"
  },
  "auditReportDialog": {
    "title": "Reporte de auditoría de seguridad",
    "btnClose": "Cerrar"
  },
  "aiAssistant": {
    "btnSuggestRules": "Sugerir reglas (IA)",
    "btnSuggestBans": "Sugerir bloqueos (IA)",
    "btnAnalyze": "Análisis IA",
    "promptUfw": "Analiza el firewall UFW del servidor conectado: revisa su estado y las reglas actuales (usa la herramienta firewall.ufw_status) y sugiéreme reglas UFW inteligentes para mejorar la seguridad sin romper los servicios en uso. Para cada regla propuesta explica el porqué e incluye el comando `ufw` exacto para aplicarla.",
    "promptFail2ban": "Analiza Fail2ban en el servidor conectado: revisa las jails configuradas y las IPs baneadas (usa la herramienta firewall.fail2ban_status) y sugiéreme baneos y mejoras de configuración para protegerlo de ataques de fuerza bruta. Indica jail, IP/rango y motivo, y los comandos para aplicarlo.",
    "promptAnalyze": "Realiza un análisis general de seguridad del firewall del servidor conectado. Revisa el estado de UFW y de Fail2ban (usa las herramientas firewall.ufw_status y firewall.fail2ban_status), identifica riesgos, puertos expuestos y configuraciones débiles, y entrégame recomendaciones priorizadas con los comandos para aplicarlas.",
    "analyzeRule": "Analizar con IA",
    "promptRule": "Analiza esta regla UFW existente del servidor conectado. Explica qué tráfico permite o bloquea, evalúa sus riesgos y sugiere si debe mantenerse, ajustarse o reemplazarse. Si propones cambios, incluye los comandos exactos.\n\nRegla #{number}\nAcción: {action}\nDestino/puerto: {to}\nOrigen: {from}\nProtocolo: {proto}\nComentario: {comment}"
  },
  "labels": {
    "active": "Activo",
    "inactive": "Inactivo",
    "bannedCount": "{count} baneadas",
    "moreIps": "+{n} más",
    "installingText": "Instalando UFW y Fail2ban… puede tardar unos minutos.",
    "installSuccessText": "Firewall instalado correctamente.",
    "cfEdgeBlockQuestion": "¿Bloquear {ip} también en el borde de Cloudflare?",
    "findingsCount": "{n} hallazgos encontrados",
    "completedAt": "Completado en {time}",
    "scanAiProgress": "Análisis IA: {pct}%",
    "scanBitNinjaProgress": "BitNinja: {pct}%",
    "scanLynisProgress": "Lynis: {pct}%",
    "scanRkhunterProgress": "Rkhunter: {pct}%",
    "scanChkrootkitProgress": "Chkrootkit: {pct}%",
    "any": "any",
    "overallRisk": "Riesgo General",
    "unknown": "DESCONOCIDO",
    "keyThreats": "Amenazas clave",
    "recommendations": "Recomendaciones",
    "findingsTitle": "Hallazgos ({n})",
    "moreFindingsCount": "+{n} hallazgos más",
    "from": "desde"
  },
  "empty": {
    "noRules": "Sin reglas",
    "noJails": "Sin jails activos"
  },
  "actions": {
    "unban": "desbanear",
    "blockInCloudflare": "Bloquear en Cloudflare",
    "dismiss": "Descartar"
  },
  "confirm": {
    "deleteRuleMsg": "¿Eliminar la regla #{number}?",
    "deleteRuleTitle": "Eliminar regla",
    "disableFwMsg": "¿Desactivar el firewall? El servidor quedará sin protección de red.",
    "disableFwTitle": "Desactivar firewall",
    "disableFwBtn": "Sí, desactivar",
    "cfAllowMsg": "Se añadirán reglas UFW para permitir 80/443 desde los rangos oficiales de Cloudflare. ¿Continuar?",
    "cfAllowTitle": "Permitir IPs de Cloudflare",
    "cfAllowBtn": "Continuar"
  },
  "toasts": {
    "ruleDeleted": "Regla eliminada",
    "errorDelete": "Error al eliminar",
    "ipUnbanned": "{ip} desbaneada",
    "errorUnban": "Error al desbanear",
    "fwEnabled": "Firewall activado",
    "errorEnable": "Error al activar",
    "fwDisabled": "Firewall desactivado",
    "errorDisable": "Error al desactivar",
    "fwInstalled": "Firewall instalado",
    "ruleAdded": "Regla agregada",
    "ipBanned": "{ip} baneada en {jail}",
    "errorBan": "Error al banear",
    "cfRulesApplied": "Reglas de Cloudflare aplicadas ({applied})",
    "errorCfRules": "Error al aplicar reglas de Cloudflare",
    "errorStartAudit": "Error al iniciar auditoría",
    "auditCompleted": "Auditoría completada",
    "auditFailed": "Auditoría falló",
    "errorLoadReport": "Error al cargar reporte",
    "reportOf": "Reporte de {date}"
  },
  "errors": {
    "addRule": "Error al agregar regla"
  },
  "runtime": {
    "statusError": "No se pudo consultar el estado",
    "rulesLoadError": "No se pudieron cargar las reglas.",
    "noMatchingRules": "Ninguna regla coincide con el filtro.",
    "loggingSaved": "Nivel de registro guardado.",
    "loggingSaveError": "No se pudo guardar el nivel de registro."
  },
  "settingsUi": {
    "rulesView": "Vista de reglas",
    "ufwLog": "Registro UFW",
    "related": "Relacionados",
    "title": "Configuración de Firewall",
    "description": "Filtros personales y registro UFW del servidor activo.",
    "sectionsLabel": "Secciones de configuración de Firewall",
    "showActions": "Mostrar acciones",
    "all": "Todas",
    "limit": "Limitar",
    "serverSettingHint": "Este ajuste cambia la configuración del servidor activo.",
    "logLevel": "Nivel de registro",
    "off": "Desactivado",
    "low": "Bajo",
    "medium": "Medio",
    "high": "Alto",
    "full": "Completo",
    "saveLevel": "Guardar nivel",
    "relatedModules": "Módulos relacionados"
  }
} as const;

export default firewall;
