const servers = {
  "pageTitle": "Servidores",
  "description": "Registo local dos destinos SSH aos quais este painel pode ligar-se. Os segredos (chaves e palavras-passe) são guardados de forma cifrada e nunca são mostrados aqui.",
  "btnNew": "Adicionar servidor",
  "table": {
    "name": "Nome",
    "host": "Host",
    "username": "Utilizador",
    "authType": "Autenticação",
    "status": "Estado"
  },
  "authTypes": {
    "key": "Chave SSH",
    "password": "Palavra-passe"
  },
  "status": {
    "approved": "Aprovado",
    "pending": "Pendente",
    "untested": "Não testado"
  },
  "common": {
    "test": "Testar",
    "edit": "Editar",
    "delete": "Eliminar",
    "cancel": "Cancelar",
    "save": "Guardar",
    "close": "Fechar",
    "error": "Erro",
    "yes": "Sim",
    "no": "Não"
  },
  "dialog": {
    "titleNew": "Adicionar servidor",
    "titleEdit": "Editar servidor",
    "name": "Nome",
    "namePlaceholder": "O meu servidor de produção",
    "host": "Host ou IP",
    "hostPlaceholder": "203.0.113.10 ou servidor.exemplo.com",
    "port": "Porta",
    "username": "Utilizador",
    "usernamePlaceholder": "root",
    "authType": "Tipo de autenticação",
    "secretKey": "Chave privada SSH",
    "secretKeyPlaceholder": "-----BEGIN OPENSSH PRIVATE KEY-----",
    "passphrase": "Frase de acesso da chave (opcional)",
    "passphrasePlaceholder": "Frase de acesso para desbloquear a chave",
    "secretPassword": "Palavra-passe",
    "secretPasswordPlaceholder": "Palavra-passe do utilizador SSH",
    "secretKeepHint": "Deixe em branco para manter o segredo atual.",
    "btnCancel": "Cancelar",
    "btnSave": "Guardar"
  },
  "fingerprint": {
    "title": "Aprovar impressão digital do host",
    "intro": "Esta é a primeira ligação a este servidor. Antes de aprovar, confirme que a impressão digital da chave do host corresponde à esperada.",
    "approve": "Aprovar impressão digital",
    "approving": "A aprovar…",
    "approved": "Impressão digital aprovada",
    "approveError": "Não foi possível aprovar a impressão digital"
  },
  "toasts": {
    "created": "Servidor adicionado",
    "updated": "Servidor atualizado",
    "deleted": "Servidor eliminado",
    "testOk": "Ligação bem-sucedida",
    "testFailed": "Falha na ligação"
  },
  "validation": {
    "nameRequired": "Indique um nome",
    "hostRequired": "Indique o host",
    "usernameRequired": "Indique o utilizador",
    "secretRequired": "Indique o segredo de autenticação"
  },
  "confirmDelete": "Eliminar o servidor {name}? Esta ação não pode ser anulada.",
  "confirmDeleteTitle": "Eliminar servidor",
  "testing": "A testar a ligação…"
} as const;

export default servers;
