const preferences = {
  "pageTitle": "Preferências",
  "header": {
    "title": "Preferências",
    "subtitle": "Gira o seu perfil e segurança da conta"
  },
  "placeholders": {
    "phone": "+55 11 90000-0000"
  },
  "profile": {
    "sectionTitle": "Perfil",
    "labelDisplayName": "Nome de exibição",
    "labelPhone": "Telefone",
    "labelUsername": "Nome de utilizador",
    "labelRole": "Função",
    "btnSave": "Salvar perfil"
  },
  "password": {
    "sectionTitle": "Alterar senha",
    "disabledNotice": "A alteração de senha está desabilitada no LuxiPanel. Você deve contatar um administrador do servidor."
  },
  "passkeys": {
    "sectionTitle": "Passkeys",
    "sectionSubtitle": "Autenticação biométrica / FIDO2",
    "btnAdd": "Adicionar passkey",
    "emptyState": "Você ainda não tem passkeys registradas"
  },
  "recoveryCodes": {
    "sectionTitle": "Códigos de recuperação",
    "sectionSubtitle": "Use-os se perder acesso ao seu dispositivo",
    "btnRegenerate": "Regenerar",
    "loading": "A carregar...",
    "warning": "Guarde esses códigos em um lugar seguro. Eles são exibidos apenas uma vez.",
    "btnCopy": "Copiar tudo",
    "btnPrint": "Imprimir"
  },
  "twoFactor": {
    "sectionTitle": "Autenticação de dois fatores (2FA)",
    "sectionSubtitle": "Proteja sua conta com um código adicional",
    "badgeDisabled": "Desativado",
    "enabledDescription": "Sua conta está protegida com autenticação em dois fatores. Você precisará de um código do seu aplicativo de autenticação cada vez que fizer login.",
    "btnEnable": "Ativar 2FA",
    "btnDisable": "Desativar 2FA"
  },
  "auditLog": {
    "sectionTitle": "Atividade recente",
    "emptyState": "Sem atividade registada"
  },
  "dialogRegenCodes": {
    "title": "Regenerar códigos?",
    "body": "Os códigos anteriores serão invalidados. Esta ação não pode ser desfeita.",
    "btnCancel": "Cancelar",
    "btnConfirm": "Regenerar"
  },
  "dialogSetup2fa": {
    "title": "Ativar autenticação em dois passos",
    "subtitle": "Escaneie este código QR com seu app de autenticação (Google Authenticator, Authy, etc.)",
    "manualEntryLabel": "Se não conseguir escanear, insira manualmente:",
    "titleCopySecret": "Copiar",
    "verifyCodeLabel": "Insira o código de 6 dígitos para confirmar:",
    "btnCancel": "Cancelar",
    "btnConfirm": "Ativar 2FA"
  },
  "dialogDisable2fa": {
    "title": "Desativar 2FA?",
    "body": "Sua conta ficará menos segura. Você poderá reativá-lo a qualquer momento.",
    "btnCancel": "Cancelar",
    "btnConfirm": "Desativar 2FA"
  },
  "toasts": {
    "profileUpdated": "Perfil atualizado",
    "errorUpdate": "Erro ao atualizar",
    "passwordUpdated": "Senha atualizada",
    "passkeyDeleted": "Passkey excluída",
    "error": "Erro",
    "registrationCancelled": "Registro cancelado",
    "passkeyRegistered": "Passkey registrada com sucesso",
    "registrationCancelledByUser": "Registro cancelado pelo usuário",
    "codesCopied": "Códigos copiados para a área de transferência",
    "secretCopied": "Segredo copiado para a área de transferência",
    "twoFaActivated": "2FA ativado com sucesso",
    "twoFaDeactivated": "2FA desativado"
  },
  "errors": {
    "passwordMismatch": "As senhas não correspondem",
    "passwordTooShort": "A senha deve ter pelo menos 8 caracteres",
    "passwordChangeError": "Erro ao alterar a senha",
    "passkeyNotSupported": "Seu navegador não suporta Passkey. Use Chrome, Firefox, Safari ou Edge recente.",
    "passkeyInitFailed": "Não foi possível iniciar o registro",
    "passkeyFinishError": "Erro ao concluir o registro",
    "generateCodesError": "Erro ao gerar códigos",
    "twoFaSetupError": "Erro ao iniciar a configuração de 2FA",
    "enterSixDigits": "Digite os 6 dígitos do código",
    "invalidCode": "Código inválido",
    "twoFaDeactivateError": "Erro ao desativar 2FA",
    "genericWithMessage": "Erro: {message}"
  },
  "labels": {
    "passkeyRegistered": "Registrada em {date}",
    "hasActiveCodes": "Você tem códigos de recuperação ativos.",
    "noActiveCodes": "Você não tem códigos de recuperação ativos.",
    "notAvailable": "Não disponível",
    "codesGenerated": "{count} códigos gerados. Guarde-os em local seguro.",
    "printTitle": "Códigos de recuperação — LUXIPANEL",
    "printWarning": "Guarde estes códigos em local seguro. Cada um pode ser usado apenas uma vez.",
    "twoFaBadgeEnabled": "Ativado",
    "twoFaBadgeDisabled": "Desativado"
  },
  "confirm": {
    "deletePasskey": "Excluir esta passkey?",
    "deletePasskeyTitle": "Excluir passkey"
  },
  "actions": {
    "login": "Início de sessão",
    "logout": "Logout",
    "passwordChange": "Alteração de senha",
    "passkeyRegister": "Passkey registrada",
    "passkeyDelete": "Passkey excluída",
    "recoveryCodeUsed": "Código de recuperação usado",
    "profileUpdate": "Perfil atualizado",
    "twoFaEnabled": "2FA habilitado",
    "twoFaDisabled": "2FA desabilitado",
    "activateTwoFa": "Ativar 2FA"
  }
} as const;

export default preferences;
