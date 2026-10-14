const moduleCatalog = {
  "users": {
    "name": "Usuarios",
    "description": "Gestión de usuarios del panel, roles y permisos."
  },
  "mail": {
    "name": "Correo",
    "description": "SMTP / IMAP, dominios y buzones de usuario."
  },
  "monitor": {
    "name": "Monitor",
    "description": "Métricas en vivo de CPU, RAM, disco y procesos."
  },
  "files": {
    "name": "Archivos",
    "description": "Explorador de archivos remoto con editor integrado."
  },
  "firewall": {
    "name": "Firewall",
    "description": "Gestión de reglas UFW y bloqueo de IPs."
  },
  "bitninja": {
    "name": "BitNinja",
    "description": "Agente de seguridad integral: WAF, anti-DoS, detección de malware y reputación de IP."
  },
  "assistant": {
    "name": "Agentes IA",
    "description": "Asistente con IA para diagnóstico y automatización."
  },
  "repository-store": {
    "name": "GitHub",
    "description": "Catálogo de repositorios e instalación guiada."
  },
  "dns": {
    "name": "Nginx",
    "description": "Gestión de Nginx: sitios, reverse proxy, SSL, logs y estado."
  },
  "backups": {
    "name": "Copias de seguridad",
    "description": "Backups programados con cifrado y múltiples destinos."
  },
  "cron": {
    "name": "Cron",
    "description": "Tareas programadas con editor visual."
  },
  "databases": {
    "name": "Bases de datos",
    "description": "Gestor de bases de datos (MySQL/MariaDB y PostgreSQL): explorar esquemas y consola SQL."
  },
  "obsidian": {
    "name": "Obsidian",
    "description": "Vaults de notas Obsidian en tu servidor: editor markdown, wikilinks y notas operadas por los agentes IA del asistente."
  },
  "cloudflare": {
    "name": "Cloudflare",
    "description": "Gestión de Cloudflare para el servidor: DNS, caché, SSL/TLS, modo desarrollo y reglas de acceso IP."
  },
  "server-alerts": {
    "name": "Notificaciones",
    "description": "Notificaciones del servidor para el dueño del panel: preferencias de alertas, avisos inmediatos, programados/recurrentes y reglas por métricas (CPU/RAM/disco/carga/servicio caído), entregados a sus dispositivos vía LP."
  },
  "expo": {
    "name": "Expo",
    "description": "Gestiona apps Expo/React Native: builds EAS, envíos a tiendas, OTA updates, QR de dev-client y cuotas, con un access token del cliente."
  },
  "webhooks": {
    "name": "Webhooks",
    "description": "Notificaciones HTTP de eventos del panel."
  },
  "openclaw": {
    "name": "OpenClaw",
    "description": "Conexión a OpenClaw AI con selector de modelo."
  },
  "hosting": {
    "name": "Hosting",
    "description": "Sitios, vhosts y despliegues asistidos."
  },
  "terminal": {
    "name": "Terminal",
    "description": "Terminal flotante accesible desde cualquier vista del panel. Activa o desactiva el botón flotante."
  },
  "module-dev": {
    "name": "Mis módulos",
    "description": "Ciclo de vida de tus módulos del marketplace: estado de revisión, envíos, tests y preview privada."
  },
  "filesystem-mcp": {
    "name": "Filesystem MCP",
    "description": "MCP para operaciones de filesystem."
  },
  "github-mcp": {
    "name": "GitHub MCP",
    "description": "MCP para operaciones contra la API de GitHub."
  },
  "google-drive": {
    "name": "Google Drive",
    "description": "Busca y adjunta documentos de tu Google Drive desde el chat del asistente."
  },
  "onedrive": {
    "name": "OneDrive",
    "description": "Accede a archivos de Microsoft OneDrive / SharePoint desde el chat."
  },
  "dropbox": {
    "name": "Dropbox",
    "description": "Busca y adjunta archivos de Dropbox desde el chat."
  },
  "notion": {
    "name": "Notion",
    "description": "Consulta páginas y bases de datos de Notion desde el chat."
  }
} as const;

export default moduleCatalog;
