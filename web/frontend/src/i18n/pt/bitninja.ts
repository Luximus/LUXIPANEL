const bitninja = {
  "header": {
    "description": "Agente de segurança abrangente (WAF, anti-DoS, detecção de malware e reputação de IP) no servidor conectado.",
    "statusChecking": "verificando…"
  },
  "sudo": {
    "label": "Senha sudo (passphrase da sua sessão)",
    "placeholder": "Somente se o servidor solicitar para sudo",
    "hint": "Usada apenas para esta ação e nunca salva no navegador."
  },
  "installCard": {
    "title": "BitNinja não está instalado",
    "description": "Insira a license key da sua conta BitNinja para instalar o agente neste servidor. O instalador oficial (get.bitninja.io) é baixado e executado com sudo.",
    "licensePlaceholder": "License key (ex: ab12cd34-…)",
    "installButton": "Instalar BitNinja"
  },
  "stats": {
    "service": "Serviço",
    "license": "Licença",
    "version": "Versão"
  },
  "serviceControl": {
    "title": "Controle do serviço",
    "start": "Iniciar",
    "restart": "Reiniciar",
    "stop": "Parar"
  },
  "components": {
    "title": "Componentes de proteção",
    "checking": "verificando…",
    "noReported": "O agente não reportou componentes.",
    "active": "Ativo",
    "inactive": "Inativo"
  },
  "updateLicense": {
    "title": "Atualizar license key",
    "placeholder": "Nova license key",
    "applyButton": "Aplicar"
  },
  "toasts": {
    "sudoRequired": "Digite sua senha sudo e tente novamente.",
    "sudoInvalid": "Senha sudo inválida.",
    "actionFailed": "A ação falhou. Verifique a saída.",
    "installing": "Instalando BitNinja… pode levar alguns minutos.",
    "installed": "BitNinja instalado.",
    "serviceAction": "Serviço: {action} OK.",
    "componentToggleEnabled": "{component}: ativado.",
    "componentToggleDisabled": "{component}: desativado.",
    "licenseApplied": "Chave de licença aplicada."
  },
  "errors": {
    "unknown": "Erro desconhecido"
  },
  "status": {
    "notInstalled": "Não instalado",
    "running": "Ativo",
    "installedStopped": "Instalado (parado)",
    "serviceRunning": "Em execução",
    "serviceStopped": "Parado",
    "licenseValid": "Válida",
    "licenseReview": "Revisar"
  },
  "validation": {
    "licenseKeyRequired": "Digite a chave de licença.",
    "newLicenseKeyRequired": "Digite a nova chave de licença."
  },
  "settingsUi": {
    "settingsTitle": "Definições do BitNinja",
    "settingsButton": "Definições",
    "settingsDescription": "Preferências de diagnóstico do servidor ativo.",
    "settingsSections": "Secções das definições do BitNinja",
    "diagnostics": "Diagnóstico",
    "related": "Relacionados",
    "logSource": "O registo é lido do serviço BitNinja no servidor selecionado.",
    "autoRefresh": "Atualizar o estado a cada 30 segundos",
    "logLines": "Linhas do registo",
    "relatedModules": "Módulos relacionados",
    "firewallAudit": "Firewall e auditoria",
    "credentials": "Credenciais do BitNinja"
  },
  "logsUi": {
    "loading": "Carregando registro…",
    "empty": "Não há eventos recentes.",
    "loadError": "Não foi possível carregar o registro.",
    "logsTitle": "Registo recente",
    "logsDescription": "Eventos do serviço no servidor ativo.",
    "refreshLogs": "Atualizar registo",
    "logsHint": "Selecione «Atualizar registo» para carregar os eventos."
  }
} as const;

export default bitninja;
