import { nativeText } from '../../../i18n/native-text';
import { type Group, read, search, post, settings, text, number, flag, lines, code, secret, choice, filePath, idField, byId, pick, compact, records } from "./operations";
export const serviceExtras: Record<string, Group[]> = {
 mail: [{ title: "Entrega y reenvíos de dominios", operations: [
  search("Rastrear entrega", "/api/mail/track-delivery", [text("recipient", "Destinatario"), choice("mode", "Eventos", ["all", "blocked_failed"]), number("max", "Máximo", 25, 500)], { mode: "all", max: 100 }),
  read("Dominios disponibles", "/api/nginx/domains"), read("Reenvíos de dominios", "/api/mail/domain-forwards"),
  { title: "Guardar reenvío de dominio", path: values => `/api/mail/domain-forwards/${encodeURIComponent(String(values.domain))}`, method: "PUT", fields: [text("domain", "Dominio", true), lines("destinations", "Correos de destino, uno por línea")], toBody: values => pick(values, ["destinations"]) },
  { title: "Eliminar reenvío de dominio", path: values => `/api/mail/domain-forwards/${encodeURIComponent(String(values.domain))}`, method: "DELETE", fields: [text("domain", "Dominio", true)], get confirmation() { return nativeText("Eliminar el reenvío del dominio seleccionado."); } },
  read("Tipos de puntuación de spam", "/api/mail/spam-filters/score-types"), read("Codificaciones de respuestas automáticas", "/api/accounts/autoresponder/charsets"),
  post("Probar filtros globales", "/api/mail/global-filters/test", [code("message", "Mensaje completo, incluidos sus encabezados")]),
  post("Importar clave privada de correo", "/api/mail/encryption/import-private", [code("armoredPrivateKey", "Clave privada PGP"), secret("passphrase", "Frase de contraseña")]),
 ]}, { title: "Correo saliente del panel", operations: [
  settings("Identidad de correo saliente", "/api/mail/outbound", [choice("mode", "Modo", ["disabled", "account", "external"]), text("accountAddress", "Buzón del panel"), text("external.host", "Servidor SMTP"), number("external.port", "Puerto", 1, 65535), text("external.user", "Usuario SMTP"), secret("external.password", "Contraseña SMTP (vacía conserva la actual)"), text("external.fromAddress", "Correo remitente"), text("external.fromName", "Nombre remitente"), flag("external.secure", "TLS desde el inicio")], "PUT", {}, values => values.mode === "external" ? { mode: values.mode, external: compact(values.external as Record<string, unknown>) } : pick(values, ["mode", "accountAddress"])),
  post("Enviar correo de prueba", "/api/mail/outbound/test", [text("to", "Destinatario", true)]),
 ]}],
 expo: [{ title: "Cuenta y herramientas Expo", operations: [
  read("Cuenta Expo y organizaciones", "/api/expo/account"), post("Cuota de compilación", "/api/expo/quota", [text("path", "Ruta del proyecto opcional")]),
  post("Vincular proyecto a EAS", "/api/expo/link", [filePath, text("projectId", "Identificador de proyecto EAS (opcional)")]),
  post("Instalar dependencias", "/api/expo/dependencies/install", [filePath], {}, "Instalar las dependencias del proyecto indicado."),
  post("Estado de instalación", "/api/expo/dependencies/status", [filePath]),
  post("Registros de compilación", "/api/expo/build-logs", [text("buildId", "Identificador de compilación", true)]),
 ]}],
 cron: [{ title: "Validación y cambios en varias tareas", operations: [
  read("Usuarios que pueden ejecutar tareas", "/api/cron/users"), read("Proyectos disponibles", "/api/files/projects"), read("Dependencias de Cron", "/api/system-deps/cron"),
  post("Validar expresión Cron", "/api/cron/validate", [text("expression", "Expresión", true)], { expression: "0 9 * * *" }),
  post("Cambiar varias tareas de IA", "/api/cron/ai-jobs/bulk", [lines("ids", "Identificadores, uno por línea"), text("patch.category", "Categoría"), choice("patch.agentMode", "Modo", ["single", "multi"]), lines("patch.tags", "Etiquetas"), lines("patch.projectPaths", "Carpetas de proyectos"), flag("patch.enabled", "Activadas"), text("patch.providerId", "Proveedor de IA"), text("patch.model", "Modelo")], { patch: { enabled: true, agentMode: "single" } }, "Aplicar los campos indicados a las tareas seleccionadas."),
 ]}],
 firewall: [{ title: "Reglas y auditoría de seguridad", operations: [
  read("Jails de Fail2Ban", "/api/firewall/fail2ban/jails"),
  { title: "Nivel de registro del firewall", path: "/api/firewall/logging", method: "PUT", fields: [choice("level", "Nivel", ["off", "low", "medium", "high", "full"])], initial: { level: "low" } },
  post("Permitir rangos de Cloudflare", "/api/firewall/cloudflare-allow", [], {}, "Añadir los rangos de Cloudflare a las reglas del firewall."),
  read("Escáneres de seguridad", "/api/security-audit/scanners"), read("Informes de seguridad", "/api/security-audit/reports"),
  post("Iniciar auditoría de seguridad", "/api/security-audit/start", [], {}, "Ejecutar los escáneres de seguridad del servidor."),
  { ...search("Consultar informe de seguridad", "/api/security-audit/report", [idField]), path: byId("/api/security-audit/report") },
 ]}],
 databases: [{ title: "Herramientas de bases de datos", operations: [read("Dependencias disponibles", "/api/system-deps/databases")] }],
 obsidian: [{ title: "Preferencias del editor", operations: [settings("Editor Obsidian", "/api/obsidian/preferences", [choice("editorMode", "Modo", ["edit", "preview", "split"]), number("fontSize", "Tamaño del texto", 12, 20)], "PATCH", {}, values => pick(values, ["editorMode", "fontSize"]))] }],
 "repository-store": [{ title: "Catálogo y repositorios existentes", operations: [
  read("Configuración de GitHub", "/api/repository-store/config"), read("Autenticación Git detectada", "/api/files/git/detect"),
  { title: "Configurar token GitHub", path: "/api/admin/repository-store/config", fields: [secret("token", "Token GitHub")], method: "PUT" },
  { title: "Eliminar token GitHub", path: "/api/admin/repository-store/config", method: "DELETE", get confirmation() { return nativeText("Eliminar el token GitHub del catálogo."); } },
  search("README de repositorio", "/api/repository-store/readme", [text("owner", "Propietario", true), text("name", "Repositorio", true)]),
  { ...search("Detalles de repositorio", "/api/repository-store/repos", [text("owner", "Propietario", true), text("name", "Repositorio", true)]), path: values => `/api/repository-store/repos/${encodeURIComponent(String(values.owner))}/${encodeURIComponent(String(values.name))}` },
  post("Vincular repositorio ya clonado", "/api/repository-store/clones/link", [text("fullName", "Propietario/repositorio", true), filePath]),
  { title: "Preferencias del catálogo", readPath: "/api/repository-store/state", selectData: data => (data as {preferences?: Record<string, unknown>} | null)?.preferences ?? {}, path: "/api/repository-store/preferences", method: "PATCH", fields: [choice("defaultTab", "Pestaña inicial", ["all", "saved", "cloned", "update"]), choice("sort", "Orden", ["relevance", "stars_desc", "stars_asc", "updated_desc", "name_asc"]), choice("pageSize", "Resultados por página", ["24", "36", "60"]), flag("showArchived", "Mostrar archivados"), text("cloneParent", "Carpeta para clones"), choice("transport", "Transporte", ["https", "ssh"])], initial: { defaultTab: "all", sort: "relevance", pageSize: "36", transport: "https", showArchived: false }, toBody: values => ({ ...compact(values), pageSize: Number(values.pageSize) }) },
 ]}],
 webhooks: [{ title: "Webhooks detectados", operations: [
  read("Webhooks detectados", "/api/webhooks/discovered"), post("Volver a explorar webhooks", "/api/webhooks/discovered/scan"),
  post("Gestionar webhook detectado", "/api/webhooks/discovered/action", [idField, choice("op", "Acción", ["enable", "disable", "delete"])], { op: "enable" }, "Aplicar la acción al webhook indicado."),
 ]}, { title: "Recepción de datos", operations: [
  read("Receptores de datos", "/api/webhooks/gateways"),
  { ...search("Detalles y mensajes recibidos", "/api/webhooks/gateways", [idField]), path: byId("/api/webhooks/gateways") },
  post("Crear receptor de datos", "/api/webhooks/gateways", [text("name", "Nombre", true), flag("enabled", "Activado"), text("ipRestrictions", "Restricciones IP"), flag("getRequestHeaders", "Guardar encabezados"), flag("getRequestHttpMethod", "Guardar método HTTP"), flag("jsonPassThrough", "Conservar JSON"), records("apiKeys", "Claves de acceso", [text("name", "Nombre", true), secret("value", "Clave")]), text("dataStructure.name", "Nombre de estructura"), flag("dataStructure.strict", "Estructura estricta"), records("dataStructure.fields", "Campos de datos", [text("name", "Nombre", true), text("description", "Descripción"), choice("type", "Tipo", ["text", "number", "boolean", "date", "array", "collection"]), text("defaultValue", "Valor predeterminado"), flag("required", "Obligatorio"), flag("multiline", "Varias líneas")])], { category: "receive-data", enabled: true, apiKeys: [], dataStructure: { fields: [] } }),
  { title: "Cambiar estado de receptor", path: byId("/api/webhooks/gateways"), method: "PUT", fields: [idField, flag("enabled", "Activado")], initial: { enabled: true }, toBody: values => pick(values, ["enabled"]) },
  { title: "Eliminar receptor", path: byId("/api/webhooks/gateways"), method: "DELETE", fields: [idField], get confirmation() { return nativeText("Eliminar el receptor de datos seleccionado."); } },
 ]}, { title: "Claves API", operations: [
  read("Claves API del panel", "/api/api-keys"), post("Crear clave API", "/api/api-keys", [text("name", "Nombre", true), lines("scopes", "Permisos, uno por línea"), text("expiresAt", "Caducidad ISO opcional")]),
  { title: "Revocar clave API", path: byId("/api/api-keys"), method: "DELETE", fields: [idField], get confirmation() { return nativeText("Revocar la clave API seleccionada."); } },
 ]}],
};
