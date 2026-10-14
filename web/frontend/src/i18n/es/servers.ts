const servers = {
  "pageTitle": "Servidores",
  "description": "Registro local de destinos SSH a los que este panel se puede conectar. Los secretos (claves/contraseñas) se guardan cifrados y nunca se muestran aquí.",
  "btnNew": "Añadir servidor",
  "table": {
    "name": "Nombre",
    "host": "Servidor",
    "username": "Usuario",
    "authType": "Autenticación",
    "status": "Estado"
  },
  "authTypes": {
    "key": "Clave SSH",
    "password": "Contraseña"
  },
  "status": {
    "approved": "Aprobado",
    "pending": "Pendiente",
    "untested": "Sin probar"
  },
  "common": {
    "test": "Probar",
    "edit": "Editar",
    "delete": "Eliminar",
    "cancel": "Cancelar",
    "save": "Guardar",
    "close": "Cerrar",
    "error": "Error",
    "yes": "Sí",
    "no": "No"
  },
  "dialog": {
    "titleNew": "Añadir servidor",
    "titleEdit": "Editar servidor",
    "name": "Nombre",
    "namePlaceholder": "Mi servidor de producción",
    "host": "Host o IP",
    "hostPlaceholder": "203.0.113.10 o servidor.ejemplo.com",
    "port": "Puerto",
    "username": "Usuario",
    "usernamePlaceholder": "root",
    "authType": "Tipo de autenticación",
    "secretKey": "Clave privada SSH",
    "secretKeyPlaceholder": "-----BEGIN OPENSSH PRIVATE KEY-----",
    "passphrase": "Passphrase de la clave (opcional)",
    "passphrasePlaceholder": "Passphrase para desbloquear la clave",
    "secretPassword": "Contraseña",
    "secretPasswordPlaceholder": "Contraseña del usuario SSH",
    "secretKeepHint": "Déjalo vacío para conservar el secreto actual.",
    "btnCancel": "Cancelar",
    "btnSave": "Guardar"
  },
  "fingerprint": {
    "title": "Aprobar huella del host",
    "intro": "Es la primera conexión con este servidor. Verifica que la huella (fingerprint) de la clave del host coincide con la esperada antes de aprobarla.",
    "approve": "Aprobar huella",
    "approving": "Aprobando...",
    "approved": "Huella aprobada",
    "approveError": "No se pudo aprobar la huella"
  },
  "toasts": {
    "created": "Servidor añadido",
    "updated": "Servidor actualizado",
    "deleted": "Servidor eliminado",
    "testOk": "Conexión correcta",
    "testFailed": "Falló la conexión"
  },
  "validation": {
    "nameRequired": "Indica un nombre",
    "hostRequired": "Indica el host",
    "usernameRequired": "Indica el usuario",
    "secretRequired": "Indica el secreto de autenticación"
  },
  "confirmDelete": "¿Eliminar el servidor {name}? Esta acción no se puede deshacer.",
  "confirmDeleteTitle": "Eliminar servidor",
  "testing": "Probando conexión..."
} as const;

export default servers;
