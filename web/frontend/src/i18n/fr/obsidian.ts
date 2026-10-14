const obsidian = {
  "workspace": {
    "settingsTitle": "Paramètres Obsidian",
    "settingsDescription": "Vue personnelle et gestion des vaults",
    "appearance": "Apparence",
    "shortcuts": "Raccourcis",
    "vaults": "Coffres",
    "aiIntegration": "Intégration IA",
    "personalHint": "Enregistré pour votre compte sur ce serveur.",
    "defaultView": "Vue Markdown par défaut",
    "edit": "Modifier",
    "preview": "Aperçu",
    "split": "Diviser",
    "fontSize": "Taille du texte",
    "saved": "Enregistré",
    "shortcutsHint": "Raccourcis clavier de cet espace de travail.",
    "saveShortcut": "Enregistrer la note",
    "searchShortcut": "Activer la recherche",
    "vaultsHint": "Enregistrez et gérez les vaults sur ce serveur.",
    "aiHint": "Préparez les fichiers de contexte et synchronisez les conteneurs.",
    "today": "Note du jour",
    "quickEntry": "Entrée rapide",
    "quickEntryHint": "Ajoutez du texte à la fin de la note du jour.",
    "append": "Ajouter une entrée",
    "editorPane": "Éditeur",
    "mobileView": "Vue de l’espace de travail",
    "clearSearch": "Effacer",
    "askAdmin": "Demandez à un administrateur d’enregistrer un vault sur ce serveur.",
    "available": "Disponible",
    "missing": "Indisponible",
    "notesCount": "notes",
    "noVault": "Aucun vault",
    "readOnly": "Lecture seule",
    "entryRequired": "Rédigez une entrée avant de l’ajouter.",
    "entryError": "Impossible d’ajouter l’entrée.",
    "previewError": "Impossible de charger l’aperçu.",
    "entryAdded": "Entrée ajoutée."
  },
  "pageTitle": "Obsidian",
  "header": {
    "heading": "Vaults Obsidian",
    "subheading": "Gérez les vaults, notes markdown et liens [[wikilink]] du serveur connecté."
  },
  "toolbar": {
    "newVault": "Nouveau vault",
    "unregister": "Désenregistrer",
    "prepareAi": "Préparer pour les agents IA",
    "searchPlaceholder": "Rechercher dans les notes...",
    "syncContainers": "Synchroniser les conteneurs"
  },
  "tree": {
    "title": "Notes",
    "newNote": "Nouvelle note",
    "newFolder": "Nouveau dossier"
  },
  "editor": {
    "emptyTitle": "Sélectionnez une note",
    "emptyDescription": "Le contenu de la note apparaîtra ici pour l'édition.",
    "save": "Enregistrer",
    "links": "Liens",
    "analyzeAi": "Analyser avec l'IA",
    "unsavedChanges": "Modifications non enregistrées"
  },
  "vaultDialog": {
    "title": "Nouveau vault",
    "labelName": "Nom",
    "placeholderName": "Mon vault",
    "labelPath": "Chemin absolu sur le serveur",
    "placeholderPath": "/home/utilisateur/vaults/mon-vault",
    "btnBrowse": "Parcourir",
    "modeCreate": "Créer un nouveau dossier",
    "modeCreateHint": "Crée le dossier du vault (et son marqueur .obsidian) sur le serveur.",
    "modeRegister": "Enregistrer un dossier existant",
    "modeRegisterHint": "Utilise un dossier de vault qui existe déjà sur le serveur.",
    "btnCancel": "Annuler",
    "btnSave": "Enregistrer"
  },
  "pathBrowserDialog": {
    "title": "Sélectionner un dossier",
    "btnUp": "Monter",
    "btnCancel": "Annuler",
    "btnSelect": "Utiliser ce dossier"
  },
  "inputDialog": {
    "btnCancel": "Annuler",
    "btnOk": "OK"
  },
  "search": {
    "title": "Résultats de recherche"
  },
  "empty": {
    "noVaultsTitle": "Aucun vault enregistré",
    "noVaultsDescription": "Créez ou enregistrez un vault Obsidian pour commencer à travailler vos notes sur le serveur.",
    "noVaultsCta": "Nouveau vault",
    "treeNoNotes": "Le vault n'a pas encore de notes.",
    "searchNoResults": "Aucun résultat pour \"{q}\"."
  },
  "confirm": {
    "discardDirtyBody": "Il y a des modifications non enregistrées dans la note actuelle. Les abandonner ?",
    "discardDirtyTitle": "Modifications non enregistrées",
    "discardDirtyConfirm": "Abandonner",
    "discardDirtyCancel": "Continuer l'édition",
    "unregisterBody": "Désenregistrer le vault \"{name}\" ? Les fichiers du serveur NE seront PAS supprimés.",
    "unregisterTitle": "Désenregistrer le vault",
    "unregisterConfirm": "Désenregistrer",
    "overwriteContextBody": "Les fichiers de contexte existent déjà ({skipped}). Les remplacer ?",
    "overwriteContextTitle": "Remplacer le contexte",
    "overwriteContextConfirm": "Remplacer",
    "deleteNoteBody": "Supprimer la note \"{path}\" ? Cette action est irréversible.",
    "deleteNoteTitle": "Supprimer la note",
    "deleteNoteConfirm": "Supprimer"
  },
  "actions": {
    "retry": "Réessayer",
    "rename": "Renommer",
    "delete": "Supprimer",
    "newNoteInputTitle": "Nouvelle note",
    "newFolderInputTitle": "Nouveau dossier",
    "renameInputTitle": "Renommer la note",
    "analyzeAiPrompt": "Je travaille sur mon vault Obsidian \"{vaultName}\" (chemin du vault sur le serveur : {vaultPath}) depuis le module Obsidian de LUXIPANEL, et je veux travailler sur la note \"{notePath}\".\n\nUtilise tes outils obsidian.* (lire/chercher/créer/lier des notes du vault) pour :\n1. Lire la note et résumer ses points clés.\n2. Examiner ses liens [[wikilink]] sortants et ses rétroliens.\n3. Proposer des améliorations de contenu, de structure et de nouveaux liens vers d'autres notes connexes du vault.\n\nDemande-moi avant d'appliquer des modifications aux notes."
  },
  "errors": {
    "loadVaults": "Impossible de charger les vaults",
    "vaultMissing": "Le dossier du vault n'existe pas sur le serveur ({path}). Désenregistrez-le ou restaurez le dossier.",
    "nameAndPathRequired": "Le nom et le chemin sont obligatoires",
    "pathMustBeAbsolute": "Le chemin doit être absolu (commencer par /)",
    "createVault": "Impossible de créer le vault",
    "unregisterVault": "Impossible de désenregistrer le vault",
    "prepareContext": "Impossible de préparer le contexte IA",
    "syncContainers": "Impossible de synchroniser les conteneurs",
    "loadTree": "Erreur lors du chargement de l'arborescence",
    "openNote": "Impossible d'ouvrir la note",
    "saveNote": "Impossible d'enregistrer la note",
    "noVaultSelected": "Sélectionnez d'abord un vault",
    "createNote": "Impossible de créer la note",
    "createFolder": "Impossible de créer le dossier",
    "renameNote": "Impossible de renommer la note",
    "deleteNote": "Impossible de supprimer la note",
    "loadLinks": "Erreur lors du chargement des liens",
    "wikilinkNotFound": "Note \"{name}\" non trouvée dans le vault",
    "search": "Erreur de recherche",
    "listPath": "Impossible de lister ce chemin (permissions ?)."
  },
  "labels": {
    "noteCount": " · {count} notes",
    "loading": "Chargement…",
    "noSubfolders": "(pas de sous-dossiers)",
    "loadingLinks": "Chargement des liens…",
    "noOutgoingLinks": "Pas de liens sortants.",
    "outgoing": "Sortants",
    "backlinks": "Rétroliens",
    "noBacklinks": "Pas de rétroliens.",
    "searching": "Recherche…",
    "newNoteInputLabel": "Chemin relatif dans le vault (ex : Idées/Ma note.md)",
    "newFolderInputLabel": "Chemin relatif dans le vault (ex : Projets/2026)",
    "renameInputLabel": "Nouveau chemin relatif"
  },
  "toasts": {
    "vaultCreated": "Vault créé",
    "vaultRegistered": "Vault enregistré",
    "vaultUnregistered": "Vault désenregistré",
    "contextWritten": "Contexte IA écrit : {written}",
    "contextNoChanges": "Pas de changements (déjà existants : {skipped})",
    "containersSynced": "Créés {created} · existants {existing} · repos {repos} · projets {projects} · chats {chats}",
    "containersBasic": "Conteneurs synchronisés",
    "noteSaved": "Note enregistrée",
    "noteCreated": "Note créée",
    "folderCreated": "Dossier créé",
    "noteRenamed": "Note renommée",
    "noteDeleted": "Note supprimée"
  }
} as const;

export default obsidian;
