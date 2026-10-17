const assistantPart2 = {
  "cliUsageBars": {
    "sourceReal": "cota restante da conta",
    "sourceEstimated": "tokens restantes estimados",
    "sourceTokens": "tokens restantes",
    "cliUsage": "CLI disponível",
    "session5h": "Sessão (5h)",
    "week": "Semana",
    "sessionHours": "Sessão ({hours}h)",
    "resetSameDay": "reinicia {time}",
    "resetOtherDay": "reinicia {day}, {time}",
    "unavailable": "Não foi possível carregar a cota de {provider}",
    "retry": "Tentar novamente"
  },
  "notifySettings": {
    "title": "Notificações do assistente",
    "description": "Avise-me nos meus dispositivos (web, app e desktop) quando um chat terminar e eu não o estiver a ver.",
    "saveError": "Não foi possível guardar."
  },
  "voiceSettings": {
    "title": "Voz (áudio)",
    "description": "Fale com o assistente e ouça as respostas usando OpenAI.",
    "missingCapabilities": "Configure uma chave de API OpenAI no provedor Codex para ativar o áudio.",
    "inputLabel": "Entrada (STT)",
    "outputLabel": "Saída (TTS)",
    "notAvailable": "não disponível",
    "voiceLabel": "Voz",
    "autoSpeak": "Ler as respostas automaticamente ao terminar",
    "audioProvider": "Fornecedor de áudio",
    "providerApi": "API (OpenAI/Gemini)",
    "providerPiper": "Piper (local)",
    "providerMinimax": "MiniMax",
    "providerApiHint": "Usa a chave de API já configurada.",
    "piperReady": "Piper instalado",
    "piperMissing": "Piper não instalado",
    "minimaxReady": "MiniMax pronto",
    "minimaxMissing": "MiniMax indisponível",
    "minimaxAuthMissing": "Falta a chave do MiniMax",
    "minimaxVoiceHint": "Voz do MiniMax a usar."
  },
  "agentMarket": {
    "overrideHint": "Ao salvar, estas configurações substituem as herdadas neste projeto.",
    "title": "Market",
    "description": "Perfis reutilizáveis para os projetos deste servidor.",
    "search": "Buscar por nome, descrição, especialidade ou tecnologia",
    "project": "Projeto ativo",
    "chooseProject": "Selecione um projeto",
    "allProviders": "Todos os provedores",
    "allRoles": "Todas as funções",
    "allAssignments": "Todas as atribuições",
    "assigned": "Atribuído",
    "unassigned": "Não atribuído",
    "inherited": "Herdado",
    "removed": "Removido",
    "empty": "Ainda não há perfis de agentes.",
    "noMatches": "Nenhum perfil corresponde aos filtros.",
    "loading": "Carregando catálogo…",
    "retry": "Tentar novamente",
    "error": "Não foi possível carregar ou atualizar o catálogo.",
    "pending": "Operação em andamento…",
    "add": "Adicionar ao projeto",
    "remove": "Remover do projeto",
    "configure": "Configurar atribuição",
    "editProfile": "Editar perfil global",
    "profileHint": "As alterações do perfil se aplicam a todos os seus projetos.",
    "assignmentHint": "Esta configuração se aplica apenas ao projeto selecionado.",
    "removeConfirm": "Remover {name} deste projeto? O perfil e o histórico serão preservados.",
    "saved": "Alterações salvas.",
    "specialty": "Especialidade",
    "technologies": "Tecnologias (separadas por vírgulas)",
    "newProfile": "Criar perfil",
    "back": "Voltar ao chat",
    "inheritedHint": "Herdado de {project}. Gerencie a remoção no projeto de origem.",
    "readOnly": "Somente leitura",
    "busy": "Há trabalho ou aprovações pendentes. Conclua-os antes de alterar a atribuição.",
    "forbidden": "Você não tem permissão para realizar esta ação.",
    "contextChanged": "O servidor ou a sessão mudou. Recarregue o catálogo.",
    "uncertain": "Não foi possível confirmar o resultado. Verifique o catálogo antes de repetir a ação.",
    "historical": "Histórico: indisponível para novos chats",
    "inherit": "Herdar do perfil",
    "none": "Nenhum",
    "jobTitle": "Cargo no projeto",
    "instructions": "Instruções do projeto",
    "limitsHint": "Os limites se combinam com as permissões existentes, sem conceder acesso adicional."
  },
  "agentsTab": {
    "teams": {
      "newTeamBtn": "Nova equipe",
      "newTeamTitle": "Criar equipe",
      "editTeamTitle": "Editar equipe",
      "nameLabel": "Nome",
      "namePlaceholder": "Ex. Backend, Frontend, Design…",
      "descriptionLabel": "Descrição (opcional)",
      "colorLabel": "Cor",
      "createBtn": "Criar equipe",
      "saveBtn": "Salvar",
      "cancelBtn": "Cancelar",
      "addAgentsBtn": "Adicionar agentes",
      "addAgentsTitle": "Adicionar agentes à equipe",
      "addAgentsEmpty": "Nenhum agente disponível para adicionar.",
      "addAgentsConfirm": "Adicionar",
      "alreadyInTeam": "em outra equipe",
      "removeFromTeamBtn": "Remover da equipe",
      "removeFromTeamConfirm": "Remover este agente da equipe? O agente não é excluído.",
      "deleteTeamBtn": "Excluir equipe",
      "deleteTeamConfirm": "Excluir esta equipe?",
      "deleteTeamKeepsAgentsNote": "Os agentes NÃO são excluídos: apenas são removidos da equipe.",
      "teamSelectorLabel": "Equipe",
      "groupRequired": "Selecione ou crie um grupo",
      "teamSelectorPlaceholder": "— Selecione um grupo —",
      "noTeamOption": "Sem equipe",
      "emptyTeamHint": "Equipe vazia — adicione agentes com o botão +.",
      "memberCount": "{count} membro(s)"
    },
    "cancel": "Cancelar",
    "saving": "A guardar…",
    "saveChanges": "Guardar alterações",
    "noDescription": "Sem descrição",
    "allTools": "todas as tools",
    "toolsCount": "{count} tools",
    "noActiveModules": "Não há módulos ativos com ferramentas.",
    "removeAll": "Remover tudo",
    "selectAll": "Selecionar tudo",
    "sensitiveTool": "ação sensível",
    "confirmDeleteAgent": "Eliminar o agente \"{name}\"?",
    "confirmDeleteRole": "Eliminar o papel \"{name}\"? Será removido dos agentes que o utilizam.",
    "duplicateName": "{name} (cópia)",
    "editBtn": "Editar",
    "deleteTitle": "Eliminar",
    "errorPrefix": "Erro: {message}",
    "backToAgents": "Agentes",
    "createdBy": "Criado por {ownerName}",
    "diagram": {
      "empty": "Sem agentes — crie um para o ver aqui",
      "connection": "conexão"
    },
    "archetypes": {
      "devops": "DevOps / SRE",
      "security": "Auditor de segurança",
      "dba": "Administrador de BD",
      "support": "Suporte técnico",
      "nginx": "Administrador web / Nginx",
      "backups": "Especialista em backups",
      "logs": "Analista de logs",
      "automation": "Automação / Cron"
    },
    "editor": {
      "titleNew": "Novo agente",
      "titleEdit": "Editar agente",
      "headerTitleNew": "Novo agente",
      "headerDescNew": "Configure um novo agente de IA",
      "headerTitleEdit": "Editando agente",
      "headerDescEdit": "Altere a configuração do agente",
      "backToList": "Voltar aos agentes",
      "tabGeneral": "Geral",
      "tabModel": "Modelo",
      "tabHierarchy": "Hierarquia",
      "tabTools": "Ferramentas",
      "tabResources": "Recursos",
      "tabAccess": "Acessos",
      "aiHelpTitle": "Ajuda de IA",
      "aiHelpDesc": "Escolha um perfil e a IA irá redigir nome, descrição, prompt e ferramentas de forma profissional.",
      "aiHelpSelect": "Selecione um perfil…",
      "aiHelpFromDesc": "A partir da minha descrição",
      "aiHelpFromDescTitle": "Melhorar a partir da descrição atual",
      "aiHelpGenerating": "A gerar agente com IA…",
      "fieldName": "Nome",
      "namePlaceholder": "Ex. Auditor de segurança",
      "fieldDescription": "Descrição",
      "descPlaceholder": "Para que serve este agente",
      "fieldSystemPrompt": "Prompt de sistema",
      "systemPromptPlaceholder": "Instruções, personalidade e objetivos do agente…",
      "fieldAvatar": "Avatar",
      "avatarRandomize": "Aleatório",
      "avatarAuto": "Auto",
      "avatarAttrs": {
        "top": "Cabelo / chapéu",
        "hairColor": "Cor do cabelo",
        "eyes": "Olhos",
        "eyebrows": "Sobrancelhas",
        "mouth": "Boca",
        "skinColor": "Cor da pele",
        "clothing": "Roupa",
        "clothesColor": "Cor da roupa",
        "accessories": "Acessório",
        "facialHair": "Barba",
        "facialHairColor": "Cor da barba"
      },
      "fieldProvider": "Fornecedor",
      "fieldModel": "Modelo",
      "modelPlaceholder": "(padrão do fornecedor)",
      "realtimeLabel": "Comunicação em tempo real (sessão de baixa latência)",
      "realtimeDesc": "Sessão bidirecional de áudio/texto em streaming (conforme o fornecedor: OpenAI Realtime ou Gemini Live).",
      "realtimeUnavailable": "O fornecedor \"{providerId}\" não oferece sessão em tempo real. Disponível apenas com codex (OpenAI) ou gemini.",
      "multiAgentLabel": "Modo multi-agente: replica este mesmo agente várias vezes em paralelo",
      "multiAgentDescPre": "O agente ",
      "multiAgentDescBold": "multiplica-se por X",
      "multiAgentDescPost": ": a tarefa é dividida em X partes e cada cópia (mesmo prompt, ferramentas e fornecedor) resolve uma em paralelo; depois é sintetizada uma única resposta.",
      "multiAgentCopies": "Número de cópias (X)",
      "multiAgentCopiesHint": "cópias do agente (2–8)",
      "multiAgentProvidersPre": "Opcional — distribuir as cópias entre vários fornecedores (o principal ",
      "multiAgentProvidersPost": " sempre participa; marque outros para distribuí-las):",
      "multiAgentApiHint": "Apenas são utilizados fornecedores em modo API com API key. O multi-agente requer modo API.",
      "roleHeading": "Papel e hierarquia",
      "roleAssigned": "Papel atribuído",
      "roleNone": "Sem papel",
      "roleHint": "O papel fornece um prompt base e ferramentas por padrão; o agente aperfeiçoa-o. Gere os papéis a partir da lista de agentes.",
      "parentAgent": "Agente superior (subordinação)",
      "parentNone": "Nenhum (nível superior)",
      "parentHintPre": "O seu superior poderá ",
      "parentHintBold": "delegar-lhe",
      "parentHintPost": " tarefas durante a execução e usar a sua resposta.",
      "connectionsLabel": "Conexões com outros agentes",
      "connectionsEmpty": "Não há outros agentes.",
      "connectionsHint": "Canal bidirecional: qualquer um dos dois pode pedir ou fornecer informação ao outro em execução (ferramenta de delegação).",
      "supervisorLabel": "Supervisor: pode criar conversas para os seus subordinados",
      "supervisorDesc": "Abre conversas reais no separador Chat e coloca os seus subordinados a trabalhar (cada conversa fica como registo desse agente). Também concedido via papel.",
      "allowAllTools": "Permitir todas as ferramentas disponíveis",
      "toolsDesc": "Selecione o subconjunto de ferramentas que este agente pode utilizar. A lista é cruzada com o que cada módulo permite, pelo que nunca amplia permissões.",
      "associatedServers": "Servidores associados",
      "serversEmpty": "Não há servidores registados.",
      "attachedProjects": "Projetos associados",
      "attachedProjectsDesc": "Selecione um ou vários projetos da árvore. Marcar um projeto pai seleciona todas as suas pastas aninhadas; o agente usa os caminhos de trabalho dos projetos selecionados.",
      "noParentProjects": "Nenhum projeto.",
      "graphIndexesTitle": "Índices do grafo de código",
      "graphIndexesDesc": "O agente usará esses índices para explorar o código pelo grafo (símbolos, chamadas e arquitetura) em vez de ler arquivos inteiros — reduz o consumo de tokens.",
      "graphIndexesEmpty": "Nenhum índice de grafo disponível. Indexe um projeto na aba Projetos.",
      "credentialTitle": "Credenciais de acesso",
      "saveObsidian": "Guardar resumos no vault Obsidian do projeto associado",
      "agentSkills": "Skills do agente",
      "createAgent": "Criar agente",
      "snippetsSection": "Snippets de terminal",
      "snippetsCategoryLabel": "Categoria de snippets",
      "snippetsCategoryNone": "(nenhuma)",
      "snippetsTagsLabel": "Etiquetas da categoria",
      "snippetsHelp": "Pré-filtra os snippets de terminal que este agente terá disponíveis: escolha uma categoria e, opcionalmente, etiquetas dessa categoria. Sem categoria = sem filtro.",
      "snippetsNoAccess": "Não foi possível carregar os snippets de terminal (requer permissão de terminal).",
      "snippetsNoTags": "Esta categoria não tem etiquetas."
    },
    "roleEditor": {
      "titleNew": "Novo papel",
      "titleEdit": "Editar papel",
      "fieldName": "Nome do papel",
      "namePlaceholder": "Ex. Coordenador, Auditor, Especialista BD",
      "fieldDesc": "Descrição",
      "descPlaceholder": "O que representa este papel",
      "fieldBasePrompt": "Prompt base do papel",
      "basePromptPlaceholder": "Políticas, responsabilidades e tom comuns a todos os agentes com este papel…",
      "basePromptHint": "É injetado como base, antes do prompt próprio do agente.",
      "noToolLimit": "Sem limite de ferramentas a partir do papel",
      "toolsDesc": "As ferramentas do papel limitam o que os seus agentes podem utilizar (cruzam-se, nunca ampliam).",
      "supervisorLabel": "Cargo supervisor: os agentes com este papel podem criar conversas para os seus subordinados",
      "supervisorDesc": "Concede a permissão de atuar como supervisor (ferramenta para abrir conversas e atribuir trabalho) a todo o agente que tenha este papel.",
      "createRole": "Criar papel"
    },
    "treeView": {
      "title": "Hierarquia de agentes",
      "reloadTitle": "Recarregar agentes e regenerar a árvore",
      "regenerating": "A regenerar…",
      "regenerate": "Regenerar",
      "description": "Diagrama da árvore de subordinação (linha sólida = superior → subordinado) e conexões entre pares (linha pontilhada). Atribua o «Agente superior» no editor de cada agente para construir a árvore."
    },
    "rolesList": {
      "newRole": "Novo papel",
      "description": "Papéis reutilizáveis (perfil com prompt base e ferramentas) que atribui a um ou vários agentes.",
      "emptyTitle": "Ainda não há papéis",
      "emptyDesc": "Crie um papel para padronizar o comportamento de vários agentes.",
      "agentsCount": "{count} agente(s)"
    },
    "list": {
      "description": "Agentes IA personalizados: prompt próprio, ferramentas e fornecedor/modelo. Utilize-os no chat ou programe-os no Cron.",
      "treeBtn": "Árvore",
      "treeBtnTitle": "Ver a árvore de hierarquia de agentes",
      "rolesBtn": "Papéis",
      "rolesBtnTitle": "Criar e gerir papéis de agente",
      "newAgent": "Novo agente",
      "loading": "A carregar agentes…",
      "emptyTitle": "Ainda não tem agentes",
      "emptyDesc": "Crie um para conversar com um prompt e um conjunto de ferramentas à medida.",
      "multiAgentTitle": "Multi-agente: {count} cópias",
      "roleAssignedTitle": "Papel atribuído",
      "subordinateTitle": "Subordinado de",
      "connectionsTitle": "Conexões com outros agentes",
      "supervisorTitle": "Supervisor: pode criar conversas para subordinados",
      "supervisorBadge": "supervisor",
      "realtimeTitle": "Comunicação em tempo real",
      "realtimeBadge": "tempo real",
      "startChat": "Iniciar chat",
      "duplicateTitle": "Duplicar",
      "noRoleGroupTitle": "Sem grupo de trabalho",
      "groupAria": "Grupo de trabalho: {name}",
      "groupCount": "{count} agentes",
      "noRoleGroupDesc": "Agentes sem um papel atribuído. Atribua um pelo editor."
    },
    "resync": {
      "applying": "Criando…",
      "close": "Fechar",
      "btn": "Sincronizar com o modelo",
      "btnTitle": "Comparar esta equipa com o modelo e criar os agentes em falta",
      "modalTitle": "Sincronizar «{name}» com o seu modelo",
      "loading": "A comparar com o modelo…",
      "markersMissing": "Esta equipa perdeu os marcadores de origem do modelo, pelo que não é possível compará-la automaticamente. Pode criar manualmente os agentes em falta.",
      "missingHeading": "Em falta",
      "presentHeading": "Presentes",
      "extraHeading": "Adicionados manualmente",
      "extraNote": "Não serão alterados.",
      "nothingMissing": "A equipa está completa: não falta nenhum agente do modelo.",
      "confirm": "Criar selecionados"
    }
  },
  "accessTab": {
    "all": "Todos",
    "permissionsTitle": "Acessos e permissões",
    "permissionsDescription": "Hoje a visibilidade do assistente é regida pela permissão do módulo assistant no seu perfil. O detalhe por função (assistant.use / assistant.configure / assistant.module.<id>) está previsto para a próxima iteração.",
    "recentInvocations": "Últimas invocações de ferramentas",
    "refreshAriaLabel": "Atualizar acessos",
    "loading": "Carregando...",
    "emptyRecent": "Sem atividade recente.",
    "emptyProvider": "Sem atividade para este fornecedor.",
    "byUser": "por",
    "crossServerTitle": "Acesso ao servidor associado",
    "autoApproveTitle": "Aprovação automática",
    "autoApproveDescription": "Ferramentas que já não pedem confirmação (aprovadas com «Aprovar e não perguntar mais»). As alterações aplicam-se a partir da próxima execução.",
    "autoApproveEmpty": "Não há ferramentas com aprovação automática. Esta lista é preenchida quando escolhe «Aprovar e não perguntar mais» ao aprovar uma ação do agente.",
    "autoApproveRevoke": "Revogar",
    "autoApproveModeAuto": "modo automático: esta lista não se aplica",
    "cmdPrefix": "$ ",
    "passwordLabel": "palavra-passe: ",
    "passphraseLabel": "frase-passe: ",
    "privateKeyLabel": "chave privada"
  },
  "directoryPicker": {
    "title": "Selecionar pasta",
    "goUp": "Subir",
    "loading": "A carregar…",
    "emptyDirs": "(sem subpastas)",
    "cancel": "Cancelar",
    "select": "Usar esta pasta",
    "readError": "Não foi possível ler o diretório"
  },
  "skillsSettings": {
    "title": "Skills e métodos do assistente",
    "helper": "Ativa ou desativa bibliotecas, skills e métodos que refinam o comportamento do assistente.",
    "tokenNote": "As instruções de cada skill viajam no prompt em cache (~0,1× nos turnos seguintes). O Ponytail reduz o código e os tokens de saída; no UI/UX Pro Max, use o nível «Breve» para gastar menos.",
    "search": "Pesquisar skill…",
    "allCategories": "Todas as categorias",
    "loading": "A carregar skills...",
    "empty": "Nenhuma skill disponível.",
    "noMatch": "Nenhuma skill corresponde ao filtro.",
    "sourcePrefix": "Fonte:",
    "errorGeneric": "Não foi possível atualizar a skill. Tente novamente.",
    "activeShown": "{count} ativas · {shown} mostradas."
  },
  "skillsPicker": {
    "searchPlaceholder": "Pesquisar skill…",
    "resetTitle": "Remover personalização (usar skills globais)",
    "reset": "Repor ({count})",
    "loading": "A carregar skills…",
    "empty": "Sem skills.",
    "globalNote": "Aplicam-se APENAS nos seus chats, sobre as skills globais do provedor."
  },
  "skillCategories": {
    "methods": "Métodos do assistente",
    "code-quality": "Qualidade de código",
    "web-quality": "Qualidade web (Lighthouse / CWV)",
    "ui-ux": "UI / UX / design",
    "web-fullstack": "Desenvolvimento web / full-stack com IA",
    "mobile": "Apps móveis",
    "code-agents": "Agentes de código",
    "reusable-skills": "Skills reutilizáveis para IA",
    "security": "Segurança IA / web / apps",
    "token-savings": "Economia de tokens / custos IA",
    "ai-prod": "Agentes IA em produção",
    "devops": "DevOps / implantação",
    "testing": "Testes / qualidade de código",
    "data-rag": "Bases de dados / RAG / busca",
    "automation": "Automatização / workflows",
    "other": "Outro"
  },
  "skillCatalog": {
    "ask-protocol": {
      "name": "Perguntar antes de decidir",
      "description": "Permite que o assistente pause e faça uma pergunta-chave em vez de supor (ferramenta lxp_ask + protocolo de questões)."
    },
    "project-context-vault": {
      "name": "Contexto do projeto (Obsidian)",
      "description": "Injeta notas de contexto do projeto (Contexto.md / Errores.md) e permite buscar mais com obsidian.search_notes."
    },
    "ponytail": {
      "name": "Ponytail (código minimalista)",
      "description": "Modo de desenvolvimento minimalista: escreva apenas o código necessário (escalera de decisão + guardrails)."
    },
    "ui-ux-pro-max": {
      "name": "UI/UX Pro Max (qualidade de interface)",
      "description": "Padrões profissionais de UI/UX (acessibilidade, toque, tipografia, estados) injetados no prompt; nível resumido ou completo."
    },
    "openai-agents-sdk": {
      "name": "OpenAI Agents SDK",
      "description": "Agentes OpenAI com tools, handoffs, guardrails, sessões e rastreamento."
    },
    "openai-agents-python": {
      "name": "OpenAI Agents Python SDK",
      "description": "SDK Python para agentes: Agent, Runner, @function_tool, handoffs e rastreamento."
    },
    "openai-agents-js": {
      "name": "OpenAI Agents JS SDK",
      "description": "SDK TypeScript/JS para agentes OpenAI: Agent, run, tools (Zod), handoffs."
    },
    "mcp-docs": {
      "name": "Model Context Protocol",
      "description": "Padrão aberto (o 'USB-C da IA') para conectar LLMs a tools, resources e prompts."
    },
    "mcp-github": {
      "name": "MCP (GitHub)",
      "description": "Organização GitHub do MCP: SDKs oficiais (10 linguagens), servidores de referência e inspetor."
    },
    "anthropic-mcp-intro": {
      "name": "Anthropic MCP Intro",
      "description": "Anúncio da Anthropic: MCP como padrão aberto que resolve integrações N×M."
    },
    "n8n": {
      "name": "n8n",
      "description": "Automatização de workflow fair-code, auto-hospedável."
    },
    "make": {
      "name": "Make",
      "description": "Automatização visual sem código por cenários (ex-Integromat)."
    },
    "zapier": {
      "name": "Zapier",
      "description": "Automatização SaaS via triggers e ações (Zaps)."
    },
    "temporal": {
      "name": "Temporal",
      "description": "Orquestração de workflows duráveis e tolerantes a falhas."
    },
    "bullmq": {
      "name": "BullMQ",
      "description": "Filas de jobs baseadas em Redis para Node.js."
    },
    "langgraph": {
      "name": "LangGraph",
      "description": "Orquestração de agentes LLM como grafos com estado."
    },
    "codex-cli": {
      "name": "OpenAI Codex CLI",
      "description": "Orienta o agente a usar o Codex CLI do OpenAI (agente de código de terminal)."
    },
    "codex-cli-features": {
      "name": "Codex CLI Features",
      "description": "Detalha ao agente as capacidades do Codex CLI (sandbox, aprovações, MCP, config)."
    },
    "codex-cloud": {
      "name": "Codex Cloud",
      "description": "Orienta o agente a delegar tarefas ao Codex Cloud (ambientes remotos, execução paralela, PRs)."
    },
    "claude-code-skills": {
      "name": "Claude Code Skills",
      "description": "Orienta o agente a criar e usar Skills do Claude Code (pasta com SKILL.md, padrão Agent Skills)."
    },
    "copilot-cloud-agent": {
      "name": "GitHub Copilot Cloud Agent",
      "description": "Orienta o agente a delegar issues ao agente de codificação GitHub Copilot, que trabalha na nuvem e abre PRs."
    },
    "cursor": {
      "name": "Cursor",
      "description": "Orienta o agente a trabalhar no editor Cursor (Agent, contexto do repo, regras)."
    },
    "agents-md": {
      "name": "AGENTS.md",
      "description": "Orienta o agente a escrever e seguir AGENTS.md, o arquivo de instruções padrão para agentes de código."
    },
    "open-design-contribute": {
      "name": "Open Design — contribuir (sem código)",
      "description": "Fluxo guiado sem código para contribuir ao Open Design (nexu-io): envie uma Skill ou Design System, traduza docs, corrija textos ou reporte um bug, e ele abre o PR/issue para você."
    },
    "supabase": {
      "name": "Supabase",
      "description": "Backend Postgres gerenciado com auth, storage e realtime."
    },
    "postgresql": {
      "name": "PostgreSQL",
      "description": "Banco de dados relacional robusto com tipos ricos."
    },
    "pgvector": {
      "name": "pgvector",
      "description": "Busca de similaridade vetorial dentro do Postgres."
    },
    "pinecone": {
      "name": "Pinecone",
      "description": "Banco de dados vetorial gerenciado para RAG em escala."
    },
    "qdrant": {
      "name": "Qdrant",
      "description": "Motor vetorial open-source com filtragem por payload."
    },
    "weaviate": {
      "name": "Weaviate",
      "description": "Banco de dados vetorial com esquema e módulos de vetorização."
    },
    "github-actions": {
      "name": "GitHub Actions",
      "description": "CI/CD no GitHub com workflows YAML (.github/workflows) disparados por eventos."
    },
    "vercel": {
      "name": "Vercel",
      "description": "Implantação de frontends e funções serverless com visualização por commit/PR."
    },
    "docker": {
      "name": "Docker",
      "description": "Empacota apps em containers efêmeros com imagens leves e reproduzíveis."
    },
    "nginx": {
      "name": "Nginx",
      "description": "Servidor web de alto desempenho e proxy reverso."
    },
    "pm2": {
      "name": "PM2",
      "description": "Gerenciador de processos Node com cluster, reinicialização e logs."
    },
    "redis": {
      "name": "Redis",
      "description": "Store em memória para cache, filas e estruturas de dados."
    },
    "expo": {
      "name": "Expo",
      "description": "Orienta o agente a desenvolver apps React Native com Expo (expo-router, módulos, config plugins)."
    },
    "eas-build": {
      "name": "EAS Build",
      "description": "Orienta o agente a compilar binários iOS/Android na nuvem com EAS Build e perfis eas.json."
    },
    "eas-services": {
      "name": "EAS Services",
      "description": "Ajuda o agente a usar o ecosistema EAS (Submit, Update/OTA, Workflows) end-to-end."
    },
    "react-native": {
      "name": "React Native",
      "description": "Orienta o agente a construir UIs nativas com React Native (componentes core, estilos, plataforma)."
    },
    "firebase-auth": {
      "name": "Firebase Auth",
      "description": "Orienta o agente a implementar autenticação com Firebase Auth (providers, tokens, sessão)."
    },
    "claude-agent-skills": {
      "name": "Claude Agent Skills",
      "description": "Empacota capacidades reutilizáveis como Agent Skills (SKILL.md) carregadas sob demanda."
    },
    "claude-skills-github": {
      "name": "Claude Skills (GitHub)",
      "description": "Repositório oficial anthropics/skills: exemplos, especificação e template como base e padrão."
    },
    "codex-agents-md-guide": {
      "name": "Codex AGENTS.md Guide",
      "description": "Convenção AGENTS.md do Codex para fornecer instruções de projeto a agentes de código."
    },
    "owasp-llm-top10": {
      "name": "OWASP Top 10 LLM",
      "description": "Top 10 riscos em apps LLM: prompt injection, output inseguro, excessive agency."
    },
    "owasp-asvs": {
      "name": "OWASP ASVS",
      "description": "ASVS v5.0: padrão de requisitos de segurança verificáveis por níveis."
    },
    "codeql": {
      "name": "CodeQL",
      "description": "CodeQL: consulta código como dados (data-flow/taint) para encontrar vulnerabilidades."
    },
    "semgrep": {
      "name": "Semgrep",
      "description": "Semgrep: SAST por regras tipo-código + Supply Chain (SCA) e Secrets, alto sinal."
    },
    "snyk": {
      "name": "Snyk",
      "description": "Snyk: SCA, Code (SAST), Container, IaC e API/Web (DAST) com remediação orientada."
    },
    "owasp-zap": {
      "name": "OWASP ZAP",
      "description": "OWASP ZAP: ferramenta de código aberto para testes DAST em aplicações web (análise passiva e ativa)."
    },
    "skillspector": {
      "name": "SkillSpector (auditar Skills IA)",
      "description": "Audita Skills de agentes IA (SKILL.md + scripts) em busca de vulnerabilidades e má intenção antes de instalá-las (NVIDIA, Apache-2.0)."
    },
    "playwright": {
      "name": "Playwright",
      "description": "Testes E2E multi-navegador com auto-espera e rastreamentos."
    },
    "cypress": {
      "name": "Cypress",
      "description": "Testes de componentes e E2E no navegador com repetições."
    },
    "vitest": {
      "name": "Vitest",
      "description": "Executor de testes rápido nativo de Vite/ESM."
    },
    "jest": {
      "name": "Jest",
      "description": "Framework de testes com mocks integrados e snapshots."
    },
    "testing-library": {
      "name": "Testing Library",
      "description": "Consultas centradas no usuário para testar UI acessível."
    },
    "storybook": {
      "name": "Storybook",
      "description": "Desenvolvimento e testes isolados de componentes UI."
    },
    "openai-prompt-caching": {
      "name": "OpenAI Prompt Caching",
      "description": "Reduz custo automaticamente reutilizando o prefixo cacheado de prompts no OpenAI."
    },
    "openai-prompt-engineering": {
      "name": "OpenAI Prompt Engineering",
      "description": "Escreva prompts precisos para menos iterações e menos tokens."
    },
    "gemini-context-caching": {
      "name": "Gemini Context Caching",
      "description": "Cache de contexto grande repetido no Gemini (explícito ou implícito) para tornar a entrada mais barata."
    },
    "gemini-caching-api": {
      "name": "Gemini Caching API",
      "description": "API cachedContents do Gemini: criar, reusar, atualizar TTL e deletar caches."
    },
    "litellm-cost-tracking": {
      "name": "LiteLLM Cost Tracking",
      "description": "Mede e atribui custo por chave/usuário/equipe com o proxy LiteLLM."
    },
    "litellm": {
      "name": "LiteLLM",
      "description": "Gateway unificado para 100+ LLMs (formato OpenAI) com cache, fallbacks e roteamento."
    },
    "figma-ai": {
      "name": "Figma AI",
      "description": "IA do Figma: agente de canvas, geração de imagens e design-to-code."
    },
    "figma-make": {
      "name": "Figma Make",
      "description": "Figma Make: de prompt ou frame para prototipo/app funcional com código real."
    },
    "figma-ai-tools": {
      "name": "Figma AI Tools",
      "description": "Ferramentas IA no Figma Design: First Draft, renomear camadas, imagens, texto."
    },
    "framer": {
      "name": "Framer",
      "description": "Framer: sites sem código com canvas visual, agentes IA, CMS e publicação."
    },
    "relume": {
      "name": "Relume",
      "description": "Relume: de brief para sitemap, wireframes e style guide com IA + biblioteca."
    },
    "design-md-tokens": {
      "name": "DESIGN.md (sistema baseado em tokens)",
      "description": "Gere UI fiel à marca com um DESIGN.md estruturado: tokens de cor/tipografia/espaçamento, specs de componentes e regras do/não-fazer (voltagent, MIT)."
    },
    "nextjs-app-router": {
      "name": "Next.js App Router",
      "description": "Orienta o agente a construir apps Next.js com o App Router (Server Components, route handlers, layouts)."
    },
    "vercel-ai-sdk": {
      "name": "Vercel AI SDK",
      "description": "Ajuda o agente a integrar LLMs com o AI SDK (generateText, streamText, tools, structured output)."
    },
    "vercel-ai-gateway": {
      "name": "Vercel AI Gateway",
      "description": "Orienta o agente a rotear requisições para múltiplos modelos via AI Gateway (um endpoint, fallback, observabilidade)."
    },
    "openai-sdk-cli": {
      "name": "OpenAI SDKs e CLI",
      "description": "Orienta o agente a usar os SDKs oficiais do OpenAI (Python/Node) e a API de forma idiomática."
    },
    "v0-vercel": {
      "name": "v0 by Vercel",
      "description": "Ajuda o agente a gerar e refinar UI React/Tailwind/shadcn com v0 a partir de prompts."
    },
    "web-quality-audit": {
      "name": "Auditoria de qualidade web",
      "description": "Auditoria abrangente de qualidade web (desempenho, acessibilidade, SEO, segurança) com classificação por severidade."
    },
    "web-performance": {
      "name": "Desempenho web",
      "description": "Otimize a velocidade de carregamento e eficiência em runtime (orçamento de recursos + Lighthouse)."
    },
    "core-web-vitals": {
      "name": "Core Web Vitals (LCP/INP/CLS)",
      "description": "Melhore LCP, INP e CLS (limites no percentil 75)."
    },
    "web-accessibility": {
      "name": "Acessibilidade web (WCAG 2.2)",
      "description": "Audit e melhore a acessibilidade per WCAG 2.2 (alvo AA)."
    },
    "web-seo": {
      "name": "SEO (técnico + on-page)",
      "description": "Otimize a visibilidade no mecanismo de busca: SEO técnico, on-page e dados estruturados."
    },
    "web-best-practices": {
      "name": "Melhores práticas web (segurança)",
      "description": "Padrões modernos para segurança, compatibilidade e qualidade de código."
    }
  }
} as const;

export default assistantPart2;
