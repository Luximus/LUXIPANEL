import { nativeText } from '../../../i18n/native-text';
import { type Group, read, search, post, settings, text, number, flag, lines, code, secret, choice, idField, byId, pick, compact } from "./operations";
const providerFields = [text("name", "Nombre", true), text("targetId", "Servidor destino", true), text("panelUrl", "URL pública del panel", true), text("upstreamUrl", "URL del servidor", true), text("templateId", "Identificador del plan"), lines("allowedModules", "Módulos permitidos, uno por línea"), choice("plan", "Plan", ["basic", "pro", "business", "custom"]), number("diskQuotaMb", "Disco (MB)", 256), number("bandwidthQuotaMb", "Transferencia (MB)", 1024), number("maxDomains", "Dominios", 1), number("maxEmailAccounts", "Buzones", 0), number("maxDatabases", "Bases de datos", 0), number("maxSubUsers", "Subusuarios", 0), flag("jailEnabled", "Aislar cuentas"), lines("operations", "Operaciones permitidas, una por línea"), flag("enabled", "Activado")];
const serverFields = [text("name", "Nombre", true), text("host", "Host", true), number("port", "Puerto SSH", 1, 65535), text("username", "Usuario Linux", true), choice("authType", "Autenticación", ["key", "password"]), secret("secret", "Clave privada o contraseña"), secret("passphrase", "Frase de contraseña de la clave"), flag("enabled", "Activado"), lines("allowedUserIds", "Usuarios autorizados, uno por línea"), flag("hasLuxipanel", "Tiene LUXIPANEL"), text("luxipanelBaseUrl", "URL pública de LUXIPANEL")];
export const administrationExtras: Record<string, Group[]> = {
 settings: [{ title: "Integraciones y correo del sistema", operations: [
  read("Estado de conectores", "/api/settings/connector-status"),
  settings("ElevenLabs", "/api/ai/integrations/elevenlabs", [secret("apiKey", "API key (vacía conserva la actual)"), text("defaultVoiceId", "Voz predeterminada")], "PUT", {}, values => pick(values, ["apiKey", "defaultVoiceId"])),
  post("Probar ElevenLabs", "/api/ai/integrations/elevenlabs/test"),
  { title: "Eliminar acceso ElevenLabs", path: "/api/ai/integrations/elevenlabs", method: "DELETE", get confirmation() { return nativeText("Eliminar la credencial ElevenLabs."); } },
  settings("Tolqia", "/api/chat/tolqia/config", [secret("token", "Token Tolqia")], "PUT", {}, values => pick(values, ["token"])),
  post("Probar Tolqia", "/api/chat/tolqia/test"),
  { title: "Eliminar acceso Tolqia", path: "/api/chat/tolqia/config", method: "DELETE", get confirmation() { return nativeText("Eliminar la credencial Tolqia."); } },
  post("Restablecer valores de IA", "/api/settings/reset", [], {}, "Restablecer los valores predeterminados del asistente de IA."),
 ]}, { title: "Servidor y caché de módulos", operations: [
  settings("Zona horaria del servidor", "/api/admin/system/timezone", [text("timezone", "Zona IANA", true)], "PUT", {}, values => pick(values, ["timezone"])),
  read("Colecciones y frecuencia de actualización", "/api/admin/cache-modules"), read("Estado de caché", "/api/admin/cache-modules/health"),
  { title: "Cambiar frecuencia de actualización", path: values => `/api/admin/cache-modules/${encodeURIComponent(String(values.module))}/${encodeURIComponent(String(values.collection))}`, fields: [text("module", "Módulo", true), text("collection", "Colección", true), number("intervalSeconds", "Intervalo (segundos)", 30, 86400)], method: "PUT", initial: { intervalSeconds: 60 }, toBody: values => pick(values, ["intervalSeconds"]) },
 ]}, { title: "Servidores conectados al panel", operations: [
  read("Servidores registrados", "/api/servers"),
  post("Registrar servidor", "/api/servers", serverFields, { port: 22, authType: "key", enabled: true, hasLuxipanel: false, allowedUserIds: [] }),
  { title: "Editar servidor", path: byId("/api/servers"), method: "PUT", fields: [idField, ...serverFields], toBody: values => pick(values, serverFields.map(field => field.key)) },
  post("Probar conexión de servidor", byId("/api/servers", "/test"), [idField], {}, undefined),
  post("Aprobar huella SSH", byId("/api/servers", "/fingerprint/approve"), [idField], {}, "Aprobar la huella pendiente del servidor indicado después de verificarla en los detalles de conexión."),
  { title: "Eliminar servidor registrado", path: byId("/api/servers"), method: "DELETE", fields: [idField], get confirmation() { return nativeText("Eliminar el servidor del registro del panel."); } },
 ]}, { title: "Seguridad de mi cuenta", operations: [
  { title: "Reactivar el segundo factor", path: "/api/auth/totp/activate", method: "PATCH", get actionLabel() { return nativeText("Activar"); }, toBody: () => ({}) },
  { title: "Eliminar secreto del segundo factor", path: "/api/auth/totp/delete", method: "DELETE", get actionLabel() { return nativeText("Eliminar"); }, get confirmation() { return nativeText("Eliminar el secreto TOTP guardado de tu cuenta."); } },
 ]}],
 hosting: [{ title: "Proveedores de hosting", operations: [
  read("Proveedores registrados", "/api/hosting/providers"), read("Catálogo de permisos para proveedores", "/api/hosting/providers/permission-catalog"), read("Servidores disponibles", "/api/servers"),
  search("Planes del servidor destino", "/api/hosting/providers/templates", [text("targetId", "Servidor destino", true)]),
  post("Crear proveedor", "/api/hosting/providers", providerFields, { plan: "basic", enabled: true, allowedModules: ["files", "mail", "dns", "backups", "cron"] }),
  { title: "Editar proveedor", path: byId("/api/hosting/providers"), method: "PATCH", fields: [idField, ...providerFields.filter(field => field.key !== "targetId").map(field => ({ ...field, required: false }))], toBody: values => pick(values, providerFields.filter(field => field.key !== "targetId").map(field => field.key)) },
  post("Rotar clave de proveedor", byId("/api/hosting/providers", "/rotate"), [idField], {}, "Rotar la clave API del proveedor. La clave anterior dejará de funcionar."),
  { title: "Asignar plan a cuenta", path: byId("/api/hosting/accounts"), method: "PUT", fields:[idField,text("templateId","Identificador del plan reutilizable",true)],toBody:values=>pick(values,["templateId"]), get confirmation() { return nativeText("Aplicar el plan seleccionado a esta cuenta."); } },
 ]}, { title: "Aislamiento de cuentas", operations: [
  post("Provisionar aislamiento de cuenta", byId("/api/hosting/accounts", "/jail"), [idField], {}, "Provisionar o reparar el aislamiento de la cuenta indicada."),
  { title: "Desmontar aislamiento de cuenta", path: byId("/api/hosting/accounts", "/jail"), method: "DELETE", fields: [idField], get confirmation() { return nativeText("Desmontar el aislamiento de la cuenta indicada."); } },
 ]}],
 users: [{ title: "Planes de permisos", operations: [read("Capacidades disponibles para planes", "/api/roles/templates/capabilities")] }],
 "module-dev": [{ title: "Detalles y reparación de incidencias", operations: [
  { ...search("Detalles de incidencia", "/api/module-dev/logs/incidents", [idField]), path: byId("/api/module-dev/logs/incidents") },
  post("Crear reparación", "/api/module-dev/logs/repairs", [text("incidentId", "Identificador de incidencia", true)], {}, "Iniciar la reparación de la incidencia con el agente configurado."),
  { ...search("Detalle de reparación", "/api/module-dev/logs/repairs", [idField]), path: byId("/api/module-dev/logs/repairs") },
  post("Cancelar reparación", byId("/api/module-dev/logs/repairs", "/cancel"), [idField], {}, "Cancelar la reparación indicada."),
  post("Reintentar reparación", byId("/api/module-dev/logs/repairs", "/retry"), [idField], {}, "Reintentar la reparación indicada."),
  { ...post("Responder aprobación de reparación", byId("/api/module-dev/logs/repairs", "/approval"), [idField, text("permissionId", "Identificador del permiso", true), flag("allow", "Autorizar acción")], { allow: false }), toBody: values => pick(values, ["permissionId", "allow"]) },
 ]}, { title: "Herramientas de módulos en vista previa", operations: [
  { title: "Ejecutar herramienta de prueba", path: values => `/api/module-dev/preview/${encodeURIComponent(String(values.moduleId))}/tool/${encodeURIComponent(String(values.name))}`, method: "POST", fields: [text("moduleId", "Módulo en vista previa", true), text("name", "Nombre de herramienta", true), {key:"input",get label() { return nativeText("Parámetros de la herramienta (JSON)"); },type:"json"}], initial:{input:{}}, toBody: values => pick(values,["input"]), get actionLabel() { return nativeText("Probar herramienta"); }, get confirmation() { return nativeText("Ejecutar la herramienta del módulo en vista previa con los parámetros indicados."); } },
 ]}],
};
