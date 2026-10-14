const databases = {
  "pageTitle": "Bases de dados",
  "header": {
    "heading": "Gestor de bases de dados",
    "subheading": "Explore e consulte as bases de dados do servidor (MySQL/MariaDB, PostgreSQL)."
  },
  "databases": {
    "title": "Bases de dados"
  },
  "tables": {
    "title": "Tabelas"
  },
  "tabs": {
    "rows": "Linhas",
    "structure": "Estrutura",
    "console": "Console SQL"
  },
  "rows": {
    "prev": "Anterior",
    "next": "Seguinte"
  },
  "console": {
    "placeholder": "SELECT * FROM ...",
    "run": "Executar",
    "allowWrite": "Permitir escrita",
    "hint": "Ctrl/⌘ + Enter para executar. As instruções de escrita/DDL requerem marcar \"Permitir escrita\"."
  },
  "common": {
    "selectEngine": "Selecione um motor.",
    "selectDb": "Selecione uma base de dados.",
    "selectTable": "Selecione uma tabela."
  },
  "actions": {
    "export": "Exportar",
    "addRecord": "Inserir registro",
    "cancel": "Cancelar",
    "save": "Salvar",
    "edit": "Editar",
    "downloadSql": "Baixar SQL",
    "install": "Instalar {label}"
  },
  "titles": {
    "record": "Registo",
    "exportDb": "Exportar banco de dados",
    "editRecord": "Editar registo · {table}",
    "newRecord": "Novo registro · {table}"
  },
  "labels": {
    "tablesLabel": "Tabelas",
    "allTables": "Todas",
    "includeData": "Incluir dados",
    "active": "Ativo",
    "actions": "Ações",
    "colName": "Coluna",
    "colType": "Tipo",
    "colNullable": "Nulo",
    "colKey": "Chave",
    "colDefault": "Padrão",
    "yes": "Sim",
    "no": "Não",
    "primaryKey": "Chave primária",
    "tbl": "tbl"
  },
  "install": {
    "title": "Instalar mecanismo de banco de dados",
    "description": "Instale MariaDB ou PostgreSQL no servidor conectado para começar a gerenciar bancos de dados.",
    "mariadb": "MariaDB",
    "postgresql": "PostgreSQL"
  },
  "empty": {
    "noResults": "Sem resultados.",
    "noEngines": "Nenhum mecanismo de banco de dados ativo no servidor. Instale um para começar.",
    "noDatabases": "Sem bancos de dados.",
    "noTables": "Sem tabelas."
  },
  "errors": {
    "detectEngines": "Erro ao detectar mecanismos",
    "loadRows": "Erro ao carregar linhas",
    "saveRecord": "Não foi possível salvar o registro",
    "deleteRecord": "Não foi possível deletar o registro",
    "networkError": "Erro de rede",
    "runQuery": "Erro ao executar a consulta"
  },
  "loading": {
    "generic": "Carregando…",
    "rows": "Carregando linhas…",
    "structure": "Carregando estrutura…",
    "tablesExport": "Carregando tabelas…",
    "running": "Executando…"
  },
  "toasts": {
    "engineInstalled": "{label} instalado",
    "noColumnsMetadata": "Nenhum metadado de coluna para esta tabela",
    "recordUpdated": "Registro atualizado",
    "recordCreated": "Registro criado",
    "recordDeleted": "Registro deletado",
    "noTableSelect": "Selecione pelo menos uma tabela",
    "exportDownloaded": "Exportação baixada",
    "selectEngineFirst": "Selecione um mecanismo primeiro",
    "statementExecuted": "Instrução executada"
  },
  "confirm": {
    "deleteRecord": "Deletar este registro? Esta ação não pode ser desfeita.",
    "deleteTitle": "Deletar registro",
    "deleteConfirmText": "Deletar"
  },
  "info": {
    "installing": "Instalando {label}… pode levar alguns minutos.",
    "installed": "{label} instalado. Detectando mecanismo…",
    "pager": "Linhas {from}–{to} (página de {limit})",
    "statementExecuted": "Instrução executada",
    "rowCount": "{count} linha(s)",
    "truncated": "· resultado truncado a {count} linhas"
  },
  "runtime": {
    "createPromptWithPrefix": "O nome deve começar com {prefix} e respeitar sua cota.",
    "createPrompt": "Nome do novo banco de dados no servidor ativo.",
    "invalidPrefix": "O nome deve começar com {prefix}",
    "createError": "Não foi possível criar o banco de dados.",
    "created": "Banco de dados criado."
  },
  "settings": {
    "title": "Configurações de bancos de dados",
    "description": "Preferências do módulo de bancos de dados.",
    "table": "Tabela",
    "pagination": "Paginação",
    "rowsPerPage": "Linhas por página nos resultados de Estrutura e Console.",
    "serverPagination": "A tabela de Registros usa paginação no servidor e não pode ser ajustada aqui.",
    "relatedModules": "Módulos relacionados",
    "hostingQuotas": "Hospedagem e cotas",
    "databaseBackups": "Backups de bancos de dados",
    "sqlFiles": "Arquivos SQL",
    "allowWriteDefault": "Permitir escrita por padrão ao abrir o console",
    "allowWriteHelp": "Aplica-se ao carregar o módulo; você pode alterar isso no console a qualquer momento.",
    "createDatabase": "Criar banco de dados",
    "create": "Criar"
  }
} as const;

export default databases;
