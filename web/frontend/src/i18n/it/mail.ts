// Aggregator for the mail namespace — split into ./mail/part*.ts to keep each
// file <1000 lines. The merged object is byte-identical to the pre-split literal
// (contiguous key slices spread in order), so the generated i18n JSON is unchanged.
import mailPart1 from "./mail/part1";
import mailPart2 from "./mail/part2";

const mail = { ...mailPart1, ...mailPart2, serverConnection: {
  "title": "Server SMTP / IMAP",
  "intro": "Usa le caselle di un altro server salvato. La scelta si applica a Posta in questa scheda; gli altri moduli mantengono il proprio server attivo.",
  "serverLabel": "Server di posta",
  "hint": "Il server deve avere Postfix/Dovecot compatibili e porte di posta accessibili. Caselle e credenziali provengono dal server scelto.",
  "apply": "Applica server",
  "current": "Server attuale",
  "currentHint": "La posta usa il server attivo del pannello.",
  "loading": "Caricamento dei server…",
  "loadError": "Impossibile caricare i server.",
  "unavailable": "Server selezionato non disponibile",
  "unavailableHint": "Il server selezionato non è più disponibile. Scegline un altro o torna al server attuale.",
  "empty": "Non hai accesso ad altri server abilitati con impronta SSH approvata.",
  "connecting": "Verifica della connessione…",
  "connectError": "Impossibile connettersi o salvare la selezione.",
  "active": "Posta: {server}"
} } as const;

export default mail;
