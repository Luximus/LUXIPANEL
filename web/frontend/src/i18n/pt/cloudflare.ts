const cloudflare = {
  "options": {
    "essentiallyOff": "Praticamente desativado",
    "low": "Baixo",
    "medium": "Médio",
    "high": "Alto"
  },
  "pageTitle": "Cloudflare",
  "header": {
    "heading": "Cloudflare",
    "subheading": "Gerencie DNS, cache, SSL/TLS e segurança das suas zonas do Cloudflare para este servidor."
  },
  "config": {
    "title": "Conexão com o Cloudflare",
    "tokenLabel": "API Token",
    "tokenPlaceholder": "Token de API do Cloudflare",
    "tokenHint": "Crie um token em dash.cloudflare.com → My Profile → API Tokens com permissões de zona: DNS, Cache Purge, Zone Settings e Firewall Services.",
    "save": "Salvar",
    "test": "Testar conexão",
    "clear": "Remover token",
    "tokenSet": "Token configurado",
    "tokenMissing": "Configure um API Token para começar",
    "saved": "Token salvo",
    "cleared": "Token removido",
    "confirmClear": "Remover o token do Cloudflare?",
    "confirmClearBtn": "Remover"
  },
  "zones": {
    "title": "Zona",
    "select": "Selecione uma zona",
    "empty": "Não há zonas visíveis com este token.",
    "status": "Status",
    "plan": "Plano",
    "nameServers": "Name servers",
    "domainNotFound": "O domínio {domain} não pertence a nenhuma zona do token"
  },
  "runtime": {
    "active": "Ativa",
    "pending": "Pendente",
    "initializing": "Inicializando",
    "moved": "Movida",
    "paused": "pausada",
    "pausedHint": "Zona pausada: revise a configuração antes de alterar o DNS.",
    "inactiveHint": "Zona {status}: confira os servidores de nomes no registrador.",
    "activeHint": "Zona ativa · {count} servidores de nomes configurados."
  },
  "tabs": {
    "dns": "DNS",
    "cache": "Cache",
    "security": "SSL / Segurança",
    "access": "Regras de acesso",
    "config": "Configurações"
  },
  "dns": {
    "title": "Registos DNS",
    "add": "Adicionar registro",
    "type": "Tipo",
    "name": "Nome",
    "content": "Conteúdo",
    "ttl": "TTL",
    "proxied": "Proxy",
    "pointsToServer": "Aponta para este servidor",
    "edit": "Editar",
    "delete": "Excluir",
    "confirmDelete": "Excluir o registro {name}?",
    "saved": "Registro salvo",
    "deleted": "Registro excluído",
    "useServerIp": "Usar IP do servidor",
    "priority": "Prioridade",
    "confirmDeleteTitle": "Deletar registro",
    "typeA": "A",
    "typeAAAA": "AAAA",
    "typeCNAME": "CNAME",
    "typeTXT": "TXT",
    "typeMX": "MX",
    "typeNS": "NS",
    "ttlAuto": "Auto",
    "ttl60": "60",
    "ttl300": "300",
    "ttl1800": "1800",
    "ttl3600": "3600",
    "ttl86400": "86400"
  },
  "cache": {
    "title": "Cache",
    "purgeAll": "Limpar tudo",
    "purgeAllHint": "Remove todo o conteúdo em cache da zona no Cloudflare.",
    "confirmPurgeAll": "Limpar TODO o cache da zona?",
    "purgeUrls": "Limpar URLs",
    "purgeUrlsPlaceholder": "https://exemplo.com/estilos.css (uma URL por linha)",
    "purged": "Cache limpo",
    "devMode": "Modo de desenvolvimento",
    "devModeHint": "Desativa temporariamente o cache do Cloudflare (desliga sozinho após 3 horas).",
    "confirmPurgeTitle": "Limpar cache",
    "confirmPurgeBtn": "Limpar"
  },
  "security": {
    "title": "SSL / Segurança",
    "sslMode": "Modo SSL/TLS",
    "alwaysHttps": "Sempre HTTPS",
    "securityLevel": "Nível de segurança",
    "underAttack": "Modo sob ataque",
    "updated": "Configuração atualizada",
    "sslOff": "Desativado",
    "sslFlexible": "Flexível",
    "sslFull": "Completo",
    "sslFullStrict": "Completo (rigoroso)"
  },
  "access": {
    "title": "Regras de acesso por IP",
    "add": "Adicionar regra",
    "mode": "Ação",
    "block": "Bloquear",
    "allow": "Permitir",
    "challenge": "Desafio",
    "ip": "IP / intervalo",
    "notes": "Notas",
    "empty": "Sem regras de acesso nesta zona.",
    "confirmDelete": "Excluir a regra para {ip}?",
    "created": "Regra criada",
    "deleted": "Regra excluída",
    "ipHeader": "IP",
    "confirmDeleteTitle": "Deletar regra"
  },
  "common": {
    "loading": "Carregando...",
    "error": "Erro",
    "save": "Salvar",
    "cancel": "Cancelar",
    "delete": "Excluir",
    "refresh": "Atualizar",
    "serverIp": "IP do servidor",
    "noToken": "Configure o API Token do Cloudflare na aba Configurações."
  },
  "settingsUi": {
    "title": "Configurações do Cloudflare",
    "description": "Preferências das tabelas do módulo Cloudflare.",
    "access": "Acesso",
    "credentialsConnections": "Credenciais e conexões",
    "cloudflareToken": "Token do Cloudflare",
    "serverFirewall": "Firewall do servidor",
    "dnsWebhooks": "Eventos DNS em Webhooks"
  }
} as const;

export default cloudflare;
