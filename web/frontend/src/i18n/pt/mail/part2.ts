// Auto-split fragment of mail.ts (part 2/2) — data only, keeps <1000 lines.
// Do not reorder keys: the aggregator merges parts by spread in original order.
const mailPart2 = {
  "routing": {
    "labels": {
      "autoRemote": "Detecção Automática de Configuração: Remoto",
      "local": "Servidor de E-mail Local",
      "backup": "Servidor de E-mail de Backup",
      "remote": "Servidor de E-mail Remoto"
    },
    "currentMode": "Atual: {mode}"
  },
  "tracking": {
    "statuses": {
      "success": "Sucesso",
      "deferred": "Adiado",
      "failure": "Falha",
      "inProgress": "Em Progresso",
      "unknown": "Desconhecido"
    },
    "columns": {
      "event": "Evento",
      "fromAddress": "Endereço de Origem",
      "sentTime": "Hora do Envio",
      "spamScore": "Pontuação de Spam",
      "recipient": "Destinatário",
      "domain": "Domínio",
      "id": "ID",
      "result": "Resultado",
      "actions": "Ações"
    },
    "noRecordsFound": "Nenhum registro encontrado.",
    "zeroRecords": "0 registros",
    "matchesZeroRecords": "A pesquisa encontrou 0 registros.",
    "recordsCount": "{count} registros",
    "matchesRecords": "A pesquisa encontrou {count} registros.",
    "detailMeta": "Evento: {event} | ID: {id} | Destinatário: {recipient}"
  },
  "filters": {
    "ruleParts": {
      "from": "De",
      "subject": "Assunto",
      "to": "Para",
      "anyRecipient": "Qualquer Destinatário",
      "reply": "Resposta",
      "body": "Corpo",
      "anyHeader": "Qualquer Cabeçalho",
      "notDelivered": "Não Foi Entregue Anteriormente",
      "errorMessage": "É uma Mensagem de Erro",
      "listId": "ID da Lista",
      "spamStatus": "Status de Spam",
      "spamBar": "Barra de Spam",
      "spamScore": "Pontuação de Spam"
    },
    "matches": {
      "contains": "contém",
      "matchesRegex": "corresponde a regex",
      "doesNotContain": "não contém",
      "equals": "é igual a",
      "beginsWith": "começa com",
      "endsWith": "termina com",
      "doesNotBegin": "não começa com",
      "doesNotEnd": "não termina com",
      "doesNotMatch": "não corresponde a",
      "isAbove": "está acima de (apenas números)",
      "isNotAbove": "não está acima de (apenas números)",
      "isBelow": "está abaixo de (apenas números)",
      "isNotBelow": "não está abaixo de (apenas números)"
    },
    "actions": {
      "discard": "Descartar Mensagem",
      "redirect": "Redirecionar para E-mail",
      "fail": "Falhar com Mensagem",
      "stop": "Parar de Processar Regras",
      "deliverToFolder": "Entregar em Pasta",
      "pipe": "Pipar para um Programa"
    },
    "joinOp": {
      "and": "e",
      "or": "ou"
    },
    "removeBtn": "-"
  },
  "defaultAddress": {
    "currentSetting": {
      "none": "Configuração Atual: (nenhuma)",
      "forward": "Configuração Atual: {destination}",
      "forwardDefault": "(redirecionar)",
      "fail": "Configuração Atual: :fail: {message}"
    },
    "defaultFailMessage": "Nenhum Usuário Aqui"
  },
  "archive": {
    "retentionOptions": {
      "oneMonth": "1 Mês",
      "threeMonths": "3 Meses",
      "sixMonths": "6 Meses",
      "oneYear": "1 Ano",
      "twoYears": "2 Anos",
      "fiveYears": "5 Anos",
      "tenYears": "10 Anos",
      "forever": "Para Sempre",
      "custom": "Personalizado"
    },
    "fields": {
      "incomingEmail": "Mensagens de E-mail Recebidas",
      "outgoingMailingList": "Mensagens de E-mail da Lista de Distribuição Enviadas",
      "outgoingEmail": "Mensagens de E-mail Enviadas"
    }
  },
  "encryption": {
    "neverExpires": "Nunca"
  },
  "actions": {
    "view": "Visualizar",
    "save": "Salvar",
    "clone": "Clonar",
    "copy": "Copiar",
    "delete": "Excluir",
    "edit": "Editar",
    "remove": "Remover"
  },
  "outbound": {
    "cardTitle": "Envio de e-mails do painel (SMTP)",
    "cardDesc": "Conta padrão ou SMTP externo com o qual o painel envia relatórios e e-mails do sistema.",
    "back": "Voltar",
    "intro": "Identidade com a qual o LUXIPANEL envia e-mails do sistema (relatórios de agentes cron, links de aprovação, testes). Pode ser uma conta de e-mail deste servidor ou um SMTP externo que não pertença ao servidor.",
    "modeLabel": "Modo de envio",
    "modeDisabled": "Desativado",
    "modeAccount": "Conta de e-mail do servidor (padrão)",
    "modeExternal": "SMTP externo",
    "accountLabel": "Conta de envio padrão",
    "accountHint": "Usa a credencial SMTP armazenada dessa conta.",
    "hostLabel": "Servidor SMTP",
    "portLabel": "Porta",
    "userLabel": "Usuário",
    "passLabel": "Senha",
    "passPlaceholder": "(sem alterações)",
    "fromLabel": "Remetente (e-mail)",
    "fromNameLabel": "Nome do remetente",
    "secureLabel": "TLS direto (porta 465)",
    "save": "Salvar",
    "testPlaceholder": "destino@exemplo.com",
    "test": "Enviar teste",
    "hostPlaceholder": "smtp.example.com",
    "fromPlaceholder": "sender@example.com",
    "fromNamePlaceholder": "Minha Empresa"
  },
  "table": {
    "status": {
      "active": "Ativo",
      "inactive": "Inativo",
      "disabled": "Desativado"
    },
    "redirect": {
      "columns": {
        "domain": "Domínio",
        "destinos": "Destinos"
      },
      "filters": {
        "searchDomain": "Buscar domínio…"
      },
      "rowActions": {
        "edit": "Editar",
        "delete": "Excluir"
      }
    },
    "encryption": {
      "columns": {
        "keyId": "Key ID",
        "label": "Identidade",
        "keySize": "Tamanho da chave",
        "created": "Criado",
        "expires": "Expira"
      },
      "filters": {
        "searchKey": "Buscar chave…"
      },
      "rowActions": {
        "view": "Ver",
        "delete": "Excluir"
      }
    },
    "accounts": {
      "columns": {
        "address": "Endereço",
        "domain": "Domínio",
        "uso": "Cota / Uso",
        "reenvios": "Encaminhamentos",
        "estado": "Estado"
      },
      "filters": {
        "search": "Buscar endereço ou domínio…",
        "domain": "Domínio",
        "estado": "Estado"
      },
      "rowActions": {
        "edit": "Editar conta",
        "depurarIa": "Limpar com IA",
        "password": "Alterar senha",
        "toggle": "Ativar / Desativar",
        "inbox": "Abrir caixa de correio",
        "signatures": "Gerenciar assinaturas",
        "default": "Usar como padrão",
        "contacts": "Gerenciar contatos",
        "calendars": "Gerenciar calendários",
        "autoresponder": "Gerenciar autorresposta",
        "filters": "Gerenciar filtros",
        "forwards": "Gerenciar encaminhamentos",
        "diskusage": "Gerenciar uso de disco",
        "clone": "Clonar e-mail",
        "delete": "Eliminar conta"
      },
      "quickActions": {
        "bulkForward": "Adicionar encaminhamento",
        "bulkQuota": "Alterar cota",
        "bulkDelete": "Excluir contas"
      }
    },
    "globalFilters": {
      "columns": {
        "name": "Filtro",
        "estado": "Estado",
        "rules": "Regras",
        "actionsCount": "Ações"
      },
      "filters": {
        "search": "Procurar filtro…"
      },
      "rowActions": {
        "edit": "Editar",
        "delete": "Excluir"
      }
    },
    "contacts": {
      "columns": {
        "email": "E-mail",
        "name": "Nome"
      },
      "filters": {
        "searchEmail": "Buscar e-mail…"
      },
      "rowActions": {
        "edit": "Editar",
        "delete": "Excluir"
      }
    },
    "calendars": {
      "columns": {
        "name": "Nome",
        "timezone": "Fuso Horário",
        "estado": "Estado"
      },
      "filters": {
        "search": "Buscar calendário…"
      },
      "rowActions": {
        "edit": "Editar",
        "delete": "Excluir"
      }
    },
    "signatures": {
      "columns": {
        "sender": "Remetente",
        "preview": "Assinatura"
      },
      "filters": {
        "search": "Filtrar e buscar…"
      },
      "rowActions": {
        "edit": "Editar",
        "delete": "Excluir"
      }
    },
    "filters": {
      "columns": {
        "name": "Nome",
        "estado": "Estado"
      },
      "filters": {
        "search": "Procurar filtro…"
      },
      "rowActions": {
        "edit": "Editar",
        "delete": "Excluir"
      }
    }
  },
  "confirm": {
    "bulkDeleteAccounts": "Excluir {count} conta(s) de e-mail? Esta ação não pode ser desfeita.",
    "deleteAccount": "Excluir a conta {address}? Esta ação não pode ser desfeita.",
    "deleteAccountTitle": "Excluir conta",
    "deleteAutoresponder": "Excluir o autorresponder desta conta?",
    "deleteByDate": "Serão excluídos e-mails de {folder} entre {from} e {to}. Continuar?",
    "deleteByDateTitle": "Excluir e-mails por data",
    "deleteCalendar": "Excluir o calendário \"{label}\"?",
    "deleteCalendarTitle": "Excluir calendário",
    "deleteContact": "Excluir o contato \"{label}\"?",
    "deleteContactTitle": "Excluir contato",
    "deleteDomainForward": "Excluir o encaminhamento global de @{domain}?",
    "deleteDomainForwardTitle": "Excluir encaminhamento global",
    "deleteEncryptionKey": "Excluir esta chave de criptografia?",
    "deleteFilter": "Excluir o filtro \"{name}\"?",
    "deleteFilterTitle": "Excluir filtro",
    "deleteForward": "Excluir o encaminhamento para {destination}?",
    "deleteGlobalFilter": "Excluir o filtro global \"{label}\"?",
    "deleteGlobalFilterTitle": "Excluir filtro global",
    "yesDelete": "Sim, excluir"
  },
  "empty": {
    "noDomains": "Sem domínios",
    "noFolders": "Nenhuma pasta encontrada para esta conta.",
    "noOtherAccount": "Nenhuma outra conta disponível"
  },
  "errors": {
    "accountCreateFailed": "Erro ao criar a conta",
    "accountNotFound": "Conta não encontrada",
    "accountUpdateFailed": "Erro ao atualizar a conta",
    "accountUpdatedForwardsFailed": "A conta foi atualizada, mas a atualização dos encaminhamentos falhou",
    "accountsLoadFailed": "Erro ao carregar contas",
    "autoDeleteThresholdInvalid": "Limite de exclusão automática inválido.",
    "autoresponderDeleteFailed": "Não foi possível excluir o autorresponder",
    "autoresponderSaveFailed": "Não foi possível salvar o autorresponder.",
    "calendarDeleteFailed": "Não foi possível excluir o calendário",
    "calendarNotFound": "Calendário não encontrado",
    "calendarSaveFailed": "Não foi possível salvar o calendário.",
    "cloneCreateFailed": "Não foi possível criar a nova conta.",
    "cloneFailed": "Não foi possível clonar o e-mail.",
    "cloneIdResolveFailed": "Conta criada, mas não foi possível resolver seu ID. Tente novamente como 'existente'.",
    "cloneLocalAndDomainRequired": "Informe a parte local e o domínio.",
    "clonePasswordTooShort": "A senha deve ter pelo menos 6 caracteres.",
    "contactDeleteFailed": "Não foi possível excluir o contato",
    "contactNotFound": "Contato não encontrado",
    "contactSaveFailed": "Não foi possível salvar o contato.",
    "copyByRangeFailed": "Não foi possível copiar por intervalo",
    "customScoreInvalid": "Pontuação personalizada inválida.",
    "dateRangeRequired": "Você deve selecionar a data inicial e final",
    "defaultAddressLoadFailed": "Não foi possível carregar o endereço padrão.",
    "defaultAddressSaveFailed": "Não foi possível salvar o endereço padrão.",
    "deleteByRangeFailed": "Não foi possível excluir por intervalo",
    "deleteFailed": "Erro ao excluir",
    "destEmailInvalid": "E-mail de destino inválido",
    "destinationsInvalidFormat": "Um ou mais destinos têm formato inválido.",
    "diskUsageLoadFailed": "Não foi possível carregar o uso de disco",
    "domainForwardDeleteFailed": "Não foi possível excluir o encaminhamento global.",
    "domainForwardsLoadFailed": "Não foi possível carregar os encaminhamentos globais.",
    "domainRedirectSaveFailed": "Não foi possível salvar o encaminhamento global.",
    "domainsLoadFailed": "Não foi possível carregar domínios DNS",
    "filterDeleteFailed": "Não foi possível excluir o filtro",
    "filterNotFound": "Filtro não encontrado",
    "filterSaveFailed": "Não foi possível salvar o filtro.",
    "forwardAlreadyExists": "Já existe um encaminhamento para {destination}",
    "forwardsSaveFailed": "Não foi possível salvar os encaminhamentos no servidor",
    "globalFilterDeleteFailed": "Não foi possível excluir o filtro global.",
    "globalFilterSaveFailed": "Não foi possível salvar o filtro global.",
    "globalFilterTestFailed": "Não foi possível executar o teste.",
    "globalFiltersLoadFailed": "Não foi possível carregar os filtros globais.",
    "indicateTestDestEmail": "Informe o e-mail de destino do teste.",
    "localPartInvalid": "O usuário antes do @ tem um formato inválido.",
    "localPartInvalidNoPoint": "O usuário antes do @ tem um formato inválido",
    "mustAddAtLeastOneAction": "Você deve adicionar pelo menos uma ação.",
    "mustAddAtLeastOneDestEmail": "Você deve adicionar pelo menos um e-mail de destino.",
    "mustAddAtLeastOneRule": "Você deve adicionar pelo menos uma regra.",
    "mustEnterBody": "Você deve inserir o conteúdo da mensagem.",
    "mustEnterSubject": "Você deve inserir um assunto.",
    "mustEnterTestMessage": "Você deve inserir uma mensagem de teste.",
    "mustEnterValidDestEmail": "Você deve inserir um e-mail de destino válido.",
    "mustIndicateCalendarName": "Você deve informar o nome do calendário.",
    "mustIndicateContactEmail": "Você deve informar o e-mail do contato.",
    "mustIndicateFilterName": "Você deve informar um nome de filtro.",
    "mustIndicateName": "Você deve informar um nome.",
    "mustSelectDomain": "Você deve selecionar um domínio.",
    "mustSelectDomainNoPoint": "Você deve selecionar um domínio",
    "noAutoresponderToDelete": "Não há autorresponder para excluir",
    "passwordChangeFailed": "Erro ao alterar a senha",
    "quotaInvalid": "Quota inválida",
    "routingLoadFailed": "Não foi possível carregar a configuração de roteamento de e-mail.",
    "routingSaveFailed": "Não foi possível salvar a configuração de roteamento de e-mail.",
    "saveFailed": "Erro ao salvar",
    "scoreTypesLoadFailed": "Não foi possível carregar o catálogo de tipos de pontuação.",
    "selectDestAccount": "Selecione uma conta de destino",
    "selectValidDomain": "Selecione um domínio válido.",
    "spamFiltersLoadFailed": "Não foi possível carregar os filtros de spam.",
    "spamFiltersSaveFailed": "Não foi possível salvar a configuração dos filtros de spam.",
    "testEmailFailed": "Falha no envio de teste",
    "toggleFailed": "Erro ao alterar o estado",
    "trackDeliveryLoadFailed": "Não foi possível carregar o rastreamento de entrega."
  },
  "labels": {
    "accountColon": "Conta: {address}",
    "activating": "Ativando",
    "cloneStartedBg": "Clonagem iniciada em segundo plano. Avisaremos por notificações quando terminar.",
    "cloning": "Clonando…",
    "currentAccountColon": "Conta atual: {address}",
    "deactivating": "Desativando",
    "destEmailForCount": "E-mail de destino do encaminhamento a adicionar em {count} conta(s):",
    "loading": "Carregando...",
    "newQuotaFor": "Nova quota em MB para {count} conta(s). Use 0 para ilimitado.",
    "no": "Não",
    "noGlobalLimit": "Sem limite global",
    "originColon": "Origem: {addr}",
    "sendingTest": "Enviando teste…",
    "sudoPromptMessage": "Não é possível ler o uso das caixas de correio sem privilégios no servidor. Insira a senha sudo do usuário SSH (é armazenada criptografada no servidor).",
    "to": "para",
    "total": "Total",
    "unlimited": "Ilimitado",
    "yes": "Sim",
    "keepCopy": "Salvar cópia"
  },
  "placeholders": {
    "passwordNoChanges": "•••••••• (sem alterações)",
    "selectDomain": "Selecione o domínio...",
    "value": "Valor",
    "valueIfApplicable": "Valor (se aplicável)"
  },
  "status": {
    "active": "Ativo",
    "deactivated": "Desativado",
    "inactive": "Inativo"
  },
  "titles": {
    "addForward": "Adicionar encaminhamento",
    "changeQuota": "Alterar quota",
    "deleteAccounts": "Excluir contas",
    "deleteAutoresponder": "Excluir autorresponder",
    "deleteEncryptionKey": "Excluir chave",
    "deleteForward": "Excluir encaminhamento"
  },
  "toasts": {
    "accountActivated": "Conta ativada",
    "accountCreated": "Conta criada com sucesso",
    "accountDeactivated": "Conta desativada",
    "accountDeleted": "Conta excluída",
    "accountUpdated": "Conta atualizada ({localPart}@{domain})",
    "archiveDefaultUpdated": "Configuração default de arquivamento atualizada.",
    "archiveDomainUpdated": "Arquivamento atualizado para {domain}.",
    "autoDeleteDisabled": "Exclusão automática desabilitada",
    "autoDeleteEnabled": "Exclusão automática ativada",
    "autoDeleteUpdated": "Exclusão automática atualizada",
    "autoresponderDeleted": "Autorresponder excluído",
    "autoresponderSaved": "Autorresponder salvo",
    "blacklistUpdated": "Lista de bloqueio atualizada",
    "bulkDeletedCount": "{ok}/{count} conta(s) excluída(s)",
    "bulkUpdatedCount": "{ok}/{count} conta(s) atualizada(s)",
    "calculatedScoresUpdated": "Pontuações calculadas atualizadas",
    "calendarCreated": "Calendário criado",
    "calendarDeleted": "Calendário excluído",
    "calendarUpdated": "Calendário atualizado",
    "cloneStarted": "Clonagem iniciada — notificaremos você ao terminar",
    "contactCreated": "Contato criado",
    "contactDeleted": "Contato excluído",
    "contactUpdated": "Contato atualizado",
    "defaultAddressUpdated": "Endereço padrão atualizado para @{domain}",
    "defaultInboxSet": "{address} agora é o e-mail padrão",
    "domainForwardDeleted": "Encaminhamento global de @{domain} excluído",
    "emailRoutingUpdated": "Roteamento de e-mail atualizado para @{domain}",
    "emailsCopied": "Copiados {count} e-mails de {folder}",
    "emailsDeleted": "Excluídos {count} e-mails de {folder}",
    "filterCreated": "Filtro criado",
    "filterDeleted": "Filtro excluído",
    "filterUpdated": "Filtro atualizado",
    "forwardAddedCount": "Encaminhamento adicionado em {ok}/{count} conta(s)",
    "forwardDeleted": "Encaminhamento excluído",
    "forwardsUpdated": "Encaminhamentos atualizados",
    "globalFilterCreated": "Filtro global criado",
    "globalFilterDeleted": "Filtro global excluído",
    "globalFilterUpdated": "Filtro global atualizado",
    "globalRedirectSaved": "Encaminhamento global salvo para @{domain}",
    "keyDeleted": "Chave excluída.",
    "keyGenerated": "Chave gerada.",
    "passwordUpdated": "Senha atualizada",
    "publicKeyImported": "Chave pública importada.",
    "settingsSaved": "Configuração salva ✓",
    "spamBoxDisabled": "Spam Box desabilitado",
    "spamBoxEnabled": "Caixa de spam ativada",
    "spamBoxUpdated": "Spam Box atualizado",
    "spamFiltersDisabled": "Filtros de spam desabilitados",
    "spamFiltersEnabled": "Filtros de spam ativados",
    "spamThresholdUpdated": "Limite de spam atualizado",
    "testEmailSent": "E-mail de teste enviado ✓",
    "whitelistUpdated": "Lista de permissão atualizada"
  },
  "signaturesDrawer": {
    "title": "Assinaturas",
    "addSignature": "Adicionar assinatura",
    "close": "Fechar",
    "tableTitle": "assinaturas"
  },
  "dataTableTitles": {
    "rules": "regras",
    "publicKeys": "chaves públicas",
    "privateKeys": "chaves privadas",
    "accounts": "contas",
    "globalFilters": "filtros globais",
    "contacts": "contatos",
    "calendars": "calendários",
    "filters": "filtros"
  },
  "trackColumns": {
    "event": "Evento",
    "fromAddress": "Endereço de origem",
    "sentTime": "Hora de envio",
    "spamScore": "Pontuação de spam",
    "recipient": "Destinatário",
    "domain": "Domínio",
    "queueId": "ID",
    "result": "Resultado",
    "actions": "Ações"
  }
} as const;

export default mailPart2;
