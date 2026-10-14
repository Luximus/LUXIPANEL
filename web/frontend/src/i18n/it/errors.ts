const errors = {
  "networkError": {
    "serverError": "Il server ha restituito un errore {status} (l'operazione potrebbe essere scaduta).",
    "invalidResponse": "Risposta non valida dal server.",
    "connectionFailed": "Impossibile connettersi al server. Controlla la connessione e riprova.",
    "targetScopeChanged": "Il server selezionato è cambiato; ricarica la pagina.",
    "bridgeSessionRequired": "Seleziona o riconnetti un server per continuare."
  },
  "error400": {
    "code": "400",
    "title": "Richiesta non valida",
    "description": "La richiesta inviata contiene parametri non validi. Verifica i dati e riprova."
  },
  "error401": {
    "code": "401",
    "title": "Non autorizzato",
    "description": "Devi accedere per accedere a questa risorsa. Per favore, accedi."
  },
  "error403": {
    "code": "403",
    "title": "Accesso negato",
    "description": "Non hai i permessi per accedere a questa risorsa."
  },
  "error404": {
    "code": "404",
    "title": "Pagina non trovata",
    "description": "Il percorso che stai cercando non esiste o è stato spostato. Verifica l'URL o torna alla home."
  },
  "error500": {
    "code": "500",
    "title": "Errore interno del server",
    "description": "Qualcosa è andato storto sul nostro server. Stiamo lavorando per risolvere il problema. Riprova più tardi."
  },
  "error503": {
    "code": "503",
    "title": "Servizio non disponibile",
    "description": "Il server è in manutenzione o sovraccarico. Per favore riprova più tardi."
  },
  "home": "Vai a Home",
  "back": "Indietro",
  "backToServers": "Torna ai server"
} as const;

export default errors;
