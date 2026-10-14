const firewall = {
  "pageTitle": "Firewall",
  "installWarning": {
    "title": "Componentes do firewall não detectados",
    "description": "O gerenciador de pacotes (apt/dnf/apk/...) será executado com configuração padrão e os serviços serão habilitados ao término.",
    "btnInstall": "Instalar agora"
  },
  "statusCard": {
    "label": "Estado do Firewall (UFW)",
    "verifying": "Verificando...",
    "btnDisable": "Desativar",
    "btnEnable": "Ativar"
  },
  "securityAudit": {
    "title": "Auditoria de Segurança (Premium)",
    "btnStartAudit": "Iniciar análise",
    "scannerChecking": "verificando…",
    "btnInstallScanner": "Instalar",
    "scanProgress": "Progresso da verificação",
    "scanAi": "Análise IA: 0%",
    "noReports": "Não há auditorias concluídas. Inicie uma nova para começar."
  },
  "ufwRules": {
    "title": "Regras UFW",
    "btnNewRule": "Nova regra",
    "loading": "Carregando regras...",
    "btnAllowCloudflare": "Permitir Cloudflare",
    "searchLabel": "Buscar regra",
    "searchPlaceholder": "Buscar porta, IP ou comentário…"
  },
  "fail2ban": {
    "btnBanIp": "Banir IP",
    "loading": "Carregando jails..."
  },
  "ruleDialog": {
    "title": "Nova regra UFW",
    "labelAction": "Ação",
    "optionAllow": "Permitir",
    "optionDeny": "Negar",
    "optionReject": "Rejeitar",
    "labelProtocol": "Protocolo",
    "optionAny": "Qualquer",
    "labelPort": "Porta",
    "placeholderPort": "25 ou 8080:8090",
    "labelFromIp": "A partir do IP",
    "placeholderFromIp": "any ou 192.168.0.0/24",
    "labelComment": "Comentário (opcional)",
    "placeholderComment": "SMTP de entrada",
    "btnCancel": "Cancelar",
    "btnAdd": "Adicionar regra"
  },
  "banDialog": {
    "title": "Banir IP manualmente",
    "labelIp": "Endereço IP",
    "placeholderIp": "192.168.1.100",
    "labelJail": "Jail",
    "btnCancel": "Cancelar",
    "btnBan": "Banir"
  },
  "auditReportDialog": {
    "title": "Relatório de auditoria de segurança",
    "btnClose": "Fechar"
  },
  "aiAssistant": {
    "btnSuggestRules": "Sugerir regras (IA)",
    "btnSuggestBans": "Sugerir banimentos (IA)",
    "btnAnalyze": "Análise IA",
    "promptUfw": "Analise o firewall UFW do servidor conectado: reveja o estado e as regras atuais (use a ferramenta firewall.ufw_status) e sugira regras UFW inteligentes para melhorar a segurança sem quebrar os serviços em uso. Para cada regra proposta, explique o porquê e inclua o comando `ufw` exato para aplicá-la.",
    "promptFail2ban": "Analise o Fail2ban no servidor conectado: reveja as jails configuradas e os IPs banidos (use a ferramenta firewall.fail2ban_status) e sugira banimentos e melhorias de configuração para protegê-lo contra ataques de força bruta. Indique jail, IP/intervalo e motivo, e os comandos para aplicá-los.",
    "promptAnalyze": "Faça uma análise geral de segurança do firewall no servidor conectado. Revise o estado do UFW e do Fail2ban (use as ferramentas firewall.ufw_status e firewall.fail2ban_status), identifique riscos, portas expostas e configurações fracas, e entregue recomendações priorizadas com os comandos para aplicá-las.",
    "analyzeRule": "Analisar com IA",
    "promptRule": "Analise esta regra UFW existente no servidor conectado. Explique qual tráfego ela permite ou bloqueia, avalie seus riscos e recomende se deve ser mantida, ajustada ou substituída. Se propuser mudanças, inclua os comandos exatos.\n\nRegra #{number}\nAção: {action}\nDestino/porta: {to}\nOrigem: {from}\nProtocolo: {proto}\nComentário: {comment}"
  },
  "labels": {
    "active": "Ativo",
    "inactive": "Inativo",
    "bannedCount": "{count} bloqueadas",
    "moreIps": "+{n} mais",
    "installingText": "Instalando UFW e Fail2ban… pode levar alguns minutos.",
    "installSuccessText": "Firewall instalado com sucesso.",
    "cfEdgeBlockQuestion": "Bloquear {ip} também no Cloudflare edge?",
    "findingsCount": "{n} constatações encontradas",
    "completedAt": "Concluído em {time}",
    "scanAiProgress": "Análise IA: {pct}%",
    "overallRisk": "Risco Geral",
    "unknown": "DESCONHECIDO",
    "keyThreats": "Ameaças principais",
    "recommendations": "Recomendações",
    "findingsTitle": "Constatações ({n})",
    "moreFindingsCount": "+{n} constatações mais",
    "from": "de",
    "any": "qualquer",
    "scanBitNinjaProgress": "BitNinja: {pct}%",
    "scanLynisProgress": "Lynis: {pct}%",
    "scanRkhunterProgress": "Rkhunter: {pct}%",
    "scanChkrootkitProgress": "Chkrootkit: {pct}%"
  },
  "empty": {
    "noRules": "Sem regras",
    "noJails": "Sem jails ativos"
  },
  "actions": {
    "unban": "desbloquear",
    "blockInCloudflare": "Bloquear no Cloudflare",
    "dismiss": "Descartar"
  },
  "confirm": {
    "deleteRuleMsg": "Excluir a regra #{number}?",
    "deleteRuleTitle": "Excluir regra",
    "disableFwMsg": "Desativar o firewall? O servidor ficará sem proteção de rede.",
    "disableFwTitle": "Desativar firewall",
    "disableFwBtn": "Sim, desativar",
    "cfAllowMsg": "Regras UFW serão adicionadas para permitir 80/443 dos intervalos oficiais de Cloudflare. Continuar?",
    "cfAllowTitle": "Permitir IPs da Cloudflare",
    "cfAllowBtn": "Continuar"
  },
  "toasts": {
    "ruleDeleted": "Regra excluída",
    "errorDelete": "Erro ao excluir",
    "ipUnbanned": "{ip} desbloqueada",
    "errorUnban": "Erro ao desbloquear",
    "fwEnabled": "Firewall ativado",
    "errorEnable": "Erro ao ativar",
    "fwDisabled": "Firewall desativado",
    "errorDisable": "Erro ao desativar",
    "fwInstalled": "Firewall instalado",
    "ruleAdded": "Regra adicionada",
    "ipBanned": "{ip} banido em {jail}",
    "errorBan": "Erro ao banir",
    "cfRulesApplied": "Regras do Cloudflare aplicadas ({applied})",
    "errorCfRules": "Erro ao aplicar regras do Cloudflare",
    "errorStartAudit": "Erro ao iniciar auditoria",
    "auditCompleted": "Auditoria concluída",
    "auditFailed": "Auditoria falhou",
    "errorLoadReport": "Erro ao carregar relatório",
    "reportOf": "Relatório de {date}"
  },
  "errors": {
    "addRule": "Erro ao adicionar regra"
  },
  "runtime": {
    "statusError": "Não foi possível consultar o estado",
    "rulesLoadError": "Não foi possível carregar as regras.",
    "noMatchingRules": "Nenhuma regra corresponde ao filtro.",
    "loggingSaved": "Nível de registro salvo.",
    "loggingSaveError": "Não foi possível salvar o nível de registro."
  },
  "settingsUi": {
    "rulesView": "Visualização de regras",
    "ufwLog": "Registro UFW",
    "related": "Relacionados",
    "title": "Configurações do firewall",
    "description": "Filtros pessoais e registro UFW do servidor ativo.",
    "sectionsLabel": "Seções de configuração do firewall",
    "showActions": "Mostrar ações",
    "all": "Todas",
    "limit": "Limitar",
    "serverSettingHint": "Esta configuração altera o servidor ativo.",
    "logLevel": "Nível de registro",
    "off": "Desativado",
    "low": "Baixo",
    "medium": "Médio",
    "high": "Alto",
    "full": "Completo",
    "saveLevel": "Salvar nível",
    "relatedModules": "Módulos relacionados"
  }
} as const;

export default firewall;
