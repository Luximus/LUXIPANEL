const obsidian = {
  "workspace": {
    "settingsTitle": "Obsidian-Einstellungen",
    "settingsDescription": "Persönliche Ansicht und Vault-Verwaltung",
    "appearance": "Darstellung",
    "shortcuts": "Tastenkürzel",
    "vaults": "Tresore",
    "aiIntegration": "KI-Integration",
    "personalHint": "Für Ihr Konto auf diesem Server gespeichert.",
    "defaultView": "Standard-Markdownansicht",
    "edit": "Bearbeiten",
    "preview": "Vorschau",
    "split": "Geteilt",
    "fontSize": "Schriftgröße",
    "saved": "Gespeichert",
    "shortcutsHint": "Tastenkürzel für diesen Arbeitsbereich.",
    "saveShortcut": "Notiz speichern",
    "searchShortcut": "Suche fokussieren",
    "vaultsHint": "Vaults auf diesem Server registrieren und verwalten.",
    "aiHint": "Kontextdateien vorbereiten und Container synchronisieren.",
    "today": "Heutige Notiz",
    "quickEntry": "Schnelleintrag",
    "quickEntryHint": "Text an das Ende der heutigen Notiz anhängen.",
    "append": "Eintrag hinzufügen",
    "editorPane": "Editor",
    "mobileView": "Arbeitsbereichsansicht",
    "clearSearch": "Leeren",
    "askAdmin": "Bitten Sie einen Administrator, einen Vault auf diesem Server zu registrieren.",
    "available": "Verfügbar",
    "missing": "Nicht verfügbar",
    "notesCount": "Notizen",
    "noVault": "Kein Vault",
    "readOnly": "Nur Lesen",
    "entryRequired": "Schreiben Sie zuerst einen Eintrag.",
    "entryError": "Eintrag konnte nicht hinzugefügt werden.",
    "previewError": "Vorschau konnte nicht geladen werden.",
    "entryAdded": "Eintrag hinzugefügt."
  },
  "pageTitle": "Obsidian",
  "header": {
    "heading": "Obsidian-Vaults",
    "subheading": "Verwalte Vaults, Markdown-Notizen und [[Wikilink]]-Verknüpfungen auf dem verbundenen Server."
  },
  "toolbar": {
    "newVault": "Neuer Vault",
    "unregister": "Abmelden",
    "prepareAi": "Für KI-Agenten vorbereiten",
    "searchPlaceholder": "Notizen durchsuchen...",
    "syncContainers": "Container synchronisieren"
  },
  "tree": {
    "title": "Notizen",
    "newNote": "Neue Notiz",
    "newFolder": "Neuer Ordner"
  },
  "editor": {
    "emptyTitle": "Wähle eine Notiz",
    "emptyDescription": "Der Inhalt der Notiz erscheint hier zum Bearbeiten.",
    "save": "Speichern",
    "links": "Verknüpfungen",
    "analyzeAi": "Mit KI analysieren",
    "unsavedChanges": "Ungespeicherte Änderungen"
  },
  "vaultDialog": {
    "title": "Neuer Vault",
    "labelName": "Name",
    "placeholderName": "Mein Vault",
    "labelPath": "Absoluter Pfad auf dem Server",
    "placeholderPath": "/home/benutzer/vaults/mein-vault",
    "btnBrowse": "Durchsuchen",
    "modeCreate": "Neuen Ordner erstellen",
    "modeCreateHint": "Erstellt den Vault-Ordner (und die .obsidian-Markierung) auf dem Server.",
    "modeRegister": "Vorhandenen Ordner registrieren",
    "modeRegisterHint": "Verwendet einen Vault-Ordner, der bereits auf dem Server existiert.",
    "btnCancel": "Abbrechen",
    "btnSave": "Speichern"
  },
  "pathBrowserDialog": {
    "title": "Ordner auswählen",
    "btnUp": "Nach oben",
    "btnCancel": "Abbrechen",
    "btnSelect": "Diesen Ordner verwenden"
  },
  "inputDialog": {
    "btnCancel": "Abbrechen",
    "btnOk": "OK"
  },
  "search": {
    "title": "Suchergebnisse"
  },
  "empty": {
    "noVaultsTitle": "Keine Vaults registriert",
    "noVaultsDescription": "Erstelle oder registriere einen Obsidian-Vault, um mit deinen Notizen auf dem Server zu arbeiten.",
    "noVaultsCta": "Neuer Vault",
    "treeNoNotes": "Der Vault hat noch keine Notizen.",
    "searchNoResults": "Keine Ergebnisse für \"{q}\"."
  },
  "confirm": {
    "discardDirtyBody": "Es gibt ungespeicherte Änderungen in der aktuellen Notiz. Verwerfen?",
    "discardDirtyTitle": "Ungespeicherte Änderungen",
    "discardDirtyConfirm": "Verwerfen",
    "discardDirtyCancel": "Weiter bearbeiten",
    "unregisterBody": "Vault \"{name}\" abmelden? Serverdateien werden nicht gelöscht.",
    "unregisterTitle": "Vault abmelden",
    "unregisterConfirm": "Abmelden",
    "overwriteContextBody": "Kontextdateien existieren bereits ({skipped}). Überschreiben?",
    "overwriteContextTitle": "Kontext überschreiben",
    "overwriteContextConfirm": "Überschreiben",
    "deleteNoteBody": "Notiz \"{path}\" löschen? Diese Aktion kann nicht rückgängig gemacht werden.",
    "deleteNoteTitle": "Notiz löschen",
    "deleteNoteConfirm": "Löschen"
  },
  "actions": {
    "retry": "Erneut versuchen",
    "rename": "Umbenennen",
    "delete": "Löschen",
    "newNoteInputTitle": "Neue Notiz",
    "newFolderInputTitle": "Neuer Ordner",
    "renameInputTitle": "Notiz umbenennen",
    "analyzeAiPrompt": "Ich arbeite an meinem Obsidian-Vault \"{vaultName}\" (Vault-Pfad auf dem Server: {vaultPath}) über das LUXIPANEL Obsidian-Modul und möchte an der Notiz \"{notePath}\" arbeiten.\n\nNutze deine obsidian.* Tools (Notizen lesen/suchen/erstellen/verlinken aus dem Vault), um:\n1. Die Notiz zu lesen und ihre Kernpunkte zusammenzufassen.\n2. Ihre ausgehenden [[wikilink]] und Backlinks zu überprüfen.\n3. Verbesserungen in Inhalt, Struktur und neue Links zu verwandten Notizen im Vault vorzuschlagen.\n\nFrage mich, bevor du Änderungen an Notizen vornimmst."
  },
  "errors": {
    "loadVaults": "Vaults konnten nicht geladen werden",
    "vaultMissing": "Der Vault-Ordner existiert nicht auf dem Server ({path}). Melde den Vault ab oder stelle den Ordner wieder her.",
    "nameAndPathRequired": "Name und Pfad sind erforderlich",
    "pathMustBeAbsolute": "Der Pfad muss absolut sein (mit / beginnen)",
    "createVault": "Vault konnte nicht erstellt werden",
    "unregisterVault": "Vault konnte nicht abgemeldet werden",
    "prepareContext": "KI-Kontext konnte nicht vorbereitet werden",
    "syncContainers": "Container konnten nicht synchronisiert werden",
    "loadTree": "Fehler beim Laden des Baums",
    "openNote": "Notiz konnte nicht geöffnet werden",
    "saveNote": "Notiz konnte nicht gespeichert werden",
    "noVaultSelected": "Wähle zuerst einen Vault",
    "createNote": "Notiz konnte nicht erstellt werden",
    "createFolder": "Ordner konnte nicht erstellt werden",
    "renameNote": "Notiz konnte nicht umbenannt werden",
    "deleteNote": "Notiz konnte nicht gelöscht werden",
    "loadLinks": "Fehler beim Laden von Links",
    "wikilinkNotFound": "Notiz \"{name}\" im Vault nicht gefunden",
    "search": "Fehler bei der Suche",
    "listPath": "Dieser Pfad konnte nicht aufgelistet werden (Berechtigungen?)."
  },
  "labels": {
    "noteCount": " · {count} Notizen",
    "loading": "Wird geladen…",
    "noSubfolders": "(keine Unterordner)",
    "loadingLinks": "Links werden geladen…",
    "noOutgoingLinks": "Keine ausgehenden Links.",
    "outgoing": "Ausgehend",
    "backlinks": "Backlinks",
    "noBacklinks": "Keine Backlinks.",
    "searching": "Wird gesucht…",
    "newNoteInputLabel": "Relativer Pfad im Vault (z.B.: Ideen/Meine Notiz.md)",
    "newFolderInputLabel": "Relativer Pfad im Vault (z.B.: Projekte/2026)",
    "renameInputLabel": "Neuer relativer Pfad"
  },
  "toasts": {
    "vaultCreated": "Vault erstellt",
    "vaultRegistered": "Vault registriert",
    "vaultUnregistered": "Vault abgemeldet",
    "contextWritten": "KI-Kontext geschrieben: {written}",
    "contextNoChanges": "Keine Änderungen (bereits vorhanden: {skipped})",
    "containersSynced": "Erstellt {created} · vorhanden {existing} · Repos {repos} · Projekte {projects} · Chats {chats}",
    "containersBasic": "Container synchronisiert",
    "noteSaved": "Notiz gespeichert",
    "noteCreated": "Notiz erstellt",
    "folderCreated": "Ordner erstellt",
    "noteRenamed": "Notiz umbenannt",
    "noteDeleted": "Notiz gelöscht"
  }
} as const;

export default obsidian;
