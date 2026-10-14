const backups = {
  "pageTitle": "Backups",
  "settings": {
    "title": "Configuração de backup",
    "description": "Destino e preferências para o servidor ligado.",
    "sections": "Secções das definições",
    "localHelp": "As cópias de segurança locais deste servidor são guardadas aqui.",
    "changeDirWarning": "Mudar a pasta eliminará as cópias locais anteriores após confirmação.",
    "retentionHelp": "Para cópias manuais e novos agendamentos. Os agendamentos existentes mantêm o seu próprio limite.",
    "save": "Guardar alterações",
    "lastSuccess": "Última cópia de segurança bem-sucedida",
    "localCopies": "Cópias de segurança locais",
    "activeSchedules": "Agendamentos ativos",
    "advancedCron": "Expressão Cron personalizada",
    "loading": "A carregar definições…",
    "loadError": "Não foi possível carregar as definições deste servidor.",
    "pending": "Alterações por guardar.",
    "countError": "Escolha entre 1 e 365 cópias de segurança.",
    "saving": "A guardar…",
    "saved": "Definições guardadas.",
    "previewError": "Não foi possível inspecionar a pasta.",
    "destinationNotEmpty": "A nova pasta já contém cópias de segurança LUXIPANEL.",
    "changeConfirm": "Serão eliminadas {count} cópias locais em {path}. As cópias S3/R2 serão mantidas. Mudar a pasta?",
    "changeTitle": "Mudar pasta de cópias de segurança",
    "changeError": "Não foi possível mudar a pasta.",
    "tables": "Tabelas",
    "localHeading": "Destino local",
    "overview": "Estado das cópias",
    "targetChanged": "O servidor mudou; reveja as respetivas definições."
  },
  "status": {
    "completed": "Concluída",
    "failed": "Falhou",
    "running": "Em curso"
  },
  "header": {
    "heading": "Cópias de segurança",
    "subheading": "Proteja ficheiros, bases de dados, correio e configurações do servidor.",
    "btnBackupNow": "Backup agora"
  },
  "configCard": {
    "title": "Configuração de backups",
    "subtitle": "Diretório local e armazenamento remoto.",
    "labelLocalDir": "Diretório de backups local",
    "placeholderLocalDir": "/var/backups/luxipanel",
    "labelRetentionDefault": "Cópias locais a manter por padrão",
    "s3Section": "S3 / Cloudflare R2",
    "labelEndpoint": "Endpoint",
    "labelBucket": "Bucket",
    "labelAccessKeyId": "ID da chave de acesso",
    "labelSecretAccessKey": "Chave de acesso secreta",
    "btnBrowse": "Procurar",
    "tabLocal": "Local",
    "tabCloud": "Cloud"
  },
  "pathBrowserDialog": {
    "title": "Selecionar pasta",
    "btnUp": "Acima",
    "btnCancel": "Cancelar",
    "btnSelect": "Usar esta pasta"
  },
  "backupSources": {
    "title": "O que salvaguardar",
    "scopeFull": "Servidor completo (curado)",
    "scopeFullHint": "Bases de dados, correio, configuração do painel e /etc /home /var/www /root",
    "scopeCustom": "Personalizado",
    "labelDatabases": "Bases de dados",
    "dbAll": "Todos",
    "dbPick": "Escolher…",
    "dbChoose": "Escolher bases de dados",
    "dbNone": "Nenhuma selecionada",
    "labelMail": "Correio (vmail + Postfix/Dovecot)",
    "labelPanelConfig": "Configuração do painel",
    "foldersTitle": "Pastas",
    "addFolder": "Adicionar pasta",
    "noFolders": "Sem pastas selecionadas"
  },
  "dbPickerDialog": {
    "title": "Selecionar bases de dados",
    "loading": "A carregar…",
    "btnCancel": "Cancelar",
    "btnSelect": "Usar seleção",
    "btnRetry": "Tentar novamente",
    "unavailableSelection": "Um banco de dados selecionado não está mais disponível. Revise a seleção."
  },
  "storagesSection": {
    "subtitle": "Destinos na nuvem para os seus backups (S3 / Cloudflare R2).",
    "tableTitle": "storages",
    "btnNew": "Novo storage"
  },
  "storageDialog": {
    "titleNew": "Novo storage cloud",
    "titleEdit": "Editar armazenamento na nuvem",
    "labelName": "Nome",
    "placeholderName": "Meu bucket R2",
    "labelProvider": "Fornecedor",
    "optS3": "Amazon S3",
    "optR2": "Cloudflare R2",
    "labelBucket": "Bucket",
    "labelPrefix": "Prefixo (pasta)",
    "placeholderPrefix": "backups/",
    "labelEndpoint": "Endpoint",
    "labelRegion": "Região",
    "labelAccessKey": "ID da Chave de Acesso",
    "labelSecret": "Chave de Acesso Secreta",
    "secretKeepHint": "Deixe em branco para manter o segredo atual.",
    "btnCancel": "Cancelar",
    "btnSave": "Guardar",
    "usingCentralCred": "Usando a credencial central de Configurações → Credenciais (defina apenas o bucket).",
    "credRequired": "Não há credencial de {provider} configurada. Registre-a em Configurações → Credenciais para usar este destino.",
    "credRequiredCta": "Ir para Configurações → Credenciais"
  },
  "progress": {
    "creating": "A criar a cópia… Isto pode demorar vários minutos."
  },
  "historySection": {
    "title": "Histórico de backups",
    "tableTitle": "backups",
    "count": "{count} cópias",
    "countPartial": "Mostrando {shown} de {total} cópias"
  },
  "schedulesSection": {
    "title": "Programações",
    "btnNew": "Nova",
    "loading": "A carregar...",
    "active": "Ativa",
    "paused": "Pausada",
    "copies": "cópias",
    "pause": "Pausar",
    "enable": "Ativar",
    "edit": "Editar",
    "delete": "Eliminar"
  },
  "backupDialog": {
    "title": "Criar backup manual",
    "labelName": "Rótulo",
    "placeholderName": "pré-atualização",
    "labelStorage": "Armazenamento",
    "optionLocal": "Local",
    "optionS3": "AWS S3",
    "optionR2": "Cloudflare R2",
    "labelIncludeDb": "Incluir dump de PostgreSQL",
    "sourcesTitle": "O que incluir no backup",
    "labelIncludeDatabases": "Bases de dados (MySQL/MariaDB + PostgreSQL)",
    "labelIncludeMail": "Contas de email (armazenamento de correio + config)",
    "labelIncludePanelConfig": "Configuração do LuxiPanel",
    "btnCancel": "Cancelar",
    "btnStart": "Iniciar backup"
  },
  "scheduleDialog": {
    "title": "Agendar backup",
    "labelName": "Nome",
    "placeholderName": "Backup semanal",
    "labelSchedule": "Horário (cron)",
    "placeholderSchedule": "0 3 * * 0",
    "labelStorage": "Armazenamento",
    "optionLocal": "Local",
    "optionS3": "S3",
    "optionR2": "R2",
    "labelRetention": "Cópias locais a manter",
    "labelFrequency": "Frequência",
    "optHourly": "A cada hora",
    "optDaily": "Diário",
    "optWeekly": "Semanal",
    "optMonthly": "Mensal",
    "labelTime": "Hora",
    "labelWeekday": "Dia da semana",
    "labelMonthday": "Dia do mês",
    "cronPreview": "Equivalente a",
    "cronExample": "0 3 * * *",
    "weekdays": [
      "Domingo",
      "Segunda-feira",
      "Terça-feira",
      "Quarta-feira",
      "Quinta-feira",
      "Sexta-feira",
      "Sábado"
    ],
    "btnCancel": "Cancelar",
    "btnSave": "Guardar",
    "localRetentionHint": "Serão mantidas as cópias locais mais recentes deste agendamento.",
    "cloudRetentionHint": "Configure a retenção S3/R2 no fornecedor de nuvem.",
    "editTitle": "Editar agendamento"
  },
  "toasts": {
    "errorSaveSettings": "Erro ao salvar configuração de backups",
    "preparingDownload": "Preparando download…",
    "backupDeleted": "Backup excluído",
    "backupsDeleted": "Backups excluídos",
    "scheduleDeleted": "Agendamento excluído",
    "errorDelete": "Erro ao excluir",
    "errorCreateBackup": "Erro ao criar backup",
    "backupStarted": "Backup iniciado",
    "backupCompleted": "Backup concluído",
    "backupStillRunning": "O backup ainda está em processo…",
    "scheduleCreated": "Agendamento criado",
    "errorCreateSchedule": "Erro ao criar agendamento",
    "storageDeleted": "Armazenamento excluído",
    "storageUpdated": "Armazenamento atualizado",
    "storageCreated": "Armazenamento criado",
    "errorSaveStorage": "Erro ao salvar armazenamento",
    "recordRemoved": "Registo removido do histórico"
  },
  "errors": {
    "listPathFailed": "Não foi possível listar este caminho (permissões?).",
    "listDbFailed": "Não foi possível listar os bancos de dados.",
    "downloadFailed": "Não foi possível descarregar o backup",
    "backupErrorDetail": "Erro: {error}"
  },
  "empty": {
    "noSubfolders": "(sem subpastas)",
    "noDbEngines": "Nenhum mecanismo de BD ativo detectado.",
    "noDatabases": "(sem bancos de dados)",
    "noneSelected": "Nenhum selecionado",
    "noSchedules": "Sem agendamentos"
  },
  "labels": {
    "loading": "Carregando…",
    "fullServer": "servidor completo",
    "editStorage": "Editar armazenamento",
    "newStorage": "Novo armazenamento"
  },
  "confirm": {
    "deleteBackup": "Excluir o backup \"{label}\"?",
    "deleteBackupTitle": "Excluir backup",
    "deleteBulkBackup": "Excluir {count} backup(s) selecionado(s)?",
    "deleteBulkBackupTitle": "Excluir backups",
    "deleteSchedule": "Excluir este agendamento?",
    "deleteScheduleTitle": "Excluir agendamento",
    "deleteStorage": "Excluir o armazenamento \"{name}\"?",
    "deleteStorageTitle": "Excluir armazenamento",
    "removeRecord": "Remover «{label}» do histórico? O objeto na nuvem será mantido.",
    "removeRecordTitle": "Remover registo",
    "cloudBulkNote": "Os objetos S3/R2 serão mantidos."
  },
  "table": {
    "columns": {
      "label": "Rótulo",
      "status": "Estado",
      "size": "Tamanho",
      "storage": "Armazenamento",
      "fecha": "Data"
    },
    "storagesColumns": {
      "name": "Nome",
      "provider": "Provedor",
      "bucket": "Bucket",
      "endpoint": "Endpoint"
    },
    "filters": {
      "searchBackupLabel": "Buscar rótulo...",
      "filterBackupStorage": "Armazenamento",
      "searchStorageName": "Buscar nome...",
      "filterStorageProvider": "Provedor"
    },
    "rowActions": {
      "download": "Transferir",
      "removeRecord": "Remover do histórico",
      "details": "Ver erro",
      "delete": "Excluir",
      "refresh": "Atualizar estado"
    },
    "quickActions": {
      "deleteSelected": "Excluir selecionados"
    },
    "storagesRowActions": {
      "edit": "Editar",
      "delete": "Excluir"
    }
  }
} as const;

export default backups;
