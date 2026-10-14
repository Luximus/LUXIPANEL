// Aggregator for the mail namespace — split into ./mail/part*.ts to keep each
// file <1000 lines. The merged object is byte-identical to the pre-split literal
// (contiguous key slices spread in order), so the generated i18n JSON is unchanged.
import mailPart1 from "./mail/part1";
import mailPart2 from "./mail/part2";

const mail = { ...mailPart1, ...mailPart2, serverConnection: {
  "title": "SMTP / IMAP server",
  "intro": "Use mailboxes from another saved server. This selection applies to Mail in this tab; other modules keep their active server.",
  "serverLabel": "Mail server",
  "hint": "The server needs compatible Postfix/Dovecot and accessible mail ports. Mailboxes and credentials come from the selected server.",
  "apply": "Apply server",
  "current": "Current server",
  "currentHint": "Mail uses the panel’s active server.",
  "loading": "Loading servers…",
  "loadError": "Could not load servers.",
  "unavailable": "Selected server unavailable",
  "unavailableHint": "The selected server is no longer available. Choose another or return to the current server.",
  "empty": "No other enabled servers with an approved SSH fingerprint are accessible to you.",
  "connecting": "Checking connection…",
  "connectError": "Could not connect or save the selection.",
  "active": "Mail: {server}"
} } as const;

export default mail;
