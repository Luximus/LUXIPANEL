const obsidian = {
  "workspace": {
    "settingsTitle": "Configurações do Obsidian",
    "settingsDescription": "Visualização pessoal e gestão de vaults",
    "appearance": "Aparência",
    "shortcuts": "Atalhos",
    "vaults": "Cofres",
    "aiIntegration": "Integração com IA",
    "personalHint": "Salvo para sua conta neste servidor.",
    "defaultView": "Visualização Markdown padrão",
    "edit": "Editar",
    "preview": "Prévia",
    "split": "Dividir",
    "fontSize": "Tamanho do texto",
    "saved": "Salvo",
    "shortcutsHint": "Atalhos de teclado deste espaço de trabalho.",
    "saveShortcut": "Salvar nota",
    "searchShortcut": "Focar busca",
    "vaultsHint": "Registre e gerencie vaults neste servidor.",
    "aiHint": "Prepare arquivos de contexto e sincronize contêineres.",
    "today": "Nota de hoje",
    "quickEntry": "Entrada rápida",
    "quickEntryHint": "Adicione texto ao final da nota de hoje.",
    "append": "Adicionar entrada",
    "editorPane": "Editor",
    "mobileView": "Visualização do espaço de trabalho",
    "clearSearch": "Limpar",
    "askAdmin": "Peça a um administrador para registrar um vault neste servidor.",
    "available": "Disponível",
    "missing": "Indisponível",
    "notesCount": "notas",
    "noVault": "Sem vault",
    "readOnly": "Somente leitura",
    "entryRequired": "Escreva uma entrada antes de adicionar.",
    "entryError": "Não foi possível adicionar a entrada.",
    "previewError": "Não foi possível carregar a prévia.",
    "entryAdded": "Entrada adicionada."
  },
  "pageTitle": "Obsidian",
  "header": {
    "heading": "Vaults do Obsidian",
    "subheading": "Gerencie vaults, notas markdown e ligações [[wikilink]] do servidor conectado."
  },
  "toolbar": {
    "newVault": "Novo vault",
    "unregister": "Desregistrar",
    "prepareAi": "Preparar para agentes de IA",
    "searchPlaceholder": "Pesquisar nas notas...",
    "syncContainers": "Sincronizar contêineres"
  },
  "tree": {
    "title": "Notas",
    "newNote": "Nova nota",
    "newFolder": "Nova pasta"
  },
  "editor": {
    "emptyTitle": "Selecione uma nota",
    "emptyDescription": "O conteúdo da nota aparecerá aqui para edição.",
    "save": "Salvar",
    "links": "Ligações",
    "analyzeAi": "Analisar com IA",
    "unsavedChanges": "Alterações não salvas"
  },
  "vaultDialog": {
    "title": "Novo vault",
    "labelName": "Nome",
    "placeholderName": "Meu vault",
    "labelPath": "Caminho absoluto no servidor",
    "placeholderPath": "/home/usuario/vaults/meu-vault",
    "btnBrowse": "Procurar",
    "modeCreate": "Criar nova pasta",
    "modeCreateHint": "Cria a pasta do vault (e o marcador .obsidian) no servidor.",
    "modeRegister": "Registrar pasta existente",
    "modeRegisterHint": "Usa uma pasta de vault que já existe no servidor.",
    "btnCancel": "Cancelar",
    "btnSave": "Salvar"
  },
  "pathBrowserDialog": {
    "title": "Selecionar pasta",
    "btnUp": "Cima",
    "btnCancel": "Cancelar",
    "btnSelect": "Usar esta pasta"
  },
  "inputDialog": {
    "btnCancel": "Cancelar",
    "btnOk": "OK"
  },
  "search": {
    "title": "Resultados da pesquisa"
  },
  "empty": {
    "noVaultsTitle": "Nenhum vault registrado",
    "noVaultsDescription": "Crie ou registre um vault do Obsidian para começar a trabalhar suas notas no servidor.",
    "noVaultsCta": "Novo vault",
    "treeNoNotes": "O vault não possui notas ainda.",
    "searchNoResults": "Sem resultados para \"{q}\"."
  },
  "confirm": {
    "discardDirtyBody": "Há mudanças não salvas na nota atual. Descartar?",
    "discardDirtyTitle": "Mudanças não salvas",
    "discardDirtyConfirm": "Descartar",
    "discardDirtyCancel": "Continuar editando",
    "unregisterBody": "Desregistrar o vault \"{name}\"? Os arquivos do servidor NÃO serão deletados.",
    "unregisterTitle": "Desregistrar vault",
    "unregisterConfirm": "Desregistrar",
    "overwriteContextBody": "Os arquivos de contexto já existem ({skipped}). Sobrescrevê-los?",
    "overwriteContextTitle": "Sobrescrever contexto",
    "overwriteContextConfirm": "Sobrescrever",
    "deleteNoteBody": "Deletar a nota \"{path}\"? Esta ação não pode ser desfeita.",
    "deleteNoteTitle": "Deletar nota",
    "deleteNoteConfirm": "Deletar"
  },
  "actions": {
    "retry": "Tentar novamente",
    "rename": "Renomear",
    "delete": "Deletar",
    "newNoteInputTitle": "Nova nota",
    "newFolderInputTitle": "Nova pasta",
    "renameInputTitle": "Renomear nota",
    "analyzeAiPrompt": "Estou trabalhando em meu vault do Obsidian \"{vaultName}\" (caminho do vault no servidor: {vaultPath}) através do módulo Obsidian do LUXIPANEL e quero trabalhar a nota \"{notePath}\".\\n\\nUse suas ferramentas obsidian.* (ler/pesquisar/criar/vincular notas do vault) para:\\n1. Ler a nota e resumir seus pontos-chave.\\n2. Revisar suas ligações [[wikilink]] de saída e seus backlinks.\\n3. Propor melhorias de conteúdo, estrutura e novas ligações para outras notas relacionadas do vault.\\n\\nPergunte-me antes de aplicar qualquer alteração nas notas."
  },
  "errors": {
    "loadVaults": "Não foi possível carregar os vaults",
    "vaultMissing": "A pasta do vault não existe no servidor ({path}). Desregistre-a ou restaure a pasta.",
    "nameAndPathRequired": "Nome e caminho são obrigatórios",
    "pathMustBeAbsolute": "O caminho deve ser absoluto (começar com /)",
    "createVault": "Não foi possível criar o vault",
    "unregisterVault": "Não foi possível desregistrar o vault",
    "prepareContext": "Não foi possível preparar o contexto de IA",
    "syncContainers": "Não foi possível sincronizar os contêineres",
    "loadTree": "Erro ao carregar a árvore",
    "openNote": "Não foi possível abrir a nota",
    "saveNote": "Não foi possível salvar a nota",
    "noVaultSelected": "Selecione um vault primeiro",
    "createNote": "Não foi possível criar a nota",
    "createFolder": "Não foi possível criar a pasta",
    "renameNote": "Não foi possível renomear a nota",
    "deleteNote": "Não foi possível deletar a nota",
    "loadLinks": "Erro ao carregar ligações",
    "wikilinkNotFound": "Nota \"{name}\" não encontrada no vault",
    "search": "Erro na pesquisa",
    "listPath": "Não foi possível listar este caminho (permissões?)."
  },
  "labels": {
    "noteCount": " · {count} notas",
    "loading": "Carregando…",
    "noSubfolders": "(sem subpastas)",
    "loadingLinks": "Carregando ligações…",
    "noOutgoingLinks": "Sem ligações de saída.",
    "outgoing": "Saída",
    "backlinks": "Ligações inversas",
    "noBacklinks": "Sem backlinks.",
    "searching": "Pesquisando…",
    "newNoteInputLabel": "Caminho relativo no vault (ex: Ideias/Minha nota.md)",
    "newFolderInputLabel": "Caminho relativo no vault (ex: Projetos/2026)",
    "renameInputLabel": "Novo caminho relativo"
  },
  "toasts": {
    "vaultCreated": "Vault criado",
    "vaultRegistered": "Vault registrado",
    "vaultUnregistered": "Vault desregistrado",
    "contextWritten": "Contexto de IA escrito: {written}",
    "contextNoChanges": "Sem mudanças (já existiam: {skipped})",
    "containersSynced": "Criados {created} · existentes {existing} · repos {repos} · projetos {projects} · chats {chats}",
    "containersBasic": "Contêineres sincronizados",
    "noteSaved": "Nota salva",
    "noteCreated": "Nota criada",
    "folderCreated": "Pasta criada",
    "noteRenamed": "Nota renomeada",
    "noteDeleted": "Nota deletada"
  }
} as const;

export default obsidian;
