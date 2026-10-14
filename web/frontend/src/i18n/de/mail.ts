// Aggregator for the mail namespace — split into ./mail/part*.ts to keep each
// file <1000 lines. The merged object is byte-identical to the pre-split literal
// (contiguous key slices spread in order), so the generated i18n JSON is unchanged.
import mailPart1 from "./mail/part1";
import mailPart2 from "./mail/part2";

const mail = { ...mailPart1, ...mailPart2, serverConnection: {
  "title": "SMTP- / IMAP-Server",
  "intro": "Verwenden Sie Postfächer eines anderen gespeicherten Servers. Diese Auswahl gilt für E-Mail in diesem Tab; andere Module behalten ihren aktiven Server.",
  "serverLabel": "Mailserver",
  "hint": "Der Server benötigt kompatibles Postfix/Dovecot und erreichbare Mailports. Postfächer und Zugangsdaten stammen vom ausgewählten Server.",
  "apply": "Server übernehmen",
  "current": "Aktueller Server",
  "currentHint": "E-Mail verwendet den aktiven Server des Panels.",
  "loading": "Server werden geladen…",
  "loadError": "Server konnten nicht geladen werden.",
  "unavailable": "Ausgewählter Server nicht verfügbar",
  "unavailableHint": "Der ausgewählte Server ist nicht mehr verfügbar. Wählen Sie einen anderen oder kehren Sie zum aktuellen Server zurück.",
  "empty": "Keine weiteren aktivierten Server mit bestätigtem SSH-Fingerabdruck sind für Sie zugänglich.",
  "connecting": "Verbindung wird geprüft…",
  "connectError": "Verbindung oder Speichern der Auswahl fehlgeschlagen.",
  "active": "E-Mail: {server}"
} } as const;

export default mail;
