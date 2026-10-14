const openclaw = {
  "pageTitle": "OpenClaw",
  "header": {
    "subtitle": "Collega il pannello con",
    "subtitleSuffix": "per utilizzare i suoi modelli e strumenti."
  },
  "statusCard": {
    "title": "Stato della connessione",
    "descKeySet": "API key configurata. Premi \"Testa connessione\" per verificare.",
    "descNoKey": "Nessuna API key configurata ancora.",
    "btnTest": "Testa connessione"
  },
  "form": {
    "sectionTitle": "Credenziali ed endpoint",
    "sectionDesc": "La API key viene salvata cifrata nel database del pannello.",
    "labelEndpoint": "Endpoint",
    "placeholderEndpoint": "https://openclaw.ai",
    "hintEndpoint": "URL base dell'API. Per impostazione predefinita",
    "labelApiKey": "chiave API",
    "placeholderApiKeySet": "Configurata · {preview}",
    "placeholderApiKeyUnset": "sk-...",
    "ariaToggleKey": "Mostra o nascondi",
    "btnClearKey": "Cancella",
    "hintApiKey": "Lascia vuoto per mantenere la API key attuale.",
    "labelDefaultModel": "Modello predefinito",
    "placeholderDefaultModel": "claw-default",
    "hintDefaultModel": "Identificatore del modello che useranno le chiamate interne che non ne specificano uno.",
    "btnSave": "Salva modifiche"
  },
  "help": {
    "title": "Come ottengo la mia API key?",
    "step1": "Accedi a",
    "step2": "Apri le impostazioni del tuo account e crea una nuova API key.",
    "step3": "Incollala sopra e salva — il pannello non la mostrerà più in chiaro."
  }
} as const;

export default openclaw;
