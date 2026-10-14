const webhooks = {
  "pageTitle": "Webhooks e API Keys",
  "tabs": {
    "webhooks": "Webhooks",
    "apiKeys": "chaves API",
    "discovered": "Detectados"
  },
  "webhooksPanel": {
    "description": "Notificações HTTP de saída com assinatura HMAC",
    "btnNew": "Novo webhook"
  },
  "apiKeysPanel": {
    "description": "Acesso programático com tokens permanentes",
    "btnNew": "Nova API key"
  },
  "newKeyReveal": {
    "message": "API Key criada — copie agora, não será exibida novamente",
    "btnCopy": "Copiar"
  },
  "webhookDialog": {
    "placeholderUrl": "https://exemplo.com/webhook",
    "title": "Novo webhook",
    "labelUrl": "URL do endpoint",
    "labelEvents": "Eventos a escutar",
    "labelEnabled": "Webhook ativo",
    "btnCancel": "Cancelar",
    "btnSave": "Guardar"
  },
  "apiKeyDialog": {
    "placeholderName": "Minha integração",
    "title": "Nova API Key",
    "labelName": "Nome descritivo",
    "labelExpires": "Expira (opcional)",
    "btnCancel": "Cancelar",
    "btnCreate": "Criar key"
  },
  "discovered": {
    "description": "Webhooks detetados no servidor (Git, nginx, cron, systemd, configurações e projetos)",
    "btnRescan": "Reanalisar",
    "scanning": "A analisar o servidor…",
    "empty": "Nenhum webhook detetado no servidor",
    "cols": {
      "source": "Origem",
      "name": "Nome",
      "target": "Destino",
      "location": "Localização",
      "estado": "Estado"
    },
    "filters": {
      "searchTarget": "Procurar destino…",
      "source": "Origem"
    },
    "sources": {
      "sidecar": "Painel",
      "git-hook": "Git hook",
      "nginx": "Nginx",
      "cron": "Cron",
      "systemd": "systemd",
      "config": "Configuração",
      "project": "Projeto"
    },
    "status": {
      "enabled": "Ativo",
      "disabled": "Inativo",
      "unknown": "—"
    },
    "actions": {
      "detail": "Ver detalhe",
      "delete": "Eliminar"
    },
    "detail": {
      "title": "Detalhe do webhook detetado",
      "source": "Origem",
      "target": "Destino",
      "location": "Localização",
      "info": "Informação",
      "raw": "Configuração",
      "managedNote": "Este webhook é gerido pelo painel",
      "readonlyNote": "Apenas leitura: faça a gestão a partir do módulo correspondente",
      "btnClose": "Fechar"
    },
    "confirm": {
      "deleteTitle": "Eliminar webhook detetado",
      "deleteBody": "Eliminar \"{name}\"? Isto modifica o ficheiro no servidor.",
      "deleteBtn": "Sim, eliminar"
    },
    "toasts": {
      "deleted": "Eliminado",
      "errorDeleting": "Não foi possível eliminar",
      "scanComplete": "Análise concluída: {count}",
      "notManageable": "Faça a gestão a partir do módulo correspondente"
    }
  },
  "labels": {
    "statusFailing": "Falhando",
    "statusActive": "Ativo",
    "statusPaused": "Pausado",
    "newWebhookTitle": "Novo webhook",
    "noExpiry": "Sem expiração"
  },
  "confirm": {
    "rotateSecretBody": "Rotacionar o segredo deste webhook? Você precisará atualizar o receptor.",
    "rotateSecretTitle": "Rotacionar segredo",
    "rotateSecretBtn": "Sim, rotacionar",
    "deleteWebhookBody": "Excluir este webhook?",
    "deleteWebhookTitle": "Excluir webhook",
    "revokeKeyBody": "Revogar a chave API \"{name}\"?",
    "revokeKeyTitle": "Revogar chave API",
    "revokeKeyBtn": "Sim, revogar"
  },
  "toasts": {
    "secretRotated": "Segredo rotacionado",
    "errorRotating": "Erro ao rotacionar",
    "webhookDeleted": "Webhook excluído",
    "errorDeleting": "Erro ao excluir",
    "webhookUpdated": "Webhook atualizado",
    "webhookCreated": "Webhook criado",
    "errorSaving": "Erro ao salvar",
    "keyRevoked": "Chave revogada",
    "errorRevoking": "Erro ao revogar",
    "copiedToClipboard": "Copiado para a área de transferência",
    "errorCreatingKey": "Erro ao criar a chave"
  },
  "categories": {
    "receiveData": "Receber dados",
    "mailhook": "Mailhook",
    "response": "Resposta do webhook",
    "soon": "Em breve",
    "soonDesc": "A configuração e a varredura desta categoria serão definidas em uma fase posterior."
  },
  "gateway": {
    "description": "Endpoints que o painel hospeda para receber dados de entrada (estilo Make.com). Autenticação por chave de API (x-make-apikey), restrição por IP e validação de estrutura de dados.",
    "btnNew": "Novo webhook",
    "detectedTitle": "Receptores detectados no servidor",
    "urlReveal": "URL do webhook — envie as solicitações aqui",
    "cols": {
      "name": "Nome",
      "auth": "Autenticação",
      "recibidos": "Recebidos",
      "ultima": "Último",
      "estado": "Estado",
      "estadoActive": "Ativo",
      "estadoPaused": "Pausado"
    },
    "dialog": {
      "titleNew": "Criar um webhook",
      "titleEdit": "Editar webhook",
      "name": "Nome do webhook",
      "namePlaceholder": "Meu webhook gateway",
      "nameHint": "Deve ter entre 1 e 128 caracteres.",
      "apiAuth": "Autenticação por chave API",
      "apiAuthHint": "Envia a chave API no cabeçalho x-make-apikey. Adicione uma ou mais; se alguma corresponder, o acesso é concedido.",
      "apiKeyName": "Nome",
      "apiKeyValue": "Valor da chave API",
      "apiKeyKeep": "(guardada — deixe vazio para manter)",
      "addApiKey": "Adicionar chave API",
      "ipTitle": "Restrições de IP",
      "ipHint": "Lista de IPs separadas por vírgula. Você pode usar notação CIDR. Vazio = sem verificação.",
      "dataStructure": "Estrutura de dados",
      "dataStructureHint": "Validação dos dados de entrada. Vazio = aceitos sem validação.",
      "dsValidate": "Validar estrutura de dados",
      "dsStrict": "Rigoroso (rejeitar campos não especificados)",
      "dsFieldName": "Nome",
      "dsFieldDesc": "Descrição",
      "dsFieldType": "Tipo",
      "dsFieldDefault": "Valor padrão",
      "dsFieldRequired": "Obrigatório",
      "dsFieldMultiline": "Multilinha",
      "addItem": "Adicionar campo",
      "getHeaders": "Obter cabeçalhos da requisição",
      "getHeadersHint": "Os cabeçalhos serão adicionados ao corpo.",
      "getMethod": "Obter método HTTP",
      "getMethodHint": "O método (verbo) será adicionado ao corpo.",
      "jsonPassthrough": "Guardar JSON como texto",
      "jsonPassthroughHint": "Se ativado, o payload JSON é salvo como string.",
      "enabled": "Webhook ativo",
      "advanced": "Configurações avançadas",
      "btnCancel": "Cancelar",
      "btnSave": "Guardar"
    },
    "payloads": {
      "title": "Payloads recebidos",
      "empty": "Nenhum payload recebido ainda.",
      "btnClose": "Fechar"
    },
    "confirm": {
      "deleteTitle": "Eliminar webhook",
      "deleteBody": "Eliminar o webhook \"{name}\"? Os payloads armazenados serão perdidos.",
      "deleteBtn": "Sim, eliminar"
    },
    "toasts": {
      "created": "Webhook criado",
      "updated": "Webhook atualizado",
      "deleted": "Webhook eliminado",
      "copied": "URL copiada",
      "error": "Erro ao salvar"
    }
  },
  "table": {
    "gateway": {
      "columns": {
        "name": "Nome",
        "auth": "Auth",
        "recibidos": "Recebidos",
        "ultima": "Última",
        "estado": "Estado"
      },
      "filters": {
        "searchName": "Buscar nome…",
        "estado": "Estado"
      },
      "rowActions": {
        "copy": "Copiar URL",
        "payloads": "Ver payloads",
        "edit": "Editar",
        "delete": "Excluir"
      },
      "options": {
        "statusActive": "Ativo",
        "statusPaused": "Pausado"
      }
    },
    "webhooks": {
      "columns": {
        "url": "URL",
        "eventos": "Eventos",
        "estado": "Estado"
      },
      "filters": {
        "searchUrl": "Buscar URL…",
        "estado": "Estado"
      },
      "rowActions": {
        "regenerate": "Rotacionar segredo",
        "delete": "Excluir"
      },
      "options": {
        "statusActive": "Ativo",
        "statusPaused": "Pausado",
        "statusFailing": "Falhando"
      }
    },
    "apiKeys": {
      "columns": {
        "name": "Nome",
        "prefix": "Prefixo",
        "creada": "Criada",
        "expira": "Expira"
      },
      "filters": {
        "searchName": "Buscar nome…"
      },
      "rowActions": {
        "revoke": "Revogar"
      }
    },
    "discovered": {
      "columns": {
        "origen": "Origem",
        "name": "Nome",
        "target": "Destino",
        "location": "Localização",
        "estado": "Estado"
      },
      "filters": {
        "searchTarget": "Procurar destino…",
        "origen": "Origem"
      },
      "rowActions": {
        "detail": "Ver detalhe",
        "delete": "Excluir"
      },
      "options": {
        "panel": "Painel",
        "gitHook": "Git hook",
        "nginx": "Nginx",
        "cron": "Cron",
        "systemd": "systemd",
        "config": "Configuração",
        "proyecto": "Projeto"
      }
    }
  },
  "runtime": {
    "testDelivered": "Teste entregue com sucesso.",
    "testFailed": "A entrega de teste falhou.",
    "loadingDeliveries": "Carregando entregas…",
    "loadDeliveriesError": "Não foi possível carregar as entregas.",
    "noDeliveries": "Ainda não há entregas registradas.",
    "delivered": "Entregue",
    "failed": "Falhou",
    "attempts": "Tentativas: {count}",
    "selectEvent": "Selecione pelo menos um evento."
  },
  "settingsUi": {
    "title": "Configurações de Webhooks",
    "description": "Paginação e ações visíveis das tabelas de Webhooks.",
    "gateway": "Gateway",
    "webhooks": "Webhooks",
    "signingSecret": "Segredo de assinatura · copie agora",
    "signingSecretHint": "Exibido apenas uma vez. Configure-o no destinatário para verificar X-Luxipanel-Signature.",
    "recentDeliveries": "Entregas recentes"
  }
} as const;

export default webhooks;
