const obsidian = {
  "workspace": {
    "settingsTitle": "Impostazioni Obsidian",
    "settingsDescription": "Vista personale e gestione dei vault",
    "appearance": "Aspetto",
    "shortcuts": "Scorciatoie",
    "vaults": "Archivi",
    "aiIntegration": "Integrazione IA",
    "personalHint": "Salvato per il tuo account su questo server.",
    "defaultView": "Vista Markdown predefinita",
    "edit": "Modifica",
    "preview": "Anteprima",
    "split": "Dividi",
    "fontSize": "Dimensione del testo",
    "saved": "Salvato",
    "shortcutsHint": "Scorciatoie da tastiera di questo spazio di lavoro.",
    "saveShortcut": "Salva nota",
    "searchShortcut": "Attiva ricerca",
    "vaultsHint": "Registra e gestisci i vault su questo server.",
    "aiHint": "Prepara i file di contesto e sincronizza i contenitori.",
    "today": "Nota di oggi",
    "quickEntry": "Voce rapida",
    "quickEntryHint": "Aggiungi testo alla fine della nota di oggi.",
    "append": "Aggiungi voce",
    "editorPane": "Editor",
    "mobileView": "Vista dello spazio di lavoro",
    "clearSearch": "Cancella",
    "askAdmin": "Chiedi a un amministratore di registrare un vault su questo server.",
    "available": "Disponibile",
    "missing": "Non disponibile",
    "notesCount": "note",
    "noVault": "Nessun vault",
    "readOnly": "Sola lettura",
    "entryRequired": "Scrivi una voce prima di aggiungerla.",
    "entryError": "Impossibile aggiungere la voce.",
    "previewError": "Impossibile caricare l’anteprima.",
    "entryAdded": "Voce aggiunta."
  },
  "pageTitle": "Obsidian",
  "header": {
    "heading": "Vault di Obsidian",
    "subheading": "Gestisci vault, note markdown e collegamenti [[wikilink]] del server connesso."
  },
  "toolbar": {
    "newVault": "Nuovo vault",
    "unregister": "Rimuovi registrazione",
    "prepareAi": "Prepara per agenti IA",
    "searchPlaceholder": "Cerca nelle note...",
    "syncContainers": "Sincronizza contenitori"
  },
  "tree": {
    "title": "Note",
    "newNote": "Nuova nota",
    "newFolder": "Nuova cartella"
  },
  "editor": {
    "emptyTitle": "Seleziona una nota",
    "emptyDescription": "Il contenuto della nota apparirà qui per la modifica.",
    "save": "Salva",
    "links": "Collegamenti",
    "analyzeAi": "Analizza con IA",
    "unsavedChanges": "Modifiche non salvate"
  },
  "vaultDialog": {
    "title": "Nuovo vault",
    "labelName": "Nome",
    "placeholderName": "Il mio vault",
    "labelPath": "Percorso assoluto sul server",
    "placeholderPath": "/home/utente/vaults/mio-vault",
    "btnBrowse": "Sfoglia",
    "modeCreate": "Crea nuova cartella",
    "modeCreateHint": "Crea la cartella del vault (e il marcatore .obsidian) sul server.",
    "modeRegister": "Registra cartella esistente",
    "modeRegisterHint": "Usa una cartella di vault già esistente sul server.",
    "btnCancel": "Annulla",
    "btnSave": "Salva"
  },
  "pathBrowserDialog": {
    "title": "Seleziona cartella",
    "btnUp": "Su",
    "btnCancel": "Annulla",
    "btnSelect": "Usa questa cartella"
  },
  "inputDialog": {
    "btnCancel": "Annulla",
    "btnOk": "OK"
  },
  "search": {
    "title": "Risultati della ricerca"
  },
  "empty": {
    "noVaultsTitle": "Nessun vault registrato",
    "noVaultsDescription": "Crea o registra un vault di Obsidian per iniziare a lavorare sulle tue note nel server.",
    "noVaultsCta": "Nuovo vault",
    "treeNoNotes": "Il vault non ha ancora note.",
    "searchNoResults": "Nessun risultato per \"{q}\"."
  },
  "confirm": {
    "discardDirtyBody": "Ci sono modifiche non salvate nella nota corrente. Scartarle?",
    "discardDirtyTitle": "Modifiche non salvate",
    "discardDirtyConfirm": "Scarta",
    "discardDirtyCancel": "Continua la modifica",
    "unregisterBody": "Annullare la registrazione del vault \"{name}\"? I file del server NON verranno eliminati.",
    "unregisterTitle": "Annulla registrazione vault",
    "unregisterConfirm": "Annulla registrazione",
    "overwriteContextBody": "I file di contesto esistono già ({skipped}). Sovrascriverli?",
    "overwriteContextTitle": "Sovrascrivi contesto",
    "overwriteContextConfirm": "Sovrascrivi",
    "deleteNoteBody": "Eliminare la nota \"{path}\"? Questa azione non può essere annullata.",
    "deleteNoteTitle": "Elimina nota",
    "deleteNoteConfirm": "Elimina"
  },
  "actions": {
    "retry": "Riprova",
    "rename": "Rinomina",
    "delete": "Elimina",
    "newNoteInputTitle": "Nuova nota",
    "newFolderInputTitle": "Nuova cartella",
    "renameInputTitle": "Rinomina nota",
    "analyzeAiPrompt": "Sto lavorando al mio vault Obsidian \"{vaultName}\" (percorso vault sul server: {vaultPath}) dal modulo Obsidian di LUXIPANEL e voglio lavorare sulla nota \"{notePath}\".\n\nUsa i tuoi strumenti obsidian.* (leggi/cerca/crea/collega note dal vault) per:\n1. Leggere la nota e riassumere i suoi punti chiave.\n2. Verificare i suoi link [[wikilink]] in uscita e i relativi backlink.\n3. Proporre miglioramenti di contenuto, struttura e nuovi link verso altre note correlate nel vault.\n\nChiedimi prima di apportare modifiche alle note."
  },
  "errors": {
    "loadVaults": "Impossibile caricare i vault",
    "vaultMissing": "La cartella del vault non esiste sul server ({path}). Annulla la registrazione o ripristina la cartella.",
    "nameAndPathRequired": "Nome e percorso sono obbligatori",
    "pathMustBeAbsolute": "Il percorso deve essere assoluto (iniziare con /)",
    "createVault": "Impossibile creare il vault",
    "unregisterVault": "Impossibile annullare la registrazione del vault",
    "prepareContext": "Impossibile preparare il contesto IA",
    "syncContainers": "Impossibile sincronizzare i contenitori",
    "loadTree": "Errore nel caricamento dell'albero",
    "openNote": "Impossibile aprire la nota",
    "saveNote": "Impossibile salvare la nota",
    "noVaultSelected": "Seleziona prima un vault",
    "createNote": "Impossibile creare la nota",
    "createFolder": "Impossibile creare la cartella",
    "renameNote": "Impossibile rinominare la nota",
    "deleteNote": "Impossibile eliminare la nota",
    "loadLinks": "Errore nel caricamento dei link",
    "wikilinkNotFound": "Nota \"{name}\" non trovata nel vault",
    "search": "Errore di ricerca",
    "listPath": "Impossibile elencare questo percorso (autorizzazioni?)."
  },
  "labels": {
    "noteCount": " · {count} note",
    "loading": "Caricamento…",
    "noSubfolders": "(nessuna sottocartella)",
    "loadingLinks": "Caricamento collegamenti…",
    "noOutgoingLinks": "Nessun collegamento in uscita.",
    "outgoing": "In uscita",
    "backlinks": "Backlink",
    "noBacklinks": "Nessun backlink.",
    "searching": "Ricerca…",
    "newNoteInputLabel": "Percorso relativo all'interno del vault (es: Idee/Mia nota.md)",
    "newFolderInputLabel": "Percorso relativo all'interno del vault (es: Progetti/2026)",
    "renameInputLabel": "Nuovo percorso relativo"
  },
  "toasts": {
    "vaultCreated": "Vault creato",
    "vaultRegistered": "Vault registrato",
    "vaultUnregistered": "Registrazione del vault annullata",
    "contextWritten": "Contesto IA scritto: {written}",
    "contextNoChanges": "Nessuna modifica (già esistenti: {skipped})",
    "containersSynced": "Creati {created} · esistenti {existing} · repository {repos} · progetti {projects} · chat {chats}",
    "containersBasic": "Contenitori sincronizzati",
    "noteSaved": "Nota salvata",
    "noteCreated": "Nota creata",
    "folderCreated": "Cartella creata",
    "noteRenamed": "Nota rinominata",
    "noteDeleted": "Nota eliminata"
  }
} as const;

export default obsidian;
