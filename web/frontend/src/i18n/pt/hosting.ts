const hosting = {
  "pageTitle": "Hosting partilhado",
  "pageSubtitle": "Gerencie as contas de hosting dos seus clientes · WHM-style multi-tenant",
  "btnNewAccount": "Nova conta",
  "options": {
    "planBasic": "Básico",
    "planPro": "Pro",
    "planBusiness": "Empresarial",
    "planCustom": "Personalizado"
  },
  "stats": {
    "total": "Total de contas",
    "active": "Ativas",
    "suspended": "Suspensas",
    "terminated": "Encerradas",
    "title": "Uso de {username}",
    "disk": "Disco (MB)",
    "domains": "Domínios",
    "emails": "Contas de e-mail",
    "databases": "Bancos de dados",
    "subusers": "Subusuários",
    "bandwidth": "Largura de banda (MB)",
    "percentUsed": "% usado",
    "method": "Método de medição",
    "methodDu": "Estimativa por du (best-effort)",
    "methodQuotaTools": "Cota do sistema (quota-tools)"
  },
  "tableTitle": "contas",
  "modal": {
    "titleNew": "Nova conta de hosting",
    "tabs": {
      "account": "Conta",
      "resources": "Recursos",
      "security": "Módulos e segurança"
    },
    "labelUsername": "Utilizador *",
    "labelPassword": "Senha *",
    "labelName": "Nome",
    "labelEmail": "Email",
    "labelPlan": "Plano",
    "resourcesTitle": "Limites de recursos",
    "labelDisk": "Disco (MB)",
    "labelBandwidth": "Largura de banda (MB)",
    "labelDomains": "Domínios",
    "labelEmails": "Contas de email",
    "labelNotes": "Notas internas",
    "btnCancel": "Cancelar",
    "btnCreate": "Criar conta",
    "hintUsername": "Apenas minúsculas, números, - e _",
    "phUsername": "clienteexemplo",
    "phPassword": "mínimo 8 caracteres",
    "phName": "Empresa S.A.",
    "phEmail": "admin@empresa.com",
    "phNotes": "Observações opcionais…",
    "labelStatus": "Estado",
    "labelTenantGroup": "Grupo do tenant",
    "labelHomeRoot": "Pasta raiz (home)",
    "hintTenantGroup": "Grupo Linux dedicado da conta (somente leitura).",
    "hintHomeRoot": "Raiz do tenant no VPS (somente leitura).",
    "labelDiskQuotaMb": "Cota de disco (MB)",
    "labelBandwidthQuotaMb": "Cota de banda (MB)",
    "labelMaxDomains": "Máx. domínios",
    "labelMaxEmailAccounts": "Máx. contas de e-mail",
    "labelMaxDatabases": "Máx. bancos de dados",
    "labelMaxSubUsers": "Máx. subusuários",
    "labelAllowedModules": "Módulos permitidos",
    "labelJailEnabled": "Isolar shell (chroot)",
    "hintJailEnabled": "Confina o terminal/SSH desta conta à sua pasta (jaula chroot).",
    "modulesLoading": "Carregando módulos…",
    "labelExpiresAt": "Data de expiração",
    "hintExpiresAt": "Deixe em branco para sem expiração",
    "labelModules": "Módulos permitidos",
    "hintModules": "Define os módulos do painel aos quais este cliente terá acesso.",
    "labelDatabases": "Bancos de dados",
    "labelSubUsers": "Usuários secundários",
    "labelJail": "Isolar shell (chroot)",
    "hintJail": "Confina o terminal/SSH desta conta à sua pasta (jaula chroot).",
    "titleEdit": "Editar: {username}"
  },
  "pwdModal": {
    "title": "Alterar senha",
    "labelNew": "Nova senha",
    "phPassword": "mínimo 8 caracteres",
    "btnCancel": "Cancelar",
    "btnChange": "Alterar"
  },
  "apiPageTitle": "Documentação API de Hosting",
  "apiSubtitle": "Gerenciamento automatizado de contas de hosting compartilhado",
  "apiIntro": "A Reseller API permite automatizar a criação, atualização, suspensão e exclusão de contas de hosting a partir de qualquer sistema externo — sua própria plataforma de faturamento, WHMCS, scripts Bash, integrações com Zapier, etc. É compatível com qualquer linguagem ou ferramenta capaz de fazer requisições HTTP.",
  "toc": {
    "label": "Conteúdo",
    "items": [
      "1. Autenticação",
      "2. Isolamento e segurança",
      "3. Endpoints disponíveis",
      "4. Criar conta",
      "5. Listar contas",
      "6. Obter conta",
      "7. Atualizar conta",
      "8. Suspender / Reativar",
      "9. Alterar senha",
      "10. Estatísticas de conta",
      "11. Eliminar conta",
      "12. Login de conta de hospedagem",
      "13. Códigos de erro",
      "14. Exemplos completos"
    ]
  },
  "auth": {
    "title": "Autenticação",
    "intro": "Todos os endpoints da Reseller API aceitam dois métodos de autenticação:",
    "apiKeyTitle": "API Key (recomendado para automação)",
    "apiKeyDesc": "Gere uma API key em Painel → Webhooks → API Keys. Envie-a no header Authorization:",
    "sessionTitle": "Sessão de admin (do painel)",
    "sessionDesc": "Se estiver fazendo requisições a partir do próprio painel LuxiPanel (por exemplo, via JavaScript no browser), seu cookie de sessão de administrador é aceito automaticamente.",
    "warningTitle": "Importante:",
    "warningText": "Nunca exponha sua API key em código do lado cliente (JavaScript no navegador, aplicativos móveis, etc.). Use-a exclusivamente em servidores ou ambientes privados."
  },
  "isolation": {
    "title": "Isolamento e segurança",
    "intro": "Cada conta de hosting é um ambiente completamente isolado. Isso garante que nenhum cliente pode ver ou modificar os recursos de outro, independentemente de tentar fazê-lo via painel web, API, console SSH ou qualquer outro vetor.",
    "features": [
      {
        "title": "Dados isolados",
        "desc": "Caixas de correio, domínios, DNS, SSL e backups estão vinculados ao tenant_id de cada conta. As consultas SQL nunca cruzam entre tenants."
      },
      {
        "title": "Sistema de arquivos",
        "desc": "Cada conta tem o seu próprio diretório home (/home/username). O explorador de arquivos e o console estão restritos a esse diretório."
      },
      {
        "title": "Sessões independentes",
        "desc": "O JWT de uma conta de hospedagem inclui o seu tenantId. O backend rejeita qualquer requisição que tente acessar recursos fora desse escopo."
      }
    ]
  },
  "endpoints": {
    "title": "Endpoints disponíveis",
    "colMethod": "Método",
    "colPath": "Caminho",
    "colDesc": "Descrição",
    "colAuth": "Auth",
    "rows": [
      [
        "POST",
        "/api/hosting/accounts",
        "Criar conta de hospedagem",
        "Admin / API Key"
      ],
      [
        "GET",
        "/api/hosting/accounts",
        "Listar contas (paginado)",
        "Admin / API Key"
      ],
      [
        "GET",
        "/api/hosting/accounts/:id",
        "Obter uma única conta",
        "Admin / API Key"
      ],
      [
        "PUT",
        "/api/hosting/accounts/:id",
        "Atualizar conta",
        "Admin / API Key"
      ],
      [
        "DELETE",
        "/api/hosting/accounts/:id",
        "Excluir conta e todos os seus dados",
        "Admin / API Key"
      ],
      [
        "POST",
        "/api/hosting/accounts/:id/suspend",
        "Suspender conta",
        "Admin / API Key"
      ],
      [
        "POST",
        "/api/hosting/accounts/:id/unsuspend",
        "Reativar conta suspensa",
        "Admin / API Key"
      ],
      [
        "POST",
        "/api/hosting/accounts/:id/change-password",
        "Alterar senha",
        "Admin / API Key"
      ],
      [
        "GET",
        "/api/hosting/accounts/:id/stats",
        "Estatísticas de uso",
        "Admin / API Key"
      ],
      [
        "POST",
        "/api/hosting/auth/login",
        "Login da conta de hospedagem",
        "Público"
      ],
      [
        "POST",
        "/api/hosting/auth/logout",
        "Logout de hospedagem",
        "Sessão de hospedagem"
      ]
    ]
  },
  "create": {
    "title": "Criar conta",
    "labelBody": "Body (JSON)",
    "labelResp": "Resposta 201"
  },
  "list": {
    "title": "Listar contas",
    "labelParams": "Parâmetros de query",
    "colParam": "Parâmetro",
    "colType": "Tipo",
    "colDefault": "Padrão",
    "colDesc": "Descrição",
    "labelResp": "Resposta 200",
    "params": [
      [
        "page",
        "integer",
        "1",
        "Página atual"
      ],
      [
        "limit",
        "integer",
        "20",
        "Resultados por página (máx. 100)"
      ],
      [
        "search",
        "string",
        "—",
        "Pesquisar em username, displayName, email"
      ],
      [
        "status",
        "string",
        "—",
        "active | suspended | terminated"
      ]
    ]
  },
  "compactEndpoints": [
    {
      "id": "get",
      "num": "6",
      "title": "Obter conta",
      "method": "GET",
      "path": "/api/hosting/accounts/:id",
      "note": "Retorna o objeto da conta sem o campo passwordHash."
    },
    {
      "id": "update",
      "num": "7",
      "title": "Atualizar conta",
      "method": "PUT",
      "path": "/api/hosting/accounts/:id",
      "note": "Aceita os mesmos campos que a criação (exceto username e password). Apenas os campos enviados são atualizados."
    },
    {
      "id": "suspend",
      "num": "8",
      "title": "Suspender / Reativar",
      "method": "POST",
      "path": "/api/hosting/accounts/:id/suspend  |  /unsuspend",
      "note": "Suspender bloqueia o acesso do cliente imediatamente. Reativar restaura o status para 'active'. Nenhum corpo é necessário."
    },
    {
      "id": "password",
      "num": "9",
      "title": "Alterar senha",
      "method": "POST",
      "path": "/api/hosting/accounts/:id/change-password",
      "note": "Body: {\"password\": \"NewPass123!\"} — mínimo de 8 caracteres."
    },
    {
      "id": "stats",
      "num": "10",
      "title": "Estatísticas de uso",
      "method": "GET",
      "path": "/api/hosting/accounts/:id/stats",
      "note": "Retorna as cotas configuradas e o uso atual de disco, largura de banda, domínios ativos e contas de e-mail."
    },
    {
      "id": "delete",
      "num": "11",
      "title": "Excluir conta",
      "method": "DELETE",
      "path": "/api/hosting/accounts/:id",
      "note": "⚠️ Irreversível. Exclui a conta e, via ON DELETE CASCADE, todos os seus recursos: caixas de correio, domínios, DNS, SSL e backups."
    }
  ],
  "login": {
    "title": "Login de conta hosting",
    "badgePublic": "· Público",
    "desc": "O cliente insere suas credenciais no painel de login. Se forem válidas, uma sessão do tipo kind: \"hosting\" é criada, restringindo o acesso exclusivamente aos recursos de sua conta.",
    "labelBody": "Body",
    "labelResp": "Resposta 200"
  },
  "errors": {
    "title": "Códigos de erro",
    "intro": "Todos os erros seguem o mesmo envelope:",
    "colHttp": "HTTP",
    "colCode": "Código",
    "colDesc": "Descrição",
    "rows": [
      [
        "400",
        "VALIDATION_ERROR",
        "Campos inválidos ou ausentes"
      ],
      [
        "401",
        "AUTH_ERROR",
        "API key inválida, expirada ou ausente"
      ],
      [
        "403",
        "FORBIDDEN",
        "Você não tem permissão para esta operação"
      ],
      [
        "404",
        "NOT_FOUND",
        "A conta solicitada não existe"
      ],
      [
        "409",
        "CONFLICT",
        "O username já está em uso"
      ],
      [
        "429",
        "RATE_LIMIT",
        "Muitas requisições — aguarde antes de tentar novamente"
      ],
      [
        "500",
        "INTERNAL_ERROR",
        "Erro interno do servidor"
      ]
    ],
    "generic": "Erro",
    "unknown": "Erro desconhecido"
  },
  "examples": {
    "title": "Exemplos completos",
    "labelCurl": "Criar conta",
    "labelSuspend": "Suspender conta",
    "labelList": "Listar com filtros",
    "labelNodeClient": "Cliente reutilizável",
    "labelPhpHelper": "Classe helper em PHP"
  },
  "table": {
    "columnStatus": "Estado",
    "columnPlan": "Plano",
    "columnModules": "Módulos",
    "columnCreated": "Criado",
    "columnUpdated": "Atualizado",
    "columnTenantGroup": "Grupo",
    "columnHomeRoot": "Home",
    "modulesCount": "{count} módulos"
  },
  "audit": {
    "title": "Auditoria de {username}",
    "eventType": "Evento",
    "actor": "Ator",
    "date": "Data",
    "empty": "Nenhum evento registrado."
  },
  "actions": {
    "editModules": "Editar módulos",
    "viewStats": "Ver uso",
    "viewAudit": "Ver auditoria",
    "enableJail": "Ativar jaula",
    "disableJail": "Desativar jaula",
    "save": "Salvar",
    "saveChanges": "Salvar alterações",
    "saving": "Salvando…"
  },
  "confirm": {
    "enableJailBody": "Ativar a jaula chroot para esta conta? Seu terminal/SSH ficará confinado à sua pasta.",
    "disableJailBody": "Desativar a jaula chroot? A conta voltará a um shell normal (/bin/bash).",
    "suspendBody": "Suspender esta conta? O cliente perderá acesso.",
    "suspendTitle": "Suspender conta",
    "suspendOk": "Sim, suspender",
    "deleteBody": "Eliminar a conta \"{username}\" e TODOS os seus dados (e-mails, domínios, arquivos)? Esta ação não pode ser desfeita.",
    "deleteTitle": "Eliminar conta"
  },
  "jail": {
    "degraded": "jailkit não está instalado no servidor; a jaula não foi ativada. Instale jailkit e tente novamente.",
    "degradedTitle": "Jaula não aplicada",
    "enabledOk": "Jaula ativada com sucesso."
  },
  "toasts": {
    "jailAlready": "A jaula já está ativa",
    "jailNotActive": "A jaula não está ativa",
    "notActive": "A conta não está ativa",
    "notSuspended": "A conta não está suspensa"
  },
  "labels": {
    "statusActive": "Ativa",
    "statusSuspended": "Suspensa",
    "statusTerminated": "Encerrada"
  },
  "dataTable": {
    "columns": {
      "username": "Usuário",
      "plan": "Plano",
      "estado": "Estado",
      "modulos": "Módulos",
      "tenantGroup": "Grupo",
      "homeRoot": "Home",
      "creado": "Criado",
      "actualizado": "Atualizado"
    },
    "filters": {
      "searchUser": "Buscar por usuário…",
      "estado": "Estado",
      "plan": "Plano",
      "statusActive": "Ativa",
      "statusSuspended": "Suspensa",
      "statusTerminated": "Encerrada"
    },
    "rowActions": {
      "edit": "Editar",
      "viewStats": "Ver uso",
      "viewAudit": "Ver auditoria",
      "password": "Alterar senha",
      "suspend": "Suspender",
      "unsuspend": "Reativar",
      "enableJail": "Ativar jaula",
      "disableJail": "Desativar jaula",
      "delete": "Excluir"
    }
  },
  "runtime": {
    "defaultsLoadError": "Não foi possível carregar os valores padrão.",
    "defaultsSaveError": "Não foi possível salvar os valores.",
    "defaultsSaved": "Valores salvos no servidor ativo."
  },
  "settingsUi": {
    "title": "Configurações de hospedagem",
    "description": "Preferências da tabela de contas de hospedagem",
    "table": "Tabela",
    "apiProviders": "Provedores de API",
    "rowsPerPage": "Linhas por página na tabela de contas.",
    "newAccountDefaults": "Padrões para novas contas",
    "defaultsHint": "Salvos no servidor ativo. As contas existentes não são alteradas.",
    "emailAccounts": "E-mails",
    "subusers": "Subusuários",
    "defaultJail": "Ativar isolamento por padrão",
    "defaultModules": "Módulos padrão (IDs separados por vírgulas)",
    "saveDefaults": "Salvar padrões",
    "relatedModules": "Módulos relacionados",
    "users": "Usuários",
    "domainsSsl": "Domínios e SSL",
    "showAll": "Mostrar todas",
    "hideAll": "Ocultar todas",
    "providerConnections": "Conexões dos gerenciadores de hospedagem",
    "providerConnectionsHint": "O LUXIPANEL oferece a API. Cada gerenciador recebe uma chave e acesso limitado a um servidor, módulos e operações.",
    "newProvider": "Novo provedor",
    "managedServer": "Servidor gerenciado",
    "localServer": "Servidor local",
    "panelHttpsOrigin": "Origem HTTPS do LUXIPANEL",
    "siteEngine": "Motor do site no servidor",
    "accountModules": "Módulos para as contas",
    "modulesHint": "IDs separados por vírgulas; HOSTING valida o catálogo.",
    "apiOperations": "Operações da API",
    "readAccounts": "Ler contas",
    "createAccounts": "Criar contas",
    "accountStatus": "Status e dados da conta",
    "viewUsage": "Consultar uso",
    "linkSites": "Vincular sites",
    "panelAccess": "Acesso ao painel",
    "deleteAccounts": "Excluir contas",
    "createProviderKey": "Criar provedor e chave",
    "copyKeyNow": "Copie a chave agora: ela é exibida apenas uma vez.",
    "groupPolicy": {
      "editProvider": "Editar provedor",
      "saveProvider": "Salvar provedor",
      "templateTitle": "Permissões do grupo inicial",
      "templateHint": "Cada nova conta recebe estas permissões no próprio grupo. Para contas existentes, edite o grupo em Usuários.",
      "permissions": "Permissões detalhadas",
      "sidebar": "Menus",
      "views": "Visualizações",
      "actions": "Ações",
      "filesScope": "Acesso a arquivos",
      "relativeHint": "Um caminho por linha, relativo à pasta de cada conta. Use . para toda a pasta.",
      "allowPaths": "Pastas permitidas",
      "denyPaths": "Pastas bloqueadas",
      "readOnlyPaths": "Pastas somente leitura",
      "defaultPath": "Pasta inicial",
      "commands": "Comandos do terminal",
      "allowAllCommands": "Permitir todos os comandos do usuário",
      "commandGroups": "Grupos de comandos",
      "allowedCommands": "Comandos permitidos, um por linha",
      "deniedCommands": "Comandos bloqueados, um por linha",
      "saving": "Salvando…",
      "saved": "Provedor salvo. Aplica-se a novas contas.",
      "created": "Provedor criado.",
      "loading": "Carregando provedores e permissões…",
      "loadError": "Não foi possível carregar as configurações.",
      "active": "Ativo",
      "revoked": "Revogado",
      "rotateKey": "Rotacionar chave",
      "rotateSuccess": "Chave alterada. Copie a nova chave.",
      "revoke": "Revogar acesso",
      "reactivate": "Reativar",
      "accessUpdated": "Acesso atualizado.",
      "emptyProviders": "Ainda não há provedores configurados."
},
    "apiGuide": "Guia da API",
    "retry": "Tentar novamente"
  },
  "apiDocs": {
    "pageTitle": "API de provedores de hospedagem",
    "backToHosting": "Voltar ao HOSTING",
    "contractVersion": "Contrato HTTP · versão 1",
    "heading": "Conecte seu gerenciador de hospedagem",
    "intro": "LUXIPANEL expõe esta API para que seu gerenciador crie contas, vincule sites e conceda acesso conforme as permissões definidas em HOSTING.",
    "guideContents": "Conteúdo do guia",
    "preparation": "Preparação",
    "authentication": "Autenticação",
    "operations": "Operações",
    "example": "Exemplo",
    "panelAccess": "Acesso ao painel",
    "limitsErrors": "Limites e erros",
    "preparationHeading": "Preparação no HOSTING",
    "administrator": "Administrador",
    "scope": "Escopo",
    "key": "Chave",
    "adminStep": "Abra HOSTING → Configurações → Provedores API e crie um provedor.",
    "scopeStep": "Defina servidor, mecanismo de sites, módulos, cotas e operações permitidas.",
    "keyStep": "Copie a chave lhp_… uma vez e guarde-a apenas no backend do gerenciador.",
    "providerScopeNote": "Cada provedor pertence a um servidor. As contas recebem usuário Linux e pasta próprios; o gerenciador não escolhe nem recebe a senha.",
    "anyProvider": "Qualquer provedor",
    "endpointCapabilities": "Consulta versão, operações, módulos e servidor atribuído.",
    "endpointPutAccount": "Cria ou recupera uma conta com displayName e email opcionais.",
    "endpointGetAccount": "Consulta a conta sem expor a senha.",
    "endpointPatchAccount": "Atualiza nome, email ou estado active/suspended.",
    "endpointDeleteAccount": "Exclui uma conta sem sites vinculados. Desativado por padrão.",
    "endpointUsage": "Consulta cotas, uso disponível e avisos de medição.",
    "endpointPutSite": "Vincula um domínio ao mecanismo de sites configurado no HOSTING.",
    "endpointDeleteSite": "Remove apenas o site pertencente ao provedor.",
    "endpointTicket": "Emite acesso único ao painel válido por 60 segundos.",
    "method": "Método",
    "pathFromBase": "Caminho a partir da URL base",
    "permission": "Permissão",
    "result": "Resultado",
    "operationsHeading": "Operações do gerenciador",
    "authNote": "Envie solicitações ao painel por HTTPS. Cookies de administrador e chaves lxp_… não autenticam esta API. Nunca exponha a chave lhp_… ao navegador.",
    "baseNote": "URL base: https://<panel>/api/hosting/v1. IDs externos aceitam 1–128 caracteres: letras, números, _ . : -.",
    "idempotencyNote": "Solicitações PUT de contas e sites são idempotentes com a mesma referência e conteúdo. Um provedor não acessa contas de outro.",
    "createAccount": "Criar ou recuperar uma conta",
    "accountResponseNote": "A resposta contém { \"ok\": true, \"data\": … } com usuário, pasta inicial, estado e cotas. O hash da senha não é incluído.",
    "siteExampleNote": "Para um site, envie PUT /accounts/account-42/sites/site-1 com { \"domain\": \"example.com\" }. LUXIPANEL cria um proxy NGINX para o mecanismo configurado; o gerenciador publica conteúdo e encaminha o tráfego TLS.",
    "clientAccessHeading": "Acesso do cliente ao LUXIPANEL",
    "clientAccessNote": "O backend verifica que o cliente é dono da conta e solicita POST /accounts/{accountId}/access-ticket. Envia URL e ticket ao navegador, que faz POST para /api/auth/sso/handoff. O ticket é de uso único e expira em 60 segundos. Se houver exigência de segundo fator, o acesso retorna 403 até existir um fluxo compatível.",
    "limitsHeading": "Limites e respostas de erro",
    "limitsNote": "A API aceita apenas referências, dados básicos da conta e domínios. O gerenciador não pode enviar comandos, caminhos, servidores de destino nem configuração NGINX. Um site aponta só para o mecanismo e a porta definidos pelo administrador.",
    "errorCodes": "400: entrada inválida · 401: chave ausente ou inválida · 403: operação não permitida · 404: referência inexistente · 409: conflito ou trabalho simultâneo · 5xx: falha do servidor.",
    "bandwidthNote": "A medição de largura de banda ainda não é confiável. Consulte warnings na resposta de usage."
  }
} as const;

export default hosting;
