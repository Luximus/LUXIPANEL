// Aggregator for the mail namespace — split into ./mail/part*.ts to keep each
// file <1000 lines. The merged object is byte-identical to the pre-split literal
// (contiguous key slices spread in order), so the generated i18n JSON is unchanged.
import mailPart1 from "./mail/part1";
import mailPart2 from "./mail/part2";

const mail = { ...mailPart1, ...mailPart2, serverConnection: {
  "title": "Servidor SMTP / IMAP",
  "intro": "Use as caixas de correio de outro servidor salvo. Esta seleção se aplica ao Correio nesta aba; os outros módulos mantêm seu servidor ativo.",
  "serverLabel": "Servidor de correio",
  "hint": "O servidor precisa de Postfix/Dovecot compatíveis e portas de correio acessíveis. As caixas e credenciais são do servidor escolhido.",
  "apply": "Aplicar servidor",
  "current": "Servidor atual",
  "currentHint": "O correio usa o servidor ativo do painel.",
  "loading": "Carregando servidores…",
  "loadError": "Não foi possível carregar os servidores.",
  "unavailable": "Servidor selecionado indisponível",
  "unavailableHint": "O servidor selecionado não está mais disponível. Escolha outro ou volte ao servidor atual.",
  "empty": "Não há outros servidores habilitados com impressão digital SSH aprovada aos quais você tenha acesso.",
  "connecting": "Verificando conexão…",
  "connectError": "Não foi possível conectar ou salvar a seleção.",
  "active": "Correio: {server}"
} } as const;

export default mail;
