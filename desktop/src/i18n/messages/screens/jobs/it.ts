import type { JobsMessages } from "./es";

export const it: JobsMessages = {
  section: "Lavori",
  title: "Lavori",
  subtitle: "Richieste software con deposito a garanzia di gettoni",

  tab: {
    buyer: "Le mie richieste",
    professional: "Assegnati a me",
    profile: "Il mio profilo professionale",
  },

  status: {
    draft: "Bozza",
    published: "Pubblicato",
    assigned: "Assegnato",
    in_progress: "In corso",
    disputed: "In contestazione",
    released: "Rilasciato",
    cancelled: "Annullato",
  },

  field: {
    title: "Titolo",
    description: "Descrizione",
    price: "Prezzo (gettoni)",
    deadline: "Scadenza",
    deliverables: "Deliverable",
    country: "Paese",
    language: "Lingua",
    workType: "Tipo di lavoro",
  },

  workType: {
    fixed: "Prezzo fisso",
    hourly: "A ore",
  },

  action: {
    publish: "Pubblica e finanzia",
    offer: "Offri a un professionista",
    release: "Rilascia il pagamento",
    delete: "Elimina",
    accept: "Accetta",
    reject: "Rifiuta",
    detail: "Dettagli",
  },

  confirm: {
    publish: "{price} gettoni saranno trattenuti in garanzia. Continuare?",
    release: "Il 90% sarà pagato al professionista. Confermi?",
    delete: "Sarà rimborsato il 95% (5% di commissione). Eliminare?",
  },

  toast: {
    created: "Richiesta creata",
    published: "Richiesta pubblicata e finanziata",
    released: "Pagamento rilasciato",
    deleted: "Richiesta eliminata",
    accepted: "Offerta accettata",
    rejected: "Offerta rifiutata",
  },

  empty: {
    buyer: "Non hai ancora richieste",
    professional: "Non hai lavori assegnati",
  },

  error: {
    generic: "Si è verificato un errore",
    insufficientTokens: "Saldo gettoni insufficiente",
    notCancellable: "Un lavoro in corso non può essere eliminato",
    offerActive: "Esiste già un'offerta attiva",
  },

  ai: {
    moderatePlan: "Modera e pianifica",
    plan: "Piano di lavoro",
    translate: "Traduci nella mia lingua",
    mustModerate: "Devi moderare prima di pubblicare",
    notModerated: "La richiesta non ha superato la moderazione",
    noBalance: "Nessun saldo dati per usare l'IA",
    unavailable: "Assistente IA non disponibile",
    estimate: "Stima (gettoni)",
    professionalShare: "Professionista (90%)",
    platformShare: "Piattaforma (10%)",
    milestones: "Traguardi",
    risks: "Rischi",
    questions: "Domande da completare",
    missing: "Campi mancanti",
    draftPlaceholder: "Descrivi ciò di cui hai bisogno…",
    assist: "Assisti con l'IA",
    moderation: {
      apto: "Approvato",
      spam: "Spam",
      malicioso: "Dannoso",
      adulto: "Contenuto per adulti",
      "no-software": "Non è software",
      approved: "Approvato",
    },
    toast: {
      moderated: "Richiesta moderata",
      planned: "Piano generato",
      translated: "Traduzione pronta",
    },
  },

  prof: {
    score: "Affinità",
    busyCount: "Occupato: {n}",
    search: {
      empty: "Nessun professionista trovato con quell'email",
    },
  },

  profile: {
    enroll: "Attiva profilo professionale",
    save: "Salva profilo",
    saved: "Profilo salvato",
    displayName: "Nome visibile",
    headline: "Titolo",
    bio: "Su di me",
    cvUrl: "URL del CV",
    country: "Paese",
    skills: "Competenze",
    languages: "Lingue",
    links: "Link del portfolio",
    availability: "Disponibilità",
    rating: "Valutazione",
    activeJobs: "Lavori attivi",
    avail: {
      available: "Disponibile",
      busy: "Occupato",
      away: "Assente",
    },
  },

  offer: {
    sendMany: "Invia offerta a {n} professionisti",
    sent: {
      summary: "{sent} offerte inviate, {skipped} ignorate",
    },
    none: {
      selected: "Seleziona almeno un professionista",
    },
    searchPlaceholder: "Cerca professionista per email",
    message: "Messaggio (facoltativo)",
    onlyAvailable: "Solo disponibili",
  },

  channel: {
    title: "Monitoraggio",
    empty: "Ancora nessun messaggio per questa richiesta.",
    loadMore: "Carica precedenti",
    sendError: "Impossibile inviare il messaggio.",
    notAssignedYet:
      "Il canale si abilita quando viene assegnato un professionista.",
    attachTooLarge: "Il file supera il limite consentito.",
    systemRevoked: "Un accesso condiviso è stato revocato",
    input: "Scrivi un messaggio…",
    send: "Invia",
    attach: "Allega",
  },

  grants: {
    empty: "Non hai condiviso alcun accesso.",
    share: "Condividi accesso",
    shareError: "Impossibile condividere l'accesso.",
    revoke: "Revoca",
    revokeError: "Impossibile revocare l'accesso.",
    revoked: "Revocato",
    refLabel: "Riferimento (id / link / nota)",
    keyForbidden:
      "Il materiale della chiave non può essere condiviso. Condividi invece il riferimento (id) della risorsa.",
    label: "Etichetta",
    type: {
      server: "Server",
      ssh_key: "Chiave SSH",
      group: "Gruppo",
      link: "Link",
      note: "Nota",
    },
  },

  progress: {
    title: "Avanzamento del lavoro",
    meets100: "Soddisfa il 100%",
    inProgress: "In corso",
    report: "Rapporto di avanzamento",
    review: "Rivedi l'avanzamento (IA)",
    toast: {
      done: "Avanzamento rivisto",
    },
  },

  milestone: {
    title: "Traguardo 50%",
    request: "Richiedi 50%",
    requested: "50% richiesto",
    approve: "Approva 50%",
    approved: "50% erogato",
    note: "Nota (facoltativa)",
    split: "Professionista {dev} · Piattaforma {fee}",
    toast: {
      requested: "Traguardo richiesto",
      approved: "50% erogato al professionista",
    },
  },

  edit: {
    title: "Modifica richiesta",
    save: "Salva modifiche",
    propose: "Proponi modifiche",
    accept: "Accetta modifiche",
    reject: "Rifiuta modifiche",
    pending: "Modifiche proposte",
    topup: "Costo aggiuntivo (gettoni)",
    topupWarn:
      "Accettare queste modifiche tratterrà {n} gettoni aggiuntivi.",
    remoderate:
      "Modificare il titolo o la descrizione richiede una nuova moderazione.",
    toast: {
      saved: "Richiesta aggiornata",
      proposed: "Modifiche proposte al professionista",
      accepted: "Modifiche accettate",
      rejected: "Modifiche rifiutate",
    },
  },

  dispute: {
    title: "Contestazione / rimborso",
    badge: "In contestazione",
    open: "Apri contestazione",
    request: "Richiedi rimborso",
    reason: "Motivo della contestazione",
    notEligible:
      "Non puoi ancora contestare (deve trascorrere il 30% del tempo).",
    refundPct: "Percentuale da rimborsare",
    refundPartial: "Rimborso parziale",
    refundFull: "Rimborso totale",
    continue: "Continua il lavoro",
    toast: {
      requested: "Contestazione aperta",
      resolved: "Contestazione risolta",
    },
  },

  rating: {
    title: "Valuta il professionista",
    submit: "Invia valutazione",
    comment: "Commento (facoltativo)",
    done: "Hai già valutato questo lavoro",
    toast: {
      done: "Grazie per la tua valutazione",
    },
  },

  test: {
    require: "Richiedi test tecnico",
    generate: "Genera test (IA)",
    ready: "Test pronto · {n} domande",
    aiUnavailable: "IA non disponibile per generare il test",
    required: "Test richiesto",
    present: "Svolgi il test",
    passed: "Superato",
    failed: "Non superato",
    passedBadge: "Test ✓",
    noTestBadge: "Senza test",
    acceptLocked: "Devi superare il test per accettare",
    oneAttempt: "Hai solo 1 tentativo e un tempo limite. Iniziare il test ora?",
    attemptExists: "Hai già svolto questo test (1 tentativo)",
    gateRequired: "Questo requisito richiede il superamento di un test tecnico",
    notGenerated: "Il test non è ancora stato generato",
    invalid: "Il test non è valido; l'acquirente deve rigenerarlo",
    questionOf: "Domanda {n} di 12",
    autoAdvance: "Avanzamento automatico: 10 s per domanda, senza tornare indietro",
    next: "Avanti",
    submit: "Invia risposte",
    result: {
      passed: "Superato! Ora puoi accettare il lavoro.",
      failed: "Non superato. Punteggio: {score}/12.",
      timedOut: "Il tempo del test è scaduto.",
    },
    toast: {
      required: "Preferenza del test aggiornata",
      generated: "Test generato",
    },
  },
};
