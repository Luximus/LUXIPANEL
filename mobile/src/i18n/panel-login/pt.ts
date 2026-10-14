const login = {
  "pageTitle": "Entrar",
  "panelSubtitle": "Painel de administração",
  "authError": "Erro de autenticação",
  "forgotPassword": "Esqueci minha senha",
  "forgotHint": "Digite seu e-mail e enviaremos um link para alterar sua senha.",
  "backToLogin": "Voltar ao login",
  "recoverLinkSent": "Se o e-mail existir, enviamos um link de recuperação.",
  "recoverLinkError": "Não foi possível enviar o link de recuperação.",
  "languageLabel": "Idioma",
  "hostLabelFallback": "este painel",
  "tabs": {
    "password": "Senha",
    "passkey": "Passkey",
    "recovery": "Recuperação"
  },
  "labels": {
    "user": "Usuário",
    "password": "Senha",
    "sshPassphrase": "Passphrase da chave SSH",
    "remember": "Lembrar-me",
    "email": "E-mail",
    "recoveryCode": "Código de recuperação",
    "code6Digits": "Código de 6 dígitos"
  },
  "placeholders": {
    "user": "admin",
    "email": "usuário@exemplo.com",
    "password": "********",
    "sshPassphrase": "Passphrase da sua chave SSH",
    "recoveryCode": "XXXX-XXXX-XXXX",
    "totp": "000000"
  },
  "text": {
    "biometricAuth": "Autenticação biométrica",
    "biometricHelp": "Use Face ID, impressão digital ou chave de segurança",
    "usePasskey": "Usar Passkey",
    "signIn": "Entrar",
    "sendRecoveryLink": "Enviar link de recuperação",
    "recoveryWarning": "Use um código de recuperação de uso único se perdeu o acesso ao seu dispositivo.",
    "verifyCode": "Verificar código",
    "twoFactorTitle": "Verificação em duas etapas",
    "twoFactorHelp": "Digite o código do seu aplicativo de autenticação",
    "verify": "Verificar",
    "footer": "LuxiPanel v2.0 - Administração segura de correio"
  },
  "errors": {
    "captchaRequired": "Complete o desafio hCaptcha.",
    "enterEmail": "Digite um e-mail",
    "browserNoPasskey": "Seu navegador não suporta Passkey. Use Chrome, Firefox, Safari ou Edge recente.",
    "passkeyOptionsFailed": "Não foi possível obter as opções de autenticação",
    "passkeyCanceled": "Autenticação cancelada",
    "passkeyCanceledByUser": "Autenticação cancelada pelo usuário",
    "passkeyError": "Erro de passkey",
    "enterUserRecoveryCode": "Digite o usuário e o código de recuperação",
    "enterTotp6Digits": "Digite os 6 dígitos do código",
    "invalidTotpCode": "Código 2FA inválido"
  },
  "status": {
    "passkeyInit": "Iniciando autenticação...",
    "passkeyWaiting": "Aguardando seu passkey...",
    "passkeyVerifying": "Verificando..."
  },
  "authErrors": {
    "AUTH_ERROR": "Erro de autenticação.",
    "NO_SSH_KEY": "Não há chave SSH associada a este usuário neste painel.",
    "PANEL_UNRESOLVED": "Não foi possível determinar o painel de acesso.",
    "PANEL_NO_IP": "O painel não tem um IP configurado.",
    "USER_PROVISION_FAILED": "Não foi possível provisionar o usuário no painel.",
    "ACCOUNT_DISABLED": "A conta está desabilitada.",
    "ACCOUNT_NOT_FOUND": "Conta não encontrada ou desabilitada.",
    "USER_NOT_FOUND": "Usuário não encontrado.",
    "TWO_FA_REQUIRED": "Esta conta requer 2FA. Configure-o em Configurações › Segurança antes de entrar.",
    "INVALID_PASSPHRASE": "Passphrase incorreta.",
    "PASSPHRASE_REQUIRED": "Você deve digitar a passphrase do usuário.",
    "PASSPHRASE_VERIFY_FAILED": "Não foi possível verificar a senha no servidor.",
    "SERVER_SSH_KEY_MISSING": "A chave SSH do servidor não está configurada.",
    "PANEL_SSH_KEY_REJECTED": "A chave SSH do painel não é aceita pelo servidor.",
    "SSH_CONNECT_FAILED": "Não foi possível conectar ao servidor SSH.",
    "SSH_CONNECTION_CLOSED": "A conexão SSH foi encerrada inesperadamente.",
    "PASSWORD_LOGIN_DISABLED": "O login por senha está desabilitado.",
    "PASSKEY_LOGIN_DISABLED": "O login por passkey está desabilitado.",
    "RECOVERY_LOGIN_DISABLED": "O login por código de recuperação está desabilitado.",
    "PASSKEY_INVALID": "Passkey inválida.",
    "INVALID_AUTH_RESPONSE": "Resposta de autenticação inválida.",
    "INVALID_TOTP": "Código TOTP inválido.",
    "CAPTCHA_REQUIRED": "É necessária a verificação captcha.",
    "CAPTCHA_FAILED": "A verificação captcha falhou."
  }
} as const;

export default login;
