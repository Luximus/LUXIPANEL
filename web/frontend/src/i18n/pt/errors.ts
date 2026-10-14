const errors = {
  "networkError": {
    "serverError": "O servidor retornou um erro {status} (a operação pode ter expirado).",
    "invalidResponse": "Resposta inválida do servidor.",
    "connectionFailed": "Não foi possível ligar ao servidor. Verifique a ligação e tente novamente.",
    "targetScopeChanged": "O servidor selecionado mudou; recarregue a página.",
    "bridgeSessionRequired": "Selecione ou volte a ligar um servidor para continuar."
  },
  "error400": {
    "code": "400",
    "title": "Solicitação inválida",
    "description": "A solicitação enviada contém parâmetros inválidos. Verifique os dados e tente novamente."
  },
  "error401": {
    "code": "401",
    "title": "Não autorizado",
    "description": "Você precisa fazer login para acessar este recurso. Por favor, faça login."
  },
  "error403": {
    "code": "403",
    "title": "Acesso proibido",
    "description": "Você não tem permissões para acessar este recurso."
  },
  "error404": {
    "code": "404",
    "title": "Página não encontrada",
    "description": "O caminho que você busca não existe ou foi movido. Verifique a URL ou volte ao início."
  },
  "error500": {
    "code": "500",
    "title": "Erro interno do servidor",
    "description": "Algo deu errado em nosso servidor. Estamos trabalhando para resolver. Tente mais tarde."
  },
  "error503": {
    "code": "503",
    "title": "Serviço indisponível",
    "description": "O servidor está em manutenção ou sobrecarregado. Por favor, tente mais tarde."
  },
  "home": "Ir ao Início",
  "back": "Voltar",
  "backToServers": "Voltar aos servidores"
} as const;

export default errors;
