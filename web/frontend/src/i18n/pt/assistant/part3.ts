const assistantPart3 = {
  "skillOptions": {
    "ponytail": {
      "mode": {
        "label": "Intensidade",
        "choices": {
          "off": "Desligado",
          "lite": "Lite — sugira a alternativa mais simples",
          "full": "Full — aplique a escalera",
          "ultra": "Ultra — extremista YAGNI"
        }
      }
    },
    "ui-ux-pro-max": {
      "detalle": {
        "label": "Detalhe",
        "choices": {
          "breve": "Resumido (tokens mínimos)",
          "completo": "Completo (mais detalhe)"
        }
      }
    }
  },
  "toolCatalog": {
    "admin.bash": {
      "title": "Executar comando bash"
    },
    "admin.restart_service": {
      "title": "Reiniciar serviço systemd"
    },
    "backup.list_jobs": {
      "title": "Listar backups configurados"
    },
    "bitninja.status": {
      "title": "Status do BitNinja"
    },
    "cloudflare.status": {
      "title": "Status do Cloudflare"
    },
    "cloudflare.list_zones": {
      "title": "Listar zonas do Cloudflare"
    },
    "cloudflare.list_dns_records": {
      "title": "Listar registros DNS"
    },
    "cloudflare.create_dns_record": {
      "title": "Criar registro DNS"
    },
    "cloudflare.update_dns_record": {
      "title": "Atualizar registro DNS"
    },
    "cloudflare.delete_dns_record": {
      "title": "Deletar registro DNS"
    },
    "cloudflare.purge_cache": {
      "title": "Limpar cache do Cloudflare"
    },
    "cloudflare.get_zone_settings": {
      "title": "Visualizar configurações de zona"
    },
    "cloudflare.set_zone_setting": {
      "title": "Mudar configuração de zona"
    },
    "cloudflare.list_access_rules": {
      "title": "Listar regras de acesso IP"
    },
    "cloudflare.block_ip": {
      "title": "Bloquear IP no Cloudflare"
    },
    "cron.list": {
      "title": "Listar tarefas cron"
    },
    "cron.add": {
      "title": "Criar tarefa cron"
    },
    "cron.update": {
      "title": "Editar tarefa cron"
    },
    "cron.toggle": {
      "title": "Pausar/retomar tarefa cron"
    },
    "cron.remove": {
      "title": "Deletar tarefa cron"
    },
    "cron.ai_list": {
      "title": "Listar agentes IA programados"
    },
    "cron.ai_logs": {
      "title": "Listar execuções de um agente IA"
    },
    "cron.ai_read_log": {
      "title": "Ler execução de um agente IA"
    },
    "cron.ai_run": {
      "title": "Executar um agente IA programado agora"
    },
    "cron.ai_toggle": {
      "title": "Pausar/retomar um agente IA programado"
    },
    "cron.ai_add": {
      "title": "Criar agente IA programado"
    },
    "cron.ai_update": {
      "title": "Editar agente IA programado"
    },
    "cron.ai_remove": {
      "title": "Deletar agente IA programado"
    },
    "cron.presets_get": {
      "title": "Ler configuração de agentes (presets)"
    },
    "cron.presets_set": {
      "title": "Salvar configuração de agentes (presets)"
    },
    "dashboard.overview": {
      "title": "Visão geral do servidor"
    },
    "databases.list_engines": {
      "title": "Detectar mecanismos de banco de dados"
    },
    "databases.list_databases": {
      "title": "Listar bancos de dados"
    },
    "databases.list_tables": {
      "title": "Listar tabelas"
    },
    "databases.run_query": {
      "title": "Executar consulta SQL"
    },
    "expo.status": {
      "title": "Status do Expo"
    },
    "expo.account": {
      "title": "Conta do Expo"
    },
    "expo.list_projects": {
      "title": "Listar projetos Expo"
    },
    "expo.project_info": {
      "title": "Informação do projeto"
    },
    "expo.init_project": {
      "title": "Criar projeto Expo"
    },
    "expo.link_project": {
      "title": "Vincular projeto a EAS"
    },
    "expo.build": {
      "title": "Iniciar build EAS"
    },
    "expo.build_list": {
      "title": "Histórico de builds"
    },
    "expo.build_view": {
      "title": "Status da build"
    },
    "expo.build_cancel": {
      "title": "Cancelar build"
    },
    "expo.submit": {
      "title": "Enviar para loja"
    },
    "expo.dev_client": {
      "title": "Iniciar dev-client (QR)"
    },
    "expo.quota": {
      "title": "Cota de builds"
    },
    "expo.update": {
      "title": "Publicar atualização OTA"
    },
    "expo.env_list": {
      "title": "Listar variáveis EAS"
    },
    "expo.env_set": {
      "title": "Criar variável EAS"
    },
    "expo.set_google_credential": {
      "title": "Credencial da Play Store"
    },
    "expo.set_apple_credential": {
      "title": "Credencial da App Store"
    },
    "expo.webhook_create": {
      "title": "Registrar webhook EAS"
    },
    "expo.device_create": {
      "title": "Registrar dispositivo iOS"
    },
    "files.read": {
      "title": "Ler arquivo"
    },
    "files.list_dir": {
      "title": "Listar diretório"
    },
    "files.grep": {
      "title": "Buscar em arquivos"
    },
    "files.project_info": {
      "title": "Detectar tipo de projeto"
    },
    "files.security_scan": {
      "title": "Scan heurístico de segurança"
    },
    "files.write": {
      "title": "Escrever arquivo"
    },
    "files.mkdir": {
      "title": "Criar pasta"
    },
    "files.delete": {
      "title": "Deletar arquivo ou pasta"
    },
    "files.rename": {
      "title": "Renomear ou mover"
    },
    "files.copy": {
      "title": "Copiar arquivo"
    },
    "files.chmod": {
      "title": "Mudar permissões (chmod)"
    },
    "files.chown": {
      "title": "Mudar proprietário (chown)"
    },
    "firewall.ufw_status": {
      "title": "Status do UFW"
    },
    "firewall.fail2ban_status": {
      "title": "Status do fail2ban (jails)"
    },
    "hosting.list_accounts": {
      "title": "Listar contas de hosting"
    },
    "hosting.list_audit": {
      "title": "Visualizar log de auditoria de uma conta de hosting"
    },
    "hosting.account_stats": {
      "title": "Estatísticas de uso de uma conta de hosting"
    },
    "mail.list_domains": {
      "title": "Domínios disponíveis"
    },
    "mail.list_messages": {
      "title": "Listar mensagens da caixa de correio"
    },
    "mail.fetch_message": {
      "title": "Ler mensagem completa"
    },
    "mail.move_messages": {
      "title": "Mover mensagens para quarentena"
    },
    "mail.flag_messages": {
      "title": "Marcar mensagens"
    },
    "mail.delete_messages": {
      "title": "Deletar mensagens (permanente)"
    },
    "module-dev.validate_manifest": {
      "title": "Validar manifest"
    },
    "module-dev.run_checks": {
      "title": "Verificações estáticas do módulo"
    },
    "module-dev.run_tests": {
      "title": "Executar testes do módulo"
    },
    "module-dev.list_modules": {
      "title": "Meus módulos do marketplace"
    },
    "module-dev.module_status": {
      "title": "Status do módulo"
    },
    "module-dev.submit_module": {
      "title": "Enviar módulo para revisão"
    },
    "module-dev.resubmit_module": {
      "title": "Reenviar módulo corrigido"
    },
    "module-dev.unpublish_module": {
      "title": "Despublicar módulo"
    },
    "module-dev.republish_module": {
      "title": "Republicar módulo"
    },
    "module-dev.preview_install": {
      "title": "Instalar preview (Modo B)"
    },
    "module-dev.preview_uninstall": {
      "title": "Desinstalar preview"
    },
    "module-dev.link_project": {
      "title": "Vincular projeto ↔ módulo"
    },
    "monitor.cpu_top": {
      "title": "Principais processos de CPU"
    },
    "monitor.watchdog_status": {
      "title": "Status de reinicialização automática"
    },
    "monitor.watchdog_configure": {
      "title": "Configurar reinicialização automática"
    },
    "nginx.list_sites": {
      "title": "Listar sites nginx"
    },
    "nginx.tail_access_log": {
      "title": "Tail access.log"
    },
    "obsidian.list_vaults": {
      "title": "Listar vaults"
    },
    "obsidian.list_notes": {
      "title": "Listar notas"
    },
    "obsidian.read_note": {
      "title": "Ler nota"
    },
    "obsidian.search_notes": {
      "title": "Buscar em notas"
    },
    "obsidian.backlinks": {
      "title": "Backlinks de nota"
    },
    "obsidian.write_note": {
      "title": "Escrever nota"
    },
    "obsidian.append_note": {
      "title": "Anexar a nota"
    },
    "obsidian.daily_note": {
      "title": "Nota diária"
    },
    "obsidian.delete_note": {
      "title": "Deletar nota"
    },
    "obsidian.list_containers": {
      "title": "Listar containers de contexto"
    },
    "obsidian.sync_containers": {
      "title": "Sincronizar containers de contexto"
    },
    "openclaw.config": {
      "title": "Configuração do OpenClaw"
    },
    "openclaw.test_connection": {
      "title": "Testar conexão OpenClaw"
    },
    "security-audit.last_report": {
      "title": "Último relatório de auditoria"
    },
    "security-audit.ssh_posture": {
      "title": "Postura SSH do servidor"
    },
    "server-alerts.send": {
      "title": "Enviar notificação ao servidor"
    },
    "server-alerts.list_rules": {
      "title": "Listar regras de alerta"
    },
    "server-alerts.create_rule": {
      "title": "Criar regra de alerta"
    },
    "users.list": {
      "title": "Listar usuários do painel"
    },
    "users.create": {
      "title": "Criar usuário"
    },
    "users.update": {
      "title": "Editar usuário"
    },
    "users.delete": {
      "title": "Deletar usuário"
    },
    "users.groups_list": {
      "title": "Listar grupos com permissões"
    },
    "users.group_create": {
      "title": "Criar grupo"
    },
    "users.group_update": {
      "title": "Editar grupo"
    },
    "users.group_delete": {
      "title": "Deletar grupo"
    },
    "webhooks.list": {
      "title": "Listar webhooks configurados"
    }
  },
  "dataPanelCatalog": {
    "admin.health": {
      "title": "Saúde do servidor",
      "description": "Sondagem rápida de alcançabilidade / carga do alvo conectado — útil como contexto de prompt de sistema antes de responder questões operacionais."
    },
    "dashboard.snapshot": {
      "title": "Visão geral compacta",
      "description": "Resumo pré-prompt compacto do alvo conectado: carga, RAM%, disco raiz%, e quantos serviços-chave estão sendo executados."
    },
    "monitor.snapshot": {
      "title": "Snapshot do sistema",
      "description": "Resumo de recursos atual para o alvo conectado: uso de CPU %, média de carga, memória usada / total, uso do filesystem raiz."
    },
    "obsidian.vaults_summary": {
      "title": "Resumo de vaults",
      "description": "Vaults do Obsidian registrados no servidor conectado com seu caminho, existência e contagem de notas markdown."
    }
  },
  "structurePanel": {
    "editorLoading": "Carregando editor...",
    "loading": "Carregando...",
    "createdNotice": "Criado(s) {count} item(ns).",
    "nothingToCreate": "Nada para criar (já existia).",
    "savedNotice": "Salvo {rel}.",
    "noActiveProviders": "Nenhum provedor de IA está ativo. Ative um em Provedores.",
    "improvedNotice": "Melhorado com IA. Revise o diff e clique em Salvar se gostar.",
    "noAiChanges": "A IA não propôs alterações.",
    "structureLoading": "Analisando estrutura...",
    "retry": "Tentar novamente",
    "copyAllContent": "Copiar todo o conteúdo",
    "copied": "Copiado",
    "copy": "Copiar",
    "downloadFile": "Baixar arquivo",
    "download": "Baixar",
    "diff": "Diff",
    "originalDiffTitle": "Visualizar diferenças contra o conteúdo original",
    "back": "Voltar",
    "improveContentTitle": "Melhore o conteúdo com IA usando o contexto do projeto",
    "improving": "Melhorando...",
    "improveWithAi": "Melhorar com IA",
    "cancel": "Cancelar",
    "saving": "Salvando...",
    "save": "Salvar",
    "chooseProvider": "Escolha o provedor de IA",
    "close": "Fechar",
    "noModel": "(sem modelo)",
    "directory": "Diretório",
    "structureCount": "Estrutura · {count} para criar",
    "markMissing": "Marcar faltante",
    "creating": "Criando...",
    "create": "Criar ({count})",
    "expand": "Expandir",
    "collapse": "Recolher",
    "edit": "Editar",
    "exists": "Existe",
    "createLabel": "criar",
    "fallbackFilename": "arquivo.txt",
    "structureHints": {
      "claude": "Instruções, configuração, regras, comandos, skills, agentes e hooks que o Claude Code lê do diretório do projeto.",
      "codex": "O Codex CLI lê AGENTS.md como guia do projeto e .codex/ para configuração e prompts.",
      "gemini": "O Gemini CLI lê GEMINI.md como contexto do projeto e .gemini/ para configuração e comandos."
    },
    "structureNodes": {
      "CLAUDE.md": "Instruções do projeto (contexto, comandos, convenções)",
      "CLAUDE.local.md": "Instruções locais (não commitar; preferências pessoais)",
      ".mcp.json": "Servidores MCP do projeto",
      ".claude/settings.json": "Configuração do projeto (versionada)",
      ".claude/settings.local.json": "Configuração local (não versionada)",
      ".claude/rules": "Regras reutilizáveis",
      ".claude/rules/code-style.md": "Regra: estilo de código",
      ".claude/rules/testing.md": "Regra: testes",
      ".claude/rules/api-conventions.md": "Regra: convenções de API",
      ".claude/commands": "Comandos de barra personalizados",
      ".claude/commands/review.md": "Comando /review",
      ".claude/commands/fix-issue.md": "Comando /fix-issue",
      ".claude/skills": "Skills do projeto",
      ".claude/skills/deploy": "Skill: deploy",
      ".claude/skills/deploy/SKILL.md": "Definição da skill de deploy",
      ".claude/skills/deploy/deploy-config.md": "Configuração da skill de deploy",
      ".claude/agents": "Subagentes especializados",
      ".claude/agents/code-reviewer.md": "Agente: revisor de código",
      ".claude/agents/security-auditor.md": "Agente: auditor de segurança",
      ".claude/hooks": "Hooks (scripts de ciclo de vida)",
      ".claude/hooks/validate-bash.sh": "Hook: validar comandos bash",
      "AGENTS.md": "Guia do projeto para Codex/agentes",
      ".codex": "Configuração do Codex",
      ".codex/config.toml": "Configuração do projeto Codex",
      ".codex/prompts": "Prompts/modelos reutilizáveis",
      ".codex/prompts/review.md": "Prompt: revisão de código",
      "GEMINI.md": "Contexto do projeto para Gemini",
      ".gemini": "Configuração do Gemini",
      ".gemini/settings.json": "Configuração do projeto Gemini",
      ".gemini/commands": "Comandos personalizados",
      ".gemini/commands/review.toml": "Comando: review",
      "modules/*": "Raiz do módulo do marketplace",
      "modules/*/module.manifest.json": "Manifesto rascunho (os campos AUTO são definidos pela plataforma)",
      "modules/*/backend/index.js": "Backend do módulo — esqueleto SDK defineModule()",
      "modules/*/frontend": "Frontend do módulo (Astro, opcional)",
      "modules/*/README.md": "README do módulo",
      ".claude/rules/marketplace.md": "Regra: arquitetura do marketplace (manifesto, SDK, capacidades)",
      "MARKETPLACE.md": "Regras de arquitetura do marketplace (manifesto, SDK, capacidades)"
    }
  },
  "mcpConfigPanel": {
    "noInstallResponse": "Sem resposta de instalação",
    "summaryTitle": "Expor capacidades do painel ao CLI (MCP)",
    "optional": "opcional",
    "description": "Conecte o CLI {providerId} com as ferramentas do painel. O painel escreve a configuração diretamente no servidor de destino; você não precisa copiar nada.",
    "configuredTitle": "Configurado no destino",
    "tokenValidUntil": "Token válido até {date}.",
    "restartCli": "Reinicie o CLI no terminal para que ele carregue o novo servidor MCP.",
    "configuring": "Configurando...",
    "configureAutomatically": "Configurar automaticamente",
    "regenerate": "Regenerar token e reconfigurar",
    "manualTitle": "Configuração manual (avançado)",
    "generating": "Gerando...",
    "generateManualSnippet": "Gerar snippet manual",
    "fileLabel": "Arquivo",
    "snippetLabel": "Snippet ({format})",
    "copy": "Copiar",
    "mcpUrlLabel": "URL MCP"
  },
  "conversationMedia": {
    "download": "Baixar",
    "close": "Fechar",
    "previous": "Anterior",
    "next": "Próximo",
    "all": "Todos",
    "images": "Imagens",
    "documents": "Documentos",
    "attachmentsTitle": "Anexos da conversa",
    "emptyConversation": "Nenhum anexo nesta conversa.",
    "imagesSection": "Imagens",
    "documentsSection": "Documentos",
    "clickToExpand": "clique para expandir",
    "emptyImages": "Nenhuma imagem.",
    "emptyDocuments": "Nenhum documento.",
    "mediaTitle": "Multimídia",
    "attachToChat": "Anexar ao chat",
    "uploadToChat": "Carregar ficheiros na conversa",
    "attachFailed": "Não foi possível anexar o ficheiro à conversa."
  },
  "teamBoard": {
    "title": "Equipe trabalhando",
    "progressOf": "{done} de {total} tarefas concluídas",
    "statusPending": "Pendente",
    "statusRunning": "Em andamento",
    "statusDone": "Concluída",
    "statusFailed": "Falhou",
    "statusCanceled": "Cancelada",
    "pendingPermission": "Aguardando sua aprovação",
    "openChat": "Abrir chat",
    "cancel": "Cancelar tarefa",
    "cancelConfirm": "Cancelar esta tarefa? O agente deixará de trabalhar nela.",
    "assignedTo": "Atribuída a {agent}",
    "autoTurn": "Aviso automático da equipe",
    "dashboardTitle": "Equipes trabalhando",
    "tokensSummary": "Tokens: {total} (líder {leader} · equipe {workers})",
    "lessThan1s": "<1 s",
    "insertions": "+{count}",
    "deletions": "-{count}",
    "close": "Fechar",
    "statusQueued": "Na fila",
    "addTaskSubmit": "Atribuir",
    "loading": "Carregando…",
    "verifyPassed": "Verificado",
    "verifyFailed": "Falha na verificação ({attempts})",
    "filesChanged": "{count} ficheiro(s)",
    "diffTitle": "Alterações da tarefa",
    "diffUnavailable": "Não há diferenças disponíveis para esta tarefa (sem worktree ou alterações).",
    "diffTruncated": "Diferenças truncadas: a tarefa alterou mais conteúdo do que o apresentado.",
    "branchIntegrated": "Ramo integrado",
    "cancelAll": "Cancelar tudo",
    "cancelAllConfirm": "Cancelar TODAS as tarefas em curso? O plano ativo será marcado como falhado.",
    "addTask": "Adicionar tarefa",
    "addTaskTitle": "Atribuir uma tarefa a um subordinado",
    "addTaskWorker": "Subordinado",
    "addTaskWorkerPlaceholder": "— Escolher agente —",
    "addTaskNoWorkers": "Este líder não tem subordinados diretos.",
    "addTaskInstruction": "Instrução",
    "addTaskInstructionHint": "O agente não vê esta conversa; inclui TODO o contexto necessário.",
    "addTaskTitleField": "Título (opcional)",
    "addTaskProject": "Projeto (opcional)",
    "addTaskProjectNone": "— Sem projeto —",
    "addTaskSubmitting": "A atribuir…",
    "feedbackUp": "Bom resultado",
    "feedbackDown": "Mau resultado",
    "orgChart": "Organograma",
    "tokensChipTitle": "Tokens utilizados nesta tarefa",
    "verifyRunning": "A verificar…",
    "viewDiff": "Ver diferenças"
  },
  "agentInfo": {
    "roleLabel": "Função",
    "roleTooltip": "Função do agente: {role}",
    "providerLabel": "Provedor",
    "providerModelTooltip": "Provedor {provider} · Modelo {model}",
    "projectLabel": "Projeto",
    "projectTooltip": "Projeto: {project}"
  },
  "mermaidDiagram": {
    "zoomOut": "Reduzir zoom",
    "zoomIn": "Aumentar zoom",
    "zoomReset": "Redefinir zoom"
  },
  "assistantErrorBoundary": {
    "errorMessage": "O assistente teve um erro ao carregar.",
    "retry": "Tentar de novo"
  }
} as const;

export default assistantPart3;
