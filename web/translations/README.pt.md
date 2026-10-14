# LUXIPANEL

Revisado em 13 de outubro de 2026

O LUXIPANEL funciona no seu servidor Linux e gerencia recursos locais e destinos SSH. O LP-LICENSE-SERVER oferece contas, pagamentos, tokens, catálogo de módulos e serviços editoriais em luxipanel.com. Criar uma conta não instala um painel nem registra um servidor.

[en](../README.md) | [es](../translations/README.es.md) | [fr](../translations/README.fr.md) | [de](../translations/README.de.md) | [it](../translations/README.it.md) | [pt](../translations/README.pt.md) | [ru](../translations/README.ru.md) | [ar](../translations/README.ar.md) | [hi](../translations/README.hi.md) | [bn](../translations/README.bn.md) | [ja](../translations/README.ja.md) | [ko](../translations/README.ko.md)

## Antes de instalar

Use Debian/Ubuntu com acesso administrativo, domínio e DNS funcionando. Os pacotes atuais exigem Node.js 22.12 ou posterior e declaram pnpm 11.5.0. Redis, nginx e os serviços usados pelos módulos habilitados devem estar disponíveis. Revise install.sh: ele instala dependências e altera a configuração do sistema.

## Instalar e entrar

No repositório LUXIPANEL, execute o instalador com seu domínio. Use --https para origem pública TLS ou --cloudflare quando necessário. Configure DNS e certificado válido, abra /login e entre com um usuário Linux existente. O primeiro usuário sudo/wheel elegível pode tornar-se administrador. Existe um modo auto-hospedado; a configuração antiga «managed» não é o procedimento atual.

```bash
sudo bash install.sh --domain panel.example.com --https
```

## Acesso local

O painel autentica o usuário Linux e aplica funções e permissões de módulos. Credenciais web e chaves API de conta não substituem o login Linux. O executor local atua na máquina que hospeda o LUXIPANEL.

## Selecione o destino antes de agir

Escolha o servidor local ou uma conexão SSH no painel instalado. Arquivos, terminal, serviços e operações compatíveis atuam nesse destino conforme capacidades e permissões. Confira o nome antes de gravar arquivos, reiniciar serviços ou excluir recursos.

## Adicionar e usar um destino SSH

No seletor do painel instalado, informe host, porta, usuário SSH e credencial. As credenciais ficam criptografadas nesse painel, não no inventário web retirado. Verifique o destino, selecione-o e teste uma leitura antes de alterar dados. SSH não garante todos os módulos em todos os sistemas operacionais.

## Diagnosticar a conexão

Confira conectividade, porta SSH, credenciais e privilégios remotos. Endereços privados são restritos pela política do servidor; SERVERS_ALLOW_PRIVATE é um ajuste administrativo para redes privadas legítimas. Não desative a verificação do host nem exponha segredos para contornar falhas. Reconecte sessões expiradas.

## Criar uma chave API com nome

Abra Segurança → API KEY na conta web, conclua as verificações e dê um nome descritivo à chave. Copie o segredo exibido e insira-o por API KEY no LUXIPANEL instalado. Não selecione servidor, IP ou credencial SSH em luxipanel.com. A chave identifica sua conta para os serviços autorizados.

## Rotacionar ou revogar uma chave

O segredo completo aparece apenas na criação ou rotação. Após rotacionar, atualize todas as instalações que usam a chave. A revogação interrompe a autorização e cancela as assinaturas ativas de módulos vinculadas. Não exponha chaves em capturas, logs, repositórios ou mensagens de suporte.

## Instalar e gerenciar módulos

Abra Módulos no painel para consultar catálogo, permissões, dependências e disponibilidade. Ative ou instale conforme sua função. Recursos integrados e módulos do marketplace podem ter requisitos diferentes. Antes de assinar um módulo pago, consulte preço e condições atuais.

## Configurar integrações no painel

Configure Cloudflare para DNS e zonas, GitHub para repositórios, Expo para EAS e provedores/conectores do assistente quando habilitados. Cada integração exige credenciais e permissões próprias. A antiga importação cloud e os subdomínios gerenciados no portal não são mais o caminho de configuração.

## Aplicativo móvel: acesso direto

Adicione a URL de um LUXIPANEL instalado, selecione a conexão e entre com o usuário do painel/Linux. O aplicativo ativo usa telas nativas React Native. Lembrar-me guarda dados de sessão em armazenamento seguro, não a senha Linux. Módulos e ações dependem do servidor escolhido e de suas permissões.

## Desktop: perfis e abas

Salve um perfil com nome e URL do painel, teste e abra uma aba. O desktop exibe a interface web do painel numa vista Electron isolada. Abas do mesmo perfil compartilham sessão; perfis diferentes têm armazenamento separado. Alterar a URL apaga o armazenamento anterior. Fechar a janela mantém a bandeja; Sair encerra o aplicativo.

## Atualizações e recuperação

Faça backup da configuração e credenciais criptografadas. Preserve a chave do cofre: alterá-la impede a leitura das credenciais existentes. Compile um projeto por vez. Para Astro, limpe dist, use NODE_OPTIONS=--max-old-space-size=2560, reinicie o processo e verifique HTTP. Ao alterar o ambiente PM2, reavalie o ecosystem com --only e --update-env.

## Preparar um relato útil

Informe produto, versões do cliente e painel, horário, destino, erro exato e passos para reproduzir. Explique o resultado esperado e anexe captura ou log sem segredos. Nunca envie senhas, chaves privadas, chaves API completas, cookies ou códigos de recuperação de dois fatores.

## Guias relacionados

- [Self-hosting](../SELF-HOSTING.md)
- [Despliegue](../DESPLIEGUE-STANDALONE.md)
- [Module SDK](../MODULE-SDK-SPEC.md)
- [Testing](../TESTING.md)
- [Contributing](../CONTRIBUTING.md)
- [Security](../SECURITY.md)
- [License](../LICENSE)
