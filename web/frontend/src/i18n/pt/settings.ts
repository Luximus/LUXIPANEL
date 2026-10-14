const settings = {
  "passkeyName": {
    "title": "Nome da passkey",
    "hint": "Use um nome que ajude a reconhecer o dispositivo.",
    "placeholder": "Ex.: Notebook pessoal",
    "save": "Salvar nome",
    "edit": "Editar nome",
    "invalid": "Digite um nome de 1 a 128 caracteres.",
    "saved": "Nome atualizado",
    "error": "Não foi possível salvar o nome.",
    "cancel": "Cancelar"
},
  "placeholders": {
    "logoUrl": "https://exemplo.com/logo.png",
    "imageUrl": "https://…/image.jpg"
  },
  "pageTitle": "Definições",
  "loadFailure": {
    "title": "Não foi possível carregar as definições",
    "sessionMessage": "Não foi possível carregar as definições: a sessão com o servidor não está disponível. Volte a selecionar o servidor no seletor ou termine sessão e inicie novamente.",
    "genericMessage": "Não foi possível carregar as definições. Verifique a sua ligação e tente novamente.",
    "retry": "Tentar novamente"
  },
  "header": {
    "title": "Definições do painel",
    "subtitle": "Configuração global do LuxiPanel",
    "autosave": "Salvamento automático"
  },
  "tabs": {
    "general": "Geral",
    "layoutUi": "Layout/UI",
    "security": "Segurança",
    "modules": "Módulos",
    "system": "Sistema",
    "credentials": "Credenciais"
  },
  "credentials": {
    "hcaptcha": {
      "title": "hCaptcha",
      "desc": "Proteja o login do painel com um desafio hCaptcha. Insira as chaves do seu painel do hCaptcha.",
      "sitekeyLabel": "Site key",
      "sitekeyPlaceholder": "Sua site key do hCaptcha",
      "secretLabel": "Secret key",
      "secretPlaceholder": "Insira uma nova secret key",
      "secretConfigured": "Já existe uma secret key configurada. Deixe este campo vazio para mantê-la.",
      "statusConfigured": "Configurado",
      "statusMissing": "Não configurado",
      "saved": "Configurações do hCaptcha salvas"
    },
    "tolqia": {
      "label": "Tolqia",
      "help": "Token de API da sua conta Tolqia (plano Plus ou Premium) — ativa chamadas com tradução para os usuários deste servidor",
      "guide": {
        "steps": [
          "Acesse tolqia.com e entre na sua conta (plano Plus ou Premium).",
          "Abra «Configurações» › «API» e crie um token novo.",
          "Copie o token (começa por tq_live_) e cole em «Configurar»."
        ],
        "docUrl": "https://tolqia.com/settings/api",
        "docLabel": "Criar token em tolqia.com → Configurações › API",
        "docUrl2": "https://tolqia.com/docs",
        "docLabel2": "Documentação"
      }
    },
    "elevenlabs": {
      "label": "ElevenLabs",
      "help": "Usada para a tradução em tempo real das chamadas de áudio",
      "voiceIdLabel": "Voice ID padrão",
      "voiceIdPlaceholder": "ex.: 21m00Tcm4TlvDq8ikWAM",
      "guide": {
        "steps": [
          "Acesse elevenlabs.io e faça login.",
          "Abra «My Account» → «API Keys» e crie uma nova chave.",
          "Copie a chave (começa com sk_) e cole em «Configurar»."
        ],
        "docUrl": "https://elevenlabs.io/app/settings/api-keys",
        "docLabel": "Chaves de API do ElevenLabs"
      }
    },
    "title": "Credenciais dos módulos",
    "subtitle": "Gerencie os Access Tokens e chaves API que os módulos precisam para funcionar.",
    "empty": "Nenhum módulo que exija credenciais está habilitado neste servidor.",
    "statusSet": "Configurado",
    "statusMissing": "Não configurado",
    "tokenLabel": "Token de acesso / chave API",
    "tokenPlaceholder": "Cole o token…",
    "save": "Salvar",
    "test": "Testar",
    "clear": "Remover",
    "manage": "Gerenciar",
    "show": "Mostrar",
    "hide": "Ocultar",
    "saved": "Credencial salva",
    "cleared": "Credencial removida",
    "testOk": "Conexão válida",
    "testFail": "Não foi possível validar a credencial",
    "confirmClear": "Remover esta credencial?",
    "confirmClearTitle": "Remover credencial",
    "error": "Ocorreu um erro",
    "getDoc": "Obter um token",
    "managedLabel": {
      "assistant": "Agentes IA"
    },
    "managedHint": {
      "assistant": "As chaves API dos provedores do assistente são gerenciadas em seu painel.",
      "backups": "As chaves de armazenamento (S3 / R2) são gerenciadas no módulo Backups."
    },
    "managedSummary": {
      "assistant": "Provedores de IA (Claude, OpenAI, Gemini, …)",
      "backups": "Credenciais de armazenamento S3 / R2"
    },
    "storage": {
      "accountId": "ID da conta (Cloudflare)",
      "accessKeyId": "ID da chave de acesso",
      "secret": "Chave de acesso secreta",
      "endpoint": "Endpoint (opcional)",
      "region": "Região (opcional)",
      "r2Hint": "Credencial R2 em nível de conta reutilizável por Backups: defina as chaves uma única vez aqui e apenas selecione um bucket em Backups.",
      "s3Hint": "Credencial S3 reutilizável por Backups: defina as chaves uma única vez aqui e apenas selecione um bucket em Backups."
    },
    "connector": {
      "connect": "Salvar e conectar",
      "disconnect": "Desconectar",
      "connected": "Conectado",
      "configured": "Configurado",
      "notConnected": "Não conectado",
      "unavailable": "Requer o módulo Agentes IA habilitado",
      "setupGuide": "Guia de configuração"
    },
    "help": {
      "tabConfig": "Configurar",
      "tabHelp": "Ajuda",
      "openLink": "Abrir link",
      "guides": {
        "cloudflare": {
          "steps": [
            "Acesse dash.cloudflare.com → «Meu perfil» → «Tokens de API».",
            "Clique em «Criar token»: use o modelo «Editar zona DNS» ou crie um personalizado com as permissões que precisar (Zona:Leitura, DNS:Editar, etc.).",
            "Escolha as zonas às quais ele terá acesso e crie o token.",
            "Copie o token (mostrado apenas uma vez) e cole-o na aba «Configurar»."
          ],
          "docUrl": "https://dash.cloudflare.com/profile/api-tokens",
          "docLabel": "Tokens de API do Cloudflare"
        },
        "expo": {
          "steps": [
            "Acesse expo.dev e faça login → «Configurações de conta» → «Tokens de acesso».",
            "Clique em «Criar token», dê um nome e copie o valor gerado.",
            "Cole-o na aba «Configurar»."
          ],
          "docUrl": "https://expo.dev/settings/access-tokens",
          "docLabel": "Tokens de acesso do Expo"
        },
        "openclaw": {
          "steps": [
            "Acesse openclaw.ai e faça login.",
            "Gere ou copie sua chave de API no painel do OpenClaw.",
            "Cole-a em «Configurar» (ajuste o endpoint e o modelo padrão se forem diferentes)."
          ],
          "docUrl": "https://openclaw.ai",
          "docLabel": "OpenClaw"
        },
        "repository-store": {
          "steps": [
            "Acesse github.com → «Configurações» → «Configurações de desenvolvedor» → «Tokens de acesso pessoal».",
            "Gere um token (clássico ou refinado) com permissão de leitura de repositórios (public_repo ou Contents: Read).",
            "Copie o token (começa com ghp_ ou github_pat_) e cole-o em «Configurar»."
          ],
          "docUrl": "https://github.com/settings/tokens",
          "docLabel": "Tokens do GitHub"
        },
        "bitninja": {
          "steps": [
            "Acesse o painel do BitNinja (admin.bitninja.io) e faça login.",
            "Copie sua License Key da seção de licenças/servidores.",
            "Cole-a em «Configurar»."
          ],
          "docUrl": "https://bitninja.io",
          "docLabel": "BitNinja"
        },
        "r2": {
          "steps": [
            "Acesse dash.cloudflare.com → «R2» → «Gerenciar tokens de API R2».",
            "Crie um «Token de API R2» (compatível com S3) com permissão de leitura/escrita de objetos.",
            "Copie o Access Key ID e o Secret Access Key que aparecer.",
            "Seu Account ID aparece na página de R2 / resumo da conta.",
            "Cole Account ID + Access Key ID + Secret em «Configurar» (o endpoint é derivado do Account ID)."
          ],
          "docUrl": "https://dash.cloudflare.com/?to=/:account/r2/api-tokens",
          "docLabel": "Tokens de API do R2"
        },
        "s3": {
          "steps": [
            "No console do AWS: «IAM» → «Usuários» → seu usuário → «Credenciais de segurança» → «Criar chave de acesso».",
            "Copie o Access Key ID e o Secret Access Key.",
            "Se usar um serviço compatível com S3 (Wasabi, MinIO, etc.), anote seu Endpoint e Região.",
            "Cole as chaves (e o Endpoint/Região se aplicável) em «Configurar»."
          ],
          "docUrl": "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html",
          "docLabel": "Chaves de acesso AWS"
        }
      }
    }
  },
  "general": {
    "hcaptchaEnabled": "Exigir hCaptcha no login",
    "hcaptchaEnabledHint": "Exibe um desafio hCaptcha no formulário de login do painel.",
    "sectionTitle": "Geral",
    "labelPanelName": "Nome do painel",
    "labelTimezone": "Fuso horário",
    "labelLanguage": "Idioma",
    "languageOptions": {
      "en": "English",
      "es": "Español"
    },
    "labelSessionTtl": "Duração da sessão (horas)",
    "labelMaxLoginAttempts": "Tentativas de login falhas (bloqueio)",
    "labelRequire2fa": "Exigir 2FA para todos os usuários",
    "btnViewLog": "Ver log",
    "labelAuditLog": "Habilitar log de auditoria",
    "labelSwitchNewTab": "Abrir o servidor em uma nova aba ao trocar"
  },
  "imageList": {
    "labelJson": "(JSON)",
    "labelUrls": "(URLs de imagem)",
    "addButton": "Adicionar imagem"
  },
  "layout": {
    "sectionTitle": "Layout, branding e UI",
    "sectionSubtitle": "Personalize logotipos, raios, sombras e cores base do frontend.",
    "branding": {
      "groupTitle": "Branding e logotipos",
      "groupDesc": "Logotipo único aplicado à barra lateral, login, cabeçalho, rodapé e favicon.",
      "labelLogoUrl": "URL do logotipo",
      "logoUrlHelp": "Logotipo único usado em todos os locais: sidebar, login, cabeçalho do painel, rodapé e telas públicas.",
      "btnUpload": "Enviar",
      "btnPick": "Escolher",
      "btnDefault": "Padrão",
      "restoreLogos": "Restaurar logotipos",
      "loginLogoOpacity": "Opacidade do contêiner do logo (login)",
      "loginLogoOpacityHelp": "Translucidez do fundo do círculo do logo em /login (0 = transparente, 100 = sólido)."
    },
    "loginBg": {
      "groupTitle": "Fundo do login",
      "groupDesc": "Efeito de fundo animado em /login e sua cor alternativa.",
      "enableLabel": "Mostrar fundo animado em /login",
      "labelFallbackColor": "Cor de fundo quando desativado",
      "labelActiveEffect": "Efeito ativo em /login",
      "previewTitle": "Pré-visualização do acesso"
    },
    "shape": {
      "groupTitle": "Forma e sombras",
      "groupDesc": "Raio global, sombras de cartões e modais do frontend.",
      "labelRadius": "Raio global",
      "radiusHelp": "Ex.: 0.5rem, 12px.",
      "labelShadow": "Sombra base",
      "labelModalShadow": "Sombra modal",
      "labelModalBackdrop": "Overlay modal",
      "backdropHelp": "Fundo de diálogos.",
      "layer1": "Camada 1",
      "layer2": "Camada 2",
      "labelColor": "Cor",
      "labelShadowSingle": "Sombra"
    },
    "palettes": {
      "title": "Tema de cor",
      "subtitle": "Escolha uma paleta predefinida; aplica-se a todo o painel (claro e escuro).",
      "light": "Tema claro",
      "dark": "Tema escuro",
      "intensity": "Intensidade"
    },
    "resetButton": "Restaurar estilos padrão",
    "panelBg": {
      "groupTitle": "Fundo do painel",
      "groupDesc": "Efeito de fundo animado dentro do painel e sua cor alternativa.",
      "enableLabel": "Mostrar fundo animado no painel",
      "labelFallbackColor": "Cor de fundo quando desativado",
      "labelActiveEffect": "Efeito ativo do painel"
    }
  },
  "security": {
    "sectionTitle": "Segurança",
    "loginMethodsTitle": "Métodos de login permitidos",
    "loginMethodsDesc": "Pelo menos um método deve permanecer ativo. Os métodos desativados não aparecerão na tela de login.",
    "loginMethodsWarning": "Pelo menos um método deve permanecer ativo.",
    "passkey": {
      "name": "Passkey",
      "desc": "Autenticação biométrica / FIDO2. Os usuários devem registrar seu dispositivo.",
      "verifying": "Verificando...",
      "btnManage": "Gerenciar"
    },
    "password": {
      "name": "Senha",
      "desc": "Login com usuário e senha. Sempre disponível sem configuração prévia.",
      "configured": "Configurado"
    },
    "recovery": {
      "name": "Recuperação",
      "desc": "Códigos de uso único como backup de emergência.",
      "verifying": "Verificando...",
      "btnManage": "Gerenciar"
    },
    "twoFaStatus": {
      "groupTitle": "Status 2FA para esta conta",
      "badgeDisabled": "Desativado",
      "promptText": "Ative o 2FA para proteger esta conta administrativa.",
      "btnSetup": "Configurar",
      "btnDelete": "Excluir",
      "btnDisable": "Desabilitar"
    }
  },
  "modules": {
    "sectionTitle": "Motores de cache por módulo",
    "sectionDesc1": "Estado e ajuste da coleta programada no servidor do cliente.",
    "sectionDescBold": "Ativo/Inativo deriva do módulo pai",
    "modulesLink": "Módulos",
    "sectionDesc2": ": ao desativar um módulo, sua coleta é interrompida; ao reativá-lo, é reagendada. Aqui apenas se ajusta a frequência. As DataTables leem dados pré-formatados do Redis dedicado naquele servidor; se estiver desligado ou muito desatualizado, cai para o JSON normal.",
    "loading": "Carregando…",
    "tableHeaders": {
      "module": "Módulo / coleção",
      "source": "Origem",
      "active": "Ativo",
      "interval": "Intervalo (s)",
      "lastRefresh": "Última atualização",
      "duration": "Duração",
      "size": "Tamanho",
      "hitRatio": "Proporção de acertos"
    },
    "managedInPre": " (gerenciado em ",
    "managedInPost": ")"
  },
  "system": {
    "factoryReset": {
      "sectionTitle": "Redefinir configurações",
      "sectionSubtitle": "Restaura as configurações do painel para os valores de fábrica.",
      "warningTitle": "Aviso",
      "warningBefore": "Esta ação redefine ",
      "warningAllSettings": "todas as configurações",
      "warningMiddle": " do painel (geral, layout/UI, SMTP, segurança e as preferências salvas por módulos) para seus valores padrão. Os usuários e módulos instalados ",
      "warningNotDeleted": "não são excluídos",
      "warningAfter": ".",
      "btnReset": "Restaurar configurações de fábrica"
    },
    "backupRestore": {
      "sectionTitle": "Restaurar a partir de backup",
      "sectionSubtitle": "Restaura o painel a partir de um backup anterior (módulo Backups necessário).",
      "loading": "Carregando backups...",
      "btnRestore": "Restaurar backup selecionado"
    },
    "noBackup": {
      "title": "Restauração a partir de backup não disponível",
      "descBefore": "Instale o módulo ",
      "backupsModule": "Backups",
      "descAfter": " no painel de módulos para habilitar esta função."
    }
  },
  "imagePicker": {
    "title": "Escolher imagem",
    "subtitle": "Imagens disponíveis na pasta pública do frontend.",
    "empty": "Não há imagens na pasta pública.",
    "btnUpload": "Enviar nova imagem",
    "btnCancel": "Cancelar"
  },
  "smtpTest": {
    "dialogTitle": "Enviar e-mail de teste",
    "labelRecipient": "Destinatário",
    "placeholderRecipient": "voce@exemplo.com",
    "btnCancel": "Cancelar",
    "btnSend": "Enviar"
  },
  "passkeysDialog": {
    "title": "Gerenciar Passkeys",
    "btnAdd": "Adicionar passkey",
    "empty": "Nenhuma passkey registrada"
  },
  "recoveryDialog": {
    "title": "Códigos de recuperação",
    "btnGenerate": "Gerar / regenerar",
    "loading": "Carregando...",
    "warningText": "Guarde esses códigos em um lugar seguro. Eles são exibidos apenas uma vez.",
    "btnCopy": "Copiar tudo",
    "btnPrint": "Imprimir"
  },
  "setup2faDialog": {
    "title": "Configurar 2FA",
    "subtitle": "Escaneie este código QR com seu app de autenticação.",
    "secretLabel": "Secret manual:",
    "copyTitle": "Copiar",
    "verifyLabel": "Insira o código de 6 dígitos:",
    "btnCancel": "Cancelar",
    "btnActivate": "Ativar 2FA"
  },
  "disable2faDialog": {
    "title": "Desativar 2FA?",
    "body": "O 2FA será desativado, mas o segredo será mantido para reativação posterior.",
    "btnCancel": "Cancelar",
    "btnConfirm": "Desabilitar 2FA"
  },
  "delete2faDialog": {
    "title": "Excluir 2FA?",
    "body": "O segredo armazenado será apagado e você precisará configurá-lo novamente para usar o 2FA.",
    "btnCancel": "Cancelar",
    "btnConfirm": "Excluir 2FA"
  },
  "auditLogDialog": {
    "title": "Log de auditoria",
    "empty": "Sem atividade registrada"
  },
  "modulesCache": {
    "agoSeconds": "há {n}s",
    "agoMinutes": "há {n}m",
    "agoHours": "há {n}h",
    "agoDays": "há {n}d",
    "collectionSingular": "coleção",
    "collectionPlural": "coleções",
    "activeSingular": "ativa",
    "activePlural": "ativas",
    "enabledTitle": "Coleta agendada via dispatcher do servidor cliente",
    "badgeEnabled": "Ativa",
    "disabledTitle": "Módulo pai desativado em /panel/modules — a coleta fica pausada",
    "badgeDisabled": "Inativa",
    "buttonSave": "Salvar",
    "saving": "Salvando…",
    "savedStatus": "{module}/{collection} atualizado",
    "saveError": "Erro ao salvar {module}/{collection}: {message}",
    "loadedSummary": "{count} coleções armazenáveis em {modules} módulos. As mudanças se aplicam no próximo ciclo do coletor (≤60s).",
    "loadError": "Erro: {message}"
  },
  "labels": {
    "auditLogin": "Início de sessão",
    "auditLoginFailed": "Tentativa de login falhada",
    "auditLogout": "Encerramento de sessão",
    "auditPasswordChange": "Alteração de senha",
    "auditPasskeyRegister": "Passkey registrada",
    "auditPasskeyDelete": "Passkey removida",
    "auditRecoveryCodeUsed": "Código de recuperação utilizado",
    "auditProfileUpdate": "Perfil atualizado",
    "auditSettingsUpdate": "Configurações atualizadas",
    "audit2faEnabled": "2FA ativado",
    "audit2faDisabled": "2FA desativado",
    "auditEventDefault": "Evento",
    "aiHintAnthropic": "Modelos recomendados: claude-fable-5 (mais recente), claude-sonnet-4-6 (equilíbrio), claude-opus-4-6 (mais potente)",
    "aiKeyHintAnthropic": "Obtenha sua API key em console.anthropic.com",
    "aiHintOpenai": "gpt-5.6-sol, gpt-5.6-terra, gpt-5.6-luna",
    "aiKeyHintOpenai": "Obtenha sua API key em platform.openai.com",
    "aiHintOllama": "Nome do modelo instalado no Ollama local. Não suporta ferramentas.",
    "aiKeyHintOllama": "Não requer API key para Ollama local",
    "managedByLp": "Gerenciado pelo LP-LICENSE-SERVER",
    "notAvailable": "Não disponível",
    "managedExternally": "Gerenciado externamente",
    "twoFaManagedByLp": "A autenticação é gerenciada pelo LP-LICENSE-SERVER neste modo.",
    "licenseNoStatus": "Sem estado",
    "licenseActive": "Ativa",
    "licenseExpires": "vence em {date}",
    "licenseActiveDesc": "Licença ativa",
    "licenseDegraded": "Degradada",
    "licensePending": "Pendente",
    "licenseDegradedDesc": "A licença não pôde ser validada e o painel está em modo degradado.",
    "licenseNotActivated": "A licença ainda não está ativada.",
    "passkeyCount": "{count} passkey(s) registrada(s)",
    "noPasskeys": "Sem passkeys registradas",
    "recoveryCodesGenerated": "Códigos de recuperação gerados",
    "noRecoveryCodes": "Sem códigos gerados",
    "passkeyRegistered": "Registrada em {date}",
    "recoveryCodesActive": "Você tem códigos de recuperação ativos.",
    "recoveryCodesNone": "Você não tem códigos de recuperação ativos.",
    "recoveryCodesDisplayed": "{count} códigos gerados. Guarde-os em um lugar seguro.",
    "twoFaEnabled": "Ativado",
    "twoFaEnabledDesc": "Este 2FA será solicitado no próximo início de sessão. Você pode desativá-lo sem apagar o segredo.",
    "twoFaDisabled": "Desativado",
    "twoFaDisabledDesc": "O segredo ainda está salvo, mas não será solicitado no login até que você o ative novamente.",
    "twoFaSetupPrompt": "Ative o 2FA para proteger esta conta administrativa.",
    "printRecoveryCodesTitle": "Códigos de recuperação - LUXIPANEL",
    "printRecoveryCodesDesc": "Guarde estes códigos em um lugar seguro. Cada um só pode ser usado uma vez."
  },
  "toasts": {
    "errorSaving": "Erro ao salvar configurações",
    "errorSavingAppearance": "Não foi possível salvar a aparência no servidor de licenças. Tente novamente em alguns segundos.",
    "licenseKeyAndRefRequired": "Insira a chave e a referência de pagamento",
    "licenseActivated": "Licença ativada com sucesso",
    "licenseActivateError": "Não foi possível ativar a licença",
    "timezoneApplyError": "Não foi possível aplicar o fuso horário ao sistema",
    "timezoneSavedNotApplied": "Fuso horário salvo no painel, mas não foi possível aplicá-lo ao sistema (verifique as permissões sudo).",
    "passkeysInLp": "Passkeys são gerenciadas no LP-LICENSE-SERVER",
    "passkeyDeleted": "Passkey removida",
    "passkeyDeleteError": "Erro ao remover passkey",
    "passkeyBrowserUnsupported": "Seu navegador não suporta Passkey",
    "passkeyRegisterInitError": "Não foi possível iniciar o registro",
    "passkeyRegisterCancelled": "Registro cancelado",
    "passkeyRegisterFinishError": "Erro ao finalizar o registro",
    "passkeyRegistered": "Passkey registrada com sucesso",
    "passkeyRegisterUserCancelled": "Registro cancelado pelo usuário",
    "passkeyRegisterError": "Erro ao registrar passkey",
    "recoveryCodesInLp": "Os códigos de recuperação são gerenciados no LP-LICENSE-SERVER",
    "recoveryCodesGenerateError": "Erro ao gerar códigos",
    "twoFaInLp": "O 2FA é gerenciado no LP-LICENSE-SERVER",
    "twoFaSetupInitError": "Erro ao iniciar a configuração do 2FA",
    "twoFaQrError": "Não foi possível gerar o QR",
    "twoFaActivated": "2FA ativado com sucesso",
    "twoFaDisabled": "2FA desativado para o início de sessão",
    "twoFaDisableError": "Erro ao desativar 2FA",
    "twoFaReactivated": "2FA ativado para o início de sessão",
    "twoFaActivateError": "Erro ao ativar 2FA",
    "twoFaDeleted": "2FA removido",
    "twoFaDeleteError": "Erro ao remover 2FA",
    "backupRestoreUnavailable": "A restauração de backups ainda não está disponível neste painel.",
    "imageExceeds5mb": "A imagem excede 5MB",
    "uploadingImage": "Enviando imagem...",
    "imageUploadError": "Erro ao enviar imagem",
    "imageUploadInvalidResponse": "Resposta inválida do servidor",
    "imageUploaded": "Imagem enviada com sucesso",
    "logosRestored": "Logos restaurados aos valores padrão",
    "codesCopied": "Códigos copiados",
    "secretCopied": "Secret copiado",
    "smtpTestSent": "E-mail de teste enviado para {to}",
    "smtpTestError": "Erro ao enviar",
    "layoutReset": "Estilos redefinidos aos valores padrão",
    "settingsReset": "Configurações redefinidas",
    "settingsResetError": "Erro ao redefinir",
    "licenseRevalidated": "Licença revalidada",
    "licenseRevalidateError": "Não foi possível revalidar a licença"
  },
  "actions": {
    "activating": "Ativando...",
    "activateOrUpdate": "Ativar / atualizar",
    "manage": "Gerenciar",
    "configure": "Configurar",
    "viewOrRegenerate": "Ver / regenerar",
    "generate": "Gerar",
    "generating": "Gerando...",
    "generateOrRegenerate": "Gerar / regenerar",
    "disable": "Desativar",
    "activate": "Ativar",
    "activate2fa": "Ativar 2FA",
    "continue": "Continuar",
    "sending": "Enviando...",
    "send": "Enviar",
    "resetting": "Redefinindo...",
    "factoryReset": "Redefinir configurações de fábrica"
  },
  "errors": {
    "twoFaEnter6Digits": "Digite os 6 dígitos do código",
    "twoFaInvalidCode": "Código inválido"
  },
  "confirm": {
    "deletePasskeyTitle": "Remover passkey",
    "deletePasskeyBody": "Remover esta passkey?",
    "restoreBackupBody": "Restaurar o backup \"{id}\"?",
    "restoreBackupTitle": "Restaurar backup",
    "restoreLogosBody": "Restaurar o logo aos valores padrão do LUXIPANEL?",
    "restoreLogosTitle": "Restaurar logos",
    "restoreLogosConfirm": "Sim, restaurar",
    "resetLayoutBody": "Redefinir os estilos da interface aos valores padrão do LUXIPANEL? Logos, cores, sombras e planos de fundo personalizados serão perdidos.",
    "resetLayoutTitle": "Redefinir estilos",
    "resetLayoutConfirm": "Sim, redefinir",
    "factoryResetBody": "Tem certeza? Isso redefinirá todas as configurações do painel.",
    "factoryResetTitle": "Redefinir configurações",
    "factoryResetConfirm": "Sim, redefinir"
  },
  "empty": {
    "noBackups": "Não há backups disponíveis."
  },
  "palettes": {
    "violet": {
      "name": "Violeta",
      "description": "Paleta padrão do LUXIPANEL."
    },
    "ocean": {
      "name": "Oceano",
      "description": "Azuis profissionais e serenos."
    },
    "emerald": {
      "name": "Esmeralda",
      "description": "Verdes frescos e naturais."
    },
    "sunset": {
      "name": "Pôr do Sol",
      "description": "Laranjas e âmbar quentes."
    },
    "rose": {
      "name": "Rosa",
      "description": "Rosados e magentas vibrantes."
    },
    "indigo": {
      "name": "Índigo",
      "description": "Índigos elegantes e modernos."
    },
    "aqua": {
      "name": "Aqua",
      "description": "Turquesas e ciano luminosos."
    },
    "graphite": {
      "name": "Grafite",
      "description": "Neutro monocromático e sóbrio."
    },
    "amber": {
      "name": "Âmbar",
      "description": "Dourados e mel quentes."
    },
    "fuchsia": {
      "name": "Fúcsia",
      "description": "Magentas e roxos intensos."
    },
    "lime": {
      "name": "Lima",
      "description": "Verdes lima enérgicos."
    },
    "slate": {
      "name": "Ardósia",
      "description": "Cinza azulado profissional."
    },
    "prisma": {
      "name": "Prisma",
      "description": "Combina as cores de todas as paletas em uma transição contínua e infinita.",
      "colors": "Cores",
      "addColorButton": "Adicionar cor",
      "addColorAria": "Selecionar e adicionar uma cor ao efeito Prisma",
      "addColorInputAria": "Cor a adicionar ao efeito Prisma",
      "editColorAria": "Editar cor",
      "editColorInputAria": "Editar valor da cor",
      "editColorHexAria": "Valor hexadecimal da cor",
      "removeColorAria": "Remover cor",
      "moveUpAria": "Mover cor para cima",
      "moveDownAria": "Mover cor para baixo",
      "helpText": "Reordene a lista com as setas. Cada cor define a sequência do efeito."
    },
    "custom": {
      "name": "Personalizado",
      "description": "Escolha sua cor base e ajuste sua intensidade.",
      "baseColor": "Cor base",
      "baseColorAria": "Cor base personalizada",
      "hexAria": "Hex da cor base personalizada"
    },
    "luxisoft": {
      "description": "Azul-marinho e menta no modo claro; grafite e menta no modo escuro.",
      "name": "Luxisoft"
    }
  },
  "managers": {
    "default": "Gerenciador 1"
  },
  "git": {
    "errorFallback": "Erro"
  }
} as const;

export default settings;
