const obsidian = {
  "workspace": {
    "settingsTitle": "Obsidian settings",
    "settingsDescription": "Personal view and vault management",
    "appearance": "Appearance",
    "shortcuts": "Shortcuts",
    "vaults": "Vaults",
    "aiIntegration": "AI integration",
    "personalHint": "Saved for your account on this server.",
    "defaultView": "Default Markdown view",
    "edit": "Edit",
    "preview": "Preview",
    "split": "Split",
    "fontSize": "Text size",
    "saved": "Saved",
    "shortcutsHint": "Keyboard shortcuts in this workspace.",
    "saveShortcut": "Save note",
    "searchShortcut": "Focus search",
    "vaultsHint": "Register and manage vaults on this server.",
    "aiHint": "Prepare context files and synchronize containers.",
    "today": "Today’s note",
    "quickEntry": "Quick entry",
    "quickEntryHint": "Add text to the end of today’s note.",
    "append": "Add entry",
    "editorPane": "Editor",
    "mobileView": "Workspace view",
    "clearSearch": "Clear",
    "askAdmin": "Ask an administrator to register a vault on this server.",
    "available": "Available",
    "missing": "Unavailable",
    "notesCount": "notes",
    "noVault": "No vault",
    "readOnly": "Read only",
    "entryRequired": "Write an entry first.",
    "entryError": "Could not add the entry.",
    "previewError": "Could not load the preview.",
    "entryAdded": "Entry added."
  },
  "pageTitle": "Obsidian",
  "header": {
    "heading": "Obsidian vaults",
    "subheading": "Manage vaults, markdown notes and [[wikilink]] connections on the connected server."
  },
  "toolbar": {
    "newVault": "New vault",
    "unregister": "Unregister",
    "prepareAi": "Prepare for AI agents",
    "searchPlaceholder": "Search notes...",
    "syncContainers": "Sync containers"
  },
  "tree": {
    "title": "Notes",
    "newNote": "New note",
    "newFolder": "New folder"
  },
  "editor": {
    "emptyTitle": "Select a note",
    "emptyDescription": "The note content will appear here for editing.",
    "save": "Save",
    "links": "Links",
    "analyzeAi": "Analyze with AI",
    "unsavedChanges": "Unsaved changes"
  },
  "vaultDialog": {
    "title": "New vault",
    "labelName": "Name",
    "placeholderName": "My vault",
    "labelPath": "Absolute path on the server",
    "placeholderPath": "/home/user/vaults/my-vault",
    "btnBrowse": "Browse",
    "modeCreate": "Create new folder",
    "modeCreateHint": "Creates the vault folder (and its .obsidian marker) on the server.",
    "modeRegister": "Register existing folder",
    "modeRegisterHint": "Uses a vault folder that already exists on the server.",
    "btnCancel": "Cancel",
    "btnSave": "Save"
  },
  "pathBrowserDialog": {
    "title": "Select folder",
    "btnUp": "Up",
    "btnCancel": "Cancel",
    "btnSelect": "Use this folder"
  },
  "inputDialog": {
    "btnCancel": "Cancel",
    "btnOk": "OK"
  },
  "search": {
    "title": "Search results"
  },
  "empty": {
    "noVaultsTitle": "No vaults registered",
    "noVaultsDescription": "Create or register an Obsidian vault to start working on your notes on the server.",
    "noVaultsCta": "New vault",
    "treeNoNotes": "Vault has no notes yet.",
    "searchNoResults": "No results for \"{q}\"."
  },
  "confirm": {
    "discardDirtyBody": "There are unsaved changes in the current note. Discard them?",
    "discardDirtyTitle": "Unsaved changes",
    "discardDirtyConfirm": "Discard",
    "discardDirtyCancel": "Keep editing",
    "unregisterBody": "Unregister vault \"{name}\"? Server files will NOT be deleted.",
    "unregisterTitle": "Unregister vault",
    "unregisterConfirm": "Unregister",
    "overwriteContextBody": "Context files already exist ({skipped}). Overwrite them?",
    "overwriteContextTitle": "Overwrite context",
    "overwriteContextConfirm": "Overwrite",
    "deleteNoteBody": "Delete note \"{path}\"? This action cannot be undone.",
    "deleteNoteTitle": "Delete note",
    "deleteNoteConfirm": "Delete"
  },
  "actions": {
    "retry": "Retry",
    "rename": "Rename",
    "delete": "Delete",
    "newNoteInputTitle": "New note",
    "newFolderInputTitle": "New folder",
    "renameInputTitle": "Rename note",
    "analyzeAiPrompt": "I'm working in my Obsidian vault \"{vaultName}\" (vault path on server: {vaultPath}) from the LUXIPANEL Obsidian module, and I want to work on the note \"{notePath}\".\n\nUse your obsidian.* tools (read/search/create/link notes in the vault) to:\n1. Read the note and summarize its key points.\n2. Review its outgoing [[wikilink]] references and backlinks.\n3. Propose improvements to content, structure, and new links to related notes in the vault.\n\nAsk me before making any changes to the notes."
  },
  "errors": {
    "loadVaults": "Could not load vaults",
    "vaultMissing": "Vault folder does not exist on server ({path}). Unregister it or restore the folder.",
    "nameAndPathRequired": "Name and path are required",
    "pathMustBeAbsolute": "Path must be absolute (start with /)",
    "createVault": "Could not create vault",
    "unregisterVault": "Could not unregister vault",
    "prepareContext": "Could not prepare AI context",
    "syncContainers": "Could not sync containers",
    "loadTree": "Error loading tree",
    "openNote": "Could not open note",
    "saveNote": "Could not save note",
    "noVaultSelected": "Select a vault first",
    "createNote": "Could not create note",
    "createFolder": "Could not create folder",
    "renameNote": "Could not rename note",
    "deleteNote": "Could not delete note",
    "loadLinks": "Error loading links",
    "wikilinkNotFound": "Note \"{name}\" not found in vault",
    "search": "Search error",
    "listPath": "Could not list this path (permissions?)."
  },
  "labels": {
    "noteCount": " · {count} notes",
    "loading": "Loading…",
    "noSubfolders": "(no subfolders)",
    "loadingLinks": "Loading links…",
    "noOutgoingLinks": "No outgoing links.",
    "outgoing": "Outgoing",
    "backlinks": "Backlinks",
    "noBacklinks": "No backlinks.",
    "searching": "Searching…",
    "newNoteInputLabel": "Relative path within vault (e.g., Ideas/My note.md)",
    "newFolderInputLabel": "Relative path within vault (e.g., Projects/2026)",
    "renameInputLabel": "New relative path"
  },
  "toasts": {
    "vaultCreated": "Vault created",
    "vaultRegistered": "Vault registered",
    "vaultUnregistered": "Vault unregistered",
    "contextWritten": "AI context written: {written}",
    "contextNoChanges": "No changes (already existed: {skipped})",
    "containersSynced": "Created {created} · existing {existing} · repos {repos} · projects {projects} · chats {chats}",
    "containersBasic": "Containers synced",
    "noteSaved": "Note saved",
    "noteCreated": "Note created",
    "folderCreated": "Folder created",
    "noteRenamed": "Note renamed",
    "noteDeleted": "Note deleted"
  }
} as const;

export default obsidian;
