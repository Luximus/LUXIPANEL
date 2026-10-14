const openclaw = {
  "pageTitle": "OpenClaw",
  "header": {
    "subtitle": "Conecta el panel con",
    "subtitleSuffix": "para usar sus modelos y herramientas."
  },
  "statusCard": {
    "title": "Estado de la conexión",
    "descKeySet": "clave API configurada. Pulsa \"Probar conexión\" para verificar.",
    "descNoKey": "Sin clave API configurada todavía.",
    "btnTest": "Probar conexión"
  },
  "form": {
    "sectionTitle": "Credenciales y endpoint",
    "sectionDesc": "La clave API se guarda cifrada en la base de datos del panel.",
    "labelEndpoint": "Endpoint",
    "placeholderEndpoint": "https://openclaw.ai",
    "hintEndpoint": "URL base de la API. Por defecto",
    "labelApiKey": "clave API",
    "placeholderApiKeySet": "Configurada · {preview}",
    "placeholderApiKeyUnset": "sk-...",
    "ariaToggleKey": "Mostrar u ocultar",
    "btnClearKey": "Borrar",
    "hintApiKey": "Deja en blanco para mantener la clave API actual.",
    "labelDefaultModel": "Modelo por defecto",
    "placeholderDefaultModel": "claw-default",
    "hintDefaultModel": "Identificador del modelo que usarán las llamadas internas que no especifiquen uno.",
    "btnSave": "Guardar cambios"
  },
  "help": {
    "title": "¿Cómo obtengo mi clave API?",
    "step1": "Inicia sesión en",
    "step2": "Abre los ajustes de tu cuenta y crea una nueva clave API.",
    "step3": "Pégala arriba y guarda — el panel no la mostrará en claro de nuevo."
  }
} as const;

export default openclaw;
