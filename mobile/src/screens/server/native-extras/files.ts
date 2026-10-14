import { nativeText } from '../../../i18n/native-text';
import { type Group, text, number, flag, lines, code, secret, choice, filePath, idField, byId, pick, read, search, post, settings } from "./operations";
const git = "/api/files/git";
const credential = [text("label", "Nombre", true), choice("type", "Tipo", ["https", "ssh"]), text("host", "Host", true), text("username", "Usuario"), secret("secret", "Token o clave privada")];
export const filesExtras: Group[] = [
 { title: "Buscar y comparar", operations: [
  read("Carpetas permitidas", "/api/files/allowed-bases"),
  search("Buscar nombres en carpetas", "/api/files/search", [text("base", "Carpeta base", true), text("q", "Nombre a buscar", true), number("limit", "Máximo de resultados", 1, 5000)], { base: "/var/www", limit: 200 }),
  search("Buscar dentro de archivos", "/api/files/grep", [filePath, text("q", "Texto o expresión"), choice("mode", "Búsqueda", ["text", "regex", "email", "url", "apikey", "import", "function", "endpoint", "variable"]), flag("caseSensitive", "Distinguir mayúsculas"), number("maxResults", "Máximo", 1, 5000)], { path: "/var/www", mode: "text", maxResults: 200 }),
  search("Comparar carpetas", "/api/files/compare", [text("from", "Carpeta origen", true), text("to", "Carpeta destino", true)]),
  search("Información del archivo", "/api/files/stat", [filePath]),
  search("Tamaño de carpeta", "/api/files/dir-size", [filePath]),
  post("Tamaños de varias carpetas", "/api/files/dir-sizes", [lines("path", "Una ruta por línea")]),
  search("Sugerir rutas", "/api/files/path-suggest", [filePath]),
 ]},
 { title: "Historial y metadatos", operations: [
  search("Historial del archivo", "/api/files/history", [filePath]),
  search("Contenido de una revisión Git", "/api/files/history/git-show", [filePath, text("rev", "Revisión Git", true)]),
  search("Etiquetas y comentario", "/api/files/meta", [filePath]),
  { title: "Editar etiquetas y comentario", path: "/api/files/meta", method: "PUT", fields: [filePath, lines("tags", "Etiquetas, una por línea"), code("comment", "Comentario")], initial: { tags: [], comment: "" } },
  post("Validar contenido antes de guardar", "/api/files/validate", [filePath, code("content", "Contenido del archivo")]),
 ]},
 { title: "Proyectos", operations: [
  read("Proyectos detectados", "/api/files/projects"),
  post("Volver a explorar proyectos", "/api/files/scan-projects", [filePath], { path: "/var/www" }),
  post("Proponer agentes para esta carpeta", "/api/ai/agents/propose-from-folder", [filePath, number("count", "Agentes a proponer", 2, 6), choice("providerId", "Proveedor", ["claude", "codex", "gemini", "deepseek", "grok", "minimax"])], {count:3,providerId:"codex"}),
  search("Comandos sugeridos de proyecto", "/api/files/snippets/suggest", [filePath]),
  post("Crear aplicación Expo", "/api/expo/create-app", [text("root", "Carpeta padre", true), text("name", "Nombre", true), choice("template", "Plantilla", ["default", "blank", "blank-typescript", "tabs"])], { template: "default" }, "Crear una aplicación e instalar sus dependencias en la carpeta indicada."),
  post("Consultar creación de aplicación", "/api/expo/create-status", [filePath]),
 ]},
 { title: "Git: ramas y despliegue", operations: [
  post("Crear rama", `${git}/branch`, [filePath, text("branch", "Rama", true)]),
  post("Cambiar de rama", `${git}/checkout`, [filePath, text("branch", "Rama", true)], {}, "Cambiar la rama del repositorio indicado."),
  post("Clonar repositorio", `${git}/clone`, [text("url", "URL Git", true), text("dest", "Carpeta destino", true), text("branch", "Rama"), text("credentialId", "Credencial opcional")], {}, "Clonar en la carpeta indicada."),
  post("Desplegar rama", `${git}/deploy`, [filePath, text("branch", "Rama", true), text("credentialId", "Credencial opcional")], {}, "Actualizar el repositorio y desplegar la rama indicada."),
  post("Descartar cambios", `${git}/discard`, [filePath, lines("paths", "Archivos relativos, uno por línea"), flag("clean", "Eliminar también archivos sin seguimiento")], { clean: false }, "Descartar los cambios seleccionados. Esta acción no se puede deshacer."),
 ]},
 { title: "Credenciales Git", operations: [
  read("Credenciales guardadas", `${git}/credentials`), read("Credenciales detectadas", `${git}/detect`),
  post("Añadir credencial", `${git}/credentials`, credential, { type: "https" }),
  { title: "Actualizar credencial", path: byId(`${git}/credentials`), method: "PUT", fields: [idField, ...credential], toBody: values => pick(values, ["label", "type", "host", "username", "secret"]) },
  { title: "Eliminar credencial", path: byId(`${git}/credentials`), method: "DELETE", fields: [idField], get confirmation() { return nativeText("Eliminar la credencial seleccionada."); } },
  post("Configurar autor de Git", `${git}/server/config`, [text("userName", "Nombre del autor"), text("userEmail", "Correo del autor")]),
  post("Guardar acceso HTTPS del servidor", `${git}/server/https`, [text("host", "Host", true), text("username", "Usuario", true), secret("secret", "Token o contraseña"), text("matchHost", "Host anterior"), text("matchUser", "Usuario anterior")]),
  post("Eliminar acceso HTTPS", `${git}/server/https/delete`, [text("host", "Host", true), text("username", "Usuario")], {}, "Eliminar el acceso HTTPS seleccionado."),
  post("Cerrar sesión de GitHub CLI", `${git}/server/gh/logout`, [text("host", "Host", true)], { host: "github.com" }, "Cerrar la sesión de GitHub CLI en el servidor."),
 ]},
 { title: "Claves SSH para Git", operations: [
  search("Entorno SSH", `${git}/ssh/env`, [text("user", "Usuario Linux opcional")]), read("Usuarios SSH", `${git}/ssh/users`),
  search("Configuración SSH", `${git}/ssh/config`, [text("user", "Usuario Linux opcional")]),
  post("Probar clave SSH", `${git}/ssh/test`, [text("user", "Usuario Linux opcional"), text("identityFile", "Ruta de la clave"), text("host", "Host"), flag("verbose", "Diagnóstico detallado")], { host: "github.com" }),
  post("Configurar clave SSH", `${git}/ssh/config`, [text("user", "Usuario Linux opcional"), text("host", "Alias de host"), text("hostName", "Host real"), text("identityFile", "Ruta de la clave", true), flag("identitiesOnly", "Usar solo esta identidad")], { identitiesOnly: true }),
  post("Reparar permisos SSH", `${git}/ssh/fix-permissions`, [text("user", "Usuario Linux opcional")], {}, "Reparar permisos de los archivos SSH del usuario seleccionado."),
  search("Clave SSH de repositorio", `${git}/ssh/repo-key`, [filePath]),
  post("Asignar clave a repositorio", `${git}/ssh/repo-key`, [filePath, text("identityFile", "Ruta de la clave"), text("user", "Usuario Linux opcional"), flag("unset", "Quitar la asignación")], { unset: false }),
  post("Eliminar clave SSH del servidor", `${git}/server/ssh/delete`, [text("name", "Nombre de la clave", true)], {}, "Eliminar la clave SSH seleccionada."),
 ]},
 { title: "Preferencias y límites de archivos", operations: [
  settings("Preferencias del explorador", "/api/files/preferences", [choice("mode", "Modo", ["client", "developer"]), flag("showHidden", "Mostrar ocultos"), lines("favoriteRoots", "Carpetas favoritas"), choice("treeExpansionMode", "Árbol", ["multiple", "single"])], "PATCH", {}, values => pick(values, ["mode", "showHidden", "favoriteRoots", "treeExpansionMode"])),
  read("Límites efectivos", "/api/files/config/effective"),
  settings("Límites y respaldos de archivos", "/api/files/config", [number("uploadMaxBytes", "Máximo de subida (bytes)", 1048576), flag("snapshotsEnabled", "Crear respaldos"), number("snapshotMaxBytes", "Máximo por respaldo (bytes)", 1048576), number("snapshotMaxPerPath", "Respaldos por archivo", 1), number("snapshotMaxTotal", "Respaldos totales", 1), flag("sharingEnabled", "Permitir compartir"), number("shareMaxExpiryMin", "Caducidad máxima (minutos)", 60, 43200), flag("sharePasswordRequired", "Exigir contraseña al compartir")], "PATCH", {}, values => pick(values, ["uploadMaxBytes", "snapshotsEnabled", "snapshotMaxBytes", "snapshotMaxPerPath", "snapshotMaxTotal", "sharingEnabled", "shareMaxExpiryMin", "sharePasswordRequired"])),
  read("Vista previa de limpieza de respaldos", "/api/files/config/prune-preview"),
  post("Limpiar respaldos fuera de límites", "/api/files/config/prune", [], {}, "Eliminar los respaldos que exceden los límites actuales. Revisa antes la vista previa."),
  search("Comprobar exposición pública", "/api/files/exposure/probe", [filePath]),
  read("Dependencias de archivos", "/api/system-deps/files"),
 ]},
];
